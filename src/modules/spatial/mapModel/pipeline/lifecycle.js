// MPM publish lifecycle (Sprint 07A).
//
// Mirrors the transition-guard pattern in uso/pipeline/production-validator.js.
// The MapPresentationModel `status` field is a free string (no enum, no
// migration), moving:
//   GENERATED  — freshly generated draft (initial state, set by generate())
//   PUBLISHED  — the live version consumers can read via ?published=true
//   ARCHIVED   — a previously-published version, superseded when a newer
//                version is published (kept for history, never deleted)
//
// Invariant enforced by the service: at most one PUBLISHED version per floor.

const GENERATED = "GENERATED";
const PUBLISHED = "PUBLISHED";
const ARCHIVED = "ARCHIVED";

const STATUSES = [GENERATED, PUBLISHED, ARCHIVED];

// Only forward transitions the publish workflow performs: a draft is published,
// and a published version is archived when it is superseded.
const ALLOWED_TRANSITIONS = {
  [GENERATED]: [PUBLISHED],
  [PUBLISHED]: [ARCHIVED],
  [ARCHIVED]: [],
};

function canTransition(fromStatus, toStatus) {
  return (ALLOWED_TRANSITIONS[fromStatus] || []).includes(toStatus);
}

module.exports = {
  GENERATED,
  PUBLISHED,
  ARCHIVED,
  STATUSES,
  ALLOWED_TRANSITIONS,
  canTransition,
};
