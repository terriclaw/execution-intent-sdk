// sign.ts
// EIP-712 signing helper for ExecutionIntent.
//
// In production, use a wallet client (viem, ethers, MetaMask) to sign.
// This helper provides the typed data structure for signing.

import type { ExecutionIntent, IntentDomain, SignedIntent } from "./types.js";
import { intentTypedData } from "./eip712.js";

// Returns the typed data payload ready for wallet signing.
// Pass this to wallet.signTypedData() or equivalent.
export function buildSigningPayload(intent: ExecutionIntent, domain: IntentDomain) {
  return intentTypedData(intent, domain);
}

// Wrap a signed result into a SignedIntent.
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
    name:    "ExecutionIntent",
    version: "1",
    chainId,
    verifyingContract,
  };
}
