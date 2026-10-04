// Constantes du theme utilisables cote serveur (layout racine).
export const THEME_STORAGE_KEY = "hope_theme";

// Script minimal execute dans <head> avant le premier rendu : applique le theme force
// (clair ou sombre) pour eviter un flash. Sans preference, le CSS suit le systeme.
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})();`;
