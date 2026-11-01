import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify, { type FastifyError } from 'fastify';
import cookie from '@fastify/cookie';
import multipart from '@fastify/multipart';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { ZodError } from 'zod';
import { COOKIE, userFromToken } from './auth/auth.js';
import { config } from './config.js';
import { HttpError } from './lib/errors.js';
import { authRoutes } from './routes/auth.js';
import { companyRoutes } from './routes/companies.js';
import { dataRoutes } from './routes/data.js';
import { demoSiteRoutes } from './routes/demo-sites.js';
import { radarRoutes } from './routes/radar.js';
import { scanRoutes } from './routes/scans.js';

export async function buildApp(opts: { logger?: boolean } = {}) {
  const app = Fastify({ logger: opts.logger ? { level: 'info', redact: ['req.headers.cookie', 'req.headers.authorization'] } : false, trustProxy: true, bodyLimit: 2 * 1024 * 1024 });
  await app.register(cookie);
  await app.register(rateLimit, { global: true, max: 600, timeWindow: '1 minute', allowList: (req) => req.url.startsWith('/demo-sites') });
  await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

  // En-têtes de sécurité
  app.addHook('onSend', async (_req, rep, payload) => {
    rep.header('X-Content-Type-Options', 'nosniff');
    rep.header('X-Frame-Options', 'SAMEORIGIN');
    rep.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    return payload;
  });
  // Session
  app.addHook('preHandler', async (req) => { if (req.url.startsWith('/api/')) req.user = await userFromToken(req.cookies[COOKIE]); });
  // Protection CSRF simple : toute requête qui modifie doit venir de notre propre origine (en-tête JSON ou X-Requested-With).
  app.addHook('preHandler', async (req) => {
    if (!req.url.startsWith('/api/') || ['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return;
    const ct = String(req.headers['content-type'] ?? '');
    if (!ct.includes('application/json') && !ct.includes('multipart/form-data') && req.headers['x-requested-with'] !== 'radar') throw new HttpError(415, 'Type de contenu non accepté');
    const origin = req.headers.origin;
    if (origin && config.isProd && new URL(origin).host !== req.headers.host) throw new HttpError(403, 'Origine refusée');
  });

  app.setErrorHandler((err: FastifyError | HttpError | ZodError, req, rep) => {
    if (err instanceof ZodError) return rep.code(400).send({ error: 'Données invalides', details: err.issues.map((i) => `${i.path.join('.')}: ${i.message}`) });
    if (err instanceof HttpError) return rep.code(err.status).send({ error: err.message, details: err.details });
    const status = (err as FastifyError).statusCode ?? 500;
    if (status >= 500) req.log.error(err);
    return rep.code(status).send({ error: status >= 500 ? 'Erreur interne' : err.message });
  });

  app.get('/api/health', async () => ({ ok: true, time: new Date().toISOString() }));
  await app.register(authRoutes);
  await app.register(radarRoutes);
  await app.register(scanRoutes);
  await app.register(companyRoutes);
  await app.register(dataRoutes);
  if (config.sources.demo.enabled) await app.register(demoSiteRoutes);

  // Interface web (build Vite) servie par le même serveur
  const webDist = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../web/dist');
  if (existsSync(webDist)) {
    // Fichiers servis dynamiquement (un nouveau build est pris en compte sans redémarrage).
    // Fichiers hachés de /assets : cache long ; le reste (index.html…) : toujours revalidé.
    await app.register(fastifyStatic, {
      root: webDist, wildcard: true, cacheControl: false,
      setHeaders: (res: any, filePath: string) => (res.setHeader ?? res.header).call(res, 'Cache-Control', filePath.includes(`${path.sep}assets${path.sep}`) ? 'public, max-age=31536000, immutable' : 'no-cache'),
    });
    app.setNotFoundHandler((req, rep) => {
      if (req.url.startsWith('/api/')) return rep.code(404).send({ error: 'Route inconnue' });
      if (req.url.startsWith('/assets/') || /\.[a-z0-9]{2,5}(\?|$)/i.test(req.url)) return rep.code(404).type('text/plain').send('Introuvable');
      return rep.header('Cache-Control', 'no-cache').sendFile('index.html');
    });
  }
  return app;
}
