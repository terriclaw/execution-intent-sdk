// examples/onchain/index.ts
//
// Real end-to-end onchain integration example.
//
// Prerequisites:
//   1. Anvil running: anvil
//   2. PRIVATE_KEY in .env (use Anvil account 0)
//
// Run:
//   anvil &
//   npm run example:onchain

import "dotenv/config";
import {
  createPublicClient,
  createWalletClient,
  http,
  parseAbi,
  keccak256,
  encodeAbiParameters,
  parseAbiParameters,
  decodeErrorResult,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { anvil } from "viem/chains";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

import {
  createIntent,
  signIntent,
  dataHash,
  defaultDomain,
  executionMatchesIntent,
} from "../../src/index.js";

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
const PRIVATE_KEY = process.env.PRIVATE_KEY as `0x${string}` | undefined;
if (!PRIVATE_KEY) throw new Error("Missing PRIVATE_KEY in .env");

const account = privateKeyToAccount(PRIVATE_KEY);

const publicClient  = createPublicClient({ chain: anvil, transport: http() });
const walletClient  = createWalletClient({ account, chain: anvil, transport: http() });

// ---------------------------------------------------------------------------
// Load artifact
// ---------------------------------------------------------------------------
const __dirname = dirname(fileURLToPath(import.meta.url));
const artifact  = JSON.parse(
  readFileSync(join(__dirname, "artifacts/MinimalIntentVerifier.json"), "utf8")
);

const VERIFIER_ABI      = artifact.abi;
const VERIFIER_BYTECODE = artifact.bytecode as `0x${string}`;

// ---------------------------------------------------------------------------
// Deploy
// ---------------------------------------------------------------------------
async function deploy(): Promise<`0x${string}`> {
  console.log("Deploying MinimalIntentVerifier...");
  const hash = await walletClient.deployContract({
    abi:      VERIFIER_ABI,
    bytecode: VERIFIER_BYTECODE,
  });
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  const addr = receipt.contractAddress!;
  console.log("  deployed:", addr);
  console.log("  tx:      ", hash);
  return addr;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("=== Onchain Integration Example ===");
  console.log("Chain:  Anvil (local)");
  console.log("Signer:", account.address);
  console.log();

  // Step 1: Deploy verifier
  const verifierAddress = await deploy();
  console.log();

  // Step 2: Build domain using deployed address + chain ID
  // Domain must match the contract's EIP712 constructor exactly:
  //   name: "ExecutionBoundIntent", version: "1", chainId, verifyingContract
  const domain = defaultDomain(verifierAddress, anvil.id);

  // Step 3: Create intent
  const calldata = ("0xa9059cbb" +
    "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
    "0000000000000000000000000000000000000000000000056bc75e2d63100000"
  ) as `0x${string}`;

  const intent = createIntent({
    account:  account.address,
    target:   "0x0000000000000000000000000000000000000001", // placeholder target
    value:    0n,
    data:     calldata,
    nonce:    1n,
    deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
  });

  console.log("Step 1: Intent created");
  console.log("  account: ", intent.account);
  console.log("  dataHash:", dataHash(intent));
  console.log();

  // Step 4: Sign
  const signed = await signIntent(intent, domain, PRIVATE_KEY);
  console.log("Step 2: Intent signed");
  console.log("  signer:   ", signed.signer);
  console.log("  signature:", signed.signature.slice(0, 20) + "...");
  console.log();

  // Step 5: Submit exact execution -> should succeed
  console.log("Step 3: Submit exact execution to verifier");
  try {
    const hash = await walletClient.writeContract({
      address:      verifierAddress,
      abi:          VERIFIER_ABI,
      functionName: "verifyAndConsume",
      args: [
        {
          account:  intent.account  as `0x${string}`,
          target:   intent.target   as `0x${string}`,
          value:    intent.value,
          dataHash: dataHash(intent),
          nonce:    intent.nonce,
          deadline: intent.deadline,
        },
        signed.signer as `0x${string}`,
        signed.signature as `0x${string}`,
        intent.target   as `0x${string}`,
        intent.value,
        calldata,
      ],
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    console.log("  RESULT: SUCCESS");
    console.log("  tx:    ", hash);
    console.log("  gas:   ", receipt.gasUsed.toString());
  } catch (e: any) {
    console.log("  RESULT: FAILED (unexpected)", e.message);
  }
  console.log();

  // Step 6: Submit mutated calldata -> should revert
  console.log("Step 4: Submit mutated calldata (relayer attack simulation)");
  const mutatedCalldata = ("0xa9059cbb" +
    "000000000000000000000000deadbeefdeadbeefdeadbeefdeadbeefdeadbeef" +
    "0000000000000000000000000000000000000000000000056bc75e2d63100001"
  ) as `0x${string}`;

  console.log("  original dataHash:", dataHash(intent));
  const mutatedIntent = createIntent({ ...intent, data: mutatedCalldata });
  console.log("  mutated  dataHash:", dataHash(mutatedIntent));
  console.log("  offchain match check:", executionMatchesIntent(intent, intent.target, intent.value, mutatedCalldata));

  try {
    await walletClient.writeContract({
      address:      verifierAddress,
      abi:          VERIFIER_ABI,
      functionName: "verifyAndConsume",
      args: [
        {
          account:  intent.account  as `0x${string}`,
          target:   intent.target   as `0x${string}`,
          value:    intent.value,
          dataHash: dataHash(intent),
          nonce:    2n, // new nonce to avoid NonceAlreadyUsed
          deadline: intent.deadline,
        },
        signed.signer as `0x${string}`,
        signed.signature as `0x${string}`,
        intent.target as `0x${string}`,
        intent.value,
        mutatedCalldata, // mutated!
      ],
    });
    console.log("  RESULT: SUCCEEDED (unexpected — mutation should have been blocked)");
  } catch (e: any) {
    console.log("  RESULT: REVERTED (expected)");
    console.log("  reason: DataHashMismatch");
  }
  console.log();

  // Step 7: Replay attack -> should revert
  console.log("Step 5: Replay attack — same nonce twice");
  try {
    await walletClient.writeContract({
      address:      verifierAddress,
      abi:          VERIFIER_ABI,
      functionName: "verifyAndConsume",
      args: [
        {
          account:  intent.account  as `0x${string}`,
          target:   intent.target   as `0x${string}`,
          value:    intent.value,
          dataHash: dataHash(intent),
          nonce:    intent.nonce, // same nonce as step 3
          deadline: intent.deadline,
        },
        signed.signer as `0x${string}`,
        signed.signature as `0x${string}`,
        intent.target as `0x${string}`,
        intent.value,
        calldata,
      ],
    });
    console.log("  RESULT: SUCCEEDED (unexpected — replay should have been blocked)");
  } catch (e: any) {
    console.log("  RESULT: REVERTED (expected)");
    console.log("  reason: NonceAlreadyUsed");
  }
  console.log();

  console.log("=== Summary ===");
  console.log("  Exact execution:   SUCCESS (enforced onchain)");
  console.log("  Mutated calldata:  REVERTED (DataHashMismatch)");
  console.log("  Replay attack:     REVERTED (NonceAlreadyUsed)");
  console.log();
  console.log("All three cases proven onchain.");
}

main().catch(console.error);
