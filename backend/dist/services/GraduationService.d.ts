import { ethers } from 'ethers';
export declare class GraduationService {
    private contract;
    constructor(runner?: ethers.Signer | ethers.Provider);
    getGraduationStatus(studentAddress: string): Promise<number>;
    getGraduationRecord(studentAddress: string): Promise<any>;
}
export declare const graduationService: GraduationService;
//# sourceMappingURL=GraduationService.d.ts.map