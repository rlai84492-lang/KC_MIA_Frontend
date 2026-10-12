// import { defineConfig, loadEnv } from "vite";

// import react from "@vitejs/plugin-react";
 
// export default defineConfig(({ mode }) => {

//   const env = loadEnv(mode, process.cwd(), "");

//   // `npm run dev` /api ko yahan bhejta hai: VM backend (BACKEND_URL in .env.local), warna local backend.

//   const backend = env.BACKEND_URL || "http://localhost:8086";

//   return {

//     plugins: [react()],

//     server: {

//       port: 5173,

//       strictPort: true,

//       proxy: {

//         "/api": {
//           target: backend,
//           changeOrigin: true,
//           secure: true,
//           configure: (proxy) => {
//             proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
//           },
//         },

//       },

//     },

//     build: {

//       // No source maps in the production build: they would publish the readable source next to the site.

//       sourcemap: false,

//     },

//   };

// });
 


 

import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  // `npm run dev` /api ko yahan bhejta hai: VM backend (BACKEND_URL in .env.local), warna local backend.
  const backend = env.BACKEND_URL || "http://localhost:8086";

  return {
    // Build nginx par /dashboard/ se serve hoga; dev mein root
    base: mode === "production" ? "/dashboard/" : "/",
    plugins: [react()],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: backend,
          changeOrigin: true,
          secure: true,
          configure: (proxy) => {
            proxy.on("proxyReq", (proxyReq) => proxyReq.removeHeader("origin"));
          },
        },
      },
    },
    build: {
      // No source maps in the production build: they would publish the readable source next to the site.
      sourcemap: false,
    },
  };
});