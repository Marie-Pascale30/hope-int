import { DEFAULT_LOCALE, localizePath } from "@/src/i18n/config";
import { serverApi, settle } from "@/src/services/server";
import { absoluteUrl, languageAlternates } from "@/src/views/site/seo";

// Plan du site : pages publiques + projets, actualites et evenements publies, avec leurs
// variantes de langue (hreflang). Regenere au plus toutes les heures.
export const revalidate = 3600;

const STATIC_PAGES = [
  { path: "/", priority: 1, changeFrequency: "daily" },
  { path: "/projets", priority: 0.9, changeFrequency: "daily" },
  { path: "/actualites", priority: 0.8, changeFrequency: "daily" },
  { path: "/evenements", priority: 0.8, changeFrequency: "daily" },
  { path: "/don", priority: 0.9, changeFrequency: "monthly" },
  { path: "/rejoindre", priority: 0.7, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.5, changeFrequency: "yearly" },
];

function entry(path, { lastModified, priority = 0.6, changeFrequency = "weekly" } = {}) {
  const languages = Object.fromEntries(
    Object.entries(languageAlternates(path)).map(([code, href]) => [code, absoluteUrl(href)])
  );
  return {
    url: absoluteUrl(localizePath(DEFAULT_LOCALE, path)),
    ...(lastModified ? { lastModified: new Date(lastModified) } : {}),
    changeFrequency,
    priority,
    alternates: { languages },
  };
}

export default async function sitemap() {
  const [projects, news, events] = await Promise.all([
    settle(serverApi.listContent("projects")),
    settle(serverApi.listContent("news")),
    settle(serverApi.listEvents()),
  ]);

  return [
    ...STATIC_PAGES.map((page) => entry(page.path, page)),
    ...(projects.data || []).map((item) => entry(`/projets/${item.id}`, { lastModified: item.updated_at || item.created_at, priority: 0.7 })),
    ...(news.data || []).map((item) => entry(`/actualites/${item.id}`, { lastModified: item.updated_at || item.created_at, priority: 0.6 })),
    ...(events.data || []).map((item) => entry(`/evenements/${item.id}`, { lastModified: item.updated_at || item.created_at, priority: 0.6 })),
  ];
}
