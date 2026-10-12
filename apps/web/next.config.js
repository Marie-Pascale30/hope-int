const path = require("path");
const createNextIntlPlugin = require("next-intl/plugin");

// Racine du monorepo : necessaire pour que le build standalone embarque @hope/shared.
const monorepoRoot = path.join(__dirname, "../..");

// Configuration next-intl (langue et messages de chaque requete).
const withNextIntl = createNextIntlPlugin("./src/i18n/request.js");

// Images uploadees servies par l'API (/uploads/...) : origine deduite de l'URL publique de l'API.
function uploadsPattern() {
  try {
    const url = new URL(process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:5000/api");
    return {
      protocol: url.protocol.replace(":", ""),
      hostname: url.hostname,
      ...(url.port ? { port: url.port } : {}),
      pathname: "/uploads/**",
    };
  } catch {
    return null;
  }
}

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ["@hope/shared"],
  images: {
    remotePatterns: [uploadsPattern()].filter(Boolean),
    // 40 : images basse definition du mode eco donnees ; 75 : qualite par defaut.
    qualities: [40, 75],
  },
  // Service worker : toujours revalide, pour que les mises a jour du site arrivent sans attendre.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
  // Anciennes adresses conservees pour ne pas casser les liens existants.
  async redirects() {
    return [
      { source: "/home", destination: "/", permanent: true },
      { source: "/login", destination: "/connexion", permanent: true },
      { source: "/register", destination: "/inscription", permanent: true },
      { source: "/donate", destination: "/don", permanent: true },
    ];
  },
};

module.exports = withNextIntl(nextConfig);
