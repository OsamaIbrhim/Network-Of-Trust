"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.identityService = exports.IdentityService = void 0;
const provider_1 = require("../config/provider");
const contracts_1 = require("../config/contracts");
const abi = (0, provider_1.loadAbi)('Identity');
class IdentityService {
    constructor(runner) {
        this.contract = (0, provider_1.createContract)(abi, contracts_1.ContractAddresses.Identity, runner || provider_1.provider);
    }
    isAdmin(address) {
        return this.contract.isAdmin(address);
    }
    isInstitution(address) {
        return this.contract.isInstitution(address);
    }
    isVerifiedUser(address) {
        return this.contract.isVerifiedUser(address);
    }
    userExists(address) {
        return this.contract.userExists(address);
    }
    getUserRole(address) {
        return this.contract.getUserRole(address);
    }
    getStudentData(address) {
        return this.contract.getStudentData(address);
    }
    getInstitutionData(address) {
        return this.contract.getInstitutionData(address);
    }
    getEmployerData(address) {
        return this.contract.getEmployerData(address);
    }
    getAdminData(address) {
        return this.contract.getAdminData(address);
    }
    getAllInstitutions() {
        return this.contract.getAllInstitutions();
    }
    getAllAdmins() {
        return this.contract.getAllAdmins();
    }
    getAllEmployers() {
        return this.contract.getAllEmployers();
    }
    isStudentEnrolled(institution, student) {
        return this.contract.isStudentEnrolled(institution, student);
    }
}
exports.IdentityService = IdentityService;
exports.identityService = new IdentityService();
//# sourceMappingURL=IdentityService.js.map