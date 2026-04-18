# execution-intent-sdk

Minimal SDK for execution-bound commitments on top of delegation-framework.

    Execution intent turns "what is allowed" into "what must be executed."

Composition defines authority. Execution intent defines the action.

## Problem

Delegated permissions define what is allowed, but not what is executed.
This creates an execution gap.

A relayer or agent constructing calldata offchain can mutate parameters within policy bounds and still pass validation. This is especially relevant for agent and relayer-based execution.

## Solution

Sign exact execution intent at redemption time and enforce it on-chain.

All guarantees are committed in one EIP-712 signature:
- exact calldata (dataHash)
- authorized signer
- nonce (replay protection)
- deadline (expiry)

In the execution-bound enforcing flow, partial satisfaction is not possible. If any committed field deviates, onchain enforcement reverts.

---

## Install

    npm install execution-intent-sdk

---

## Quick start

    import {
      createIntent,
      buildSigningPayload,
      wrapSignedIntent,
      signIntent,
      verifySignedIntent,
      executionMatchesIntent,
      encodeIntentArgs,
      defaultDomain,
    } from "execution-intent-sdk";

    const domain = defaultDomain("0xYourEnforcer", 84532);

    const intent = createIntent({
      account:  "0xYourSmartAccount",
      target:   "0xUSDC",
      value:    0n,
      data:     "0xa9059cbb...",
      nonce:    1n,
      deadline: BigInt(Math.floor(Date.now() / 1000) + 3600),
    });

    // Backend / agent signing
    const signed = await signIntent(intent, domain, privateKey);

    // Browser wallet signing
    const payload = buildSigningPayload(intent, domain);
    const sig = await walletClient.signTypedData(payload);
    const browserSigned = wrapSignedIntent(intent, address, sig);

    // Verify offchain
    const valid = await verifySignedIntent(signed, domain);

    // Check execution matches intent (mirrors on-chain enforcement)
    const ok = executionMatchesIntent(intent, target, value, calldata);

    // Encode for on-chain submission
    const args = encodeIntentArgs(intent, signed.signer, signed.signature);

---

## Two approaches

Both flows enable safe third-party execution, but express the trust boundary differently.

### Composable (delegation-framework style)

Guarantees are stacked as separate caveats on a delegation:
- ExactExecutionEnforcer: exact calldata committed at delegation time
- IdEnforcer or NonceEnforcer: replay protection
- TimestampEnforcer: deadline

Each caveat encodes its own terms independently. The boundary is assembled at enforcement time.

The composition example uses real EIP-712 signing and real ABI-encoded caveat terms:

    npm run example:composition

Shows: delegation struct assembled, caveats encoded (ExactExecution: 224 bytes, Id: 32 bytes, Timestamp: 64 bytes), delegation signed by delegator.

When to use:
- guarantees may be reused independently
- calldata is known at delegation time
- composition flexibility matters

### Execution Intent (this SDK)

This is a redemption-time commitment, not a delegation-time policy.

All guarantees are bundled into one EIP-712 signed artifact at redemption time.
The signing happens close to execution, not at delegation creation.

When to use:
- a specific agent must authorize exact execution
- calldata is determined near execution time, not at delegation time
- partial satisfaction changes the trust assumption

---

## Signing contexts

### Backend / agent (private key)

    import { signIntent } from "execution-intent-sdk";

    const signed = await signIntent(intent, domain, process.env.PRIVATE_KEY);

### Browser wallet (MetaMask, Coinbase, etc.)

    import { buildSigningPayload, wrapSignedIntent } from "execution-intent-sdk";

    const payload = buildSigningPayload(intent, domain);

    // viem WalletClient
    const sig = await walletClient.signTypedData({
      account:     userAddress,
      domain:      payload.domain,
      types:       payload.types,
      primaryType: payload.primaryType,
      message:     payload.message,
    });
    const browserSigned = wrapSignedIntent(intent, userAddress, sig);

See examples/browser-wallet/index.ts for the full integration pattern.

---

## Relayer / backend usage

The SDK provides a clean helper surface for relayer and backend workflows.

    import {
      prepareRelayerPayload,
      validateBeforeSubmission,
      buildRelayerLogEntry,
    } from "execution-intent-sdk";

    // Bundle everything a relayer needs to submit
    const payload = prepareRelayerPayload(signed);
    // payload.encodedArgs  -> ABI-encoded bytes for enforcer beforeHook
    // payload.intentType   -> "ExecutionBoundIntent" (routing key)
    // payload.deadlineValid -> offchain deadline check

    // Validate before forwarding
    const check = validateBeforeSubmission(signed, target, value, calldata);
    if (!check.valid) {
      console.error("Intent invalid:", check.reasons);
    }

    // Structured log entry (intent_type always first)
    const log = buildRelayerLogEntry(payload);
    console.log(log);
    // { intent_type: "ExecutionBoundIntent", account: "0x...", signer: "0x...", ... }

`intent_type` is always the first field — it is a routing key, not metadata.
Downstream alerts, analytics, and vendors can filter by it.

---

## Nonce handling

Nonces are scoped to (account, signer). Any value is valid exactly once.

    import { createSequentialNonceManager, randomNonce, timestampNonce } from "execution-intent-sdk";

    // Sequential — for single-process agents and relayers
    const nonces = createSequentialNonceManager();
    const intent = createIntent({ ..., nonce: nonces.next() });

    // Random — for multi-agent or concurrent flows
    const intent = createIntent({ ..., nonce: randomNonce() });

    // Timestamp-based — for low-frequency flows
    const intent = createIntent({ ..., nonce: timestampNonce() });

For production distributed systems, coordinate nonce allocation externally.

---

