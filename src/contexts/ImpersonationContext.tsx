// ImpersonationContext.tsx
// Allows super admin to view the app as any client business without logging out.

import { createContext, useContext, useState, type ReactNode } from 'react';

export interface ImpersonationTarget {
  business_id: string;
  business_name: string;
  business_type: string;
  user_id: string;
  user_name: string;
  user_email: string;
  role: string;
}

interface ImpersonationState {
  isImpersonating: boolean;
  target: ImpersonationTarget | null;
  startImpersonation: (target: ImpersonationTarget) => void;
  stopImpersonation: () => void;
}

const ImpersonationContext = createContext<ImpersonationState>({
  isImpersonating: false,
  target: null,
  startImpersonation: () => {},
  stopImpersonation: () => {},
});

const STORAGE_KEY = 'wesd_impersonation';

export function ImpersonationProvider({ children }: { children: ReactNode }) {
  const [target, setTarget] = useState<ImpersonationTarget | null>(() => {
    try {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null;
    }
  });

  const startImpersonation = (t: ImpersonationTarget) => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(t));
    setTarget(t);
  };

  const stopImpersonation = () => {
    sessionStorage.removeItem(STORAGE_KEY);
    setTarget(null);
    window.location.href = '/admin';
  };

  return (
    <ImpersonationContext.Provider
      value={{
        isImpersonating: !!target,
        target,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </ImpersonationContext.Provider>
  );
}

export function useImpersonation(): ImpersonationState {
  return useContext(ImpersonationContext);
}
