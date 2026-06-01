import { useEffect, useMemo, useState } from "react";
import { io } from "socket.io-client";
import { apiGet } from "../api/client";

const DEFAULT_DASHBOARD = {
  totalBetsAmount: 0,
  commissionEarned: 0,
  activeBets: 0,
  statsRow: { open: 0, pending: 0, closed: 0 },
  volume7d: [],
  topMatches: [],
  activeBetsList: [],
};

export function useLiveDashboard() {
  const [data, setData] = useState(DEFAULT_DASHBOARD);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    const socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
      transports: ["websocket"],
    });

    const load = async () => {
      try {
        const stats = await apiGet("/api/dashboard/stats");
        if (mounted) setData((prev) => ({ ...prev, ...stats }));
      } catch {
        if (mounted) setData(DEFAULT_DASHBOARD);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    load();
    const interval = setInterval(load, 30000);

    socket.on("new_bet", load);
    socket.on("bet_matched", load);
    socket.on("match_result", load);

    return () => {
      mounted = false;
      socket.disconnect();
      clearInterval(interval);
    };
  }, []);

  const volumeSeries = useMemo(
    () =>
      data.volume7d.map((entry) => ({
        day: entry.day,
        volume: Number(entry.volume || 0),
      })),
    [data.volume7d]
  );

  return { data: { ...data, volume7d: volumeSeries }, loading };
}
