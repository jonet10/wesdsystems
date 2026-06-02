import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  CalendarCheck2,
  MessageCircleMore,
  Scissors,
  Sparkles,
  Users2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  DEFAULT_COMMUNITY_ACTIVITIES,
  DEFAULT_COMMUNITY_STATS,
  type CommunityActivity,
  type CommunityActivityType,
  useCommunityActivityFeed,
} from "@/hooks/useCommunityActivityFeed";

type ActivityMeta = {
  label: string;
  icon: typeof Users2;
  accent: string;
};

const ACTIVITY_META: Record<CommunityActivityType, ActivityMeta> = {
  partner_joined: {
    label: "Partenaire",
    icon: Users2,
    accent: "from-cyan-400/25 to-cyan-300/10 border-cyan-300/20 text-cyan-100",
  },
  ambassador_joined: {
    label: "Ambassadeur",
    icon: Sparkles,
    accent: "from-fuchsia-400/25 to-fuchsia-300/10 border-fuchsia-300/20 text-fuchsia-100",
  },
  salon_joined: {
    label: "Salon",
    icon: Building2,
    accent: "from-emerald-400/25 to-emerald-300/10 border-emerald-300/20 text-emerald-100",
  },
  service_published: {
    label: "Service",
    icon: BadgeCheck,
    accent: "from-amber-400/25 to-amber-300/10 border-amber-300/20 text-amber-100",
  },
  reservation_created: {
    label: "Réservation",
    icon: CalendarCheck2,
    accent: "from-sky-400/25 to-sky-300/10 border-sky-300/20 text-sky-100",
  },
};

const formatRelativeTime = (value: string) => {
  const createdAt = new Date(value).getTime();
  if (Number.isNaN(createdAt)) return "À l’instant";

  const diff = Date.now() - createdAt;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diff < minute) return "À l’instant";
  if (diff < hour) return `Il y a ${Math.max(1, Math.floor(diff / minute))} min`;
  if (diff < day) return `Il y a ${Math.max(1, Math.floor(diff / hour))} h`;
  return `Il y a ${Math.max(1, Math.floor(diff / day))} j`;
};

