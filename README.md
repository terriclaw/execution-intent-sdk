# execution-intent-sdk

Minimal SDK for execution-bound commitments on top of delegation-framework.

    Execution intent turns "what is allowed" into "what must be executed."

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

Partial satisfaction is not possible. If any field deviates, enforcement reverts.

---

## Install

    npm install execution-intent-sdk

---

## Quick start

    import {
      createIntent,
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
    const sig = await walletClient.signTypedData(payload); // viem, wagmi, MetaMask
    const signed = wrapSignedIntent(intent, address, sig);

    // Verify offchain
    const valid = await verifySignedIntent(signed, domain);

    // Check execution matches intent (mirrors on-chain enforcement)
    const ok = executionMatchesIntent(intent, target, value, calldata);

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
    const signed = wrapSignedIntent(intent, userAddress, sig);

    // wagmi
    const { signTypedData } = useSignTypedData();
    signTypedData(payload);

See examples/browser-wallet/index.ts for the full integration pattern.

---

## Nonce handling

Nonces in execution intent are scoped to (account, signer). Any value is valid exactly once.

    import { createSequentialNonceManager, randomNonce } from "execution-intent-sdk";

    // Sequential — for single-process agents and relayers
    const nonces = createSequentialNonceManager();
    const intent = createIntent({ ..., nonce: nonces.next() });

    // Random — for multi-agent or concurrent flows
    const intent = createIntent({ ..., nonce: randomNonce() });

    // Timestamp-based — for low-frequency flows
    import { timestampNonce } from "execution-intent-sdk";
    const intent = createIntent({ ..., nonce: timestampNonce() });

For production distributed systems, coordinate nonce allocation externally
(database, on-chain query, or a coordination service).

---

## On-chain integration

The SDK encodes args compatible with ExecutionBoundCaveat / ExecutionBoundEnforcer:

    const args = encodeIntentArgs(intent, signed.signer, signed.signature);
    // ABI: abi.decode(_args, (ExecutionIntent, address signer, bytes signature))

Reference enforcer: https://github.com/terriclaw/execution-bound-intent

A minimal Solidity verifier is included for integration testing:
See examples/onchain/contracts/MinimalIntentVerifier.sol

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

    randomNonce()
      Cryptographically random 32-bit nonce.

    timestampNonce()
      Current timestamp in milliseconds as nonce.

---

## Examples

    npm run example:intent         # Flow B: full signing/verification/encoding flow
    npm run example:composition    # Flow A: composable delegation-framework style
    npm run example:onchain        # Onchain integration structure (requires Anvil)

---

## Tests

    npm test

23 tests covering: dataHash, hashIntent, buildSigningPayload, signIntent,
verifySignedIntent, recoverIntentSigner, executionMatchesIntent,
isDeadlineValid, encodeIntentArgs. Includes mismatch, wrong signer,
expired deadline, and ABI encoding shape tests.

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
