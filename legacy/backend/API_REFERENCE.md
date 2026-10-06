# LMS Backend API Reference

## Base URL

```
http://localhost:3000
```

## Network

- **Blockchain**: Ganache (local)
- **RPC**: http://127.0.0.1:7545
- **Chain ID**: 1337
- **Currency**: ETH (test, no real value)

## Authentication

All admin endpoints assume the caller is an admin wallet connected via MetaMask. The backend currently reads from the blockchain using the default signer from the Ganache provider. In production, MetaMask would sign each transaction, and gas costs are handled by MetaMask.

## General Error Response Format

All endpoints return HTTP 500 with the following shape on failure:

```json
{
  "error": "Revert reason or error message from the smart contract"
}
```

Common revert reasons:
- `Not an admin`
- `User already exists`
- `Not a verified institution`
- `Course does not exist`
- `Student is not eligible`

---

# A. Identity APIs

Contract: **Identity.sol**

---

### GET /api/admin/identity/isAdmin/:address

Check if an address has admin role.

**Contract function:** `Identity.isAdmin(address) -> bool`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Ethereum address to check |

**Success response:**
```json
{
  "address": "0x96036cFB5CCb4A8052aF45116151140d3EBE2b8b",
  "isAdmin": true
}
```

---

### GET /api/admin/identity/isInstitution/:address

Check if an address is registered as an institution.

**Contract function:** `Identity.isInstitution(address) -> bool`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Ethereum address to check |

**Success response:**
```json
{
  "address": "0x...",
  "isInstitution": true
}
```

---

### GET /api/admin/identity/userExists/:address

Check if a user is registered in the system.

**Contract function:** `Identity.userExists(address) -> bool`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Ethereum address to check |

**Success response:**
```json
{
  "address": "0x...",
  "exists": true
}
```

---

### GET /api/admin/identity/getUserRole/:address

Get the role of a user (0 = None, 1 = Admin, 2 = Institution, 3 = Student, 4 = Employer).

**Contract function:** `Identity.getUserRole(address) -> uint8`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Ethereum address |

**Success response:**
```json
{
  "address": "0x...",
  "role": 2
}
```

---

### GET /api/admin/identity/getStudentData/:address

Get full student profile data.

**Contract function:** `Identity.getStudentData(address) -> Student struct`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Student Ethereum address |

**Success response:**
```json
{
  "userAddress": "0x...",
  "nationalId": "NID001",
  "firstName": "John",
  "lastName": "Doe",
  "phoneNumber": "+999",
  "email": "john@edu",
  "institutionAddress": "0x...",
  "enrolledCourses": ["CS101"],
  "status": 0,
  "isVerified": true
}
```

---

### GET /api/admin/identity/getInstitutionData/:address

Get full institution profile data.

**Contract function:** `Identity.getInstitutionData(address) -> Institution struct`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| address | string | Institution Ethereum address |

**Success response:**
```json
{
  "userAddress": "0x...",
  "name": "MIT",
  "location": "Cambridge",
  "phoneNumber": "+1234",
  "email": "mit@edu",
  "website": "mit.edu",
  "status": 0,
  "isVerified": true
}
```

---

### GET /api/admin/identity/getAllInstitutions

Get a list of all registered institutions.

**Contract function:** `Identity.getAllInstitutions() -> Institution[]`

**Path params:** None

**Success response:**
```json
[
  {
    "userAddress": "0x...",
    "name": "MIT",
    "location": "Cambridge",
    "phoneNumber": "+1234",
    "email": "mit@edu",
    "website": "mit.edu",
    "status": 0,
    "isVerified": true
  }
]
```

---

### GET /api/admin/identity/getAllAdmins

Get a list of all admin users.

**Contract function:** `Identity.getAllAdmins() -> Admin[]`

**Path params:** None

**Success response:**
```json
[
  {
    "userAddress": "0x...",
    "email": "admin@lms.com",
    "isActive": true,
    "addedAt": "1700000000"
  }
]
```

---

### POST /api/admin/identity/addAdmin

Add a new admin user.

**Contract function:** `Identity.addAdmin(address, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| adminAddress | string | Ethereum address of new admin |
| email | string | Email of the new admin |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/identity/removeAdmin

Remove an existing admin.

**Contract function:** `Identity.removeAdmin(address)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| adminAddress | string | Ethereum address of admin to remove |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/identity/registerInstitution

Register a new institution.

