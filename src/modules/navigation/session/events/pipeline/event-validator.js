const SUPPORTED_EVENT_TYPES = new Set([
  "SessionStarted",
  "SegmentEntered",
  "SegmentCompleted",
  "NodeReached",
  "FloorChanged",
  "DestinationReached",
  "SessionCancelled",
]);

const REQUIRED_METADATA_FIELDS = {
  SessionStarted: [],
  SegmentEntered: ["segmentId", "sourceNodeId", "targetNodeId", "sequence"],
  SegmentCompleted: ["segmentId", "sourceNodeId", "targetNodeId", "sequence"],
  NodeReached: ["nodeId"],
  FloorChanged: ["fromFloorId", "toFloorId"],
  DestinationReached: ["nodeId", "progressPercentage"],
  SessionCancelled: [],
};

const CANONICAL_ORDER = [
  "SessionStarted",
  "SegmentEntered",
  "SegmentCompleted",
  "NodeReached",
  "FloorChanged",
  "DestinationReached",
  "SessionCancelled",
];

// Stage 3 — Validator. Pure function: no Prisma, no writes. Defense in
// depth against the Event Engine's own output — exactly like every
// previous sprint's pure validator stage.
function validate(events, progress, session) {
  const errors = [];

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

  events.forEach((event) => {
    const requiredFields = REQUIRED_METADATA_FIELDS[event.type] || [];
    requiredFields.forEach((field) => {
      if (event.metadata[field] === undefined || event.metadata[field] === null) {
        errors.push(`Event '${event.type}' is missing required metadata field '${field}'`);
      }
    });
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

  // No per-node/per-segment floor data exists anywhere in this story's
  // reused inputs, so FloorChanged must never appear.
  const hasFloorChanged = events.some((event) => event.type === "FloorChanged");

  if (hasFloorChanged) {
    errors.push("FloorChanged emitted without an actual floor change");
  }

  const segmentEnteredIndex = events.findIndex((event) => event.type === "SegmentEntered");
  const segmentCompletedIndex = events.findIndex((event) => event.type === "SegmentCompleted");

  if (segmentCompletedIndex !== -1 && (segmentEnteredIndex === -1 || segmentCompletedIndex < segmentEnteredIndex)) {
    errors.push("SegmentCompleted exists without a preceding SegmentEntered");
  }

  const nodeReachedIndex = events.findIndex((event) => event.type === "NodeReached");

  if (nodeReachedIndex !== -1 && (segmentEnteredIndex === -1 || nodeReachedIndex < segmentEnteredIndex)) {
    errors.push("NodeReached exists without a preceding SegmentEntered");
  }

  const hasSessionCancelled = events.some((event) => event.type === "SessionCancelled");

  if (hasSessionCancelled && session.state !== "CANCELLED") {
    errors.push("SessionCancelled emitted but session state is not CANCELLED");
  }

  return { errors };
}

module.exports = { validate, SUPPORTED_EVENT_TYPES };
