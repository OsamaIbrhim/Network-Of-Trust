// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CredentialRegistry
/// @notice Anchors Merkle roots of credential hashes and records revocations.
/// @dev Stores NO personal data. Only 32-byte hashes, issuer addresses and timestamps.
contract CredentialRegistry is AccessControl, Pausable {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Batch {
        address issuer;
        uint64 anchoredAt;
        uint32 size;
    }

    mapping(bytes32 root => Batch) private _batches;

    event BatchAnchored(bytes32 indexed root, address indexed issuer, uint32 size);

    error InvalidRoot();
    error InvalidSize();
    error BatchAlreadyAnchored(bytes32 root);

    constructor(address admin) {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Anchor one batch (1..N credentials) with a single transaction.
    function anchorBatch(bytes32 root, uint32 size) external onlyRole(ISSUER_ROLE) whenNotPaused {
        if (root == bytes32(0)) revert InvalidRoot();
        if (size == 0) revert InvalidSize();
        if (_batches[root].issuer != address(0)) revert BatchAlreadyAnchored(root);

        _batches[root] = Batch({issuer: msg.sender, anchoredAt: uint64(block.timestamp), size: size});
        emit BatchAnchored(root, msg.sender, size);
    }

    function getBatch(bytes32 root) external view returns (Batch memory) {
        return _batches[root];
    }

    function isIssuer(address account) external view returns (bool) {
        return hasRole(ISSUER_ROLE, account);
    }
}
