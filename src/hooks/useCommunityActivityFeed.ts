import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type CommunityActivityType =
  | "partner_joined"
  | "ambassador_joined"
  | "salon_joined"
  | "service_published"
  | "reservation_created";

export interface CommunityActivity {
  id: string;
  type: CommunityActivityType;
  message: string;
  city: string | null;
  created_at: string;
  is_public: boolean;
}

export interface CommunityStats {
  salonCount: number;
  partnerCount: number;
  ambassadorCount: number;
  userCount: number;
  reservationCount: number;
  serviceCount: number;
  publicEventCount: number;
}

export const DEFAULT_COMMUNITY_STATS: CommunityStats = {
  salonCount: 0,
  partnerCount: 0,
  ambassadorCount: 0,
  userCount: 0,
  reservationCount: 0,
  serviceCount: 0,
  publicEventCount: 0,
};

export const DEFAULT_COMMUNITY_ACTIVITIES: CommunityActivity[] = [
  {
    id: "fallback-partner",
    type: "partner_joined",
    message: "Jean François depuis Jacmel vient de rejoindre notre réseau de partenaires",
    city: "Jacmel",
    created_at: new Date(Date.now() - 1000 * 60 * 8).toISOString(),
    is_public: true,
  },
  {
    id: "fallback-ambassador",
    type: "ambassador_joined",
    message: "Marie Pierre depuis Les Cayes est devenue Ambassadrice",
    city: "Les Cayes",
    created_at: new Date(Date.now() - 1000 * 60 * 16).toISOString(),
    is_public: true,
  },
  {
    id: "fallback-salon",
    type: "salon_joined",
    message: "Robert Louis depuis Cap-Haïtien a inscrit son salon",
    city: "Cap-Haïtien",
    created_at: new Date(Date.now() - 1000 * 60 * 24).toISOString(),
    is_public: true,
  },
  {
    id: "fallback-service",
    type: "service_published",
    message: "Beauty Style de Delmas vient de publier un nouveau service",
    city: "Delmas",
    created_at: new Date(Date.now() - 1000 * 60 * 33).toISOString(),
    is_public: true,
  },
  {
    id: "fallback-reservation",
    type: "reservation_created",
    message: "Une nouvelle réservation a été enregistrée chez Élégance Beauty de Pétion-Ville",
    city: "Pétion-Ville",
    created_at: new Date(Date.now() - 1000 * 60 * 41).toISOString(),
    is_public: true,
  },
];

interface CommunityFeedResponse {
  stats: CommunityStats;
  feed: CommunityActivity[];
}

const mapStats = (row: any): CommunityStats => ({
  salonCount: Number(row?.salon_count ?? 0),
  partnerCount: Number(row?.partner_count ?? 0),
  ambassadorCount: Number(row?.ambassador_count ?? 0),
  userCount: Number(row?.user_count ?? 0),
  reservationCount: Number(row?.reservation_count ?? 0),
  serviceCount: Number(row?.service_count ?? 0),
  publicEventCount: Number(row?.public_event_count ?? 0),
});

const fetchCommunityFeed = async (limit: number): Promise<CommunityFeedResponse> => {
  const [statsResult, feedResult] = await Promise.all([
    supabase.rpc("get_public_community_stats").single(),
    supabase
      .from("activity_feed")
      .select("id, type, message, city, created_at, is_public")
      .eq("is_public", true)
      .order("created_at", { ascending: false })
      .limit(limit),
  ]);

  if (statsResult.error) throw statsResult.error;
  if (feedResult.error) throw feedResult.error;

  return {
    stats: mapStats(statsResult.data),
    feed: (feedResult.data || []) as CommunityActivity[],
  };
};

export function useCommunityActivityFeed(limit = 30) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["community-activity-feed", limit],
    queryFn: () => fetchCommunityFeed(limit),
    staleTime: 60_000,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
  });

  useEffect(() => {
    const channel = supabase
      .channel("community-activity-feed")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "activity_feed",
          filter: "is_public=eq.true",
        },
        (payload) => {
          const next = payload.new as CommunityActivity;

          queryClient.setQueryData<CommunityFeedResponse>(
            ["community-activity-feed", limit],
            (current) => {
              const base = current ?? { stats: DEFAULT_COMMUNITY_STATS, feed: [] };
              const existing = base.feed.some((item) => item.id === next.id);
              const nextFeed = existing ? base.feed : [next, ...base.feed].slice(0, limit);
              const nextStats = existing
                ? base.stats
                : {
                    ...base.stats,
                    publicEventCount: base.stats.publicEventCount + 1,
                    salonCount: next.type === "salon_joined" ? base.stats.salonCount + 1 : base.stats.salonCount,
                    partnerCount:
                      next.type === "partner_joined" || next.type === "ambassador_joined"
                        ? base.stats.partnerCount + 1
                        : base.stats.partnerCount,
                    ambassadorCount: next.type === "ambassador_joined" ? base.stats.ambassadorCount + 1 : base.stats.ambassadorCount,
                    serviceCount: next.type === "service_published" ? base.stats.serviceCount + 1 : base.stats.serviceCount,
                    reservationCount: next.type === "reservation_created" ? base.stats.reservationCount + 1 : base.stats.reservationCount,
                  };

              return {
                stats: nextStats,
                feed: nextFeed,
              };
            }
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [limit, queryClient]);

  const data = query.data ?? {
    stats: DEFAULT_COMMUNITY_STATS,
    feed: DEFAULT_COMMUNITY_ACTIVITIES.slice(0, limit),
  };

  return {
    ...query,
    data,
  };
}
