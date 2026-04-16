// examples/browser-wallet/index.ts
//
// Browser Wallet Signing Flow
//
// This file shows how to use execution-intent-sdk with a browser wallet
// (MetaMask, Coinbase Wallet, etc.) via viem's WalletClient.
//
// This is NOT a runnable Node.js script.
// It is a reference implementation for browser/dapp integration.
//
// In your dapp, wire this up to your wallet connection library
// (wagmi, viem, RainbowKit, etc.)

import {
  createIntent,
  buildSigningPayload,
  wrapSignedIntent,
  verifySignedIntent,
  encodeIntentArgs,
  defaultDomain,
} from "../../src/index.js";
import type { SignedIntent } from "../../src/index.js";

// ---------------------------------------------------------------------------
// 1. Define the domain
// ---------------------------------------------------------------------------
// verifyingContract should be your deployed ExecutionBoundCaveat/Enforcer address.
const domain = defaultDomain(
  "0xYourEnforcerAddress",
  1 // mainnet, or your chain ID
);

// ---------------------------------------------------------------------------
// 2. Build the intent
// ---------------------------------------------------------------------------
// Called by the agent/app that knows what execution is needed.
export function buildIntent(
  account: string,
  target:  string,
  calldata: `0x${string}`,
  nonce:   bigint,
  deadlineSeconds: number
) {
  return createIntent({
    account,
    target,
    value:    0n,
    data:     calldata,
    nonce,
    deadline: BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds),
  });
}

// ---------------------------------------------------------------------------
// 3. Request wallet signature
// ---------------------------------------------------------------------------
// Pass the result of buildSigningPayload to wallet.signTypedData.
// Works with viem WalletClient, wagmi useSignTypedData, MetaMask eth_signTypedData_v4.
//
// Example with viem WalletClient:
//
//   import { createWalletClient, custom } from "viem";
//   const walletClient = createWalletClient({ transport: custom(window.ethereum) });
//
//   const intent = buildIntent(...);
//   const payload = buildSigningPayload(intent, domain);
//   const signature = await walletClient.signTypedData({
//     account:     userAddress,
//     domain:      payload.domain,
//     types:       payload.types,
//     primaryType: payload.primaryType,
//     message:     payload.message,
//   });
//   const signed = wrapSignedIntent(intent, userAddress, signature);
//
// Example with wagmi useSignTypedData hook:
//
//   const { signTypedData } = useSignTypedData();
//   const payload = buildSigningPayload(intent, domain);
//   signTypedData(payload, { onSuccess: (sig) => {
//     const signed = wrapSignedIntent(intent, address, sig);
//   }});

export async function requestWalletSignature(
  intent:      ReturnType<typeof createIntent>,
  userAddress: `0x${string}`,
  signTypedData: (payload: ReturnType<typeof buildSigningPayload>) => Promise<`0x${string}`>
): Promise<SignedIntent> {
  const payload = buildSigningPayload(intent, domain);
  const signature = await signTypedData(payload);
  return wrapSignedIntent(intent, userAddress, signature);
}

// ---------------------------------------------------------------------------
// 4. Submit to relayer / backend
// ---------------------------------------------------------------------------
// After signing, the signed intent is sent to a relayer or backend.
// The relayer calls encodeIntentArgs and submits to the on-chain enforcer.
//
// This is the relayer's responsibility, not the wallet's.
// The wallet only signs — it never submits the transaction directly.

export function prepareRelayerPayload(signed: SignedIntent) {
  const encodedArgs = encodeIntentArgs(signed.intent, signed.signer, signed.signature);
  return {
    intentArgs: encodedArgs,
    signer:     signed.signer,
    // Relayer constructs the full DelegationManager.redeemDelegations call
    // using these args as the caveat beforeHook args.
  };
}

// ---------------------------------------------------------------------------
// Integration summary
// ---------------------------------------------------------------------------
//
// Full browser wallet flow:
//
//   [App/Agent]        buildIntent(...)
//                      buildSigningPayload(intent, domain)
//
//   [Browser Wallet]   signTypedData(payload)
//                      → signature
//
//   [App/Agent]        wrapSignedIntent(intent, address, signature)
//                      → SignedIntent
//
//   [Relayer/Backend]  encodeIntentArgs(intent, signer, signature)
//                      → ABI-encoded args for beforeHook
//                      → submit DelegationManager.redeemDelegations(...)
//
// The wallet sees:
//   "You are signing an ExecutionIntent"
//   account, target, value, dataHash, nonce, deadline
//
// The signed artifact is what the on-chain enforcer verifies at redemption.
