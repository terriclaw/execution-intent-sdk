// consumer-test/index.ts
// External consumer validation.
// Proves that a clean external install works with no path hacks.
//
// Run: npm run consumer:test (from repo root)

import {
  createIntent,
  buildSigningPayload,
  executionMatchesIntent,
  defaultDomain,
  dataHash,
} from "execution-intent-sdk";

console.log("=== Consumer Test ===");
console.log("Importing from: execution-intent-sdk");
console.log();

// 1. createIntent
const intent = createIntent({
  account:  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  target:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  value:    0n,
  data:     ("0xa9059cbb" +
    "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
    "0000000000000000000000000000000000000000000000056bc75e2d63100000"
  ) as `0x${string}`,
  nonce:    1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
});

console.log("createIntent:       OK");
console.log("  account:", intent.account);
console.log("  dataHash:", dataHash(intent));
console.log();

// 2. buildSigningPayload
const domain  = defaultDomain("0x0000000000000000000000000000000000000001", 1);
const payload = buildSigningPayload(intent, domain);

console.log("buildSigningPayload: OK");
console.log("  primaryType:", payload.primaryType);
console.log("  fields:", Object.keys(payload.message).join(", "));
console.log();

// 3. executionMatchesIntent
const calldata = intent.data as `0x${string}`;
const match    = executionMatchesIntent(intent, intent.target, intent.value, calldata);
const noMatch  = executionMatchesIntent(intent, intent.target, intent.value, "0xdeadbeef");

console.log("executionMatchesIntent: OK");
console.log("  correct calldata:", match);
console.log("  wrong calldata:  ", noMatch);
console.log();

if (!match || noMatch) {
  console.error("FAIL: unexpected match results");
  process.exit(1);
}

console.log("=== All checks passed ===");
console.log("External consumer imports work correctly.");
