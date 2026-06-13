"use client";

import Link from "@/components/NoPrefetchLink";
import {
  ArrowRight,
  ChevronDown,
  GitBranch,
  Handshake,
  Search,
  Sparkles,
  Trophy,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import PlayerAdvancedStatsModal, {
  type PlayerScoreRow,
} from "@/components/PlayerAdvancedStatsModal";
import { useEffect, useMemo, useState } from "react";

type Team = {
  id?: string;
  sleeper_roster_id: number;
  team_name: string;
  owner_name?: string | null;
};

type Player = {
  id: string;
  sleeper_player_id?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  position?: string | null;
  team?: string | null;
};

type Trade = {
  id: string;
  league_id: string;
  sleeper_transaction_id: string;
  season: string | number | null;
  week: number | null;
  roster_ids: number[] | null;
  adds: Record<string, number> | null;
  drops: Record<string, number> | null;
  draft_picks: any[] | null;
  created_sleeper_at: number | null;
  status?: string | null;
};

type AssetMove = {
  key: string;
  label: string;
  type: "player" | "pick";
  playerId?: string | null;
  fromRosterId: number | null;
  toRosterId: number | null;
  season: string | number | null;
  week: number | null;
  tradeId: string;
  timestamp: number;
};

type AssetDisplay = {
  key: string;
  label: string;
  type: "player" | "pick";
  playerId?: string | null;
  meta?: string | null;
  position?: string | null;
  searchName?: string | null;
};

export default function TradeCenter({
  leagueId,
  leagueName,
  trades,
  teams,
  players,
}: {
  leagueId: string;
  leagueName?: string | null;
  trades: Trade[];
  teams: Team[];
  players: Record<string, Player>;
}) {
  const [selectedSeason, setSelectedSeason] = useState("all");
  const [selectedTeam, setSelectedTeam] = useState("all");
  const [search, setSearch] = useState("");
  const [openTradeId, setOpenTradeId] = useState<string | null>(
    trades[0]?.id || null,
  );
  const [selectedAdvancedPlayer, setSelectedAdvancedPlayer] =
    useState<PlayerScoreRow | null>(null);
  const [advancedStatsError, setAdvancedStatsError] = useState("");
  const [loadingAdvancedPlayerId, setLoadingAdvancedPlayerId] = useState<
    string | null
  >(null);

  const teamByRosterId = useMemo(() => {
    const map = new Map<number, Team>();
    for (const team of teams || []) {
      map.set(Number(team.sleeper_roster_id), team);
    }
    return map;
  }, [teams]);

  const seasons = useMemo(() => {
    return Array.from(
      new Set(trades.map((trade) => String(trade.season || "Unknown"))),
    )
      .filter(Boolean)
      .sort((a, b) => Number(b) - Number(a));
  }, [trades]);

  const allAssetMoves = useMemo(
    () =>
      trades.flatMap((trade) => getAssetMoves(trade, players, teamByRosterId)),
    [trades, players, teamByRosterId],
  );

  const assetOptions = useMemo(() => {
    const map = new Map<string, AssetMove>();
    for (const move of allAssetMoves) {
      if (!map.has(move.key)) map.set(move.key, move);
    }

    return Array.from(map.values())
      .sort((a, b) => a.label.localeCompare(b.label))
      .slice(0, 250);
  }, [allAssetMoves]);

  const [selectedAssetKey, setSelectedAssetKey] = useState<string>("");

  useEffect(() => {
    if (!assetOptions.length) {
      setSelectedAssetKey("");
      return;
    }

    if (
      !selectedAssetKey ||
      !assetOptions.some((asset) => asset.key === selectedAssetKey)
    ) {
      setSelectedAssetKey(assetOptions[0].key);
    }
  }, [assetOptions, selectedAssetKey]);

  const filteredTrades = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return trades.filter((trade) => {
      const rosterIds = trade.roster_ids || [];
      const tradeAssets = getTradeAssetLabels(trade, players, teamByRosterId)
        .join(" ")
        .toLowerCase();
      const teamNames = rosterIds
        .map((rosterId) => getTeamName(Number(rosterId), teamByRosterId))
        .join(" ")
        .toLowerCase();

      const matchesSeason =
        selectedSeason === "all" ||
        String(trade.season || "Unknown") === selectedSeason;
      const matchesTeam =
        selectedTeam === "all" ||
        rosterIds.map(Number).includes(Number(selectedTeam));
      const matchesSearch =
        !normalizedSearch ||
        tradeAssets.includes(normalizedSearch) ||
        teamNames.includes(normalizedSearch);

      return matchesSeason && matchesTeam && matchesSearch;
    });
  }, [trades, players, selectedSeason, selectedTeam, search, teamByRosterId]);

  const teamTradeCounts = useMemo(() => {
    const counts = new Map<number, number>();

    for (const trade of trades) {
      for (const rosterId of trade.roster_ids || []) {
        counts.set(Number(rosterId), (counts.get(Number(rosterId)) || 0) + 1);
      }
    }

    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [trades]);

  const mostActiveTeam = teamTradeCounts[0];
  const totalAssets = allAssetMoves.length;
  const biggestTrade = [...trades].sort(
    (a, b) =>
      getAssetMoves(b, players, teamByRosterId).length -
      getAssetMoves(a, players, teamByRosterId).length,
  )[0];

  const selectedAssetTimeline = allAssetMoves
    .filter((move) => move.key === selectedAssetKey)
    .sort((a, b) => a.timestamp - b.timestamp);

  const latestTrades = (filteredTrades.length ? filteredTrades : trades).slice(
    0,
    8,
  );

  async function openAdvancedStats(asset: AssetDisplay) {
    if (String(asset.position || "").toUpperCase() !== "WR") return;

    setAdvancedStatsError("");
    setLoadingAdvancedPlayerId(asset.key);

    try {
      const params = new URLSearchParams({
        position: "WR",
        page: "1",
        pageSize: "25",
        search: asset.searchName || asset.label,
      });

      const response = await fetch(`/api/player-scores?${params.toString()}`);
      const json = await response.json();
      if (!response.ok)
        throw new Error(json.error || "Failed to load advanced stats.");

      const rows = (json.rows || []) as PlayerScoreRow[];
      const normalizedTarget = normalizePlayerName(
        asset.searchName || asset.label,
      );
      const exactMatch = rows.find(
        (row) => normalizePlayerName(row.player_name) === normalizedTarget,
      );
      const softMatch = rows.find(
        (row) =>
          normalizePlayerName(row.player_name).includes(normalizedTarget) ||
          normalizedTarget.includes(normalizePlayerName(row.player_name)),
      );
      const match = exactMatch || softMatch || rows[0];

      if (!match)
        throw new Error(
          "No uploaded WR advanced stats were found for this player.",
        );
      setSelectedAdvancedPlayer(match);
    } catch (error: any) {
      setAdvancedStatsError(error?.message || "Failed to load advanced stats.");
    } finally {
      setLoadingAdvancedPlayerId(null);
    }
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-950 text-white">
      <section className="border-b border-white/10 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_30%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.12),_transparent_28%),linear-gradient(135deg,_#07080a,_#0d1118_58%,_#071a17)] px-4 py-6 sm:py-9">
        <div className="mx-auto max-w-7xl min-w-0">
          <Link
            href={`/league/${leagueId}`}
            className="inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-bold text-zinc-300 transition hover:border-emerald-400/40 hover:text-white"
          >
            ← Back to league
          </Link>

          <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_420px] lg:items-end">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.32em] text-emerald-300">
                Trade Intelligence
              </p>
              <h1 className="mt-3 text-4xl font-black tracking-tight sm:text-5xl lg:text-6xl">
                Trade Center
              </h1>
              <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
                A cleaner front office view of every deal, asset path, player
                moved, and draft pick exchanged in {leagueName || "your league"}
                .
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-3 shadow-2xl backdrop-blur sm:gap-3 sm:p-4">
              <HeroStat label="Trades" value={trades.length} />
              <HeroStat label="Assets" value={totalAssets} />
              <HeroStat
                label="Most Active"
                value={
                  mostActiveTeam
                    ? getTeamName(mostActiveTeam[0], teamByRosterId)
                    : "—"
                }
              />
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-white/10 bg-zinc-950/95">
        <div className="mx-auto flex max-w-7xl min-w-0 items-center overflow-hidden px-3 py-2 sm:px-4">
          <div className="mr-3 hidden shrink-0 rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.18em] text-emerald-300 sm:block">
            Trade Wire
          </div>
          {latestTrades.length ? (
            <div className="league-ticker-shell relative min-w-0 flex-1 overflow-hidden rounded-full border border-zinc-800 bg-zinc-900/80">
              <div
                className="league-ticker-track flex min-w-max items-center gap-3 py-2 pl-3"
                style={{ animationDuration: "38s" }}
              >
                {[...latestTrades, ...latestTrades, ...latestTrades].map(
                  (trade, index) => (
                    <span
                      key={`${trade.id}-ticker-${index}`}
                      className="shrink-0 rounded-full border border-zinc-800 bg-zinc-950 px-3 py-1.5 text-[0.62rem] font-black uppercase tracking-[0.14em] text-zinc-300 sm:px-4 sm:text-xs"
                    >
                      <span className="text-emerald-400">Trade Alert</span>{" "}
                      {formatTradeHeadline(trade, teamByRosterId)}
                    </span>
                  ),
                )}
              </div>
            </div>
          ) : (
            <div className="min-w-0 flex-1 rounded-full border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-zinc-300">
              No trades found yet
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-7xl min-w-0 gap-4 overflow-hidden px-3 py-4 sm:gap-5 sm:px-4 sm:py-8 lg:grid-cols-[minmax(0,360px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,400px)_minmax(0,1fr)]">
        <aside className="min-w-0 space-y-4 overflow-hidden sm:space-y-5 lg:sticky lg:top-24 lg:self-start">
          <div className="rounded-[1.35rem] border border-zinc-800 bg-zinc-900/85 p-4 shadow-2xl sm:p-5 overflow-hidden">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
                <GitBranch size={22} />
              </div>
              <div>
                <h2 className="text-xl font-black sm:text-2xl">Trade Tree</h2>
                <p className="text-sm text-zinc-500">
                  Follow one asset through history
                </p>
              </div>
            </div>

            <select
              value={selectedAssetKey}
              onChange={(event) => setSelectedAssetKey(event.target.value)}
              className="mt-5 w-full min-w-0 truncate rounded-2xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm font-bold outline-none transition focus:border-emerald-500"
            >
              {assetOptions.map((asset) => (
                <option key={asset.key} value={asset.key}>
                  {asset.label}
                </option>
              ))}
            </select>

            <div className="mt-5 space-y-4">
              {selectedAssetTimeline.map((move, index) => (
                <div
                  key={`${move.tradeId}-${move.key}-${index}`}
                  className="relative min-w-0 pl-7 sm:pl-8"
                >
                  {index !== selectedAssetTimeline.length - 1 && (
                    <div className="absolute bottom-[-1rem] left-[0.65rem] top-7 w-px bg-zinc-800" />
                  )}
                  <div className="absolute left-0 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-zinc-950 ring-4 ring-zinc-900">
                    <ArrowRight size={13} />
                  </div>

                  <div className="min-w-0 overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-950 p-3 sm:p-4">
                    <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-emerald-400">
                      {move.season || "Unknown"} · Week {move.week || "?"}
                    </p>
                    <div className="mt-3 flex min-w-0 items-center gap-3">
                      <AssetAvatar asset={assetDisplayFromMove(move)} />
                      <h3 className="min-w-0 flex-1 truncate font-black">
                        {move.label}
                      </h3>
                    </div>
                    <div className="mt-4 flex flex-wrap items-center gap-2 text-sm font-bold">
                      <TeamPill
                        name={getTeamName(move.fromRosterId, teamByRosterId)}
                        muted
                      />
                      <ArrowRight size={16} className="text-zinc-500" />
                      <TeamPill
                        name={getTeamName(move.toRosterId, teamByRosterId)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              {!selectedAssetTimeline.length && (
                <div className="rounded-2xl border border-dashed border-zinc-800 p-5 text-sm text-zinc-400">
                  Pick an asset to see its trade path.
                </div>
              )}
            </div>
          </div>

          <div className="min-w-0 overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-zinc-900/85 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-300">
                <Trophy size={21} />
              </div>
              <div>
                <h3 className="text-lg font-black sm:text-xl">
                  Trade Superlatives
                </h3>
                <p className="text-sm text-zinc-500">
                  Quick league trade notes
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              <Superlative
                label="Most Active Team"
                value={
                  mostActiveTeam
                    ? `${getTeamName(mostActiveTeam[0], teamByRosterId)} · ${mostActiveTeam[1]} trades`
                    : "No trades yet"
                }
              />
              <Superlative
                label="Biggest Trade"
                value={
                  biggestTrade
                    ? `${getAssetMoves(biggestTrade, players, teamByRosterId).length} assets · ${formatTradeHeadline(biggestTrade, teamByRosterId)}`
                    : "No trades yet"
                }
              />
              <Superlative
                label="Seasons With Trades"
                value={seasons.length || 0}
              />
            </div>
          </div>
        </aside>

        <div className="min-w-0 space-y-5 overflow-hidden">
          <div className="min-w-0 overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-zinc-900/85 p-4 shadow-2xl sm:p-5">
            <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_170px_190px]">
              <label className="flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3">
                <Search size={18} className="text-zinc-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search players, picks, or teams..."
                  className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-zinc-600"
                />
              </label>

              <select
                value={selectedSeason}
                onChange={(event) => setSelectedSeason(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold outline-none"
              >
                <option value="all">All seasons</option>
                {seasons.map((season) => (
                  <option key={season} value={season}>
                    {season}
                  </option>
                ))}
              </select>

              <select
                value={selectedTeam}
                onChange={(event) => setSelectedTeam(event.target.value)}
                className="rounded-2xl border border-zinc-800 bg-zinc-950 px-4 py-3 text-sm font-bold outline-none"
              >
                <option value="all">All teams</option>
                {teams.map((team) => (
                  <option
                    key={team.sleeper_roster_id}
                    value={team.sleeper_roster_id}
                  >
                    {team.team_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid min-w-0 grid-cols-3 gap-2 sm:gap-4">
            <MetricCard
              icon={<Handshake size={22} />}
              label="Showing"
              value={filteredTrades.length}
            />
            <MetricCard
              icon={<Sparkles size={22} />}
              label="Assets"
              value={
                filteredTrades.flatMap((trade) =>
                  getAssetMoves(trade, players, teamByRosterId),
                ).length
              }
            />
            <MetricCard
              icon={<Users size={22} />}
              label="Teams"
              value={teams.length}
            />
          </div>

          <div className="space-y-4">
            {filteredTrades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                players={players}
                teamByRosterId={teamByRosterId}
                isOpen={openTradeId === trade.id}
                onToggle={() =>
                  setOpenTradeId(openTradeId === trade.id ? null : trade.id)
                }
                leagueId={leagueId}
                onOpenAdvancedStats={openAdvancedStats}
                loadingAdvancedPlayerId={loadingAdvancedPlayerId}
              />
            ))}

            {!filteredTrades.length && (
              <div className="rounded-[1.35rem] border border-dashed border-zinc-800 bg-zinc-900/70 p-8 text-center text-zinc-400">
                No trades match those filters.
              </div>
            )}
          </div>
        </div>
      </section>

      {advancedStatsError && (
        <div className="fixed bottom-5 left-1/2 z-[9999] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-red-400/30 bg-red-950/90 px-4 py-3 text-sm font-bold text-red-100 shadow-2xl">
          {advancedStatsError}
        </div>
      )}

      <PlayerAdvancedStatsModal
        player={selectedAdvancedPlayer}
        onClose={() => setSelectedAdvancedPlayer(null)}
      />
    </main>
  );
}

function TradeCard({
  trade,
  players,
  teamByRosterId,
  isOpen,
  onToggle,
  leagueId,
  onOpenAdvancedStats,
  loadingAdvancedPlayerId,
}: {
  trade: Trade;
  players: Record<string, Player>;
  teamByRosterId: Map<number, Team>;
  isOpen: boolean;
  onToggle: () => void;
  leagueId: string;
  onOpenAdvancedStats: (asset: AssetDisplay) => void;
  loadingAdvancedPlayerId: string | null;
}) {
  const rosterIds = trade.roster_ids || [];
  const columns = rosterIds.map((rosterId) =>
    getTradeColumn(trade, Number(rosterId), players, teamByRosterId),
  );
  const assetCount = getAssetMoves(trade, players, teamByRosterId).length;

  return (
    <article className="min-w-0 overflow-hidden rounded-[1.35rem] border border-zinc-800 bg-zinc-900/85 shadow-xl transition hover:border-zinc-700">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start justify-between gap-4 p-4 text-left sm:p-5"
      >
        <div className="min-w-0 flex-1">
          <p className="text-[0.68rem] font-black uppercase tracking-[0.2em] text-emerald-400">
            Trade · {trade.season || "Unknown"} · Week {trade.week || "?"}
          </p>
          <h3 className="mt-2 truncate text-lg font-black sm:text-2xl">
            {formatTradeHeadline(trade, teamByRosterId)}
          </h3>
          <p className="mt-2 text-sm text-zinc-500">
            {assetCount} asset{assetCount === 1 ? "" : "s"} moved
          </p>
        </div>

        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-950 text-zinc-300 ring-1 ring-zinc-800 transition ${isOpen ? "rotate-180" : ""}`}
        >
          <ChevronDown size={20} />
        </div>
      </button>

      {isOpen && (
        <div className="border-t border-zinc-800 p-3 sm:p-5">
          <div
            className={`grid gap-3 ${columns.length === 2 ? "lg:grid-cols-2" : "lg:grid-cols-2 xl:grid-cols-3"}`}
          >
            {columns.map((column) => {
              const team = teamByRosterId.get(Number(column.rosterId));

              return (
                <div
                  key={column.rosterId}
                  className="min-w-0 overflow-hidden rounded-[1.15rem] border border-zinc-800 bg-zinc-950 p-3 sm:p-4"
                >
                  <div className="flex items-center justify-between gap-3">
                    {team ? (
                      <Link
                        href={`/league/${leagueId}/teams/${team.sleeper_roster_id}`}
                        className="min-w-0 flex-1 text-base font-black transition hover:text-emerald-400 sm:text-lg"
                      >
                        <span className="block truncate">{team.team_name}</span>
                        {team.owner_name && (
                          <span className="mt-0.5 block truncate text-xs font-bold text-zinc-500">
                            {team.owner_name}
                          </span>
                        )}
                      </Link>
                    ) : (
                      <h4 className="text-base font-black sm:text-lg">
                        Roster {column.rosterId}
                      </h4>
                    )}
                    <span className="rounded-full border border-zinc-800 bg-zinc-900 px-2.5 py-1 text-[0.65rem] font-black uppercase tracking-[0.16em] text-zinc-400">
                      R{column.rosterId}
                    </span>
                  </div>

                  <div className="mt-4 grid gap-3">
                    <AssetList
                      title="Received"
                      items={column.received}
                      good
                      onOpenAdvancedStats={onOpenAdvancedStats}
                      loadingAdvancedPlayerId={loadingAdvancedPlayerId}
                    />
                    <AssetList
                      title="Sent Away"
                      items={column.sent}
                      onOpenAdvancedStats={onOpenAdvancedStats}
                      loadingAdvancedPlayerId={loadingAdvancedPlayerId}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </article>
  );
}

function AssetList({
  title,
  items,
  good,
  onOpenAdvancedStats,
  loadingAdvancedPlayerId,
}: {
  title: string;
  items: AssetDisplay[];
  good?: boolean;
  onOpenAdvancedStats: (asset: AssetDisplay) => void;
  loadingAdvancedPlayerId: string | null;
}) {
  return (
    <div>
      <p className="text-[0.68rem] font-black uppercase tracking-[0.18em] text-zinc-500">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.map((item) => {
          const isClickableWr =
            item.type === "player" &&
            String(item.position || "").toUpperCase() === "WR";
          const isLoading = loadingAdvancedPlayerId === item.key;
          const toneClass = good
            ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-emerald-300/45 hover:bg-emerald-500/[0.14]"
            : "border-red-400/20 bg-red-500/10 text-red-300 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] hover:border-red-300/45 hover:bg-red-500/[0.14]";
          const content = (
            <>
              <AssetAvatar asset={item} />
              <div className="min-w-0 flex-1">
                <p
                  title={`${good ? "+" : "-"} ${item.label}`}
                  className={
                    item.type === "pick"
                      ? "min-w-0 leading-snug [overflow-wrap:anywhere]"
                      : "min-w-0 truncate"
                  }
                >
                  {good ? "+" : "-"} {item.label}
                </p>
                {item.meta && (
                  <p className="mt-0.5 truncate text-[0.68rem] font-bold uppercase tracking-[0.12em] opacity-70">
                    {item.meta}
                  </p>
                )}
                {isClickableWr && (
                  <p className="mt-1 text-[0.62rem] font-black uppercase tracking-[0.14em] opacity-55">
                    Tap for advanced stats
                  </p>
                )}
              </div>
              {isLoading && (
                <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-current" />
              )}
            </>
          );

          if (isClickableWr) {
            return (
              <button
                key={`${title}-${item.key}`}
                type="button"
                onClick={() => onOpenAdvancedStats(item)}
                className={`flex w-full max-w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-left text-sm font-bold transition ${toneClass}`}
              >
                {content}
              </button>
            );
          }

          return (
            <div
              key={`${title}-${item.key}`}
              className={`flex max-w-full min-w-0 items-center gap-3 overflow-hidden rounded-2xl border px-3 py-2.5 text-sm font-bold transition ${toneClass}`}
            >
              {content}
            </div>
          );
        })}
        {!items.length && (
          <p className="rounded-2xl border border-dashed border-zinc-800 px-3 py-2 text-sm text-zinc-600">
            No assets
          </p>
        )}
      </div>
    </div>
  );
}

function AssetAvatar({ asset }: { asset: AssetDisplay }) {
  if (asset.type === "pick") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-amber-400/20 bg-amber-500/10 text-xs font-black text-amber-300">
        PK
      </div>
    );
  }

  const initials = getInitials(asset.label);
  const imageUrl = asset.playerId
    ? getSleeperPlayerImage(asset.playerId)
    : null;

  return (
    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-zinc-800 text-xs font-black text-zinc-300">
      <span>{initials}</span>
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          loading="lazy"
          className="absolute inset-0 h-full w-full object-cover"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
      )}
    </div>
  );
}

function HeroStat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="min-w-0 rounded-2xl bg-zinc-950/60 p-3 ring-1 ring-white/10 sm:p-4">
      <p className="min-w-0 truncate text-lg font-black sm:text-2xl">{value}</p>
      <p className="mt-1 truncate text-[0.62rem] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:text-xs">
        {label}
      </p>
    </div>
  );
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string | number;
  value: string | number;
}) {
  return (
    <div className="rounded-[1.15rem] border border-zinc-800 bg-zinc-900/85 p-3 sm:p-5">
      <div className="hidden items-center gap-3 text-emerald-400 sm:flex">
        {icon}
      </div>
      <p className="text-2xl font-black sm:mt-4 sm:text-3xl">{value}</p>
      <p className="mt-1 truncate text-[0.62rem] font-bold uppercase tracking-[0.14em] text-zinc-500 sm:text-sm sm:tracking-[0.18em]">
        {label}
      </p>
    </div>
  );
}

function Superlative({
  label,
  value,
}: {
  label: string | number;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-zinc-500">
        {label}
      </p>
      <p className="mt-2 min-w-0 break-words text-sm font-black text-zinc-200 sm:text-base">
        {value}
      </p>
    </div>
  );
}

function TeamPill({ name, muted }: { name: string; muted?: boolean }) {
  return (
    <span
      className={`inline-block min-w-0 max-w-full truncate rounded-full px-3 py-1 text-[0.68rem] font-black ${muted ? "bg-zinc-900 text-zinc-400" : "bg-emerald-500 text-zinc-950"}`}
    >
      {name}
    </span>
  );
}

function getTradeColumn(
  trade: Trade,
  rosterId: number,
  players: Record<string, Player>,
  teamByRosterId: Map<number, Team>,
) {
  const receivedPlayers = trade.adds
    ? Object.entries(trade.adds)
        .filter(
          ([, receivingRosterId]) => Number(receivingRosterId) === rosterId,
        )
        .map(([playerId]) => getPlayerAsset(playerId, players))
    : [];

  const sentPlayers = trade.drops
    ? Object.entries(trade.drops)
        .filter(([, previousRosterId]) => Number(previousRosterId) === rosterId)
        .map(([playerId]) => getPlayerAsset(playerId, players))
    : trade.adds
      ? Object.entries(trade.adds)
          .filter(
            ([, receivingRosterId]) => Number(receivingRosterId) !== rosterId,
          )
          .filter(() => (trade.roster_ids || []).map(Number).includes(rosterId))
          .map(([playerId]) => getPlayerAsset(playerId, players))
      : [];

  const receivedPicks = getReceivedPicksForRoster(
    trade.draft_picks,
    rosterId,
    teamByRosterId,
  );
  const sentPicks = getLostPicksForRoster(
    trade.draft_picks,
    rosterId,
    teamByRosterId,
  );

  return {
    rosterId,
    received: [...receivedPlayers, ...receivedPicks],
    sent: [...sentPlayers, ...sentPicks],
  };
}

function getAssetMoves(
  trade: Trade,
  players: Record<string, Player>,
  teamByRosterId: Map<number, Team>,
): AssetMove[] {
  const moves: AssetMove[] = [];
  const rosterIds = (trade.roster_ids || []).map(Number);
  const timestamp = Number(trade.created_sleeper_at || 0);

  if (trade.adds) {
    for (const [playerId, toRosterId] of Object.entries(trade.adds)) {
      const to = Number(toRosterId);
      const from = trade.drops?.[playerId]
        ? Number(trade.drops[playerId])
        : rosterIds.find((id) => id !== to) || null;

      moves.push({
        key: `player:${playerId}`,
        label: getPlayerName(playerId, players),
        type: "player",
        playerId,
        fromRosterId: from,
        toRosterId: to,
        season: trade.season,
        week: trade.week,
        tradeId: trade.id,
        timestamp,
      });
    }
  }

  for (const pick of trade.draft_picks || []) {
    moves.push({
      key: getPickKey(pick),
      label: formatDraftPick(pick, teamByRosterId),
      type: "pick",
      fromRosterId: pick.previous_owner_id
        ? Number(pick.previous_owner_id)
        : null,
      toRosterId: pick.owner_id ? Number(pick.owner_id) : null,
      season: trade.season,
      week: trade.week,
      tradeId: trade.id,
      timestamp,
    });
  }

  return moves;
}

function getTradeAssetLabels(
  trade: Trade,
  players: Record<string, Player>,
  teamByRosterId: Map<number, Team>,
) {
  return getAssetMoves(trade, players, teamByRosterId).map(
    (move) => move.label,
  );
}

function getPlayerAsset(
  playerId: string,
  players: Record<string, Player>,
): AssetDisplay {
  const player = players[playerId];
  const sleeperPlayerId = player?.sleeper_player_id || playerId;
  const meta = [player?.position, player?.team].filter(Boolean).join(" · ");

  return {
    key: `player:${playerId}`,
    label: getPlayerName(playerId, players),
    type: "player",
    playerId: sleeperPlayerId,
    meta: meta || null,
    position: player?.position || null,
    searchName: getPlayerName(playerId, players),
  };
}

function assetDisplayFromMove(move: AssetMove): AssetDisplay {
  return {
    key: move.key,
    label: move.label,
    type: move.type,
    playerId: move.playerId,
  };
}

function getPlayerName(playerId: string, players: Record<string, Player>) {
  const player = players[playerId];
  if (!player) return playerId;

  const fullName =
    `${player.first_name || ""} ${player.last_name || ""}`.trim();
  return fullName || player.full_name || playerId;
}

function getInitials(label: string) {
  const words = label.split(" ").filter(Boolean);
  if (!words.length) return "??";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function getSleeperPlayerImage(playerId: string) {
  return `https://sleepercdn.com/content/nfl/players/${playerId}.jpg`;
}

function getPickKey(pick: any) {
  return `pick:${pick.season || ""}:${pick.round || ""}:${pick.roster_id || ""}`;
}

function formatDraftPick(pick: any, teamByRosterId?: Map<number, Team>) {
  const season = pick.season || "";
  const round = pick.round ? `Round ${pick.round}` : "Pick";
  const originalOwnerId = pick.roster_id ? Number(pick.roster_id) : null;
  const originalOwner = originalOwnerId
    ? `from ${teamByRosterId ? getTeamName(originalOwnerId, teamByRosterId) : `Roster ${originalOwnerId}`}`
    : "";

  return `${season} ${round}${originalOwner ? ` ${originalOwner}` : ""}`.trim();
}

function getReceivedPicksForRoster(
  draftPicks: any[] | null,
  rosterId: number,
  teamByRosterId: Map<number, Team>,
) {
  if (!draftPicks?.length) return [];
  return draftPicks
    .filter((pick) => Number(pick.owner_id) === rosterId)
    .map((pick) => ({
      key: getPickKey(pick),
      label: formatDraftPick(pick, teamByRosterId),
      type: "pick" as const,
      meta: "Draft pick",
    }));
}

function getLostPicksForRoster(
  draftPicks: any[] | null,
  rosterId: number,
  teamByRosterId: Map<number, Team>,
) {
  if (!draftPicks?.length) return [];
  return draftPicks
    .filter((pick) => Number(pick.previous_owner_id) === rosterId)
    .map((pick) => ({
      key: getPickKey(pick),
      label: formatDraftPick(pick, teamByRosterId),
      type: "pick" as const,
      meta: "Draft pick",
    }));
}

function getTeamName(
  rosterId: number | null | undefined,
  teamByRosterId: Map<number, Team>,
) {
  if (!rosterId) return "Unknown roster";
  const team = teamByRosterId.get(Number(rosterId));
  return team?.team_name || team?.owner_name || `Roster ${rosterId}`;
}

function formatTradeHeadline(trade: Trade, teamByRosterId: Map<number, Team>) {
  const names = (trade.roster_ids || [])
    .map((rosterId) => getTeamName(Number(rosterId), teamByRosterId))
    .filter(Boolean);

  if (!names.length) return "League trade completed";
  if (names.length === 1) return `${names[0]} made a deal`;
  if (names.length === 2) return `${names[0]} ↔ ${names[1]}`;
  return `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
}

function normalizePlayerName(value: string) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}
