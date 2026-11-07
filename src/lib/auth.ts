import crypto from "crypto";
import { cookies } from "next/headers";
import { CueClubStore } from "@/lib/store";
import { Profile } from "@/types/database";

const COOKIE_NAME = "cueclub_staff_session";

export class AuthConfigurationError extends Error {
  constructor() {
    super("Authentication is not configured on this server.");
    this.name = "AuthConfigurationError";
  }
}

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.trim().length < 32) throw new AuthConfigurationError();
  return secret;
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: "staff" | "owner";
  name: string;
  issuedAt: number;
  expiresAt: number;
}

/**
 * Hash a password using PBKDF2 with a random salt
 */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Verify a password against a stored salt:hash string
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, originalHash] = storedHash.split(":");
    if (!salt || !originalHash) return false;
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, "sha512").toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(originalHash, "hex"));
  } catch {
    return false;
  }
}

/**
 * Sign a session payload using HMAC-SHA256
 */
export function signSession(payload: SessionPayload): string {
  const secret = getAuthSecret();
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verify and decode an HMAC-signed session token
 */
export function verifySessionToken(token: string): SessionPayload | null {
  const secret = getAuthSecret();
  try {
    const [data, signature] = token.split(".");
    if (!data || !signature) return null;

    const expectedSignature = crypto.createHmac("sha256", secret).update(data).digest("base64url");
    const supplied = Buffer.from(signature);
    const expected = Buffer.from(expectedSignature);
    if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) {
      return null;
    }

    const payload: SessionPayload = JSON.parse(Buffer.from(data, "base64url").toString("utf-8"));
    if (Date.now() > payload.expiresAt) {
      return null; // Expired
    }

    return payload;
  } catch {
    return null;
  }
}

/**
 * Get current staff session from incoming request cookies or next/headers
 */
export function getStaffSessionFromCookie(cookieHeader?: string | null): SessionPayload | null {
  getAuthSecret();
  if (!cookieHeader) return null;
  const match = cookieHeader.match(new RegExp(`(?:^|;\\s*)${COOKIE_NAME}=([^;]*)`));
  if (!match) return null;
  const token = decodeURIComponent(match[1]);
  return verifySessionToken(token);
}

/**
 * Authenticate staff credentials against profiles in store
 */
export function authenticateStaff(emailOrPhone: string, plainPassword: string): Profile | null {
  const profiles = CueClubStore.getProfiles();
  const cleanInput = emailOrPhone.trim().toLowerCase();

  const user = profiles.find((p) => {
    if (p.role !== "staff" && p.role !== "owner") return false;
    const matchEmail = p.email && p.email.toLowerCase() === cleanInput;
    const matchPhone = p.phone.replace(/\D/g, "") === cleanInput.replace(/\D/g, "");
    return matchEmail || matchPhone;
  });

  if (!user) return null;

  // Stored password hash check
  const anyUser = user as any;
  if (!anyUser.password_hash) {
    // If not yet set, check default initial credentials and initialize
    if (plainPassword === "CueClub@Staff2026") {
      anyUser.password_hash = hashPassword("CueClub@Staff2026");
      const data = CueClubStore.getData();
      const p = data.profiles.find((pr) => pr.id === user.id);
      if (p) (p as any).password_hash = anyUser.password_hash;
      CueClubStore.updateSettings({}); // triggers save
      return user;
    }
    return null;
  }

  const isValid = verifyPassword(plainPassword, anyUser.password_hash);
  return isValid ? user : null;
}

export { COOKIE_NAME };