**Contract function:** `Identity.registerInstitution(string, string, string, string, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| name | string | Institution name |
| location | string | Physical location |
| phone | string | Phone number |
| email | string | Contact email |
| website | string | Website URL |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/identity/registerStudent

Register a new student under an institution.

**Contract function:** `Identity.registerStudent(address, string, string, string, string, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| institutionAddress | string | Ethereum address of the enrolling institution |
| nationalId | string | National ID number |
| firstName | string | Student first name |
| lastName | string | Student last name |
| phone | string | Phone number |
| email | string | Email address |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/identity/verifyUser

Approve a user's registration (admin/owner only). Required before the user can perform any actions.

**Contract function:** `Identity.verifyUser(address)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| userAddress | string | Ethereum address of the user to verify |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/identity/addStudents

Bulk-add students to an institution's roster.

**Contract function:** `Identity.addStudents(address[])`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddresses | string[] | Array of student Ethereum addresses |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

# B. Course Management APIs

Contract: **CourseManagement.sol**

---

### POST /api/admin/course/addDepartment

Create a new academic department.

**Contract function:** `CourseManagement.addDepartment(string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| name | string | Department name |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/course/addCourse

Create a new course under a department.

**Contract function:** `CourseManagement.addCourse(string, string, uint256, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| courseId | string | Course code (e.g. CS101) |
| name | string | Course name |
| credits | number | Credit hours |
| department | string | Department name |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/course/updateCourse

Update an existing course's metadata.

**Contract function:** `CourseManagement.updateCourse(string, string, uint256, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| courseId | string | Course code |
| name | string | New course name |
| credits | number | New credit hours |
| description | string | Course description |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/course/toggleCourseActive

Activate or deactivate a course.

**Contract function:** `CourseManagement.toggleCourseActive(string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| courseId | string | Course code |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### GET /api/admin/course/courseExists/:courseId

Check if a course exists.

**Contract function:** `CourseManagement.courseExists(string) -> bool`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| courseId | string | Course code |

**Success response:**
```json
{
  "courseId": "CS101",
  "exists": true
}
```

---

### GET /api/admin/course/getCourseData/:courseId

Get full course information.

**Contract function:** `CourseManagement.getCourseData(string) -> Course struct`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| courseId | string | Course code |

**Success response:**
```json
{
  "courseId": "CS101",
  "name": "Intro to CS",
  "credits": 3,
  "department": "Computer Science",
  "isActive": true
}
```

---

### GET /api/admin/course/getDepartmentData/:name

Get department information including all its courses.

**Contract function:** `CourseManagement.getDepartmentData(string) -> Department struct`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| name | string | Department name |

**Success response:**
```json
{
  "name": "Computer Science",
  "courseCount": 5,
  "isActive": true
}
```

---

# C. Academic APIs

Contract: **StudentAcademicManager.sol**

---

### POST /api/admin/academic/enrollStudent

Enroll a student in a course for a specific semester.

**Contract function:** `StudentAcademicManager.enrollStudent(address, string, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Ethereum address of the student |
| courseId | string | Course code |
| semester | string | Semester identifier (e.g. Fall2025) |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/academic/updateGrade

Assign a grade to a student for a course enrollment.

**Contract function:** `StudentAcademicManager.updateGrade(address, string, string, uint256)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Ethereum address of the student |
| courseId | string | Course code |
| semester | string | Semester identifier |
| grade | number | Grade value (0-100) |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### GET /api/admin/academic/getStudentEnrollment/:studentAddress/:courseId/:semester

Get enrollment details for a specific student/course/semester combination.

**Contract function:** `StudentAcademicManager.getStudentEnrollment(address, string, string) -> Enrollment struct`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |
| courseId | string | Course code |
| semester | string | Semester identifier |

**Success response:**
```json
{
  "student": "0x...",
  "courseId": "CS101",
  "semester": "Fall2025",
  "grade": 95,
  "isActive": true
}
```

---

### GET /api/admin/academic/getStudentGpa/:studentAddress

Get the calculated GPA for a student across all completed enrollments.

**Contract function:** `StudentAcademicManager.getStudentGpa(address) -> uint256`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |

**Success response:**
```json
{
  "studentAddress": "0x...",
  "gpa": "9500"
}
```

Note: GPA is returned as a string (bigint) representing the scaled value.

---

### GET /api/admin/academic/getStudentTotalCredits/:studentAddress

Get the total accumulated credit hours for a student.

**Contract function:** `StudentAcademicManager.getStudentTotalCredits(address) -> uint256`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |

**Success response:**
```json
{
  "studentAddress": "0x...",
  "totalCredits": "3"
}
```

---

# D. Graduation APIs

Contract: **GraduationManager.sol**

---

### POST /api/admin/graduation/setRequirements

Define graduation requirements for a department.

**Contract function:** `GraduationManager.setRequirements(string, uint256, uint256, string[], bool, bool, uint256)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| departmentName | string | Department name |
| minCredits | number | Minimum credit hours required |
| minGpa | number | Minimum GPA required |
| requiredCourses | string[] | List of required course IDs |
| thesisRequired | boolean | Whether thesis is mandatory |
| internshipRequired | boolean | Whether internship is mandatory |
| validityDays | number | Certificate validity period in days |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/graduation/checkEligibility

Check if a student meets the graduation requirements for a department.

**Contract function:** `GraduationManager.checkEligibility(address, bytes32)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |
| departmentKey | string | keccak256 hash of the department name |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

Note: The departmentKey is computed as `ethers.keccak256(ethers.toUtf8Bytes("DepartmentName"))`. On success, the student's graduation status is updated to ELIGIBLE.

---

### POST /api/admin/graduation/approveGraduation

Approve an eligible student for graduation. Sets status to APPROVED.

**Contract function:** `GraduationManager.approveGraduation(address)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### POST /api/admin/graduation/finalizeGraduation

Finalize the graduation process. Sets status to GRADUATED and records the certificate.

**Contract function:** `GraduationManager.finalizeGraduation(address, bytes32, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |
| certificateId | string | Certificate identifier (bytes32) |
| degreeType | string | Degree type (e.g. BACHELOR, MASTER) |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

Note: `certificateId` is obtained from the CertificateIssued event after calling issueCertificate.

---

### GET /api/admin/graduation/getGraduationStatus/:studentAddress

Get the current graduation status of a student.

**Contract function:** `GraduationManager.getGraduationStatus(address) -> uint8`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |

**Status values:**
| Value | Meaning |
|-------|---------|
| 0 | NONE |
| 1 | ELIGIBLE |
| 2 | APPROVED |
| 3 | GRADUATED |

**Success response:**
```json
{
  "studentAddress": "0x...",
  "status": 2
}
```

---

# E. Certificate APIs

Contract: **Certificates.sol**

---

### POST /api/admin/certificate/issueCertificate

Issue a certificate to a student with an IPFS hash. Triggers the validation hook.

**Contract function:** `Certificates.issueCertificate(address, string)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| studentAddress | string | Student Ethereum address |
| ipfsHash | string | IPFS content hash of the certificate document |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

Note: The validation contract (GraduationManager) is called during issuance. If the student has not been approved for graduation, the transaction reverts with "Graduation not approved".

---

### GET /api/admin/certificate/verifyCertificate/:certificateId

Verify a certificate by its ID. Returns full certificate data.

**Contract function:** `Certificates.verifyCertificate(bytes32) -> Certificate struct`

**Path params:**
| Name | Type | Description |
|------|------|-------------|
| certificateId | string | Certificate identifier (bytes32 hex string) |

**Success response:**
```json
{
  "student": "0x...",
  "institution": "0x...",
  "ipfsHash": "QmHash123",
  "issuedAt": 1700000000,
  "isValid": true
}
```

---

### POST /api/admin/certificate/revokeCertificate

Revoke a previously issued certificate.

**Contract function:** `Certificates.revokeCertificate(bytes32)`

**Request body:**
| Name | Type | Description |
|------|------|-------------|
| certificateId | string | Certificate identifier (bytes32) |

**Success response:**
```json
{
  "txHash": "0x..."
}
```

---

### GET /api/admin/certificate/getCertificateCount

Get the total number of certificates issued.

**Contract function:** `Certificates.getCertificateCount() -> uint256`

**Path params:** None

**Success response:**
```json
{
  "count": "42"
}
```

---

# F. Health Check

---

### GET /health

Check if the backend is running and connected to Ganache.

**Path params:** None

**Success response:**
```json
{
  "status": "ok",
  "chainId": 1337,
  "blockNumber": 849,
  "contractsDeployed": {
    "Identity": "0x...",
    "CourseManagement": "0x...",
    "StudentAcademicManager": "0x...",
    "Certificates": "0x...",
    "ExamManagement": "0x...",
    "GraduationManager": "0x..."
  },
  "identityContractBalance": "0"
}
```

**Error response** (Ganache not running):
```json
{
  "status": "error",
  "message": "connect ECONNREFUSED 127.0.0.1:7545"
}
```

---

# System Flow Summary

The LMS backend follows a layered architecture:

```
Frontend (Admin Dashboard)
       |
       | HTTP (JSON)
       v
Express REST API (routes/admin.ts)
       |
       | Calls service methods
       v
Service Layer (services/*.ts)
       |
       | Uses Ethers.js contract instance
       v
Ethers.js (config/provider.ts)
       |
       | JSON-RPC
       v
Ganache (localhost:7545)
       |
       | EVM execution
       v
Smart Contracts (Solidity)
  - Identity.sol
  - CourseManagement.sol
  - StudentAcademicManager.sol
  - Certificates.sol
  - ExamManagement.sol
  - GraduationManager.sol
```

## Flow steps:

1. **Frontend** sends an HTTP request to one of the `/api/admin/**` endpoints.
2. **Express route** validates input and calls the corresponding service method.
3. **Service** creates an Ethers.js contract instance using the ABI and contract address from `deployments/ganache.json`.
4. **Ethers.js** encodes the function call and sends a JSON-RPC transaction to Ganache.
5. **Ganache** executes the transaction against the deployed smart contract.
6. **Smart contract** performs the business logic (e.g. register student, check eligibility).
7. **Result** (transaction receipt or revert error) is returned through the chain back to the frontend.

## Address auto-loading:

Contract addresses are NOT hardcoded or manually maintained. They are loaded automatically from `deployments/ganache.json`, which is generated by `npx hardhat run scripts/deploy.js --network ganache`. After redeployment, simply restart the backend to pick up the new addresses. No `.env` changes needed.

## Environment variables (`.env`):

```
RPC_URL=http://127.0.0.1:7545
CHAIN_ID=1337
PORT=3000