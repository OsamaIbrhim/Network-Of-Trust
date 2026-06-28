// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract Identity is Ownable, Pausable {
    using Counters for Counters.Counter;

    enum UserRole {
        NONE,
        STUDENT,
        INSTITUTION,
        EMPLOYER,
        ADMIN
    }

    struct BaseUser {
        address userAddress;
        UserRole role;
        bool isVerified;
    }

    struct Student {
        address userAddress;
        string nationalId;
        string firstName;
        string lastName;
        string phoneNumber;
        string email;
        address institutionAddress;
        string[] enrolledCourses;
        uint8 status;
        bool isVerified;
    }

    struct Institution {
        address userAddress;
        string name;
        string location;
        string phoneNumber;
        string email;
        string website;
        uint8 status;
        bool isVerified;
    }

    struct Employer {
        address userAddress;
        string companyName;
        string location;
        string phoneNumber;
        string email;
        string website;
        bool isVerified;
    }

    mapping(address => BaseUser) public users;
    mapping(address => Student) private students;
    mapping(address => Institution) private institutions;
    mapping(address => Employer) private employers;
    mapping(address => bool) public admins;
    mapping(address => mapping(address => bool)) public institutionStudents;
    
    // Arrays to keep track of addresses by role
    address[] private studentAddresses;
    address[] private institutionAddresses;
    address[] private employerAddresses;

    event UserRegistered(address indexed userAddress, UserRole indexed role);
    event UserVerified(address indexed userAddress);
    event AdminAdded(address indexed admin);
    event AdminRemoved(address indexed admin);
    event UserRoleUpdated(address indexed user, UserRole oldRole, UserRole newRole);

    modifier onlyInstitution() {
        require(users[msg.sender].role == UserRole.INSTITUTION, "Not an institution");
        _;
    }

    modifier onlyVerified() {
        require(users[msg.sender].isVerified, "Not a verified user");
        _;
    }

    modifier onlyAdmin() {
        require(admins[msg.sender] || msg.sender == owner(), "Not an admin");
        _;
    }

    constructor() {
        // Set deployer as admin
        _setupAdmin(msg.sender, "admin@platform.com");
    }

    struct Admin {
        address userAddress;
        string email;
        bool isActive;
        uint256 addedAt;
    }

    mapping(address => Admin) private adminData;
    address[] private adminAddresses;

    function _setupAdmin(address _admin, string memory _email) private {
        require(!admins[_admin], "Already an admin");
        require(_admin != address(0), "Invalid address");
        
        // إعداد المعلومات الأساسية
        users[_admin] = BaseUser(
            _admin,
            UserRole.ADMIN,
            true
        );

        // إضافة بيانات الأدمن
        adminData[_admin] = Admin(
            _admin,
            _email,
            true,
            block.timestamp
        );
        
        admins[_admin] = true;
        adminAddresses.push(_admin);

        emit AdminAdded(_admin);
        emit UserRegistered(_admin, UserRole.ADMIN);
        emit UserVerified(_admin);
    }

    function addAdmin(address _newAdmin, string memory _email) external onlyOwner {
        _setupAdmin(_newAdmin, _email);
    }

    function removeAdmin(address _admin) external onlyOwner {
        require(_admin != owner(), "Cannot remove owner");
        require(admins[_admin], "Not an admin");
        require(_admin != msg.sender, "Cannot remove self");

        // تحديث حالة الأدمن
        admins[_admin] = false;
        adminData[_admin].isActive = false;
        users[_admin].role = UserRole.NONE;
        users[_admin].isVerified = false;

        emit AdminRemoved(_admin);
    }

    function getAdminData(address _admin) external view returns (Admin memory) {
        require(admins[_admin] || _admin == owner(), "Not an admin");
        return adminData[_admin];
    }

    function getAllAdmins() external view onlyAdmin returns (Admin[] memory) {
        Admin[] memory allAdmins = new Admin[](adminAddresses.length);
        
        for (uint i = 0; i < adminAddresses.length; i++) {
            allAdmins[i] = adminData[adminAddresses[i]];
        }
        
        return allAdmins;
    }

    function isAdmin(address _address) public view returns (bool) {
        return admins[_address] || _address == owner();
    }

    function isInstitution(address _address) public view returns (bool) {
        return users[_address].role == UserRole.INSTITUTION && users[_address].isVerified;
    }

    function isVerifiedUser(address _userAddress) external view returns (bool) {
        return users[_userAddress].isVerified;
    }

    function registerStudent(
        address _institutionAddress,
        string memory _nationalId,
        string memory _firstName,
        string memory _lastName,
        string memory _phoneNumber,
        string memory _email
    ) external whenNotPaused {
        require(users[msg.sender].userAddress == address(0), "User already exists");
        
        users[msg.sender] = BaseUser(msg.sender, UserRole.STUDENT, false);
        students[msg.sender] = Student(
            msg.sender,
            _nationalId,
            _firstName,
            _lastName,
            _phoneNumber,
            _email,
            _institutionAddress,
            new string[](0),
            0,
            false
        );
        
        studentAddresses.push(msg.sender);
        emit UserRegistered(msg.sender, UserRole.STUDENT);
    }

    function registerInstitution(
        string memory _name,
        string memory _location,
        string memory _phoneNumber,
        string memory _email,
        string memory _website
    ) external whenNotPaused {
        require(users[msg.sender].userAddress == address(0), "User already exists");
        
        users[msg.sender] = BaseUser(msg.sender, UserRole.INSTITUTION, false);
        institutions[msg.sender] = Institution(
            msg.sender,
            _name,
            _location,
            _phoneNumber,
            _email,
            _website,
            0,
            false
        );
        
        institutionAddresses.push(msg.sender);
        emit UserRegistered(msg.sender, UserRole.INSTITUTION);
    }

    function registerEmployer(
        string memory _companyName,
        string memory _location,
        string memory _phoneNumber,
        string memory _email,
        string memory _website
    ) external whenNotPaused {
        require(users[msg.sender].userAddress == address(0), "User already exists");
        
        users[msg.sender] = BaseUser(msg.sender, UserRole.EMPLOYER, false);
        employers[msg.sender] = Employer(
            msg.sender,
            _companyName,
            _location,
            _phoneNumber,
            _email,
            _website,
            false
        );
        
        employerAddresses.push(msg.sender);
        emit UserRegistered(msg.sender, UserRole.EMPLOYER);
    }

    function verifyUser(address _userAddress) external onlyAdmin {
        require(users[_userAddress].userAddress != address(0), "User does not exist");
        require(!users[_userAddress].isVerified, "User already verified");

        users[_userAddress].isVerified = true;
        
        UserRole role = users[_userAddress].role;
        if (role == UserRole.STUDENT) {
            students[_userAddress].isVerified = true;
        } else if (role == UserRole.INSTITUTION) {
            institutions[_userAddress].isVerified = true;
        } else if (role == UserRole.EMPLOYER) {
            employers[_userAddress].isVerified = true;
        }

        emit UserVerified(_userAddress);
    }

    function addStudents(address[] memory _students) external onlyVerified onlyInstitution {
        for (uint i = 0; i < _students.length; i++) {
            address studentAddress = _students[i];

            require(users[studentAddress].userAddress != address(0), "User does not exist");

            require(users[studentAddress].role == UserRole.STUDENT, "User is not a student");

            if (institutionStudents[msg.sender][studentAddress]) {
                continue;
            }

            institutionStudents[msg.sender][studentAddress] = true;
        }
    }

    function getUserRole(
        address _userAddress
    ) external view returns (UserRole) {
        return users[_userAddress].role;
    }

    function updateUserRole(
        address _userAddress,
        UserRole _newRole
    ) external onlyAdmin {
        require(
            users[_userAddress].userAddress != address(0),
            "User does not exist"
        );
        require(
            _newRole != UserRole.NONE && _newRole != UserRole.ADMIN,
            "Invalid role"
        );

        UserRole oldRole = users[_userAddress].role;
        users[_userAddress].role = _newRole;

        if (_newRole == UserRole.INSTITUTION) {
            // تحديث بيانات المؤسسة التعليمية
            institutions[_userAddress] = Institution(
                _userAddress,
                "", // name
                "", // location
                "", // phoneNumber
                "", // email
                "", // website
                0,  // status
                users[_userAddress].isVerified
            );
        } else if (oldRole == UserRole.INSTITUTION) {
            delete institutions[_userAddress];
        }

        emit UserRoleUpdated(_userAddress, oldRole, _newRole);
    }

    // Emergency functions
    function pause() external onlyAdmin {
        _pause();
    }

    function unpause() external onlyAdmin {
        _unpause();
    }

    function userExists(address _userAddress) external view returns (bool) {
        return users[_userAddress].userAddress != address(0);
    }

    function isStudentEnrolled(address _institution, address _student) external view returns (bool) {
        return institutionStudents[_institution][_student];
    }

    // Student specific functions
    function getStudentData(address _studentAddress) external view returns (Student memory) {
        require(users[_studentAddress].role == UserRole.STUDENT, "Not a student");
        return students[_studentAddress];
    }

    function getInstitutionStudents() external view onlyInstitution onlyVerified returns (Student[] memory) {
        uint count = 0;
        for (uint i = 0; i < studentAddresses.length; i++) {
            address studentAddr = studentAddresses[i];
            if (institutionStudents[msg.sender][studentAddr]) {
                count++;
            }
        }
        
        Student[] memory studentsArray = new Student[](count);
        uint currentIndex = 0;
        
        for (uint i = 0; i < studentAddresses.length; i++) {
            address studentAddr = studentAddresses[i];
            if (institutionStudents[msg.sender][studentAddr]) {
                studentsArray[currentIndex] = students[studentAddr];
                currentIndex++;
            }
        }
        
        return studentsArray;
    }

    // Institution specific functions
    function getInstitutionData(address _institutionAddress) external view returns (Institution memory) {
        require(users[_institutionAddress].role == UserRole.INSTITUTION, "Not an institution");
        return institutions[_institutionAddress];
    }

    function getAllInstitutions() external view onlyAdmin returns (Institution[] memory) {
        Institution[] memory allInstitutions = new Institution[](institutionAddresses.length);
        
        for (uint i = 0; i < institutionAddresses.length; i++) {
            allInstitutions[i] = institutions[institutionAddresses[i]];
        }
        
        return allInstitutions;
    }

    // Employer specific functions
    function getEmployerData(address _employerAddress) external view returns (Employer memory) {
        require(users[_employerAddress].role == UserRole.EMPLOYER, "Not an employer");
        return employers[_employerAddress];
    }

    function getAllEmployers() external view onlyAdmin returns (Employer[] memory) {
        Employer[] memory allEmployers = new Employer[](employerAddresses.length);
        
        for (uint i = 0; i < employerAddresses.length; i++) {
            allEmployers[i] = employers[employerAddresses[i]];
        }
        
        return allEmployers;
    }

    function getInstitutionStudentsByAdmin(address _institutionAddress) external view onlyAdmin returns (Student[] memory) {
        require(users[_institutionAddress].role == UserRole.INSTITUTION, "Not an institution");
        
        uint count = 0;
        for (uint i = 0; i < studentAddresses.length; i++) {
            address studentAddr = studentAddresses[i];
            if (institutionStudents[_institutionAddress][studentAddr]) {
                count++;
            }
        }
        
        Student[] memory studentsArray = new Student[](count);
        uint currentIndex = 0;
        
        for (uint i = 0; i < studentAddresses.length; i++) {
            address studentAddr = studentAddresses[i];
            if (institutionStudents[_institutionAddress][studentAddr]) {
                studentsArray[currentIndex] = students[studentAddr];
                currentIndex++;
            }
        }
        
        return studentsArray;
    }
}