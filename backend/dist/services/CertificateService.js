"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.certificateService = exports.CertificateService = void 0;
const provider_1 = require("../config/provider");
const contracts_1 = require("../config/contracts");
const abi = (0, provider_1.loadAbi)('Certificates');
class CertificateService {
    constructor(runner) {
        this.contract = (0, provider_1.createContract)(abi, contracts_1.ContractAddresses.Certificates, runner || provider_1.provider);
    }
    verifyCertificate(certificateId) {
        return this.contract.verifyCertificate(certificateId);
    }
    validationContract() {
        return this.contract.validationContract();
    }
    getUserCertificates(user) {
        return this.contract.getUserCertificates(user);
    }
}
exports.CertificateService = CertificateService;
exports.certificateService = new CertificateService();
//# sourceMappingURL=CertificateService.js.map