// test/sdk.test.ts
// Test suite for execution-intent-sdk v1.
// Run: npm test

import { describe, it, expect, beforeAll } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  createIntent,
  dataHash,
  hashIntent,
  buildSigningPayload,
  signIntent,
  verifySignedIntent,
  recoverIntentSigner,
  executionMatchesIntent,
  isDeadlineValid,
  encodeIntentArgs,
  defaultDomain,
} from "../src/index.js";
import type { ExecutionIntent, IntentDomain } from "../src/index.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(PRIVATE_KEY);

const CALLDATA = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100000"
) as `0x${string}`;

const MUTATED_CALLDATA = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100001"
) as `0x${string}`;

const domain: IntentDomain = defaultDomain("0x0000000000000000000000000000000000000001", 84532);

const baseIntent: ExecutionIntent = createIntent({
  account:  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  target:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  value:    0n,
  data:     CALLDATA,
  nonce:    1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
});

// ---------------------------------------------------------------------------
// dataHash
// ---------------------------------------------------------------------------
describe("dataHash", () => {
  it("returns keccak256 of calldata", () => {
    const hash = dataHash(baseIntent);
    expect(hash).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("changes when calldata changes", () => {
    const intent2 = createIntent({ ...baseIntent, data: MUTATED_CALLDATA });
    expect(dataHash(baseIntent)).not.toBe(dataHash(intent2));
  });
});

// ---------------------------------------------------------------------------
// hashIntent (EIP-712 digest)
// ---------------------------------------------------------------------------
describe("hashIntent", () => {
  it("returns 32-byte hex digest", () => {
    const digest = hashIntent(baseIntent, domain);
    expect(digest).toMatch(/^0x[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    expect(hashIntent(baseIntent, domain)).toBe(hashIntent(baseIntent, domain));
  });

  it("changes when intent fields change", () => {
    const intent2 = createIntent({ ...baseIntent, nonce: 2n });
    expect(hashIntent(baseIntent, domain)).not.toBe(hashIntent(intent2, domain));
  });

  it("changes when domain changes", () => {
    const domain2 = defaultDomain("0x0000000000000000000000000000000000000002", 84532);
    expect(hashIntent(baseIntent, domain)).not.toBe(hashIntent(baseIntent, domain2));
  });
});

// ---------------------------------------------------------------------------
// buildSigningPayload
// ---------------------------------------------------------------------------
describe("buildSigningPayload", () => {
  it("returns correct primaryType", () => {
    const payload = buildSigningPayload(baseIntent, domain);
    expect(payload.primaryType).toBe("ExecutionIntent");
  });

  it("includes all required fields in message", () => {
    const payload = buildSigningPayload(baseIntent, domain);
    expect(payload.message).toHaveProperty("account");
    expect(payload.message).toHaveProperty("target");
    expect(payload.message).toHaveProperty("value");
    expect(payload.message).toHaveProperty("dataHash");
    expect(payload.message).toHaveProperty("nonce");
    expect(payload.message).toHaveProperty("deadline");
  });

  it("message.dataHash matches dataHash(intent)", () => {
    const payload = buildSigningPayload(baseIntent, domain);
    expect(payload.message.dataHash).toBe(dataHash(baseIntent));
  });
});

// ---------------------------------------------------------------------------
// signIntent + verifySignedIntent + recoverIntentSigner
// ---------------------------------------------------------------------------
describe("signing and verification", () => {
  it("signs and verifies correctly", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    expect(signed.signer.toLowerCase()).toBe(account.address.toLowerCase());
    const valid = await verifySignedIntent(signed, domain);
    expect(valid).toBe(true);
  });

  it("recovers correct signer", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    const recovered = await recoverIntentSigner(baseIntent, domain, signed.signature);
    expect(recovered.toLowerCase()).toBe(account.address.toLowerCase());
  });

  it("fails verification with wrong signer", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    const wrongSigner = { ...signed, signer: "0x0000000000000000000000000000000000000001" };
    const valid = await verifySignedIntent(wrongSigner, domain);
    expect(valid).toBe(false);
  });

  it("fails verification when intent field is tampered", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    const tamperedIntent = createIntent({ ...baseIntent, nonce: 99n });
    const tamperedSigned = { ...signed, intent: tamperedIntent };
    const valid = await verifySignedIntent(tamperedSigned, domain);
    expect(valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// executionMatchesIntent
// ---------------------------------------------------------------------------
describe("executionMatchesIntent", () => {
  it("returns true for exact match", () => {
    expect(executionMatchesIntent(baseIntent, baseIntent.target, baseIntent.value, CALLDATA)).toBe(true);
  });

  it("returns false for mutated calldata", () => {
    expect(executionMatchesIntent(baseIntent, baseIntent.target, baseIntent.value, MUTATED_CALLDATA)).toBe(false);
  });

  it("returns false for wrong target", () => {
    expect(executionMatchesIntent(
      baseIntent,
      "0x0000000000000000000000000000000000000002",
      baseIntent.value,
      CALLDATA
    )).toBe(false);
  });

  it("returns false for wrong value", () => {
    expect(executionMatchesIntent(baseIntent, baseIntent.target, 1n, CALLDATA)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// isDeadlineValid
// ---------------------------------------------------------------------------
describe("isDeadlineValid", () => {
  it("returns true for future deadline", () => {
    expect(isDeadlineValid(baseIntent)).toBe(true);
  });

  it("returns true for deadline = 0 (no expiry)", () => {
    const noExpiry = createIntent({ ...baseIntent, deadline: 0n });
    expect(isDeadlineValid(noExpiry)).toBe(true);
  });

  it("returns false for expired deadline", () => {
    const expired = createIntent({ ...baseIntent, deadline: 1n });
    expect(isDeadlineValid(expired)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// encodeIntentArgs
// ---------------------------------------------------------------------------
describe("encodeIntentArgs", () => {
  it("returns hex string", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    const encoded = encodeIntentArgs(baseIntent, signed.signer, signed.signature);
    expect(encoded).toMatch(/^0x[0-9a-f]+$/);
  });

  it("returns 384 bytes for standard intent", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    const encoded = encodeIntentArgs(baseIntent, signed.signer, signed.signature);
    expect((encoded.length - 2) / 2).toBe(384);
  });

  it("encoded output changes when signer changes", async () => {
    const signed = await signIntent(baseIntent, domain, PRIVATE_KEY);
    const enc1 = encodeIntentArgs(baseIntent, signed.signer, signed.signature);
    const enc2 = encodeIntentArgs(baseIntent, "0x0000000000000000000000000000000000000001", signed.signature);
    expect(enc1).not.toBe(enc2);
  });
});
