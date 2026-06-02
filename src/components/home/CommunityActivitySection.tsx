import { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";
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
  darkAccent: string;
  lightAccent: string;
};

const ACTIVITY_META: Record<CommunityActivityType, ActivityMeta> = {
  partner_joined: {
    label: "Partenaire",
    icon: Users2,
    darkAccent: "from-cyan-400/25 to-cyan-300/10 border-cyan-300/20 text-cyan-100",
    lightAccent: "from-cyan-50 to-white border-cyan-200 text-cyan-800 shadow-cyan-900/5",
  },
  ambassador_joined: {
    label: "Ambassadeur",
    icon: Sparkles,
    darkAccent: "from-fuchsia-400/25 to-fuchsia-300/10 border-fuchsia-300/20 text-fuchsia-100",
    lightAccent: "from-fuchsia-50 to-white border-fuchsia-200 text-fuchsia-800 shadow-fuchsia-900/5",
  },
  salon_joined: {
    label: "Salon",
    icon: Building2,
    darkAccent: "from-emerald-400/25 to-emerald-300/10 border-emerald-300/20 text-emerald-100",
    lightAccent: "from-emerald-50 to-white border-emerald-200 text-emerald-800 shadow-emerald-900/5",
  },
  service_published: {
    label: "Service",
    icon: BadgeCheck,
    darkAccent: "from-amber-400/25 to-amber-300/10 border-amber-300/20 text-amber-100",
    lightAccent: "from-amber-50 to-white border-amber-200 text-amber-800 shadow-amber-900/5",
  },
  reservation_created: {
    label: "Réservation",
    icon: CalendarCheck2,
    darkAccent: "from-sky-400/25 to-sky-300/10 border-sky-300/20 text-sky-100",
    lightAccent: "from-sky-50 to-white border-sky-200 text-sky-800 shadow-sky-900/5",
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

function ActivityCard({ activity, isDarkMode }: { activity: CommunityActivity; isDarkMode: boolean }) {
  const meta = ACTIVITY_META[activity.type];
  const Icon = meta.icon;

  return (
    <div
      className={cn(
        "group flex min-w-[280px] max-w-[340px] items-start gap-3 rounded-2xl border bg-gradient-to-br p-4 shadow-lg backdrop-blur-xl transition hover:-translate-y-0.5",
        isDarkMode ? meta.darkAccent : meta.lightAccent
      )}
    >
      <div
        className={cn(
          "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border",
          isDarkMode
            ? "border-white/10 bg-black/15 text-white/90 shadow-[0_0_20px_rgba(255,255,255,0.08)]"
            : "border-slate-900/10 bg-white text-slate-800 shadow-sm"
        )}
      >
        <Icon className="h-5 w-5" />
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant="outline"
            className={cn(
              "text-[10px] uppercase tracking-[0.18em]",
              isDarkMode ? "border-white/10 bg-white/6 text-white/70" : "border-slate-900/10 bg-white text-slate-600"
            )}
          >
            {meta.label}
          </Badge>
          {activity.city && (
            <span
              className={cn(
                "rounded-full border px-2.5 py-0.5 text-[10px] font-medium",
                isDarkMode ? "border-white/10 bg-black/20 text-white/60" : "border-slate-900/10 bg-slate-950/5 text-slate-600"
              )}
            >
              {activity.city}
            </span>
          )}
        </div>

        <p className={cn("mt-2 line-clamp-3 text-sm leading-6", isDarkMode ? "text-white/88" : "text-slate-800")}>
          {activity.message}
        </p>

        <p className={cn("mt-2 text-xs font-medium", isDarkMode ? "text-white/48" : "text-slate-500")}>
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
  darkTone,
  lightTone,
  isDarkMode,
}: {
  icon: typeof Users2;
  label: string;
  value: number;
  darkTone: string;
  lightTone: string;
  isDarkMode: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-2xl border p-4 shadow-lg backdrop-blur-xl",
        isDarkMode ? "border-white/10 bg-white/5 shadow-black/10" : "border-slate-900/10 bg-white shadow-slate-900/5"
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-2xl border", isDarkMode ? darkTone : lightTone)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-right">
          <div className={cn("text-2xl font-black tracking-tight", isDarkMode ? "text-white" : "text-slate-950")}>
            <AnimatedCount value={value} />
          </div>
          <div className={cn("text-[11px] uppercase tracking-[0.16em]", isDarkMode ? "text-white/45" : "text-slate-500")}>
            {label}
          </div>
        </div>
      </div>
    </div>
  );
}

export function CommunityActivitySection() {
  const { data, isLoading } = useCommunityActivityFeed(30);
  const { theme } = useTheme();
  const [isPaused, setIsPaused] = useState(false);
  const isDarkMode = theme !== "light";

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
        className={cn(
          "relative overflow-hidden rounded-[2rem] border px-5 py-6 shadow-2xl transition-colors duration-500 sm:px-6 lg:px-8 lg:py-8",
          isDarkMode
            ? "border-white/10 bg-[linear-gradient(180deg,rgba(7,11,24,0.96),rgba(9,12,24,0.98))] shadow-black/25"
            : "border-slate-900/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(248,250,252,0.98))] shadow-slate-900/10"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 pointer-events-none opacity-60 bg-[length:42px_42px]",
            isDarkMode
              ? "bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)]"
              : "bg-[linear-gradient(rgba(15,23,42,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(15,23,42,0.05)_1px,transparent_1px)]"
          )}
        />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-400/50 to-transparent" />

        <div className="relative">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <div
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em]",
                  isDarkMode ? "border-white/10 bg-white/5 text-cyan-100/80" : "border-cyan-200 bg-cyan-50 text-cyan-800"
                )}
              >
                <MessageCircleMore className={cn("h-4 w-4", isDarkMode ? "text-cyan-300" : "text-cyan-700")} />
                Ce qui se passe actuellement sur la plateforme
              </div>
              <h2 className={cn("mt-4 text-3xl font-black tracking-tight sm:text-4xl", isDarkMode ? "text-white" : "text-slate-950")}>
                🔥 Activité de la communauté
              </h2>
              <p className={cn("mt-3 max-w-2xl text-sm leading-7 sm:text-base", isDarkMode ? "text-white/60" : "text-slate-600")}>
                Un bandeau public en temps réel pour montrer que la plateforme vit, que des salons avancent, que des partenaires rejoignent le réseau et que les réservations circulent.
              </p>
            </div>

            <div
              className={cn(
                "flex items-center gap-2 self-start rounded-full border px-4 py-2 text-xs font-semibold",
                isDarkMode
                  ? "border-emerald-400/20 bg-emerald-400/10 text-emerald-100 shadow-[0_0_24px_rgba(16,185,129,0.12)]"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-sm"
              )}
            >
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.85)]" />
              Realtime Supabase
              {isLoading && <span className={cn(isDarkMode ? "text-emerald-100/60" : "text-emerald-700/70")}>Chargement...</span>}
            </div>
          </div>

          <div className={cn("relative mt-6 overflow-hidden rounded-3xl border", isDarkMode ? "border-white/10 bg-black/20" : "border-slate-900/10 bg-slate-950/5")}>
            <div className={cn("pointer-events-none absolute inset-y-0 left-0 z-10 w-20 bg-gradient-to-r to-transparent", isDarkMode ? "from-[#070b18]" : "from-white")} />
            <div className={cn("pointer-events-none absolute inset-y-0 right-0 z-10 w-20 bg-gradient-to-l to-transparent", isDarkMode ? "from-[#070b18]" : "from-white")} />

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
                  <ActivityCard key={`${activity.id}-${index}`} activity={activity} isDarkMode={isDarkMode} />
                ))}
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <StatCard icon={Building2} label="Salons inscrits" value={stats.salonCount} darkTone="border-emerald-400/20 bg-emerald-400/10 text-emerald-100" lightTone="border-emerald-200 bg-emerald-50 text-emerald-700" isDarkMode={isDarkMode} />
            <StatCard icon={Users2} label="Partenaires approuvés" value={stats.partnerCount} darkTone="border-cyan-400/20 bg-cyan-400/10 text-cyan-100" lightTone="border-cyan-200 bg-cyan-50 text-cyan-700" isDarkMode={isDarkMode} />
            <StatCard icon={Sparkles} label="Ambassadeurs approuvés" value={stats.ambassadorCount} darkTone="border-fuchsia-400/20 bg-fuchsia-400/10 text-fuchsia-100" lightTone="border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700" isDarkMode={isDarkMode} />
            <StatCard icon={BadgeCheck} label="Utilisateurs inscrits" value={stats.userCount} darkTone="border-violet-400/20 bg-violet-400/10 text-violet-100" lightTone="border-violet-200 bg-violet-50 text-violet-700" isDarkMode={isDarkMode} />
            <StatCard icon={CalendarCheck2} label="Réservations" value={stats.reservationCount} darkTone="border-sky-400/20 bg-sky-400/10 text-sky-100" lightTone="border-sky-200 bg-sky-50 text-sky-700" isDarkMode={isDarkMode} />
            <StatCard icon={Scissors} label="Services publiés" value={stats.serviceCount} darkTone="border-amber-400/20 bg-amber-400/10 text-amber-100" lightTone="border-amber-200 bg-amber-50 text-amber-700" isDarkMode={isDarkMode} />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className={cn("rounded-3xl border p-5 shadow-lg backdrop-blur-xl", isDarkMode ? "border-white/10 bg-white/5 shadow-black/10" : "border-slate-900/10 bg-white shadow-slate-900/5")}>
              <p className={cn("text-sm font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-cyan-100/70" : "text-cyan-800")}>
                Notre communauté grandit chaque jour
              </p>
              <div className={cn("mt-4 space-y-3 text-sm leading-7", isDarkMode ? "text-white/72" : "text-slate-700")}>
                <p>Plus de <span className={cn("font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>{stats.salonCount.toLocaleString("fr-FR")}</span> salons utilisent déjà la plateforme.</p>
                <p><span className={cn("font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>{stats.partnerCount.toLocaleString("fr-FR")}</span> partenaires nous font confiance.</p>
                <p><span className={cn("font-semibold", isDarkMode ? "text-white" : "text-slate-950")}>{stats.ambassadorCount.toLocaleString("fr-FR")}</span> ambassadeurs représentent notre communauté.</p>
                <p>Des centaines de clients utilisent déjà nos services.</p>
              </div>
            </div>

            <div
              className={cn(
                "rounded-3xl border p-5 shadow-lg backdrop-blur-xl",
                isDarkMode
                  ? "border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,255,255,0.03))] shadow-black/10"
                  : "border-slate-900/10 bg-[linear-gradient(180deg,rgba(248,250,252,1),rgba(255,255,255,1))] shadow-slate-900/5"
              )}
            >
              <p className={cn("text-sm font-semibold uppercase tracking-[0.18em]", isDarkMode ? "text-white/60" : "text-slate-600")}>
                Preuve sociale
              </p>
              <ul className={cn("mt-4 space-y-3 text-sm", isDarkMode ? "text-white/70" : "text-slate-700")}>
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
