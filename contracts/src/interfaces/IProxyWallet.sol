// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IProxyWallet
 * @notice Interface for Polymarket proxy wallet signature validation
 * @dev Used for account abstraction wallets that implement EIP-1271
 */
interface IProxyWallet {
    /**
     * @notice Validates a signature for a given hash
     * @param hash The hash of the data that was signed
     * @param signature The signature to validate
     * @return magicValue Returns 0x1626ba7e if the signature is valid
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue);
}
