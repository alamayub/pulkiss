import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const target = env.VITE_API_BASE || "http://localhost:3000";
  return {
    plugins: [react()],
    server: {
      port: 5173,
      proxy: {
        "/api": { target, changeOrigin: true },
        "/socket.io": { target, changeOrigin: true, ws: true },
      },
    },
  };
});
