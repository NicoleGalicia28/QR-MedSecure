import crypto from "crypto";

function getKey() {
  const keyEnv = process.env.QR_ENCRYPTION_KEY;
  if (!keyEnv) throw new Error("QR_ENCRYPTION_KEY missing");
  // Try base64 first, else hex, else utf8
  if (keyEnv.match(/^[A-Za-z0-9+/=]+$/) && keyEnv.length >= 44) {
    try {
      const buf = Buffer.from(keyEnv, "base64");
      if (buf.length === 32) return buf;
    } catch {}
  }
  if (/^[0-9a-fA-F]{64}$/.test(keyEnv)) return Buffer.from(keyEnv, "hex");
  const b = Buffer.from(keyEnv, "utf8");
  if (b.length === 32) return b;
  return crypto.createHash("sha256").update(keyEnv).digest();
}

export function encryptJSON(obj) {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const plaintext = Buffer.from(JSON.stringify(obj), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    ct: encrypted.toString("base64"),
    tag: tag.toString("base64"),
  };
}

export function decryptJSON(payload) {
  if (!payload || payload.alg !== "aes-256-gcm" || payload.v !== 1) {
    throw new Error("Invalid QR payload");
  }
  const key = getKey();
  const iv = Buffer.from(payload.iv, "base64");
  const ct = Buffer.from(payload.ct, "base64");
  const tag = Buffer.from(payload.tag, "base64");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
  return JSON.parse(pt.toString("utf8"));
}
