// test/nonce.test.ts
// Nonce strategy tests — behavior, concurrency properties, and failure modes.

import { describe, it, expect } from "vitest";
import {
  createSequentialNonceManager,
  randomNonce,
  randomNonce64,
  timestampNonce,
  deterministicNonce,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// Sequential manager
// ---------------------------------------------------------------------------
describe("createSequentialNonceManager", () => {
  it("starts at 0 by default", () => {
    const mgr = createSequentialNonceManager();
    expect(mgr.peek()).toBe(0n);
  });

  it("starts at custom value", () => {
    const mgr = createSequentialNonceManager(10n);
    expect(mgr.peek()).toBe(10n);
  });

  it("increments on each next() call", () => {
    const mgr = createSequentialNonceManager();
    expect(mgr.next()).toBe(0n);
    expect(mgr.next()).toBe(1n);
    expect(mgr.next()).toBe(2n);
  });

  it("peek does not advance the counter", () => {
    const mgr = createSequentialNonceManager();
    mgr.next();
    mgr.next();
    expect(mgr.peek()).toBe(2n);
    expect(mgr.peek()).toBe(2n);
  });

  it("produces unique values for N sequential calls", () => {
    const mgr = createSequentialNonceManager();
    const nonces = Array.from({ length: 100 }, () => mgr.next());
    const unique = new Set(nonces.map(String));
    expect(unique.size).toBe(100);
  });

  it("reset restores to start", () => {
    const mgr = createSequentialNonceManager(5n);
    mgr.next();
    mgr.next();
    mgr.reset();
    expect(mgr.peek()).toBe(5n);
  });

  // Concurrency note: sequential manager is NOT safe across processes.
  // Two separate manager instances will produce the same nonces.
  it("two separate managers produce identical sequences (concurrency hazard)", () => {
    const mgr1 = createSequentialNonceManager();
    const mgr2 = createSequentialNonceManager();
    expect(mgr1.next()).toBe(mgr2.next());
    expect(mgr1.next()).toBe(mgr2.next());
    // In a multi-worker system, this means duplicate nonces will be produced.
    // External coordination is required.
  });
});

// ---------------------------------------------------------------------------
// Random nonce
// ---------------------------------------------------------------------------
describe("randomNonce", () => {
  it("returns a bigint", () => {
    expect(typeof randomNonce()).toBe("bigint");
  });

  it("returns a value within 32-bit range", () => {
    const nonce = randomNonce();
    expect(nonce >= 0n).toBe(true);
    expect(nonce <= BigInt("0xFFFFFFFF")).toBe(true);
  });

  it("produces different values across calls (probabilistic)", () => {
    const nonces = new Set(Array.from({ length: 20 }, () => randomNonce().toString()));
    // With 32-bit space and 20 samples, collision probability is negligible
    expect(nonces.size).toBeGreaterThan(15);
  });

  it("does not guarantee uniqueness — collision is possible at scale", () => {
    // This is a documentation test, not a behavioral assertion.
    // randomNonce() uses 32-bit space: ~4 billion values.
    // At high volume, use randomNonce64() instead.
    const nonce1 = randomNonce();
    const nonce2 = randomNonce();
    // We cannot assert nonce1 !== nonce2 — that would be a false guarantee.
    expect(typeof nonce1).toBe("bigint");
    expect(typeof nonce2).toBe("bigint");
  });
});

// ---------------------------------------------------------------------------
// randomNonce64
// ---------------------------------------------------------------------------
describe("randomNonce64", () => {
  it("returns a value larger than 32-bit range (typically)", () => {
    // Not guaranteed on every call, but statistically very likely
    const samples = Array.from({ length: 10 }, () => randomNonce64());
    const hasLarge = samples.some(n => n > BigInt("0xFFFFFFFF"));
    expect(hasLarge).toBe(true);
  });

  it("produces different values across calls (probabilistic)", () => {
    const nonces = new Set(Array.from({ length: 20 }, () => randomNonce64().toString()));
    expect(nonces.size).toBeGreaterThan(18);
  });
});

// ---------------------------------------------------------------------------
// Timestamp nonce
// ---------------------------------------------------------------------------
describe("timestampNonce", () => {
  it("returns current time in milliseconds as bigint", () => {
    const before = BigInt(Date.now());
    const nonce  = timestampNonce();
    const after  = BigInt(Date.now());
    expect(nonce >= before).toBe(true);
    expect(nonce <= after).toBe(true);
  });

  it("is monotonically non-decreasing within single process", async () => {
    const n1 = timestampNonce();
    await new Promise(r => setTimeout(r, 2));
    const n2 = timestampNonce();
    expect(n2).toBeGreaterThanOrEqual(n1);
  });

  // Concurrency note: two workers calling at the same millisecond produce identical nonces.
  it("may produce identical values within same millisecond (concurrency hazard)", () => {
    // Simulate two workers calling at the same ms
    const t = BigInt(Date.now());
    const n1 = t;
    const n2 = t; // same millisecond
    // In a concurrent system, this is a real collision risk.
    expect(n1).toBe(n2);
    // Use randomNonce() for concurrent scenarios.
  });
});

// ---------------------------------------------------------------------------
// Deterministic nonce
// ---------------------------------------------------------------------------
describe("deterministicNonce", () => {
  it("is deterministic for same inputs", () => {
    const a = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const s = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const n1 = deterministicNonce(a, s, 0n);
    const n2 = deterministicNonce(a, s, 0n);
    expect(n1).toBe(n2);
  });

  it("differs for different counters", () => {
    const a = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const s = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    expect(deterministicNonce(a, s, 0n)).not.toBe(deterministicNonce(a, s, 1n));
  });

  it("differs for different accounts", () => {
    const a1 = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const a2 = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    const s  = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
    expect(deterministicNonce(a1, s, 0n)).not.toBe(deterministicNonce(a2, s, 0n));
  });
});
