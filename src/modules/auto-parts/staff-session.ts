export interface AutoPartsStaffSession {
  id: string;
  name: string;
  role: string;
  business_id: string;
  session_token?: string;
  expires_at?: string;
}

const STAFF_SESSION_KEY = "auto_parts_staff_session";

export function loadStaffSession(): AutoPartsStaffSession | null {
  try {
    const raw = localStorage.getItem(STAFF_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AutoPartsStaffSession;
  } catch { return null; }
}

export function saveStaffSession(session: AutoPartsStaffSession | null) {
  if (session) {
    localStorage.setItem(STAFF_SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(STAFF_SESSION_KEY);
  }
}
