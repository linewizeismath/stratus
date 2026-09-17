const FIREBASE_ISSUER = "https://securetoken.google.com";
const GOOGLE_CERTS_URL = "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

let cachedCerts = null;
let cachedAt = 0;

async function getGoogleCerts() {
  const now = Date.now();
  if (cachedCerts && now - cachedAt < 60 * 60 * 1000) return cachedCerts;

  const response = await fetch(GOOGLE_CERTS_URL);
  if (!response.ok) throw new Error("Unable to fetch Firebase signing certificates.");

  cachedCerts = await response.json();
  cachedAt = now;
  return cachedCerts;
}

function decodeBase64Url(value) {
  return Buffer.from(value.replace(/-/g, "+").replace(/_/g, "/"), "base64").toString("utf8");
}

function decodeJwt(token) {
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("Invalid Firebase ID token.");
  return {
    header: JSON.parse(decodeBase64Url(parts[0])),
    payload: JSON.parse(decodeBase64Url(parts[1])),
    signature: Buffer.from(parts[2].replace(/-/g, "+").replace(/_/g, "/"), "base64"),
    signed: `${parts[0]}.${parts[1]}`,
  };
}

async function verifyFirebaseIdToken(token, projectId) {
  if (!token || !projectId) throw new Error("Missing Firebase token or project ID.");

  const { header, payload, signature, signed } = decodeJwt(token);
  if (header.alg !== "RS256" || !header.kid) throw new Error("Unsupported Firebase token.");

  const certs = await getGoogleCerts();
  const certificate = certs[header.kid];
  if (!certificate) throw new Error("Unknown Firebase signing key.");

  const publicKey = await crypto.subtle.importKey(
    "spki",
    certificateToSpki(certificate),
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["verify"],
  );

  const valid = await crypto.subtle.verify(
    "RSASSA-PKCS1-v1_5",
    publicKey,
    signature,
    new TextEncoder().encode(signed),
  );
  if (!valid) throw new Error("Invalid Firebase token signature.");

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp <= now || payload.iat > now + 60) throw new Error("Firebase token is expired or not yet valid.");
  if (payload.aud !== projectId) throw new Error("Firebase token project mismatch.");
  if (payload.iss !== `${FIREBASE_ISSUER}/${projectId}`) throw new Error("Firebase token issuer mismatch.");
  if (!payload.sub || typeof payload.sub !== "string") throw new Error("Firebase token has no user ID.");

  return payload;
}

function certificateToSpki(certificate) {
  const match = certificate.match(/-----BEGIN CERTIFICATE-----([\s\S]+?)-----END CERTIFICATE-----/);
  if (!match) throw new Error("Invalid Google certificate.");

  const der = Buffer.from(match[1].replace(/\s+/g, ""), "base64");
  return der.buffer.slice(der.byteOffset, der.byteOffset + der.byteLength);
}

function getBearerToken(req) {
  const value = req.headers.authorization || "";
  if (!value.startsWith("Bearer ")) return null;
  return value.slice(7).trim() || null;
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
  } catch (error) {
    return res.status(401).json({ error: "Invalid Firebase authentication." });
  }
}

module.exports = { firebaseAuth, verifyFirebaseIdToken, getBearerToken };
