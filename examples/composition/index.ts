// examples/composition/index.ts
//
// Flow A: Composable guarantees (delegation-framework style)
//
// This example shows the composable path with real EIP-712 signing,
// real encoded caveat terms, and concrete data structures.
//
// We simulate the delegation-framework shape without importing the full framework.
// All cryptographic steps are real. The boundary is assembled from pieces.
//
// Run:
//   npm run example:composition

import "dotenv/config";
import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters, hashTypedData } from "viem";
import { privateKeyToAccount } from "viem/accounts";

const PRIVATE_KEY = (process.env.PRIVATE_KEY ?? "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80") as `0x${string}`;
const account = privateKeyToAccount(PRIVATE_KEY);

console.log("=== Flow A: Composable Guarantees ===");
console.log("Signer:", account.address);
console.log();

// ---------------------------------------------------------------------------
// Step 1: Define the execution target
// Same scenario as Flow B: agent executes a USDC transfer on behalf of user.
// ---------------------------------------------------------------------------
const calldata = ("0xa9059cbb" +
  "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
  "0000000000000000000000000000000000000000000000056bc75e2d63100000"
) as `0x${string}`;

const target   = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48"; // USDC
const value    = 0n;
const delegate = "0x0000000000000000000000000000000000000099";
const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
const delegationId = 1n;

console.log("Step 1: Execution target defined");
console.log("  target:  ", target);
console.log("  calldata:", calldata.slice(0, 10) + "... (" + (calldata.length - 2) / 2 + " bytes)");
console.log();

// ---------------------------------------------------------------------------
// Step 2: Build caveat terms — each guarantee is a separate encoded term
// ---------------------------------------------------------------------------

// ExactExecutionEnforcer: commits to exact calldata at delegation time
// terms = abi.encode(target, value, calldata)
const exactExecutionTerms = encodeAbiParameters(
  parseAbiParameters("address target, uint256 value, bytes calldata"),
  [target as `0x${string}`, value, calldata]
);

// IdEnforcer: single-use delegation ID
// terms = abi.encode(uint256 id)
const idEnforcerTerms = encodeAbiParameters(
  parseAbiParameters("uint256 id"),
  [delegationId]
);

// TimestampEnforcer: deadline bound
// terms = abi.encode(uint128 afterTimestamp, uint128 beforeTimestamp)
const timestampEnforcerTerms = encodeAbiParameters(
  parseAbiParameters("uint128 afterTimestamp, uint128 beforeTimestamp"),
  [0n, deadline]
);

console.log("Step 2: Caveat terms encoded");
console.log("  ExactExecutionEnforcer terms:", exactExecutionTerms.slice(0, 20) + "...", "(" + (exactExecutionTerms.length - 2) / 2 + " bytes)");
console.log("  IdEnforcer terms:            ", idEnforcerTerms.slice(0, 20) + "...", "(" + (idEnforcerTerms.length - 2) / 2 + " bytes)");
console.log("  TimestampEnforcer terms:     ", timestampEnforcerTerms.slice(0, 20) + "...", "(" + (timestampEnforcerTerms.length - 2) / 2 + " bytes)");
console.log();

// ---------------------------------------------------------------------------
// Step 3: Assemble delegation with stacked caveats
// Shape mirrors delegation-framework Delegation struct
// ---------------------------------------------------------------------------
const delegation = {
  delegate:   delegate,
  delegator:  account.address,
  authority:  "0x0000000000000000000000000000000000000000000000000000000000000000" as `0x${string}`,
  caveats: [
    {
      enforcer: "0x0000000000000000000000000000000000000011",
      value:    0n,
      terms:    exactExecutionTerms,
    },
    {
      enforcer: "0x0000000000000000000000000000000000000012",
      value:    0n,
      terms:    idEnforcerTerms,
    },
    {
      enforcer: "0x0000000000000000000000000000000000000013",
      value:    0n,
      terms:    timestampEnforcerTerms,
    },
  ],
  salt:  0n,
  signature: "0x" as `0x${string}`,
};

console.log("Step 3: Delegation assembled with stacked caveats");
console.log("  delegator:", delegation.delegator);
console.log("  delegate: ", delegation.delegate);
console.log("  caveats:  ", delegation.caveats.length, "independent enforcers");
delegation.caveats.forEach((c, i) => {
  console.log("    [" + i + "]", c.enforcer.slice(0, 20) + "...");
});
console.log();

// ---------------------------------------------------------------------------
// Step 4: Hash the delegation for signing (EIP-712 style)
// ---------------------------------------------------------------------------
const CAVEAT_TYPEHASH = keccak256(encodePacked(
  ["string"],
  ["Caveat(address enforcer,uint256 value,bytes terms)"]
));

