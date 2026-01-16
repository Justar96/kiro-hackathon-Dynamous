// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IGnosisSafe} from "../../src/interfaces/IGnosisSafe.sol";

/**
 * @title MockGnosisSafe
 * @notice Mock Gnosis Safe for testing multi-sig signature validation
 */
contract MockGnosisSafe is IGnosisSafe {
    bytes4 private constant EIP1271_MAGIC_VALUE = 0x1626ba7e;
    
    address[] private _owners;
    uint256 private _threshold;
    mapping(bytes32 => bool) private _validSignatures;
    bool private _shouldRevert;

    constructor(address[] memory owners_, uint256 threshold_) {
        _owners = owners_;
        _threshold = threshold_;
    }

    function setValidSignature(bytes32 hash, bool valid) external {
        _validSignatures[hash] = valid;
    }

    function setShouldRevert(bool shouldRevert_) external {
        _shouldRevert = shouldRevert_;
    }

    function isValidSignature(bytes32 hash, bytes memory) external view override returns (bytes4) {
        if (_shouldRevert) {
            revert("MockGnosisSafe: forced revert");
        }
        if (_validSignatures[hash]) {
            return EIP1271_MAGIC_VALUE;
        }
        return bytes4(0);
    }

    function getThreshold() external view override returns (uint256) {
        return _threshold;
    }

    function getOwners() external view override returns (address[] memory) {
        return _owners;
    }

    function isOwner(address owner) external view override returns (bool) {
        for (uint256 i = 0; i < _owners.length; i++) {
            if (_owners[i] == owner) return true;
        }
        return false;
    }
}
