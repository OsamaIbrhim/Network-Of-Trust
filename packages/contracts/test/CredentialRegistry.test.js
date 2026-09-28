const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const Status = { UNKNOWN: 0n, VALID: 1n, REVOKED: 2n };
const Reason = { ISSUED_IN_ERROR: 1, FRAUD: 2, SUPERSEDED: 3, OTHER: 4 };

function fakeHash(label) {
  return ethers.keccak256(ethers.toUtf8Bytes(label));
}

function buildTree(hashes) {
  return StandardMerkleTree.of(hashes.map((h) => [h]), ["bytes32"]);
}

function proofFor(tree, hash) {
  for (const [i, v] of tree.entries()) {
    if (v[0] === hash) return tree.getProof(i);
  }
  throw new Error("hash not in tree");
}

async function deployFixture() {
  const [admin, uniA, uniB, stranger] = await ethers.getSigners();
  const Registry = await ethers.getContractFactory("CredentialRegistry");
  const registry = await Registry.deploy(admin.address);
  const ISSUER_ROLE = await registry.ISSUER_ROLE();
  await registry.connect(admin).grantRole(ISSUER_ROLE, uniA.address);
  await registry.connect(admin).grantRole(ISSUER_ROLE, uniB.address);
  const hashes = ["cred-1", "cred-2", "cred-3"].map(fakeHash);
  const tree = buildTree(hashes);
  return { registry, admin, uniA, uniB, stranger, ISSUER_ROLE, hashes, tree };
}

async function anchoredFixture() {
  const f = await deployFixture();
  await f.registry.connect(f.uniA).anchorBatch(f.tree.root, f.hashes.length);
  return f;
}

describe("CredentialRegistry", function () {
  describe("issuer management", function () {
    it("only the admin can grant ISSUER_ROLE", async function () {
      const { registry, stranger, ISSUER_ROLE } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).grantRole(ISSUER_ROLE, stranger.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("isIssuer reflects grants and revocations", async function () {
      const { registry, admin, uniA, ISSUER_ROLE } = await loadFixture(deployFixture);
      expect(await registry.isIssuer(uniA.address)).to.equal(true);
      await registry.connect(admin).revokeRole(ISSUER_ROLE, uniA.address);
      expect(await registry.isIssuer(uniA.address)).to.equal(false);
    });
  });

  describe("anchorBatch", function () {
    it("stores the batch and emits BatchAnchored", async function () {
      const { registry, uniA, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(uniA).anchorBatch(tree.root, 3))
        .to.emit(registry, "BatchAnchored").withArgs(tree.root, uniA.address, 3);
      const batch = await registry.getBatch(tree.root);
      expect(batch.issuer).to.equal(uniA.address);
      expect(batch.size).to.equal(3n);
      expect(batch.anchoredAt).to.equal(BigInt(await time.latest()));
    });

    it("rejects callers without ISSUER_ROLE", async function () {
      const { registry, stranger, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).anchorBatch(tree.root, 3))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("rejects a zero root, a zero size and a duplicate root", async function () {
      const { registry, uniA, uniB, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(uniA).anchorBatch(ethers.ZeroHash, 1))
        .to.be.revertedWithCustomError(registry, "InvalidRoot");
      await expect(registry.connect(uniA).anchorBatch(tree.root, 0))
        .to.be.revertedWithCustomError(registry, "InvalidSize");
      await registry.connect(uniA).anchorBatch(tree.root, 3);
      await expect(registry.connect(uniB).anchorBatch(tree.root, 3))
        .to.be.revertedWithCustomError(registry, "BatchAlreadyAnchored").withArgs(tree.root);
    });

    it("costs (almost) the same gas for 1 credential and for 1000 credentials", async function () {
      const { registry, uniA } = await loadFixture(deployFixture);
      const small = buildTree([fakeHash("only-one")]);
      const big = buildTree(Array.from({ length: 1000 }, (_, i) => fakeHash("c" + i)));
      const g1 = (await (await registry.connect(uniA).anchorBatch(small.root, 1)).wait()).gasUsed;
      const g1000 = (await (await registry.connect(uniA).anchorBatch(big.root, 1000)).wait()).gasUsed;
      // only calldata bytes differ (a few gas), storage cost is identical
      expect(Number(g1000)).to.be.closeTo(Number(g1), 100);
      expect(Number(g1000)).to.be.lessThan(80000);
    });
  });

  describe("pause", function () {
    it("only the admin can pause, and pause blocks anchorBatch", async function () {
      const { registry, admin, uniA, stranger, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).pause())
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await registry.connect(admin).pause();
      await expect(registry.connect(uniA).anchorBatch(tree.root, 3))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      await registry.connect(admin).unpause();
      await registry.connect(uniA).anchorBatch(tree.root, 3);
    });
  });
});
