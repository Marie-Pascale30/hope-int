// Appels API de la collecte de fonds (dons etendus). Chaque fonction renvoie directement les donnees.
import API from "./api";

const data = (promise) => promise.then((res) => res.data);

function toFormData(payload) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (value instanceof Blob) form.append(key, value);
    else form.append(key, String(value));
  });
  return form;
}

// --- Public et espace membre ---
export const fundraisingApi = {
  // Collectes personnelles
  publicFundraiser: (slug) => data(API.get(`/fundraising/fundraisers/public/${encodeURIComponent(slug)}`)),
  listFundraisers: (params) => data(API.get("/fundraising/fundraisers", { params })),
  myFundraisers: () => data(API.get("/fundraising/fundraisers/mine")),
  createFundraiser: (payload) => data(API.post("/fundraising/fundraisers", toFormData(payload))),
  updateFundraiser: (id, payload) => data(API.patch(`/fundraising/fundraisers/${id}`, toFormData(payload))),

  // Engagements de don mensuel Mobile Money
  createPledge: (payload) => data(API.post("/fundraising/pledges", payload)),
  myPledges: () => data(API.get("/fundraising/pledges/mine")),
  updatePledge: (id, payload) => data(API.patch(`/fundraising/pledges/${id}`, payload)),
  pledgeByToken: (token) => data(API.get(`/fundraising/pledges/token/${token}`)),
  updatePledgeByToken: (token, payload) => data(API.patch(`/fundraising/pledges/token/${token}`, payload)),

  // Dons mensuels Stripe : portail de facturation (jeton de recu, ou abonnement du compte)
  billingPortal: (payload) => data(API.post("/fundraising/subscriptions/portal", payload)),
};

// --- Back-office ---
export const fundraisingAdminApi = {
  insights: (year) => data(API.get("/fundraising/admin/insights", { params: year ? { year } : {} })),

  offlineDonations: (params) => data(API.get("/fundraising/admin/offline", { params })),
  createOfflineDonation: (payload) => data(API.post("/fundraising/admin/offline", toFormData(payload))),
  validateOfflineDonation: (id) => data(API.post(`/fundraising/admin/offline/${id}/validate`)),
  rejectOfflineDonation: (id, reason) => data(API.post(`/fundraising/admin/offline/${id}/reject`, reason ? { reason } : {})),
  offlineProof: (id) => data(API.get(`/fundraising/admin/offline/${id}/proof`, { responseType: "blob" })),

  pledges: (params) => data(API.get("/fundraising/admin/pledges", { params })),

  annualStatus: (year) => data(API.get(`/fundraising/admin/annual-summaries/${year}`)),
  sendAnnualSummaries: (year) => data(API.post("/fundraising/admin/annual-summaries", { year })),

  fundraisers: (params) => data(API.get("/fundraising/admin/fundraisers", { params })),
  moderateFundraiser: (id, decision, note) =>
    data(API.post(`/fundraising/admin/fundraisers/${id}/moderate`, { decision, ...(note ? { note } : {}) })),
};
