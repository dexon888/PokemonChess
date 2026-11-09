import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, defaultClientConditions } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // Resolve workspace packages to their TypeScript source for instant reloads.
  resolve: { conditions: ["source", ...defaultClientConditions] },
  server: { port: 5173 },
});
