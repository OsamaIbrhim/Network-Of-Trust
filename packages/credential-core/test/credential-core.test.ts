import { describe, expect, it } from "vitest";
import { AbiCoder, keccak256, toUtf8Bytes } from "ethers";
import {
  buildBatch,
  canonicalJson,
  computeCredentialHash,
  generateSalt,
  verifyProofLocally,
  type CredentialPayload,
  type Hex,
} from "../src";

const SALT = ("0x" + "11".repeat(32)) as Hex;

function payload(overrides: Partial<CredentialPayload["student"]> = {}): CredentialPayload {
  return {
    schema: "not.credential.v1",
    credentialId: "5b1f6c1e-2f0a-4a51-9d7e-0c6f4d7c8a11",
    institution: { id: "inst-1", name: "Menoufia University", issuerAddress: "0x0000000000000000000000000000000000000001" },
    student: { fullName: "Ali Hassan", studentNumber: "2021-0001", ...overrides },
    award: { title: "B.Sc. Computer Science", type: "DEGREE", graduationDate: "2025-07-01", gpa: "3.45" },
    issuedAt: "2025-07-15T10:00:00.000Z",
  };
}

const hash = (label: string) => keccak256(toUtf8Bytes(label)) as Hex;

describe("canonicalJson", () => {
  it("sorts keys at every level and removes whitespace", () => {
    expect(canonicalJson({ b: 1, a: { d: [3, { z: 1, y: 2 }], c: "x" } }))
      .toBe('{"a":{"c":"x","d":[3,{"y":2,"z":1}]},"b":1}');
  });

  it("gives the same string regardless of key insertion order", () => {
    expect(canonicalJson({ x: 1, y: 2 })).toBe(canonicalJson({ y: 2, x: 1 }));
  });

  it("keeps Arabic text as-is", () => {
    expect(canonicalJson({ name: "علي حسن" })).toBe('{"name":"علي حسن"}');
  });

  it("rejects undefined, NaN, Infinity, Dates and functions", () => {
    expect(() => canonicalJson({ a: undefined })).toThrow(TypeError);
    expect(() => canonicalJson({ a: NaN })).toThrow(TypeError);
    expect(() => canonicalJson({ a: Infinity })).toThrow(TypeError);
    expect(() => canonicalJson({ a: new Date(0) })).toThrow(TypeError);
    expect(() => canonicalJson({ a: () => 1 })).toThrow(TypeError);
  });
});

describe("computeCredentialHash", () => {
  it("is deterministic and matches the frozen test vector", () => {
    const h = computeCredentialHash(payload(), SALT);
    expect(h).toBe(computeCredentialHash(payload(), SALT));
    // Frozen vector: if this changes, every credential already issued stops verifying.
    expect(h).toBe("0x1bfbd3946691e1f4e226c39c2380cea9957e95f76582db2a75d01318635d4946");
  });

  it("changes when any field changes", () => {
    expect(computeCredentialHash(payload({ fullName: "Ali Hasan" }), SALT))
      .not.toBe(computeCredentialHash(payload(), SALT));
  });

  it("changes when the salt changes", () => {
    expect(computeCredentialHash(payload(), generateSalt()))
      .not.toBe(computeCredentialHash(payload(), SALT));
  });

  it("rejects a salt that is not 32 bytes of hex", () => {
    expect(() => computeCredentialHash(payload(), "0x1234" as Hex)).toThrow(TypeError);
  });
});

describe("buildBatch / verifyProofLocally", () => {
  it("returns a proof for every hash that verifies against the root", () => {
    const hashes = ["a", "b", "c", "d", "e"].map(hash);
    const batch = buildBatch(hashes);
    expect(batch.size).toBe(5);
    for (const h of hashes) expect(verifyProofLocally(batch.root, h, batch.proofs[h])).toBe(true);
    expect(verifyProofLocally(batch.root, hash("forged"), batch.proofs[hashes[0]])).toBe(false);
  });

  it("uses the same leaf formula as CredentialRegistry.leafOf (single-item root == leaf)", () => {
    const h = hash("solo");
    const leaf = keccak256(keccak256(AbiCoder.defaultAbiCoder().encode(["bytes32"], [h])));
    const batch = buildBatch([h]);
    expect(batch.root).toBe(leaf);
    expect(batch.proofs[h]).toEqual([]);
  });

  it("rejects empty batches, duplicates (any letter case) and malformed hashes", () => {
    const h = hash("x");
    expect(() => buildBatch([])).toThrow(RangeError);
    expect(() => buildBatch([h, h.toUpperCase().replace("0X", "0x") as Hex])).toThrow(RangeError);
    expect(() => buildBatch(["0x1234" as Hex])).toThrow(TypeError);
  });
});
