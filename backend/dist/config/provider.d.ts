import { ethers } from 'ethers';
export declare const RPC_URL: string;
export declare const CHAIN_ID: number;
export declare const provider: ethers.JsonRpcProvider;
export declare function loadAbi(contractName: string): any[];
export declare function createContract(abi: any[], address: string, runner?: ethers.Signer | ethers.Provider): ethers.Contract;
//# sourceMappingURL=provider.d.ts.map