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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createContract = exports.loadAbi = exports.provider = exports.CHAIN_ID = exports.RPC_URL = void 0;
const ethers_1 = require("ethers");
const dotenv_1 = __importDefault(require("dotenv"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
dotenv_1.default.config({ path: path.resolve(__dirname, '..', '..', '.env') });
exports.RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
exports.CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);
exports.provider = new ethers_1.ethers.JsonRpcProvider(exports.RPC_URL, exports.CHAIN_ID);
const ARTIFACTS_ROOT = path.resolve(__dirname, '..', '..', '..', 'artifacts', 'contracts');
function loadAbi(contractName) {
    const artifactPath = path.join(ARTIFACTS_ROOT, `${contractName}.sol`, `${contractName}.json`);
    if (!fs.existsSync(artifactPath)) {
        throw new Error(`Artifact not found at ${artifactPath}. Run: npx hardhat compile`);
    }
    const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
    return artifact.abi;
}
exports.loadAbi = loadAbi;
function createContract(abi, address, runner) {
    if (runner) {
        return new ethers_1.ethers.Contract(address, abi, runner);
    }
    return new ethers_1.ethers.Contract(address, abi, exports.provider);
}
exports.createContract = createContract;
//# sourceMappingURL=provider.js.map