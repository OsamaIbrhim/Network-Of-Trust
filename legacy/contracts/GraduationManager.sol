// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./ICertificateValidator.sol";

// Minimal interfaces for external contracts
interface IIdentity {
    function getUserRole(address _userAddress) external view returns (uint8);
    function isVerifiedUser(address _userAddress) external view returns (bool);
    function isStudentEnrolled(address _institution, address _student) external view returns (bool);
}

interface IStudentAcademicManager {
    function getStudentGpa(address _student) external view returns (uint256);
    function getStudentTotalCredits(address _student) external view returns (uint256);
    function getStudentEnrolledCourses(address _student) external view returns (string[] memory);
    function getStudentEnrollment(
        address _student,
        string calldata courseId,
        string calldata semester
    ) external view returns (
        string memory,
        string memory,
        uint8,
        bool,
        uint256
    );
    function getStudentSemestersForCourse(
        address _student,
        string calldata courseId
    ) external view returns (string[] memory);
}

contract GraduationManager is Ownable, ReentrancyGuard, Pausable, ICertificateValidator {

    // ---------- Enums ----------

    enum GraduationStatus { NOT_ELIGIBLE, ELIGIBLE, APPROVED, GRADUATED }

    // ---------- Structs ----------

    struct GraduationRequirement {
        string department;
        uint256 minimumCredits;
        uint256 minimumGpa;
        string[] requiredCourseIds;
        bool thesisRequired;
        bool internshipRequired;
        uint256 eligibilityWindowDays;
        bool isActive;
    }

    struct GraduationRecord {
        GraduationStatus status;
        address enrollingInstitution;
        string department;
        uint256 eligibilityCheckDate;
        uint256 eligibilityExpiryDate;
        uint256 approvalDate;
        uint256 graduationDate;
        address approvedBy;
        bytes32 degreeCertificateId;
        string degreeType;
        bool degreeIssued;
        uint256 lastUpdateTimestamp;
    }

    // ---------- State ----------

    IIdentity public identityContract;
    IStudentAcademicManager public academicContract;

    mapping(address => GraduationStatus) public graduationStatus;
    mapping(address => GraduationRecord) public graduationRecords;
    mapping(address => mapping(bytes32 => GraduationRequirement)) public graduationRequirements;
    mapping(address => bool) public requirementsConfigured;
    mapping(address => address[]) public institutionGraduates;
    mapping(address => bytes32[]) public institutionDepartments;

    // ---------- Events ----------

    event RequirementsConfigured(
        address indexed institution,
        bytes32 indexed department,
        uint256 minimumCredits,
        uint256 minimumGpa,
        uint256 timestamp
    );

    event EligibilityAchieved(
        address indexed student,
        address indexed institution,
        bytes32 department,
        uint256 eligibilityExpiry,
        uint256 totalCredits,
        uint256 gpa,
        uint256 timestamp
    );

    event GraduationApproved(
        address indexed student,
        address indexed institution,
        bytes32 department,
        uint256 approvalDate,
        uint256 timestamp
    );

    event StudentGraduated(
        address indexed student,
        address indexed institution,
        bytes32 certificateId,
        string degreeType,
        uint256 graduationDate,
        uint256 timestamp
    );

    event AdminEmergencyStatusSet(
        address indexed student,
        GraduationStatus previousStatus,
        GraduationStatus newStatus,
        string reason,
        uint256 timestamp
    );

    // ---------- Modifiers ----------

    modifier onlyVerifiedInstitution() {
        require(
            identityContract.isVerifiedUser(msg.sender) &&
            identityContract.getUserRole(msg.sender) == 2, // INSTITUTION = 2
            "Not a verified institution"
        );
        _;
    }

    modifier onlyEnrolledInstitution(address student) {
        require(
            identityContract.isStudentEnrolled(msg.sender, student),
            "Not the enrolling institution"
        );
        _;
    }

    // ---------- Constructor ----------

    constructor(
        address _identityContract,
        address _academicContract
    ) Ownable() {
        require(_identityContract != address(0), "Identity contract cannot be zero address");
        require(_academicContract != address(0), "Academic contract cannot be zero address");

        identityContract = IIdentity(_identityContract);
        academicContract = IStudentAcademicManager(_academicContract);
    }

    // -------------------------------------------------------
    //  REQUIREMENTS CONFIGURATION
    // -------------------------------------------------------

    function setRequirements(
        string calldata department,
        uint256 minimumCredits,
        uint256 minimumGpa,
        string[] calldata requiredCourseIds,
        bool thesisRequired,
        bool internshipRequired,
        uint256 eligibilityWindowDays
    ) external onlyVerifiedInstitution {
        address institution = msg.sender;
        bytes32 deptKey = keccak256(abi.encodePacked(department));

        graduationRequirements[institution][deptKey] = GraduationRequirement({
            department: department,
            minimumCredits: minimumCredits,
            minimumGpa: minimumGpa,
            requiredCourseIds: requiredCourseIds,
            thesisRequired: thesisRequired,
            internshipRequired: internshipRequired,
            eligibilityWindowDays: eligibilityWindowDays,
            isActive: true
        });

        requirementsConfigured[institution] = true;

        // Track department for this institution
        bytes32[] storage depts = institutionDepartments[institution];
        bool deptFound = false;
        for (uint i = 0; i < depts.length; i++) {
            if (depts[i] == deptKey) {
                deptFound = true;
                break;
            }
        }
        if (!deptFound) {
            depts.push(deptKey);
        }

        emit RequirementsConfigured(institution, deptKey, minimumCredits, minimumGpa, block.timestamp);
    }

    // -------------------------------------------------------
    //  INTERNAL HELPERS
    // -------------------------------------------------------

    function _isCourseCompleted(address student, string memory courseId) internal view returns (bool) {
        string[] memory semesters = academicContract.getStudentSemestersForCourse(student, courseId);
        for (uint i = 0; i < semesters.length; i++) {
            (, , , bool completed, ) = academicContract.getStudentEnrollment(student, courseId, semesters[i]);
            if (completed) {
                return true;
            }
        }
        return false;
    }

    function _isCourseIdMatch(string memory a, string memory b) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    // -------------------------------------------------------
    //  ELIGIBILITY CHECK
    // -------------------------------------------------------

    function checkEligibility(
        address student,
        bytes32 departmentKey
    ) external onlyVerifiedInstitution onlyEnrolledInstitution(student) {
        address institution = msg.sender;
        require(requirementsConfigured[institution], "Requirements not configured");

        GraduationRequirement memory reqs = graduationRequirements[institution][departmentKey];
        require(reqs.isActive, "Requirements not active");

        require(uint256(graduationStatus[student]) == 0, "Invalid status for eligibility check");

        uint256 studentGpa = academicContract.getStudentGpa(student);
        uint256 studentCredits = academicContract.getStudentTotalCredits(student);
        bool isEligible = true;

        if (reqs.minimumCredits > 0 && studentCredits < reqs.minimumCredits) {
            isEligible = false;
        }

        if (isEligible && reqs.minimumGpa > 0 && studentGpa < reqs.minimumGpa) {
            isEligible = false;
        }

        if (isEligible && reqs.requiredCourseIds.length > 0) {
            isEligible = _checkRequiredCourses(student, reqs.requiredCourseIds);
        }

        if (isEligible) {
            uint256 expiry = 0;
            if (reqs.eligibilityWindowDays > 0) {
                expiry = block.timestamp + reqs.eligibilityWindowDays * 1 days;
            }

            graduationStatus[student] = GraduationStatus.ELIGIBLE;
            graduationRecords[student] = GraduationRecord({
                status: GraduationStatus.ELIGIBLE,
                enrollingInstitution: institution,
                department: reqs.department,
                eligibilityCheckDate: block.timestamp,
                eligibilityExpiryDate: expiry,
                approvalDate: 0,
                graduationDate: 0,
                approvedBy: address(0),
                degreeCertificateId: bytes32(0),
                degreeType: "",
                degreeIssued: false,
                lastUpdateTimestamp: block.timestamp
            });

            emit EligibilityAchieved(
                student, institution, departmentKey, expiry,
                studentCredits, studentGpa, block.timestamp
            );
        }
    }

    function _checkRequiredCourses(address student, string[] memory required) internal view returns (bool) {
        string[] memory enrolled = academicContract.getStudentEnrolledCourses(student);
        for (uint i = 0; i < required.length; i++) {
            bool found = false;
            for (uint j = 0; j < enrolled.length; j++) {
                if (_isCourseIdMatch(required[i], enrolled[j])) {
                    if (_isCourseCompleted(student, enrolled[j])) {
                        found = true;
                    }
                    break;
                }
            }
            if (!found) {
                return false;
            }
        }
        return true;
    }

    // -------------------------------------------------------
    //  GRADUATION APPROVAL
    // -------------------------------------------------------

    function approveGraduation(address student) external onlyVerifiedInstitution onlyEnrolledInstitution(student) {
        require(
            graduationStatus[student] == GraduationStatus.ELIGIBLE,
            "Student is not eligible"
        );

        GraduationRecord storage record = graduationRecords[student];

        if (record.eligibilityExpiryDate > 0) {
            require(block.timestamp <= record.eligibilityExpiryDate, "Eligibility expired");
        }

        record.status = GraduationStatus.APPROVED;
        record.approvalDate = block.timestamp;
        record.approvedBy = msg.sender;
        record.lastUpdateTimestamp = block.timestamp;
        graduationStatus[student] = GraduationStatus.APPROVED;

        emit GraduationApproved(
            student, msg.sender,
            keccak256(abi.encodePacked(record.department)),
            block.timestamp, block.timestamp
        );
    }

    // -------------------------------------------------------
    //  FINALIZE GRADUATION (after Certificates issue)
    // -------------------------------------------------------

    function finalizeGraduation(
        address student,
        bytes32 certificateId,
        string calldata degreeType
    ) external onlyVerifiedInstitution onlyEnrolledInstitution(student) {
        require(
            graduationStatus[student] == GraduationStatus.APPROVED,
            "Graduation not approved"
        );

        GraduationRecord storage record = graduationRecords[student];
        require(!record.degreeIssued, "Degree already issued");
        require(record.approvedBy == msg.sender, "Not the approving institution");

        record.status = GraduationStatus.GRADUATED;
        record.graduationDate = block.timestamp;
        record.degreeCertificateId = certificateId;
        record.degreeType = degreeType;
        record.degreeIssued = true;
        record.lastUpdateTimestamp = block.timestamp;
        graduationStatus[student] = GraduationStatus.GRADUATED;

        institutionGraduates[msg.sender].push(student);

        emit StudentGraduated(
            student, msg.sender, certificateId,
            degreeType, block.timestamp, block.timestamp
        );
    }

    // -------------------------------------------------------
    //  CERTIFICATE VALIDATION HOOK (ICertificateValidator)
    // -------------------------------------------------------

    function validateIssuance(
        address institution,
        address student,
        string calldata
    ) external view override returns (bool allowed, string memory reason) {
        if (graduationStatus[student] != GraduationStatus.APPROVED) {
            return (false, "Graduation not approved");
        }

        GraduationRecord memory record = graduationRecords[student];
        if (record.approvedBy != institution) {
            return (false, "Not the approving institution");
        }

        if (!identityContract.isStudentEnrolled(institution, student)) {
            return (false, "Not the enrolling institution");
        }

        return (true, "");
    }

    // -------------------------------------------------------
    //  VIEW FUNCTIONS
    // -------------------------------------------------------

    function getGraduationStatus(address student) external view returns (GraduationStatus) {
        return graduationStatus[student];
    }

    function getGraduationRecord(address student) external view returns (GraduationRecord memory) {
        return graduationRecords[student];
    }

    function getGraduationRequirements(address institution, bytes32 department) external view returns (GraduationRequirement memory) {
        return graduationRequirements[institution][department];
    }

    function getInstitutionGraduates(address institution) external view returns (address[] memory) {
        return institutionGraduates[institution];
    }

    // -------------------------------------------------------
    //  ADMIN EMERGENCY OVERRIDE
    // -------------------------------------------------------

    function adminSetGraduationStatus(
        address student,
        GraduationStatus newStatus,
        string calldata reason
    ) external onlyOwner {
        GraduationStatus previousStatus = graduationStatus[student];
        graduationStatus[student] = newStatus;
        graduationRecords[student].status = newStatus;
        graduationRecords[student].lastUpdateTimestamp = block.timestamp;

        emit AdminEmergencyStatusSet(student, previousStatus, newStatus, reason, block.timestamp);
    }
}