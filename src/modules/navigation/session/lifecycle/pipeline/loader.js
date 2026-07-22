const navigationSessionRepository = require("../../../../../repositories/navigationSession/navigationSession.repository");

// Stage 1 — Loader. Loads the NavigationSession a lifecycle transition
// would apply to. No progress/event inspection — this story only needs
// the session's current state.
async function loadSession(id) {
  const session = await navigationSessionRepository.findById(id);

  if (!session) {
    const error = new Error("Navigation Session not found");
    error.statusCode = 404;
    throw error;
  }

  return session;
}

module.exports = { loadSession };
