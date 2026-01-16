// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IGnosisSafe
 * @notice Interface for Gnosis Safe signature validation
 * @dev Used for multi-signature wallets that implement EIP-1271
 */
interface IGnosisSafe {
    /**
     * @notice Validates a signature for a given hash
     * @param hash The hash of the data that was signed
     * @param signature The signature to validate (can be multiple signatures concatenated)
     * @return magicValue Returns 0x1626ba7e if the signature is valid
     */
    function isValidSignature(bytes32 hash, bytes memory signature) external view returns (bytes4 magicValue);

    /**
     * @notice Returns the threshold of required signatures
     * @return The number of required signatures
     */
    function getThreshold() external view returns (uint256);

    /**
     * @notice Returns the list of owners
     * @return Array of owner addresses
     */
    function getOwners() external view returns (address[] memory);

    /**
     * @notice Checks if an address is an owner
     * @param owner The address to check
     * @return True if the address is an owner
     */
    function isOwner(address owner) external view returns (bool);
}
