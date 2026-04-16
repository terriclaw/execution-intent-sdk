// src/nonce.ts
// Nonce strategy helpers for execution intent.
//
// Nonce model:
//   Nonces in execution intent are scoped to (account, signer).
//   They are unordered — any value is valid exactly once.
//   The on-chain enforcer tracks: usedNonces[account][signer][nonce]
//
// Strategy guidance:
//   - Sequential: simplest, use for single-agent / single-backend flows
//   - Random: use for multi-agent or concurrent signing scenarios
//   - Timestamp-based: readable, low collision for low-frequency flows
//
// For production distributed systems, coordinate nonce allocation externally
// (e.g. via a database or on-chain query). This module covers common local patterns.

// ---------------------------------------------------------------------------
// Sequential nonce manager
// ---------------------------------------------------------------------------
// Tracks nonces in memory. Suitable for single-process agents and relayers.
// Not safe across multiple concurrent processes without external coordination.

export interface NonceManager {
  next():   bigint;
  peek():   bigint;
  reset():  void;
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
// Generates a cryptographically random 32-bit nonce.
// Low collision probability for low-frequency flows.
// Not suitable for high-throughput scenarios without collision checking.

export function randomNonce(): bigint {
  const arr = new Uint32Array(1);
  crypto.getRandomValues(arr);
  return BigInt(arr[0]!);
}

// ---------------------------------------------------------------------------
// Timestamp-based nonce
// ---------------------------------------------------------------------------
// Uses current unix timestamp in milliseconds as nonce.
// Readable and monotonically increasing within a single process.
// Collides if two intents are created in the same millisecond.

export function timestampNonce(): bigint {
  return BigInt(Date.now());
}

// ---------------------------------------------------------------------------
// Deterministic nonce
// ---------------------------------------------------------------------------
// Derives a deterministic nonce from (account, signer, counter).
// Useful when you need reproducible nonces for testing or audit trails.
// Not suitable for production without external counter coordination.

export function deterministicNonce(account: string, signer: string, counter: bigint): bigint {
  // Simple hash: xor of account bytes + signer bytes + counter
  // For production use a proper hash function; this is illustrative.
  const accountNum = BigInt("0x" + account.slice(2).toLowerCase());
  const signerNum  = BigInt("0x" + signer.slice(2).toLowerCase());
  return (accountNum ^ signerNum ^ counter) & BigInt("0xFFFFFFFF");
}
