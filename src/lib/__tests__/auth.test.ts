// @vitest-environment node
import { test, expect, vi, beforeEach } from "vitest";
import { SignJWT } from "jose";

// Mock server-only so it doesn't throw in the test environment
vi.mock("server-only", () => ({}));

const JWT_SECRET = new TextEncoder().encode("development-secret-key");

type CookieOptions = { httpOnly?: boolean; secure?: boolean; sameSite?: string; expires?: Date; path?: string };

// Cookie store mock shared across tests
const cookieStore = {
  store: new Map<string, string>(),
  options: new Map<string, CookieOptions>(),
  get(name: string) {
    const value = this.store.get(name);
    return value ? { value } : undefined;
  },
  set(name: string, value: string, opts?: CookieOptions) {
    this.store.set(name, value);
    if (opts) this.options.set(name, opts);
  },
  delete(name: string) {
    this.store.delete(name);
    this.options.delete(name);
  },
};

vi.mock("next/headers", () => ({
  cookies: () => Promise.resolve(cookieStore),
}));

beforeEach(() => {
  cookieStore.store.clear();
  cookieStore.options.clear();
});

// Import after mocks are set up
const { createSession, getSession, deleteSession, verifySession } = await import("@/lib/auth");

async function makeValidToken(payload: object, expiresIn = "7d") {
  return new SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(expiresIn)
    .setIssuedAt()
    .sign(JWT_SECRET);
}

// --- createSession ---

test("createSession sets an auth-token cookie", async () => {
  await createSession("user-1", "user@example.com");
  expect(cookieStore.store.has("auth-token")).toBe(true);
});

test("createSession cookie contains userId and email", async () => {
  await createSession("user-1", "user@example.com");
  const token = cookieStore.store.get("auth-token")!;
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  expect(payload.userId).toBe("user-1");
  expect(payload.email).toBe("user@example.com");
});

test("createSession token expires in ~7 days", async () => {
  const before = Date.now();
  await createSession("user-1", "user@example.com");
  const token = cookieStore.store.get("auth-token")!;
  const { jwtVerify } = await import("jose");
  const { payload } = await jwtVerify(token, JWT_SECRET);
  const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
  expect(payload.exp! * 1000).toBeGreaterThanOrEqual(before + sevenDaysMs - 1000);
  expect(payload.exp! * 1000).toBeLessThanOrEqual(before + sevenDaysMs + 1000);
});

test("createSession sets httpOnly and sameSite=lax cookie options", async () => {
  await createSession("user-1", "user@example.com");
  const opts = cookieStore.options.get("auth-token");
  expect(opts?.httpOnly).toBe(true);
  expect(opts?.sameSite).toBe("lax");
  expect(opts?.path).toBe("/");
});

test("createSession sets secure=false outside production", async () => {
  await createSession("user-1", "user@example.com");
  const opts = cookieStore.options.get("auth-token");
  expect(opts?.secure).toBe(false);
});

// --- getSession ---

test("getSession returns null when no cookie is set", async () => {
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns payload for a valid token", async () => {
  const token = await makeValidToken({ userId: "user-2", email: "a@b.com" });
  cookieStore.store.set("auth-token", token);
  const session = await getSession();
  expect(session?.userId).toBe("user-2");
  expect(session?.email).toBe("a@b.com");
});

test("getSession returns null for an expired token", async () => {
  const token = await makeValidToken({ userId: "user-3", email: "c@d.com" }, "0s");
  cookieStore.store.set("auth-token", token);
  const session = await getSession();
  expect(session).toBeNull();
});

test("getSession returns null for a malformed token", async () => {
  cookieStore.store.set("auth-token", "not.a.valid.jwt");
  const session = await getSession();
  expect(session).toBeNull();
});

// --- deleteSession ---

test("deleteSession removes the auth-token cookie", async () => {
  cookieStore.store.set("auth-token", "some-token");
  await deleteSession();
  expect(cookieStore.store.has("auth-token")).toBe(false);
});

// --- verifySession ---

test("verifySession returns null when request has no auth-token cookie", async () => {
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/");
  const session = await verifySession(req);
  expect(session).toBeNull();
});

test("verifySession returns payload for a valid token in the request", async () => {
  const { NextRequest } = await import("next/server");
  const token = await makeValidToken({ userId: "user-4", email: "e@f.com" });
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: `auth-token=${token}` },
  });
  const session = await verifySession(req);
  expect(session?.userId).toBe("user-4");
  expect(session?.email).toBe("e@f.com");
});

test("verifySession returns null for an invalid token in the request", async () => {
  const { NextRequest } = await import("next/server");
  const req = new NextRequest("http://localhost/", {
    headers: { cookie: "auth-token=garbage" },
  });
  const session = await verifySession(req);
  expect(session).toBeNull();
});
