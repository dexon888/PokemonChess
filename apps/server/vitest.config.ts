import { defineConfig } from "vitest/config";

export default defineConfig({
  // Colyseus calls process.send() whenever an IPC channel exists (it assumes PM2). The default
  // "forks" pool runs tests in child processes that have one; worker threads do not.
  // Integration test files each boot a Colyseus server on the same test port, so files run one
  // at a time.
  test: { pool: "threads", fileParallelism: false },
  resolve: { conditions: ["source"] },
});
