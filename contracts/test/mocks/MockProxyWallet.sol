// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IProxyWallet} from "../../src/interfaces/IProxyWallet.sol";

/**
 * @title MockProxyWallet
 * @notice Mock Proxy Wallet for testing EIP-1271 signature validation
 */
contract MockProxyWallet is IProxyWallet {
    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;
    
    address public owner;
    mapping(bytes32 => bool) private _validSignatures;
    bool private _shouldRevert;

    constructor(address owner_) {
        owner = owner_;
    }

    function setValidSignature(bytes32 hash, bool valid) external {
        _validSignatures[hash] = valid;
    }

    function setShouldRevert(bool shouldRevert_) external {
        _shouldRevert = shouldRevert_;
    }

    function isValidSignature(bytes32 hash, bytes memory) external view override returns (bytes4) {
        if (_shouldRevert) {
            revert("MockProxyWallet: forced revert");
        }
        if (_validSignatures[hash]) {
            return EIP1271_MAGIC_VALUE;
        }
        return bytes4(0);
    }
}
