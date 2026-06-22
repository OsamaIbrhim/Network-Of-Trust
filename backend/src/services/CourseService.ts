import { ethers } from 'ethers';
import { provider, loadAbi, createContract } from '../config/provider';
import { ContractAddresses } from '../config/contracts';

const abi = loadAbi('CourseManagement');

export class CourseService {
  private contract: ethers.Contract;

  constructor(runner?: ethers.Signer | ethers.Provider) {
    this.contract = createContract(abi, ContractAddresses.CourseManagement, runner || provider);
  }

  isDepartmentExist(name: string): Promise<boolean> {
    return this.contract.isDepartmentExist(name);
  }

  getAllDepartments(): Promise<string[]> {
    return this.contract.getAllDepartments();
  }

  async getCourseStaticDetails(courseId: string): Promise<{
    courseId: string;
    name: string;
    credits: bigint;
    department: string;
    isActive: boolean;
    creationDate: bigint;
  }> {
    const result = await this.contract.getCourseStaticDetails(courseId);
    return {
      courseId: result.courseId ?? result[0],
      name: result.name ?? result[1],
      credits: result.credits ?? result[2],
      department: result.department ?? result[3],
      isActive: result.isActive ?? result[4],
      creationDate: result.creationDate ?? result[5],
    };
  }

  async courseExists(courseId: string): Promise<boolean> {
    const details = await this.getCourseStaticDetails(courseId);
    return details.creationDate > 0n;
  }
}

export const courseService = new CourseService();
