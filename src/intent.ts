// intent.ts
// Builder and verification helpers for ExecutionIntent.

import { keccak256 } from "viem";
import type { ExecutionIntent } from "./types.js";
import { dataHash } from "./eip712.js";

// Build an ExecutionIntent.
// dataHash is computed from the full calldata internally.
export function createIntent(params: {
  account:  string;
  target:   string;
  value:    bigint;
  data:     string;   // full calldata — will be hashed internally
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

// Verify that an execution matches a signed intent.
// Returns true if all fields match exactly.
export function verifyIntentMatch(
  intent:          ExecutionIntent,
  executionTarget: string,
  executionValue:  bigint,
  executionData:   string
): boolean {
  return (
    intent.target.toLowerCase()  === executionTarget.toLowerCase() &&
    intent.value                 === executionValue &&
    dataHash(intent)             === keccak256(executionData as `0x${string}`)
  );
}

// Encode args for caveat beforeHook (delegation-framework compatible).
// args = abi.encode(ExecutionIntent, address signer, bytes signature)
export function encodeIntentArgs(
  intent:    ExecutionIntent,
  signer:    string,
  signature: string
): string {
  // Compact representation for documentation purposes.
  // In production, use abi.encode matching the enforcer's decoding.
  return JSON.stringify({
    intent: {
      account:  intent.account,
      target:   intent.target,
      value:    intent.value.toString(),
      dataHash: dataHash(intent),
      nonce:    intent.nonce.toString(),
      deadline: intent.deadline.toString(),
    },
    signer,
    signature,
  });
}
