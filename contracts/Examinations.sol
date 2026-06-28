// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "./Identity.sol";

contract Examinations is ReentrancyGuard {
    Identity public identityContract;
    
    struct Examination {
        address institution;
        string ipfsHash;  // Contains exam details and questions
        uint256 startTime;
        uint256 endTime;
        bool isActive;
        mapping(address => bool) registeredStudents;
        mapping(address => string) studentAnswers;  // IPFS hash of student answers
        mapping(address => uint256) grades;
        mapping(address => bool) graded;
    }
    
    mapping(bytes32 => Examination) public examinations;
    mapping(address => bytes32[]) public institutionExams;
    mapping(address => bytes32[]) public studentExams;
    
    event ExaminationCreated(bytes32 indexed examId, address indexed institution);
    event StudentRegistered(bytes32 indexed examId, address indexed student);
    event AnswersSubmitted(bytes32 indexed examId, address indexed student);
    event GradeAssigned(bytes32 indexed examId, address indexed student, uint256 grade);
    
    constructor(address _identityContract) {
        identityContract = Identity(_identityContract);
    }
    
    modifier onlyVerifiedInstitution() {
        require(
            identityContract.getUserRole(msg.sender) == Identity.UserRole.INSTITUTION &&
            identityContract.isVerifiedUser(msg.sender),
            "Not a verified institution"
        );
        _;
    }
    
    modifier onlyVerifiedStudent() {
        require(
            identityContract.getUserRole(msg.sender) == Identity.UserRole.STUDENT &&
            identityContract.isVerifiedUser(msg.sender),
            "Not a verified student"
        );
        _;
    }
    
    function createExamination(
        string memory _ipfsHash,
        uint256 _startTime,
        uint256 _endTime
    ) external onlyVerifiedInstitution nonReentrant returns (bytes32) {
        require(_startTime > block.timestamp, "Invalid start time");
        require(_endTime > _startTime, "Invalid end time");
        
        bytes32 examId = keccak256(
            abi.encodePacked(msg.sender, _ipfsHash, _startTime, _endTime)
        );
        
        Examination storage exam = examinations[examId];
        exam.institution = msg.sender;
        exam.ipfsHash = _ipfsHash;
        exam.startTime = _startTime;
        exam.endTime = _endTime;
        exam.isActive = true;
        
        institutionExams[msg.sender].push(examId);
        
        emit ExaminationCreated(examId, msg.sender);
        
        return examId;
    }
    
    function registerForExam(bytes32 _examId) external onlyVerifiedStudent nonReentrant {
        Examination storage exam = examinations[_examId];
        require(exam.isActive, "Examination not active");
        require(block.timestamp < exam.startTime, "Registration period ended");
        require(!exam.registeredStudents[msg.sender], "Already registered");
        
        exam.registeredStudents[msg.sender] = true;
        studentExams[msg.sender].push(_examId);
        
        emit StudentRegistered(_examId, msg.sender);
    }
    
    function submitAnswers(
        bytes32 _examId,
        string memory _answersIpfsHash
    ) external onlyVerifiedStudent nonReentrant {
        Examination storage exam = examinations[_examId];
        require(exam.isActive, "Examination not active");
        require(exam.registeredStudents[msg.sender], "Not registered for exam");
        require(
            block.timestamp >= exam.startTime && block.timestamp <= exam.endTime,
            "Not within examination period"
        );
        
        exam.studentAnswers[msg.sender] = _answersIpfsHash;
        
        emit AnswersSubmitted(_examId, msg.sender);
    }
    
    function assignGrade(
        bytes32 _examId,
        address _student,
        uint256 _grade
    ) external onlyVerifiedInstitution nonReentrant {
        Examination storage exam = examinations[_examId];
        require(exam.institution == msg.sender, "Not examination creator");
        require(exam.registeredStudents[_student], "Student not registered");
        require(!exam.graded[_student], "Already graded");
        require(_grade <= 100, "Invalid grade");
        
        exam.grades[_student] = _grade;
        exam.graded[_student] = true;
        
        emit GradeAssigned(_examId, _student, _grade);
    }
    
    function getExamDetails(bytes32 _examId) external view returns (
        address institution,
        string memory ipfsHash,
        uint256 startTime,
        uint256 endTime,
        bool isActive
    ) {
        Examination storage exam = examinations[_examId];
        return (
            exam.institution,
            exam.ipfsHash,
            exam.startTime,
            exam.endTime,
            exam.isActive
        );
    }
    
    function getStudentGrade(bytes32 _examId, address _student) external view returns (
        uint256 grade,
        bool isGraded
    ) {
        Examination storage exam = examinations[_examId];
        return (exam.grades[_student], exam.graded[_student]);
    }
} 