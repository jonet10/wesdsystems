import { useOnlineStatus, getPendingCount } from '@/lib/offline';
import { useEffect, useState } from 'react';

export function OfflineBanner() {
  const { isOnline, status } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(getPendingCount());

  useEffect(() => {
    const interval = setInterval(() => {
      setPendingCount(getPendingCount());
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  if (isOnline && pendingCount === 0) return null;

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 99999,
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        fontSize: 13,
        fontWeight: 600,
        ...(isOnline
          ? { background: '#FEF3C7', color: '#92400E' }
          : { background: '#FEE2E2', color: '#991B1B' }),
      }}
    >
      {isOnline ? (
        <>
          <span>&#9888;</span>
          <span>En ligne — {pendingCount} modification{pendingCount > 1 ? 's' : ''} en attente de synchronisation</span>
        </>
      ) : status === 'checking' ? (
        <span>&#8987; Vérification de la connexion...</span>
      ) : (
        <>
          <span>&#9888;</span>
          <span>Hors ligne — les modifications seront synchronisées automatiquement</span>
        </>
      )}
    </div>
  );
}
