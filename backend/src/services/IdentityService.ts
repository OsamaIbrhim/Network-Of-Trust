import { ethers } from 'ethers';
import { provider, loadAbi, createContract } from '../config/provider';
import { ContractAddresses } from '../config/contracts';

const abi = loadAbi('Identity');

export class IdentityService {
  private contract: ethers.Contract;

  constructor(runner?: ethers.Signer | ethers.Provider) {
    this.contract = createContract(abi, ContractAddresses.Identity, runner || provider);
  }

  isAdmin(address: string): Promise<boolean> {
    return this.contract.isAdmin(address);
  }

  isInstitution(address: string): Promise<boolean> {
    return this.contract.isInstitution(address);
  }

  isVerifiedUser(address: string): Promise<boolean> {
    return this.contract.isVerifiedUser(address);
  }

  userExists(address: string): Promise<boolean> {
    return this.contract.userExists(address);
  }

  getUserRole(address: string): Promise<number> {
    return this.contract.getUserRole(address);
  }

  getStudentData(address: string): Promise<any> {
    return this.contract.getStudentData(address);
  }

  getInstitutionData(address: string): Promise<any> {
    return this.contract.getInstitutionData(address);
  }

  getEmployerData(address: string): Promise<any> {
    return this.contract.getEmployerData(address);
  }

  getAdminData(address: string): Promise<any> {
    return this.contract.getAdminData(address);
  }

  getAllInstitutions(): Promise<any[]> {
    return this.contract.getAllInstitutions();
  }

  getAllAdmins(): Promise<any[]> {
    return this.contract.getAllAdmins();
  }

  getAllEmployers(): Promise<any[]> {
    return this.contract.getAllEmployers();
  }

  isStudentEnrolled(institution: string, student: string): Promise<boolean> {
    return this.contract.isStudentEnrolled(institution, student);
  }
}

export const identityService = new IdentityService();