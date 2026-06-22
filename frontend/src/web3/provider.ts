import { BrowserProvider, JsonRpcSigner } from 'ethers';

export function getBrowserProvider(): BrowserProvider | null {
  if (!window.ethereum) return null;
  return new BrowserProvider(window.ethereum);
}

export async function requestAccounts(): Promise<string[]> {
  if (!window.ethereum) throw new Error('MetaMask not installed');
  const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
  return accounts as string[];
}

export async function getSigner(): Promise<JsonRpcSigner> {
  const provider = getBrowserProvider();
  if (!provider) throw new Error('MetaMask not installed');
  return provider.getSigner();
}