function AnimatedCount({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const previousValueRef = useRef(0);

  useEffect(() => {
    let frame = 0;
    const start = performance.now();
    const from = previousValueRef.current;
    const duration = 900;

    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / duration);
      const next = from + (value - from) * progress;
      setDisplayValue(next);

      if (progress < 1) {
        frame = window.requestAnimationFrame(tick);
      } else {
        previousValueRef.current = value;
      }
    };

    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <span>{Math.round(displayValue).toLocaleString("fr-FR")}</span>;
}

function ActivityCard({ activity }: { activity: CommunityActivity }) {
  const meta = ACTIVITY_META[activity.type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group flex min-w-[280px] max-w-[340px] items-start gap-3 rounded-2xl border bg-white/5 p-4 shadow-lg shadow-black/20 backdrop-blur-xl transition hover:-translate-y-0.5 hover:bg-white/8",
        meta.accent
      )}
    >
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-black/15 text-white/90 shadow-[0_0_20px_rgba(255,255,255,0.08)]">
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="border-white/10 bg-white/6 text-[10px] uppercase tracking-[0.18em] text-white/70">
            {meta.label}
          </Badge>
          {activity.city && (
            <span className="rounded-full border border-white/10 bg-black/20 px-2.5 py-0.5 text-[10px] font-medium text-white/60">
              {activity.city}
            </span>
          )}
        </div>

        <p className="mt-2 line-clamp-3 text-sm leading-6 text-white/88">
          {activity.message}
        </p>

        <p className="mt-2 text-xs font-medium text-white/48">
          {formatRelativeTime(activity.created_at)}
        </p>
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Users2;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-lg shadow-black/10 backdrop-blur-xl">
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", tone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-right">
          <div className="text-2xl font-black tracking-tight text-white">
            <AnimatedCount value={value} />
          </div>
          <div className="text-[11px] uppercase tracking-[0.16em] text-white/45">
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommunityActivitySection() {
  const { data, isLoading } = useCommunityActivityFeed(30);
  const [isPaused, setIsPaused] = useState(false);

  const activities = data.feed.length > 0 ? data.feed : DEFAULT_COMMUNITY_ACTIVITIES;
  const stats = data.stats ?? DEFAULT_COMMUNITY_STATS;
  const marqueeItems = useMemo(() => [...activities, ...activities], [activities]);
  const marqueeDuration = Math.max(26, Math.min(46, activities.length * 4.5));

  return (
    <section id="community" className="mx-auto max-w-7xl px-5 py-16 sm:px-6 lg:px-8">
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.25 }}
        transition={{ duration: 0.65, ease: "easeOut" }}
        className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,rgba(34,211,238,0.16),transparent_36%),radial-gradient(circle_at_top_right,rgba(168,85,247,0.16),transparent_32%),linear-gradient(180deg,rgba(7,11,24,0.96),rgba(9,12,24,0.98))] px-5 py-6 shadow-2xl shadow-black/25 sm:px-6 lg:px-8 lg:py-8"
      >
        <div className="absolute inset-0 pointer-events-none opacity-60 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[length:42px_42px]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/50 to-transparent" />

        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-cyan-100/80">
                <MessageCircleMore className="h-4 w-4 text-cyan-300" />
                Ce qui se passe actuellement sur la plateforme
              </div>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white sm:text-4xl">
                🔥 Activité de la communauté
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-white/60 sm:text-base">
                Un bandeau public en temps réel pour montrer que la plateforme vit, que des salons avancent, que des partenaires rejoignent le réseau et que les réservations circulent.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-xs font-semibold text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.12)]">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
              Realtime Supabase
              {isLoading && <span className="text-emerald-100/60">Chargement...</span>}
            </div>
          </div>

          <div className="relative mt-6 overflow-hidden rounded-3xl border border-white/10 bg-black/20">
            <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r from-[#070b18] to-transparent" />
            <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l from-[#070b18] to-transparent" />

            <div
              className="overflow-hidden py-4"
              onMouseEnter={() => setIsPaused(true)}
              onMouseLeave={() => setIsPaused(false)}
            >
              <div
                className="flex w-max gap-3 px-4 animate-community-marquee"
                style={{
                  animationDuration: `${marqueeDuration}s`,
                  animationPlayState: isPaused ? "paused" : "running",
                }}
              >
                {marqueeItems.map((activity, index) => (
                  <ActivityCard key={`${activity.id}-${index}`} activity={activity} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard icon={Building2} label="Salons inscrits" value={stats.salonCount} tone="border-emerald-400/20 bg-emerald-400/10 text-emerald-100" />
            <StatCard icon={Users2} label="Partenaires approuvés" value={stats.partnerCount} tone="border-cyan-400/20 bg-cyan-400/10 text-cyan-100" />
            <StatCard icon={Sparkles} label="Ambassadeurs approuvés" value={stats.ambassadorCount} tone="border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100" />
            <StatCard icon={BadgeCheck} label="Utilisateurs inscrits" value={stats.userCount} tone="border-violet-400/20 bg-violet-400/10 text-violet-100" />
            <StatCard icon={CalendarCheck2} label="Réservations" value={stats.reservationCount} tone="border-sky-400/20 bg-sky-400/10 text-sky-100" />
            <StatCard icon={Scissors} label="Services publiés" value={stats.serviceCount} tone="border-amber-400/20 bg-amber-400/10 text-amber-100" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-lg shadow-black/10 backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-cyan-100/70">
                Notre communauté grandit chaque jour
              </p>
              <div className="mt-4 space-y-3 text-sm leading-7 text-white/72">
                <p>Plus de <span className="font-semibold text-white">{stats.salonCount.toLocaleString("fr-FR")}</span> salons utilisent déjà la plateforme.</p>
                <p><span className="font-semibold text-white">{stats.partnerCount.toLocaleString("fr-FR")}</span> partenaires nous font confiance.</p>
                <p><span className="font-semibold text-white">{stats.ambassadorCount.toLocaleString("fr-FR")}</span> ambassadeurs représentent notre communauté.</p>
                <p>Des centaines de clients utilisent déjà nos services.</p>
              </div>
            </div>

            <div className="rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] p-5 shadow-lg shadow-black/10 backdrop-blur-xl">
              <p className="text-sm font-semibold uppercase tracking-[0.18em] text-white/60">
                Preuve sociale
              </p>
              <ul className="mt-4 space-y-3 text-sm text-white/70">
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                  Activités publiques visibles en temps réel, sans information privée.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.8)]" />
                  Le flux se met à jour automatiquement dès qu’un nouvel événement est publié.
                </li>
                <li className="flex items-start gap-3">
                  <span className="mt-1 h-2 w-2 rounded-full bg-fuchsia-400 shadow-[0_0_10px_rgba(232,121,249,0.8)]" />
                  Les 30 dernières activités publiques sont affichées, triées par date décroissante.
                </li>
              </ul>
            </div>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
