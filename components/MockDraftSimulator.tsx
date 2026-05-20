'use client'

import { AnimatePresence, motion } from 'framer-motion'
import {
  ArrowLeftRight,
  Bot,
  Clock3,
  Download,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Settings2,
  Sparkles,
  Upload,
  UserRound,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'

type Position = 'QB' | 'RB' | 'WR' | 'TE'

type Player = {
  id: string
  name: string
  position: Position
  team: string
  adp: number
  rookie?: boolean
  note?: string
}

type Pick = {
  overall: number
  round: number
  pickInRound: number
  originalSlot: number
  ownerSlot: number
  player?: Player
  isUserPick?: boolean
}

type TeamRoster = {
  slot: number
  name: string
  isUser: boolean
  picks: Player[]
}

type TradeAsset = {
  key: string
  label: string
  type: 'pick'
  pickOverall: number
}

type DraftSettings = {
  teams: number
  rounds: number
  userSlot: number
  botSpeedMs: number
  variance: number
}

const DEFAULT_SETTINGS: DraftSettings = {
  teams: 12,
  rounds: 12,
  userSlot: 6,
  botSpeedMs: 950,
  variance: 10,
}

const POSITION_COLORS: Record<Position, string> = {
  QB: 'text-rose-300 bg-rose-400/10 border-rose-400/20',
  RB: 'text-teal-300 bg-teal-400/10 border-teal-400/20',
  WR: 'text-sky-300 bg-sky-400/10 border-sky-400/20',
  TE: 'text-amber-300 bg-amber-400/10 border-amber-400/20',
}

const POSITION_DOT: Record<Position, string> = {
  QB: 'bg-rose-400',
  RB: 'bg-teal-400',
  WR: 'bg-sky-400',
  TE: 'bg-amber-400',
}
// @ts-ignore
const DEFAULT_PLAYERS: Player[] = [
  { name: 'Josh Allen', position: 'QB', team: 'BUF', adp: 1.5 },
  { name: 'Bijan Robinson', position: 'RB', team: 'ATL', adp: 2.6 },
  { name: 'Drake Maye', position: 'QB', team: 'NE', adp: 3.4 },
  { name: "Ja'Marr Chase", position: 'WR', team: 'CIN', adp: 4.4 },
  { name: 'Jahmyr Gibbs', position: 'RB', team: 'DET', adp: 5.9 },
  { name: 'Puka Nacua', position: 'WR', team: 'LAR', adp: 6.4 },
  { name: 'Jaxon Smith-Njigba', position: 'WR', team: 'SEA', adp: 7.5 },
  { name: 'Jayden Daniels', position: 'QB', team: 'WAS', adp: 8 },
  { name: 'Amon-Ra St. Brown', position: 'WR', team: 'DET', adp: 9.1 },
  { name: 'Joe Burrow', position: 'QB', team: 'CIN', adp: 10.4 },
  { name: 'Lamar Jackson', position: 'QB', team: 'BAL', adp: 11.8 },
  { name: 'Malik Nabers', position: 'WR', team: 'NYG', adp: 12.8 },
  { name: 'Brock Bowers', position: 'TE', team: 'LV', adp: 13.2 },
  { name: 'Caleb Williams', position: 'QB', team: 'CHI', adp: 14.1 },
  { name: 'Trey McBride', position: 'TE', team: 'ARI', adp: 15.4 },
  { name: 'Justin Jefferson', position: 'WR', team: 'MIN', adp: 16.3 },
  { name: 'Ashton Jeanty', position: 'RB', team: 'LV', adp: 17.6, rookie: true },
  { name: 'Jeremiyah Love', position: 'RB', team: 'ARI', adp: 19 },
  { name: 'CeeDee Lamb', position: 'WR', team: 'DAL', adp: 19.5 },
  { name: "De'Von Achane", position: 'RB', team: 'MIA', adp: 20.3 },
  { name: 'Omarion Hampton', position: 'RB', team: 'LAC', adp: 21.2, rookie: true },
  { name: 'Drake London', position: 'WR', team: 'ATL', adp: 22.6 },
  { name: 'Jaxson Dart', position: 'QB', team: 'NYG', adp: 23.4, rookie: true },
  { name: 'Justin Herbert', position: 'QB', team: 'LAC', adp: 24.3 },
  { name: 'Jalen Hurts', position: 'QB', team: 'PHI', adp: 25.9 },
  { name: 'Patrick Mahomes', position: 'QB', team: 'KC', adp: 26.9 },
  { name: 'Jonathan Taylor', position: 'RB', team: 'IND', adp: 27.9 },
  { name: 'Tetairoa McMillan', position: 'WR', team: 'CAR', adp: 28.4, rookie: true },
  { name: 'Colston Loveland', position: 'TE', team: 'CHI', adp: 29.1, rookie: true },
  { name: 'James Cook', position: 'RB', team: 'BUF', adp: 30.4 },
  { name: 'Trevor Lawrence', position: 'QB', team: 'JAX', adp: 32 },
  { name: 'George Pickens', position: 'WR', team: 'DAL', adp: 32.4 },
  { name: 'Bo Nix', position: 'QB', team: 'DEN', adp: 33.5 },
  { name: 'Nico Collins', position: 'WR', team: 'HOU', adp: 34.2 },
  { name: 'Chris Olave', position: 'WR', team: 'NO', adp: 35 },
  { name: 'Brock Purdy', position: 'QB', team: 'SF', adp: 36.9 },
  { name: 'Emeka Egbuka', position: 'WR', team: 'TB', adp: 37.2, rookie: true },
  { name: 'Tyler Warren', position: 'TE', team: 'IND', adp: 38.7, rookie: true },
  { name: 'Fernando Mendoza', position: 'QB', team: 'LV', adp: 39.9 },
  { name: 'Garrett Wilson', position: 'WR', team: 'NYJ', adp: 40.2 },
  { name: 'Chase Brown', position: 'RB', team: 'CIN', adp: 41.2 },
  { name: "TreVeyon Henderson", position: 'RB', team: 'NE', adp: 42.5, rookie: true },
  { name: 'Christian McCaffrey', position: 'RB', team: 'SF', adp: 43.9 },
  { name: 'Dak Prescott', position: 'QB', team: 'DAL', adp: 44.9 },
  { name: 'Ladd McConkey', position: 'WR', team: 'LAC', adp: 45.6 },
  { name: 'Harold Fannin', position: 'TE', team: 'CLE', adp: 46.8, rookie: true },
  { name: 'Kenneth Walker', position: 'RB', team: 'SEA', adp: 47.1 },
  { name: 'Breece Hall', position: 'RB', team: 'NYJ', adp: 48.8 },
  { name: 'Jordan Love', position: 'QB', team: 'GB', adp: 49 },
  { name: 'Carnell Tate', position: 'WR', team: 'TEN', adp: 50.8, rookie: true },
  { name: 'Bucky Irving', position: 'RB', team: 'TB', adp: 51.2 },
  { name: 'Rashee Rice', position: 'WR', team: 'KC', adp: 53 },
  { name: 'Quinshon Judkins', position: 'RB', team: 'CLE', adp: 53.9, rookie: true },
  { name: 'Luther Burden', position: 'WR', team: 'CHI', adp: 54.1, rookie: true },
  { name: 'Rome Odunze', position: 'WR', team: 'CHI', adp: 55.4 },
  { name: 'Saquon Barkley', position: 'RB', team: 'PHI', adp: 56.7 },
  { name: 'Jordyn Tyson', position: 'WR', team: 'NO', adp: 57.2, rookie: true },
  { name: 'Tucker Kraft', position: 'TE', team: 'GB', adp: 58.2 },
  { name: 'Marvin Harrison', position: 'WR', team: 'ARI', adp: 59.1 },
  { name: 'A.J. Brown', position: 'WR', team: 'PHI', adp: 60.4 },
  { name: 'Tee Higgins', position: 'WR', team: 'CIN', adp: 61.9 },
  { name: 'Brian Thomas', position: 'WR', team: 'JAX', adp: 63 },
  { name: 'Kyren Williams', position: 'RB', team: 'LAR', adp: 63.2 },
  { name: 'Baker Mayfield', position: 'QB', team: 'TB', adp: 64.6 },
  { name: 'Jared Goff', position: 'QB', team: 'DET', adp: 65.1 },
  { name: 'Zay Flowers', position: 'WR', team: 'BAL', adp: 67 },
  { name: 'Makai Lemon', position: 'WR', team: 'PHI', adp: 67.8, rookie: true },
  { name: 'Sam LaPorta', position: 'TE', team: 'DET', adp: 69 },
  { name: 'Jameson Williams', position: 'WR', team: 'DET', adp: 69.9 },
  { name: 'Javonte Williams', position: 'RB', team: 'DAL', adp: 70.7 },
  { name: 'Josh Jacobs', position: 'RB', team: 'GB', adp: 71.1 },
  { name: 'Cam Ward', position: 'QB', team: 'TEN', adp: 72, rookie: true },
  { name: 'Travis Etienne', position: 'RB', team: 'NO', adp: 74 },
  { name: 'DeVonta Smith', position: 'WR', team: 'PHI', adp: 74 },
  { name: 'Cam Skattebo', position: 'RB', team: 'NYG', adp: 75.3, rookie: true },
  { name: 'C.J. Stroud', position: 'QB', team: 'HOU', adp: 76.3 },
  { name: 'Kyle Pitts', position: 'TE', team: 'ATL', adp: 77.2 },
  { name: 'Tyler Shough', position: 'QB', team: 'NO', adp: 78.2, rookie: true },
  { name: 'Jaylen Waddle', position: 'WR', team: 'DEN', adp: 79.6 },
  { name: 'Sam Darnold', position: 'QB', team: 'SEA', adp: 80.7 },
  { name: 'Jadarian Price', position: 'RB', team: 'SEA', adp: 81.5, rookie: true },
  { name: 'RJ Harvey', position: 'RB', team: 'DEN', adp: 82.8, rookie: true },
  { name: 'Derrick Henry', position: 'RB', team: 'BAL', adp: 83.4 },
  { name: 'Kyler Murray', position: 'QB', team: 'MIN', adp: 84.1 },
  { name: 'KC Concepcion', position: 'WR', team: 'CLE', adp: 84.5, rookie: true },
  { name: 'Oronde Gadsden', position: 'TE', team: 'LAC', adp: 85.7, rookie: true },
  { name: 'Kenyon Sadiq', position: 'TE', team: 'NYG', adp: 87, rookie: true },
  { name: 'Bryce Young', position: 'QB', team: 'CAR', adp: 87.8 },
  { name: 'Matthew Stafford', position: 'QB', team: 'LAR', adp: 88.3 },
  { name: 'DJ Moore', position: 'WR', team: 'BUF', adp: 89.2 },
  { name: 'Alec Pierce', position: 'WR', team: 'IND', adp: 90.8 },
  { name: 'Michael Wilson', position: 'WR', team: 'ARI', adp: 91.1 },
  { name: 'Malik Willis', position: 'QB', team: 'MIA', adp: 93 },
  { name: 'Daniel Jones', position: 'QB', team: 'IND', adp: 93 },
  { name: 'Omar Cooper', position: 'WR', team: 'NYJ', adp: 94.9, rookie: true },
  { name: 'Bhayshul Tuten', position: 'RB', team: 'JAX', adp: 95.6, rookie: true },
  { name: 'Jordan Addison', position: 'WR', team: 'MIN', adp: 96.1 },
  { name: 'Christian Watson', position: 'WR', team: 'GB', adp: 97.2 },
  { name: "Wan'Dale Robinson", position: 'WR', team: 'TEN', adp: 99 },
  { name: "D'Andre Swift", position: 'RB', team: 'CHI', adp: 99.8 },
  { name: 'Dalton Kincaid', position: 'TE', team: 'BUF', adp: 100.3 },
  { name: 'Ricky Pearsall', position: 'WR', team: 'SF', adp: 101.4 },
  { name: 'DK Metcalf', position: 'WR', team: 'PIT', adp: 102 },
  { name: 'Ty Simpson', position: 'QB', team: 'ALR', adp: 104, rookie: true },
  { name: 'Kyle Monangai', position: 'RB', team: 'CHI', adp: 104.3, rookie: true },
  { name: 'Davante Adams', position: 'WR', team: 'LAR', adp: 105.3 },
  { name: 'Terry McLaurin', position: 'WR', team: 'WAS', adp: 107 },
  { name: 'Jake Ferguson', position: 'TE', team: 'DAL', adp: 107.2 },
  { name: 'David Montgomery', position: 'RB', team: 'HOU', adp: 108.9 },
  { name: 'Brenton Strange', position: 'TE', team: 'JAX', adp: 110 },
  { name: 'Parker Washington', position: 'WR', team: 'JAX', adp: 111 },
  { name: 'Travis Hunter', position: 'WR', team: 'JAX', adp: 111.8, rookie: true, note: 'DB/WR' },
  { name: 'Denzel Boston', position: 'WR', team: 'CLE', adp: 112.8, rookie: true },
  { name: 'George Kittle', position: 'TE', team: 'SF', adp: 113.2 },
  { name: 'Zach Charbonnet', position: 'RB', team: 'SEA', adp: 114.4 },
  { name: 'Jayden Higgins', position: 'WR', team: 'HOU', adp: 115.1, rookie: true },
  { name: 'Jaylen Warren', position: 'RB', team: 'PIT', adp: 116.5 },
  { name: 'Michael Pittman', position: 'WR', team: 'PIT', adp: 117 },
  { name: 'Mike Evans', position: 'WR', team: 'SF', adp: 118.3 },
  { name: 'Chuba Hubbard', position: 'RB', team: 'CAR', adp: 119.7 },
  { name: 'Tyler Allgeier', position: 'RB', team: 'ARI', adp: 121.1 },
  { name: 'Quentin Johnston', position: 'WR', team: 'LAC', adp: 122.4 },
  { name: 'Courtland Sutton', position: 'WR', team: 'DEN', adp: 123.8 },
  { name: 'Matthew Golden', position: 'WR', team: 'GB', adp: 124.1, rookie: true },
  { name: 'Blake Corum', position: 'RB', team: 'LAR', adp: 126 },
  { name: 'Isaiah Likely', position: 'TE', team: 'NYG', adp: 126.8 },
  { name: 'Jakobi Meyers', position: 'WR', team: 'JAX', adp: 127.2 },
  { name: 'Xavier Worthy', position: 'WR', team: 'KC', adp: 129 },
  { name: 'Rico Dowdle', position: 'RB', team: 'PIT', adp: 129.8 },
  { name: 'Eli Stowers', position: 'TE', team: 'PHI', adp: 130.4, rookie: true },
  { name: 'Jonah Coleman', position: 'RB', team: 'DEN', adp: 131.6, rookie: true },
  { name: 'Romeo Doubs', position: 'WR', team: 'NE', adp: 133.7 },
].map((player, index) => ({
  ...player,
  id: `${normalizeKey(player.name)}-${index}`,
  position: player.position === ('DB/WR' as Position) ? 'WR' : player.position,
}))

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-')
}

