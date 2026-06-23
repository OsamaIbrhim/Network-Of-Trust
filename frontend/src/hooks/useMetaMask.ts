import { useState, useEffect, useCallback } from 'react';

declare global {
  interface Window {
    ethereum?: {
      isMetaMask?: boolean;
      request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
      on: (event: string, handler: (...args: unknown[]) => void) => void;
      removeListener: (event: string, handler: (...args: unknown[]) => void) => void;
    };
  }
}

interface MetaMaskState {
  account: string | null;
  chainId: string | null;
  isConnected: boolean;
  isCorrectChain: boolean;
  isMetaMaskInstalled: boolean;
  error: string | null;
}

const TARGET_CHAIN = '0x539'; // 1337 in hex

export function useMetaMask() {
  const [state, setState] = useState<MetaMaskState>({
    account: null,
    chainId: null,
    isConnected: false,
    isCorrectChain: false,
    isMetaMaskInstalled: !!window.ethereum?.isMetaMask,
    error: null,
  });

  const checkChain = (chainId: string) => chainId === TARGET_CHAIN;

  const updateState = useCallback(async () => {
    if (!window.ethereum?.isMetaMask) {
      setState((s) => ({ ...s, isMetaMaskInstalled: false, account: null, isConnected: false, error: null }));
      return;
    }
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_accounts' })) as string[];
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      setState({
        account: accounts[0] || null,
        chainId,
        isConnected: accounts.length > 0,
        isCorrectChain: checkChain(chainId),
        isMetaMaskInstalled: true,
        error: null,
      });
    } catch {
      setState((s) => ({ ...s, error: 'Failed to read wallet state' }));
    }
  }, []);

  const connect = useCallback(async (): Promise<boolean> => {
    if (!window.ethereum?.isMetaMask) {
      setState((s) => ({ ...s, isMetaMaskInstalled: false, error: null }));
      return false;
    }
    try {
      const accounts = (await window.ethereum.request({ method: 'eth_requestAccounts' })) as string[];
      const chainId = (await window.ethereum.request({ method: 'eth_chainId' })) as string;
      setState({
        account: accounts[0] || null,
        chainId,
        isConnected: true,
        isCorrectChain: checkChain(chainId),
        isMetaMaskInstalled: true,
        error: null,
      });
      return true;
    } catch (err: any) {
      setState((s) => ({ ...s, error: err.code === 4001 ? 'Connection rejected' : 'Connection failed' }));
      return false;
    }
  }, []);

  useEffect(() => {
    if (!window.ethereum?.isMetaMask) {
      setState((s) => ({ ...s, isMetaMaskInstalled: false }));
      return;
    }
    updateState();
    const handleAccountsChanged = () => updateState();
    const handleChainChanged = () => updateState();
    window.ethereum.on('accountsChanged', handleAccountsChanged);
    window.ethereum.on('chainChanged', handleChainChanged);
    return () => {
      window.ethereum?.removeListener('accountsChanged', handleAccountsChanged);
      window.ethereum?.removeListener('chainChanged', handleChainChanged);
    };
  }, [updateState]);

  return { ...state, connect };
}