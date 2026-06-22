import { ethers } from 'ethers';
export declare class CertificateService {
    private contract;
    constructor(runner?: ethers.Signer | ethers.Provider);
    verifyCertificate(certificateId: string): Promise<any>;
    validationContract(): Promise<string>;
    getUserCertificates(user: string): Promise<any>;
}
export declare const certificateService: CertificateService;
//# sourceMappingURL=CertificateService.d.ts.map