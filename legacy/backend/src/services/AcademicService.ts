import { ethers } from 'ethers';
import { provider, loadAbi, createContract } from '../config/provider';
import { ContractAddresses } from '../config/contracts';

const abi = loadAbi('StudentAcademicManager');

export class AcademicService {
  private contract: ethers.Contract;

  constructor(runner?: ethers.Signer | ethers.Provider) {
    this.contract = createContract(abi, ContractAddresses.StudentAcademicManager, runner || provider);
  }

  getStudentEnrollment(studentAddress: string, courseId: string, semester: string): Promise<any> {
    return this.contract.getStudentEnrollment(studentAddress, courseId, semester);
  }

  getStudentGpa(studentAddress: string): Promise<bigint> {
    return this.contract.getStudentGpa(studentAddress);
  }

  getStudentTotalCredits(studentAddress: string): Promise<bigint> {
    return this.contract.getStudentTotalCredits(studentAddress);
  }

  getStudentEnrolledCourses(studentAddress: string): Promise<string[]> {
    return this.contract.getStudentEnrolledCourses(studentAddress);
  }
}

export const academicService = new AcademicService();
