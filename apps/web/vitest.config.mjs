import path from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Tests unitaires du site (fonctions pures et composants simples) : npm run test -w @hope/web.
// Les scenarios Playwright (e2e/) sont lances a part : npm run test:e2e.
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Meme alias que jsconfig.json : import "@/src/..."
    alias: { "@": root },
  },
  test: {
    // DOM jsdom pose par test/setup-dom.js (voir l'explication dans ce fichier).
    environment: "node",
    include: ["test/**/*.test.{js,jsx}"],
    setupFiles: ["./test/setup-dom.js", "./test/setup.js"],
    // Fuseau fixe : les dates formatees ne dependent pas de la machine.
    env: { TZ: "Africa/Douala", NEXT_PUBLIC_API_BASE_URL: "http://localhost:5000/api" },
  },
});
