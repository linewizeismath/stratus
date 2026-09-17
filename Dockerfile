FROM node:22-alpine

WORKDIR /app/api

COPY api/package.json ./
RUN npm install --omit=dev

COPY api/ ./

# Railway supplies PORT; the source currently defaults to 3001.
# Add safe site health/auth routes at image-build time without changing the
# upstream game-session implementation in the repository source.
RUN sed -i 's/const PORT = 3001;/const PORT = Number(process.env.PORT || 3001);/' api.js \
 && sed -i '/^const app = express();/i const { firebaseAuth } = require(".\\/user-auth");' api.js \
 && sed -i '/^app.use(express.json({ limit: "1mb" }));/a app.use((req, res, next) => { res.setHeader("Access-Control-Allow-Origin", "*"); res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key"); res.setHeader("Access-Control-Allow-Methods", "GET,POST,OPTIONS"); if (req.method === "OPTIONS") return res.sendStatus(204); next(); });\napp.get("/health", (req, res) => res.json({ ok: true, service: "stratus", version: "1.0.0" }));\napp.get("/auth/me", firebaseAuth, (req, res) => res.json({ uid: req.firebaseUser.sub, email: req.firebaseUser.email || null, authenticated: true }));' api.js

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
