const EPSILON = 0.011;
function setting(settings, key, fallback = 0) {
    const value = Number(settings[key]);
    return Number.isFinite(value) ? value : fallback;
}
function closeEnough(actual, expected) {
    return Math.abs(actual - expected) <= EPSILON;
}
function roundPoints(value) {
    return Math.round(value * 1000) / 1000;
}
function signedPoints(value) {
    return `${value >= 0 ? '+' : ''}${value.toFixed(2)}`;
}
function receiverScore(settings, receptions, yards, touchdowns) {
    return (receptions * setting(settings, 'rec') +
        yards * setting(settings, 'rec_yd', 0.1) +
        touchdowns * setting(settings, 'rec_td', 6));
}
function passerScore(settings, completions, yards, touchdowns) {
    return (completions * setting(settings, 'pass_cmp') +
        yards * setting(settings, 'pass_yd', 0.04) +
        touchdowns * setting(settings, 'pass_td', 4));
}
function rushScore(settings, attempts, yards, touchdowns) {
    return (attempts * setting(settings, 'rush_att') +
        yards * setting(settings, 'rush_yd', 0.1) +
        touchdowns * setting(settings, 'rush_td', 6));
}
function receivingCandidates(delta, settings, maxReceptions = 6) {
    const candidates = [];
    for (let touchdowns = 0; touchdowns <= 3; touchdowns += 1) {
        for (let receptions = 1; receptions <= maxReceptions; receptions += 1) {
            for (let yards = -20; yards <= 300; yards += 1) {
                const score = receiverScore(settings, receptions, yards, touchdowns);
                if (!closeEnough(delta, score))
                    continue;
                candidates.push({
                    receptions,
                    yards,
                    touchdowns,
                    receiverScore: roundPoints(score),
                    passerScore: roundPoints(passerScore(settings, receptions, yards, touchdowns)),
                });
            }
        }
    }
    return candidates
        .sort((a, b) => {
        const aPlays = a.receptions + a.touchdowns * 0.05;
        const bPlays = b.receptions + b.touchdowns * 0.05;
        if (aPlays !== bPlays)
            return aPlays - bPlays;
        if (a.touchdowns !== b.touchdowns)
            return b.touchdowns - a.touchdowns;
        return Math.abs(a.yards) - Math.abs(b.yards);
    })
        .slice(0, 30);
}
function rushingCandidates(delta, settings, maxAttempts = 6) {
    const candidates = [];
    for (let touchdowns = 0; touchdowns <= 3; touchdowns += 1) {
        for (let attempts = 1; attempts <= maxAttempts; attempts += 1) {
            for (let yards = -20; yards <= 300; yards += 1) {
                const score = rushScore(settings, attempts, yards, touchdowns);
                if (!closeEnough(delta, score))
                    continue;
                candidates.push({
                    attempts,
                    yards,
                    touchdowns,
                    score: roundPoints(score),
                });
            }
        }
    }
    return candidates
        .sort((a, b) => {
        if (a.attempts !== b.attempts)
            return a.attempts - b.attempts;
        if (a.touchdowns !== b.touchdowns)
            return b.touchdowns - a.touchdowns;
        return Math.abs(a.yards) - Math.abs(b.yards);
    })
        .slice(0, 30);
}
function describeReception(candidate) {
    const touchdown = candidate.touchdowns > 0;
    const receptionWord = candidate.receptions === 1 ? 'reception' : 'receptions';
    if (candidate.receptions === 1) {
        return `${candidate.yards}-yard ${touchdown ? 'touchdown ' : ''}reception`;
    }
    return `${candidate.receptions} ${receptionWord}, ${candidate.yards} yards${touchdown ? `, ${candidate.touchdowns} TD${candidate.touchdowns === 1 ? '' : 's'}` : ''}`;
}
function describeRush(candidate) {
    const touchdown = candidate.touchdowns > 0;
    if (candidate.attempts === 1) {
        return `${candidate.yards}-yard ${touchdown ? 'touchdown ' : ''}rush`;
    }
    return `${candidate.attempts} carries, ${candidate.yards} yards${touchdown ? `, ${candidate.touchdowns} TD${candidate.touchdowns === 1 ? '' : 's'}` : ''}`;
}
function makeGenericEvent(player) {
    return {
        eventType: 'scoring_update',
        description: `Fantasy scoring update (${signedPoints(player.delta)})`,
        primary: player,
        primaryFantasyDelta: player.delta,
        confidence: 'low',
        isAggregate: true,
        isCorrection: false,
        metadata: {
            reason: 'No unique core-stat solution matched the fantasy-point change.',
            before: player.before,
            after: player.after,
        },
    };
}
function inferNegativeEvent(player, settings) {
    const position = String(player.position || '').toUpperCase();
    const interception = setting(settings, 'pass_int', -2);
    const fumbleLost = setting(settings, 'fum_lost', -2);
    if (position === 'QB' && interception < 0 && closeEnough(player.delta, interception)) {
        return {
            eventType: 'turnover',
            description: 'Interception thrown',
            primary: player,
            primaryFantasyDelta: player.delta,
            confidence: 'medium',
            isAggregate: false,
            isCorrection: false,
            metadata: { before: player.before, after: player.after },
        };
    }
    if (fumbleLost < 0 && closeEnough(player.delta, fumbleLost)) {
        return {
            eventType: 'turnover',
            description: 'Fumble lost',
            primary: player,
            primaryFantasyDelta: player.delta,
            confidence: 'medium',
            isAggregate: false,
            isCorrection: false,
            metadata: { before: player.before, after: player.after },
        };
    }
    return {
        eventType: 'stat_correction',
        description: `Stat correction (${signedPoints(player.delta)})`,
        primary: player,
        primaryFantasyDelta: player.delta,
        confidence: 'low',
        isAggregate: false,
        isCorrection: true,
        metadata: { before: player.before, after: player.after },
    };
}
function inferKickerEvent(player, settings) {
    const extraPoint = setting(settings, 'xpm', 1);
    if (extraPoint !== 0 && closeEnough(player.delta, extraPoint)) {
        return {
            eventType: 'extra_point',
            description: 'Extra point made',
            primary: player,
            primaryFantasyDelta: player.delta,
            confidence: 'high',
            isAggregate: false,
            isCorrection: false,
            metadata: { before: player.before, after: player.after },
        };
    }
    const fieldGoalBuckets = [
        ['fgm_0_19', 'Field goal made (0–19 yards)'],
        ['fgm_20_29', 'Field goal made (20–29 yards)'],
        ['fgm_30_39', 'Field goal made (30–39 yards)'],
        ['fgm_40_49', 'Field goal made (40–49 yards)'],
        ['fgm_50p', 'Field goal made (50+ yards)'],
    ];
    const matches = fieldGoalBuckets.filter(([key]) => {
        const points = setting(settings, key);
        return points !== 0 && closeEnough(player.delta, points);
    });
    if (matches.length === 1) {
        return {
            eventType: 'field_goal',
            description: matches[0][1],
            primary: player,
            primaryFantasyDelta: player.delta,
            confidence: 'high',
            isAggregate: false,
            isCorrection: false,
            metadata: { before: player.before, after: player.after },
        };
    }
    return null;
}
function findPassCombination(receivers, quarterbackDelta, settings) {
    const candidateSets = receivers.map((receiver) => receivingCandidates(receiver.delta, settings));
    if (candidateSets.some((set) => set.length === 0))
        return null;
    let visited = 0;
    const maxVisited = 30_000;
    const selected = [];
    function search(index, accumulatedPassPoints) {
        if (visited >= maxVisited)
            return false;
        visited += 1;
        if (index === candidateSets.length) {
            return closeEnough(accumulatedPassPoints, quarterbackDelta);
        }
        for (const candidate of candidateSets[index]) {
            selected[index] = candidate;
            if (search(index + 1, accumulatedPassPoints + candidate.passerScore)) {
                return true;
            }
        }
        return false;
    }
    return search(0, 0) ? [...selected] : null;
}
function findBestPassGroup(receivers, quarterbackDelta, settings) {
    if (!receivers.length)
        return null;
    const capped = receivers.slice(0, 8);
    let best = null;
    for (let mask = 1; mask < 1 << capped.length; mask += 1) {
        const subset = capped.filter((_, index) => Boolean(mask & (1 << index)));
        if (best && subset.length < best.receivers.length)
            continue;
        const candidates = findPassCombination(subset, quarterbackDelta, settings);
        if (!candidates)
            continue;
        if (!best || subset.length > best.receivers.length) {
            best = { receivers: subset, candidates };
        }
    }
    return best;
}
function inferTeamPositiveEvents(players, settings, teamContext) {
    const events = [];
    const used = new Set();
    const quarterbacks = players.filter((player) => String(player.position || '').toUpperCase() === 'QB');
    const receivers = players.filter((player) => ['RB', 'WR', 'TE'].includes(String(player.position || '').toUpperCase()));
    // First solve all same-team receiving changes against one quarterback change.
    if (quarterbacks.length === 1 && receivers.length > 0) {
        const quarterback = quarterbacks[0];
        const passGroup = findBestPassGroup(receivers, quarterback.delta, settings);
        if (passGroup) {
            passGroup.receivers.forEach((receiver, index) => {
                const candidate = passGroup.candidates[index];
                const aggregate = passGroup.receivers.length > 1 || candidate.receptions > 1;
                events.push({
                    eventType: 'reception',
                    description: describeReception(candidate),
                    primary: receiver,
                    secondary: quarterback,
                    primaryFantasyDelta: receiver.delta,
                    secondaryFantasyDelta: candidate.passerScore,
                    inferredYards: candidate.yards,
                    inferredReceptions: candidate.receptions,
                    inferredTouchdowns: candidate.touchdowns,
                    confidence: aggregate ? 'medium' : 'high',
                    isAggregate: aggregate,
                    isCorrection: false,
                    metadata: {
                        before: receiver.before,
                        after: receiver.after,
                        quarterback_before: quarterback.before,
                        quarterback_after: quarterback.after,
                        grouped_receiver_count: passGroup.receivers.length,
                    },
                });
                used.add(receiver.id);
            });
            used.add(quarterback.id);
        }
    }
    // Solve remaining skill-position changes. A receiver without a rostered QB can
    // still be inferred, but confidence is lower because rush/receiving ambiguity exists.
    for (const player of receivers) {
        if (used.has(player.id))
            continue;
        const position = String(player.position || '').toUpperCase();
        const recCandidate = receivingCandidates(player.delta, settings)[0];
        const rushCandidate = rushingCandidates(player.delta, settings)[0];
        const observedQuarterback = teamContext.some((contextPlayer) => String(contextPlayer.position || '').toUpperCase() === 'QB' &&
            contextPlayer.id !== player.id);
        const changingQuarterback = quarterbacks.some((quarterback) => !used.has(quarterback.id));
        if (rushCandidate && observedQuarterback && !changingQuarterback) {
            events.push({
                eventType: 'rush',
                description: describeRush(rushCandidate),
                primary: player,
                primaryFantasyDelta: player.delta,
                inferredYards: rushCandidate.yards,
                inferredReceptions: 0,
                inferredTouchdowns: rushCandidate.touchdowns,
                confidence: rushCandidate.attempts === 1 ? 'high' : 'medium',
                isAggregate: rushCandidate.attempts > 1,
                isCorrection: false,
                metadata: {
                    before: player.before,
                    after: player.after,
                    same_team_quarterback_observed_without_point_change: true,
                },
            });
            used.add(player.id);
            continue;
        }
        if (recCandidate && ['WR', 'TE'].includes(position)) {
            events.push({
                eventType: 'reception',
                description: describeReception(recCandidate),
                primary: player,
                primaryFantasyDelta: player.delta,
                inferredYards: recCandidate.yards,
                inferredReceptions: recCandidate.receptions,
                inferredTouchdowns: recCandidate.touchdowns,
                confidence: recCandidate.receptions === 1 ? 'medium' : 'low',
                isAggregate: recCandidate.receptions > 1,
                isCorrection: false,
                metadata: {
                    before: player.before,
                    after: player.after,
                    passer_not_observed: true,
                },
            });
            used.add(player.id);
            continue;
        }
        if (rushCandidate && !recCandidate) {
            events.push({
                eventType: 'rush',
                description: describeRush(rushCandidate),
                primary: player,
                primaryFantasyDelta: player.delta,
                inferredYards: rushCandidate.yards,
                inferredReceptions: 0,
                inferredTouchdowns: rushCandidate.touchdowns,
                confidence: rushCandidate.attempts === 1 ? 'medium' : 'low',
                isAggregate: rushCandidate.attempts > 1,
                isCorrection: false,
                metadata: { before: player.before, after: player.after },
            });
            used.add(player.id);
            continue;
        }
        // Running backs often have exact rush and reception solutions. Do not claim
        // a specific play type unless the quarterback delta resolves the ambiguity.
        events.push(makeGenericEvent(player));
        used.add(player.id);
    }
    for (const quarterback of quarterbacks) {
        if (used.has(quarterback.id))
            continue;
        events.push({
            ...makeGenericEvent(quarterback),
            description: `Passing/rushing scoring update (${signedPoints(quarterback.delta)})`,
            metadata: {
                before: quarterback.before,
                after: quarterback.after,
                passing_or_rushing_ambiguous: true,
            },
        });
        used.add(quarterback.id);
    }
    for (const player of players) {
        if (used.has(player.id))
            continue;
        const position = String(player.position || '').toUpperCase();
        if (position === 'K') {
            const kickerEvent = inferKickerEvent(player, settings);
            events.push(kickerEvent || makeGenericEvent(player));
        }
        else if (['DEF', 'DST'].includes(position) || player.id.length <= 4) {
            events.push({
                eventType: 'defense',
                description: `Team defense scoring update (${signedPoints(player.delta)})`,
                primary: player,
                primaryFantasyDelta: player.delta,
                confidence: 'low',
                isAggregate: true,
                isCorrection: false,
                metadata: { before: player.before, after: player.after },
            });
        }
        else {
            events.push(makeGenericEvent(player));
        }
    }
    return events;
}
export function inferGameFeedEvents(deltas, settings, contextPlayers = deltas) {
    const meaningful = deltas.filter((player) => Math.abs(player.delta) >= 0.005);
    const events = [];
    for (const player of meaningful.filter((entry) => entry.delta < 0)) {
        events.push(inferNegativeEvent(player, settings));
    }
    const positive = meaningful.filter((entry) => entry.delta > 0);
    const byTeam = new Map();
    for (const player of positive) {
        const key = player.team || `unknown:${player.id}`;
        if (!byTeam.has(key))
            byTeam.set(key, []);
        byTeam.get(key)?.push(player);
    }
    for (const teamPlayers of byTeam.values()) {
        const teamKey = teamPlayers[0]?.team || `unknown:${teamPlayers[0]?.id || ''}`;
        const teamContext = contextPlayers.filter((player) => (player.team || `unknown:${player.id}`) === teamKey);
        events.push(...inferTeamPositiveEvents(teamPlayers, settings, teamContext));
    }
    return events;
}
