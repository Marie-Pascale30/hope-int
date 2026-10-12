// Appels API du module benevolat (heures, badges, attestations, liste d'attente, appel des
// participants, benevoles par region) et du workflow de validation des contenus.
// Chaque fonction renvoie directement les donnees (res.data).
import API from "./api";

const data = (promise) => promise.then((res) => res.data);

export const volunteeringApi = {
  // Espace membre
  mine: () => data(API.get("/volunteering/me")),
  issueCertificate: (period = {}) => data(API.post("/volunteering/me/certificates", period)),
  // Telechargement authentifie : Blob a enregistrer cote navigateur.
  certificatePdf: (code) => data(API.get(`/volunteering/me/certificates/${encodeURIComponent(code)}/pdf`, { responseType: "blob" })),
  // Verification publique d'une attestation
  verifyCertificate: (code) => data(API.get(`/volunteering/certificates/${encodeURIComponent(code)}`)),

  // Liste d'attente d'un evenement complet -> { status: "registered" | "waitlisted", position }
  joinWaitlist: (eventId) => data(API.post(`/volunteering/events/${eventId}/waitlist`)),
  leaveWaitlist: (eventId) => data(API.delete(`/volunteering/events/${eventId}/waitlist`)),

  // Administration : appel des participants
  attendance: (eventId) => data(API.get(`/volunteering/admin/events/${eventId}/attendance`)),
  // entries : [{ userId, attendance: "present" | "absent" | null, hours? }]
  saveAttendance: (eventId, entries) => data(API.put(`/volunteering/admin/events/${eventId}/attendance`, { entries })),

  // Administration : benevoles et heures hors evenement
  volunteers: (params) => data(API.get("/volunteering/admin/volunteers", { params })),
  volunteer: (id) => data(API.get(`/volunteering/admin/volunteers/${id}`)),
  exportVolunteers: (params) => data(API.get("/volunteering/admin/volunteers/export", { params, responseType: "blob" })),
  addHours: (payload) => data(API.post("/volunteering/admin/hours", payload)),
  deleteHours: (id) => data(API.delete(`/volunteering/admin/hours/${id}`)),
};

export const contentReviewApi = {
  queue: (status) => data(API.get("/admin/content-review/queue", { params: status ? { status } : {} })),
  count: () => data(API.get("/admin/content-review/count")),
  item: (type, id) => data(API.get(`/admin/content-review/${type}/${id}`)),
  submit: (type, id) => data(API.post(`/admin/content-review/${type}/${id}/submit`)),
  approve: (type, id, { comment, publish = true } = {}) =>
    data(API.post(`/admin/content-review/${type}/${id}/approve`, { publish, ...(comment ? { comment } : {}) })),
  reject: (type, id, comment) => data(API.post(`/admin/content-review/${type}/${id}/reject`, { comment })),
};
