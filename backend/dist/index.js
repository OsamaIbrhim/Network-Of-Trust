"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const dotenv_1 = __importDefault(require("dotenv"));
const provider_1 = require("./config/provider");
const contracts_1 = require("./config/contracts");
const admin_1 = __importDefault(require("./routes/admin"));
dotenv_1.default.config();
const app = (0, express_1.default)();
const PORT = parseInt(process.env.PORT || '3000', 10);
// BigInt serialization fix — prevents "Do not know how to serialize a BigInt"
BigInt.prototype.toJSON = function () {
    return this.toString();
};
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Health check
app.get('/health', async (_req, res) => {
    try {
        const network = await provider_1.provider.getNetwork();
        const blockNumber = await provider_1.provider.getBlockNumber();
        const balance = await provider_1.provider.getBalance(contracts_1.ContractAddresses.Identity);
        res.json({
            status: 'ok',
            chainId: Number(network.chainId),
            blockNumber,
            contractsDeployed: {
                Identity: contracts_1.ContractAddresses.Identity,
                CourseManagement: contracts_1.ContractAddresses.CourseManagement,
                StudentAcademicManager: contracts_1.ContractAddresses.StudentAcademicManager,
                Certificates: contracts_1.ContractAddresses.Certificates,
                ExamManagement: contracts_1.ContractAddresses.ExamManagement,
                GraduationManager: contracts_1.ContractAddresses.GraduationManager,
            },
            identityContractBalance: balance.toString(),
        });
    }
    catch (err) {
        res.status(503).json({ status: 'error', message: err.message });
    }
});
// Admin routes
app.use('/api/admin', admin_1.default);
app.listen(PORT, () => {
    console.log(`LMS Backend running on http://localhost:${PORT}`);
    console.log(`Connected to Ganache at ${process.env.RPC_URL || 'http://127.0.0.1:7545'}`);
});
exports.default = app;
//# sourceMappingURL=index.js.map