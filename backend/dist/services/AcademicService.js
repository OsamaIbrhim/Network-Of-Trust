"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.academicService = exports.AcademicService = void 0;
const provider_1 = require("../config/provider");
const contracts_1 = require("../config/contracts");
const abi = (0, provider_1.loadAbi)('StudentAcademicManager');
class AcademicService {
    constructor(runner) {
        this.contract = (0, provider_1.createContract)(abi, contracts_1.ContractAddresses.StudentAcademicManager, runner || provider_1.provider);
    }
    getStudentEnrollment(studentAddress, courseId, semester) {
        return this.contract.getStudentEnrollment(studentAddress, courseId, semester);
    }
    getStudentGpa(studentAddress) {
        return this.contract.getStudentGpa(studentAddress);
    }
    getStudentTotalCredits(studentAddress) {
        return this.contract.getStudentTotalCredits(studentAddress);
    }
    getStudentEnrolledCourses(studentAddress) {
        return this.contract.getStudentEnrolledCourses(studentAddress);
    }
}
exports.AcademicService = AcademicService;
exports.academicService = new AcademicService();
//# sourceMappingURL=AcademicService.js.map