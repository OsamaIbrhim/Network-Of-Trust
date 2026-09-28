import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { provider } from './config/provider';
import { ContractAddresses } from './config/contracts';
import adminRouter from './routes/admin';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// BigInt serialization fix — prevents "Do not know how to serialize a BigInt"
(BigInt.prototype as any).toJSON = function () {
  return this.toString();
};

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', async (_req, res) => {
  try {
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();
    const balance = await provider.getBalance(ContractAddresses.Identity);
    res.json({
      status: 'ok',
      chainId: Number(network.chainId),
      blockNumber,
      contractsDeployed: {
        Identity: ContractAddresses.Identity,
        CourseManagement: ContractAddresses.CourseManagement,
        StudentAcademicManager: ContractAddresses.StudentAcademicManager,
        Certificates: ContractAddresses.Certificates,
        ExamManagement: ContractAddresses.ExamManagement,
        GraduationManager: ContractAddresses.GraduationManager,
      },
      identityContractBalance: balance.toString(),
    });
  } catch (err: any) {
    res.status(503).json({ status: 'error', message: err.message });
  }
});

// Admin routes
app.use('/api/admin', adminRouter);

app.listen(PORT, () => {
  console.log(`LMS Backend running on http://localhost:${PORT}`);
  console.log(`Connected to Ganache at ${process.env.RPC_URL || 'http://127.0.0.1:7545'}`);
});

export default app;