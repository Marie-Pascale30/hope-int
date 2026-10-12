// Reseaux sociaux affiches dans le pied de page. URL configurables par variables d'environnement
// publiques (inlinees au build : chaque variable doit etre ecrite en toutes lettres).
// Un reseau sans URL (ou avec une URL non https) n'est pas affiche.
const RAW = [
  ["facebook", "Facebook", process.env.NEXT_PUBLIC_SOCIAL_FACEBOOK],
  ["instagram", "Instagram", process.env.NEXT_PUBLIC_SOCIAL_INSTAGRAM],
  ["linkedin", "LinkedIn", process.env.NEXT_PUBLIC_SOCIAL_LINKEDIN],
  ["x", "X", process.env.NEXT_PUBLIC_SOCIAL_X],
  ["youtube", "YouTube", process.env.NEXT_PUBLIC_SOCIAL_YOUTUBE],
  ["tiktok", "TikTok", process.env.NEXT_PUBLIC_SOCIAL_TIKTOK],
  ["whatsapp", "WhatsApp", process.env.NEXT_PUBLIC_SOCIAL_WHATSAPP],
];

export function isSafeSocialUrl(value) {
  try {
    const url = new URL(String(value || "").trim());
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

export function socialLinks(entries = RAW) {
  return entries
    .filter(([, , url]) => isSafeSocialUrl(url))
    .map(([id, name, url]) => ({ id, name, url: String(url).trim() }));
}
