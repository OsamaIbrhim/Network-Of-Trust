"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.courseService = exports.CourseService = void 0;
const provider_1 = require("../config/provider");
const contracts_1 = require("../config/contracts");
const abi = (0, provider_1.loadAbi)('CourseManagement');
class CourseService {
    constructor(runner) {
        this.contract = (0, provider_1.createContract)(abi, contracts_1.ContractAddresses.CourseManagement, runner || provider_1.provider);
    }
    isDepartmentExist(name) {
        return this.contract.isDepartmentExist(name);
    }
    getAllDepartments() {
        return this.contract.getAllDepartments();
    }
    async getCourseStaticDetails(courseId) {
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
    async courseExists(courseId) {
        const details = await this.getCourseStaticDetails(courseId);
        return details.creationDate > 0n;
    }
}
exports.CourseService = CourseService;
exports.courseService = new CourseService();
//# sourceMappingURL=CourseService.js.map