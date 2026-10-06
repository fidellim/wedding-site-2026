import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const rootDirectory = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        invitation: resolve(rootDirectory, "index.html"),
        admin: resolve(rootDirectory, "admin/index.html"),
        nextChapter: resolve(rootDirectory, "next-chapter/index.html"),
      },
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./admin/src/test/setup.ts"],
  },
});
