// Stage 5 — Conflict Resolver.
// Sorts each USO's rule matches by priority (highest wins) and records every
// discarded match with a reason — conflicts are never silently dropped.
// A USO with zero matches simply has no winner; that is not a conflict.

function resolveConflicts(ruleExecutions) {
  return ruleExecutions.map(({ usoId, matches }) => {
    if (matches.length === 0) {
      return { usoId, winningMatch: null, discardedMatches: [], conflictDetected: false };
    }

    const sorted = [...matches].sort((a, b) => b.priority - a.priority);
    const [winningMatch, ...rest] = sorted;

    const discardedMatches = rest.map((match) => ({
      ruleId: match.ruleId,
      ruleName: match.ruleName,
      priority: match.priority,
      classification: match.classification,
      reason: `Lower priority than winning rule '${winningMatch.ruleId}' (${match.priority} < ${winningMatch.priority})`,
    }));

    return {
      usoId,
      winningMatch,
      discardedMatches,
      conflictDetected: matches.length > 1,
    };
  });
}

module.exports = {
  resolveConflicts,
};
