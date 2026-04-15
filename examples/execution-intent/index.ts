// examples/execution-intent/index.ts
//
// Flow B: Execution Intent (atomic commitment)
//
// Goal: safe third-party execution on behalf of a user.
//
// In the execution intent model, all guarantees are bundled into a single
// EIP-712 signed artifact at redemption time:
//   - exact calldata (dataHash)
//   - signer binding (explicit authorized signer)
//   - nonce (per-execution replay protection)
//   - deadline (expiry)
//
// A specific signer signs this artifact at redemption time — not at delegation time.
// The enforcer verifies all fields together as one atomic commitment.
//
// When to use this:
//   - when a specific agent/relayer must authorize exact execution
//   - when calldata is determined close to execution, not at delegation time
//   - when partial satisfaction changes the trust assumption

import { createIntent, buildSigningPayload, wrapSignedIntent, defaultDomain, verifyIntentMatch } from "../../src/index.js";

console.log("=== Flow B: Execution Intent (Atomic Commitment) ===");
console.log();

// Step 1: Build the execution intent
// This is done close to execution time, not at delegation time.
const intent = createIntent({
  account:  "0xAlice",           // the smart account
  target:   "0xUSDC",            // USDC contract
  value:    0n,
  data:     "0xa9059cbb" +        // transfer(address,uint256)
            "000000000000000000000000Bob00000000000000000000000000000000000000" +
            "0000000000000000000000000000000000000000000000056bc75e2d63100000", // 100 USDC
  nonce:    1n,
  deadline: BigInt(Math.floor(Date.now() / 1000) + 3600), // 1 hour
});

console.log("Step 1: ExecutionIntent created");
console.log("  account: ", intent.account);
console.log("  target:  ", intent.target);
console.log("  nonce:   ", intent.nonce);
console.log("  deadline:", intent.deadline);
console.log();

// Step 2: Build signing payload
// All fields are committed together in one EIP-712 artifact.
const domain = defaultDomain("0xExecutionBoundCaveat", 84532); // Base Sepolia
const signingPayload = buildSigningPayload(intent, domain);

console.log("Step 2: EIP-712 signing payload built");
console.log("  primaryType:", signingPayload.primaryType);
console.log("  fields committed together:");
console.log("    account, target, value, dataHash, nonce, deadline");
console.log();

// Step 3: Signer signs the intent
// (in practice: await walletClient.signTypedData(signingPayload))
const signature = "0x<signed-by-authorized-agent>";
const signedIntent = wrapSignedIntent(intent, "0xAuthorizedAgent", signature);

console.log("Step 3: Authorized agent signs the intent");
console.log("  signer:", signedIntent.signer);
console.log("  all fields bound in one signature");
console.log();

// Step 4: Relayer submits with signed intent as caveat args
console.log("Step 4: Relayer submits via DelegationManager.redeemDelegations");
console.log("  caveat args = abi.encode(intent, signer, signature)");
console.log("  enforcer verifies: account, target, value, dataHash, nonce, deadline");
console.log("  all checked together — partial satisfaction reverts");
console.log();

// Step 5: Verify intent match (what the enforcer does on-chain)
const matches = verifyIntentMatch(
  intent,
  intent.target,
  intent.value,
  intent.data
);

console.log("Step 5: Enforcement check");
console.log("  intent matches execution:", matches);
console.log();

console.log("Result: all guarantees enforced as one atomic commitment.");
console.log();
console.log("Tradeoff:");
console.log("  + single signed artifact at redemption time");
console.log("  + explicit signer binding (agent/relayer must authorize)");
console.log("  + partial satisfaction reverts (all-or-nothing)");
console.log("  + calldata determined at redemption, not delegation time");
console.log("  - less flexible: all guarantees are bundled");
console.log("  - requires explicit signer at redemption time");
