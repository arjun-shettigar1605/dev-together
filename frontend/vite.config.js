import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    react(),
    nodePolyfills({
      // Enable polyfills for specific globals and modules
      globals: {
        Buffer: true,
        global: true,
        process: true,
      },
      protocolImports: true,
    }),
  ],
  resolve: {
    alias: {
      events: "events",
      util: "util",
      buffer: "buffer",
      stream: "stream-browserify",
    },
  },
  optimizeDeps: {
    include: ["simple-peer", "buffer", "util", "events", "process"],
    esbuildOptions: {
      define: {
        global: "globalThis",
      },
    },
  },
});
