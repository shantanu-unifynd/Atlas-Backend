// Stage 2 — Event Engine. Pure: no Prisma, no repositories, no HTTP.
// Derives a deterministic events[] list from the current progress snapshot
// (and session.state, needed only to recognize SessionCancelled) — never
// mutates, persists, or publishes anything.
//
// FloorChanged is part of the supported catalog but is never emitted here:
// no per-node/per-segment floor identifier exists anywhere in the reused
// Route/RouteSegment/NavigationGraph data (floor is one-per-graph, not
// one-per-hop). Emitting it would mean inventing floor-transition data
// that doesn't exist — forbidden by this story's scope. The event type and
// its validator rule remain real and unit-testable; see Known Limitations.
const EVENT_TYPES = {
  SESSION_STARTED: "SessionStarted",
  SEGMENT_ENTERED: "SegmentEntered",
  SEGMENT_COMPLETED: "SegmentCompleted",
  NODE_REACHED: "NodeReached",
  FLOOR_CHANGED: "FloorChanged",
  DESTINATION_REACHED: "DestinationReached",
  SESSION_CANCELLED: "SessionCancelled",
};

function generateEvents(session, progress, generatedAt) {
  const events = [];
  const { sessionId, routeId, currentSegment, currentNode, progressPercentage, completed } = progress;

  function pushEvent(type, metadata) {
    events.push({ type, timestamp: generatedAt, sessionId, routeId, metadata });
  }

  if (session.state === "CANCELLED") {
    pushEvent(EVENT_TYPES.SESSION_CANCELLED, {});
    return events;
  }

  // Reaching here via the live pipeline implies the session is ACTIVE,
  // which is only reachable after Story 02's START transition — so
  // SessionStarted is always valid to report on every successful call.
  pushEvent(EVENT_TYPES.SESSION_STARTED, {});

  if (currentSegment) {
    pushEvent(EVENT_TYPES.SEGMENT_ENTERED, {
      segmentId: currentSegment.id,
      sourceNodeId: currentSegment.sourceNodeId,
      targetNodeId: currentSegment.targetNodeId,
      sequence: currentSegment.sequence,
    });

    pushEvent(EVENT_TYPES.SEGMENT_COMPLETED, {
      segmentId: currentSegment.id,
      sourceNodeId: currentSegment.sourceNodeId,
      targetNodeId: currentSegment.targetNodeId,
      sequence: currentSegment.sequence,
    });

    pushEvent(EVENT_TYPES.NODE_REACHED, {
      nodeId: currentNode,
    });
  }

  if (completed) {
    pushEvent(EVENT_TYPES.DESTINATION_REACHED, {
      nodeId: currentNode,
      progressPercentage,
    });
  }

  return events;
}

module.exports = { generateEvents, EVENT_TYPES };
