// examples/execution-intent/index.ts
//
// Flow B: Execution Intent - atomic commitment
//
// This example is fully runnable. It uses a local private key to sign
// a real EIP-712 execution intent, verifies the signature, recovers
// the signer, and encodes the args for on-chain submission.
//
// Run: npx tsx examples/execution-intent/index.ts

import {
  createIntent,
  signIntent,
  verifySignedIntent,
  recoverIntentSigner,
  matchesExecution,
  isDeadlineValid,
  encodeIntentArgs,
  hashIntent,
  dataHash,
  defaultDomain,
} from "../../src/index.js";

// ---------------------------------------------------------------------------
// Setup: local test wallet (never use a real key in production)
// ---------------------------------------------------------------------------
const PRIVATE_KEY = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;
const ENFORCER_ADDRESS = "0x0000000000000000000000000000000000000001"; // placeholder
const CHAIN_ID = 84532; // Base Sepolia

const domain = defaultDomain(ENFORCER_ADDRESS, CHAIN_ID);

// ---------------------------------------------------------------------------
// Step 1: Create the intent
// ---------------------------------------------------------------------------
console.log("=== Execution Intent Flow ===");
console.log();
console.log("Step 1: Create intent");

const calldata = ("0xa9059cbb" +                                          // transfer(address,uint256)
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +   // to: 0xdeadbeef...
  "0000000000000000000000000000000000000000000000056bc75e2d63100000"    // amount: 100 USDC
) as `0x${string}`;

const intent = createIntent({
  account:  "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // anvil account 0
  target:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", // USDC mainnet
  value:    0n,
  data:     calldata,
  nonce:    1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
});

console.log("  account: ", intent.account);
console.log("  target:  ", intent.target);
console.log("  nonce:   ", intent.nonce.toString());
console.log("  deadline:", intent.deadline.toString());
console.log("  dataHash:", dataHash(intent));
console.log();

// ---------------------------------------------------------------------------
// Step 2: Hash the intent (EIP-712 digest)
// ---------------------------------------------------------------------------
console.log("Step 2: Hash intent (EIP-712 digest)");
const digest = hashIntent(intent, domain);
console.log("  digest:", digest);
console.log();

// ---------------------------------------------------------------------------
// Step 3: Sign the intent
// ---------------------------------------------------------------------------
console.log("Step 3: Sign intent with authorized signer");
const signed = await signIntent(intent, domain, PRIVATE_KEY);
console.log("  signer:   ", signed.signer);
console.log("  signature:", signed.signature.slice(0, 20) + "...");
console.log();

// ---------------------------------------------------------------------------
// Step 4: Verify the signature
// ---------------------------------------------------------------------------
console.log("Step 4: Verify signature");
const valid = await verifySignedIntent(signed, domain);
console.log("  valid:", valid);
console.log();

// ---------------------------------------------------------------------------
// Step 5: Recover signer from signature
// ---------------------------------------------------------------------------
console.log("Step 5: Recover signer from signature");
const recovered = await recoverIntentSigner(intent, domain, signed.signature);
console.log("  recovered:", recovered);
console.log("  matches:  ", recovered.toLowerCase() === signed.signer.toLowerCase());
console.log();

// ---------------------------------------------------------------------------
// Step 6: Check execution matching (what enforcer does on-chain)
// ---------------------------------------------------------------------------
console.log("Step 6: Check execution matching");
const exactMatch = matchesExecution(intent, intent.target, intent.value, calldata);
console.log("  exact match (correct calldata):", exactMatch);

const mutatedCalldata = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100001" // +1 wei mutation
) as `0x${string}`;
const mutatedMatch = matchesExecution(intent, intent.target, intent.value, mutatedCalldata);
console.log("  exact match (mutated calldata): ", mutatedMatch);
console.log();

// ---------------------------------------------------------------------------
// Step 7: Check deadline
// ---------------------------------------------------------------------------
console.log("Step 7: Check deadline validity");
console.log("  deadline valid:", isDeadlineValid(intent));
console.log();

// ---------------------------------------------------------------------------
// Step 8: Encode args for on-chain submission
// ---------------------------------------------------------------------------
console.log("Step 8: Encode args for enforcer beforeHook");
const encoded = encodeIntentArgs(intent, signed.signer, signed.signature);
console.log("  encoded args (first 66 chars):", encoded.slice(0, 66) + "...");
console.log("  total bytes:", (encoded.length - 2) / 2);
console.log();

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------
console.log("=== Summary ===");
console.log("Intent created:      yes");
console.log("EIP-712 digest:      ", digest.slice(0, 20) + "...");
console.log("Signature valid:     ", valid);
console.log("Signer recovered:    ", recovered.toLowerCase() === signed.signer.toLowerCase());
console.log("Execution matches:   ", exactMatch);
console.log("Mutation blocked:    ", !mutatedMatch);
console.log("Deadline valid:      ", isDeadlineValid(intent));
console.log("Args encoded:        yes,", (encoded.length - 2) / 2, "bytes");
console.log();
console.log("This flow is what the on-chain enforcer verifies at redemption.");
console.log("All guarantees are bound in one signed artifact.");
