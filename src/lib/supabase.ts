import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

const customFetch = (url: RequestInfo | URL, options?: RequestInit) => {
  const headers = new Headers(options?.headers);
  
  try {
    const empSession = localStorage.getItem('wesd_salon_employee');
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
    const staffSession = localStorage.getItem('wesd_staff_session');
    if (staffSession) {
      const parsed = JSON.parse(staffSession);
      if (parsed?.session_token) {
        headers.set('x-staff-session', parsed.session_token);
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
