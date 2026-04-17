// src/nonce.ts
// Nonce strategy helpers for execution intent.
//
// Nonce model:
//   Nonces in execution intent are scoped to (account, signer).
//   They are unordered — any value is valid exactly once per (account, signer) pair.
//   The on-chain enforcer tracks: usedNonces[account][signer][nonce]
//
// Concurrency model:
//   The SDK does not provide distributed coordination.
//   Each strategy has explicit concurrency properties documented below.
//   For multi-worker or multi-relayer systems, external coordination is required.

// ---------------------------------------------------------------------------
// Sequential nonce manager
// ---------------------------------------------------------------------------
// CONCURRENCY: NOT safe across multiple processes or workers.
// Safe for: single-process agents, single-threaded relayers.
// Risk: if two workers share the same manager instance (impossible in separate
//       processes), they would produce duplicate nonces.
// External coordination required for: multi-process, multi-worker deployments.

export interface NonceManager {
  next():  bigint;
  peek():  bigint;
  reset(): void;
}

export function createSequentialNonceManager(start = 0n): NonceManager {
  let current = start;
  return {
    next():  bigint { return current++; },
    peek():  bigint { return current; },
    reset(): void   { current = start; },
  };
}

// ---------------------------------------------------------------------------
// Random nonce
// ---------------------------------------------------------------------------
// CONCURRENCY: Safe across multiple workers with extremely low collision probability.
// Uses cryptographic randomness (crypto.getRandomValues).
// Collision probability for 32-bit space: ~1 in 4 billion per pair.
// For high-throughput systems (>10k intents/day), use 64-bit or larger random space,
// or switch to external coordination.
// NOT safe if: same nonce must not be reused and collision risk is unacceptable.

export function randomNonce(): bigint {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return BigInt(arr[0]!);
}

// 64-bit random nonce — lower collision probability for high-throughput systems
export function randomNonce64(): bigint {
  const arr = new Uint32Array(2);
  crypto.getRandomValues(arr);
  return (BigInt(arr[0]!) << 32n) | BigInt(arr[1]!);
}

// ---------------------------------------------------------------------------
// Timestamp-based nonce
// ---------------------------------------------------------------------------
// CONCURRENCY: NOT safe for concurrent workers creating intents in the same millisecond.
// Safe for: low-frequency, single-worker flows where monotonicity is useful.
// Risk: two workers calling timestampNonce() at the same millisecond produce identical nonces.
// Use randomNonce() for concurrent scenarios.

export function timestampNonce(): bigint {
  return BigInt(Date.now());
}

// ---------------------------------------------------------------------------
// Deterministic nonce
// ---------------------------------------------------------------------------
// CONCURRENCY: Safe if counter is coordinated externally.
// Useful for: reproducible test scenarios, audit trails.
// External coordination required for: counter allocation in distributed systems.

export function deterministicNonce(account: string, signer: string, counter: bigint): bigint {
  const accountNum = BigInt("0x" + account.slice(2).toLowerCase());
  const signerNum  = BigInt("0x" + signer.slice(2).toLowerCase());
  return (accountNum ^ signerNum ^ counter) & BigInt("0xFFFFFFFF");
}

// ---------------------------------------------------------------------------
// Nonce strategy guide
// ---------------------------------------------------------------------------
//
// | Strategy    | Concurrency safe? | Use case                          |
// |-------------|-------------------|-----------------------------------|
// | sequential  | single process    | single agent, single relayer      |
// | random32    | multi-worker      | general concurrent use            |
// | random64    | multi-worker      | high-throughput concurrent use    |
// | timestamp   | single worker     | low-frequency, auditable flows    |
// | deterministic | with ext. coord | testing, reproducible flows       |
//
// For production multi-worker systems:
//   - Use randomNonce64() for low coordination overhead
//   - Or use an external nonce registry (database, on-chain query)
//   - Always check usedNonces[account][signer][nonce] before submitting
//
// What the SDK guarantees:
//   - Sequential manager produces unique nonces within one process lifetime
//   - randomNonce() produces cryptographically random values (not guaranteed unique)
//   - No distributed deduplication — that is the caller's responsibility
//
// What the SDK does NOT guarantee:
//   - Global uniqueness across processes
//   - Collision freedom for random nonces under high volume
//   - Distributed coordination of any kind
