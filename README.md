# execution-intent-sdk

> A minimal SDK for execution-bound commitments on top of delegation-framework primitives.

Enables exact execution intent to be signed and enforced at redemption - by a specific signer, once, before a deadline.

---

## The execution gap

Delegated permissions define what is allowed. They do not always define what exact calldata gets executed at redemption.

When calldata is constructed offchain by a relayer or agent, a gap opens between what the delegator authorized and what actually executes. Policy-based enforcers (selector checks, value limits) reduce this gap but do not close it entirely - a relayer can still mutate parameters within policy bounds.

This SDK addresses that gap.

---

## What execution intent is

An execution intent is a single EIP-712 signed artifact containing:

- account: the smart account authorizing execution
- target: call target
- value: ETH value
- dataHash: keccak256 of the full calldata (binds selector and all arguments)
- nonce: replay protection, unique per (account, signer)
- deadline: expiry

All fields are committed together in one signature. Partial satisfaction is not possible - if any field deviates, the transaction reverts.

---

## Flow

    1. agent / signer constructs an ExecutionIntent at redemption time
    2. agent signs the intent via EIP-712
    3. intent + signature passed as caveat args to DelegationManager
    4. enforcer verifies: exact calldata, signer, nonce, deadline - all together
    5. execution proceeds or reverts atomically

---

## Two approaches

This repo demonstrates both paths for the same goal: safe third-party execution on behalf of a user.

### Composable (delegation-framework style)

Guarantees are stacked as separate caveats on a delegation:
- ExactExecutionEnforcer: exact calldata (committed at delegation time)
- IdEnforcer or NonceEnforcer: replay protection
- TimestampEnforcer: deadline

Each guarantee is independent. The boundary is assembled from pieces.

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
- partial satisfaction changes the trust assumption

---

## When to use execution intent

The execution intent pattern is appropriate when:

- exact execution + signer binding + nonce + deadline must hold together as one invariant
- partial satisfaction is unsafe (missing any one guarantee changes the trust model)
- calldata is constructed close to redemption, not at delegation time
- you want one inspectable signed artifact that captures the full commitment

If each guarantee can be satisfied independently, composition is likely the better fit.

---

## Positioning

This is a higher-level pattern / SDK built on top of delegation-framework composable primitives.

It does not replace composition. It packages one specific trust boundary - execution-bound commitments - into a reusable flow for cases where exact execution intent is the right model.

---

## Quick start

    import { createIntent, buildSigningPayload, wrapSignedIntent, defaultDomain } from "execution-intent-sdk";

    const intent = createIntent({
      account:  "0xYourSmartAccount",
      target:   "0xUSDC",
      value:    0n,
      data:     "0xa9059cbb...",
      nonce:    1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });

    const domain = defaultDomain("0xYourEnforcer", 84532);
    const signingPayload = buildSigningPayload(intent, domain);

    // sign with your wallet:
    // const signature = await walletClient.signTypedData(signingPayload);

---

## Examples

    examples/
      composition/       Flow A: composable delegation-framework style
      execution-intent/  Flow B: atomic execution intent

Run:
    npx ts-node --esm examples/composition/index.ts
    npx ts-node --esm examples/execution-intent/index.ts

---

## Structure

    src/
      types.ts    ExecutionIntent type definitions
      eip712.ts   EIP-712 typed data and hashing
      intent.ts   createIntent, verifyIntentMatch, encodeIntentArgs
      sign.ts     buildSigningPayload, wrapSignedIntent
      index.ts    public SDK surface

    examples/
      composition/index.ts        composable path walkthrough
      execution-intent/index.ts   execution intent path walkthrough

---

## Related

- Reference enforcer: https://github.com/terriclaw/execution-bound-intent
- Design research: https://github.com/terriclaw/execution-bound-intent-global-replay
- MetaMask delegation-framework: https://github.com/MetaMask/delegation-framework
