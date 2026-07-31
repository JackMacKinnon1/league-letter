"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Database, X } from "lucide-react";
import { getRouteVolume } from "@/lib/playerScoreStats";

export type PlayerScoreRow = {
  id: string;
  upload_id?: string;
  player_key?: string;
  player_name: string;
  team: string | null;
  position: string;
  rank: number;
  rank_label: string | null;
  score: number;
  latest_season: string | null;
  seasons_played: string[];
  advanced_stats: {
    finalRanking?: {
      player_name: string;
      score: number;
      rank: number;
      rank_label: string | null;
    };
    latestCoreStats?: Record<string, any>;
    seasonStats?: Array<{
      season: string | null;
      team: string | null;
      stats: Record<string, any>;
      core: Record<string, any>;
    }>;
    rawRows?: Record<string, any>[];
  };
};

const SEASON_TABLE_STATS = [
  "Season",
  "Team",
  "G",
  "YDS",
  "Routes",
  "TGT",
  "REC",
  "TD",
  "RecYDS/G",
  "YPRR",
  "Receiving_Grade",
  "1READ %",
  "TGT %",
  "TPRR",
  "FP/G",
];

const FEATURED_STATS = [
  "YDS",
  "Routes",
  "TGT",
  "REC",
  "TD",
  "RecYDS/G",
  "YPRR",
  "Receiving_Grade",
  "1READ %",
  "TGT %",
  "TPRR",
  "Birth Date",
];

export default function PlayerAdvancedStatsModal({
  player,
  onClose,
}: {
  player: PlayerScoreRow | null;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {player && <PlayerStatsModal player={player} onClose={onClose} />}
    </AnimatePresence>
  );
}

