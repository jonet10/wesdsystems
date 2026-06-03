import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export type CommunityActivityType =
  | "partner_joined"
  | "business_joined"
  | "pharmacy_joined"
  | "restaurant_joined"
  | "market_joined"
  | "boutique_joined"
  | "service_published"
  | "reservation_created"
  | "bar_product_added"
  | "bar_cocktail_created"
  | "bar_sale_created";

export interface CommunityActivity {
  id: string;
  type: CommunityActivityType;
  message: string;
  city: string | null;
  created_at: string;
  is_public: boolean;
}

export interface CommunityStats {
  businessCount: number;
  partnerCount: number;
  userCount: number;
  reservationCount: number;
  serviceCount: number;
  publicEventCount: number;
}

export const DEFAULT_COMMUNITY_STATS: CommunityStats = {
  businessCount: 0,
  partnerCount: 0,
  userCount: 0,
  reservationCount: 0,
  serviceCount: 0,
  publicEventCount: 0,
};

interface CommunityFeedResponse {
  stats: CommunityStats;
  feed: CommunityActivity[];
}

const mapStats = (row: any): CommunityStats => ({
  businessCount: Number(row?.business_count ?? 0),
  partnerCount: Number(row?.partner_count ?? 0),
  userCount: Number(row?.user_count ?? 0),
  reservationCount: Number(row?.reservation_count ?? 0),
  serviceCount: Number(row?.service_count ?? 0),
  publicEventCount: Number(row?.public_event_count ?? 0),
});

const normalizeActivityType = (type: string): CommunityActivityType => {
  if (type === "ambassador_joined") return "partner_joined";
  if (type === "salon_joined") return "business_joined";
  if (type === "business_joined") return "business_joined";
  if (type === "pharmacy_joined") return "pharmacy_joined";
  if (type === "restaurant_joined") return "restaurant_joined";
  if (type === "market_joined") return "market_joined";
  if (type === "boutique_joined") return "boutique_joined";
  if (type === "bar_product_added") return "bar_product_added";
  if (type === "bar_cocktail_created") return "bar_cocktail_created";
  if (type === "bar_sale_created") return "bar_sale_created";
  if (type === "service_published") return "service_published";
  return "reservation_created";
};

const isBusinessJoinActivity = (type: CommunityActivityType) =>
  type === "business_joined" ||
  type === "pharmacy_joined" ||
  type === "restaurant_joined" ||
  type === "market_joined" ||
  type === "boutique_joined";

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
    feed: (feedResult.data || []).map((row: any) => ({
      id: String(row.id),
      type: normalizeActivityType(String(row.type || "")),
      message: String(row.message || ""),
      city: row.city == null ? null : String(row.city),
      created_at: String(row.created_at || new Date().toISOString()),
      is_public: Boolean(row.is_public),
    })) as CommunityActivity[],
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
          const raw = payload.new as Record<string, unknown>;
          const next: CommunityActivity = {
            id: String(raw.id),
            type: normalizeActivityType(String(raw.type || "")),
            message: String(raw.message || ""),
            city: raw.city == null ? null : String(raw.city),
            created_at: String(raw.created_at || new Date().toISOString()),
            is_public: Boolean(raw.is_public),
          };

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
                    businessCount: isBusinessJoinActivity(next.type) ? base.stats.businessCount + 1 : base.stats.businessCount,
                    partnerCount: next.type === "partner_joined" ? base.stats.partnerCount + 1 : base.stats.partnerCount,
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
    feed: [],
  };

  return {
    ...query,
    data,
  };
}
