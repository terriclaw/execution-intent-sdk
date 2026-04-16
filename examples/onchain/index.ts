// examples/onchain/index.ts
//
// Onchain Integration Example
//
// Demonstrates a full end-to-end flow:
//   1. Start Anvil (local chain)
//   2. Deploy MinimalIntentVerifier
//   3. Create and sign an ExecutionIntent
//   4. Submit to the verifier contract
//   5. Show success
//   6. Show mutation failure
//
// Requirements:
//   - Anvil running: anvil
//   - PRIVATE_KEY set (use Anvil account 0: 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80)
//
// Run:
//   anvil &
//   export PRIVATE_KEY=0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
//   npx tsx examples/onchain/index.ts

import "dotenv/config";
import { createPublicClient, createWalletClient, http, parseAbi, encodeAbiParameters, parseAbiParameters, keccak256 } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import {
  createIntent,
  signIntent,
  dataHash,
  defaultDomain,
} from "../../src/index.js";

const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY");

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient = createPublicClient({ chain: anvil, transport: http() });
const walletClient = createWalletClient({ account, chain: anvil, transport: http() });

// ---------------------------------------------------------------------------
// Contract ABI (subset needed for this example)
// ---------------------------------------------------------------------------
const VERIFIER_ABI = parseAbi([
  "constructor()",
  "function verifyAndConsume(tuple(address account,address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline) intent, address signer, bytes signature, address target, uint256 value, bytes callData) external",
  "function usedNonces(address,address,uint256) external view returns (bool)",
  "event IntentExecuted(address indexed account, address indexed signer, uint256 nonce)",
  "error AccountMismatch()",
  "error TargetMismatch()",
  "error ValueMismatch()",
  "error DataHashMismatch()",
  "error IntentExpired()",
  "error NonceAlreadyUsed()",
  "error InvalidSignature()",
]);

// ---------------------------------------------------------------------------
// Deploy MinimalIntentVerifier
// ---------------------------------------------------------------------------
// Bytecode compiled from MinimalIntentVerifier.sol
// For a real flow, compile with Foundry or hardhat.
// This example uses a pre-compiled placeholder — replace with real bytecode.
const VERIFIER_BYTECODE = "0x" as `0x${string}`;

async function deployVerifier(): Promise<`0x${string}`> {
  console.log("Deploying MinimalIntentVerifier...");
  console.log("(In a real flow: compile with 'forge build' and use the bytecode from out/)");
  console.log("Skipping actual deployment — showing the flow structure only.");
  // In a real flow:
  // const hash = await walletClient.deployContract({ abi: VERIFIER_ABI, bytecode: VERIFIER_BYTECODE });
  // const receipt = await publicClient.waitForTransactionReceipt({ hash });
  // return receipt.contractAddress!;
  return "0x0000000000000000000000000000000000000001";
}

// ---------------------------------------------------------------------------
// Main flow
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Onchain Integration Example ===");
  console.log("Chain: Anvil (local)");
  console.log("Signer:", account.address);
  console.log();

  // Step 1: Deploy
  const verifierAddress = await deployVerifier();
  console.log("Verifier:", verifierAddress);
  console.log();

  // Step 2: Build domain using deployed verifier address
  const domain = defaultDomain(verifierAddress, anvil.id);

  // Step 3: Create intent
  const calldata = ("0xa9059cbb" +
    "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
    "0000000000000000000000000000000000000000000000056bc75e2d63100000"
  ) as `0x${string}`;

  const intent = createIntent({
    account:  account.address,
    target:   "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
    value:    0n,
    data:     calldata,
    nonce:    1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  });

  console.log("Step 1: Intent created");
  console.log("  dataHash:", dataHash(intent));
  console.log();

  // Step 4: Sign
  const signed = await signIntent(intent, domain, PRIVATE_KEY);
  console.log("Step 2: Intent signed");
  console.log("  signer:", signed.signer);
  console.log();

  // Step 5: Submit to contract (structure shown — requires real deployment)
  console.log("Step 3: Submit to verifier contract");
  console.log("  In a real flow:");
  console.log("  await walletClient.writeContract({");
  console.log("    address:      verifierAddress,");
  console.log("    abi:          VERIFIER_ABI,");
  console.log("    functionName: 'verifyAndConsume',");
  console.log("    args: [");
  console.log("      { account, target, value, dataHash, nonce, deadline },");
  console.log("      signer,");
  console.log("      signature,");
  console.log("      target,");
  console.log("      value,");
  console.log("      calldata,");
  console.log("    ],");
  console.log("  });");
  console.log();

  // Step 6: Show mutation failure
  console.log("Step 4: Mutation case");
  const mutated = ("0xa9059cbb" +
    "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
    "0000000000000000000000000000000000000000000000056bc75e2d63100001"
  ) as `0x${string}`;
  console.log("  Original dataHash:   ", dataHash(intent));
  const mutatedIntent = createIntent({ ...intent, data: mutated });
  console.log("  Mutated dataHash:    ", dataHash(mutatedIntent));
  console.log("  Hashes match:", dataHash(intent) === dataHash(mutatedIntent));
  console.log("  On-chain: DataHashMismatch revert would fire");
  console.log();

  console.log("=== Flow complete ===");
  console.log("To run with real contract deployment:");
  console.log("  1. forge build examples/onchain/contracts/");
  console.log("  2. Replace VERIFIER_BYTECODE with compiled output");
  console.log("  3. Run with Anvil: anvil & npx tsx examples/onchain/index.ts");
}

main().catch(console.error);