function getPickOrder(settings: DraftSettings): Pick[] {
  const picks: Pick[] = []

  for (let round = 1; round <= settings.rounds; round++) {
    const isEvenRound = round % 2 === 0
    const slots = Array.from({ length: settings.teams }, (_, index) => index + 1)
    const roundSlots = isEvenRound ? slots.reverse() : slots

    for (let index = 0; index < roundSlots.length; index++) {
      const overall = (round - 1) * settings.teams + index + 1
      picks.push({
        overall,
        round,
        pickInRound: index + 1,
        originalSlot: roundSlots[index],
        ownerSlot: roundSlots[index],
      })
    }
  }

  return picks
}

function pickLabel(pick: Pick) {
  return `${pick.round}.${String(pick.pickInRound).padStart(2, '0')}`
}

function buildRosters(settings: DraftSettings, picks: Pick[]) {
  const rosters: TeamRoster[] = Array.from({ length: settings.teams }, (_, index) => {
    const slot = index + 1
    return {
      slot,
      name: slot === settings.userSlot ? 'You' : `Bot ${slot}`,
      isUser: slot === settings.userSlot,
      picks: [],
    }
  })

  for (const pick of picks) {
    if (!pick.player) continue
    rosters[pick.ownerSlot - 1]?.picks.push(pick.player)
  }

  return rosters
}