const DELEGATION_TYPEHASH = keccak256(encodePacked(
  ["string"],
  ["Delegation(address delegate,address delegator,bytes32 authority,bytes32 caveatsHash,uint256 salt)"]
));

function hashCaveat(caveat: typeof delegation.caveats[0]): `0x${string}` {
  return keccak256(encodeAbiParameters(
    parseAbiParameters("bytes32 typehash, address enforcer, uint256 value, bytes32 termsHash"),
    [CAVEAT_TYPEHASH, caveat.enforcer as `0x${string}`, caveat.value, keccak256(caveat.terms as `0x${string}`)]
  ));
}

const caveatsHash = keccak256(encodePacked(
  ["bytes32", "bytes32", "bytes32"],
  delegation.caveats.map(hashCaveat) as [`0x${string}`, `0x${string}`, `0x${string}`]
));

const delegationHash = keccak256(encodeAbiParameters(
  parseAbiParameters("bytes32 typehash, address delegate, address delegator, bytes32 authority, bytes32 caveatsHash, uint256 salt"),
  [
    DELEGATION_TYPEHASH,
    delegation.delegate as `0x${string}`,
    delegation.delegator as `0x${string}`,
    delegation.authority,
    caveatsHash,
    delegation.salt,
  ]
));

console.log("Step 4: Delegation hashed (EIP-712 struct hash)");
console.log("  caveatsHash:    ", caveatsHash);
console.log("  delegationHash: ", delegationHash);
console.log();

// ---------------------------------------------------------------------------
// Step 5: Sign the delegation
// Delegator signs over: who may redeem + what caveats apply
// ---------------------------------------------------------------------------
const domainSeparator = keccak256(encodeAbiParameters(
  parseAbiParameters("bytes32 typeHash, bytes32 name, bytes32 version, uint256 chainId, address verifyingContract"),
  [
    keccak256(encodePacked(["string"], ["EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"])),
    keccak256(encodePacked(["string"], ["DelegationManager"])),
    keccak256(encodePacked(["string"], ["1"])),
    1n,
    "0x0000000000000000000000000000000000000001" as `0x${string}`,
  ]
));

const delegationDigest = keccak256(encodePacked(
  ["bytes2", "bytes32", "bytes32"],
  ["0x1901", domainSeparator, delegationHash]
));

const delegationSignature = await account.sign({ hash: delegationDigest });

console.log("Step 5: Delegation signed by delegator");
console.log("  digest:    ", delegationDigest);
console.log("  signature: ", delegationSignature.slice(0, 20) + "...");
console.log();

// ---------------------------------------------------------------------------
// Step 6: Show how enforcement works at redemption
// Each caveat is checked independently by the DelegationManager
// ---------------------------------------------------------------------------
console.log("Step 6: Enforcement at redemption (how DelegationManager processes this)");
console.log("  DelegationManager verifies delegation signature");
console.log("  Then calls each caveat enforcer in sequence:");
console.log();
console.log("  ExactExecutionEnforcer.beforeHook(terms, args, mode, executionCalldata, ...)");
console.log("    checks: keccak256(actualCalldata) == keccak256(terms.calldata)");
console.log("    terms were committed at delegation time");
console.log();
console.log("  IdEnforcer.beforeHook(terms, ...)");
console.log("    checks: currentNonce[delegationManager][delegator] == terms.id");
console.log("    prevents replay of this delegation");
console.log();
console.log("  TimestampEnforcer.beforeHook(terms, ...)");
console.log("    checks: block.timestamp <= terms.beforeTimestamp");
console.log("    enforces deadline");
console.log();

// ---------------------------------------------------------------------------
// Step 7: Key contrast with execution intent (Flow B)
// ---------------------------------------------------------------------------
console.log("Step 7: Contrast with Execution Intent (Flow B)");
console.log();
console.log("  Composable path:");
console.log("    - calldata committed at delegation time (Step 2)");
console.log("    - guarantees enforced independently by 3 separate contracts");
console.log("    - delegator signs once: who may redeem + caveat structure");
console.log("    - no per-execution authorization from a third-party signer");
console.log();
console.log("  Execution Intent path:");
console.log("    - calldata committed at redemption time");
console.log("    - all guarantees in one signed artifact");
console.log("    - specific signer authorizes each execution independently");
console.log("    - partial satisfaction reverts");
console.log();

console.log("=== Summary ===");
console.log({
  delegator:       delegation.delegator,
  caveatsEncoded:  true,
  delegationSigned: delegationSignature.length > 0,
  exactCalldataTerms: (exactExecutionTerms.length - 2) / 2 + " bytes",
  idTerms:            (idEnforcerTerms.length - 2) / 2 + " bytes",
  timestampTerms:     (timestampEnforcerTerms.length - 2) / 2 + " bytes",
});
