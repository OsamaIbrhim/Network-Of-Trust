// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

interface IIdentity {
    enum UserRole { NONE, STUDENT, INSTITUTION, EMPLOYER, ADMIN }
    
    function getUserRole(address _userAddress) external view returns (UserRole);
    function isVerifiedUser(address _userAddress) external view returns (bool);
    function userExists(address _userAddress) external view returns (bool);
    function isStudentEnrolled(address _institution, address _student) external view returns (bool);
}

contract ExamManagement is Ownable, Pausable {
    using Counters for Counters.Counter;

    IIdentity public identityContract;

    enum ExamStatus { UPCOMING, IN_PROGRESS, COMPLETED }

    struct Exam {
        address institution;      // Institution that created the exam
        string title;            // Exam title
        string description;      // Exam description
        uint256 date;           // Exam date in unix timestamp
        uint256 duration;       // Duration in minutes
        string ipfsHash;        // TODO: IPFS implementation will be added later for PDF file storage
        address[] students;     // Enrolled students
        bool exists;            // Whether the exam exists
        ExamStatus status;      // Exam status
    }

    struct ExamResult {
        uint256 score;
        string grade;
        string notes;
        bool exists;
    }

    // Mappings
    mapping(bytes32 => Exam) public exams;
    mapping(bytes32 => mapping(address => ExamResult)) public examResults;
    mapping(address => bytes32[]) public institutionExams;
    mapping(address => bytes32[]) public studentExams;

    // Counters
    Counters.Counter private _examIds;

    // Events
    // TODO: IPFS hash will be added to event later
    event ExamCreated(
        bytes32 indexed examId,
        address indexed institution,
        string title,
        string description,
        uint256 date,
        uint256 duration,
        ExamStatus status
    );
    event ExamUpdated(bytes32 indexed examId, string title, uint256 date, ExamStatus status);
    event StudentsRegistered(bytes32 indexed examId, address[] students);
    event ResultSubmitted(bytes32 indexed examId, address indexed student);

    constructor(address _identityContractAddress) {
        identityContract = IIdentity(_identityContractAddress);
    }

    /// @dev Computes the current exam status from time-based criteria.
    ///      This is the SINGLE source of truth for exam status.
    ///      The stored `exam.status` field is DEPRECATED and may be stale.
    /// @param exam The Exam struct stored in the exams mapping
    /// @return ExamStatus The current status based on block.timestamp
    function _getCurrentStatus(Exam memory exam) private view returns (ExamStatus) {
        if (block.timestamp < exam.date) {
            return ExamStatus.UPCOMING;
        } else if (block.timestamp < exam.date + exam.duration * 1 minutes) {
            return ExamStatus.IN_PROGRESS;
        } else {
            return ExamStatus.COMPLETED;
        }
    }

    // Modifiers
    modifier onlyVerifiedInstitution() {
        require(identityContract.getUserRole(msg.sender) == IIdentity.UserRole.INSTITUTION, "Not a registered institution");
        require(identityContract.isVerifiedUser(msg.sender), "Institution is not verified");
        _;
    }

    modifier onlyExistingExam(bytes32 examId) {
        require(exams[examId].exists, "Exam does not exist");
        _;
    }
    
    // Exam Management
    // TODO: IPFS parameter will be added later for PDF storage
    function createExam(
        string memory title,
        string memory description,
        uint256 examDate,
        uint256 duration
    ) external onlyVerifiedInstitution returns (bytes32) {
        _examIds.increment();
        bytes32 examId = keccak256(abi.encodePacked(_examIds.current(), msg.sender));
        
        // Determine initial status based on date
        ExamStatus initialStatus;
        if (examDate < block.timestamp) {
            revert("Exam date must be in the future");
        } else if (examDate == block.timestamp) {
            initialStatus = ExamStatus.IN_PROGRESS;
        } else {
            initialStatus = ExamStatus.UPCOMING;
        }

        exams[examId] = Exam({
            institution: msg.sender,
            title: title,
            description: description,
            date: examDate,
            duration: duration,
            ipfsHash: "", // TODO: Will be implemented later
            students: new address[](0),
            exists: true,
            status: initialStatus
        });

        institutionExams[msg.sender].push(examId);

        emit ExamCreated(
            examId,
            msg.sender,
            title,
            description,
            examDate,
            duration,
            initialStatus
        );
        return examId;
    }

    // TODO: Will add IPFS update functionality later
    function updateExam(
        bytes32 examId,
        string memory newTitle,
        string memory newDescription,
        uint256 newDate,
        uint256 newDuration,
        bool newExists
    ) external onlyVerifiedInstitution onlyExistingExam(examId) {
        Exam storage exam = exams[examId];
        exam.title = newTitle;
        exam.description = newDescription;
        exam.date = newDate;
        exam.duration = newDuration;
        exam.exists = newExists;
        
        // Update status based on new date
        if (newDate < block.timestamp) {
            exam.status = ExamStatus.COMPLETED;
        } else if (newDate == block.timestamp) {
            exam.status = ExamStatus.IN_PROGRESS;
        } else {
            exam.status = ExamStatus.UPCOMING;
        }
        
        emit ExamUpdated(examId, newTitle, newDate, exam.status);
    }

    function registerStudentsForExam(
        bytes32 examId,
        address[] memory studentAddresses
    ) external onlyVerifiedInstitution onlyExistingExam(examId) {
        require(studentAddresses.length > 0, "Student list cannot be empty");

        for (uint i = 0; i < studentAddresses.length; i++) {
            address studentAddress = studentAddresses[i];
            require(identityContract.userExists(studentAddress), "Student does not exist in Identity");
            require(identityContract.getUserRole(studentAddress) == IIdentity.UserRole.STUDENT, "User is not a student in Identity");
            require(identityContract.isStudentEnrolled(msg.sender, studentAddress), "Student is not enrolled in this institution");

            bool alreadyRegistered = false;
            for (uint j = 0; j < studentExams[studentAddress].length; j++) {
                if (studentExams[studentAddress][j] == examId) {
                    alreadyRegistered = true;
                    break;
                }
            }

            if (!alreadyRegistered) {
                studentExams[studentAddress].push(examId);
                exams[examId].students.push(studentAddress);
            } else {
                revert("Student already registered for this exam");
            }
        }

        emit StudentsRegistered(examId, studentAddresses);
    }

    // Result Management
    function submitResult(
        bytes32 examId,
        address student,
        uint256 score,
        string memory grade,
        string memory notes
    ) external onlyVerifiedInstitution onlyExistingExam(examId) {
        require(identityContract.isStudentEnrolled(msg.sender, student), "Student is not enrolled in this institution");

        
        examResults[examId][student] = ExamResult({
            score: score,
            grade: grade,
            notes: notes,
            exists: true
        });

        emit ResultSubmitted(examId, student);
    }

    function getExamResult(bytes32 examId, address student) external view returns (
        uint256 score,
        string memory grade,
        string memory notes
    ) {
        ExamResult memory result = examResults[examId][student];
        return (
            result.score,
            result.grade,
            result.notes
        );
    }

    function getExamStatistics(bytes32 examId) external view returns (
        uint256 totalStudents,
        uint256 passRate,
        uint256 averageScore
    ) {
        Exam memory exam = exams[examId];
        uint256 total = 0;
        uint256 passed = 0;
        uint256 scoreSum = 0;
        
        for (uint i = 0; i < exam.students.length; i++) {
            ExamResult memory result = examResults[examId][exam.students[i]];
            if (result.exists) {
                total++;
                scoreSum += result.score;
                if (result.score >= 60) {
                    passed++;
                }
            }
        }
        
        return (
            total,
            total > 0 ? (passed * 100) / total : 0,
            total > 0 ? scoreSum / total : 0
        );
    }

    function getUserExams(address user) external view returns (bytes32[] memory) {
        IIdentity.UserRole role = identityContract.getUserRole(user);

        if (role == IIdentity.UserRole.INSTITUTION) {
            return institutionExams[user];
        } else if (role == IIdentity.UserRole.STUDENT) {
            return studentExams[user];
        } else {
            revert("Unsupported role or user does not exist");
        }
    }

    function getStudentExamsWithStatus(address studentAddress) 
        external 
        view 
        returns (
            bytes32[] memory upcomingExams,
            bytes32[] memory inProgressExams,
            bytes32[] memory completedExams,
            ExamResult[] memory completedResults
        ) 
    {
        require(
            identityContract.getUserRole(studentAddress) == IIdentity.UserRole.STUDENT,
            "Address is not a student"
        );

        bytes32[] memory allExams = studentExams[studentAddress];
        
        // First count exams of each type
        uint256 upcomingCount = 0;
        uint256 inProgressCount = 0;
        uint256 completedCount = 0;
        
        for (uint i = 0; i < allExams.length; i++) {
            Exam memory exam = exams[allExams[i]];
            ExamStatus currentStatus = _getCurrentStatus(exam);
            if (currentStatus == ExamStatus.UPCOMING) {
                upcomingCount++;
            } else if (currentStatus == ExamStatus.IN_PROGRESS) {
                inProgressCount++;
            } else if (currentStatus == ExamStatus.COMPLETED) {
                completedCount++;
            }
        }
        
        // Initialize arrays with correct sizes
        upcomingExams = new bytes32[](upcomingCount);
        inProgressExams = new bytes32[](inProgressCount);
        completedExams = new bytes32[](completedCount);
        completedResults = new ExamResult[](completedCount);
        
        // Reset counters to use as indices
        upcomingCount = 0;
        inProgressCount = 0;
        completedCount = 0;
        
        // Fill arrays
        for (uint i = 0; i < allExams.length; i++) {
            bytes32 examId = allExams[i];
            Exam memory exam = exams[examId];
            ExamStatus currentStatus = _getCurrentStatus(exam);
            
            if (currentStatus == ExamStatus.UPCOMING) {
                upcomingExams[upcomingCount] = examId;
                upcomingCount++;
            } else if (currentStatus == ExamStatus.IN_PROGRESS) {
                inProgressExams[inProgressCount] = examId;
                inProgressCount++;
            } else if (currentStatus == ExamStatus.COMPLETED) {
                completedExams[completedCount] = examId;
                completedResults[completedCount] = examResults[examId][studentAddress];
                completedCount++;
            }
        }
        
        return (upcomingExams, inProgressExams, completedExams, completedResults);
    }

    function getExam(bytes32 examId) external view returns (Exam memory) {
        Exam memory exam = exams[examId];
        exam.status = _getCurrentStatus(exam);
        return exam;
    }
}