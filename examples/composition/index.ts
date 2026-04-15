// examples/composition/index.ts
//
// Flow A: Composable guarantees (delegation-framework style)
//
// Goal: safe third-party execution on behalf of a user.
//
// In the composable model, each guarantee is enforced by a separate caveat:
//   - ExactExecutionEnforcer: ensures calldata matches what was committed
//   - NonceEnforcer / IdEnforcer: prevents replay
//   - TimestampEnforcer / BlockNumberEnforcer: enforces expiry
//
// These caveats are stacked on a delegation. Each check is independent.
// The boundary is assembled from pieces, not signed as one artifact.
//
// When to use this:
//   - when guarantees may be reused independently
//   - when the delegation boundary is the trust unit
//   - when composition flexibility is important

console.log("=== Flow A: Composable Guarantees ===");
console.log();

// Step 1: Delegator creates a delegation with stacked caveats
const delegation = {
  delegate:  "0xRelayer",
  delegator: "0xAlice",
  caveats: [
    {
      enforcer: "ExactExecutionEnforcer",
      terms:    "abi.encode(target, value, calldata)",  // committed at delegation time
      note:     "enforces exact calldata match"
    },
    {
      enforcer: "IdEnforcer",
      terms:    "abi.encode(1)",                         // delegation ID = single use
      note:     "prevents delegation replay"
    },
    {
      enforcer: "TimestampEnforcer",
      terms:    "abi.encode(deadline)",                  // expiry bound
      note:     "enforces deadline"
    },
  ]
};

console.log("Delegation created with stacked caveats:");
console.log("  ExactExecutionEnforcer -> enforces exact calldata");
console.log("  IdEnforcer             -> prevents replay");
console.log("  TimestampEnforcer      -> enforces deadline");
console.log();

// Step 2: Delegator signs the delegation
// (in practice: wallet.signTypedData(delegationTypedData))
const delegationSignature = "0x<delegation-sig>";

console.log("Delegator signs delegation (EIP-712 over delegation struct)");
console.log();

// Step 3: Relayer submits via DelegationManager.redeemDelegations
console.log("Relayer submits: DelegationManager.redeemDelegations(...)");
console.log();

// Step 4: DelegationManager calls each caveat enforcer in sequence
console.log("DelegationManager calls each enforcer in sequence:");
console.log("  1. ExactExecutionEnforcer.beforeHook -> checks calldata");
console.log("  2. IdEnforcer.beforeHook             -> checks ID unused");
console.log("  3. TimestampEnforcer.beforeHook      -> checks deadline");
console.log();

console.log("Result: guarantees are satisfied independently, assembled at enforcement time.");
console.log();
console.log("Tradeoff:");
console.log("  + flexible: each caveat can be reused independently");
console.log("  + composable: mix and match guarantees per delegation");
console.log("  - no single artifact that a signer committed to at redemption time");
console.log("  - calldata is fixed at delegation time, not redemption time");
