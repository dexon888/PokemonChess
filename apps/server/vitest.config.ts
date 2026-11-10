import { defineConfig } from "vitest/config";

export default defineConfig({
  // Colyseus calls process.send() whenever an IPC channel exists (it assumes PM2). The default
  // "forks" pool runs tests in child processes that have one; worker threads do not.
  test: { pool: "threads" },
  resolve: { conditions: ["source"] },
});
