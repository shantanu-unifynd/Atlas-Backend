// A DOORWAY connected to exactly one navigable neighbor, and that neighbor
// is not a ROOM, is treated as an outward-facing doorway (e.g. corridor to
// the outside). The Semantic Model carries no exterior/boundary flag today,
// so this is a deterministic proxy, not a true exterior detection — see the
// Sprint 06 Story 02 Phase A completion report's Known Limitations.
const RULE_ID = "NAV-CAND-005";
const RULE_NAME = "Building Entry Detection";
const CANDIDATE_TYPE = "BUILDING_ENTRY";
const SINGLE_NEIGHBOR_COUNT = 1;

function evaluate(evidence) {
  if (evidence.semanticCategory !== "DOORWAY") {
    return false;
  }

  if (evidence.neighbors.length !== SINGLE_NEIGHBOR_COUNT) {
    return false;
  }

  return evidence.neighbors[0].semanticCategory !== "ROOM";
}

module.exports = {
  ruleId: RULE_ID,
  ruleName: RULE_NAME,
  candidateType: CANDIDATE_TYPE,
  evaluate,
};