function positionNeeds(roster: Player[]) {
  const counts = roster.reduce(
    (acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1
      return acc
    },
    { QB: 0, RB: 0, WR: 0, TE: 0 } as Record<Position, number>
  )

  return {
    QB: counts.QB < 2 ? 9 - counts.QB * 3 : counts.QB < 3 ? 1 : -5,
    RB: counts.RB < 2 ? 5 - counts.RB : counts.RB < 5 ? 1 : -2,
    WR: counts.WR < 3 ? 5 - counts.WR : counts.WR < 7 ? 1 : -2,
    TE: counts.TE < 1 ? 3 : counts.TE < 2 ? 0.5 : -2,
  }
}

function roundAdpVariance(round: number, maxLateVariance: number, totalRounds: number) {
  // Bots should be very close to ADP early, then slowly loosen up as the draft gets deeper.
  // The easing curve keeps rounds 1-3 tight while still reaching the selected variance late.
  const cappedMax = Math.max(1, maxLateVariance)
  const lastRound = Math.max(1, totalRounds - 1)
  const progress = Math.min(1, Math.max(0, (round - 1) / lastRound))
  const easedProgress = Math.pow(progress, 1.45)
  const earlyRoundVariance = 1.75

  return Number((earlyRoundVariance + (cappedMax - earlyRoundVariance) * easedProgress).toFixed(2))
}

