// Stage 4 — Publication. Pure decision only — this is the ONLY stage in
// the entire Navigation Graph pipeline permitted to transition a graph to
// READY or FAILED (Story 05's sole responsibility per the architecture).
function determineGraphStatus(validationStatus) {
  return validationStatus === "INVALID" ? "FAILED" : "READY";
}

module.exports = { determineGraphStatus };
