// ============================================================
// LMS FULL SYSTEM DEPLOYMENT SCRIPT
// Deploys all contracts to Ganache and wires dependencies.
// ============================================================

const fs = require('fs');
const path = require('path');

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`\nDeploying with account: ${deployer.address}`);
  console.log(`Balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))} ETH\n`);

  const deployed = {};
  const addresses = {};

  // ----- 1. Deploy Identity -----
  console.log('1/6 Deploying Identity...');
  const Identity = await ethers.getContractFactory("Identity");
  const identity = await Identity.deploy();
  await identity.waitForDeployment();
  deployed.identity = identity;
  addresses.Identity = await identity.getAddress();
  console.log(`   Identity: ${addresses.Identity}`);

  // ----- 2. Deploy CourseManagement -----
  console.log('2/6 Deploying CourseManagement...');
  const CourseManagement = await ethers.getContractFactory("CourseManagement");
  const courseManagement = await CourseManagement.deploy(addresses.Identity);
  await courseManagement.waitForDeployment();
  deployed.courseManagement = courseManagement;
  addresses.CourseManagement = await courseManagement.getAddress();
  console.log(`   CourseManagement: ${addresses.CourseManagement}`);

  // ----- 3. Deploy StudentAcademicManager -----
  console.log('3/6 Deploying StudentAcademicManager...');
  const SAM = await ethers.getContractFactory("StudentAcademicManager");
  const sam = await SAM.deploy(addresses.Identity, addresses.CourseManagement);
  await sam.waitForDeployment();
  deployed.sam = sam;
  addresses.StudentAcademicManager = await sam.getAddress();
  console.log(`   StudentAcademicManager: ${addresses.StudentAcademicManager}`);

  // ----- 4. Deploy Certificates -----
  console.log('4/6 Deploying Certificates...');
  const Certificates = await ethers.getContractFactory("Certificates");
  const certificates = await Certificates.deploy(addresses.Identity);
  await certificates.waitForDeployment();
  deployed.certificates = certificates;
  addresses.Certificates = await certificates.getAddress();
  console.log(`   Certificates: ${addresses.Certificates}`);

  // ----- 5. Deploy ExamManagement -----
  console.log('5/6 Deploying ExamManagement...');
  const ExamMgmt = await ethers.getContractFactory("ExamManagement");
  const examMgmt = await ExamMgmt.deploy(addresses.Identity);
  await examMgmt.waitForDeployment();
  deployed.examMgmt = examMgmt;
  addresses.ExamManagement = await examMgmt.getAddress();
  console.log(`   ExamManagement: ${addresses.ExamManagement}`);

  // ----- 6. Deploy GraduationManager -----
  console.log('6/6 Deploying GraduationManager...');
  const GradMgr = await ethers.getContractFactory("GraduationManager");
  const gradMgr = await GradMgr.deploy(addresses.Identity, addresses.StudentAcademicManager);
  await gradMgr.waitForDeployment();
  deployed.gradMgr = gradMgr;
  addresses.GraduationManager = await gradMgr.getAddress();
  console.log(`   GraduationManager: ${addresses.GraduationManager}`);

  // ====== WIRING ======
  console.log('\n--- WIRING DEPENDENCIES ---');

  // Wire Certificates → GraduationManager validator
  console.log('Wiring Certificates.setValidationContract(GraduationManager)...');
  const tx = await certificates.setValidationContract(addresses.GraduationManager);
  await tx.wait();
  console.log(`   Certificates.validationContract: ${await certificates.validationContract()}`);

  // ====== POST-DEPLOYMENT VERIFICATION ======
  console.log('\n--- POST-DEPLOYMENT VERIFICATION ---');

  // Verify Identity
  const isOwnerAdmin = await identity.isAdmin(deployer.address);
  console.log(`Owner is admin: ${isOwnerAdmin}`);

  // Verify Certificates validator
  const validatorAddr = await certificates.validationContract();
  console.log(`Certificate validator: ${validatorAddr}`);
  console.log(`Validator matches GraduationManager: ${validatorAddr === addresses.GraduationManager}`);

  // ====== SAVE DEPLOYMENT ======
  const deploymentFile = path.join(__dirname, '..', 'deployments', 'ganache.json');
  const deploymentSummary = {
    network: 'ganache',
    chainId: 1337,
    rpcUrl: 'http://127.0.0.1:7545',
    deployer: deployer.address,
    deployedAt: new Date().toISOString(),
    addresses,
    wiring: {
      Certificates: {
        validationContract: addresses.GraduationManager
      }
    }
  };
  fs.mkdirSync(path.dirname(deploymentFile), { recursive: true });
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentSummary, null, 2));

  console.log('\n--- DEPLOYMENT COMPLETE ---');
  console.log(JSON.stringify(addresses, null, 2));
  console.log(`\nDeployment saved to: ${deploymentFile}`);

  // Sync ABIs from artifacts to canonical abis/ directory
  console.log('\n--- SYNCING ABIS ---');
  require('./sync-abis.js');
}

main().then(() => process.exit(0)).catch((error) => {
  console.error(error);
  process.exit(1);
});