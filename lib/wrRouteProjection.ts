import {
  getRouteVolume,
  getStatValue,
  normalizeRate,
  toStatNumber,
  type PlayerSeasonStatRow,
} from '@/lib/playerScoreStats'

export type WRRouteProjection = {
  sourceRoutes: number
  benchmarkRoutes: number
  routeSource: 'column' | 'derived'
  benchmarkRouteSource: 'column' | 'derived'
  actual: Record<'targets' | 'receptions' | 'yards' | 'touchdowns', number | null>
  projected: Record<'targets' | 'receptions' | 'yards' | 'touchdowns', number | null>
  rates: Record<'targets' | 'receptions' | 'yards' | 'touchdowns', number | null>
}

export function calculateWRRouteProjection(
  sourceRow: PlayerSeasonStatRow | null,
  benchmarkRow: PlayerSeasonStatRow | null,
): WRRouteProjection | null {
  const sourceRouteVolume = getRouteVolume(sourceRow)
  const benchmarkRouteVolume = getRouteVolume(benchmarkRow)
  const sourceRoutes = sourceRouteVolume.routes
  const benchmarkRoutes = benchmarkRouteVolume.routes

  if (!sourceRoutes || !benchmarkRoutes || !sourceRouteVolume.source || !benchmarkRouteVolume.source) return null

  const actualTargets = toStatNumber(getStatValue(sourceRow, ['TGT', 'Targets']))
  const actualReceptions = toStatNumber(getStatValue(sourceRow, ['REC', 'Receptions']))
  const actualYards = toStatNumber(getStatValue(sourceRow, ['YDS', 'Receiving Yards', 'Rec Yards']))
  const actualTouchdowns = toStatNumber(getStatValue(sourceRow, ['TD', 'TDs', 'Receiving TD']))

  const tprr = normalizeRate(toStatNumber(getStatValue(sourceRow, ['TPRR', 'Targets Per Route Run'])))
  const yprr = toStatNumber(getStatValue(sourceRow, ['YPRR', 'Yards Per Route Run']))

  const rates = {
    targets: actualTargets !== null ? actualTargets / sourceRoutes : tprr,
    receptions: actualReceptions !== null ? actualReceptions / sourceRoutes : null,
    yards: yprr !== null ? yprr : actualYards !== null ? actualYards / sourceRoutes : null,
    touchdowns: actualTouchdowns !== null ? actualTouchdowns / sourceRoutes : null,
  }

  return {
    sourceRoutes,
    benchmarkRoutes,
    routeSource: sourceRouteVolume.source,
    benchmarkRouteSource: benchmarkRouteVolume.source,
    actual: {
      targets: actualTargets,
      receptions: actualReceptions,
      yards: actualYards,
      touchdowns: actualTouchdowns,
    },
    rates,
    projected: {
      targets: rates.targets !== null ? rates.targets * benchmarkRoutes : null,
      receptions: rates.receptions !== null ? rates.receptions * benchmarkRoutes : null,
      yards: rates.yards !== null ? rates.yards * benchmarkRoutes : null,
      touchdowns: rates.touchdowns !== null ? rates.touchdowns * benchmarkRoutes : null,
    },
  }
}
