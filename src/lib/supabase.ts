import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const headers = new Headers(options?.headers);
  
  try {
    const empSession = localStorage.getItem('glowup_employee_session');
    if (empSession) {
      const parsed = JSON.parse(empSession);
      if (parsed?.session_token) {
        headers.set('x-employee-session', parsed.session_token);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }

  try {
    const autoPartsSession = localStorage.getItem('auto_parts_staff_session');
    const salonSession = localStorage.getItem('glowup_employee_session');
    
    // Prioritize auto_parts session if both exist (or adapt logic as needed)
    const activeSessionStr = salonSession || autoPartsSession;
    
    if (activeSessionStr) {
      const parsed = JSON.parse(activeSessionStr);
      if (parsed?.session_token) {
        headers.set('x-staff-session', parsed.session_token);
      } else if (parsed?.token) {
        // Handle salon session format if it differs
        headers.set('x-staff-session', parsed.token);
      }
    }
  } catch (e) {
    // Ignore parse errors
  }

  return fetch(url, { ...options, headers });
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  global: {
    fetch: customFetch
  }
});
