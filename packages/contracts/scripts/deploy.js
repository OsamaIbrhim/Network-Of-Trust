// Usage: npx hardhat run scripts/deploy.js --network <localhost|sepolia>
// Env: REGISTRY_ADMIN (optional, defaults to the deployer address)
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const admin = process.env.REGISTRY_ADMIN || deployer.address;
  if (!ethers.isAddress(admin)) throw new Error(`REGISTRY_ADMIN is not an address: ${admin}`);

  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(admin);
  const receipt = await registry.deploymentTransaction().wait();

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
  console.error(err);
  process.exitCode = 1;
});
