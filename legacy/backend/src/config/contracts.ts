import * as fs from 'fs';
import * as path from 'path';

const DEPLOYMENT_FILE = path.resolve(__dirname, '..', '..', '..', 'deployments', 'ganache.json');

interface DeploymentData {
  addresses: {
    Identity: string;
    CourseManagement: string;
    StudentAcademicManager: string;
    Certificates: string;
    ExamManagement: string;
    GraduationManager: string;
  };
  wiring?: {
    Certificates?: { validationContract: string };
  };
}

function loadDeployment(): DeploymentData {
  if (!fs.existsSync(DEPLOYMENT_FILE)) {
    throw new Error(
      `Deployment file not found at ${DEPLOYMENT_FILE}.\n` +
      'Run: npx hardhat run scripts/deploy.js --network ganache'
    );
  }

  const raw = fs.readFileSync(DEPLOYMENT_FILE, 'utf-8');
  const data = JSON.parse(raw) as DeploymentData;

  const required = [
    'Identity',
    'CourseManagement',
    'StudentAcademicManager',
    'Certificates',
    'ExamManagement',
    'GraduationManager',
  ] as const;

  const missing = required.filter((key) => !data.addresses?.[key as keyof typeof data.addresses]);

  if (missing.length > 0) {
    throw new Error(
      `Deployment file ${DEPLOYMENT_FILE} is missing addresses for: ${missing.join(', ')}`
    );
  }

  return data;
}

const deployment = loadDeployment();

export class ContractAddresses {
  static readonly Identity = deployment.addresses.Identity;
  static readonly CourseManagement = deployment.addresses.CourseManagement;
  static readonly StudentAcademicManager = deployment.addresses.StudentAcademicManager;
  static readonly Certificates = deployment.addresses.Certificates;
  static readonly ExamManagement = deployment.addresses.ExamManagement;
  static readonly GraduationManager = deployment.addresses.GraduationManager;
}

export type ContractName = keyof typeof ContractAddresses;

export const ALL_CONTRACTS: ContractName[] = [
  'Identity',
  'CourseManagement',
  'StudentAcademicManager',
  'Certificates',
  'ExamManagement',
  'GraduationManager',
];
