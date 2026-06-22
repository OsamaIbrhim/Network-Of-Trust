"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.graduationService = exports.GraduationService = void 0;
const provider_1 = require("../config/provider");
const contracts_1 = require("../config/contracts");
const abi = (0, provider_1.loadAbi)('GraduationManager');
class GraduationService {
    constructor(runner) {
        this.contract = (0, provider_1.createContract)(abi, contracts_1.ContractAddresses.GraduationManager, runner || provider_1.provider);
    }
    getGraduationStatus(studentAddress) {
        return this.contract.getGraduationStatus(studentAddress);
    }
    getGraduationRecord(studentAddress) {
        return this.contract.getGraduationRecord(studentAddress);
    }
}
exports.GraduationService = GraduationService;
exports.graduationService = new GraduationService();
//# sourceMappingURL=GraduationService.js.map