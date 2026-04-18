// src/relayer.ts
// Relayer / backend helper surface.
//
// Provides the clean object a relayer or backend would consume when
// forwarding an execution intent to an on-chain enforcer.

import { encodeIntentArgs, executionMatchesIntent, isDeadlineValid } from "./intent.js";
import { dataHash } from "./eip712.js";
import type { ExecutionIntent, SignedIntent } from "./types.js";

// ---------------------------------------------------------------------------
// RelayerPayload
// Stable shape. intent_type is always first — it is a routing key.
// ---------------------------------------------------------------------------
export interface RelayerPayload {
  intent_type:  "ExecutionBoundIntent"; // routing key — always first
  account:      string;
  signer:       string;
  target:       string;
  value:        bigint;
  calldata:     string;
  nonce:        bigint;
  deadline:     bigint;
  dataHash:     `0x${string}`;
  encodedArgs:  `0x${string}`;
  deadlineValid: boolean;
}

export function prepareRelayerPayload(signed: SignedIntent): RelayerPayload {
  const { intent, signer, signature } = signed;
  return {
    intent_type:   "ExecutionBoundIntent",
    account:       intent.account,
    signer,
    target:        intent.target,
    value:         intent.value,
    calldata:      intent.data,
    nonce:         intent.nonce,
    deadline:      intent.deadline,
    dataHash:      dataHash(intent),
    encodedArgs:   encodeIntentArgs(intent, signer, signature),
    deadlineValid: isDeadlineValid(intent),
  };
}

// ---------------------------------------------------------------------------
// Failure classification
// ---------------------------------------------------------------------------
export type FailureCode =
  | "DEADLINE_EXPIRED"
  | "EXECUTION_MISMATCH"
  | "NONCE_REUSE_RISK"
  | "INVALID_SIGNATURE";

export interface ValidationResult {
  valid:   boolean;
  reasons: string[];
  codes:   FailureCode[];
}

export function validateBeforeSubmission(
  signed:          SignedIntent,
  executionTarget: string,
  executionValue:  bigint,
  executionData:   string
): ValidationResult {
  const reasons: string[] = [];
  const codes:   FailureCode[] = [];

  if (!isDeadlineValid(signed.intent)) {
    reasons.push("intent deadline has passed");
    codes.push("DEADLINE_EXPIRED");
  }

  if (!executionMatchesIntent(signed.intent, executionTarget, executionValue, executionData)) {
    reasons.push("execution does not match signed intent (target, value, or calldata mismatch)");
    codes.push("EXECUTION_MISMATCH");
  }

  if (!signed.signature || signed.signature.length < 132) {
    reasons.push("signature appears malformed");
    codes.push("INVALID_SIGNATURE");
  }

  // NONCE_REUSE_RISK: SDK cannot check on-chain state, but can flag suspicious patterns
  if (signed.intent.nonce === 0n) {
    // nonce 0 is valid but commonly reused in tests/dev — flag for awareness
    // In production, check usedNonces[account][signer][nonce] on-chain before submitting
    reasons.push("nonce is 0 — verify this nonce has not been used on-chain");
    codes.push("NONCE_REUSE_RISK");
  }

  return { valid: reasons.length === 0, reasons, codes };
}

// ---------------------------------------------------------------------------
// Structured log entry
// intent_type is always first — routing key for downstream systems
// ---------------------------------------------------------------------------
export function buildRelayerLogEntry(payload: RelayerPayload): Record<string, string> {
  return {
    intent_type:    payload.intent_type,
    account:        payload.account,
    signer:         payload.signer,
    target:         payload.target,
    nonce:          payload.nonce.toString(),
    deadline:       payload.deadline.toString(),
    deadline_valid: payload.deadlineValid.toString(),
    data_hash:      payload.dataHash,
  };
}

// ---------------------------------------------------------------------------
// External nonce coordination
//
// The SDK generates nonces locally. Production systems must coordinate externally.
//
// Example interface for a nonce store (Redis, DB, etc.):
//
//   interface NonceStore {
//     getNext(account: string, signer: string): Promise<bigint>;
//     markUsed(account: string, signer: string, nonce: bigint): Promise<void>;
//   }
//
// Example relayer integration:
//
//   const nonce = await nonceStore.getNext(account, signer);
//   const intent = createIntent({ ..., nonce });
//   const signed = await signIntent(intent, domain, privateKey);
//   await nonceStore.markUsed(account, signer, nonce);
//   const payload = prepareRelayerPayload(signed);
//   // submit payload.encodedArgs to DelegationManager
//
// What the SDK guarantees:
//   - correct encoding of whatever nonce is provided
//   - offchain validation via validateBeforeSubmission
//
// What the SDK does NOT guarantee:
//   - global uniqueness across workers
//   - on-chain nonce state queries
//   - distributed deduplication
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Multi-call stance
// Current model: single call per intent (ExecutionLib.encodeSingle).
// Batch/multicall is not supported in v1.
// TODO: BatchExecutionIntent type for future extension.
// ---------------------------------------------------------------------------
