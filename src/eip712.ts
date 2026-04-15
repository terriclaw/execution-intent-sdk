// eip712.ts
// EIP-712 typed data definitions and hashing for ExecutionIntent.
//
// The signed artifact contains all fields enforced together:
// account, target, value, dataHash, nonce, deadline.
//
// dataHash = keccak256(data) binds the selector and all calldata arguments.
// Signing dataHash instead of raw data keeps the artifact compact and binding.

import { keccak256, encodePacked, encodeAbiParameters, parseAbiParameters, hashTypedData } from "viem";
import type { ExecutionIntent, IntentDomain } from "./types.js";

export const EXECUTION_INTENT_TYPE = [
  { name: "account",  type: "address" },
  { name: "target",   type: "address" },
  { name: "value",    type: "uint256" },
  { name: "dataHash", type: "bytes32" },
  { name: "nonce",    type: "uint256" },
  { name: "deadline", type: "uint256" },
] as const;

export const EXECUTION_INTENT_TYPE_STRING =
  "ExecutionIntent(address account,address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)";

export const EXECUTION_INTENT_TYPEHASH = keccak256(
  encodePacked(["string"], [EXECUTION_INTENT_TYPE_STRING])
);

// Compute keccak256 of the raw calldata.
export function dataHash(intent: ExecutionIntent): `0x${string}` {
  return keccak256(intent.data as `0x${string}`);
}

// Build the EIP-712 typed data payload for wallet signing.
export function intentTypedData(intent: ExecutionIntent, domain: IntentDomain) {
  return {
    domain: {
      name:              domain.name,
      version:           domain.version,
      chainId:           domain.chainId,
      verifyingContract: domain.verifyingContract as `0x${string}`,
    },
    types: {
      ExecutionIntent: EXECUTION_INTENT_TYPE,
    },
    primaryType: "ExecutionIntent" as const,
    message: {
      account:  intent.account  as `0x${string}`,
      target:   intent.target   as `0x${string}`,
      value:    intent.value,
      dataHash: dataHash(intent),
      nonce:    intent.nonce,
      deadline: intent.deadline,
    },
  };
}

// Compute the EIP-712 digest for an intent.
// This is what gets signed — and what the on-chain enforcer recomputes.
export function hashIntent(intent: ExecutionIntent, domain: IntentDomain): `0x${string}` {
  return hashTypedData(intentTypedData(intent, domain));
}
