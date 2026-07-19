// A DOORWAY that connects to at least one ROOM becomes a ROOM_ENTRY
// candidate — the doorway is where navigation enters/exits that room.
const RULE_ID = "NAV-CAND-001";
const RULE_NAME = "Room Entry Detection";
const CANDIDATE_TYPE = "ROOM_ENTRY";

function evaluate(evidence) {
  if (evidence.semanticCategory !== "DOORWAY") {
    return false;
  }

  return evidence.neighbors.some((neighbor) => neighbor.semanticCategory === "ROOM");
}

module.exports = {
  ruleId: RULE_ID,
  ruleName: RULE_NAME,
  candidateType: CANDIDATE_TYPE,
  evaluate,
};
