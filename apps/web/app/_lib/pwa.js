// Script inline (porteur du nonce CSP) execute dans <head> avant l'affichage :
// - mode "eco donnees" : data-eco="1" sur <html> si le cookie hope_eco vaut 1, ou si le
//   navigateur demande d'economiser les donnees (Save-Data) et qu'aucun choix n'est enregistre ;
// - enregistrement du service worker (/sw.js) apres le chargement, en production seulement
//   (en developpement, un cache de pages genererait le rechargement a chaud).
export const ECO_COOKIE = "hope_eco";

export function pwaInitScript({ registerWorker }) {
  return `(function(){var d=document.documentElement;try{var m=document.cookie.match(/(?:^|;\\s*)${ECO_COOKIE}=([01])/);var c=navigator.connection;if((m&&m[1]==="1")||(!m&&c&&c.saveData))d.setAttribute("data-eco","1");}catch(e){}${
    registerWorker
      ? `if("serviceWorker" in navigator){window.addEventListener("load",function(){navigator.serviceWorker.register("/sw.js",{scope:"/"}).catch(function(){});});}`
      : ""
  }})();`;
}
