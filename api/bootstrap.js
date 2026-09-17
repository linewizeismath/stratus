const expressPath = require.resolve("express");
const originalExpress = require(expressPath);
const { firebaseAuth } = require("./user-auth");
const { readFileSync } = require("fs");
const path = require("path");

function loadGames() {
  const candidates = [
    path.join(process.cwd(), "cloud.json"),
    path.join(process.cwd(), "..", "cloud.json"),
  ];

  for (const file of candidates) {
    try {
      const data = JSON.parse(readFileSync(file, "utf8"));
      if (Array.isArray(data)) return data;
    } catch {}
  }

  return [];
}

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

  app.get("/games", (req, res) => {
    const games = loadGames();
    res.json({
      count: games.length,
      games: games.map((game) => ({
        name: game.name || null,
        game_key: game.game_key || null,
        image: game.image || null,
        cover: game.cover || null,
        description: game.description || null,
        tags: Array.isArray(game.tags) ? game.tags : [],
      })),
    });
  });

  app.get("/games/:gameKey", (req, res) => {
    const game = loadGames().find((item) => item.game_key === req.params.gameKey);
    if (!game) return res.status(404).json({ error: "Game not found" });

    res.json({
      name: game.name || null,
      game_key: game.game_key || null,
      image: game.image || null,
      cover: game.cover || null,
      description: game.description || null,
      tags: Array.isArray(game.tags) ? game.tags : [],
    });
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
