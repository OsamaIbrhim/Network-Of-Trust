// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Identity.sol";
import "./CourseManagement.sol";

contract StudentAcademicManager is Ownable, Pausable {
    Identity public identityContract;
    CourseManagement public courseManagementContract;

    struct Enrollment {
        string courseId;
        string semester;
        uint8 grade;
        bool isCompleted;
        uint256 enrollmentDate;
    }

    struct StudentAcademicRecord {
        mapping(string => mapping(string => Enrollment)) enrollments; // courseId => semester => Enrollment
        string[] enrolledCourses;
        mapping(string => string[]) semestersByCourse;
        uint256 totalCredits;
        uint256 gpa;
        uint256 lastUpdateTimestamp;
    }

    mapping(address => StudentAcademicRecord) private studentRecords;
    mapping(string => mapping(string => mapping(address => bool))) private courseEnrollments;

    event StudentEnrolled(address indexed student, string courseId, string semester);
    event GradeUpdated(address indexed student, string courseId, string semester, uint8 grade);
    event EnrollmentCompleted(address indexed student, string courseId, string semester);
    event GpaUpdated(address indexed student, uint256 newGpa);

    modifier onlyVerifiedInstitution() {
        require(
            identityContract.isVerifiedUser(msg.sender) &&
            identityContract.getUserRole(msg.sender) == Identity.UserRole.INSTITUTION,
            "Not a verified institution"
        );
        _;
    }

    modifier onlyVerifiedStudent(address _student) {
        require(
            identityContract.isVerifiedUser(_student) &&
            identityContract.getUserRole(_student) == Identity.UserRole.STUDENT,
            "Not a verified student"
        );
        _;
    }

    constructor(address _identityAddress, address _courseManagementAddress) {
        require(_identityAddress != address(0), "Invalid identity contract address");
        require(_courseManagementAddress != address(0), "Invalid course management contract address");
        identityContract = Identity(_identityAddress);
        courseManagementContract = CourseManagement(_courseManagementAddress);
    }

    function enrollStudent(
        address _student,
        string memory _courseId,
        string memory _semester
    ) external onlyVerifiedInstitution onlyVerifiedStudent(_student) {
        require(identityContract.isStudentEnrolled(msg.sender, _student), "Student not enrolled under this institution");
        require(!courseEnrollments[_courseId][_semester][_student], "Student already enrolled in this course for this semester");
        
        (, , , , bool isActive, ) = courseManagementContract.getCourseStaticDetails(msg.sender, _courseId);
        require(isActive, "Course is not active");

        StudentAcademicRecord storage record = studentRecords[_student];
        
        // Initialize enrollment
        record.enrollments[_courseId][_semester] = Enrollment({
            courseId: _courseId,
            semester: _semester,
            grade: 0,
            isCompleted: false,
            enrollmentDate: block.timestamp
        });

        // Update tracking data
        record.enrolledCourses.push(_courseId);
        record.semestersByCourse[_courseId].push(_semester);
        courseEnrollments[_courseId][_semester][_student] = true;
        record.lastUpdateTimestamp = block.timestamp;

        emit StudentEnrolled(_student, _courseId, _semester);
    }

    function updateGrade(
        address _student,
        string memory _courseId,
        string memory _semester,
        uint8 _grade
    ) external onlyVerifiedInstitution onlyVerifiedStudent(_student) {
        require(identityContract.isStudentEnrolled(msg.sender, _student), "Student not enrolled under this institution");
        require(_grade <= 100, "Invalid grade");
        require(courseEnrollments[_courseId][_semester][_student], "Student not enrolled in this course");

        StudentAcademicRecord storage record = studentRecords[_student];
        Enrollment storage enrollment = record.enrollments[_courseId][_semester];
        require(!enrollment.isCompleted, "Course already completed");

        enrollment.grade = _grade;
        enrollment.isCompleted = true;
        record.lastUpdateTimestamp = block.timestamp;

        // Update GPA
        updateStudentGpa(_student);

        emit GradeUpdated(_student, _courseId, _semester, _grade);
        emit EnrollmentCompleted(_student, _courseId, _semester);
    }

    function updateStudentGpa(address _student) private {
        StudentAcademicRecord storage record = studentRecords[_student];
        uint256 totalGradePoints;
        uint256 totalCredits;

        for (uint i = 0; i < record.enrolledCourses.length; i++) {
            string memory courseId = record.enrolledCourses[i];
            string[] memory semesters = record.semestersByCourse[courseId];

            for (uint j = 0; j < semesters.length; j++) {
                Enrollment storage enrollment = record.enrollments[courseId][semesters[j]];
                if (enrollment.isCompleted) {
                    (, , uint256 credits, , , ) = courseManagementContract.getCourseStaticDetails(msg.sender, courseId);
                    totalGradePoints += uint256(enrollment.grade) * credits;
                    totalCredits += credits;
                }
            }
        }

        if (totalCredits > 0) {
            record.gpa = (totalGradePoints * 100) / (totalCredits * 100); // Simplified GPA calculation
            record.totalCredits = totalCredits;
            emit GpaUpdated(_student, record.gpa);
        }
    }

    // View Functions
    function getStudentEnrollment(
        address _student,
        string memory _courseId,
        string memory _semester
    )
        external
        view
        returns (
            string memory courseId,
            string memory semester,
            uint8 grade,
            bool isCompleted,
            uint256 enrollmentDate
        )
    {
        Enrollment storage enrollment = studentRecords[_student].enrollments[_courseId][_semester];
        return (
            enrollment.courseId,
            enrollment.semester,
            enrollment.grade,
            enrollment.isCompleted,
            enrollment.enrollmentDate
        );
    }

    function getStudentGpa(address _student) external view returns (uint256) {
        return studentRecords[_student].gpa;
    }

    function getStudentTotalCredits(address _student) external view returns (uint256) {
        return studentRecords[_student].totalCredits;
    }

    function getStudentEnrolledCourses(address _student)
        external
        view
        returns (string[] memory)
    {
        return studentRecords[_student].enrolledCourses;
    }

    function getStudentSemestersForCourse(
        address _student,
        string memory _courseId
    ) external view returns (string[] memory) {
        return studentRecords[_student].semestersByCourse[_courseId];
    }

    function isStudentEnrolled(
        address _student,
        string memory _courseId,
        string memory _semester
    ) external view returns (bool) {
        return courseEnrollments[_courseId][_semester][_student];
    }
}
