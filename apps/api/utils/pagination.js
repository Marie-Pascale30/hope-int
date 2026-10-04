// Pagination serveur optionnelle : sans "page", les listes restent des tableaux complets
// (retrocompatibilite) ; avec "page", reponse { rows, total, page, pageSize }.
const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

function parsePagination(query = {}) {
    if (query.page === undefined || query.page === "") return null;
    const page = Math.max(1, parseInt(query.page, 10) || 1);
    const requested = parseInt(query.pageSize, 10) || DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, requested));
    return { page, pageSize, limit: pageSize, offset: (page - 1) * pageSize };
}

module.exports = { parsePagination, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE };
