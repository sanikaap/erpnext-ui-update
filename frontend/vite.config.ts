import { defineConfig, loadEnv } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

export default defineConfig(({ mode }) => {
  // The browser calls same-origin /api; the dev server forwards it to Frappe.
  const frappeTarget =
    loadEnv(mode, import.meta.dirname, "VITE_").VITE_FRAPPE_BASE_URL ||
    "http://erp.localhost:8002";

  return {
    plugins: [vue(), tailwindcss()],

    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },

    server: {
      host: "0.0.0.0",
      port: 5173,

      proxy: {
        "/api": {
          target: frappeTarget,
          changeOrigin: true,
        },
        "/assets": {
          target: frappeTarget,
          changeOrigin: true,
        },
        // Attachments and images uploaded to Frappe.
        "/files": {
          target: frappeTarget,
          changeOrigin: true,
        },
        "/private/files": {
          target: frappeTarget,
          changeOrigin: true,
        },
      },
    },

    build: {
      outDir: "dist",
      emptyOutDir: true,
    },
  };
});
