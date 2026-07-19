// A CORRIDOR connected to exactly one other navigable Semantic Object
// terminates there — a dead end, not a through-route.
const RULE_ID = "NAV-CAND-003";
const RULE_NAME = "Dead End Detection";
const CANDIDATE_TYPE = "DEAD_END";
const DEAD_END_CONNECTION_COUNT = 1;

function evaluate(evidence) {
  if (evidence.semanticCategory !== "CORRIDOR") {
    return false;
  }

  return evidence.neighbors.length === DEAD_END_CONNECTION_COUNT;
}

module.exports = {
  ruleId: RULE_ID,
  ruleName: RULE_NAME,
  candidateType: CANDIDATE_TYPE,
  evaluate,
};
