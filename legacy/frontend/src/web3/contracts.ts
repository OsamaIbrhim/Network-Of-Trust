import { Contract, JsonRpcProvider, JsonRpcSigner } from 'ethers';
import identityArtifact from '../../../artifacts/contracts/Identity.sol/Identity.json';
import courseArtifact from '../../../artifacts/contracts/CourseManagement.sol/CourseManagement.json';
import academicArtifact from '../../../artifacts/contracts/StudentAcademicManager.sol/StudentAcademicManager.json';
import graduationArtifact from '../../../artifacts/contracts/GraduationManager.sol/GraduationManager.json';
import certificateArtifact from '../../../artifacts/contracts/Certificates.sol/Certificates.json';
import ganacheDeployment from '../../../deployments/ganache.json';

const identityAbi = identityArtifact.abi;
const courseAbi = courseArtifact.abi;
const academicAbi = academicArtifact.abi;
const graduationAbi = graduationArtifact.abi;
const certificateAbi = certificateArtifact.abi;

interface ContractAddresses {
  Identity: string;
  CourseManagement: string;
  StudentAcademicManager: string;
  Certificates: string;
  ExamManagement: string;
  GraduationManager: string;
}

const addresses: ContractAddresses = ganacheDeployment.addresses;

export function getContractAddresses(): ContractAddresses {
  return addresses;
}

export function loadContractAddresses(): Promise<ContractAddresses> {
  return Promise.resolve(addresses);
}

export function getIdentityContract(signer: JsonRpcSigner): Contract {
  return new Contract(getContractAddresses().Identity, identityAbi, signer);
}

export function getCourseContract(signer: JsonRpcSigner): Contract {
  return new Contract(getContractAddresses().CourseManagement, courseAbi, signer);
}

export function getAcademicContract(signer: JsonRpcSigner): Contract {
  return new Contract(getContractAddresses().StudentAcademicManager, academicAbi, signer);
}

export function getGraduationContract(signer: JsonRpcSigner): Contract {
  return new Contract(getContractAddresses().GraduationManager, graduationAbi, signer);
}

export function getCertificateContract(signer: JsonRpcSigner): Contract {
  return new Contract(getContractAddresses().Certificates, certificateAbi, signer);
}

let readProvider: JsonRpcProvider | null = null;

function getReadProvider(): JsonRpcProvider {
  if (!readProvider) {
    readProvider = new JsonRpcProvider(ganacheDeployment.rpcUrl);
  }
  return readProvider;
}

export function getIdentityContractReadOnly(): Contract {
  return new Contract(getContractAddresses().Identity, identityAbi, getReadProvider());
}

export function getCertificateContractReadOnly(): Contract {
  return new Contract(getContractAddresses().Certificates, certificateAbi, getReadProvider());
}

export function getGraduationContractReadOnly(): Contract {
  return new Contract(getContractAddresses().GraduationManager, graduationAbi, getReadProvider());
}
