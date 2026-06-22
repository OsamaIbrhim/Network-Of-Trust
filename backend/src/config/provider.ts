import { ethers } from 'ethers';
import dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });

export const RPC_URL = process.env.RPC_URL || 'http://127.0.0.1:7545';
export const CHAIN_ID = parseInt(process.env.CHAIN_ID || '1337', 10);

export const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

const ARTIFACTS_ROOT = path.resolve(__dirname, '..', '..', '..', 'artifacts', 'contracts');

export function loadAbi(contractName: string): any[] {
  const artifactPath = path.join(ARTIFACTS_ROOT, `${contractName}.sol`, `${contractName}.json`);
  if (!fs.existsSync(artifactPath)) {
    throw new Error(
      `Artifact not found at ${artifactPath}. Run: npx hardhat compile`
    );
  }
  const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf-8'));
  return artifact.abi;
}

export function createContract(
  abi: any[],
  address: string,
  runner?: ethers.Signer | ethers.Provider
): ethers.Contract {
  if (runner) {
    return new ethers.Contract(address, abi, runner);
  }
  return new ethers.Contract(address, abi, provider);
}
