import { ethers } from 'ethers';
export declare class AcademicService {
    private contract;
    constructor(runner?: ethers.Signer | ethers.Provider);
    getStudentEnrollment(studentAddress: string, courseId: string, semester: string): Promise<any>;
    getStudentGpa(studentAddress: string): Promise<bigint>;
    getStudentTotalCredits(studentAddress: string): Promise<bigint>;
    getStudentEnrolledCourses(studentAddress: string): Promise<string[]>;
}
export declare const academicService: AcademicService;
//# sourceMappingURL=AcademicService.d.ts.map