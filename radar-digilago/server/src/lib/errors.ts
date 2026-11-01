export class HttpError extends Error {
  constructor(public status: number, message: string, public details?: unknown) { super(message); }
}
export const notFound = (what = 'Ressource') => new HttpError(404, `${what} introuvable`);
export const forbidden = () => new HttpError(403, 'Action non autorisée pour votre rôle');
export const badRequest = (msg: string, details?: unknown) => new HttpError(400, msg, details);