function chooseBotPick({
  availablePlayers,
  currentPick,
  roster,
  variance,
  totalRounds,
}: {
  availablePlayers: Player[]
  currentPick: Pick
  roster: Player[]
  variance: number
  totalRounds: number
}) {
  const needs = positionNeeds(roster)
  const roundVariance = roundAdpVariance(currentPick.round, variance, totalRounds)
  const sortedByAdp = availablePlayers.slice().sort((a, b) => a.adp - b.adp)

  // The random target creates the ADP variance. Early rounds now have a little more room to move,
  // while late rounds can drift by the selected amount in either direction.
  const targetAdp = currentPick.overall + (Math.random() * 2 - 1) * roundVariance
  const adpReachLimit = currentPick.overall + roundVariance
  const candidateLimit = currentPick.round <= 3 ? 8 : currentPick.round <= 6 ? 14 : 24
  const candidates = sortedByAdp
    .filter((player) => player.adp <= adpReachLimit)
    .slice(0, candidateLimit)

  const safeCandidates = candidates.length ? candidates : sortedByAdp.slice(0, Math.max(6, candidateLimit))

  const scored = safeCandidates.map((player) => {
    const targetDistance = Math.abs(player.adp - targetAdp)
    const reachPenalty = Math.max(0, player.adp - currentPick.overall) * (currentPick.round <= 3 ? 1.15 : currentPick.round <= 6 ? 0.7 : 0.35)
    const fallerBonus = Math.min(Math.max(0, currentPick.overall - player.adp) * 0.08, currentPick.round <= 3 ? 1 : 2.75)
    const needWeight = currentPick.round <= 3 ? 0.18 : currentPick.round <= 6 ? 0.42 : 0.75
    const rosterFit = (needs[player.position] || 0) * needWeight
    const tieBreakerNoise = (Math.random() - 0.5) * Math.min(1.25, roundVariance * 0.18)
    const rookieBump = player.rookie && currentPick.overall > 20 ? 0.45 : 0

    return {
      player,
      score: targetDistance + reachPenalty - fallerBonus - rosterFit - rookieBump + tieBreakerNoise,
    }
  })

  scored.sort((a, b) => a.score - b.score)
  return scored[0]?.player || safeCandidates[0] || availablePlayers[0]
}

function parseAdpText(text: string): Player[] {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const parts = line.split(',').map((part) => part.trim())
      if (parts.length < 4) return null

      const [name, position, team, adp] = parts
      const cleanPosition = position.toUpperCase() as Position

      if (!['QB', 'RB', 'WR', 'TE'].includes(cleanPosition)) return null

      return {
        id: `${normalizeKey(name)}-custom-${index}`,
        name,
        position: cleanPosition,
        team: team.toUpperCase(),
        adp: Number(adp),
      }
    })
    .filter((player): player is Player => Boolean(player && Number.isFinite(player.adp)))
}

