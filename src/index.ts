// index.ts
// Public surface of the execution-intent SDK.
// Keep this minimal — expose only what an integrator needs.

export { createIntent, verifyIntentMatch, encodeIntentArgs } from "./intent.js";
export { buildSigningPayload, wrapSignedIntent, defaultDomain } from "./sign.js";
export { intentTypedData, dataHash, EXECUTION_INTENT_TYPE_STRING, EXECUTION_INTENT_TYPEHASH } from "./eip712.js";
export type { ExecutionIntent, SignedIntent, IntentDomain } from "./types.js";
