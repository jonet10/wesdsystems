import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
    proxy: {
      "/api": {
        target: "https://wesdsystems.store",
        changeOrigin: true,
      },
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/(react|react-dom|scheduler|react-router|react-hook-form|@hookform|zod|react-is)/.test(id)) {
              return "vendor-react";
            }
            if (id.includes("@radix-ui")) {
              return "vendor-ui";
            }
            if (id.includes("@tanstack")) {
              return "vendor-tables";
            }
            if (id.includes("@supabase")) {
              return "vendor-supabase";
            }
            if (id.includes("lucide-react") || id.includes("recharts") || id.includes("date-fns") || id.includes("i18next")) {
              return "vendor-large";
            }
            if (id.includes("jspdf") || id.includes("html2canvas") || id.includes("dompurify")) {
              return "vendor-print";
            }
            return "vendor-other";
          }
        },
      },
    },
  },
}));
