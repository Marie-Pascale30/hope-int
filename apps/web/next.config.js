const path = require("path");

// Racine du monorepo : necessaire pour que le build standalone embarque @hope/shared.
const monorepoRoot = path.join(__dirname, "../..");

/** @type {import('next').NextConfig} */
const nextConfig = {
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
  turbopack: { root: monorepoRoot },
  transpilePackages: ["@hope/shared"],
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

module.exports = nextConfig;
