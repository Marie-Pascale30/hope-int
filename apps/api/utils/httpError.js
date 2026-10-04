// Erreur applicative portant un code HTTP ; le handler central renvoie son message au client.
class HttpError extends Error {
    constructor(status, message, extra = {}) {
        super(message);
        this.status = status;
        Object.assign(this, extra);
    }
}

const badRequest = (message, extra) => new HttpError(400, message, extra);
const unauthorized = (message = "Authentification requise", extra) => new HttpError(401, message, extra);
const forbidden = (message = "Action non autorisée", extra) => new HttpError(403, message, extra);
const notFound = (message = "Ressource introuvable") => new HttpError(404, message);
const conflict = (message, extra) => new HttpError(409, message, extra);

module.exports = { HttpError, badRequest, unauthorized, forbidden, notFound, conflict };
