// Verification des contrastes WCAG des paires de tokens (clair et sombre).
const fs=require("fs");
const path=require("path");
// Usage : node scripts/check-contrast.js [chemin de globals.css]
const css=fs.readFileSync(process.argv[2]||path.join(__dirname,"../src/styles/globals.css"),"utf8");
const parse=(block)=>{const o={};for(const m of block.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\s*;/g))o[m[1]]=m[2];return o};
const light=parse(css.slice(css.indexOf(":root {"),css.indexOf("@media (prefers-color-scheme: dark)")));
const darkBlock=css.slice(css.indexOf(':root[data-theme="dark"] {'));
const dark={...light,...parse(darkBlock.slice(0,darkBlock.indexOf("}")))};
const hex=h=>{h=h.replace('#','');if(h.length===3)h=h.split('').map(c=>c+c).join('');return [0,2,4].map(i=>parseInt(h.slice(i,i+2),16))};
const lum=rgb=>{const [r,g,b]=rgb.map(v=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)});return 0.2126*r+0.7152*g+0.0722*b};
const ratio=(a,b)=>{const la=lum(hex(a)),lb=lum(hex(b));return (Math.max(la,lb)+0.05)/(Math.min(la,lb)+0.05)};
// [premier plan, fond, seuil, usage]
const pairs=[
 ["ink","bg",4.5,"texte"],["ink","surface",4.5,"texte"],["ink","surface-2",4.5,"texte"],
 ["ink-2","bg",4.5,"texte secondaire"],["ink-2","surface",4.5,""],["ink-2","surface-2",4.5,""],["ink-2","surface-3",4.5,"puces d'onglet"],
 ["ink-3","bg",4.5,"texte discret"],["ink-3","surface",4.5,""],["ink-3","surface-2",4.5,""],
 ["brand","bg",4.5,"liens"],["brand","surface",4.5,"liens"],["brand-700","brand-50",4.5,"onglet/nav actif"],["brand","brand-50",4.5,"badge marque"],
 ["on-brand","brand",4.5,"bouton principal"],["on-brand","brand-700",4.5,"bouton principal survol"],
 ["on-accent","accent-solid",4.5,"bouton don"],["on-accent","accent-solid-hover",4.5,"bouton don survol"],
 ["accent-700","bg",4.5,"surtitre"],["accent-700","surface",4.5,""],["accent-700","accent-50",4.5,"badge accent"],
 ["on-danger","danger",4.5,"bouton danger"],["on-danger","danger-hover",4.5,"bouton danger survol"],
 ["danger","surface",4.5,"message d'erreur"],["danger","bg",4.5,""],["danger","danger-50",4.5,"badge"],
 ["success","success-50",4.5,"badge"],["warning","warning-50",4.5,"badge"],["info","info-50",4.5,"badge"],
 ["success-ink","success-50",4.5,"alerte"],["warning-ink","warning-50",4.5,"alerte"],["danger-ink","danger-50",4.5,"alerte"],["info-ink","info-50",4.5,"alerte"],
 ["ink-2","neutral-50",4.5,"badge neutre"],
 ["on-dark","surface-dark",4.5,"pied de page / admin"],["on-dark-2","surface-dark",4.5,""],["on-dark-3","surface-dark",4.5,"titres de section admin"],
 ["on-dark","surface-brand",4.5,"bandeau CTA"],["on-dark-2","surface-brand-deep",4.5,"bandeau chiffres"],
 ["line-input","bg",3,"bordure champ"],["line-input","surface",3,""],["line-input","surface-2",3,""],
 ["focus-color","bg",3,"contour focus"],["focus-color","surface",3,""],["focus-color","surface-2",3,""],
 ["focus-on-dark","surface-dark",3,"focus fond sombre"],["focus-on-dark","surface-brand",3,""],
 ["chart-muted","surface",4.5,"axes graphiques"],["chart-tooltip-ink","chart-tooltip-bg",4.5,"infobulle"],
];
let fails=0;const rows=[];
for(const [fg,bg,min,use] of pairs){const r=[];for(const [name,t] of [["clair",light],["sombre",dark]]){const v=ratio(t[fg],t[bg]);if(v<min)fails++;r.push((v<min?"ECHEC ":"")+v.toFixed(2))}rows.push(`| --${fg} / --${bg} | ${min} | ${r[0]} | ${r[1]} | ${use} |`)}
console.log("| Paire | Seuil | Clair | Sombre | Usage |\n|---|---|---|---|---|\n"+rows.join("\n"));
console.log("\nEchecs:",fails);
