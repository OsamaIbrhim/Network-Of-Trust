declare module '../../../artifacts/contracts/*.sol/*.json' {
  const artifact: { abi: import('ethers').InterfaceAbi; contractName: string };
  export default artifact;
}

declare module '../../../deployments/ganache.json' {
  const deployment: {
    network: string;
    chainId: number;
    rpcUrl: string;
    addresses: Record<string, string>;
  };
  export default deployment;
}

declare module '*.css' {
  const content: { [className: string]: string };
  export default content;
}