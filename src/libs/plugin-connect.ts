import { createHmac, timingSafeEqual } from "crypto";

/** Cookie names — httpOnly cookies holding WordPress round-trip params */
export const PLUGIN_CONNECT_REDIRECT_COOKIE = "plugin_connect_redirect";
export const PLUGIN_CONNECT_STATE_COOKIE = "plugin_connect_state";

/** Signed payload WordPress verifies with the same secret (HMAC-SHA256). */
export type PluginConnectTokenPayload = {
  sub: string;
  email: string;
  iat: number;
  exp: number;
};

/**
 * Optional comma-separated origins (e.g. `https://blog.example.com`).
 * When non-empty, only matching origins may receive `connect_token` redirects.
 * When empty/unset, any normal http(s) URL with a hostname is allowed — typical
 * for a WordPress plugin used on arbitrary customer domains (see phishing note in README/product docs).
 */
export function getAllowedRedirectOrigins(): string[] {
  const raw = process.env.PLUGIN_ALLOWED_REDIRECT_ORIGINS || "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function isStrictPluginRedirectAllowlistEnabled(): boolean {
  return getAllowedRedirectOrigins().length > 0;
}

function tryParsePluginRedirectUri(redirectUri: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(redirectUri);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) return null;
  if (!parsed.hostname || parsed.hostname.length === 0) return null;
  return parsed;
}

export function isRedirectUriAllowed(redirectUri: string): boolean {
  const parsed = tryParsePluginRedirectUri(redirectUri);
  if (!parsed) return false;

  const proto = parsed.protocol.toLowerCase();
  const host = parsed.hostname.toLowerCase();
  const isLocalHost =
    host === "localhost" || host === "127.0.0.1" || host === "[::1]";

  if (isStrictPluginRedirectAllowlistEnabled()) {
    const origins = getAllowedRedirectOrigins();
    if (proto !== "https:" && !(isLocalHost && proto === "http:")) return false;
    return origins.includes(parsed.origin);
  }

  /** Open mode: any customer WordPress URL (http allowed for legacy installs; https preferred). */
  return proto === "http:" || proto === "https:";
}

export function getPluginConnectSecret(): string | null {
  return (
    process.env.PLUGIN_CONNECT_SECRET || process.env.NEXTAUTH_SECRET || null
  );
}

export function signPluginConnectToken(
  sub: string,
  email: string,
  secret: string,
  ttlSeconds = 300
): string {
  const now = Math.floor(Date.now() / 1000);
  const payload: PluginConnectTokenPayload = {
    sub,
    email,
    iat: now,
    exp: now + ttlSeconds,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${sig}`;
}

/** For tests and for server-side verification if you add an exchange route. */
export function verifyPluginConnectToken(
  token: string,
  secret: string
): PluginConnectTokenPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!body || !sig) return null;
  const expected = createHmac("sha256", secret).update(body).digest();
  let sigBuf: Buffer;
  try {
    sigBuf = Buffer.from(sig, "base64url");
  } catch {
    return null;
  }
  if (
    sigBuf.length !== expected.length ||
    !timingSafeEqual(new Uint8Array(sigBuf), new Uint8Array(expected))
  ) {
    return null;
  }
  let parsed: PluginConnectTokenPayload;
  try {
    parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  if (
    typeof parsed.sub !== "string" ||
    typeof parsed.email !== "string" ||
    typeof parsed.exp !== "number"
  ) {
    return null;
  }
  if (Math.floor(Date.now() / 1000) > parsed.exp) return null;
  return parsed;
}
