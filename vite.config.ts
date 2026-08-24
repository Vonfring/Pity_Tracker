import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Saat dev, path proxy yang sama dengan produksi (/api/gacha) diteruskan ke
    // Worker lokal `wrangler dev`. Jadi kode frontend tidak perlu tahu bedanya
    // antara dev dan produksi.
    proxy: {
      "/api/gacha": {
        target: "http://127.0.0.1:8787",
        changeOrigin: true,
        rewrite: () => "/",
      },
    },
  },
  test: {
    globals: true,
    // Default node; test komponen memakai docblock @vitest-environment jsdom.
    environment: "node",
    setupFiles: ["src/test/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
