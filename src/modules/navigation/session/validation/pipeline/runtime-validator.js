const COST_EPSILON = 1e-9;

const SUPPORTED_EVENT_TYPES = new Set([
  "SessionStarted",
  "SegmentEntered",
  "SegmentCompleted",
  "NodeReached",
  "FloorChanged",
  "DestinationReached",
  "SessionCancelled",
]);

const CANONICAL_ORDER = [
  "SessionStarted",
  "SegmentEntered",
  "SegmentCompleted",
  "NodeReached",
  "FloorChanged",
  "DestinationReached",
  "SessionCancelled",
];

// Stage 2 — Runtime Validator. Pure function: no Prisma, no repositories,
// no HTTP. Independently re-checks what Story 03's Progress Engine and
// Story 04's Event Engine already returned — defense in depth, exactly
// like every previous sprint's final validation story (Sprint 06 Story 05,
// Sprint 07 Story 05, Sprint 08 Story 05). Never re-validates the
// Navigation Graph, Route, or RoutingContext domains — those already have
// their own validation stories.
function validate(session, progress, eventsResult) {
  const errors = [];
  const warnings = [];

  // Lifecycle state consistency.
  if (session.state !== "ACTIVE") {
    errors.push(`Session state '${session.state}' is inconsistent with an in-progress runtime`);
  }

  // Progress consistency.
  if (!progress.currentNode) {
    errors.push("Current node does not exist");
  }

  if (!progress.currentSegment) {
    errors.push("Current segment does not exist");
  }

  if (!Array.isArray(progress.visitedNodes) || progress.visitedNodes.length === 0) {
    errors.push("Visited nodes are missing or empty");
  } else {
    const uniqueVisited = new Set(progress.visitedNodes);

    if (uniqueVisited.size !== progress.visitedNodes.length) {
      errors.push("Visited nodes contain duplicates");
    }

    if (progress.visitedNodes[progress.visitedNodes.length - 1] !== progress.currentNode) {
      errors.push("Visited nodes do not end at the current node");
    }
  }

  if (!Number.isInteger(progress.remainingSegments) || progress.remainingSegments < 0) {
    errors.push(`remainingSegments (${progress.remainingSegments}) is not a valid non-negative integer`);
  } else if (progress.completed && progress.remainingSegments !== 0) {
    errors.push("Completed progress reports non-zero remainingSegments");
  }

  if (typeof progress.remainingCost !== "number" || !Number.isFinite(progress.remainingCost) || progress.remainingCost < 0) {
    errors.push(`remainingCost (${progress.remainingCost}) is not a valid non-negative finite number`);
  } else if (progress.completed && Math.abs(progress.remainingCost) > COST_EPSILON) {
    errors.push("Completed progress reports non-zero remainingCost");
  }

  if (
    typeof progress.remainingDistance !== "number" ||
    !Number.isFinite(progress.remainingDistance) ||
    progress.remainingDistance < 0
  ) {
    errors.push(`remainingDistance (${progress.remainingDistance}) is not a valid non-negative finite number`);
  } else if (progress.completed && Math.abs(progress.remainingDistance) > COST_EPSILON) {
    errors.push("Completed progress reports non-zero remainingDistance");
  }

  if (
    typeof progress.progressPercentage !== "number" ||
    progress.progressPercentage < 0 ||
    progress.progressPercentage > 100
  ) {
    errors.push(`progressPercentage (${progress.progressPercentage}) is out of range [0, 100]`);
  } else {
    const isAt100 = Math.abs(progress.progressPercentage - 100) < COST_EPSILON;

    if (progress.completed && !isAt100) {
      errors.push(`Completed progress does not report 100% (got ${progress.progressPercentage})`);
    }

    if (!progress.completed && isAt100) {
      errors.push("Progress reports 100% but is not marked completed");
    }
  }

  // Events internally valid.
  const { events } = eventsResult;

  events.forEach((event) => {
    if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
      errors.push(`Unsupported event type '${event.type}'`);
    }

    if (event.sessionId !== progress.sessionId) {
      errors.push(`Event '${event.type}' references a different session ('${event.sessionId}')`);
    }

    if (event.routeId !== progress.routeId) {
      errors.push(`Event '${event.type}' references a different route ('${event.routeId}')`);
    }
  });

  const seenTypes = new Set();
  events.forEach((event) => {
    if (seenTypes.has(event.type)) {
      errors.push(`Duplicate event type '${event.type}' in the same batch`);
    }
    seenTypes.add(event.type);
  });

  const indices = events.map((event) => CANONICAL_ORDER.indexOf(event.type));

  for (let i = 0; i < indices.length - 1; i += 1) {
    if (indices[i] > indices[i + 1]) {
      errors.push(
        `Event ordering violated: '${events[i].type}' appears before '${events[i + 1].type}' out of canonical order`
      );
    }
  }

  const hasDestinationReached = events.some((event) => event.type === "DestinationReached");

  if (hasDestinationReached && !progress.completed) {
    errors.push("DestinationReached emitted but progress is not completed");
  }

  const hasSessionCancelled = events.some((event) => event.type === "SessionCancelled");

  if (hasSessionCancelled && session.state !== "CANCELLED") {
    errors.push("SessionCancelled emitted but session state is not CANCELLED");
  }

  const statistics = {
    totalEvents: events.length,
    eventTypeCounts: eventsResult.statistics ? eventsResult.statistics.eventTypeCounts : {},
    progressPercentage: progress.progressPercentage,
    remainingSegments: progress.remainingSegments,
    completed: progress.completed,
  };

  return { errors, warnings, statistics };
}

module.exports = { validate, SUPPORTED_EVENT_TYPES, CANONICAL_ORDER };
