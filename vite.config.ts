import { defineConfig } from "vite";

// Tauri expects a fixed dev port and a relative base so the built app loads from disk.
export default defineConfig({
  base: "./",
  clearScreen: false,
  server: { port: 5173, strictPort: true },
  build: { target: "es2022" },
  test: { include: ["tests/**/*.test.ts"] },
} as import("vite").UserConfig);
