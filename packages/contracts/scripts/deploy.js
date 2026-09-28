const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

// Dev/test networks may fall back to the deployer as admin; anywhere else the
// admin (e.g. a multisig) must be given explicitly (ADR 0005: platform admin trust).
const DEPLOYER_FALLBACK_NETWORKS = ["hardhat", "localhost", "sepolia"];

async function main() {
  const [deployer] = await ethers.getSigners();
  const registryAdmin = process.env.REGISTRY_ADMIN;
  if (!registryAdmin && !DEPLOYER_FALLBACK_NETWORKS.includes(network.name)) {
    throw new Error(`REGISTRY_ADMIN is required on network "${network.name}"`);
  }
  const admin = registryAdmin || deployer.address;
  if (!ethers.isAddress(admin)) throw new Error(`REGISTRY_ADMIN is not an address: ${admin}`);

  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(admin);
  const receipt = await registry.deploymentTransaction().wait();

  const hasAdminRole = await registry.hasRole(await registry.DEFAULT_ADMIN_ROLE(), admin);
  if (!hasAdminRole) throw new Error(`Deployed registry did not grant DEFAULT_ADMIN_ROLE to ${admin}`);

  const out = {
    network: network.name,
    chainId: Number((await ethers.provider.getNetwork()).chainId),
    address: await registry.getAddress(),
    admin,
    deployer: deployer.address,
    blockNumber: receipt.blockNumber,
    txHash: receipt.hash,
    deployedAt: new Date().toISOString(),
  };
  const file = path.join(__dirname, "..", "deployments", `${network.name}.json`);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(out, null, 2) + "\n");
  console.log(`CredentialRegistry deployed to ${out.address} on ${out.network} (chainId ${out.chainId})`);
  console.log(`Saved ${path.relative(process.cwd(), file)}`);
}

main().catch((err) => {
  let message = err.message || String(err);
  const rpcUrl = process.env.SEPOLIA_RPC_URL;
  if (rpcUrl) message = message.split(rpcUrl).join("<redacted>");
  console.error(message);
  process.exitCode = 1;
});
