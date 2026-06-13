import { describe, it, expect } from "vitest";

import { deriveToken, verifyToken, isAllowlisted, evaluateGate, SESSION_COOKIE, COOKIE_MAX_AGE } from "./auth-gate";

describe("deriveToken", () => {
  it("returns the known SHA-256 hex vector for a known input", async () => {
    // Canonical SHA-256("test") test vector.
    expect(await deriveToken("test")).toBe("9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08");
  });

  it("is deterministic for the same input", async () => {
    expect(await deriveToken("hunter2")).toBe(await deriveToken("hunter2"));
  });

  it("differs for different inputs", async () => {
    expect(await deriveToken("a")).not.toBe(await deriveToken("b"));
  });

  it("produces 64-char lowercase hex", async () => {
    expect(await deriveToken("anything")).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe("verifyToken", () => {
  const passphrase = "correct horse battery staple";

  it("returns true for the matching token", async () => {
    const token = await deriveToken(passphrase);
    expect(await verifyToken(token, passphrase)).toBe(true);
  });

  it("returns false for a wrong cookie value of the same length", async () => {
    const token = await deriveToken(passphrase);
    const wrong = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
    expect(await verifyToken(wrong, passphrase)).toBe(false);
  });

  it("fails closed when the cookie is missing", async () => {
    expect(await verifyToken(undefined, passphrase)).toBe(false);
  });

  it("fails closed when the passphrase (env) is missing", async () => {
    const token = await deriveToken(passphrase);
    expect(await verifyToken(token, undefined)).toBe(false);
  });

  it("fails closed when both inputs are empty strings", async () => {
    expect(await verifyToken("", "")).toBe(false);
  });

  it("returns false for a wrong-length cookie value", async () => {
    expect(await verifyToken("abc", passphrase)).toBe(false);
  });
});

describe("isAllowlisted", () => {
  it("allows the unlock POST endpoint", () => {
    expect(isAllowlisted("/api/unlock")).toBe(true);
  });

  it("allows static asset prefixes", () => {
    expect(isAllowlisted("/_astro/index.abc123.css")).toBe(true);
    expect(isAllowlisted("/_image")).toBe(true);
    expect(isAllowlisted("/favicon.png")).toBe(true);
  });

  it("does NOT allowlist the unlock page itself (it needs the session check)", () => {
    expect(isAllowlisted("/unlock")).toBe(false);
  });

  it("does not allow the app root or arbitrary paths", () => {
    expect(isAllowlisted("/")).toBe(false);
    expect(isAllowlisted("/some/page")).toBe(false);
  });

  it("does not allowlist by substring (must be prefix/exact)", () => {
    expect(isAllowlisted("/not/api/unlock")).toBe(false);
    expect(isAllowlisted("/api/unlock/extra")).toBe(false);
  });
});

describe("evaluateGate", () => {
  const passphrase = "correct horse battery staple";

  it("sends an unauthenticated request for a gated path to the unlock page", async () => {
    expect(await evaluateGate("/", undefined, passphrase)).toBe("to-unlock");
  });

  it("allows allowlisted paths through without a cookie or token work", async () => {
    expect(await evaluateGate("/api/unlock", undefined, passphrase)).toBe("allow");
    expect(await evaluateGate("/_astro/x.css", undefined, passphrase)).toBe("allow");
  });

  it("allows a gated path when the cookie carries a valid token", async () => {
    const token = await deriveToken(passphrase);
    expect(await evaluateGate("/", token, passphrase)).toBe("allow");
  });

  it("shows the unlock page to a locked-out visitor", async () => {
    expect(await evaluateGate("/unlock", undefined, passphrase)).toBe("allow");
  });

  it("bounces an already-unlocked visitor away from the unlock page", async () => {
    const token = await deriveToken(passphrase);
    expect(await evaluateGate("/unlock", token, passphrase)).toBe("to-home");
  });

  it("fails closed (to-unlock) when the passphrase env is missing", async () => {
    const token = await deriveToken(passphrase);
    expect(await evaluateGate("/", token, undefined)).toBe("to-unlock");
  });
});

describe("constants", () => {
  it("exposes the session cookie name", () => {
    expect(SESSION_COOKIE).toBe("session");
  });

  it("sets a 30-day cookie lifetime in seconds", () => {
    expect(COOKIE_MAX_AGE).toBe(60 * 60 * 24 * 30);
  });
});
