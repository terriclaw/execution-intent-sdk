// index.ts
// Public surface of the execution-intent SDK.

export { createIntent, matchesExecution, isDeadlineValid, encodeIntentArgs } from "./intent.js";
export { buildSigningPayload, signIntent, verifySignedIntent, recoverIntentSigner, wrapSignedIntent, defaultDomain } from "./sign.js";
export { intentTypedData, hashIntent, dataHash, EXECUTION_INTENT_TYPE_STRING, EXECUTION_INTENT_TYPEHASH } from "./eip712.js";
export type { ExecutionIntent, SignedIntent, IntentDomain } from "./types.js";
