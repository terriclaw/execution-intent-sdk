// test/relayer.test.ts
// Relayer payload shape and failure classification tests.

import { describe, it, expect } from "vitest";
import { privateKeyToAccount } from "viem/accounts";
import {
  createIntent,
  signIntent,
  wrapSignedIntent,
  prepareRelayerPayload,
  validateBeforeSubmission,
  buildRelayerLogEntry,
  defaultDomain,
  dataHash,
} from "../src/index.js";

const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const account = privateKeyToAccount(PRIVATE_KEY);

const CALLDATA = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100000"
) as `0x${string}`;

const domain = defaultDomain("0x0000000000000000000000000000000000000001", 1);

function makeIntent(nonce = 1n, deadline?: bigint) {
  return createIntent({
    account:  account.address,
    target:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    value:    0n,
    data:     CALLDATA,
    nonce,
    deadline: deadline ?? BigInt(Math.floor(Date.now() / 1000) + 3600),
  });
}

// ---------------------------------------------------------------------------
// RelayerPayload shape
// ---------------------------------------------------------------------------
describe("prepareRelayerPayload — shape stability", () => {
  it("intent_type is always first key", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    const keys = Object.keys(payload);
    expect(keys[0]).toBe("intent_type");
  });

  it("intent_type is always ExecutionBoundIntent", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    expect(payload.intent_type).toBe("ExecutionBoundIntent");
  });

  it("contains all required fields", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    expect(payload).toHaveProperty("intent_type");
    expect(payload).toHaveProperty("account");
    expect(payload).toHaveProperty("signer");
    expect(payload).toHaveProperty("target");
    expect(payload).toHaveProperty("value");
    expect(payload).toHaveProperty("calldata");
    expect(payload).toHaveProperty("nonce");
    expect(payload).toHaveProperty("deadline");
    expect(payload).toHaveProperty("dataHash");
    expect(payload).toHaveProperty("encodedArgs");
    expect(payload).toHaveProperty("deadlineValid");
  });

  it("dataHash matches SDK dataHash", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    expect(payload.dataHash).toBe(dataHash(intent));
  });

  it("encodedArgs is 384 bytes", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    expect((payload.encodedArgs.length - 2) / 2).toBe(384);
  });

  it("deadlineValid is true for future deadline", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    expect(payload.deadlineValid).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------
describe("validateBeforeSubmission — failure codes", () => {
  it("returns valid=true for correct intent", async () => {
    const intent = makeIntent(5n);
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const result = validateBeforeSubmission(signed, intent.target, intent.value, CALLDATA);
    // nonce 5 so no NONCE_REUSE_RISK
    expect(result.valid).toBe(true);
    expect(result.codes).toHaveLength(0);
  });

  it("DEADLINE_EXPIRED for past deadline", async () => {
    const intent = makeIntent(5n, 1n);
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const result = validateBeforeSubmission(signed, intent.target, intent.value, CALLDATA);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain("DEADLINE_EXPIRED");
  });

  it("EXECUTION_MISMATCH for wrong calldata", async () => {
    const intent = makeIntent(5n);
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const result = validateBeforeSubmission(signed, intent.target, intent.value, "0xdeadbeef");
    expect(result.valid).toBe(false);
    expect(result.codes).toContain("EXECUTION_MISMATCH");
  });

  it("INVALID_SIGNATURE for malformed signature", async () => {
    const intent = makeIntent(5n);
    const signed = wrapSignedIntent(intent, account.address, "0x1234");
    const result = validateBeforeSubmission(signed, intent.target, intent.value, CALLDATA);
    expect(result.valid).toBe(false);
    expect(result.codes).toContain("INVALID_SIGNATURE");
  });

  it("NONCE_REUSE_RISK for nonce=0", async () => {
    const intent = makeIntent(0n);
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const result = validateBeforeSubmission(signed, intent.target, intent.value, CALLDATA);
    expect(result.codes).toContain("NONCE_REUSE_RISK");
  });

  it("returns multiple codes for multiple failures", async () => {
    const intent = makeIntent(0n, 1n); // expired + nonce 0
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const result = validateBeforeSubmission(signed, intent.target, intent.value, CALLDATA);
    expect(result.codes).toContain("DEADLINE_EXPIRED");
    expect(result.codes).toContain("NONCE_REUSE_RISK");
    expect(result.valid).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Log entry
// ---------------------------------------------------------------------------
describe("buildRelayerLogEntry", () => {
  it("intent_type is first key", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    const log = buildRelayerLogEntry(payload);
    expect(Object.keys(log)[0]).toBe("intent_type");
  });

  it("all values are strings", async () => {
    const intent = makeIntent();
    const signed = await signIntent(intent, domain, PRIVATE_KEY);
    const payload = prepareRelayerPayload(signed);
    const log = buildRelayerLogEntry(payload);
    Object.values(log).forEach(v => expect(typeof v).toBe("string"));
  });
});
