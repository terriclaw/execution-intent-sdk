// types.ts
// Core types for the execution-intent SDK.

export interface ExecutionIntent {
  account:  string;   // the smart account authorizing execution
  target:   string;   // call target
  value:    bigint;   // ETH value
  data:     string;   // full calldata (hex)
  nonce:    bigint;   // replay guard — unique per (account, signer)
  deadline: bigint;   // unix timestamp expiry, 0 = no expiry
}

export interface SignedIntent {
  intent:    ExecutionIntent;
  signer:    string;      // address that signed
  signature: string;      // EIP-712 signature
}

export interface IntentDomain {
  name:              string;
  version:           string;
  chainId:           number;
  verifyingContract: string;
}
