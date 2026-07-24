// Shared deterministic 32-bit string hash — no Math.random(), no
// Date.now(). Reused by the Walking Engine's fallback coordinate
// derivation (when a node has no real position data) and by
// MockPositionProvider's original static behavior (used when `sourceId`
// does not resolve to a real NavigationSession).
function deterministicHash(input) {
  let hash = 0;

  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }

  return Math.abs(hash);
}

function deriveCoordinates(key) {
  const hash = deterministicHash(key);

  return {
    x: hash % 100,
    y: Math.floor(hash / 100) % 100,
  };
}

module.exports = { deterministicHash, deriveCoordinates };
