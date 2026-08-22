import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { createProxyMiddleware } from "http-proxy-middleware";

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Middleware to parse JSON
  app.use(express.json());

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  const geminiProxy = createProxyMiddleware({
    target: "https://generativelanguage.googleapis.com",
    changeOrigin: true,
    ws: true,
    pathRewrite: (path, req) => {
      const apiKey = process.env.GEMINI_API_KEY;
      let newPath = path.replace(/^\/api\/gemini/, "");
      if (apiKey) {
        // Replace the dummy key in the URL query
        newPath = newPath.replace("dummy-key-to-satisfy-sdk", apiKey);
      }
      console.log(`[WS/HTTP Proxy] ${req.method || 'WS'} ${path} -> ${newPath}`);
      return newPath;
    },
    on: {
      proxyReq: (proxyReq, req, res) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          proxyReq.setHeader("x-goog-api-key", apiKey);
        }
      },
      proxyReqWs: (proxyReq, req, socket, options, head) => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey) {
          proxyReq.setHeader("x-goog-api-key", apiKey);
        }
      }
    }
  });

  app.use("/api/gemini", geminiProxy);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  server.on('upgrade', (req, socket, head) => {
    if (req.url && req.url.startsWith('/api/gemini')) {
      // Pass the WebSocket request to the proxy
      // @ts-ignore - The types for upgrade might require specific signature
      geminiProxy.upgrade(req, socket, head);
    }
  });
}

startServer();
