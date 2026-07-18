export type WRPredictiveMetric = {
  key: string
  label: string
  sourceColumn: string
  correlation: number
  rSquared: number
  sampleSize: number
  usedInModel: boolean
  status?: 'comparison' | 'replaced'
  description: string
}

/**
 * Pearson correlations against following-season fantasy points per game.
 * Values were calculated from the combined FPDS/PFF workbook created from
 * 2021-2024 player-seasons (with following-year FP/G as the target).
 */
export const WR_PREDICTION_CORRELATIONS: WRPredictiveMetric[] = [
  {
    key: 'receivingYardsPerGame',
    label: 'Receiving yards / game',
    sourceColumn: 'RecYDS/G',
    correlation: 0.720,
    rSquared: 0.519,
    sampleSize: 656,
    usedInModel: true,
    description: 'Average receiving yards produced per game in that season.',
  },
  {
    key: 'targetShare',
    label: 'Target share',
    sourceColumn: 'TGT %',
    correlation: 0.673,
    rSquared: 0.453,
    sampleSize: 656,
    usedInModel: true,
    description: 'The percentage of his team’s pass targets earned by the receiver.',
  },
  {
    key: 'firstReadShare',
    label: 'First-read share',
    sourceColumn: '1READ %',
    correlation: 0.668,
    rSquared: 0.446,
    sampleSize: 656,
    usedInModel: true,
    description: 'The share of a player’s routes on which he was the quarterback’s first read.',
  },
  {
    key: 'pffRouteGrade',
    label: 'PFF route grade',
    sourceColumn: 'grades_pass_route',
    correlation: 0.668,
    rSquared: 0.446,
    sampleSize: 641,
    usedInModel: true,
    description: 'PFF’s receiving grade specifically for pass routes.',
  },
  {
    key: 'yprr',
    label: 'Yards per route run',
    sourceColumn: 'YPRR',
    correlation: 0.593,
    rSquared: 0.352,
    sampleSize: 631,
    usedInModel: true,
    description: 'Receiving yards divided by routes run, measuring per-route efficiency.',
  },
  {
    key: 'separationScore',
    label: 'Separation score',
    sourceColumn: 'Sep Score',
    correlation: 0.345,
    rSquared: 0.119,
    sampleSize: 410,
    usedInModel: false,
    status: 'comparison',
    description: 'A comparison metric measuring a receiver’s ability to create separation.',
  },
  {
    key: 'mtfPerReception',
    label: 'Missed tackles / reception',
    sourceColumn: 'MTF/REC',
    correlation: 0.152,
    rSquared: 0.023,
    sampleSize: 497,
    usedInModel: false,
    status: 'replaced',
    description: 'The previous model input. It was replaced by target share after showing much weaker predictive value.',
  },
]

export const WR_CORRELATION_DATASET = {
  target: 'Following-year FP/G',
  predictionSeasons: '2021–2024',
  separationSeasons: '2022–2024',
  method: 'Pearson correlation',
}
