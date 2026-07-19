// A CORRIDOR connected to 3 or more other navigable Semantic Objects is a
// branching point — a place where a navigation decision must be made.
const RULE_ID = "NAV-CAND-002";
const RULE_NAME = "Corridor Intersection Detection";
const CANDIDATE_TYPE = "CORRIDOR_INTERSECTION";
const MIN_CONNECTIONS = 3;

function evaluate(evidence) {
  if (evidence.semanticCategory !== "CORRIDOR") {
    return false;
  }

  return evidence.neighbors.length >= MIN_CONNECTIONS;
}

module.exports = {
  ruleId: RULE_ID,
  ruleName: RULE_NAME,
  candidateType: CANDIDATE_TYPE,
  evaluate,
};
