/**
 * Sync contract ABIs from Hardhat artifacts into the canonical abis/ directory.
 * Source of truth: artifacts/contracts/<Name>.sol/<Name>.json
 */
const fs = require('fs');
const path = require('path');

const CONTRACTS = [
  'Identity',
  'CourseManagement',
  'StudentAcademicManager',
  'Certificates',
  'ExamManagement',
  'GraduationManager',
];

const ROOT = path.join(__dirname, '..');
const ARTIFACTS_DIR = path.join(ROOT, 'artifacts', 'contracts');
const ABIS_DIR = path.join(ROOT, 'abis');

function syncAbis() {
  fs.mkdirSync(ABIS_DIR, { recursive: true });

  for (const name of CONTRACTS) {
    const artifactPath = path.join(ARTIFACTS_DIR, `${name}.sol`, `${name}.json`);
    if (!fs.existsSync(artifactPath)) {
      throw new Error(
        `Missing artifact: ${artifactPath}\nRun: npx hardhat compile`
      );
    }

    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));
    const outPath = path.join(ABIS_DIR, `${name}.json`);
    fs.writeFileSync(outPath, JSON.stringify(artifact.abi, null, 2));
    console.log(`Synced ABI: ${name} -> abis/${name}.json`);
  }

  console.log(`\nABI sync complete (${CONTRACTS.length} contracts).`);
}

syncAbis();
