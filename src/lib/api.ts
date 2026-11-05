/**
 * Thin API client.
 *
 * Every call is same-origin (`/api/...`), served by Vite's proxy in development
 * and by the Hono app in production, so session cookies are first-party.
 */

export class ApiError extends Error {
  status: number;
  /** The parsed JSON error body, so callers can branch on `code`. */
  data: Record<string, unknown>;
  constructor(message: string, status: number, data: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.data = data;
    this.name = "ApiError";
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`/api${path}`, {
    credentials: "include",
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...init.headers,
    },
    ...init,
  });

  const type = res.headers.get("content-type") ?? "";
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    let data: Record<string, unknown> = {};
    if (type.includes("application/json")) {
      const body = (await res.json().catch(() => null)) as Record<string, unknown> | null;
      if (body) {
        data = body;
        if (typeof body.error === "string") message = body.error;
      }
    }
    throw new ApiError(message, res.status, data);
  }

  if (type.includes("application/json")) return (await res.json()) as T;
  return (await res.text()) as unknown as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "POST", body: body === undefined ? undefined : JSON.stringify(body) }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, { method: "PATCH", body: body === undefined ? undefined : JSON.stringify(body) }),
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
  /** Raw multipart/stream upload with progress-free simplicity. */
  upload: <T>(path: string, file: File, headers: Record<string, string> = {}) =>
    request<T>(path, {
      method: "POST",
      body: file,
      headers: { "Content-Type": file.type || "application/octet-stream", ...headers },
    }),
  form: <T>(path: string, data: FormData) => request<T>(path, { method: "POST", body: data }),
};

/* ------------------------------------------------------------------- session */

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "customer" | "admin" | "owner";
  status: "active" | "suspended";
  emailVerified: boolean;
  twoFactorEnabled: boolean;
  country?: string | null;
  createdAt: string;
}

export interface AuthState {
  user: SessionUser | null;
  admin: SessionUser | null;
  loading: boolean;
  error: string | null;
}

let authState: AuthState = { user: null, admin: null, loading: true, error: null };
const authListeners = new Set<() => void>();

function setAuth(patch: Partial<AuthState>) {
  authState = { ...authState, ...patch };
  for (const fn of authListeners) fn();
}

export function subscribeAuth(fn: () => void) {
  authListeners.add(fn);
  return () => {
    authListeners.delete(fn);
  };
}

export const getAuth = () => authState;

let authInFlight: Promise<void> | null = null;

export async function refreshAuth(force = false): Promise<void> {
  if (authInFlight && !force) return authInFlight;
  authInFlight = (async () => {
    try {
      const [me, admin] = await Promise.all([
        api.get<{ user: SessionUser | null }>("/auth/me").catch(() => ({ user: null })),
        api.get<{ user: SessionUser | null }>("/admin/auth/me").catch(() => ({ user: null })),
      ]);
      setAuth({ user: me.user, admin: admin.user, loading: false, error: null });
    } catch (err) {
      setAuth({ loading: false, error: err instanceof Error ? err.message : "Session check failed" });
    } finally {
      authInFlight = null;
    }
  })();
  return authInFlight;
}

/* --------------------------------------------------------------- auth calls */

export const authApi = {
  login: async (email: string, password: string, totp?: string) => {
    const res = await api.post<{ user: SessionUser }>("/auth/login", { email, password, totp });
    setAuth({ user: res.user });
    return res.user;
  },
  register: async (input: { name: string; email: string; password: string; country?: string }) => {
    const res = await api.post<{ user: SessionUser }>("/auth/register", input);
    setAuth({ user: res.user });
    return res.user;
  },
  logout: async () => {
    await api.post("/auth/logout");
    setAuth({ user: null });
  },
  forgot: (email: string) => api.post<{ message: string }>("/auth/forgot-password", { email }),
  reset: (token: string, password: string) => api.post("/auth/reset-password", { token, password }),
  changePassword: (currentPassword: string, password: string) =>
    api.post("/auth/change-password", { currentPassword, password }),
  verify: (token: string) => api.post("/auth/verify-email", { token }),

  adminLogin: async (email: string, password: string, totp?: string) => {
    const res = await api.post<{ user: SessionUser }>("/admin/auth/login", { email, password, totp });
    setAuth({ admin: res.user });
    return res.user;
  },
  adminLogout: async () => {
    await api.post("/admin/auth/logout");
    setAuth({ admin: null });
  },
  setupTwoFactor: () => api.post<{ secret: string; uri: string }>("/admin/auth/2fa/setup"),
  enableTwoFactor: (code: string) =>
    api.post<{ recoveryCodes: string[] }>("/admin/auth/2fa/enable", { code }),
};

/* ------------------------------------------------------------------- format */

export const money = (cents: number, currency = "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(cents / 100);
