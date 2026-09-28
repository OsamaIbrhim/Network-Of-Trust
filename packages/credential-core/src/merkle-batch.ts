import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { isHexString } from "ethers";
import type { Hex } from "./credential-hash";

export interface Batch {
  root: Hex;
  size: number;
  /** Keyed by credential hash; each proof goes as-is to CredentialRegistry.verify / revoke. */
  proofs: Record<Hex, Hex[]>;
}

const LEAF_ENCODING = ["bytes32"];

/** Must stay compatible with CredentialRegistry.leafOf(). */
export function buildBatch(credentialHashes: Hex[]): Batch {
  if (credentialHashes.length === 0) throw new RangeError("buildBatch: empty batch");
  const seen = new Set<string>();
  for (const h of credentialHashes) {
    if (!isHexString(h, 32)) throw new TypeError(`buildBatch: not a 32-byte hash: ${h}`);
    const key = h.toLowerCase();
    if (seen.has(key)) throw new RangeError(`buildBatch: duplicate hash ${h}`);
    seen.add(key);
  }
  const tree = StandardMerkleTree.of(credentialHashes.map((h) => [h]), LEAF_ENCODING);
  const proofs: Record<Hex, Hex[]> = {};
  for (const [i, [h]] of tree.entries()) proofs[h as Hex] = tree.getProof(i) as Hex[];
  return { root: tree.root as Hex, size: credentialHashes.length, proofs };
}

/** Off-chain convenience only; the chain is still the source of truth. */
export function verifyProofLocally(root: Hex, credentialHash: Hex, proof: Hex[]): boolean {
  return StandardMerkleTree.verify(root, LEAF_ENCODING, [credentialHash], proof);
}
