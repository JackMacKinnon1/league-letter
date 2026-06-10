import Link from '@/components/NoPrefetchLink'

export default function TransactionCard({
  transaction,
  sleeperPlayers,
  teamByRosterId,
  highlight = false,
}: {
  transaction: any
  sleeperPlayers: Record<string, any>
  teamByRosterId: Map<number, any>
  highlight?: boolean
}) {
  if (transaction.type === 'trade') {
    return (
      <TradeTransactionCard
        transaction={transaction}
        sleeperPlayers={sleeperPlayers}
        teamByRosterId={teamByRosterId}
        highlight={highlight}
      />
    )
  }

  return (
    <FreeAgentTransactionCard
      transaction={transaction}
      sleeperPlayers={sleeperPlayers}
      teamByRosterId={teamByRosterId}
      highlight={highlight}
    />
  )
}

function FreeAgentTransactionCard({
  transaction,
  sleeperPlayers,
  teamByRosterId,
  highlight,
}: {
  transaction: any
  sleeperPlayers: Record<string, any>
  teamByRosterId: Map<number, any>
  highlight: boolean
}) {
  const rosterId =
    transaction.roster_ids && transaction.roster_ids.length
      ? Number(transaction.roster_ids[0])
      : null

  const team = rosterId ? teamByRosterId.get(rosterId) : null

  const adds = transaction.adds
    ? Object.keys(transaction.adds).map((playerId) =>
        getPlayerName(playerId, sleeperPlayers)
      )
    : []

  const drops = transaction.drops
    ? Object.keys(transaction.drops).map((playerId) =>
        getPlayerName(playerId, sleeperPlayers)
      )
    : []

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-4 ${highlight ? 'transaction-gold-glow' : ''}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
        {formatTransactionType(transaction.type)} · Week {transaction.week}
      </p>

      {team ? (
        <Link
          href={`/league/${transaction.league_id}/teams/${team.id}`}
          className="mt-2 block font-black hover:text-emerald-400"
        >
          {team.team_name}
        </Link>
      ) : (
        <h3 className="mt-2 font-black">Unknown Team</h3>
      )}

      <div className="mt-3 space-y-1 text-sm">
        {adds.map((name) => (
          <p key={`add-${name}`} className="font-bold text-emerald-400">
            +{name}
          </p>
        ))}

        {drops.map((name) => (
          <p key={`drop-${name}`} className="font-bold text-red-300">
            -{name}
          </p>
        ))}

        {!adds.length && !drops.length && (
          <p className="text-zinc-400">
            {transaction.status || 'Transaction completed'}
          </p>
        )}
      </div>
    </div>
  )
}

