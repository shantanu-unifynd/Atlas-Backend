// Stage 4 — Response Builder. Pure assembly, no persistence, no
// publication, no database writes. `updatedAt` here is a computed
// snapshot timestamp (this progress calculation happened "now"), not a
// write to any stored `updatedAt` column — the same convention as
// Sprint 07's Dijkstra `computedAt` and Sprint 08 Story 05's `validatedAt`.
function build(sessionId, routeId, progress) {
  return {
    sessionId,
    routeId,
    currentSegment: progress.currentSegment,
    currentNode: progress.currentNode,
    visitedNodes: progress.visitedNodes,
    remainingSegments: progress.remainingSegments,
    remainingDistance: progress.remainingDistance,
    remainingCost: progress.remainingCost,
    progressPercentage: progress.progressPercentage,
    completed: progress.completed,
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { build };
