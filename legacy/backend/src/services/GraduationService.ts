import { ethers } from 'ethers';
import { provider, loadAbi, createContract } from '../config/provider';
import { ContractAddresses } from '../config/contracts';

const abi = loadAbi('GraduationManager');

export class GraduationService {
  private contract: ethers.Contract;

  constructor(runner?: ethers.Signer | ethers.Provider) {
    this.contract = createContract(abi, ContractAddresses.GraduationManager, runner || provider);
  }

  getGraduationStatus(studentAddress: string): Promise<number> {
    return this.contract.getGraduationStatus(studentAddress);
  }

  getGraduationRecord(studentAddress: string): Promise<any> {
    return this.contract.getGraduationRecord(studentAddress);
  }
}

export const graduationService = new GraduationService();
