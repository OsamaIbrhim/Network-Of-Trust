const { expect } = require("chai");
const { ethers } = require("hardhat");
const core = require("@not/credential-core");

describe("credential-core <-> CredentialRegistry", function () {
  it("hashes built off-chain verify on-chain as VALID", async function () {
    const [admin, uni] = await ethers.getSigners();
    const registry = await (await ethers.getContractFactory("CredentialRegistry")).deploy(admin.address);
    const institutionPlatformId = "inst-1";
    const institutionId = ethers.id(institutionPlatformId);
    await registry.registerInstitution(institutionId);
    await registry.addSigner(institutionId, uni.address);

    const graduates = ["Ali Hassan", "Mona Adel", "Omar Said"];
    const hashes = graduates.map((fullName, i) =>
      core.computeCredentialHash(
        {
          schema: "not.credential.v1",
          credentialId: `cred-${i}`,
          institution: { id: institutionPlatformId, name: "Menoufia University", issuerAddress: uni.address },
          student: { fullName, studentNumber: `2021-000${i}` },
          award: { title: "B.Sc. Computer Science", type: "DEGREE", graduationDate: "2025-07-01" },
          issuedAt: "2025-07-15T10:00:00.000Z",
        },
        core.generateSalt(),
      ),
    );
    const batch = core.buildBatch(hashes);
    await registry.connect(uni).anchorBatch(batch.root, batch.size);

    for (const h of hashes) {
      const r = await registry.verify(institutionId, batch.root, h, batch.proofs[h]);
      expect(r.status).to.equal(1n); // VALID
    }
  });
});
