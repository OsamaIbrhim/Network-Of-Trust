"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ALL_CONTRACTS = exports.ContractAddresses = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const DEPLOYMENT_FILE = path.resolve(__dirname, '..', '..', '..', 'deployments', 'ganache.json');
function loadDeployment() {
    if (!fs.existsSync(DEPLOYMENT_FILE)) {
        throw new Error(`Deployment file not found at ${DEPLOYMENT_FILE}.\n` +
            'Run: npx hardhat run scripts/deploy.js --network ganache');
    }
    const raw = fs.readFileSync(DEPLOYMENT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    const required = [
        'Identity',
        'CourseManagement',
        'StudentAcademicManager',
        'Certificates',
        'ExamManagement',
        'GraduationManager',
    ];
    const missing = required.filter((key) => !data.addresses?.[key]);
    if (missing.length > 0) {
        throw new Error(`Deployment file ${DEPLOYMENT_FILE} is missing addresses for: ${missing.join(', ')}`);
    }
    return data;
}
const deployment = loadDeployment();
class ContractAddresses {
}
exports.ContractAddresses = ContractAddresses;
ContractAddresses.Identity = deployment.addresses.Identity;
ContractAddresses.CourseManagement = deployment.addresses.CourseManagement;
ContractAddresses.StudentAcademicManager = deployment.addresses.StudentAcademicManager;
ContractAddresses.Certificates = deployment.addresses.Certificates;
ContractAddresses.ExamManagement = deployment.addresses.ExamManagement;
ContractAddresses.GraduationManager = deployment.addresses.GraduationManager;
exports.ALL_CONTRACTS = [
    'Identity',
    'CourseManagement',
    'StudentAcademicManager',
    'Certificates',
    'ExamManagement',
    'GraduationManager',
];
//# sourceMappingURL=contracts.js.map