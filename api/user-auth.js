const { createRemoteJWKSet, jwtVerify } = require("jose");

const FIREBASE_KEYS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

function getBearerToken(req) {
  const value = req.headers.authorization || "";
  if (!value.startsWith("Bearer ")) return null;
  return value.slice(7).trim() || null;
}

async function verifyFirebaseIdToken(token, projectId) {
  if (!token || !projectId) throw new Error("Missing Firebase token or project ID.");

  const { payload } = await jwtVerify(token, FIREBASE_KEYS, {
    issuer: `https://securetoken.google.com/${projectId}`,
    audience: projectId,
  });

  if (!payload.sub || typeof payload.sub !== "string") {
    throw new Error("Firebase token has no user ID.");
  }

  return payload;
}

async function firebaseAuth(req, res, next) {
  try {
    const token = getBearerToken(req);
    const projectId = process.env.FIREBASE_PROJECT_ID;

    if (!token || !projectId) {
      return res.status(401).json({ error: "Missing Firebase authentication." });
    }

    req.firebaseUser = await verifyFirebaseIdToken(token, projectId);
    next();
  } catch {
    return res.status(401).json({ error: "Invalid Firebase authentication." });
  }
}

module.exports = { firebaseAuth, verifyFirebaseIdToken, getBearerToken };
