// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import { ECDSA } from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import { EIP712 } from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title MinimalIntentVerifier
/// @notice Minimal on-chain verifier for execution intent — for SDK demo purposes.
///
/// Verifies that a signed ExecutionIntent matches the actual execution at call time.
/// This is a simplified version of ExecutionBoundCaveat for SDK integration testing.
///
/// In production, use ExecutionBoundCaveat or ExecutionBoundEnforcer.

contract MinimalIntentVerifier is EIP712 {
    struct ExecutionIntent {
        address account;
        address target;
        uint256 value;
        bytes32 dataHash;
        uint256 nonce;
        uint256 deadline;
    }

    bytes32 private constant INTENT_TYPEHASH = keccak256(
        "ExecutionIntent(address account,address target,uint256 value,bytes32 dataHash,uint256 nonce,uint256 deadline)"
    );

    mapping(address => mapping(address => mapping(uint256 => bool))) public usedNonces;

    event IntentExecuted(address indexed account, address indexed signer, uint256 nonce);

    error AccountMismatch();
    error TargetMismatch();
    error ValueMismatch();
    error DataHashMismatch();
    error IntentExpired();
    error NonceAlreadyUsed();
    error InvalidSignature();

    constructor() EIP712("ExecutionBoundIntent", "1") {}

    /// @notice Verify and consume an execution intent.
    /// @param intent     The signed ExecutionIntent.
    /// @param signer     The address expected to have signed the intent.
    /// @param signature  EIP-712 signature over the intent.
    /// @param target     Actual call target.
    /// @param value      Actual ETH value.
    /// @param callData   Actual calldata.
    function verifyAndConsume(
        ExecutionIntent calldata intent,
        address signer,
        bytes calldata signature,
        address target,
        uint256 value,
        bytes calldata callData
    ) external {
        if (intent.account != msg.sender) revert AccountMismatch();
        if (intent.target  != target)     revert TargetMismatch();
        if (intent.value   != value)      revert ValueMismatch();
        if (intent.dataHash != keccak256(callData)) revert DataHashMismatch();
        if (intent.deadline != 0 && block.timestamp > intent.deadline) revert IntentExpired();
        if (usedNonces[intent.account][signer][intent.nonce]) revert NonceAlreadyUsed();

        usedNonces[intent.account][signer][intent.nonce] = true;

        bytes32 digest = _hashTypedDataV4(keccak256(abi.encode(
            INTENT_TYPEHASH,
            intent.account,
            intent.target,
            intent.value,
            intent.dataHash,
            intent.nonce,
            intent.deadline
        )));

        address recovered = ECDSA.recover(digest, signature);
        if (recovered != signer) revert InvalidSignature();

        emit IntentExecuted(intent.account, signer, intent.nonce);
    }
}
