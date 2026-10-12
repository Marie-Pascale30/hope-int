// Appels API du module engagement : preferences et consentements, newsletter, droits RGPD,
// double authentification, CRM donateurs et campagnes. Chaque fonction renvoie res.data.
import API from "./api";

const data = (promise) => promise.then((res) => res.data);

// --- Public (liens signes, sans connexion) ---
export const preferencesApi = {
  getByToken: (token) => data(API.get("/engagement/preferences", { params: { token } })),
  updateByToken: (token, topics) => data(API.put("/engagement/preferences", { token, topics })),
  unsubscribe: (token, topic) => data(API.post("/engagement/unsubscribe", { token, topic })),
  subscribeNewsletter: (email) => data(API.post("/engagement/newsletter/subscribe", { email })),
  confirmNewsletter: (token) => data(API.post("/engagement/newsletter/confirm", { token })),
};

// --- Espace membre ---
export const memberEngagementApi = {
  preferences: () => data(API.get("/engagement/me/preferences")),
  updatePreferences: (topics) => data(API.put("/engagement/me/preferences", { topics })),
  supportedProjects: () => data(API.get("/engagement/me/supported-projects")),
  exportData: () => data(API.get("/engagement/privacy/export")),
  erase: (password) => data(API.post("/engagement/privacy/erasure", { password, confirmation: true })),
};

// --- Double authentification ---
export const mfaApi = {
  verify: (code) => data(API.post("/auth/mfa/verify", { code })),
  setup: () => data(API.post("/auth/mfa/setup")),
  enable: (code) => data(API.post("/auth/mfa/enable", { code })),
  status: () => data(API.get("/auth/mfa/status")),
  disable: (payload) => data(API.post("/auth/mfa/disable", payload)),
  regenerateBackupCodes: (code) => data(API.post("/auth/mfa/backup-codes", { code })),
  adminStatus: (ids) => data(API.get("/engagement/security/mfa", { params: { ids: ids.join(",") } })),
  adminReset: (userId) => data(API.post(`/engagement/security/users/${userId}/mfa/reset`)),
};

// --- CRM donateurs (MANAGE_DONORS) ---
const donorPath = (key) => `/engagement/donors/${encodeURIComponent(key)}`;
export const donorsApi = {
  list: (params) => data(API.get("/engagement/donors", { params })),
  get: (key) => data(API.get(donorPath(key))),
  addNote: (key, body) => data(API.post(`${donorPath(key)}/notes`, { body })),
  removeNote: (key, id) => data(API.delete(`${donorPath(key)}/notes/${id}`)),
  setTags: (key, tags) => data(API.put(`${donorPath(key)}/tags`, { tags })),
  exportCsv: (params) => data(API.get("/engagement/donors/export.csv", { params, responseType: "blob" })),
};

// --- Campagnes (MANAGE_CAMPAIGNS) ---
export const campaignsApi = {
  list: () => data(API.get("/engagement/campaigns")),
  get: (id) => data(API.get(`/engagement/campaigns/${id}`)),
  create: (payload) => data(API.post("/engagement/campaigns", payload)),
  update: (id, payload) => data(API.put(`/engagement/campaigns/${id}`, payload)),
  remove: (id) => data(API.delete(`/engagement/campaigns/${id}`)),
  preview: (id) => data(API.get(`/engagement/campaigns/${id}/preview`)),
  sendTest: (id) => data(API.post(`/engagement/campaigns/${id}/test`)),
  send: (id) => data(API.post(`/engagement/campaigns/${id}/send`)),
  subscribers: () => data(API.get("/engagement/campaigns/subscribers")),
  templates: () => data(API.get("/engagement/campaigns/templates")),
  createTemplate: (payload) => data(API.post("/engagement/campaigns/templates", payload)),
  updateTemplate: (id, payload) => data(API.put(`/engagement/campaigns/templates/${id}`, payload)),
  removeTemplate: (id) => data(API.delete(`/engagement/campaigns/templates/${id}`)),
  projectNews: () => data(API.get("/engagement/campaigns/project-news")),
  previewProjectNews: (id) => data(API.get(`/engagement/campaigns/project-news/${id}/preview`)),
  sendProjectNews: (id) => data(API.post(`/engagement/campaigns/project-news/${id}/send`)),
};

// Telechargement d'un Blob (export CSV / JSON).
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
