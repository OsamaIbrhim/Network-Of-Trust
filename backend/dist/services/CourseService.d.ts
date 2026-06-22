import { ethers } from 'ethers';
export declare class CourseService {
    private contract;
    constructor(runner?: ethers.Signer | ethers.Provider);
    isDepartmentExist(name: string): Promise<boolean>;
    getAllDepartments(): Promise<string[]>;
    getCourseStaticDetails(courseId: string): Promise<{
        courseId: string;
        name: string;
        credits: bigint;
        department: string;
        isActive: boolean;
        creationDate: bigint;
    }>;
    courseExists(courseId: string): Promise<boolean>;
}
export declare const courseService: CourseService;
//# sourceMappingURL=CourseService.d.ts.map