const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const State = { NONE: 0n, ACTIVE: 1n, SUSPENDED: 2n };
const INST_A = ethers.id("institution-a-uuid");
const INST_B = ethers.id("institution-b-uuid");

function fakeHash(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function buildTree(hashes) {
  return StandardMerkleTree.of(hashes.map((h) => [h]), ["bytes32"]);
}

async function deployFixture() {
  const [admin, signerA, signerB, stranger, newSignerA, newAdmin] = await ethers.getSigners();
  const registry = await (await ethers.getContractFactory("CredentialRegistry")).deploy(admin.address);
  await registry.registerInstitution(INST_A);
  await registry.registerInstitution(INST_B);
  await registry.addSigner(INST_A, signerA.address);
  await registry.addSigner(INST_B, signerB.address);
  const hashes = ["cred-1", "cred-2", "cred-3"].map(fakeHash);
  const tree = buildTree(hashes);
  return { registry, admin, signerA, signerB, stranger, newSignerA, newAdmin, hashes, tree };
}

describe("CredentialRegistry", function () {
  describe("admin", function () {
    it("rejects the zero address as admin", async function () {
      const Registry = await ethers.getContractFactory("CredentialRegistry");
      await expect(Registry.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(Registry, "InvalidAdmin");
    });

    it("can be handed over to a new address (e.g. a multisig) and the old one loses control", async function () {
      const { registry, admin, newAdmin } = await loadFixture(deployFixture);
      const ADMIN = await registry.DEFAULT_ADMIN_ROLE();
      await registry.connect(admin).grantRole(ADMIN, newAdmin.address);
      await registry.connect(admin).renounceRole(ADMIN, admin.address);
      await expect(registry.connect(admin).registerInstitution(ethers.id("x")))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await registry.connect(newAdmin).registerInstitution(ethers.id("x"));
    });
  });

  describe("institutions and signers", function () {
    it("only the admin can register institutions and manage signers", async function () {
      const { registry, stranger } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).registerInstitution(ethers.id("x")))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.connect(stranger).addSigner(INST_A, stranger.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.connect(stranger).suspendInstitution(INST_A))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("rejects a zero id, a duplicate id, an unknown institution, a zero signer and a signer that already belongs somewhere", async function () {
      const { registry, signerA, stranger } = await loadFixture(deployFixture);
      await expect(registry.registerInstitution(ethers.ZeroHash)).to.be.revertedWithCustomError(registry, "InvalidInstitution");
      await expect(registry.registerInstitution(INST_A))
        .to.be.revertedWithCustomError(registry, "InstitutionAlreadyRegistered").withArgs(INST_A);
      await expect(registry.addSigner(ethers.id("nope"), stranger.address))
        .to.be.revertedWithCustomError(registry, "UnknownInstitution");
      await expect(registry.addSigner(INST_A, ethers.ZeroAddress)).to.be.revertedWithCustomError(registry, "InvalidSigner");
      await expect(registry.addSigner(INST_B, signerA.address))
        .to.be.revertedWithCustomError(registry, "SignerAlreadyAssigned").withArgs(signerA.address);
      await expect(registry.removeSigner(stranger.address))
        .to.be.revertedWithCustomError(registry, "NotASigner").withArgs(stranger.address);
    });

    it("exposes state and signer mapping", async function () {
      const { registry, signerA, stranger } = await loadFixture(deployFixture);
      expect(await registry.institutionState(INST_A)).to.equal(State.ACTIVE);
      expect(await registry.institutionOf(signerA.address)).to.equal(INST_A);
      expect(await registry.institutionOf(stranger.address)).to.equal(ethers.ZeroHash);
    });
  });

  describe("anchorBatch", function () {
    it("stores the batch under the signer's institution and emits BatchAnchored", async function () {
      const { registry, signerA, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(signerA).anchorBatch(tree.root, 3))
        .to.emit(registry, "BatchAnchored").withArgs(INST_A, tree.root, signerA.address, 3);
      const batch = await registry.getBatch(INST_A, tree.root);
      expect(batch.size).to.equal(3n);
      expect(batch.signer).to.equal(signerA.address);
      expect(batch.anchoredAt).to.equal(BigInt(await time.latest()));
      expect((await registry.getBatch(INST_B, tree.root)).anchoredAt).to.equal(0n);
    });

    it("rejects wallets that are not signers", async function () {
      const { registry, stranger, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).anchorBatch(tree.root, 3))
        .to.be.revertedWithCustomError(registry, "NotASigner").withArgs(stranger.address);
    });

    it("rejects a zero root, a zero size and the same institution anchoring a root twice", async function () {
      const { registry, signerA, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(signerA).anchorBatch(ethers.ZeroHash, 1)).to.be.revertedWithCustomError(registry, "InvalidRoot");
      await expect(registry.connect(signerA).anchorBatch(tree.root, 0)).to.be.revertedWithCustomError(registry, "InvalidSize");
      await registry.connect(signerA).anchorBatch(tree.root, 3);
      await expect(registry.connect(signerA).anchorBatch(tree.root, 3))
        .to.be.revertedWithCustomError(registry, "BatchAlreadyAnchored").withArgs(tree.root);
    });

    it("costs (almost) the same gas for 1 credential and for 1000 credentials", async function () {
      const { registry, signerA } = await loadFixture(deployFixture);
      const small = buildTree([fakeHash("only-one")]);
      const big = buildTree(Array.from({ length: 1000 }, (_, i) => fakeHash("c" + i)));
      const g1 = (await (await registry.connect(signerA).anchorBatch(small.root, 1)).wait()).gasUsed;
      const g1000 = (await (await registry.connect(signerA).anchorBatch(big.root, 1000)).wait()).gasUsed;
      expect(Number(g1000)).to.be.closeTo(Number(g1), 100);
      expect(Number(g1000)).to.be.lessThan(55000);
    });
  });

  describe("suspension", function () {
    it("blocks anchoring while suspended and allows it again after reinstatement", async function () {
      const { registry, signerA } = await loadFixture(deployFixture);
      await expect(registry.suspendInstitution(INST_A)).to.emit(registry, "InstitutionSuspended").withArgs(INST_A);
      await expect(registry.connect(signerA).anchorBatch(fakeHash("r"), 1))
        .to.be.revertedWithCustomError(registry, "InstitutionNotActive").withArgs(INST_A);
      await registry.reinstateInstitution(INST_A);
      await registry.connect(signerA).anchorBatch(fakeHash("r"), 1);
    });
  });

  describe("pause", function () {
    it("only the admin can pause, and pause blocks anchorBatch", async function () {
      const { registry, admin, signerA, stranger, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).pause()).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await registry.connect(admin).pause();
      await expect(registry.connect(signerA).anchorBatch(tree.root, 3)).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await registry.connect(admin).unpause();
      await registry.connect(signerA).anchorBatch(tree.root, 3);
    });
  });
});
