const STAFF_SESSION_KEY = "auto_parts_staff_session";

export function getStaffSessionToken(): string | null {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    return session.session_token ?? null;
  } catch {
    return null;
  }
}

export function isStaffSessionActive(): boolean {
  return getStaffSessionToken() !== null;
}

export function isRpcNotFound(err: unknown): boolean {
  const e = err as any;
  return e?.status === 404 || e?.code === 'PGRST202' || e?.message?.includes('function') || e?.message?.includes('relation');
}
