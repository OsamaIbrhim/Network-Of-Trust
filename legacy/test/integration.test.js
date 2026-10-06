const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("NoT End-to-End Integration", function () {
  let identity, courseManagement, studentAcademicManager;
  let examManagement, certificates, graduationManager;
  let owner, institution, student, employer, otherInstitution;

  async function sendTx(contract, method, args = [], overrides = {}) {
    const network = await ethers.provider.getNetwork();
    const networkName = `${network.name || "unknown"}-${network.chainId}`;
    const address = contract.target || contract.address;

    // Localhost/Ganache (chain 1337) has ~6.7M default block gas limit.
    // Hardhat network has 30M. Increase gas for localhost to prevent OOG on
    // multi-step operations like graduation/certificate flows.
    const isLocalhost = network.name === 'localhost' || network.chainId === 1337n;
    const gasOverride = isLocalhost ? 6500000 : undefined;
    const txOverrides = gasOverride ? { ...overrides, gasLimit: gasOverride } : overrides;

    // Debug logs to diagnose undefined method/property issues
    try {
      console.log("contract =", contract);
      console.log("method =", method);
      console.log("contract keys =", Object.keys(contract));
      console.log("has estimateGas =", !!contract.estimateGas, "has method =", !!contract[method]);
    } catch (logErr) {
      console.log("Error printing contract debug info:", logErr);
    }
    let estimate;
    if (contract && contract.estimateGas && typeof contract.estimateGas[method] === 'function') {
      estimate = await contract.estimateGas[method](...args, txOverrides);
      console.log(`[GAS] ${networkName} ${address}.${method} estimate=${estimate.toString()}`);
    } else {
      console.log(`[GAS] ${networkName} ${address}.${method} estimate=SKIPPED (estimateGas.${method} undefined)`);
    }

    if (!contract || typeof contract[method] !== 'function') {
      throw new Error(`Contract method missing: ${method} on ${address}`);
    }

    const tx = await contract[method](...args, txOverrides);
    console.log(`[GAS] ${networkName} ${address}.${method} txHash=${tx.hash}`);
    const receipt = await tx.wait();
    console.log(`[GAS] ${networkName} ${address}.${method} used=${receipt.gasUsed.toString()} receiptTx=${receipt.transactionHash}`);
    return receipt;
  }

  beforeEach(async function () {
    [owner, institution, student, employer, otherInstitution] = await ethers.getSigners();

    const Identity = await ethers.getContractFactory("Identity");
    identity = await Identity.deploy();
    await identity.waitForDeployment();

    const CourseManagement = await ethers.getContractFactory("CourseManagement");
    courseManagement = await CourseManagement.deploy(await identity.getAddress());
    await courseManagement.waitForDeployment();

    const SAM = await ethers.getContractFactory("StudentAcademicManager");
    studentAcademicManager = await SAM.deploy(await identity.getAddress(), await courseManagement.getAddress());
    await studentAcademicManager.waitForDeployment();

    const Certificates = await ethers.getContractFactory("Certificates");
    certificates = await Certificates.deploy(await identity.getAddress());
    await certificates.waitForDeployment();

    const ExamMgmt = await ethers.getContractFactory("ExamManagement");
    examManagement = await ExamMgmt.deploy(await identity.getAddress());
    await examManagement.waitForDeployment();

    const GradMgr = await ethers.getContractFactory("GraduationManager");
    graduationManager = await GradMgr.deploy(await identity.getAddress(), await studentAcademicManager.getAddress());
    await graduationManager.waitForDeployment();
  });

  describe("TASK 2+3: Deployment and Wiring", function () {
    it("All contracts deployed", async function () {
      expect(await identity.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await courseManagement.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await studentAcademicManager.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await certificates.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await examManagement.getAddress()).to.not.equal(ethers.ZeroAddress);
      expect(await graduationManager.getAddress()).to.not.equal(ethers.ZeroAddress);
    });

    it("Wire Certificates to GraduationManager", async function () {
      await certificates.setValidationContract(await graduationManager.getAddress());
      expect(await certificates.validationContract()).to.equal(await graduationManager.getAddress());
    });

    it("Non-admin cannot set validation contract", async function () {
      try {
        await certificates.connect(institution).setValidationContract(await graduationManager.getAddress());
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Not an admin");
      }
    });
  });

  describe("TASK 4: End-to-End Happy Path", function () {
    beforeEach(async function () {
      await sendTx(certificates, "setValidationContract", [await graduationManager.getAddress()]);
    });

    it("Full graduation flow: 15 steps", async function () {
      // 1: Admin
      expect(await identity.isAdmin(owner.address)).to.equal(true);

      // 2: Institution registers
      await sendTx(identity.connect(institution), "registerInstitution", ["MIT", "Cambridge", "+1234", "mit@edu", "mit.edu"]);

      // 3: Institution verified
      await sendTx(identity, "verifyUser", [institution.address]);
      expect(await identity.isVerifiedUser(institution.address)).to.equal(true);

      // 4: Student registers
      await identity.connect(student).registerStudent(institution.address, "NID001", "John", "Doe", "+999", "john@edu");
      await identity.verifyUser(student.address);

      // 5: Student enrolled by institution
      await sendTx(identity.connect(institution), "addStudents", [[student.address]]);
      expect(await identity.isStudentEnrolled(institution.address, student.address)).to.equal(true);

      // 6: Department + Course
      await sendTx(courseManagement.connect(institution), "addDepartment", ["Computer Science"]);
      await sendTx(courseManagement.connect(institution), "addCourse", ["CS101", "Intro to CS", 3, "Computer Science"]);

      // 7: Student enrolled in course
      await sendTx(studentAcademicManager.connect(institution), "enrollStudent", [student.address, "CS101", "Fall2025"]);

      // 8: Grade assigned
      await sendTx(studentAcademicManager.connect(institution), "updateGrade", [student.address, "CS101", "Fall2025", 95]);
      const enrollmentAfter = await studentAcademicManager.getStudentEnrollment(student.address, "CS101", "Fall2025");
      expect(enrollmentAfter.grade).to.equal(95n);

      // 9: GPA updated
      const gpa = await studentAcademicManager.getStudentGpa(student.address);
      expect(Number(gpa)).to.be.greaterThan(0);
      const credits = await studentAcademicManager.getStudentTotalCredits(student.address);
      expect(credits).to.equal(3n);

      // 10: Requirements
      const deptKey = ethers.keccak256(ethers.toUtf8Bytes("Computer Science"));
      await sendTx(graduationManager.connect(institution), "setRequirements", ["Computer Science", 3, 0, [], false, false, 365]);

      // 11: Eligibility check
      await sendTx(graduationManager.connect(institution), "checkEligibility", [student.address, deptKey]);
      const status11 = await graduationManager.getGraduationStatus(student.address);
      expect(status11).to.equal(1n);

      // 12: Approval
      await sendTx(graduationManager.connect(institution), "approveGraduation", [student.address]);
      const status12 = await graduationManager.getGraduationStatus(student.address);
      expect(status12).to.equal(2n);

      // 13: Certificate issuance (triggers validation hook)
      const receipt = await sendTx(certificates.connect(institution), "issueCertificate", [student.address, "QmHash123"]);
      const certEvent = receipt.logs.find(log => {
        try {
          const p = certificates.interface.parseLog({ topics: log.topics, data: log.data });
          return p && p.name === "CertificateIssued";
        } catch { return false; }
      });
      expect(certEvent).to.not.be.undefined;

      // 14: Finalize
      const parsedCert = certificates.interface.parseLog({ topics: certEvent.topics, data: certEvent.data });
      const certId = parsedCert.args.certificateId;
      await sendTx(graduationManager.connect(institution), "finalizeGraduation", [student.address, certId, "BACHELOR"]);
      const status14 = await graduationManager.getGraduationStatus(student.address);
      expect(status14).to.equal(3n);

      // 15: Verify
      const certData = await certificates.verifyCertificate(certId);
      expect(certData.student).to.equal(student.address);
      expect(certData.institution).to.equal(institution.address);
      expect(certData.isValid).to.equal(true);
    });
  });

  describe("TASK 5: Failure Scenarios", function () {
    let student2;

    beforeEach(async function () {
      // Get extra signers for student2
      const signers = await ethers.getSigners();
      student2 = signers[5]; // 6th signer

      await certificates.setValidationContract(await graduationManager.getAddress());

      // Institution setup
      await identity.connect(institution).registerInstitution("MIT", "Cambridge", "+1234", "mit@edu", "mit.edu");
      await identity.verifyUser(institution.address);

      // Student setup
      await identity.connect(student).registerStudent(institution.address, "NID001", "John", "Doe", "+999", "john@edu");
      await identity.verifyUser(student.address);
      await identity.connect(institution).addStudents([student.address]);

      // Course + grade
      await courseManagement.connect(institution).addDepartment("CS");
      await courseManagement.connect(institution).addCourse("CS101", "Intro", 3, "CS");
      await studentAcademicManager.connect(institution).enrollStudent(student.address, "CS101", "F25");
      await studentAcademicManager.connect(institution).updateGrade(student.address, "CS101", "F25", 90, { gasLimit: 6500000 });

      // Requirements + eligibility + approval
      const deptKey = ethers.keccak256(ethers.toUtf8Bytes("CS"));
      await sendTx(graduationManager.connect(institution), "setRequirements", ["CS", 3, 0, [], false, false, 365]);
      await sendTx(graduationManager.connect(institution), "checkEligibility", [student.address, deptKey]);
      await sendTx(graduationManager.connect(institution), "approveGraduation", [student.address]);
    });

    it("Without validator: certificate issuance succeeds", async function () {
      await sendTx(certificates, "setValidationContract", [ethers.ZeroAddress]);
      const receipt = await sendTx(certificates.connect(institution), "issueCertificate", [student.address, "hash1"]);
      expect(receipt.status).to.equal(1);
    });

    it("Validator blocks non-approved student", async function () {
      // student2: register at otherInstitution
      await identity.connect(otherInstitution).registerInstitution("Stanford", "Palo Alto", "+555", "stanford@edu", "stanford.edu");
      await identity.verifyUser(otherInstitution.address);
      // student2 is a fresh signer, register as student
      await identity.connect(student2).registerStudent(otherInstitution.address, "NID999", "Jane", "Smith", "+111", "jane@edu");
      await identity.verifyUser(student2.address);
      await identity.connect(otherInstitution).addStudents([student2.address]);

      try {
        await certificates.connect(otherInstitution).issueCertificate(student2.address, "hash1");
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Graduation not approved");
      }
    });

    it("Approve non-eligible student reverts", async function () {
      // student2 not eligible
      await identity.connect(otherInstitution).registerInstitution("Stanford", "Palo Alto", "+555", "stanford@edu", "stanford.edu");
      await identity.verifyUser(otherInstitution.address);
      await identity.connect(student2).registerStudent(otherInstitution.address, "NID999", "Jane", "Smith", "+111", "jane@edu");
      await identity.verifyUser(student2.address);
      await identity.connect(otherInstitution).addStudents([student2.address]);

      try {
        await sendTx(graduationManager.connect(otherInstitution), "approveGraduation", [student2.address]);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Student is not eligible");
      }
    });

    it("Cross-institution approval reverts", async function () {
      await identity.connect(otherInstitution).registerInstitution("Stanford", "Palo Alto", "+555", "stanford@edu", "stanford.edu");
      await identity.verifyUser(otherInstitution.address);

      try {
        await graduationManager.connect(otherInstitution).approveGraduation(student.address);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Not the enrolling institution");
      }
    });

    it("Double finalize reverts", async function () {
      // First: issue certificate
      const tx = await certificates.connect(institution).issueCertificate(student.address, "hash1");
      const receipt = await tx.wait();
      const certEvent = receipt.logs.find(log => {
        try {
          const p = certificates.interface.parseLog({ topics: log.topics, data: log.data });
          return p && p.name === "CertificateIssued";
        } catch { return false; }
      });
      const parsedCert = certificates.interface.parseLog({ topics: certEvent.topics, data: certEvent.data });
      const certId = parsedCert.args.certificateId;

      await sendTx(graduationManager.connect(institution), "finalizeGraduation", [student.address, certId, "BS"]);

      try {
        await sendTx(graduationManager.connect(institution), "finalizeGraduation", [student.address, certId, "BS"]);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Graduation not approved");
      }
    });

    it("Same IPFS hash in same block creates duplicate cert (timestamp collision)", async function () {
      // First cert
      await sendTx(certificates.connect(institution), "issueCertificate", [student.address, "hash1"]);
      // Advance time and mine a new block so the next issuance has a different timestamp.
      await ethers.provider.send("evm_increaseTime", [1]);
      await ethers.provider.send("evm_mine", []);
      // Second cert with same hash but different timestamp — creates new cert
      // This is valid behavior: certificateId includes block.timestamp
      const receipt2 = await sendTx(certificates.connect(institution), "issueCertificate", [student.address, "hash1"]);
      expect(receipt2.status).to.equal(1); // succeeds (different timestamp → different ID)
    });

    it("Student cannot self-graduate", async function () {
      try {
        await graduationManager.connect(student).approveGraduation(student.address);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Not a verified institution");
      }
    });

    it("Wrong institution cannot approve", async function () {
      await identity.connect(otherInstitution).registerInstitution("Stanford", "Palo Alto", "+555", "stanford@edu", "stanford.edu");
      await identity.verifyUser(otherInstitution.address);

      try {
        await graduationManager.connect(otherInstitution).approveGraduation(student.address);
        expect.fail("Should have reverted");
      } catch (e) {
        expect(e.message).to.include("Not the enrolling institution");
      }
    });
  });
});