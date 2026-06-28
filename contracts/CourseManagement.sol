// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "./Identity.sol";

contract CourseManagement is Ownable, Pausable {
    Identity public identityContract;

    struct Course {
        string courseId;
        string name;
        uint256 credits;
        string department;
        bool isActive;
        uint256 creationDate;
    }

    struct CourseOffering {
        string semester;
        string doctorName;
        uint256 examDate;
        string bookTitle;
        bool isAvailableForEnrollment;
    }

    // ------------------------------------------------------------------
    // Course data — now scoped per institution address
    // ------------------------------------------------------------------
    //
    //   courses[institution][courseId]
    //   courseOfferings[institution][courseId][semester]
    //   courseOfferingTerms[institution][courseId]
    //   departmentCourses[institution][department]
    //
    mapping(address => mapping(string => Course)) public courses;
    mapping(address => mapping(string => mapping(string => CourseOffering))) public courseOfferings;
    mapping(address => mapping(string => string[])) public courseOfferingTerms;
    mapping(address => mapping(string => string[])) public departmentCourses;

    // Semesters and departments are also per-institution
    mapping(address => string) public currentActiveSemester;
    mapping(address => string[]) private departmentNames;
    mapping(address => mapping(string => bool)) private departments;

    // Events — institution address added for traceability
    event CourseAdded(address indexed institution, string indexed courseId, string name, string department);
    event CourseDetailsUpdated(address indexed institution, string indexed courseId, string name, uint256 credits, string department);
    event CourseDeactivated(address indexed institution, string indexed courseId);
    event CourseOfferingAdded(address indexed institution, string indexed courseId, string indexed semester, string doctorName);
    event CourseOfferingUpdated(
        address indexed institution,
        string indexed courseId,
        string indexed semester,
        string doctorName,
        uint256 examDate,
        string bookTitle
    );
    event CurrentActiveSemesterUpdated(address indexed institution, string oldSemester, string newSemester);
    event DepartmentAdded(address indexed institution, string departmentName);

    modifier onlyVerifiedInstitution() {
        require(
            identityContract.isVerifiedUser(msg.sender) &&
            identityContract.getUserRole(msg.sender) == Identity.UserRole.INSTITUTION,
            "Not a verified institution"
        );
        _;
    }

    constructor(address _identityContractAddress) {
        require(_identityContractAddress != address(0), "Invalid identity contract address");
        identityContract = Identity(_identityContractAddress);
    }

    // ------------------------------------------------------------------
    // Write functions — all scoped to msg.sender as institution
    // ------------------------------------------------------------------

    function addDepartment(string memory _departmentName) external onlyVerifiedInstitution {
        require(bytes(_departmentName).length > 0, "Department name cannot be empty");
        require(!departments[msg.sender][_departmentName], "Department already exists");

        departments[msg.sender][_departmentName] = true;
        departmentNames[msg.sender].push(_departmentName);
        emit DepartmentAdded(msg.sender, _departmentName);
    }

    function addCourse(
        string memory _courseId,
        string memory _name,
        uint256 _credits,
        string memory _department
    ) external onlyVerifiedInstitution {
        require(bytes(_courseId).length > 0, "Course ID cannot be empty");
        require(bytes(_name).length > 0, "Course name cannot be empty");
        require(bytes(_department).length > 0, "Department cannot be empty");
        require(courses[msg.sender][_courseId].creationDate == 0, "Course already exists");
        require(departments[msg.sender][_department], "Department does not exist");

        courses[msg.sender][_courseId] = Course({
            courseId: _courseId,
            name: _name,
            credits: _credits,
            department: _department,
            isActive: true,
            creationDate: block.timestamp
        });

        departmentCourses[msg.sender][_department].push(_courseId);
        emit CourseAdded(msg.sender, _courseId, _name, _department);
    }

    function updateCourseStaticDetails(
        string memory _courseId,
        string memory _newName,
        uint256 _newCredits,
        string memory _newDepartment
    ) external onlyVerifiedInstitution {
        require(courses[msg.sender][_courseId].creationDate > 0, "Course does not exist");
        require(bytes(_newName).length > 0, "Course name cannot be empty");
        require(departments[msg.sender][_newDepartment], "Department does not exist");

        Course storage course = courses[msg.sender][_courseId];
        course.name = _newName;
        course.credits = _newCredits;
        course.department = _newDepartment;

        emit CourseDetailsUpdated(msg.sender, _courseId, _newName, _newCredits, _newDepartment);
    }

    function deactivateCourse(string memory _courseId) external onlyVerifiedInstitution {
        require(courses[msg.sender][_courseId].creationDate > 0, "Course does not exist");
        require(courses[msg.sender][_courseId].isActive, "Course is already inactive");

        courses[msg.sender][_courseId].isActive = false;
        emit CourseDeactivated(msg.sender, _courseId);
    }

    function setCurrentActiveSemester(string memory _semester) external onlyVerifiedInstitution {
        require(bytes(_semester).length > 0, "Semester cannot be empty");
        string memory oldSemester = currentActiveSemester[msg.sender];
        currentActiveSemester[msg.sender] = _semester;
        emit CurrentActiveSemesterUpdated(msg.sender, oldSemester, _semester);
    }

    function addCourseOffering(
        string memory _courseId,
        string memory _semester,
        string memory _doctorName,
        uint256 _examDate,
        string memory _bookTitle
    ) external onlyVerifiedInstitution {
        require(courses[msg.sender][_courseId].creationDate > 0, "Course does not exist");
        require(courses[msg.sender][_courseId].isActive, "Course is inactive");
        require(bytes(_semester).length > 0, "Semester cannot be empty");
        require(bytes(_doctorName).length > 0, "Doctor name cannot be empty");
        require(
            keccak256(abi.encodePacked(courseOfferings[msg.sender][_courseId][_semester].semester)) == keccak256(abi.encodePacked("")),
            "Course offering already exists for this semester"
        );

        courseOfferings[msg.sender][_courseId][_semester] = CourseOffering({
            semester: _semester,
            doctorName: _doctorName,
            examDate: _examDate,
            bookTitle: _bookTitle,
            isAvailableForEnrollment: true
        });

        // Check if semester exists in terms array
        bool semesterExists = false;
        string[] storage terms = courseOfferingTerms[msg.sender][_courseId];
        for (uint i = 0; i < terms.length; i++) {
            if (keccak256(abi.encodePacked(terms[i])) == keccak256(abi.encodePacked(_semester))) {
                semesterExists = true;
                break;
            }
        }
        if (!semesterExists) {
            terms.push(_semester);
        }

        emit CourseOfferingAdded(msg.sender, _courseId, _semester, _doctorName);
    }

    // ------------------------------------------------------------------
    // View functions — institution address is an explicit parameter
    // ------------------------------------------------------------------

    function isDepartmentExist(address _institution, string memory _departmentName) public view returns (bool) {
        return departments[_institution][_departmentName];
    }

    function getAllDepartments(address _institution) external view returns (string[] memory) {
        return departmentNames[_institution];
    }

    /**
     * @notice Returns static details for a course owned by the given institution.
     * @param _institution  The institution that created the course.
     * @param _courseId     The course identifier string.
     */
    function getCourseStaticDetails(address _institution, string memory _courseId)
        external
        view
        returns (
            string memory courseId,
            string memory name,
            uint256 credits,
            string memory department,
            bool isActive,
            uint256 creationDate
        )
    {
        Course memory course = courses[_institution][_courseId];
        return (
            course.courseId,
            course.name,
            course.credits,
            course.department,
            course.isActive,
            course.creationDate
        );
    }

    function getCourseOfferingDetails(address _institution, string memory _courseId, string memory _semester)
        external
        view
        returns (
            string memory semester,
            string memory doctorName,
            uint256 examDate,
            string memory bookTitle,
            bool isAvailableForEnrollment
        )
    {
        CourseOffering memory offering = courseOfferings[_institution][_courseId][_semester];
        return (
            offering.semester,
            offering.doctorName,
            offering.examDate,
            offering.bookTitle,
            offering.isAvailableForEnrollment
        );
    }

    function getLatestCourseOfferingDetails(address _institution, string memory _courseId)
        external
        view
        returns (
            string memory semester,
            string memory doctorName,
            uint256 examDate,
            string memory bookTitle,
            bool isAvailableForEnrollment
        )
    {
        CourseOffering memory offering = courseOfferings[_institution][_courseId][currentActiveSemester[_institution]];
        return (
            offering.semester,
            offering.doctorName,
            offering.examDate,
            offering.bookTitle,
            offering.isAvailableForEnrollment
        );
    }

    function getAllCourseOfferingsForCourse(address _institution, string memory _courseId)
        external
        view
        returns (CourseOffering[] memory)
    {
        string[] memory terms = courseOfferingTerms[_institution][_courseId];
        CourseOffering[] memory allOfferings = new CourseOffering[](terms.length);

        for (uint i = 0; i < terms.length; i++) {
            allOfferings[i] = courseOfferings[_institution][_courseId][terms[i]];
        }

        return allOfferings;
    }

    function getCoursesByDepartment(address _institution, string memory _departmentName)
        external
        view
        returns (Course[] memory)
    {
        string[] memory deptCourses = departmentCourses[_institution][_departmentName];
        Course[] memory result = new Course[](deptCourses.length);

        for (uint i = 0; i < deptCourses.length; i++) {
            result[i] = courses[_institution][deptCourses[i]];
        }

        return result;
    }
}
