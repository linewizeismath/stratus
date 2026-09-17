FROM node:22-alpine

WORKDIR /app/api

COPY api/package.json ./
RUN npm install --omit=dev

COPY api/ ./

# Railway supplies PORT; the source currently defaults to 3001.
# The small bootstrap below keeps the upstream game implementation untouched while
# adding safe site health/auth routes to the deployed API.
RUN sed -i 's/const PORT = 3001;/const PORT = Number(process.env.PORT || 3001);/' api.js \
 && sed -i '/^const app = express();/i const { firebaseAuth } = require(".\\/user-auth");' api.js \
 && sed -i '/^app.use(express.json({ limit: "1mb" }));/a app.get("/health", (req, res) => res.json({ ok: true, service: "stratus", version: "1.0.0" }));\napp.get("/auth/me", firebaseAuth, (req, res) => res.json({ uid: req.firebaseUser.sub, email: req.firebaseUser.email || null, authenticated: true }));' api.js

ENV NODE_ENV=production
EXPOSE 3001

CMD ["npm", "start"]
