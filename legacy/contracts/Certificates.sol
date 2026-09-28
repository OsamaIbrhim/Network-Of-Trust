// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Identity.sol";
import "./ICertificateValidator.sol";

contract Certificates is ReentrancyGuard {
    Identity public identityContract;
    
    struct Certificate {
        address student;
        address institution;
        string ipfsHash;
        uint256 issuedAt;
        bool isValid;
    }

    struct CertificateInfo {
        bytes32 certificate;
        string ipfsHash;
        bool exist;
    }
    
    mapping(bytes32 => Certificate) public certificates;
    mapping(address => CertificateInfo[]) public userCertificates;

    event CertificateIssued(bytes32 indexed certificateId, address indexed student, address indexed institution);
    event CertificateRevoked(bytes32 indexed certificateId);
    event ValidationContractUpdated(address indexed previousContract, address indexed newContract, address indexed updatedBy);
    
    address public validationContract;

    constructor(address _identityContract) {
        identityContract = Identity(_identityContract);
    }
    
    modifier onlyVerifiedInstitution() {
        require(
            identityContract.getUserRole(msg.sender) == Identity.UserRole.INSTITUTION &&
            identityContract.isVerifiedUser(msg.sender),
            "Not a verified institution Or user is not Institution"
        );
        _;
    }

    modifier withValidation(address _student, string memory _ipfsHash) {
        if (validationContract != address(0)) {
            (bool allowed, string memory reason) = ICertificateValidator(validationContract)
                .validateIssuance(msg.sender, _student, _ipfsHash);
            require(allowed, reason);
        }
        _;
    }
    
    function issueCertificate(
        address _student,
        string memory _ipfsHash
    ) external onlyVerifiedInstitution nonReentrant withValidation(_student, _ipfsHash) returns (bytes32) {
        require(identityContract.getUserRole(_student) == Identity.UserRole.STUDENT, "The address you are trying to give the certificate is not a student address.");
        require(bytes(_ipfsHash).length > 0, "Invalid IPFS hash");
        
        bytes32 certificateId = keccak256(
            abi.encodePacked(_student, msg.sender, _ipfsHash, block.timestamp)
        );
        
        require(certificates[certificateId].issuedAt == 0, "Certificate already exists");
        
        certificates[certificateId] = Certificate(
            _student,
            msg.sender,
            _ipfsHash,
            block.timestamp,
            true
        );
        
        userCertificates[_student].push(CertificateInfo({
            certificate: certificateId,
            ipfsHash: _ipfsHash,
            exist: true
        }));
        userCertificates[msg.sender].push(CertificateInfo({
            certificate: certificateId,
            ipfsHash: _ipfsHash,
            exist: true
        }));

        emit CertificateIssued(certificateId, _student, msg.sender);
        
        return certificateId;
    }
    
    function revokeCertificate(bytes32 _certificateId) external nonReentrant {
        Certificate storage cert = certificates[_certificateId];
        require(cert.issuedAt > 0, "Certificate does not exist");
        require(cert.institution == msg.sender, "Not certificate issuer");
        require(cert.isValid, "Certificate already revoked");
        
        cert.isValid = false;
        emit CertificateRevoked(_certificateId);
    }
    
    function verifyCertificate(bytes32 _certificateId) external view returns (
        address student,
        address institution,
        string memory ipfsHash,
        uint256 issuedAt,
        bool isValid
    ) {
        Certificate memory cert = certificates[_certificateId];
        require(cert.issuedAt > 0, "Certificate does not exist");
        
        return (
            cert.student,
            cert.institution,
            cert.ipfsHash,
            cert.issuedAt,
            cert.isValid
        );
    }

    function getUserCertificates(address _user) external view returns (CertificateInfo[] memory) {
        return userCertificates[_user];
    }

    function setValidationContract(address _validationContract) external {
        require(
            identityContract.getUserRole(msg.sender) == Identity.UserRole.ADMIN ||
            msg.sender == identityContract.owner(),
            "Not an admin"
        );
        require(_validationContract == address(0) || _validationContract.code.length > 0, "Validator must be a contract");
        address previousContract = validationContract;
        validationContract = _validationContract;
        emit ValidationContractUpdated(previousContract, _validationContract, msg.sender);
    }
}
