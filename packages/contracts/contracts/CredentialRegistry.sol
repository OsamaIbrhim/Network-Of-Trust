// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CredentialRegistry
/// @notice Anchors Merkle roots of credential hashes.
/// @dev Stores NO personal data. An institution has a stable id (keccak256 of its platform id) and a set
///      of signer wallets that can change over time (ADR 0002). Batches and revocations are keyed by
///      institution id, so wallet rotation keeps old credentials valid and revocable, and nobody can
///      front-run another institution's root (ADR 0001).
contract CredentialRegistry is AccessControl, Pausable {
    enum InstitutionState {
        NONE,
        ACTIVE,
        SUSPENDED
    }

    struct Batch {
        uint64 anchoredAt;
        uint32 size;
        address signer;
    }

    mapping(bytes32 institutionId => InstitutionState) private _institutions;
    mapping(address signer => bytes32 institutionId) private _institutionOf;
    mapping(bytes32 institutionId => mapping(bytes32 root => Batch)) private _batches;

    event InstitutionRegistered(bytes32 indexed institutionId);
    event InstitutionSuspended(bytes32 indexed institutionId);
    event InstitutionReinstated(bytes32 indexed institutionId);
    event SignerAdded(bytes32 indexed institutionId, address indexed signer);
    event SignerRemoved(bytes32 indexed institutionId, address indexed signer);
    event BatchAnchored(bytes32 indexed institutionId, bytes32 indexed root, address indexed signer, uint32 size);
    error InvalidAdmin();
    error InvalidInstitution();
    error InstitutionAlreadyRegistered(bytes32 institutionId);
    error UnknownInstitution(bytes32 institutionId);
    error InvalidSigner();
    error SignerAlreadyAssigned(address signer);
    error NotASigner(address account);
    error InstitutionNotActive(bytes32 institutionId);
    error InvalidRoot();
    error InvalidSize();
    error BatchAlreadyAnchored(bytes32 root);

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Emergency stop for anchoring.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Accredit an institution. `institutionId` = keccak256 of its platform id.
    function registerInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (institutionId == bytes32(0)) revert InvalidInstitution();
        if (_institutions[institutionId] != InstitutionState.NONE) revert InstitutionAlreadyRegistered(institutionId);
        _institutions[institutionId] = InstitutionState.ACTIVE;
        emit InstitutionRegistered(institutionId);
    }

    /// @notice Withdraw accreditation: no new batches or revocations; old credentials stay VALID with a warning.
    function suspendInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
        _institutions[institutionId] = InstitutionState.SUSPENDED;
        emit InstitutionSuspended(institutionId);
    }

    function reinstateInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.SUSPENDED) revert UnknownInstitution(institutionId);
        _institutions[institutionId] = InstitutionState.ACTIVE;
        emit InstitutionReinstated(institutionId);
    }

    /// @notice Authorize a wallet to sign for an institution. A wallet belongs to at most one institution.
    function addSigner(bytes32 institutionId, address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] == InstitutionState.NONE) revert UnknownInstitution(institutionId);
        if (signer == address(0)) revert InvalidSigner();
        if (_institutionOf[signer] != bytes32(0)) revert SignerAlreadyAssigned(signer);
        _institutionOf[signer] = institutionId;
        emit SignerAdded(institutionId, signer);
    }

    /// @notice Remove a wallet (staff change, lost or stolen key). Past batches are unaffected.
    function removeSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        delete _institutionOf[signer];
        emit SignerRemoved(institutionId, signer);
    }

    /// @notice Anchor one batch (1..N credentials) for the caller's institution with a single transaction.
    function anchorBatch(bytes32 root, uint32 size) external whenNotPaused {
        bytes32 institutionId = _activeInstitutionOf(msg.sender);
        if (root == bytes32(0)) revert InvalidRoot();
        if (size == 0) revert InvalidSize();
        if (_batches[institutionId][root].anchoredAt != 0) revert BatchAlreadyAnchored(root);

        _batches[institutionId][root] = Batch({anchoredAt: uint64(block.timestamp), size: size, signer: msg.sender});
        emit BatchAnchored(institutionId, root, msg.sender, size);
    }

    function institutionState(bytes32 institutionId) external view returns (InstitutionState) {
        return _institutions[institutionId];
    }

    function institutionOf(address signer) external view returns (bytes32) {
        return _institutionOf[signer];
    }

    function getBatch(bytes32 institutionId, bytes32 root) external view returns (Batch memory) {
        return _batches[institutionId][root];
    }

    function _activeInstitutionOf(address signer) private view returns (bytes32 institutionId) {
        institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
    }
}
