// src/relayer.ts
// Relayer / backend helper surface.
//
// Provides the clean object a relayer or backend would consume when
// forwarding an execution intent to an on-chain enforcer.
//
// These helpers do not add networking or server logic.
// They bundle the fields that matter for relayer workflows:
// - what to submit on-chain (encodedArgs)
// - what to log (intent metadata)
// - what to verify before forwarding (offchain checks)

import { encodeIntentArgs, executionMatchesIntent, isDeadlineValid } from "./intent.js";
import { dataHash } from "./eip712.js";
import type { ExecutionIntent, SignedIntent } from "./types.js";

// ---------------------------------------------------------------------------
// RelayerPayload
// The canonical object a relayer submits to the enforcer.
// ---------------------------------------------------------------------------
export interface RelayerPayload {
  // ABI-encoded args for the enforcer's beforeHook call
  encodedArgs:  `0x${string}`;

  // Fields for logging, metrics, and routing
  intentType:   "ExecutionBoundIntent";
  account:      string;
  target:       string;
  value:        bigint;
  dataHash:     `0x${string}`;
  nonce:        bigint;
  deadline:     bigint;
  signer:       string;

  // Offchain validation results (computed before submission)
  deadlineValid: boolean;
}

// Build the payload a relayer/backend would use to submit an intent.
// Performs offchain validation before encoding.
// Does not submit — that is the relayer's responsibility.
export function prepareRelayerPayload(signed: SignedIntent): RelayerPayload {
  const { intent, signer, signature } = signed;

  return {
    encodedArgs:   encodeIntentArgs(intent, signer, signature),
    intentType:    "ExecutionBoundIntent",
    account:       intent.account,
    target:        intent.target,
    value:         intent.value,
    dataHash:      dataHash(intent),
    nonce:         intent.nonce,
    deadline:      intent.deadline,
    signer,
    deadlineValid: isDeadlineValid(intent),
  };
}

// ---------------------------------------------------------------------------
// Pre-submission validation
// Run before forwarding to catch obvious issues offchain.
// ---------------------------------------------------------------------------
export interface ValidationResult {
  valid:   boolean;
  reasons: string[];
}

export function validateBeforeSubmission(
  signed:          SignedIntent,
  executionTarget: string,
  executionValue:  bigint,
  executionData:   string
): ValidationResult {
  const reasons: string[] = [];

  if (!isDeadlineValid(signed.intent)) {
    reasons.push("intent deadline has passed");
  }

  if (!executionMatchesIntent(signed.intent, executionTarget, executionValue, executionData)) {
    reasons.push("execution does not match signed intent (target, value, or calldata mismatch)");
  }

  if (!signed.signature || signed.signature.length < 130) {
    reasons.push("signature appears malformed");
  }

  return {
    valid:   reasons.length === 0,
    reasons,
  };
}

// ---------------------------------------------------------------------------
// Relayer log line
// Structured log entry for relayer infra.
// intent_type is always first — it is a routing key, not metadata.
// ---------------------------------------------------------------------------
export function buildRelayerLogEntry(payload: RelayerPayload): Record<string, string> {
  return {
    intent_type:   payload.intentType,
    account:       payload.account,
    signer:        payload.signer,
    target:        payload.target,
    nonce:         payload.nonce.toString(),
    deadline:      payload.deadline.toString(),
    deadline_valid: payload.deadlineValid.toString(),
    data_hash:     payload.dataHash,
  };
}