## Running examples

    npm run example:composition          # Flow A: composable, real EIP-712 + encoded caveats
    npm run example:composition:real      # Flow A: real delegation-framework redemption (requires execution-bound-intent repo + forge)
    npm run example:intent               # Flow B: full signing/verification/encoding flow
    npm run example:onchain:local        # Flow B onchain: one-command deploy + proof (requires Anvil)

### Real delegation-framework composition flow

    npm run example:composition:real

Runs a real end-to-end composition flow through actual MetaMask delegation-framework contracts:
- HybridDeleGator smart account as delegator
- ExactExecutionEnforcer + TimestampEnforcer + IdEnforcer stacked as caveats
- DelegationManager.redeemDelegations as the redemption path

Four cases proven:
1. Exact execution succeeds
2. Mutated calldata reverts (ExactExecutionEnforcer)
3. Replay reverts (IdEnforcer)
4. Expired delegation reverts (TimestampEnforcer)

Prerequisites: execution-bound-intent repo cloned locally, forge installed.
See: https://github.com/terriclaw/execution-bound-intent/blob/master/test/CompositionFlow.t.sol

Important difference from execution-intent path:
- calldata is committed at delegation time (not redemption time)
- guarantees are enforced independently by separate contracts
- no per-execution signer authorization

### One-command local onchain flow

    npm run example:onchain:local

This script:
1. checks Anvil is installed
2. starts Anvil automatically
3. waits until ready
4. deploys MinimalIntentVerifier
5. proves: exact execution succeeds, mutated calldata reverts, replay reverts
6. cleans up Anvil

Prerequisites: Anvil installed (foundryup), PRIVATE_KEY in .env.

---

## Tests

    npm test

23 tests covering: dataHash, hashIntent, buildSigningPayload, signIntent,
verifySignedIntent, recoverIntentSigner, executionMatchesIntent,
isDeadlineValid, encodeIntentArgs. Includes mismatch, wrong signer,
expired deadline, and ABI encoding shape tests.

---

## On-chain integration

The SDK encodes args compatible with ExecutionBoundCaveat / ExecutionBoundEnforcer:

    const args = encodeIntentArgs(intent, signed.signer, signed.signature);
    // matches: abi.decode(_args, (ExecutionIntent, address signer, bytes signature))

A minimal Solidity verifier with compiled artifact is included:
- Contract: examples/onchain/contracts/MinimalIntentVerifier.sol
- Artifact:  examples/onchain/artifacts/MinimalIntentVerifier.json

Reference enforcer: https://github.com/terriclaw/execution-bound-intent

---

## API

    createIntent(params)
      Build an ExecutionIntent. Stores raw calldata; derives dataHash on demand.

    dataHash(intent)
      keccak256 of intent.data. What the enforcer checks against calldata.

    hashIntent(intent, domain)
      EIP-712 digest. Exactly what the on-chain enforcer recomputes.

    buildSigningPayload(intent, domain)
      Typed data payload for wallet.signTypedData().

    signIntent(intent, domain, privateKey)
      Sign with a private key. Returns SignedIntent.

    wrapSignedIntent(intent, signer, signature)
      Wrap a pre-existing signature into a SignedIntent.

    verifySignedIntent(signed, domain)
      Verify a signature against the declared signer. Returns boolean.

    recoverIntentSigner(intent, domain, signature)
      Recover signer address from signature.

    executionMatchesIntent(intent, target, value, data)
      Check exact execution match. Mirrors on-chain enforcement.

    isDeadlineValid(intent, nowSeconds?)
      Check deadline has not passed.

    encodeIntentArgs(intent, signer, signature)
      ABI-encode args for enforcer beforeHook. 384 bytes for standard intent.

    defaultDomain(verifyingContract, chainId?)
      Convenience domain builder.

    createSequentialNonceManager(start?)
      In-memory sequential nonce manager.

    randomNonce() / timestampNonce()
      Nonce generation helpers.

    prepareRelayerPayload(signed)
      Bundle signed intent into relayer submission object.

    validateBeforeSubmission(signed, target, value, data)
      Offchain validation before forwarding. Returns { valid, reasons }.

    buildRelayerLogEntry(payload)
      Structured log entry with intent_type as first field.

---

## Structure

    src/
      types.ts     ExecutionIntent, SignedIntent, IntentDomain interfaces
      eip712.ts    EIP-712 type definitions, dataHash, hashIntent
      intent.ts    createIntent, executionMatchesIntent, isDeadlineValid, encodeIntentArgs
      sign.ts      signIntent, verifySignedIntent, recoverIntentSigner, buildSigningPayload, wrapSignedIntent
      nonce.ts     createSequentialNonceManager, randomNonce, timestampNonce
      relayer.ts   prepareRelayerPayload, validateBeforeSubmission, buildRelayerLogEntry
      index.ts     public SDK surface

    examples/
      composition/index.ts        Flow A: real EIP-712 delegation + encoded caveats
      execution-intent/index.ts   Flow B: full signing/verification/encoding
      browser-wallet/index.ts     Browser wallet integration reference
      onchain/index.ts            Onchain deploy + proof flow
      onchain/contracts/          MinimalIntentVerifier.sol
      onchain/artifacts/          Compiled artifact (no build step needed)

    scripts/
      run-onchain-example.sh      One-command Anvil + onchain example

    test/
      sdk.test.ts                 23 tests

---

## Positioning

This is a pattern / SDK layer on top of delegation-framework composable primitives.
It does not replace composition.

Useful when exact execution intent is the trust boundary:
agents, relayers, and third-party execution flows where partial satisfaction is unsafe.

---

## Related

- Reference enforcer: https://github.com/terriclaw/execution-bound-intent
- Design research: https://github.com/terriclaw/execution-bound-intent-global-replay
- MetaMask delegation-framework: https://github.com/MetaMask/delegation-framework
