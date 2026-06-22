import { ethers } from 'ethers';
import { provider, loadAbi, createContract } from '../config/provider';
import { ContractAddresses } from '../config/contracts';

const abi = loadAbi('Certificates');

export class CertificateService {
  private contract: ethers.Contract;

  constructor(runner?: ethers.Signer | ethers.Provider) {
    this.contract = createContract(abi, ContractAddresses.Certificates, runner || provider);
  }

  verifyCertificate(certificateId: string): Promise<any> {
    return this.contract.verifyCertificate(certificateId);
  }

  validationContract(): Promise<string> {
    return this.contract.validationContract();
  }

  getUserCertificates(user: string): Promise<any> {
    return this.contract.getUserCertificates(user);
  }
}

export const certificateService = new CertificateService();
