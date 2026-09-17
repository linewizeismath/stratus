const expressPath = require.resolve("express");
const originalExpress = require(expressPath);
const { firebaseAuth } = require("./user-auth");

function patchedExpress(...args) {
  const app = originalExpress(...args);

  app.use((req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/health", (req, res) => {
    res.json({ ok: true, service: "stratus", version: "1.0.0" });
  });

  app.get("/auth/me", firebaseAuth, (req, res) => {
    res.json({
      uid: req.firebaseUser.sub,
      email: req.firebaseUser.email || null,
      authenticated: true,
    });
  });

  return app;
}

Object.assign(patchedExpress, originalExpress);
patchedExpress.application = originalExpress.application;
patchedExpress.request = originalExpress.request;
patchedExpress.Router = originalExpress.Router;

require.cache[expressPath].exports = patchedExpress;
require("./api.js");
