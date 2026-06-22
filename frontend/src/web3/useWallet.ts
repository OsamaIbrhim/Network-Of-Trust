import { useState, useCallback } from 'react';
import { useMetaMask } from '../hooks/useMetaMask';
import { getSigner, requestAccounts } from './provider';
import { loadContractAddresses, getIdentityContract, getCourseContract, getAcademicContract, getGraduationContract, getCertificateContract } from './contracts';
import { Contract, JsonRpcSigner } from 'ethers';

export function useWallet() {
  const { account, chainId, isConnected, isCorrectChain, connect, error: walletError } = useMetaMask();
  const [signer, setSigner] = useState<JsonRpcSigner | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [txPending, setTxPending] = useState(false);

  const ensureReady = useCallback(async () => {
    if (!isConnected || !isCorrectChain) {
      setError('Please connect MetaMask and switch to Ganache (chain 1337)');
      return false;
    }
    try {
      await loadContractAddresses();
      const s = await getSigner();
      setSigner(s);
      setError(null);
      return true;
    } catch (err: any) {
      setError(err.message);
      return false;
    }
  }, [isConnected, isCorrectChain]);

  const sendTx = useCallback(async (txPromise: Promise<any>): Promise<string> => {
    setTxPending(true);
    setError(null);
    try {
      const tx = await txPromise;
      const receipt = await tx.wait();
      return receipt.hash;
    } catch (err: any) {
      if (err.code === 4001 || err.code === 'ACTION_REJECTED') {
        throw new Error('Transaction rejected by user');
      }
      throw new Error(err.reason || err.message || 'Transaction failed');
    } finally {
      setTxPending(false);
    }
  }, []);

  const getIdentity = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected');
    return getIdentityContract(signer);
  }, [signer]);

  const getCourse = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected');
    return getCourseContract(signer);
  }, [signer]);

  const getAcademic = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected');
    return getAcademicContract(signer);
  }, [signer]);

  const getGraduation = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected');
    return getGraduationContract(signer);
  }, [signer]);

  const getCertificate = useCallback(() => {
    if (!signer) throw new Error('Wallet not connected');
    return getCertificateContract(signer);
  }, [signer]);

  return {
    account,
    chainId,
    isConnected,
    isCorrectChain,
    connect,
    signer,
    error: error || walletError,
    txPending,
    ensureReady,
    sendTx,
    getIdentity,
    getCourse,
    getAcademic,
    getGraduation,
    getCertificate,
  };
}