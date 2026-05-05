// In-memory circuit breaker — state persists within a serverless instance,
// resets on cold starts (which is fine — a fresh instance can try again).

const FAILURE_THRESHOLD = 3;
const RESET_MS          = 30_000; // half-open after 30 s

const circuits = new Map();

function getState(name) {
  if (!circuits.has(name)) circuits.set(name, { failures: 0, openedAt: null });
  return circuits.get(name);
}

function isOpen(name) {
  const s = getState(name);
  if (s.openedAt === null) return false;
  if (Date.now() - s.openedAt >= RESET_MS) {
    // Half-open: reset and allow one attempt
    s.failures = 0;
    s.openedAt = null;
    return false;
  }
  return true;
}

function recordSuccess(name) {
  const s = getState(name);
  s.failures = 0;
  s.openedAt = null;
}

function recordFailure(name) {
  const s = getState(name);
  s.failures++;
  if (s.failures >= FAILURE_THRESHOLD) s.openedAt = Date.now();
}

/**
 * Runs fn() protected by a named circuit breaker.
 * Throws CircuitOpenError if the circuit is open.
 */
export async function withCircuitBreaker(name, fn) {
  if (isOpen(name)) {
    const err = new Error(`${name} circuit open — upstream degraded`);
    err.circuitOpen = true;
    throw err;
  }
  try {
    const result = await fn();
    recordSuccess(name);
    return result;
  } catch (err) {
    if (!err.circuitOpen) recordFailure(name);
    throw err;
  }
}
