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
// no HTTP. Validates the complete Positioning Runtime — Provider output,
// Walking Engine structural consistency, Runtime node/segment resolution,
// Progress, Events, and cross-module consistency — never re-validates
// NavigationGraph, Route generation, Preference Routing, or
// NavigationSession lifecycle (those have their own validation stories).
function hasUsableObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function validate(session, runtimeSnapshot, runtimeError, eventsResult) {
  const errors = [];
  const warnings = [];

  if (runtimeError) {
    errors.push(runtimeError);

    return {
      errors,
      warnings,
      statistics: {
        providerName: null,
        progressPercentage: null,
        remainingSegments: null,
        completed: null,
        totalEvents: 0,
      },
    };
  }

  const { position, nearestNode, currentSegment, progress } = runtimeSnapshot;

  // --- Provider rules ---
  if (!runtimeSnapshot.provider) {
    errors.push("Provider does not exist");
  }

  if (!hasUsableObject(position)) {
    errors.push("Provider output is not a valid shape");
  } else {
    if (!position.graphId) {
      errors.push("Provider output is missing graphId");
    }

    if (!position.source) {
      errors.push("Provider output is missing a valid source");
    }

    if (
      !hasUsableObject(position.coordinates) ||
      Object.keys(position.coordinates).length === 0
    ) {
      errors.push("Provider output is missing valid coordinates");
    }

    if (!position.recordedAt) {
      errors.push("Provider output is missing a timestamp");
    }
  }

  // --- Runtime rules ---
  if (!nearestNode) {
    errors.push("Nearest node does not exist");
  }

  let totalSegments = null;

  if (currentSegment) {
    if (
      !currentSegment.id ||
      !currentSegment.sourceNodeId ||
      !currentSegment.targetNodeId ||
      typeof currentSegment.sequence !== "number"
    ) {
      errors.push("Current segment is not a valid shape");
    } else if (currentSegment.sequence < 1) {
      errors.push("Current segment does not belong to the route (invalid sequence)");
    } else {
      totalSegments = currentSegment.sequence + progress.remainingSegments;
    }
  } else {
    totalSegments = progress.remainingSegments;
  }

  if (nearestNode && progress && progress.currentNode !== nearestNode.id) {
    errors.push(
      `Current node '${progress.currentNode}' does not match the Runtime's nearest resolved node '${nearestNode.id}'`
    );
  }

  // --- Progress rules ---
  if (
    typeof progress.progressPercentage !== "number" ||
    progress.progressPercentage < 0 ||
    progress.progressPercentage > 100
  ) {
    errors.push(`progressPercentage (${progress.progressPercentage}) is out of range [0, 100]`);
  }

  if (!Number.isInteger(progress.remainingSegments) || progress.remainingSegments < 0) {
    errors.push(`remainingSegments (${progress.remainingSegments}) is not a valid non-negative integer`);
  }

  if (
    typeof progress.remainingCost !== "number" ||
    !Number.isFinite(progress.remainingCost) ||
    progress.remainingCost < 0
  ) {
    errors.push(`remainingCost (${progress.remainingCost}) is not a valid non-negative finite number`);
  }

  const isAt100 = Math.abs(progress.progressPercentage - 100) < COST_EPSILON;

  if (progress.completed && !isAt100) {
    errors.push("Completed progress does not report 100%");
  }

  if (!progress.completed && isAt100) {
    errors.push("Progress reports 100% but is not marked completed");
  }

  // --- Walking Engine structural consistency (no skipped segments) —
  // true determinism/no-backwards-movement/clamping/session-isolation are
  // behavioral properties of a SEQUENCE of calls over time, verified
  // directly against the pure walking-engine.js via unit tests, not
  // derivable from a single snapshot.
  //
  // `currentSegment.sequence` and `remainingSegments` alone cannot detect
  // a skipped segment: totalSegments = sequence + remainingSegments is
  // tautological when derived from those same two values. Cross-checking
  // against `progressPercentage` — computed independently by the engine
  // from the same completed/total ratio — gives a genuine, independently
  // falsifiable consistency check.
  if (totalSegments !== null && totalSegments > 0) {
    const completedSegmentCount = currentSegment ? currentSegment.sequence : 0;
    const expectedPercentage = (completedSegmentCount / totalSegments) * 100;

    if (Math.abs(expectedPercentage - progress.progressPercentage) > COST_EPSILON) {
      errors.push(
        `Walking Engine step (${completedSegmentCount}/${totalSegments}) is inconsistent with reported progressPercentage (${progress.progressPercentage}) — segments may have been skipped`
      );
    }
  }

  // --- Events rules ---
  const events = eventsResult ? eventsResult.events : [];

  events.forEach((event) => {
    if (!SUPPORTED_EVENT_TYPES.has(event.type)) {
      errors.push(`Unsupported event type '${event.type}'`);
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

  if (!hasDestinationReached && progress.completed) {
    errors.push("Progress is completed but DestinationReached was not emitted");
  }

  // --- Cross-module consistency: Provider -> Runtime -> Progress ->
  // Events must all describe exactly the same navigation state.
  events.forEach((event) => {
    if (event.sessionId !== session.id) {
      errors.push(`Event '${event.type}' references a different session ('${event.sessionId}')`);
    }

    if (event.routeId !== runtimeSnapshot.routeId) {
      errors.push(`Event '${event.type}' references a different route ('${event.routeId}')`);
    }
  });

  return {
    errors,
    warnings,
    statistics: {
      providerName: runtimeSnapshot.provider,
      progressPercentage: progress.progressPercentage,
      remainingSegments: progress.remainingSegments,
      completed: progress.completed,
      totalEvents: events.length,
    },
  };
}

module.exports = { validate };
