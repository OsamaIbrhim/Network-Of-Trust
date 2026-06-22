import { ethers } from 'ethers';
export declare class IdentityService {
    private contract;
    constructor(runner?: ethers.Signer | ethers.Provider);
    isAdmin(address: string): Promise<boolean>;
    isInstitution(address: string): Promise<boolean>;
    isVerifiedUser(address: string): Promise<boolean>;
    userExists(address: string): Promise<boolean>;
    getUserRole(address: string): Promise<number>;
    getStudentData(address: string): Promise<any>;
    getInstitutionData(address: string): Promise<any>;
    getEmployerData(address: string): Promise<any>;
    getAdminData(address: string): Promise<any>;
    getAllInstitutions(): Promise<any[]>;
    getAllAdmins(): Promise<any[]>;
    getAllEmployers(): Promise<any[]>;
    isStudentEnrolled(institution: string, student: string): Promise<boolean>;
}
export declare const identityService: IdentityService;
//# sourceMappingURL=IdentityService.d.ts.map