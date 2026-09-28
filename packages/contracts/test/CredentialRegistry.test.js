const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const Status = { UNKNOWN: 0n, VALID: 1n, REVOKED: 2n };
const State = { NONE: 0n, ACTIVE: 1n, SUSPENDED: 2n };
const Reason = { ISSUED_IN_ERROR: 1, FRAUD: 2, SUPERSEDED: 3, OTHER: 4, SIGNER_COMPROMISED: 5 };
const INST_A = ethers.id("institution-a-uuid");
const INST_B = ethers.id("institution-b-uuid");

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

async function anchoredFixture() {
  const f = await deployFixture();
  await f.registry.connect(f.signerA).anchorBatch(f.tree.root, f.hashes.length);
  return f;
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
      const { registry, signerA, stranger } = await loadFixture(deployFixture);
      await expect(registry.connect(stranger).registerInstitution(ethers.id("x")))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.connect(stranger).addSigner(INST_A, stranger.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.connect(stranger).removeSigner(signerA.address))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await expect(registry.connect(stranger).suspendInstitution(INST_A))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await registry.suspendInstitution(INST_A);
      await expect(registry.connect(stranger).reinstateInstitution(INST_A))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("reinstates only a suspended institution", async function () {
      const { registry } = await loadFixture(deployFixture);
      await expect(registry.reinstateInstitution(INST_A))
        .to.be.revertedWithCustomError(registry, "InstitutionNotSuspended").withArgs(INST_A);
      await expect(registry.reinstateInstitution(ethers.id("nope")))
        .to.be.revertedWithCustomError(registry, "InstitutionNotSuspended");
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

  describe("cross-institution isolation", function () {
    it("a signer cannot use admin functions, against its own institution or another one", async function () {
      const { registry, signerA, signerB, stranger } = await loadFixture(deployFixture);
      const asA = registry.connect(signerA);
      const ADMIN = await registry.DEFAULT_ADMIN_ROLE();
      for (const call of [
        () => asA.removeSigner(signerB.address),
        () => asA.suspendInstitution(INST_B),
        () => asA.addSigner(INST_B, stranger.address),
        () => asA.addSigner(INST_A, stranger.address),
        () => asA.registerInstitution(ethers.id("x")),
        () => asA.grantRole(ADMIN, signerA.address),
        () => asA.pause(),
      ]) {
        await expect(call()).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      }
    });

    it("the admin is not a signer and cannot anchor", async function () {
      const { registry, admin, tree } = await loadFixture(deployFixture);
      await expect(registry.connect(admin).anchorBatch(tree.root, 3))
        .to.be.revertedWithCustomError(registry, "NotASigner").withArgs(admin.address);
    });

    it("suspending one institution or removing its signer does not affect another", async function () {
      const { registry, signerA, signerB, hashes, tree } = await loadFixture(deployFixture);
      await registry.connect(signerB).anchorBatch(tree.root, 3);
      await registry.connect(signerA).anchorBatch(tree.root, 3);

      await registry.suspendInstitution(INST_A);

      await registry.connect(signerB).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.OTHER);
      expect((await registry.verify(INST_B, tree.root, hashes[0], proofFor(tree, hashes[0]))).institutionActive).to.equal(true);
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).institutionActive).to.equal(false);

      await registry.removeSigner(signerA.address);
      await expect(registry.connect(signerB).anchorBatch(fakeHash("b-2"), 3))
        .to.emit(registry, "BatchAnchored").withArgs(INST_B, fakeHash("b-2"), signerB.address, 3);
      expect(await registry.institutionState(INST_B)).to.equal(State.ACTIVE);
    });

    it("a wallet moved from A to B signs for B only and cannot revoke A's old batches", async function () {
      const { registry, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      await registry.removeSigner(signerA.address);
      await registry.addSigner(INST_B, signerA.address);
      await expect(registry.connect(signerA).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.FRAUD))
        .to.be.revertedWithCustomError(registry, "UnknownBatch").withArgs(tree.root);
      const rootB = fakeHash("b-root");
      await expect(registry.connect(signerA).anchorBatch(rootB, 1))
        .to.emit(registry, "BatchAnchored").withArgs(INST_B, rootB, signerA.address, 1);
      expect((await registry.getBatch(INST_A, rootB)).anchoredAt).to.equal(0n);
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);
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

    it("front-running: another institution anchoring the same root first does not block or hijack it", async function () {
      const { registry, signerA, signerB, hashes, tree } = await loadFixture(deployFixture);
      await registry.connect(signerB).anchorBatch(tree.root, 3);
      await expect(registry.connect(signerA).anchorBatch(tree.root, 3))
        .to.emit(registry, "BatchAnchored").withArgs(INST_A, tree.root, signerA.address, 3);
      await registry.connect(signerB).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.FRAUD);
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);
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

  describe("verify", function () {
    it("returns VALID with the signer for every credential in an anchored batch", async function () {
      const { registry, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      for (const h of hashes) {
        const r = await registry.verify(INST_A, tree.root, h, proofFor(tree, h));
        expect(r.status).to.equal(Status.VALID);
        expect(r.institutionActive).to.equal(true);
        expect(r.signer).to.equal(signerA.address);
      }
    });

    it("returns UNKNOWN when asked about the wrong institution", async function () {
      const { registry, hashes, tree } = await loadFixture(anchoredFixture);
      expect((await registry.verify(INST_B, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.UNKNOWN);
    });

    it("works for a batch with a single credential (empty proof)", async function () {
      const { registry, signerA } = await loadFixture(deployFixture);
      const h = fakeHash("solo");
      const tree = buildTree([h]);
      await registry.connect(signerA).anchorBatch(tree.root, 1);
      expect(proofFor(tree, h)).to.deep.equal([]);
      expect((await registry.verify(INST_A, tree.root, h, [])).status).to.equal(Status.VALID);
    });

    it("returns UNKNOWN for a hash that is not in the batch and for a root that was never anchored", async function () {
      const { registry, tree, hashes } = await loadFixture(anchoredFixture);
      expect((await registry.verify(INST_A, tree.root, fakeHash("forged"), proofFor(tree, hashes[0]))).status).to.equal(Status.UNKNOWN);
      const other = buildTree([hashes[0], fakeHash("z")]);
      expect((await registry.verify(INST_A, other.root, hashes[0], proofFor(other, hashes[0]))).status).to.equal(Status.UNKNOWN);
    });
  });

  describe("revoke", function () {
    it("lets a signer of the institution revoke with a reason", async function () {
      const { registry, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      const h = hashes[1];
      await expect(registry.connect(signerA).revoke(tree.root, h, proofFor(tree, h), Reason.FRAUD))
        .to.emit(registry, "CredentialRevoked").withArgs(INST_A, tree.root, h, signerA.address, Reason.FRAUD);
      const r = await registry.verify(INST_A, tree.root, h, proofFor(tree, h));
      expect(r.status).to.equal(Status.REVOKED);
      expect(r.reason).to.equal(BigInt(Reason.FRAUD));
      expect(r.revokedAt).to.equal(BigInt(await time.latest()));
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);
    });

    it("rejects another institution revoking a batch it did not anchor", async function () {
      const { registry, signerB, hashes, tree } = await loadFixture(anchoredFixture);
      await expect(registry.connect(signerB).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.OTHER))
        .to.be.revertedWithCustomError(registry, "UnknownBatch").withArgs(tree.root);
    });

    it("a copied hash in another institution's batch cannot revoke the original", async function () {
      const { registry, signerB, hashes, tree } = await loadFixture(anchoredFixture);
      const copy = buildTree([hashes[0], fakeHash("b-own")]);
      await registry.connect(signerB).anchorBatch(copy.root, 2);
      await registry.connect(signerB).revoke(copy.root, hashes[0], proofFor(copy, hashes[0]), Reason.FRAUD);
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);
    });

    it("rejects hashes outside the batch, reason 0, unknown roots and double revocation", async function () {
      const { registry, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      const p = proofFor(tree, hashes[0]);
      await expect(registry.connect(signerA).revoke(tree.root, fakeHash("x"), p, Reason.OTHER)).to.be.revertedWithCustomError(registry, "NotInBatch");
      await expect(registry.connect(signerA).revoke(tree.root, hashes[0], p, 0)).to.be.revertedWithCustomError(registry, "InvalidReason");
      await expect(registry.connect(signerA).revoke(fakeHash("no-root"), hashes[0], p, Reason.OTHER)).to.be.revertedWithCustomError(registry, "UnknownBatch");
      await registry.connect(signerA).revoke(tree.root, hashes[0], p, Reason.OTHER);
      await expect(registry.connect(signerA).revoke(tree.root, hashes[0], p, Reason.OTHER)).to.be.revertedWithCustomError(registry, "AlreadyRevoked");
    });
  });

  describe("wallet rotation", function () {
    it("keeps old credentials VALID and lets the new wallet revoke batches signed by the old one", async function () {
      const { registry, signerA, newSignerA, hashes, tree } = await loadFixture(anchoredFixture);
      await registry.addSigner(INST_A, newSignerA.address);
      await expect(registry.removeSigner(signerA.address)).to.emit(registry, "SignerRemoved").withArgs(INST_A, signerA.address);

      const before = await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]));
      expect(before.status).to.equal(Status.VALID);
      expect(before.institutionActive).to.equal(true);
      expect(before.signer).to.equal(signerA.address);

      await registry.connect(newSignerA).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.SUPERSEDED);
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.REVOKED);
    });

    it("a removed (e.g. stolen) wallet can no longer anchor or revoke", async function () {
      const { registry, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      await registry.removeSigner(signerA.address);
      await expect(registry.connect(signerA).anchorBatch(fakeHash("new-root"), 1))
        .to.be.revertedWithCustomError(registry, "NotASigner").withArgs(signerA.address);
      await expect(registry.connect(signerA).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.FRAUD))
        .to.be.revertedWithCustomError(registry, "NotASigner");
    });
  });

  describe("stolen signer key (revokeBatch)", function () {
    it("admin revokes a whole fake batch without knowing its leaves; genuine batches stay VALID", async function () {
      const { registry, admin, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      const fakes = Array.from({ length: 50 }, (_, i) => fakeHash("fake-" + i));
      const fakeTree = buildTree(fakes);
      await registry.connect(signerA).anchorBatch(fakeTree.root, fakes.length);
      await registry.connect(admin).removeSigner(signerA.address);
      await expect(registry.connect(admin).revokeBatch(INST_A, fakeTree.root, Reason.SIGNER_COMPROMISED))
        .to.emit(registry, "BatchRevoked").withArgs(INST_A, fakeTree.root, Reason.SIGNER_COMPROMISED);
      for (const h of [fakes[0], fakes[49]]) {
        const r = await registry.verify(INST_A, fakeTree.root, h, proofFor(fakeTree, h));
        expect(r.status).to.equal(Status.REVOKED);
        expect(r.reason).to.equal(BigInt(Reason.SIGNER_COMPROMISED));
      }
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);
    });

    it("a signer (e.g. a stolen key) cannot revoke whole batches, even though every root is public", async function () {
      const { registry, signerA, tree } = await loadFixture(anchoredFixture);
      await expect(registry.connect(signerA).revokeBatch(INST_A, tree.root, Reason.FRAUD))
        .to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("rejects reason 0, unknown roots and double batch revocation, and works while paused", async function () {
      const { registry, admin, tree } = await loadFixture(anchoredFixture);
      await expect(registry.revokeBatch(INST_A, tree.root, 0)).to.be.revertedWithCustomError(registry, "InvalidReason");
      await expect(registry.revokeBatch(INST_B, tree.root, Reason.FRAUD))
        .to.be.revertedWithCustomError(registry, "UnknownBatch").withArgs(tree.root);
      await registry.connect(admin).pause();
      await registry.revokeBatch(INST_A, tree.root, Reason.FRAUD);
      await expect(registry.revokeBatch(INST_A, tree.root, Reason.FRAUD))
        .to.be.revertedWithCustomError(registry, "BatchAlreadyRevoked").withArgs(tree.root);
    });

    it("revoking A's batch never touches B's batch with the same root", async function () {
      const { registry, admin, signerA, signerB, hashes, tree } = await loadFixture(deployFixture);
      await registry.connect(signerA).anchorBatch(tree.root, 3);
      await registry.connect(signerB).anchorBatch(tree.root, 3);

      await registry.connect(admin).revokeBatch(INST_A, tree.root, Reason.SIGNER_COMPROMISED);

      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.REVOKED);
      expect((await registry.verify(INST_B, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);

      await expect(registry.revokeBatch(INST_B, tree.root, Reason.FRAUD))
        .to.emit(registry, "BatchRevoked").withArgs(INST_B, tree.root, Reason.FRAUD);
    });
  });

  describe("suspension", function () {
    it("keeps old credentials VALID with institutionActive=false, blocks new actions, and can be reinstated", async function () {
      const { registry, signerA, hashes, tree } = await loadFixture(anchoredFixture);
      await expect(registry.suspendInstitution(INST_A)).to.emit(registry, "InstitutionSuspended").withArgs(INST_A);
      const r = await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]));
      expect(r.status).to.equal(Status.VALID);
      expect(r.institutionActive).to.equal(false);
      await expect(registry.connect(signerA).anchorBatch(fakeHash("new-root"), 1))
        .to.be.revertedWithCustomError(registry, "InstitutionNotActive").withArgs(INST_A);
      await expect(registry.connect(signerA).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.OTHER))
        .to.be.revertedWithCustomError(registry, "InstitutionNotActive");
      await registry.reinstateInstitution(INST_A);
      await registry.connect(signerA).anchorBatch(fakeHash("new-root"), 1);
    });
  });

  describe("pause", function () {
    it("blocks writes but never blocks verification", async function () {
      const { registry, admin, signerA, stranger, hashes, tree } = await loadFixture(anchoredFixture);
      await expect(registry.connect(stranger).pause()).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await registry.connect(admin).pause();
      await expect(registry.connect(signerA).anchorBatch(fakeHash("r2"), 1)).to.be.revertedWithCustomError(registry, "EnforcedPause");
      await expect(registry.connect(signerA).revoke(tree.root, hashes[0], proofFor(tree, hashes[0]), Reason.OTHER))
        .to.be.revertedWithCustomError(registry, "EnforcedPause");
      expect((await registry.verify(INST_A, tree.root, hashes[0], proofFor(tree, hashes[0]))).status).to.equal(Status.VALID);
      await expect(registry.connect(stranger).unpause()).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
      await registry.connect(admin).unpause();
      await registry.connect(signerA).anchorBatch(fakeHash("r2"), 1);
    });
  });
});
