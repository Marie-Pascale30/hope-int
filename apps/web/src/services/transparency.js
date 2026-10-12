// Appels de la transparence (client axios partage : cookie de session + en-tete CSRF).
// Chaque fonction renvoie directement les donnees (res.data).
import API from "./api";

const data = (promise) => promise.then((res) => res.data);

function toFormData(payload) {
  const form = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    if (typeof File !== "undefined" && value instanceof File) form.append(key, value);
    else if (value === null) form.append(key, "");
    else if (typeof value === "boolean") form.append(key, value ? "1" : "0");
    else form.append(key, String(value));
  });
  return form;
}

const ADMIN = "/transparency/admin";

export const transparencyApi = {
  // Public
  index: () => data(API.get("/transparency")),
  year: (year) => data(API.get(`/transparency/${year}`)),
  regions: () => data(API.get("/transparency/regions")),
  team: () => data(API.get("/transparency/team")),
  // Portrait de la personne connectee
  myProfile: () => data(API.get("/transparency/team/me")),
  updateMyProfile: (payload) => data(API.patch("/transparency/team/me", toFormData(payload))),

  // Budget previsionnel (finance)
  budgetProjects: () => data(API.get(`${ADMIN}/budget/projects`)),
  projectBudget: (id) => data(API.get(`${ADMIN}/budget/projects/${id}`)),
  createLine: (projectId, payload) => data(API.post(`${ADMIN}/budget/projects/${projectId}/lines`, payload)),
  updateLine: (id, payload) => data(API.patch(`${ADMIN}/budget/lines/${id}`, payload)),
  deleteLine: (id) => data(API.delete(`${ADMIN}/budget/lines/${id}`)),
  exportDonorReport: (projectId, params) =>
    data(API.get(`${ADMIN}/budget/projects/${projectId}/export`, { params, responseType: "blob" })),

  // Depenses (justificatif : champ "receipt")
  expenses: (params) => data(API.get(`${ADMIN}/expenses`, { params })),
  createExpense: (payload) => data(API.post(`${ADMIN}/expenses`, toFormData(payload))),
  updateExpense: (id, payload) => data(API.patch(`${ADMIN}/expenses/${id}`, toFormData(payload))),
  deleteExpense: (id) => data(API.delete(`${ADMIN}/expenses/${id}`)),
  receipt: (id) => data(API.get(`${ADMIN}/expenses/${id}/receipt`, { responseType: "blob" })),

  // Publication annuelle et documents publics
  years: () => data(API.get(`${ADMIN}/years`)),
  setYear: (year, payload) => data(API.put(`${ADMIN}/years/${year}`, payload)),
  documents: () => data(API.get(`${ADMIN}/documents`)),
  createDocument: (payload) => data(API.post(`${ADMIN}/documents`, toFormData(payload))),
  deleteDocument: (id) => data(API.delete(`${ADMIN}/documents/${id}`)),

  // Portraits de l'equipe (RH)
  teamProfiles: () => data(API.get(`${ADMIN}/team`)),
  updateTeamProfile: (id, payload) => data(API.patch(`${ADMIN}/team/${id}`, toFormData(payload))),
};
