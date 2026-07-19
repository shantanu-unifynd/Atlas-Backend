// Elevators, escalators and stairs are already classified as a single
// semantic category by Sprint 05 Story 05 — every one of them is always a
// navigation candidate, independent of its relationships.
const RULE_ID = "NAV-CAND-004";
const RULE_NAME = "Vertical Connector Detection";
const CANDIDATE_TYPE = "VERTICAL_CONNECTOR";

function evaluate(evidence) {
  return evidence.semanticCategory === "VERTICAL_CONNECTOR";
}

module.exports = {
  ruleId: RULE_ID,
  ruleName: RULE_NAME,
  candidateType: CANDIDATE_TYPE,
  evaluate,
};
