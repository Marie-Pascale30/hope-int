// Appels API regroupes par domaine. Chaque fonction renvoie directement les donnees (res.data).
import API from "./api";

const data = (promise) => promise.then((res) => res.data);

function toFormData(payload) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value instanceof File) form.append(key, value);
    else if (value === null) form.append(key, "");
    else if (typeof value === "boolean") form.append(key, value ? "1" : "0");
    else form.append(key, String(value));
  });
  return form;
}

// --- Public ---
export const publicApi = {
  meta: () => data(API.get("/meta")),
  impact: () => data(API.get("/impact")),
  listContent: (type, params) => data(API.get(`/content/${type}`, { params })),
  getContent: (type, id) => data(API.get(`/content/${type}/${id}`)),
  sendMessage: (payload) => data(API.post("/messages", payload)),
  sendApplication: (payload) => data(API.post("/applications", payload)),
  listEvents: (params) => data(API.get("/events", { params })),
  getEvent: (id) => data(API.get(`/events/${id}`)),
  myEvents: () => data(API.get("/events/mine")),
  registerEvent: (id) => data(API.post(`/events/${id}/registration`)),
  unregisterEvent: (id) => data(API.delete(`/events/${id}/registration`)),
};

// --- Authentification / compte ---
export const authApi = {
  login: (payload) => data(API.post("/auth/login", payload)),
  register: (payload) => data(API.post("/auth/register", payload)),
  me: () => data(API.get("/auth/me")),
  updateMe: (payload) => data(API.patch("/auth/me", payload)),
  changePassword: (payload) => data(API.post("/auth/change-password", payload)),
  forgotPassword: (email) => data(API.post("/auth/forgot-password", { email })),
  resetPassword: (payload) => data(API.post("/auth/reset-password", payload)),
};

// --- Dons ---
export const paymentApi = {
  createDonation: (payload) => data(API.post("/payment/donations", payload)),
  getReceipt: (token) => data(API.get(`/payment/receipts/${token}`)),
  confirmReceipt: (token, payload = {}) => data(API.post(`/payment/receipts/${token}/confirm`, payload)),
  receiptPdfUrl: (token) => `${API.defaults.baseURL}/payment/receipts/${token}/pdf`,
  mine: () => data(API.get("/payment/mine")),
  cancelSubscription: (id) => data(API.delete(`/payment/subscriptions/${id}`)),
};

// --- Administration ---
export const adminApi = {
  stats: () => data(API.get("/admin/stats")),
  roles: () => data(API.get("/admin/roles")),
  logs: (params) => data(API.get("/admin/logs", { params })),
  system: () => data(API.get("/admin/system")),
  regional: (region) => data(API.get("/admin/regional", { params: region ? { region } : {} })),
  annualReport: (year) => data(API.get("/admin/reports/annual", { params: year ? { year } : {} })),

  users: (params) => data(API.get("/admin/users", { params })),
  staff: () => data(API.get("/admin/staff")),
  createUser: (payload) => data(API.post("/admin/users", payload)),
  updateUserRoles: (id, roles) => data(API.patch(`/admin/users/${id}/roles`, { roles })),
  updateUserProfile: (id, payload) => data(API.patch(`/admin/users/${id}/profile`, payload)),
  deleteUser: (id) => data(API.delete(`/admin/users/${id}`)),

  messages: (params) => data(API.get("/admin/messages", { params })),
  updateMessage: (id, payload) => data(API.patch(`/admin/messages/${id}`, payload)),
  deleteMessage: (id) => data(API.delete(`/admin/messages/${id}`)),

  applications: (params) => data(API.get("/admin/applications", { params })),
  reviewApplication: (id, reviewNote) => data(API.post(`/admin/applications/${id}/review`, { reviewNote })),
  rejectApplication: (id, reviewNote) => data(API.post(`/admin/applications/${id}/reject`, { reviewNote })),
  acceptApplication: (id, payload) => data(API.post(`/admin/applications/${id}/accept`, payload)),

  donations: (params) => data(API.get("/admin/donations", { params })),
  financeSummary: (year) => data(API.get("/admin/finance/summary", { params: year ? { year } : {} })),
  reconcile: () => data(API.post("/admin/finance/reconcile")),
  // Telechargement authentifie : renvoie un Blob a enregistrer cote navigateur.
  exportDonations: (params) => data(API.get("/admin/finance/export", { params, responseType: "blob" })),

  content: (type) => data(API.get(`/admin/content/${type}`)),
  createContent: (type, payload) => data(API.post(`/admin/content/${type}`, toFormData(payload))),
  updateContent: (type, id, payload) => data(API.patch(`/admin/content/${type}/${id}`, toFormData(payload))),
  deleteContent: (type, id) => data(API.delete(`/admin/content/${type}/${id}`)),

  events: () => data(API.get("/admin/events")),
  createEvent: (payload) => data(API.post("/admin/events", toFormData(payload))),
  updateEvent: (id, payload) => data(API.patch(`/admin/events/${id}`, toFormData(payload))),
  deleteEvent: (id) => data(API.delete(`/admin/events/${id}`)),
  eventRegistrations: (id) => data(API.get(`/admin/events/${id}/registrations`)),
};
