// intent.ts
// Builder, matching, and encoding helpers for ExecutionIntent.

import { keccak256, encodeAbiParameters, parseAbiParameters } from "viem";
import type { ExecutionIntent } from "./types.js";
import { dataHash } from "./eip712.js";

// Build an ExecutionIntent.
// Raw calldata is stored; dataHash is derived on demand.
export function createIntent(params: {
  account:  string;
  target:   string;
  value:    bigint;
  data:     string;   // full calldata hex — hashed internally
  nonce:    bigint;
  deadline: bigint;
}): ExecutionIntent {
  return {
    account:  params.account,
    target:   params.target,
    value:    params.value,
    data:     params.data,
    nonce:    params.nonce,
    deadline: params.deadline,
  };
}

// Check whether an actual execution exactly matches a signed intent.
// This mirrors what the on-chain enforcer checks at redemption.
export function executionMatchesIntent(
  intent:          ExecutionIntent,
  executionTarget: string,
  executionValue:  bigint,
  executionData:   string
): boolean {
  return (
    intent.target.toLowerCase() === executionTarget.toLowerCase() &&
    intent.value                === executionValue &&
    dataHash(intent)            === keccak256(executionData as `0x${string}`)
  );
}

// Check whether an intent's deadline is still valid.
export function isDeadlineValid(intent: ExecutionIntent, nowSeconds?: bigint): boolean {
  if (intent.deadline === 0n) return true;
  const now = nowSeconds ?? BigInt(Math.floor(Date.now() / 1000));
  return now <= intent.deadline;
}

// ABI-encode the args for the caveat beforeHook call.
// Matches the on-chain decoding:
//   abi.decode(_args, (ExecutionIntent, address, bytes))
// where ExecutionIntent is (account, target, value, dataHash, nonce, deadline).
export function encodeIntentArgs(
  intent:    ExecutionIntent,
  signer:    string,
  signature: string
): `0x${string}` {
  return encodeAbiParameters(
    parseAbiParameters([
      "(address account, address target, uint256 value, bytes32 dataHash, uint256 nonce, uint256 deadline) intent",
      "address signer",
      "bytes signature",
    ]),
    [
      {
        account:  intent.account  as `0x${string}`,
        target:   intent.target   as `0x${string}`,
        value:    intent.value,
        dataHash: dataHash(intent),
        nonce:    intent.nonce,
        deadline: intent.deadline,
      },
      signer as `0x${string}`,
      signature as `0x${string}`,
    ]
  );
}