function TradeTransactionCard({
  transaction,
  sleeperPlayers,
  teamByRosterId,
  highlight,
}: {
  transaction: any
  sleeperPlayers: Record<string, any>
  teamByRosterId: Map<number, any>
  highlight: boolean
}) {
  const rosterIds: number[] = transaction.roster_ids || []

  const columns = rosterIds.map((rosterId) => {
    const team = teamByRosterId.get(Number(rosterId))

    const receivedPlayers = transaction.adds
      ? Object.entries(transaction.adds)
          .filter(([, receivingRosterId]) => Number(receivingRosterId) === Number(rosterId))
          .map(([playerId]) => getPlayerName(playerId, sleeperPlayers))
      : []

    const lostPlayers = transaction.drops
      ? Object.entries(transaction.drops)
          .filter(([, losingRosterId]) => Number(losingRosterId) === Number(rosterId))
          .map(([playerId]) => getPlayerName(playerId, sleeperPlayers))
      : []

    const receivedPicks = getReceivedPicksForRoster(
      transaction.draft_picks,
      Number(rosterId),
      teamByRosterId
    )

    const lostPicks = getLostPicksForRoster(
      transaction.draft_picks,
      Number(rosterId),
      teamByRosterId
    )

    return {
      rosterId,
      team,
      teamName: team?.team_name || `Roster ${rosterId}`,
      receivedPlayers,
      lostPlayers,
      receivedPicks,
      lostPicks,
    }
  })

  return (
    <div className={`rounded-2xl border border-zinc-800 bg-zinc-950 p-4 ${highlight ? 'transaction-gold-glow' : ''}`}>
      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">
        Trade · Week {transaction.week}
      </p>

      <div
        className={`mt-4 grid gap-4 ${
          columns.length === 2 ? 'grid-cols-2' : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {columns.map((column) => (
          <div key={column.rosterId}>
            {column.team ? (
              <Link
                href={`/league/${transaction.league_id}/teams/${column.team.id}`}
                className="block border-b border-zinc-800 pb-2 text-lg font-black hover:text-emerald-400"
              >
                {column.teamName}
              </Link>
            ) : (
              <h3 className="border-b border-zinc-800 pb-2 text-lg font-black">
                {column.teamName}
              </h3>
            )}

            <div className="mt-3 space-y-1 text-sm">
              {column.receivedPlayers.map((name) => (
                <p
                  key={`received-player-${column.rosterId}-${name}`}
                  className="font-bold text-emerald-400"
                >
                  +{name}
                </p>
              ))}

              {column.receivedPicks.map((pick, index) => (
                <p
                  key={`received-pick-${column.rosterId}-${index}`}
                  className="font-bold text-emerald-400"
                >
                  +{pick}
                </p>
              ))}

              {(column.receivedPlayers.length > 0 ||
                column.receivedPicks.length > 0) &&
                (column.lostPlayers.length > 0 ||
                  column.lostPicks.length > 0) && <div className="py-1" />}

              {column.lostPlayers.map((name) => (
                <p
                  key={`lost-player-${column.rosterId}-${name}`}
                  className="font-bold text-red-300"
                >
                  -{name}
                </p>
              ))}

              {column.lostPicks.map((pick, index) => (
                <p
                  key={`lost-pick-${column.rosterId}-${index}`}
                  className="font-bold text-red-300"
                >
                  -{pick}
                </p>
              ))}

              {!column.receivedPlayers.length &&
                !column.lostPlayers.length &&
                !column.receivedPicks.length &&
                !column.lostPicks.length && (
                  <p className="text-zinc-400">No assets found</p>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function getPlayerName(playerId: string, sleeperPlayers: Record<string, any>) {
  const player = sleeperPlayers[playerId]

  if (!player) return playerId

  const fullName = `${player.first_name || ''} ${player.last_name || ''}`.trim()

  return fullName || player.full_name || playerId
}

function getReceivedPicksForRoster(
  draftPicks: any[] | null,
  rosterId: number,
  teamByRosterId: Map<number, any>
) {
  if (!draftPicks?.length) return []

  return draftPicks
    .filter((pick) => Number(pick.owner_id) === Number(rosterId))
    .map((pick) => formatDraftPick(pick, teamByRosterId))
}

function getLostPicksForRoster(
  draftPicks: any[] | null,
  rosterId: number,
  teamByRosterId: Map<number, any>
) {
  if (!draftPicks?.length) return []

  return draftPicks
    .filter((pick) => Number(pick.previous_owner_id) === Number(rosterId))
    .map((pick) => formatDraftPick(pick, teamByRosterId))
}

function formatDraftPick(pick: any, teamByRosterId: Map<number, any>) {
  const season = pick.season || ''
  const round = pick.round ? `Round ${pick.round}` : 'Pick'
  const originalOwnerRosterId = pick.roster_id ? Number(pick.roster_id) : null
  const originalOwnerTeam = originalOwnerRosterId
    ? teamByRosterId.get(originalOwnerRosterId)
    : null
  const originalOwnerName = originalOwnerTeam?.team_name || originalOwnerTeam?.owner_name
  const originalOwner = originalOwnerRosterId
    ? `from ${originalOwnerName || `Roster ${originalOwnerRosterId}`}`
    : ''

  return `${season} ${round}${originalOwner ? ` ${originalOwner}` : ''}`.trim()
}

function formatTransactionType(type: string) {
  if (type === 'waiver') return 'Waiver'
  if (type === 'free_agent') return 'Free Agent'
  if (type === 'trade') return 'Trade'
  return type
}