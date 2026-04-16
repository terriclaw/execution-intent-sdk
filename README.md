# execution-intent-sdk

Minimal SDK for execution-bound commitments on top of delegation-framework.

## Problem

Delegated permissions define what is allowed, but not what is executed.
This creates an execution gap.

A relayer or agent constructing calldata offchain can mutate parameters within policy bounds and still pass validation. This is especially relevant for agent and relayer-based execution.

## Solution

Sign exact execution intent and enforce it at redemption.

    Execution intent turns "what is allowed" into "what must be executed."

## Quick start

    npm install execution-intent-sdk

    import {
      createIntent,
      signIntent,
      verifySignedIntent,
      matchesExecution,
      encodeIntentArgs,
      defaultDomain,
    } from "execution-intent-sdk";

    const domain = defaultDomain("0xYourEnforcer", 84532);

    const intent = createIntent({
      account:  "0xYourSmartAccount",
      target:   "0xUSDC",
      value:    0n,
      data:     "0xa9059cbb...", // transfer calldata
      nonce:    1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });

    // Sign with a private key (backend/agent) or use buildSigningPayload for wallet signing
    const signed = await signIntent(intent, domain, privateKey);

    // Verify
    const valid = await verifySignedIntent(signed, domain);

    // Check execution matches intent (mirrors on-chain enforcement)
    const ok = matchesExecution(intent, target, value, calldata);

    // Encode for on-chain submission
    const args = encodeIntentArgs(intent, signed.signer, signed.signature);

---

## Two approaches

Both flows achieve the same goal: safe third-party execution on behalf of a user.

### Composable (delegation-framework style)

Guarantees are stacked as separate caveats on a delegation:
- ExactExecutionEnforcer: exact calldata committed at delegation time
- IdEnforcer or NonceEnforcer: replay protection
- TimestampEnforcer: deadline

Guarantees are expressed independently. The boundary is assembled at enforcement time.

When to use:
- guarantees may be reused independently
- calldata is known at delegation time
- composition flexibility matters

### Execution Intent (this SDK)

All guarantees are bundled into one EIP-712 signed artifact at redemption time.
The signing happens close to execution, not at delegation creation.

When to use:
- a specific agent must authorize exact execution
- calldata is determined near execution time, not at delegation time
- partial satisfaction changes the trust assumption (missing any one guarantee changes the security model)

---

## API

    createIntent(params)
      Build an ExecutionIntent. Raw calldata is stored; dataHash derived on demand.

    hashIntent(intent, domain)
      Compute the EIP-712 digest. This is what the on-chain enforcer recomputes.

    signIntent(intent, domain, privateKey)
      Sign with a private key. Returns SignedIntent.
      For browser/wallet: use buildSigningPayload + wallet.signTypedData.

    verifySignedIntent(signed, domain)
      Verify a signature against the declared signer. Returns boolean.

    recoverIntentSigner(intent, domain, signature)
      Recover the signer address from a signature.

    matchesExecution(intent, target, value, data)
      Check whether an actual execution exactly matches the signed intent.
      Mirrors what the on-chain enforcer checks at redemption.

    isDeadlineValid(intent, nowSeconds?)
      Check whether the intent deadline has passed.

    encodeIntentArgs(intent, signer, signature)
      ABI-encode args for the caveat beforeHook call.
      Compatible with ExecutionBoundCaveat / ExecutionBoundEnforcer decoding.

    buildSigningPayload(intent, domain)
      Returns typed data payload for wallet.signTypedData().

    defaultDomain(verifyingContract, chainId?)
      Convenience domain builder for local/testing use.

---

## Running the examples

    npm install
    npm run example:intent        # Flow B: execution intent (fully runnable)
    npm run example:composition   # Flow A: composable delegation-framework style

Flow B output shows a complete signing, verification, recovery, matching, and encoding flow with real cryptography.

---

## Structure

    src/
      types.ts     ExecutionIntent, SignedIntent, IntentDomain interfaces
      eip712.ts    EIP-712 type definitions, dataHash, hashIntent
      intent.ts    createIntent, matchesExecution, isDeadlineValid, encodeIntentArgs
      sign.ts      signIntent, verifySignedIntent, recoverIntentSigner, buildSigningPayload
      index.ts     public SDK surface

    examples/
      composition/index.ts        Flow A: composable path walkthrough
      execution-intent/index.ts   Flow B: execution intent, fully runnable

---

## Intent model

    interface ExecutionIntent {
      account:  string;   // smart account authorizing execution
      target:   string;   // call target
      value:    bigint;   // ETH value
      data:     string;   // full calldata hex
      nonce:    bigint;   // replay guard, unique per (account, signer)
      deadline: bigint;   // unix timestamp expiry, 0 = no expiry
    }

SDK stores raw calldata and derives dataHash internally.
The on-chain enforcer receives dataHash, not raw calldata.

---

## On-chain integration

The SDK is designed to work with ExecutionBoundCaveat / ExecutionBoundEnforcer.

encodeIntentArgs produces ABI-encoded bytes matching:
    abi.decode(_args, (ExecutionIntent, address signer, bytes signature))

Reference enforcer: https://github.com/terriclaw/execution-bound-intent

---

## Positioning

This is a pattern / SDK layer on top of delegation-framework composable primitives.
It does not replace composition.

    Execution intent turns "what is allowed" into "what must be executed."

---

## Related

- Reference enforcer: https://github.com/terriclaw/execution-bound-intent
- Design research: https://github.com/terriclaw/execution-bound-intent-global-replay
- MetaMask delegation-framework: https://github.com/MetaMask/delegation-framework

## Further reading

- The Execution Gap (Osobot)  
  https://www.osoknows.com/caveat/the-execution-gap

  This SDK is a concrete example of the "next phase" described there: moving from primitives to usable patterns, SDKs, and integration flows that preserve execution semantics end-to-end.
