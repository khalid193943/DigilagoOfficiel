import type { FastifyInstance } from 'fastify';

/**
 * Sites web FICTIFS servis pour la démonstration (domaine réservé *.demo-radar.invalid).
 * Permettent de tester de bout en bout la lecture des sites, l'audit et la détection WhatsApp sans toucher à de vrais sites.
 */
const title = (slug: string) => slug.split('-').slice(1, -1).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') + ' (démo)';
const num = (slug: string) => slug.split('-').pop() ?? '1000';

function good(slug: string, page: string) {
  const name = title(slug), n = num(slug), year = new Date().getFullYear();
  const contact = `<p>Téléphone : <a href="tel:+2125230${n.padStart(5, '0')}">05 23 0${n.slice(0, 1)} ${n.slice(1)}</a></p>
    <p>Email : <a href="mailto:contact@${slug}.demo-radar.invalid">contact@${slug}.demo-radar.invalid</a></p>
    <p><a href="https://wa.me/2126000${n.padStart(5, '0')}">Écrivez-nous sur WhatsApp</a></p>`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${name} — El Jadida</title><meta name="description" content="${name} : site de démonstration fictif du Radar Digilago.">
  <link rel="icon" href="data:,"><script type="application/ld+json">{"@context":"https://schema.org","@type":"LocalBusiness","name":"${name}"}</script></head>
  <body><header><h1>${name}</h1><nav><a href="/contact">Contact</a> · <a href="/rendez-vous">Prendre rendez-vous</a></nav></header>
  ${page === 'contact' ? contact : '<p>Site de démonstration : données fictives.</p>'}
  <footer><a href="https://www.instagram.com/radar-demo-${slug}">Instagram</a> · <a href="https://www.facebook.com/radar-demo-${slug}">Facebook</a> · © ${year} ${name}</footer></body></html>`;
}
function basic(slug: string) {
  const name = title(slug), n = num(slug);
  return `<html><head><title>${name}</title><meta name="generator" content="WordPress 4.9.8"><link rel="stylesheet" href="/wp-content/themes/twentyfifteen/style.css"></head>
  <body><div id="page"><b>Bienvenue chez ${name}</b><p>Site de démonstration fictif.</p><p>Tel : 0523-0${n}</p><p>© 2016 ${name}</p></div></body></html>`;
}

export async function demoSiteRoutes(app: FastifyInstance) {
  app.get('/demo-sites/:slug', async (req, rep) => serve((req.params as any).slug, 'home', rep));
  app.get('/demo-sites/:slug/*', async (req, rep) => serve((req.params as any).slug, String((req.params as any)['*'] ?? ''), rep));
  async function serve(slug: string, path: string, rep: any) {
    if (path === 'robots.txt') return rep.type('text/plain').send('User-agent: *\nDisallow: /admin\n');
    const variant = slug.split('-')[0];
    if (variant === 'broken') return rep.code(500).type('text/html').send('<h1>Erreur interne</h1>');
    if (variant === 'good') return rep.type('text/html; charset=utf-8').send(good(slug, path.startsWith('contact') ? 'contact' : 'home'));
    if (variant === 'basic') return rep.type('text/html; charset=utf-8').send(basic(slug));
    return rep.code(404).send('Not found');
  }
}
