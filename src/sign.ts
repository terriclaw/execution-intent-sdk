// sign.ts
// Signing, verification, and signer recovery for ExecutionIntent.
//
// Uses viem for EIP-712 signing and verification.
// Compatible with any wallet that supports signTypedData.

import {
  recoverTypedDataAddress,
  verifyTypedData,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type { ExecutionIntent, IntentDomain, SignedIntent } from "./types.js";
import { intentTypedData, dataHash, EXECUTION_INTENT_TYPE } from "./eip712.js";

// Returns the typed data payload ready for wallet signing.
// Pass to wallet.signTypedData() or signIntent() below.
export function buildSigningPayload(intent: ExecutionIntent, domain: IntentDomain) {
  return intentTypedData(intent, domain);
}

// Sign an intent with a raw private key.
// Use this in scripts, backends, and agents.
// In browser/wallet contexts, use buildSigningPayload + wallet.signTypedData instead.
export async function signIntent(
  intent:      ExecutionIntent,
  domain:      IntentDomain,
  privateKey:  `0x${string}`
): Promise<SignedIntent> {
  const account = privateKeyToAccount(privateKey);
  const payload = intentTypedData(intent, domain);

  const signature = await account.signTypedData({
    domain:      payload.domain,
    types:       payload.types,
    primaryType: payload.primaryType,
    message:     payload.message,
  });

  return {
    intent,
    signer:    account.address,
    signature,
  };
}

// Verify a signed intent.
// Returns true if the signature was produced by the declared signer.
export async function verifySignedIntent(
  signed: SignedIntent,
  domain: IntentDomain
): Promise<boolean> {
  const payload = intentTypedData(signed.intent, domain);
  return verifyTypedData({
    address:     signed.signer as `0x${string}`,
    domain:      payload.domain,
    types:       payload.types,
    primaryType: payload.primaryType,
    message:     payload.message,
    signature:   signed.signature as `0x${string}`,
  });
}

// Recover the signer address from a signature.
// Useful for relayers and backends verifying intent authenticity.
export async function recoverIntentSigner(
  intent:    ExecutionIntent,
  domain:    IntentDomain,
  signature: string
): Promise<string> {
  const payload = intentTypedData(intent, domain);
  return recoverTypedDataAddress({
    domain:      payload.domain,
    types:       payload.types,
    primaryType: payload.primaryType,
    message:     payload.message,
    signature:   signature as `0x${string}`,
  });
}

// Wrap a pre-existing signature into a SignedIntent.
export function wrapSignedIntent(
  intent:    ExecutionIntent,
  signer:    string,
  signature: string
): SignedIntent {
  return { intent, signer, signature };
}

// Default domain for local/testing purposes.
export function defaultDomain(verifyingContract: string, chainId = 1): IntentDomain {
  return {
    name:    "ExecutionBoundIntent",
    version: "1",
    chainId,
    verifyingContract,
  };
}