export default function MockDraftSimulator() {
  const [settings, setSettings] = useState<DraftSettings>(DEFAULT_SETTINGS)
  const [players, setPlayers] = useState<Player[]>(DEFAULT_PLAYERS)
  const [draftPicks, setDraftPicks] = useState<Pick[]>(() => getPickOrder(DEFAULT_SETTINGS))
  const [started, setStarted] = useState(false)
  const [paused, setPaused] = useState(true)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [selectedPosition, setSelectedPosition] = useState<'ALL' | Position>('ALL')
  const [search, setSearch] = useState('')
  const [selectedRosterSlot, setSelectedRosterSlot] = useState(DEFAULT_SETTINGS.userSlot)
  const [tradeOpen, setTradeOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [tradeLog, setTradeLog] = useState<string[]>([])
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentPick = draftPicks[currentIndex]
  const draftedIds = useMemo(
    () => new Set(draftPicks.filter((pick) => pick.player).map((pick) => pick.player!.id)),
    [draftPicks]
  )

  const availablePlayers = useMemo(() => {
    return players
      .filter((player) => !draftedIds.has(player.id))
      .filter((player) => selectedPosition === 'ALL' || player.position === selectedPosition)
      .filter((player) => {
        const query = search.trim().toLowerCase()
        if (!query) return true
        return `${player.name} ${player.position} ${player.team}`.toLowerCase().includes(query)
      })
      .sort((a, b) => a.adp - b.adp)
  }, [draftedIds, players, search, selectedPosition])

  const allAvailablePlayers = useMemo(
    () => players.filter((player) => !draftedIds.has(player.id)).sort((a, b) => a.adp - b.adp),
    [draftedIds, players]
  )

  const rosters = useMemo(() => buildRosters(settings, draftPicks), [draftPicks, settings])
  const selectedRoster = rosters[selectedRosterSlot - 1]
  const userRoster = rosters[settings.userSlot - 1]
  const isUserOnClock = Boolean(currentPick && currentPick.ownerSlot === settings.userSlot)
  const isDraftDone = currentIndex >= draftPicks.length

  useEffect(() => {
    if (!started || paused || isDraftDone || isUserOnClock || !currentPick) return

    timerRef.current = setTimeout(() => {
      const roster = rosters[currentPick.ownerSlot - 1]?.picks || []
      const player = chooseBotPick({
        availablePlayers: allAvailablePlayers,
        currentPick,
        roster,
        variance: settings.variance,
        totalRounds: settings.rounds,
      })

      makePick(player)
    }, settings.botSpeedMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [allAvailablePlayers, currentPick, isDraftDone, isUserOnClock, paused, rosters, settings.botSpeedMs, settings.rounds, settings.variance, started])

  function resetDraft(nextSettings = settings, nextPlayers = players) {
    setSettings(nextSettings)
    setDraftPicks(getPickOrder(nextSettings))
    setStarted(false)
    setPaused(true)
    setCurrentIndex(0)
    setSelectedRosterSlot(nextSettings.userSlot)
    setTradeLog([])
    setPlayers(nextPlayers)
  }

  function startDraft() {
    setStarted(true)
    setPaused(false)
  }

  function makePick(player: Player) {
    if (!currentPick || draftedIds.has(player.id)) return

    setDraftPicks((previous) =>
      previous.map((pick, index) =>
        index === currentIndex
          ? {
              ...pick,
              player,
              isUserPick: pick.ownerSlot === settings.userSlot,
            }
          : pick
      )
    )
    setCurrentIndex((index) => index + 1)
  }

  function undoPick() {
    if (currentIndex <= 0) return
    setDraftPicks((previous) =>
      previous.map((pick, index) => (index === currentIndex - 1 ? { ...pick, player: undefined, isUserPick: false } : pick))
    )
    setCurrentIndex((index) => index - 1)
    setPaused(true)
  }

  function importPlayers() {
    const imported = parseAdpText(importText)
    if (!imported.length) return
    resetDraft(settings, imported)
    setImportOpen(false)
    setImportText('')
  }

  function downloadResults() {
    const rows = draftPicks
      .filter((pick) => pick.player)
      .map((pick) => ({
        overall: pick.overall,
        pick: pickLabel(pick),
        owner: rosters[pick.ownerSlot - 1]?.name || `Team ${pick.ownerSlot}`,
        original_slot: pick.originalSlot,
        player: pick.player?.name,
        position: pick.player?.position,
        team: pick.player?.team,
        adp: pick.player?.adp,
      }))

    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'mock-draft-results.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-4 px-3 py-4 sm:px-5 lg:h-[calc(100vh-73px)] lg:overflow-hidden">
      <section className="rounded-[1.75rem] border border-slate-600/40 bg-slate-900/80 p-4 shadow-2xl shadow-black/30 backdrop-blur sm:p-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.28em] text-indigo-300">
              <Sparkles size={16} /> Superflex TE+ PPR
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-5xl">Mock Draft Simulator</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
              Claim any draft slot, let bots pick with ADP variance, pause the room, and mock pick trades whenever you want.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            <Control label="Teams">
              <select
                value={settings.teams}
                disabled={started}
                onChange={(event) => {
                  const teams = Number(event.target.value)
                  resetDraft({ ...settings, teams, userSlot: Math.min(settings.userSlot, teams) })
                }}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                {[10, 12, 14].map((teamCount) => (
                  <option key={teamCount} value={teamCount}>{teamCount}</option>
                ))}
              </select>
            </Control>

            <Control label="Rounds">
              <select
                value={settings.rounds}
                disabled={started}
                onChange={(event) => resetDraft({ ...settings, rounds: Number(event.target.value) })}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                {[8, 10, 12, 15, 20].map((rounds) => (
                  <option key={rounds} value={rounds}>{rounds}</option>
                ))}
              </select>
            </Control>

            <Control label="Your Spot">
              <select
                value={settings.userSlot}
                disabled={started}
                onChange={(event) => {
                  const userSlot = Number(event.target.value)
                  resetDraft({ ...settings, userSlot })
                }}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                {Array.from({ length: settings.teams }, (_, index) => index + 1).map((slot) => (
                  <option key={slot} value={slot}>Pick {slot}</option>
                ))}
              </select>
            </Control>

            <Control label="Bot Speed">
              <select
                value={settings.botSpeedMs}
                onChange={(event) => setSettings((prev) => ({ ...prev, botSpeedMs: Number(event.target.value) }))}
                className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                <option value={450}>Fast</option>
                <option value={950}>Normal</option>
                <option value={1600}>Slow</option>
              </select>
            </Control>

            <Control label="Late-Round Variance">
              <input
                type="range"
                min={1}
                max={16}
                value={settings.variance}
                onChange={(event) => setSettings((prev) => ({ ...prev, variance: Number(event.target.value) }))}
                className="w-full accent-indigo-400"
              />
              <p className="mt-1 text-xs font-bold text-slate-400">Round 1 stays around ADP ±1.75, then eases toward ±{settings.variance} late</p>
            </Control>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:min-h-0 lg:flex-1 lg:grid-cols-[340px_minmax(0,1fr)_360px]">
        <aside className="flex min-h-0 flex-col rounded-[1.75rem] border border-slate-600/40 bg-slate-900/80 shadow-2xl shadow-black/30">
          <div className="border-b border-slate-700/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-black">Players</h2>
              <button
                onClick={() => setImportOpen(true)}
                className="flex items-center gap-2 rounded-xl border border-indigo-300/20 bg-indigo-400/10 px-3 py-2 text-xs font-black text-indigo-200 transition hover:bg-indigo-400/20"
              >
                <Upload size={14} /> Import ADP
              </button>
            </div>

            <div className="mt-3 flex items-center gap-2 rounded-2xl border border-slate-600 bg-slate-950 px-3 py-2">
              <Search size={16} className="text-slate-500" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search players"
                className="w-full bg-transparent text-sm font-semibold text-white outline-none placeholder:text-slate-500"
              />
            </div>

            <div className="mt-3 grid grid-cols-5 gap-2">
              {(['ALL', 'QB', 'RB', 'WR', 'TE'] as const).map((position) => (
                <button
                  key={position}
                  onClick={() => setSelectedPosition(position)}
                  className={`rounded-xl border px-2 py-2 text-xs font-black transition ${
                    selectedPosition === position
                      ? 'border-indigo-300 bg-indigo-400 text-slate-950'
                      : 'border-slate-700 bg-slate-950 text-slate-300 hover:border-slate-500'
                  }`}
                >
                  {position}
                </button>
              ))}
            </div>
          </div>

          <div className="min-h-[420px] flex-1 overflow-y-auto p-2 lg:min-h-0">
            <AnimatePresence initial={false}>
              {availablePlayers.slice(0, 180).map((player) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  disabled={!isUserOnClock || paused || isDraftDone}
                  onPick={() => makePick(player)}
                />
              ))}
            </AnimatePresence>
          </div>
        </aside>

        <section className="flex min-h-0 flex-col rounded-[1.75rem] border border-slate-600/40 bg-slate-900/80 shadow-2xl shadow-black/30">
          <div className="border-b border-slate-700/70 p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Draft Room</p>
                <div className="mt-1 flex flex-wrap items-center gap-3">
                  <h2 className="text-2xl font-black">
                    {isDraftDone ? 'Draft Complete' : currentPick ? `Pick ${currentPick.overall} · ${pickLabel(currentPick)}` : 'Ready'}
                  </h2>
                  {currentPick && !isDraftDone ? (
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${isUserOnClock ? 'bg-emerald-400 text-slate-950' : 'bg-slate-700 text-slate-200'}`}>
                      {isUserOnClock ? 'YOU ARE ON THE CLOCK' : `${rosters[currentPick.ownerSlot - 1]?.name} is picking`}
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {!started ? (
                  <button onClick={startDraft} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-indigo-300"><Play size={16} /> Start Draft</button>
                ) : (
                  <button onClick={() => setPaused((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-indigo-300">
                    {paused ? <Play size={16} /> : <Pause size={16} />}
                    {paused ? 'Resume' : 'Pause'}
                  </button>
                )}
                <button onClick={() => { setPaused(true); setTradeOpen(true) }} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"><ArrowLeftRight size={16} /> Mock Trade</button>
                <button onClick={undoPick} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"><ArrowLeft sizeProxy /> Undo</button>
                <button onClick={() => resetDraft()} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"><RotateCcw size={16} /> Reset</button>
                <button onClick={downloadResults} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800"><Download size={16} /> Export</button>
              </div>
            </div>
          </div>

          <div className="grid gap-3 border-b border-slate-700/70 p-4 sm:grid-cols-3">
            <StatusCard icon={<Clock3 size={18} />} label="Clock Status" value={paused ? 'Paused' : isUserOnClock ? 'Your pick' : 'Bots drafting'} />
            <StatusCard icon={<Settings2 size={18} />} label="Bot Logic" value={`ADP curve • late ± ${settings.variance}`} />
            <StatusCard icon={<ArrowLeftRight size={18} />} label="Trades" value={`${tradeLog.length} logged`} />
          </div>

          <div className="min-h-[520px] flex-1 overflow-auto p-3 lg:min-h-0">
            <div
              className="grid min-w-[920px] gap-2"
              style={{
                gridTemplateColumns: `repeat(${settings.teams}, minmax(118px, 1fr))`,
                gridAutoRows: 'minmax(88px, auto)',
              }}
            >
              {Array.from({ length: settings.teams }, (_, index) => index + 1).map((slot) => (
                <div
                  key={slot}
                  className={`sticky top-0 z-10 rounded-2xl border px-3 py-2 text-center shadow-lg ${slot === settings.userSlot ? 'border-emerald-300 bg-emerald-400 text-slate-950' : 'border-slate-700 bg-slate-950 text-slate-200'}`}
                  style={{ gridColumn: slot, gridRow: 1 }}
                >
                  <p className="text-xs font-black uppercase tracking-[0.2em] opacity-70">Slot {slot}</p>
                  <p className="text-sm font-black">{slot === settings.userSlot ? 'You' : `Bot ${slot}`}</p>
                </div>
              ))}

              {draftPicks.map((pick, index) => (
                <motion.button
                  key={pick.overall}
                  layout
                  onClick={() => setSelectedRosterSlot(pick.ownerSlot)}
                  className={`min-h-[88px] rounded-2xl border p-2 text-left transition ${
                    index === currentIndex && !isDraftDone
                      ? 'border-indigo-300 bg-indigo-400/15 ring-2 ring-indigo-300/40'
                      : pick.player
                        ? pick.isUserPick
                          ? 'border-emerald-300/60 bg-emerald-400/10'
                          : 'border-slate-700 bg-slate-800/80'
                        : pick.ownerSlot !== pick.originalSlot
                          ? 'border-amber-300/40 bg-amber-400/10'
                          : 'border-slate-800 bg-slate-950/80'
                  }`}
                  style={{ gridColumn: pick.originalSlot, gridRow: pick.round + 1 }}
                >
                  <div className="flex items-center justify-between gap-2 text-[11px] font-black text-slate-500">
                    <span>{pickLabel(pick)}</span>
                    {pick.ownerSlot !== pick.originalSlot ? (
                      <span className="rounded-full bg-amber-300 px-2 py-0.5 text-[10px] text-slate-950">→ {pick.ownerSlot}</span>
                    ) : null}
                  </div>

                  {pick.player ? (
                    <div className="mt-2">
                      <p className="line-clamp-2 text-sm font-black text-white">{pick.player.name}</p>
                      <div className="mt-1 flex items-center gap-1 text-xs font-bold text-slate-400">
                        <span className={`h-1.5 w-1.5 rounded-full ${POSITION_DOT[pick.player.position]}`} />
                        {pick.player.position} · {pick.player.team}
                      </div>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-xs font-bold text-slate-500">
                      {pick.ownerSlot === settings.userSlot ? <UserRound size={14} /> : <Bot size={14} />}
                      {pick.ownerSlot === settings.userSlot ? 'Your pick' : `Bot ${pick.ownerSlot}`}
                    </div>
                  )}
                </motion.button>
              ))}
            </div>
          </div>
        </section>

        <aside className="flex min-h-0 flex-col rounded-[1.75rem] border border-slate-600/40 bg-slate-900/80 shadow-2xl shadow-black/30">
          <div className="border-b border-slate-700/70 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-slate-400">Roster</p>
                <h2 className="mt-1 text-2xl font-black">{selectedRoster?.name}</h2>
              </div>
              <select
                value={selectedRosterSlot}
                onChange={(event) => setSelectedRosterSlot(Number(event.target.value))}
                className="rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none"
              >
                {rosters.map((roster) => (
                  <option key={roster.slot} value={roster.slot}>{roster.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 border-b border-slate-700/70 p-4">
            {(['QB', 'RB', 'WR', 'TE'] as Position[]).map((position) => (
              <div key={position} className="rounded-2xl bg-slate-950 p-3 text-center">
                <p className="text-xs font-black text-slate-500">{position}</p>
                <p className="mt-1 text-xl font-black">{selectedRoster?.picks.filter((player) => player.position === position).length || 0}</p>
              </div>
            ))}
          </div>

          <div className="min-h-[360px] flex-1 overflow-y-auto p-3 lg:min-h-0">
            {selectedRoster?.picks.length ? (
              <div className="space-y-2">
                {selectedRoster.picks.map((player, index) => (
                  <div key={`${player.id}-${index}`} className="rounded-2xl border border-slate-700 bg-slate-950 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-black">{player.name}</p>
                      <span className={`rounded-full border px-2 py-1 text-[11px] font-black ${POSITION_COLORS[player.position]}`}>{player.position}</span>
                    </div>
                    <p className="mt-1 text-xs font-bold text-slate-500">{player.team} · ADP {player.adp}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-slate-700 p-6 text-center text-sm font-bold text-slate-500">
                No picks yet.
              </div>
            )}
          </div>

          <div className="border-t border-slate-700/70 p-4">
            <h3 className="text-sm font-black uppercase tracking-[0.2em] text-slate-400">Trade Log</h3>
            <div className="mt-3 max-h-28 space-y-2 overflow-y-auto">
              {tradeLog.length ? tradeLog.map((item, index) => (
                <p key={`${item}-${index}`} className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-slate-300">{item}</p>
              )) : (
                <p className="text-sm font-bold text-slate-500">Pause the draft and execute a mock trade to test scenarios.</p>
              )}
            </div>
          </div>
        </aside>
      </section>

      <AnimatePresence>
        {tradeOpen ? (
          <TradeModal
            settings={settings}
            picks={draftPicks}
            currentIndex={currentIndex}
            onClose={() => setTradeOpen(false)}
            onTrade={(teamA, teamB, teamAAssets, teamBAssets) => {
              setDraftPicks((previous) =>
                previous.map((pick) => {
                  const fromA = teamAAssets.some((asset) => asset.pickOverall === pick.overall)
                  const fromB = teamBAssets.some((asset) => asset.pickOverall === pick.overall)

                  if (fromA) return { ...pick, ownerSlot: teamB }
                  if (fromB) return { ...pick, ownerSlot: teamA }
                  return pick
                })
              )

              const left = teamAAssets.map((asset) => asset.label).join(', ') || 'no picks'
              const right = teamBAssets.map((asset) => asset.label).join(', ') || 'no picks'
              setTradeLog((prev) => [`Team ${teamA} sent ${left} to Team ${teamB} for ${right}`, ...prev])
              setTradeOpen(false)
            }}
          />
        ) : null}

        {importOpen ? (
          <ModalShell onClose={() => setImportOpen(false)} title="Import ADP">
            <p className="text-sm leading-6 text-slate-300">
              Paste one player per line in this format: <span className="font-black text-white">Name, Position, Team, ADP</span>
            </p>
            <textarea
              value={importText}
              onChange={(event) => setImportText(event.target.value)}
              placeholder={'Arch Manning, QB, TEX, 134.2\nTrevor Etienne, RB, CAR, 135.8'}
              className="mt-4 h-56 w-full rounded-2xl border border-slate-700 bg-slate-950 p-4 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
            />
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setImportOpen(false)} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">Cancel</button>
              <button onClick={importPlayers} className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-indigo-300">Use Imported ADP</button>
            </div>
          </ModalShell>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function ArrowLeft({ sizeProxy }: { sizeProxy?: boolean }) {
  return <span className="text-lg leading-none">↶</span>
}

function Control({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="rounded-2xl border border-slate-700 bg-slate-950/70 p-3">
      <p className="mb-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</p>
      {children}
    </label>
  )
}

function StatusCard({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950 p-4">
      <div className="flex items-center gap-2 text-indigo-300">{icon}<span className="text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">{label}</span></div>
      <p className="mt-2 text-lg font-black">{value}</p>
    </div>
  )
}

function PlayerRow({ player, disabled, onPick }: { player: Player; disabled: boolean; onPick: () => void }) {
  return (
    <motion.button
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      disabled={disabled}
      onClick={onPick}
      className={`mb-2 w-full rounded-2xl border p-3 text-left transition ${
        disabled
          ? 'border-slate-800 bg-slate-950/80 opacity-80'
          : 'border-indigo-300/40 bg-indigo-400/10 hover:border-indigo-200 hover:bg-indigo-400/20'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${disabled ? 'bg-slate-800 text-slate-500' : 'bg-indigo-400 text-slate-950'}`}>
          <Plus size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <p className="truncate font-black text-white">{player.name}</p>
            <p className="text-sm font-black text-slate-300">{player.adp}</p>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs font-bold text-slate-500">
            <span className={`h-1.5 w-1.5 rounded-full ${POSITION_DOT[player.position]}`} />
            <span>{player.position}</span>
            <span>{player.team}</span>
            {player.rookie ? <span className="rounded-full bg-violet-400/10 px-2 py-0.5 text-violet-200">R</span> : null}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function ModalShell({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <motion.div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.div initial={{ opacity: 0, scale: 0.96, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 16 }} className="w-full max-w-3xl rounded-[2rem] border border-slate-700 bg-slate-900 p-5 shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-slate-700 pb-4">
          <h2 className="text-2xl font-black">{title}</h2>
          <button onClick={onClose} className="rounded-full bg-slate-950 p-2 text-slate-400 hover:text-white"><X size={20} /></button>
        </div>
        <div className="pt-4">{children}</div>
      </motion.div>
    </motion.div>
  )
}

function TradeModal({
  settings,
  picks,
  currentIndex,
  onClose,
  onTrade,
}: {
  settings: DraftSettings
  picks: Pick[]
  currentIndex: number
  onClose: () => void
  onTrade: (teamA: number, teamB: number, teamAAssets: TradeAsset[], teamBAssets: TradeAsset[]) => void
}) {
  const [teamA, setTeamA] = useState(1)
  const [teamB, setTeamB] = useState(Math.min(2, settings.teams))
  const [teamAAssetKeys, setTeamAAssetKeys] = useState<string[]>([])
  const [teamBAssetKeys, setTeamBAssetKeys] = useState<string[]>([])

  const futureAssets = useMemo(() => {
    return picks
      .filter((pick, index) => index >= currentIndex && !pick.player)
      .map((pick) => ({
        key: `pick-${pick.overall}`,
        label: `${pickLabel(pick)} · Overall ${pick.overall}`,
        type: 'pick' as const,
        pickOverall: pick.overall,
        ownerSlot: pick.ownerSlot,
      }))
  }, [currentIndex, picks])

  const teamAAssets = futureAssets.filter((asset) => asset.ownerSlot === teamA)
  const teamBAssets = futureAssets.filter((asset) => asset.ownerSlot === teamB)

  const selectedA = teamAAssets.filter((asset) => teamAAssetKeys.includes(asset.key))
  const selectedB = teamBAssets.filter((asset) => teamBAssetKeys.includes(asset.key))

  function toggleAsset(key: string, side: 'A' | 'B') {
    if (side === 'A') {
      setTeamAAssetKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
    } else {
      setTeamBAssetKeys((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]))
    }
  }

  return (
    <ModalShell onClose={onClose} title="Mock Trade">
      <div className="grid gap-3 sm:grid-cols-2">
        <Control label="Team A">
          <select value={teamA} onChange={(event) => { setTeamA(Number(event.target.value)); setTeamAAssetKeys([]) }} className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none">
            {Array.from({ length: settings.teams }, (_, index) => index + 1).map((slot) => (
              <option key={slot} value={slot} disabled={slot === teamB}>Team {slot}</option>
            ))}
          </select>
        </Control>
        <Control label="Team B">
          <select value={teamB} onChange={(event) => { setTeamB(Number(event.target.value)); setTeamBAssetKeys([]) }} className="w-full rounded-xl border border-slate-600 bg-slate-950 px-3 py-2 text-sm font-bold text-white outline-none">
            {Array.from({ length: settings.teams }, (_, index) => index + 1).map((slot) => (
              <option key={slot} value={slot} disabled={slot === teamA}>Team {slot}</option>
            ))}
          </select>
        </Control>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <AssetPicker title={`Team ${teamA} sends`} assets={teamAAssets} selected={teamAAssetKeys} onToggle={(key) => toggleAsset(key, 'A')} />
        <AssetPicker title={`Team ${teamB} sends`} assets={teamBAssets} selected={teamBAssetKeys} onToggle={(key) => toggleAsset(key, 'B')} />
      </div>

      <div className="mt-4 rounded-2xl border border-amber-300/20 bg-amber-300/10 p-4 text-sm font-bold leading-6 text-amber-100">
        This only trades unmade draft picks in the mock room. It lets you pause on any pick, move upcoming picks around, and then resume the draft with the new ownership.
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button onClick={onClose} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-700 bg-slate-950 px-4 py-2 text-sm font-black text-slate-200 transition hover:border-slate-500 hover:bg-slate-800">Cancel</button>
        <button
          onClick={() => onTrade(teamA, teamB, selectedA, selectedB)}
          disabled={!selectedA.length && !selectedB.length}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-400 px-4 py-2 text-sm font-black text-slate-950 transition hover:bg-indigo-300 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Execute Trade
        </button>
      </div>
    </ModalShell>
  )
}

function AssetPicker({ title, assets, selected, onToggle }: { title: string; assets: Array<TradeAsset & { ownerSlot: number }>; selected: string[]; onToggle: (key: string) => void }) {
  return (
    <div className="rounded-3xl border border-slate-700 bg-slate-950 p-4">
      <h3 className="font-black">{title}</h3>
      <div className="mt-3 max-h-72 space-y-2 overflow-y-auto pr-1">
        {assets.length ? assets.map((asset) => (
          <button
            key={asset.key}
            onClick={() => onToggle(asset.key)}
            className={`w-full rounded-2xl border px-3 py-2 text-left text-sm font-bold transition ${selected.includes(asset.key) ? 'border-emerald-300 bg-emerald-400/15 text-emerald-100' : 'border-slate-700 bg-slate-900 text-slate-300 hover:border-slate-500'}`}
          >
            {asset.label}
          </button>
        )) : (
          <p className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm font-bold text-slate-500">No future picks available.</p>
        )}
      </div>
    </div>
  )
}
