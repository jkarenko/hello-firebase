import {defineConfig} from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Allow both localhost and 127.0.0.1
    host: true,
    proxy: {
      "/getSongVersions": {
        target: "http://127.0.0.1:5001/echoherence/us-central1",
        changeOrigin: true,
      },
      "/getAudioUrl": {
        target: "http://127.0.0.1:5001/echoherence/us-central1",
        changeOrigin: true,
      },
    },
    // Add HMR configuration
    hmr: {
      overlay: true,
    },
    watch: {
      usePolling: true,
    },
  },
});
