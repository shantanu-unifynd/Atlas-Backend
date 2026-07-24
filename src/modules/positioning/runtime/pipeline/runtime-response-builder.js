// Stage 5 — Response Builder. Pure assembly of a transient Runtime
// Snapshot. Nothing is persisted, nothing is published.
function build(session, route, provider, position, nearestNode, currentSegment, progress) {
  return {
    sessionId: session.id,
    routeId: route.id,
    provider: provider.getProviderName(),
    position: {
      graphId: position.graphId,
      source: position.source,
      coordinates: position.coordinates,
      recordedAt: position.recordedAt,
    },
    nearestNode: nearestNode ? { id: nearestNode.id, position: nearestNode.position } : null,
    currentSegment: currentSegment || null,
    progress: {
      currentSegment: progress.currentSegment,
      currentNode: progress.currentNode,
      visitedNodes: progress.visitedNodes,
      remainingSegments: progress.remainingSegments,
      remainingDistance: progress.remainingDistance,
      remainingCost: progress.remainingCost,
      progressPercentage: progress.progressPercentage,
      completed: progress.completed,
    },
    updatedAt: new Date().toISOString(),
  };
}

module.exports = { build };
