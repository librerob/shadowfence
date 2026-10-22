import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  base: "./",
  build: {
    target: "chrome120",
    rollupOptions: {
      input: { app: resolve("app.html"), popup: resolve("popup.html") },
    },
  },
});
