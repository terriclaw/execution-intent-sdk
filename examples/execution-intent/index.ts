import "dotenv/config";
// examples/execution-intent/index.ts
//
// Flow B: Execution Intent - atomic commitment
//
// This example is fully runnable. It signs a real EIP-712 execution intent,
// verifies the signature, recovers the signer, and encodes args for on-chain submission.
//
// Run:
//   export PRIVATE_KEY=0x...
//   npx tsx examples/execution-intent/index.ts

import {
  createIntent,
  signIntent,
  verifySignedIntent,
  recoverIntentSigner,
  executionMatchesIntent,
  isDeadlineValid,
  encodeIntentArgs,
  hashIntent,
  dataHash,
  defaultDomain,
} from "../../src/index.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
if (!PRIVATE_KEY) {
  throw new Error("Missing PRIVATE_KEY. Set it via: export PRIVATE_KEY=0x...");
}

const ENFORCER_ADDRESS = "0x0000000000000000000000000000000000000001"; // placeholder
const CHAIN_ID = 84532; // Base Sepolia

const domain = defaultDomain(ENFORCER_ADDRESS, CHAIN_ID);

// ---------------------------------------------------------------------------
// Step 1: Create the intent
// ---------------------------------------------------------------------------
console.log("=== Execution Intent Flow ===\nStep 1: Create intent");

const calldata = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100000"
) as `0x${string}`;

const intent = createIntent({
  account:  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
  target:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
  value:    0n,
  data:     calldata,
  nonce:    1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
});

console.log("  dataHash:", dataHash(intent), "\n");

// ---------------------------------------------------------------------------
// Step 2: Hash intent
// ---------------------------------------------------------------------------
console.log("Step 2: Hash intent");
const digest = hashIntent(intent, domain);
console.log("  digest:", digest, "\n");

// ---------------------------------------------------------------------------
// Step 3: Sign intent
// ---------------------------------------------------------------------------
console.log("Step 3: Sign intent");
const signed = await signIntent(intent, domain, PRIVATE_KEY);
console.log("  signer:", signed.signer, "\n");

// ---------------------------------------------------------------------------
// Step 4: Verify signature
// ---------------------------------------------------------------------------
console.log("Step 4: Verify signature");
const valid = await verifySignedIntent(signed, domain);
console.log("  valid:", valid, "\n");

// ---------------------------------------------------------------------------
// Step 5: Recover signer
// ---------------------------------------------------------------------------
console.log("Step 5: Recover signer");
const recovered = await recoverIntentSigner(intent, domain, signed.signature);
console.log("  recovered matches:", recovered.toLowerCase() === signed.signer.toLowerCase(), "\n");

// ---------------------------------------------------------------------------
// Step 6: Match execution
// ---------------------------------------------------------------------------
console.log("Step 6: Execution matching");
const exactMatch = executionMatchesIntent(intent, intent.target, intent.value, calldata);
console.log("  exact match:", exactMatch);

// simulate relayer mutation — change amount by 1 wei
const mutatedCalldata = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100001"
) as `0x${string}`;

const mutatedMatch = executionMatchesIntent(intent, intent.target, intent.value, mutatedCalldata);
console.log("  mutation blocked:", !mutatedMatch, "\n");

// ---------------------------------------------------------------------------
// Step 7: Deadline
// ---------------------------------------------------------------------------
console.log("Step 7: Deadline");
console.log("  valid:", isDeadlineValid(intent), "\n");

// ---------------------------------------------------------------------------
// Step 8: Encode args
// ---------------------------------------------------------------------------
console.log("Step 8: Encode args");
const encoded = encodeIntentArgs(intent, signed.signer, signed.signature);
console.log("  bytes:", (encoded.length - 2) / 2, "\n");

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("=== Summary ===");
console.log({
  valid,
  recoveredMatches: recovered.toLowerCase() === signed.signer.toLowerCase(),
  exactMatch,
  mutationBlocked: !mutatedMatch,
});
