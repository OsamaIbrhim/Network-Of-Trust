// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @notice Anchors and revokes Merkle roots of academic credential hashes.
/// @dev Stores NO personal data. Keyed by a stable institution id with rotatable signers (ADR 0001, 0002).
contract CredentialRegistry is AccessControl, Pausable {
    enum InstitutionState {
        NONE,
        ACTIVE,
        SUSPENDED
    }

    enum Status {
        UNKNOWN,
        VALID,
        REVOKED
    }

    struct Batch {
        uint64 anchoredAt;
        uint32 size;
        address signer;
    }

    struct Revocation {
        uint64 revokedAt;
        uint8 reason;
        address signer;
    }

    struct VerificationResult {
        Status status;
        bool institutionActive;
        uint64 anchoredAt;
        address signer;
        uint64 revokedAt;
        uint8 reason;
    }

    mapping(bytes32 institutionId => InstitutionState) private _institutions;
    mapping(address signer => bytes32 institutionId) private _institutionOf;
    mapping(bytes32 institutionId => mapping(bytes32 root => Batch)) private _batches;
    mapping(bytes32 key => Revocation) private _revocations;
    mapping(bytes32 institutionId => mapping(bytes32 root => Revocation)) private _batchRevocations;

    event InstitutionRegistered(bytes32 indexed institutionId);
    event InstitutionSuspended(bytes32 indexed institutionId);
    event InstitutionReinstated(bytes32 indexed institutionId);
    event SignerAdded(bytes32 indexed institutionId, address indexed signer);
    event SignerRemoved(bytes32 indexed institutionId, address indexed signer);
    event BatchAnchored(bytes32 indexed institutionId, bytes32 indexed root, address indexed signer, uint32 size);
    event BatchRevoked(bytes32 indexed institutionId, bytes32 indexed root, uint8 reason);
    event CredentialRevoked(
        bytes32 indexed institutionId,
        bytes32 indexed root,
        bytes32 indexed credentialHash,
        address signer,
        uint8 reason
    );

    error InvalidAdmin();
    error InvalidInstitution();
    error InstitutionAlreadyRegistered(bytes32 institutionId);
    error UnknownInstitution(bytes32 institutionId);
    error InvalidSigner();
    error SignerAlreadyAssigned(address signer);
    error NotASigner(address account);
    error InstitutionNotActive(bytes32 institutionId);
    error InstitutionNotSuspended(bytes32 institutionId);
    error InvalidRoot();
    error InvalidSize();
    error InvalidReason();
    error BatchAlreadyAnchored(bytes32 root);
    error UnknownBatch(bytes32 root);
    error NotInBatch();
    error AlreadyRevoked();
    error BatchAlreadyRevoked(bytes32 root);

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Emergency stop for anchoring and revoking; verification keeps working.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /// @notice Resume anchoring and revoking after an emergency stop.
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

    /// @notice Restore a suspended institution's accreditation.
    function reinstateInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.SUSPENDED) revert InstitutionNotSuspended(institutionId);
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

    /// @notice Revoke one credential of the caller's institution, including batches signed by its former wallets.
    /// @param reason 1 = issued in error, 2 = fraud, 3 = superseded, 4 = other, 5 = signer compromised. 0 is invalid.
    function revoke(
        bytes32 root,
        bytes32 credentialHash,
        bytes32[] calldata proof,
        uint8 reason
    ) external whenNotPaused {
        bytes32 institutionId = _activeInstitutionOf(msg.sender);
        if (reason == 0) revert InvalidReason();
        if (_batches[institutionId][root].anchoredAt == 0) revert UnknownBatch(root);
        if (!MerkleProof.verifyCalldata(proof, root, leafOf(credentialHash))) revert NotInBatch();

        bytes32 key = _revocationKey(institutionId, root, credentialHash);
        if (_revocations[key].revokedAt != 0) revert AlreadyRevoked();

        _revocations[key] = Revocation({revokedAt: uint64(block.timestamp), reason: reason, signer: msg.sender});
        emit CredentialRevoked(institutionId, root, credentialHash, msg.sender, reason);
    }

    /// @notice Emergency: revoke a whole batch, e.g. one anchored with a stolen signer key (ADR 0004).
    /// @dev Admin only: roots are public in events, so a stolen signer key must not be able to wipe out genuine batches.
    function revokeBatch(bytes32 institutionId, bytes32 root, uint8 reason) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (reason == 0) revert InvalidReason();
        if (_batches[institutionId][root].anchoredAt == 0) revert UnknownBatch(root);
        if (_batchRevocations[institutionId][root].revokedAt != 0) revert BatchAlreadyRevoked(root);

        _batchRevocations[institutionId][root] =
            Revocation({revokedAt: uint64(block.timestamp), reason: reason, signer: msg.sender});
        emit BatchRevoked(institutionId, root, reason);
    }

    /// @notice Anyone can call this, even while paused. `institutionId` must be derived from the credential payload.
    function verify(
        bytes32 institutionId,
        bytes32 root,
        bytes32 credentialHash,
        bytes32[] calldata proof
    ) external view returns (VerificationResult memory result) {
        Batch memory batch = _batches[institutionId][root];
        if (batch.anchoredAt == 0) return result;
        if (!MerkleProof.verifyCalldata(proof, root, leafOf(credentialHash))) return result;

        Revocation memory rev = _batchRevocations[institutionId][root];
        if (rev.revokedAt == 0) rev = _revocations[_revocationKey(institutionId, root, credentialHash)];
        result.institutionActive = _institutions[institutionId] == InstitutionState.ACTIVE;
        result.anchoredAt = batch.anchoredAt;
        result.signer = batch.signer;
        result.revokedAt = rev.revokedAt;
        result.reason = rev.reason;
        result.status = rev.revokedAt == 0 ? Status.VALID : Status.REVOKED;
    }

    /// @notice Accreditation state of an institution (NONE if never registered).
    function institutionState(bytes32 institutionId) external view returns (InstitutionState) {
        return _institutions[institutionId];
    }

    /// @notice Institution a wallet currently signs for (zero if none).
    function institutionOf(address signer) external view returns (bytes32) {
        return _institutionOf[signer];
    }

    /// @notice Anchor time, size and signing wallet of an institution's root (zero values if unknown).
    function getBatch(bytes32 institutionId, bytes32 root) external view returns (Batch memory) {
        return _batches[institutionId][root];
    }

    /// @notice Merkle leaf for a credential hash, identical to OpenZeppelin StandardMerkleTree(["bytes32"]).
    function leafOf(bytes32 credentialHash) public pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(credentialHash))));
    }

    function _activeInstitutionOf(address signer) private view returns (bytes32 institutionId) {
        institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
    }

    function _revocationKey(bytes32 institutionId, bytes32 root, bytes32 credentialHash)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(institutionId, root, credentialHash));
    }
}