function PlayerStatsModal({
  player,
  onClose,
}: {
  player: PlayerScoreRow;
  onClose: () => void;
}) {
  const latestCoreStats = player.advanced_stats?.latestCoreStats || {};
  const seasonStats = player.advanced_stats?.seasonStats || [];
  const latestFullStats = seasonStats[0]?.stats || {};

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/75 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, y: 24, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.98 }}
        transition={{ type: "spring", damping: 24, stiffness: 220 }}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-[2rem] border border-zinc-800 bg-zinc-950 shadow-2xl"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-800 bg-white/[0.035] p-5 sm:p-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.3em] text-emerald-300">
              Advanced Stats
            </p>
            <h2 className="mt-2 text-2xl font-black text-white sm:text-3xl">
              {player.player_name}
            </h2>
            <p className="mt-2 text-sm font-bold text-zinc-400">
              #{player.rank} · {player.position} · {player.team || "FA"} · Score{" "}
              {player.score}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-2xl border border-zinc-700 bg-zinc-950 p-3 text-zinc-300 transition hover:border-emerald-300 hover:text-white"
            aria-label="Close advanced stats"
          >
            <X size={20} />
          </button>
        </div>

        <div className="max-h-[calc(90vh-130px)] overflow-y-auto p-5 sm:p-6">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <ModalStat
              label="Latest Season"
              value={player.latest_season || "—"}
            />
            <ModalStat label="Team" value={player.team || "FA"} />
            <ModalStat label="Score" value={player.score} />
            <ModalStat
              label="Seasons"
              value={player.seasons_played?.join(", ") || "—"}
            />
          </div>

          <section className="mt-5 rounded-[1.5rem] border border-zinc-800 bg-zinc-900 p-5">
            <div className="flex items-center gap-2">
              <Database size={18} className="text-emerald-300" />
              <h3 className="text-xl font-black text-white">
                Latest Season Snapshot
              </h3>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {FEATURED_STATS.map((key) => (
                <ModalStat
                  key={key}
                  label={key}
                  value={
                    key === "Routes"
                      ? getRouteVolume(seasonStats[0] || null).routes ?? "—"
                      : latestCoreStats[key] ?? latestFullStats[key] ?? "—"
                  }
                />
              ))}
            </div>
          </section>

          <section className="mt-5 overflow-hidden rounded-[1.5rem] border border-zinc-800 bg-zinc-900">
            <div className="border-b border-zinc-800 p-5">
              <h3 className="text-xl font-black text-white">Season History</h3>
              <p className="mt-1 text-sm font-bold text-zinc-500">
                These rows are pulled directly from the uploaded Raw Data sheet.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-zinc-950 text-xs uppercase tracking-[0.16em] text-zinc-500">
                  <tr>
                    {SEASON_TABLE_STATS.map((key) => (
                      <th key={key} className="px-4 py-3">
                        {key}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {seasonStats.map((season, index) => (
                    <tr
                      key={`${season.season}-${index}`}
                      className="border-t border-zinc-800"
                    >
                      {SEASON_TABLE_STATS.map((key) => {
                        const value =
                          key === "Team"
                            ? season.team
                            : key === "Season"
                              ? season.season
                              : key === "Routes"
                                ? getRouteVolume(season).routes
                                : season.stats?.[key];

                        return (
                          <td key={key} className="px-4 py-3">
                            <StatValue statKey={key} value={value} />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {seasonStats.length === 0 && (
              <div className="p-6 text-sm font-bold text-zinc-500">
                No matching Raw Data rows were found for this player in the
                uploaded workbook.
              </div>
            )}
          </section>
        </div>
      </motion.div>
    </motion.div>
  );
}

function ModalStat({ label, value }: { label: string; value: any }) {
  const tone = getStatTone(label, value);

  return (
    <div className={`rounded-2xl border p-4 transition ${tone.cardClass}`}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-zinc-500">
          {label}
        </p>
        {tone.label && (
          <span
            className={`rounded-full px-2 py-0.5 text-[0.6rem] font-black uppercase tracking-[0.14em] ${tone.badgeClass}`}
          >
            {tone.label}
          </span>
        )}
      </div>
      <p className={`mt-2 text-lg font-black ${tone.valueClass}`}>
        {formatValue(value)}
      </p>
    </div>
  );
}

function StatValue({ statKey, value }: { statKey: string; value: any }) {
  const tone = getStatTone(statKey, value);

  if (!tone.label) {
    return (
      <span className="font-bold text-zinc-300">{formatValue(value)}</span>
    );
  }

  return (
    <span
      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${tone.tableClass}`}
    >
      {formatValue(value)}
    </span>
  );
}

type StatTone = {
  label: string;
  cardClass: string;
  valueClass: string;
  badgeClass: string;
  tableClass: string;
};

const NEUTRAL_TONE: StatTone = {
  label: "",
  cardClass: "border-zinc-800 bg-zinc-950",
  valueClass: "text-white",
  badgeClass: "bg-zinc-800 text-zinc-300",
  tableClass: "border-zinc-800 bg-zinc-950 text-zinc-300",
};

const STAT_THRESHOLDS: Record<string, number[]> = {
  yds: [1200, 900, 700, 500],
  recydsg: [80, 65, 50, 35],
  receivingyardspergame: [80, 65, 50, 35],
  yprr: [2.5, 2, 1.5, 1.2],
  receivinggrade: [85, 75, 65, 60],
  pff: [85, 75, 65, 60],
  pffgrade: [85, 75, 65, 60],
  gradespassroute: [85, 75, 65, 60],
  firstread: [30, 25, 20, 15],
  firstreadpct: [30, 25, 20, 15],
  oneReadPct: [30, 25, 20, 15],
  mtfrec: [0.25, 0.18, 0.12, 0.08],
  targetshare: [25, 22, 18, 14],
  tgtpct: [25, 22, 18, 14],
  tprr: [0.28, 0.24, 0.19, 0.15],
  rec: [100, 80, 60, 40],
  receptions: [100, 80, 60, 40],
  td: [10, 7, 5, 3],
  tds: [10, 7, 5, 3],
  fpg: [18, 15, 12, 9],
};

function getStatTone(label: string, value: any): StatTone {
  const number = toNumber(value);
  if (number === null) return NEUTRAL_TONE;

  const key = normalizeStatKey(label);
  const thresholds = STAT_THRESHOLDS[key];
  if (!thresholds) return NEUTRAL_TONE;

  if (number >= thresholds[0]) {
    return {
      label: "Elite",
      cardClass:
        "border-emerald-400/60 bg-emerald-400/10 shadow-[0_0_24px_rgba(52,211,153,0.10)]",
      valueClass: "text-emerald-300",
      badgeClass: "bg-emerald-400 text-zinc-950",
      tableClass: "border-emerald-400/40 bg-emerald-400/10 text-emerald-300",
    };
  }

  if (number >= thresholds[1]) {
    return {
      label: "Good",
      cardClass: "border-lime-400/50 bg-lime-400/10",
      valueClass: "text-lime-300",
      badgeClass: "bg-lime-400 text-zinc-950",
      tableClass: "border-lime-400/40 bg-lime-400/10 text-lime-300",
    };
  }

  if (number >= thresholds[2]) {
    return {
      label: "Avg",
      cardClass: "border-yellow-400/45 bg-yellow-400/10",
      valueClass: "text-yellow-300",
      badgeClass: "bg-yellow-400 text-zinc-950",
      tableClass: "border-yellow-400/40 bg-yellow-400/10 text-yellow-300",
    };
  }

  if (number >= thresholds[3]) {
    return {
      label: "Low",
      cardClass: "border-orange-400/45 bg-orange-400/10",
      valueClass: "text-orange-300",
      badgeClass: "bg-orange-400 text-zinc-950",
      tableClass: "border-orange-400/40 bg-orange-400/10 text-orange-300",
    };
  }

  return {
    label: "Bad",
    cardClass: "border-red-400/45 bg-red-400/10",
    valueClass: "text-red-300",
    badgeClass: "bg-red-400 text-white",
    tableClass: "border-red-400/40 bg-red-400/10 text-red-300",
  };
}

function normalizeStatKey(label: string) {
  const normalized = String(label)
    .toLowerCase()
    .replace(/1read/g, "firstread")
    .replace(/receiving_grade/g, "receivinggrade")
    .replace(/recyds\/g/g, "recydsg")
    .replace(/fp\/g/g, "fpg")
    .replace(/tgt\s*%/g, "tgtpct")
    .replace(/first\s*read\s*%/g, "firstreadpct")
    .replace(/mtf\/rec/g, "mtfrec")
    .replace(/[^a-z0-9]/g, "");

  if (normalized === "firstread") return "firstreadpct";
  if (normalized === "targetshare") return "targetshare";
  if (normalized === "tgtpct") return "tgtpct";
  if (normalized === "receivinggrade") return "receivinggrade";
  if (normalized === "gradespassroute") return "gradespassroute";
  return normalized;
}

function toNumber(value: any) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;

  const parsed = Number(
    String(value).replace(/,/g, "").replace(/%/g, "").trim(),
  );
  return Number.isFinite(parsed) ? parsed : null;
}

function formatValue(value: any) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number") {
    if (Number.isInteger(value)) return value.toLocaleString();
    return value.toLocaleString(undefined, { maximumFractionDigits: 3 });
  }
  return String(value);
}
