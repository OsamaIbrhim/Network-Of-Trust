# Phase 0+1: Repo Reset, credential-core and CredentialRegistry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the v1 repo into an npm-workspaces monorepo, and ship the two foundations every later phase depends on: the `@not/credential-core` hashing library and the `CredentialRegistry` smart contract, deployed locally and to Sepolia.

**Architecture:** v1 moves to `legacy/` untouched. `packages/credential-core` (TypeScript, CommonJS output) computes deterministic credential hashes and Merkle batches. `packages/contracts` (Hardhat 2) holds one contract that stores only Merkle roots and revocations. An integration test proves hashes built by the library verify on-chain.

**Tech Stack:** Node 22, npm 10 workspaces, TypeScript 5.9.3 (pinned at the root too), Vitest 5.0.2, ethers 6.17.0, @openzeppelin/merkle-tree 1.0.8, Hardhat 2.29.1, @nomicfoundation/hardhat-toolbox 6.1.2, @openzeppelin/contracts 5.6.1, Solidity 0.8.24, dotenv 16.6.1.

**Spec:** `docs/ARCHITECTURE.md` (sections 2, 5, 6). Phase scope: `docs/ROADMAP.md` Phase 0 and Phase 1.

## Global Constraints

- Node `>=22`; `.nvmrc` = `22`.
- Exact dependency versions as listed in Tech Stack (no `^`), so the frozen hash test vector stays stable.
- Solidity `pragma solidity 0.8.24;` and `evmVersion: "cancun"`.
- No personal data in any contract storage, event, or error.
- `canonicalJson`, `computeCredentialHash` and the leaf format are frozen after Task 3/4. The frozen vector `0x1bfbd3946691e1f4e226c39c2380cea9957e95f76582db2a75d01318635d4946` must never be edited to make a test pass.
- Never commit `.env`, private keys, `node_modules`, `dist`, `artifacts`, `cache`, `typechain-types`.
- Commit messages: `type(scope): summary` (e.g. `feat(contracts): add anchorBatch`).

## Review Focus

1. **Same hash, different letter case, in one batch** (`0xAB..` and `0xab..`): must be rejected as a duplicate, otherwise two leaves describe one credential. Pinned in Task 4.
2. **Front-running from the mempool**: institution B sees A's pending `anchorBatch` and anchors the same root first. A's transaction must still succeed and A's credentials must verify as A's. Batches are keyed by `(institutionId, root)` (ADR 0001, 0002). Pinned in Task 6.
3. **Institution B copies A's credential hash into its own batch and revokes it**: A's credential must stay VALID. Pinned in Task 6.
4. **Wallet rotation** (staff change, lost or stolen key): after `addSigner(new)` + `removeSigner(old)`, old credentials stay VALID with `institutionActive = true`, the new wallet can revoke them, and the old wallet can do nothing (ADR 0002). Pinned in Task 6.
5. **Deploying with `address(0)` as admin** would leave the contract with nobody able to accredit institutions: the constructor must revert, and admin handover to a new address must work (ADR 0003). Pinned in Task 5.
6. **Suspended institution tries to anchor or revoke**: both must fail, while its already-issued credentials stay VALID with `institutionActive = false`. Pinned in Tasks 5 and 6.
7. **Arabic names and Unicode in the payload**: canonical JSON must keep them byte-for-byte so browser and server compute the same hash. Pinned in Task 2.
8. **Batch size does not change anchoring cost**: 1 credential and 1000 credentials cost about the same gas. Pinned in Task 5.

---

## File Structure

```
.gitignore                                   root ignore rules (Task 1)
.nvmrc                                       Node version (Task 1)
package.json                                 npm workspaces root (Task 1)
package-lock.json                            regenerated (Task 1)
legacy/**                                    all v1 files, moved (Task 1)
docs/ARCHITECTURE.md, docs/ROADMAP.md,
docs/reviews/2026-09-28-v1-review.md,
docs/plans/<this file>, CLAUDE.md            planning docs (Task 1)
packages/credential-core/
  package.json, tsconfig.json                (Task 2)
  src/canonical-json.ts                      deterministic JSON (Task 2)
  src/credential-hash.ts                     payload type, salt, hash (Task 3)
  src/merkle-batch.ts                        Merkle batch + local proof check (Task 4)
  src/index.ts                               public exports (Task 4)
  test/credential-core.test.ts               grows in Tasks 2, 3, 4
packages/contracts/
  package.json, hardhat.config.js            (Task 5)
  contracts/CredentialRegistry.sol           anchor/roles/pause (Task 5), + verify/revoke (Task 6)
  test/CredentialRegistry.test.js            (Task 5), full suite (Task 6)
  test/integration.credential-core.test.js   (Task 7)
  scripts/deploy.js, .env.example            (Task 7)
  deployments/sepolia.json                   (Task 9, committed)
.github/workflows/ci.yml                     (Task 8)
README.md                                    v2 readme (Task 8)
```

---

### Task 1: Repo reset (Phase 0)

**Files:**
- Move: every tracked file into `legacy/`
- Untrack + delete: `legacy/frontend/node_modules`, `legacy/frontend/dist`, `legacy/backend/dist`, `legacy/backend/.env`, `legacy/frontend/tsconfig.tsbuildinfo`
- Create: `.gitignore`, `.nvmrc`, `package.json`, `docs/**`, `CLAUDE.md`

**Interfaces:**
- Produces: npm workspaces root. Workspace list is explicit and ordered so `credential-core` builds before `contracts` tests run. Later phases append `apps/api` and `apps/web`.

- [ ] **Step 1: Create a branch**

```bash
git checkout main && git pull
git checkout -b v2/phase-0-1
```

- [ ] **Step 2: Move v1 into legacy/**

```bash
mkdir legacy
for f in $(git ls-tree --name-only HEAD); do git mv "$f" legacy/; done
git rm -r -q --cached legacy/frontend/node_modules legacy/frontend/dist legacy/backend/dist legacy/backend/.env legacy/frontend/tsconfig.tsbuildinfo
rm -rf legacy/frontend/node_modules legacy/frontend/dist legacy/backend/dist legacy/frontend/tsconfig.tsbuildinfo legacy/node_modules
```

- [ ] **Step 3: Create root files**

`.gitignore`:

```gitignore
node_modules/
dist/
.env
.env.*
!.env.example
*.tsbuildinfo
coverage/
# Hardhat
packages/contracts/artifacts/
packages/contracts/cache/
packages/contracts/typechain-types/
packages/contracts/deployments/hardhat.json
packages/contracts/deployments/localhost.json
# Editors
.vscode/
.cursor/
.continue/
.DS_Store
```

`.nvmrc`:

```
22
```

`package.json` (Task 5 adds `packages/contracts`, so start with credential-core only):

```json
{
  "name": "network-of-trust",
  "private": true,
  "engines": { "node": ">=22" },
  "workspaces": ["packages/credential-core"],
  "scripts": {
    "build": "npm run build --workspaces --if-present",
    "test": "npm run build && npm test --workspaces --if-present"
  },
  "devDependencies": {
    "typescript": "5.9.3"
  }
}
```

Why pin TypeScript at the root: `@nomicfoundation/hardhat-toolbox` accepts any TypeScript, and without this pin npm hoists the newest major (7.x) to the root, which then becomes the `tsc` for every workspace.

- [ ] **Step 4: Add the planning docs**

Copy `docs/` (ARCHITECTURE, ROADMAP, reviews, plans, reports and decisions templates), `CLAUDE.md` and `.claude/agents/` to the repo root. They are delivered alongside this plan.

- [ ] **Step 5: Verify**

Run: `git ls-files | grep -c node_modules`
Expected: `0`

Run: `ls`
Expected: `CLAUDE.md  docs  legacy  package.json` (plus hidden `.claude`, `.gitignore`, `.nvmrc`).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore(repo): move v1 to legacy/, add workspaces root and v2 docs"
```

---

### Task 2: credential-core scaffold + canonicalJson

**Files:**
- Create: `packages/credential-core/package.json`, `packages/credential-core/tsconfig.json`
- Create: `packages/credential-core/src/canonical-json.ts`
- Test: `packages/credential-core/test/credential-core.test.ts`

**Interfaces:**
- Produces: `canonicalJson(value: unknown): string` (throws `TypeError` on `undefined`, non-finite numbers, non-plain objects, functions).

- [ ] **Step 1: Package files**

`packages/credential-core/package.json`:

```json
{
  "name": "@not/credential-core",
  "version": "0.1.0",
  "private": true,
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "test": "vitest run"
  },
  "dependencies": {
    "@openzeppelin/merkle-tree": "1.0.8",
    "ethers": "6.17.0"
  },
  "devDependencies": {
    "typescript": "5.9.3",
    "vitest": "5.0.2"
  }
}
```

`packages/credential-core/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "node16",
    "moduleResolution": "node16",
    "declaration": true,
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src"]
}
```

Run: `npm install` (from repo root)
Expected: installs without `ERESOLVE` errors.

- [ ] **Step 2: Write the failing test**

`packages/credential-core/test/credential-core.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json";

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
```

- [ ] **Step 3: Run it to see it fail**

Run: `npm test -w @not/credential-core`
Expected: FAIL, `Cannot find module '../src/canonical-json'` (or "Failed to resolve import").

- [ ] **Step 4: Implement**

`packages/credential-core/src/canonical-json.ts`:

```ts
/**
 * Deterministic JSON (RFC 8785 "JCS" subset): object keys sorted by UTF-16 code units,
 * no whitespace. The same data always produces the same string, so the same hash.
 * Only plain objects, arrays, strings, finite numbers, booleans and null are allowed.
 */
export function canonicalJson(value: unknown): string {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
    case "boolean":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) throw new TypeError("canonicalJson: non-finite number");
      return JSON.stringify(value);
    case "object": {
      if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
      const proto = Object.getPrototypeOf(value);
      if (proto !== Object.prototype && proto !== null) {
        throw new TypeError("canonicalJson: only plain objects are allowed");
      }
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj).sort();
      const parts: string[] = [];
      for (const k of keys) {
        if (obj[k] === undefined) throw new TypeError(`canonicalJson: undefined at key "${k}"`);
        parts.push(`${JSON.stringify(k)}:${canonicalJson(obj[k])}`);
      }
      return `{${parts.join(",")}}`;
    }
    default:
      throw new TypeError(`canonicalJson: unsupported type ${typeof value}`);
  }
}
```

- [ ] **Step 5: Run it to see it pass**

Run: `npm test -w @not/credential-core`
Expected: `Tests  4 passed (4)`

- [ ] **Step 6: Commit**

```bash
git add packages/credential-core package-lock.json
git commit -m "feat(credential-core): add canonicalJson"
```

---

### Task 3: computeCredentialHash + generateSalt

**Files:**
- Create: `packages/credential-core/src/credential-hash.ts`
- Modify: `packages/credential-core/test/credential-core.test.ts`

**Interfaces:**
- Consumes: `canonicalJson` (Task 2).
- Produces: ``type Hex = `0x${string}` ``, `interface CredentialPayload` (exact shape below), `generateSalt(): Hex` (32 bytes), `computeCredentialHash(payload: CredentialPayload, salt: Hex): Hex` (throws `TypeError` if salt is not 32-byte hex).

- [ ] **Step 1: Write the failing tests**

Replace the import lines at the top of the test file with:

```ts
import { describe, expect, it } from "vitest";
import { canonicalJson } from "../src/canonical-json";
import { computeCredentialHash, generateSalt, type CredentialPayload, type Hex } from "../src/credential-hash";

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
```

Append at the end of the file:

```ts
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
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -w @not/credential-core`
Expected: FAIL, cannot resolve `../src/credential-hash`.

- [ ] **Step 3: Implement**

`packages/credential-core/src/credential-hash.ts`:

```ts
import { hexlify, isHexString, keccak256, randomBytes, toUtf8Bytes } from "ethers";
import { canonicalJson } from "./canonical-json";

export type Hex = `0x${string}`;

/** What gets hashed. NEVER put national ID, phone or email here. */
export interface CredentialPayload {
  schema: "not.credential.v1";
  credentialId: string;
  institution: { id: string; name: string; issuerAddress: string };
  student: { fullName: string; studentNumber: string };
  award: {
    title: string;
    type: "DEGREE" | "DIPLOMA" | "CERTIFICATE" | "TRANSCRIPT";
    graduationDate: string; // YYYY-MM-DD
    gpa?: string; // string, not number: avoids float formatting differences between runtimes
    honors?: string;
  };
  issuedAt: string; // ISO 8601, UTC
}

/** 32 random bytes. Stored in the DB and printed in the QR, never on-chain. */
export function generateSalt(): Hex {
  return hexlify(randomBytes(32)) as Hex;
}

/**
 * credentialHash = keccak256( canonicalJson({ v: 1, salt, payload }) )
 * The salt stops anyone from guessing a hash by trying common names/degrees.
 */
export function computeCredentialHash(payload: CredentialPayload, salt: Hex): Hex {
  if (!isHexString(salt, 32)) throw new TypeError("salt must be a 32-byte hex string");
  return keccak256(toUtf8Bytes(canonicalJson({ v: 1, salt, payload }))) as Hex;
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npm test -w @not/credential-core`
Expected: `Tests  8 passed (8)`. If the frozen-vector test fails, do NOT edit the expected value: check that versions match Global Constraints and that the payload in the test is byte-identical to this plan.

- [ ] **Step 5: Commit**

```bash
git add packages/credential-core
git commit -m "feat(credential-core): add credential hash with salt and frozen test vector"
```

---

### Task 4: Merkle batch + public exports

**Files:**
- Create: `packages/credential-core/src/merkle-batch.ts`, `packages/credential-core/src/index.ts`
- Modify: `packages/credential-core/test/credential-core.test.ts` (final version)

**Interfaces:**
- Consumes: `Hex` (Task 3).
- Produces: `interface Batch { root: Hex; size: number; proofs: Record<Hex, Hex[]> }`, `buildBatch(credentialHashes: Hex[]): Batch` (throws `RangeError` on empty or duplicate, `TypeError` on malformed), `verifyProofLocally(root: Hex, credentialHash: Hex, proof: Hex[]): boolean`. Package entry `@not/credential-core` re-exports everything.

- [ ] **Step 1: Write the failing tests**

Replace the whole test file with its final version:

```ts
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
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -w @not/credential-core`
Expected: FAIL, cannot resolve `../src` (no `index.ts`).

- [ ] **Step 3: Implement**

`packages/credential-core/src/merkle-batch.ts`:

```ts
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { isHexString } from "ethers";
import type { Hex } from "./credential-hash";

export interface Batch {
  root: Hex;
  size: number;
  /** proofs[credentialHash] = Merkle proof to send to CredentialRegistry.verify / revoke */
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

/** Pure off-chain check that a hash belongs to a root. The chain is still the source of truth. */
export function verifyProofLocally(root: Hex, credentialHash: Hex, proof: Hex[]): boolean {
  return StandardMerkleTree.verify(root, LEAF_ENCODING, [credentialHash], proof);
}
```

`packages/credential-core/src/index.ts`:

```ts
export { canonicalJson } from "./canonical-json";
export { computeCredentialHash, generateSalt } from "./credential-hash";
export type { CredentialPayload, Hex } from "./credential-hash";
export { buildBatch, verifyProofLocally } from "./merkle-batch";
export type { Batch } from "./merkle-batch";
```

- [ ] **Step 4: Run to see it pass, then build**

Run: `npm test -w @not/credential-core`
Expected: `Tests  11 passed (11)`

Run: `npm run build -w @not/credential-core && ls packages/credential-core/dist`
Expected: `index.js`, `index.d.ts` and the three module files with `.d.ts`.

- [ ] **Step 5: Commit**

```bash
git add packages/credential-core
git commit -m "feat(credential-core): add Merkle batch builder and local proof check"
```

---

### Task 5: contracts package + admin, institutions and signers, anchorBatch, pause

**Files:**
- Create: `packages/contracts/package.json`, `packages/contracts/hardhat.config.js`
- Create: `packages/contracts/contracts/CredentialRegistry.sol` (first version)
- Test: `packages/contracts/test/CredentialRegistry.test.js` (first version)
- Modify: root `package.json` (add workspace)

**Interfaces:**
- Produces (Solidity): constructor `(address admin)` reverting `InvalidAdmin()` on zero; `registerInstitution(bytes32 institutionId)`, `suspendInstitution(bytes32)`, `reinstateInstitution(bytes32)`, `addSigner(bytes32 institutionId, address signer)`, `removeSigner(address signer)` (all `DEFAULT_ADMIN_ROLE`); `institutionState(bytes32) returns (InstitutionState{NONE, ACTIVE, SUSPENDED})`; `institutionOf(address) returns (bytes32)`; `anchorBatch(bytes32 root, uint32 size)` for signers of an active institution; `getBatch(bytes32 institutionId, bytes32 root) returns (Batch{uint64 anchoredAt; uint32 size; address signer})`; `pause()`, `unpause()`; events `InstitutionRegistered`, `InstitutionSuspended`, `InstitutionReinstated`, `SignerAdded(bytes32 indexed institutionId, address indexed signer)`, `SignerRemoved(...)`, `BatchAnchored(bytes32 indexed institutionId, bytes32 indexed root, address indexed signer, uint32 size)`; errors `InvalidAdmin`, `InvalidInstitution`, `InstitutionAlreadyRegistered`, `UnknownInstitution`, `InvalidSigner`, `SignerAlreadyAssigned`, `NotASigner`, `InstitutionNotActive`, `InvalidRoot`, `InvalidSize`, `BatchAlreadyAnchored`. On-chain institution id = `keccak256(utf8(payload.institution.id))` (ADR 0002).

- [ ] **Step 1: Package files**

Root `package.json`: change the workspaces line to

```json
  "workspaces": ["packages/credential-core", "packages/contracts"],
```

`packages/contracts/package.json`:

```json
{
  "name": "@not/contracts",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "compile": "hardhat compile",
    "test": "hardhat test",
    "node": "hardhat node",
    "deploy:local": "hardhat run scripts/deploy.js --network localhost",
    "deploy:sepolia": "hardhat run scripts/deploy.js --network sepolia"
  },
  "devDependencies": {
    "@not/credential-core": "0.1.0",
    "@nomicfoundation/hardhat-toolbox": "6.1.2",
    "@openzeppelin/contracts": "5.6.1",
    "@openzeppelin/merkle-tree": "1.0.8",
    "dotenv": "16.6.1",
    "hardhat": "2.29.1"
  }
}
```

`packages/contracts/hardhat.config.js`:

```js
require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const { SEPOLIA_RPC_URL, DEPLOYER_PRIVATE_KEY } = process.env;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: "cancun" },
  },
  networks: {
    hardhat: { chainId: 31337 },
    localhost: { url: "http://127.0.0.1:8545", chainId: 31337 },
    ...(SEPOLIA_RPC_URL && DEPLOYER_PRIVATE_KEY
      ? { sepolia: { url: SEPOLIA_RPC_URL, accounts: [DEPLOYER_PRIVATE_KEY], chainId: 11155111 } }
      : {}),
  },
};
```

Run: `npm install` (repo root)
Expected: no `ERESOLVE` errors; `ls node_modules/@not` shows `contracts` and `credential-core`.

- [ ] **Step 2: Write the failing test**

`packages/contracts/test/CredentialRegistry.test.js`:

```js
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
```

- [ ] **Step 3: Run to see it fail**

Run: `npm test -w @not/contracts`
Expected: FAIL, `HH700: Artifact for contract "CredentialRegistry" not found`.

- [ ] **Step 4: Implement**

`packages/contracts/contracts/CredentialRegistry.sol`:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";

/// @title CredentialRegistry
/// @notice Anchors Merkle roots of credential hashes.
/// @dev Stores NO personal data. An institution has a stable id (keccak256 of its platform id) and a set
///      of signer wallets that can change over time (ADR 0002). Batches and revocations are keyed by
///      institution id, so wallet rotation keeps old credentials valid and revocable, and nobody can
///      front-run another institution's root (ADR 0001).
contract CredentialRegistry is AccessControl, Pausable {
    enum InstitutionState {
        NONE,
        ACTIVE,
        SUSPENDED
    }

    struct Batch {
        uint64 anchoredAt;
        uint32 size;
        address signer;
    }

    mapping(bytes32 institutionId => InstitutionState) private _institutions;
    mapping(address signer => bytes32 institutionId) private _institutionOf;
    mapping(bytes32 institutionId => mapping(bytes32 root => Batch)) private _batches;

    event InstitutionRegistered(bytes32 indexed institutionId);
    event InstitutionSuspended(bytes32 indexed institutionId);
    event InstitutionReinstated(bytes32 indexed institutionId);
    event SignerAdded(bytes32 indexed institutionId, address indexed signer);
    event SignerRemoved(bytes32 indexed institutionId, address indexed signer);
    event BatchAnchored(bytes32 indexed institutionId, bytes32 indexed root, address indexed signer, uint32 size);
    error InvalidAdmin();
    error InvalidInstitution();
    error InstitutionAlreadyRegistered(bytes32 institutionId);
    error UnknownInstitution(bytes32 institutionId);
    error InvalidSigner();
    error SignerAlreadyAssigned(address signer);
    error NotASigner(address account);
    error InstitutionNotActive(bytes32 institutionId);
    error InvalidRoot();
    error InvalidSize();
    error BatchAlreadyAnchored(bytes32 root);

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Emergency stop for anchoring.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Accredit an institution. `institutionId` = keccak256 of its platform id.
    function registerInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (institutionId == bytes32(0)) revert InvalidInstitution();
        if (_institutions[institutionId] != InstitutionState.NONE) revert InstitutionAlreadyRegistered(institutionId);
        _institutions[institutionId] = InstitutionState.ACTIVE;
        emit InstitutionRegistered(institutionId);
    }

    /// @notice Withdraw accreditation: no new batches or revocations; old credentials stay VALID with a warning.
    function suspendInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
        _institutions[institutionId] = InstitutionState.SUSPENDED;
        emit InstitutionSuspended(institutionId);
    }

    function reinstateInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.SUSPENDED) revert UnknownInstitution(institutionId);
        _institutions[institutionId] = InstitutionState.ACTIVE;
        emit InstitutionReinstated(institutionId);
    }

    /// @notice Authorize a wallet to sign for an institution. A wallet belongs to at most one institution.
    function addSigner(bytes32 institutionId, address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] == InstitutionState.NONE) revert UnknownInstitution(institutionId);
        if (signer == address(0)) revert InvalidSigner();
        if (_institutionOf[signer] != bytes32(0)) revert SignerAlreadyAssigned(signer);
        _institutionOf[signer] = institutionId;
        emit SignerAdded(institutionId, signer);
    }

    /// @notice Remove a wallet (staff change, lost or stolen key). Past batches are unaffected.
    function removeSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        delete _institutionOf[signer];
        emit SignerRemoved(institutionId, signer);
    }

    /// @notice Anchor one batch (1..N credentials) for the caller's institution with a single transaction.
    function anchorBatch(bytes32 root, uint32 size) external whenNotPaused {
        bytes32 institutionId = _activeInstitutionOf(msg.sender);
        if (root == bytes32(0)) revert InvalidRoot();
        if (size == 0) revert InvalidSize();
        if (_batches[institutionId][root].anchoredAt != 0) revert BatchAlreadyAnchored(root);

        _batches[institutionId][root] = Batch({anchoredAt: uint64(block.timestamp), size: size, signer: msg.sender});
        emit BatchAnchored(institutionId, root, msg.sender, size);
    }

    function institutionState(bytes32 institutionId) external view returns (InstitutionState) {
        return _institutions[institutionId];
    }

    function institutionOf(address signer) external view returns (bytes32) {
        return _institutionOf[signer];
    }

    function getBatch(bytes32 institutionId, bytes32 root) external view returns (Batch memory) {
        return _batches[institutionId][root];
    }

    function _activeInstitutionOf(address signer) private view returns (bytes32 institutionId) {
        institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
    }
}
```

- [ ] **Step 5: Run to see it pass**

Run: `npm test -w @not/contracts`
Expected: `11 passing`

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json packages/contracts
git commit -m "feat(contracts): add CredentialRegistry with institutions, signers, anchorBatch and pause"
```

---

### Task 6: verify and revoke

Batches and revocations are keyed by `(institutionId, root)`, so nobody can block or hijack another institution's batch by anchoring its root first (ADR 0001), and a university can change wallets without losing the ability to revoke old credentials (ADR 0002). If Task 5 was already committed with an older contract shape, this task's full-file replacement of the contract and the test file replaces it too.

**Files:**
- Modify: `packages/contracts/contracts/CredentialRegistry.sol` (final version)
- Modify: `packages/contracts/test/CredentialRegistry.test.js` (final version)

**Interfaces:**
- Consumes: everything from Task 5.
- Produces (Solidity): `enum Status { UNKNOWN, VALID, REVOKED }`, `verify(bytes32 institutionId, bytes32 root, bytes32 credentialHash, bytes32[] proof) returns (VerificationResult{Status status; bool institutionActive; uint64 anchoredAt; address signer; uint64 revokedAt; uint8 reason})` where `institutionId` is always derived from `payload.institution.id`, `revoke(bytes32 root, bytes32 credentialHash, bytes32[] proof, uint8 reason)` for any current signer of the institution that anchored the root, `leafOf(bytes32) returns (bytes32)`, event `CredentialRevoked(bytes32 indexed institutionId, bytes32 indexed root, bytes32 indexed credentialHash, address signer, uint8 reason)`, errors `InvalidReason()`, `UnknownBatch(bytes32)`, `NotInBatch()`, `AlreadyRevoked()`. Reason codes: 1 issued in error, 2 fraud, 3 superseded, 4 other.

- [ ] **Step 1: Write the failing tests**

Replace `packages/contracts/test/CredentialRegistry.test.js` with:

```js
const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");
const { StandardMerkleTree } = require("@openzeppelin/merkle-tree");

const Status = { UNKNOWN: 0n, VALID: 1n, REVOKED: 2n };
const State = { NONE: 0n, ACTIVE: 1n, SUSPENDED: 2n };
const Reason = { ISSUED_IN_ERROR: 1, FRAUD: 2, SUPERSEDED: 3, OTHER: 4 };
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
      await registry.connect(admin).unpause();
      await registry.connect(signerA).anchorBatch(fakeHash("r2"), 1);
    });
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `npm test -w @not/contracts`
Expected: `9 passing`, `13 failing` (`registry.verify is not a function`, `registry.revoke is not a function`).

- [ ] **Step 3: Implement**

Replace `packages/contracts/contracts/CredentialRegistry.sol` with:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";

/// @title CredentialRegistry
/// @notice Anchors Merkle roots of credential hashes and records revocations.
/// @dev Stores NO personal data. An institution has a stable id (keccak256 of its platform id) and a set
///      of signer wallets that can change over time (ADR 0002). Batches and revocations are keyed by
///      institution id, so wallet rotation keeps old credentials valid and revocable, and nobody can
///      front-run another institution's root (ADR 0001).
///      Leaf format matches the OpenZeppelin merkle-tree JS library (StandardMerkleTree, ["bytes32"]):
///      leaf = keccak256(bytes.concat(keccak256(abi.encode(credentialHash))))
contract CredentialRegistry is AccessControl, Pausable {
    enum InstitutionState {
        NONE,
        ACTIVE,
        SUSPENDED
    }

    enum Status {
        UNKNOWN,
        VALID,
        REVOKED
    }

    struct Batch {
        uint64 anchoredAt;
        uint32 size;
        address signer;
    }

    struct Revocation {
        uint64 revokedAt;
        uint8 reason;
        address signer;
    }

    struct VerificationResult {
        Status status;
        bool institutionActive;
        uint64 anchoredAt;
        address signer;
        uint64 revokedAt;
        uint8 reason;
    }

    mapping(bytes32 institutionId => InstitutionState) private _institutions;
    mapping(address signer => bytes32 institutionId) private _institutionOf;
    mapping(bytes32 institutionId => mapping(bytes32 root => Batch)) private _batches;
    mapping(bytes32 key => Revocation) private _revocations;

    event InstitutionRegistered(bytes32 indexed institutionId);
    event InstitutionSuspended(bytes32 indexed institutionId);
    event InstitutionReinstated(bytes32 indexed institutionId);
    event SignerAdded(bytes32 indexed institutionId, address indexed signer);
    event SignerRemoved(bytes32 indexed institutionId, address indexed signer);
    event BatchAnchored(bytes32 indexed institutionId, bytes32 indexed root, address indexed signer, uint32 size);
    event CredentialRevoked(
        bytes32 indexed institutionId,
        bytes32 indexed root,
        bytes32 indexed credentialHash,
        address signer,
        uint8 reason
    );

    error InvalidAdmin();
    error InvalidInstitution();
    error InstitutionAlreadyRegistered(bytes32 institutionId);
    error UnknownInstitution(bytes32 institutionId);
    error InvalidSigner();
    error SignerAlreadyAssigned(address signer);
    error NotASigner(address account);
    error InstitutionNotActive(bytes32 institutionId);
    error InvalidRoot();
    error InvalidSize();
    error InvalidReason();
    error BatchAlreadyAnchored(bytes32 root);
    error UnknownBatch(bytes32 root);
    error NotInBatch();
    error AlreadyRevoked();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAdmin();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Emergency stop for anchoring and revoking; verification keeps working.
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }

    /// @notice Accredit an institution. `institutionId` = keccak256 of its platform id.
    function registerInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (institutionId == bytes32(0)) revert InvalidInstitution();
        if (_institutions[institutionId] != InstitutionState.NONE) revert InstitutionAlreadyRegistered(institutionId);
        _institutions[institutionId] = InstitutionState.ACTIVE;
        emit InstitutionRegistered(institutionId);
    }

    /// @notice Withdraw accreditation: no new batches or revocations; old credentials stay VALID with a warning.
    function suspendInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
        _institutions[institutionId] = InstitutionState.SUSPENDED;
        emit InstitutionSuspended(institutionId);
    }

    function reinstateInstitution(bytes32 institutionId) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] != InstitutionState.SUSPENDED) revert UnknownInstitution(institutionId);
        _institutions[institutionId] = InstitutionState.ACTIVE;
        emit InstitutionReinstated(institutionId);
    }

    /// @notice Authorize a wallet to sign for an institution. A wallet belongs to at most one institution.
    function addSigner(bytes32 institutionId, address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        if (_institutions[institutionId] == InstitutionState.NONE) revert UnknownInstitution(institutionId);
        if (signer == address(0)) revert InvalidSigner();
        if (_institutionOf[signer] != bytes32(0)) revert SignerAlreadyAssigned(signer);
        _institutionOf[signer] = institutionId;
        emit SignerAdded(institutionId, signer);
    }

    /// @notice Remove a wallet (staff change, lost or stolen key). Past batches are unaffected.
    function removeSigner(address signer) external onlyRole(DEFAULT_ADMIN_ROLE) {
        bytes32 institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        delete _institutionOf[signer];
        emit SignerRemoved(institutionId, signer);
    }

    /// @notice Anchor one batch (1..N credentials) for the caller's institution with a single transaction.
    function anchorBatch(bytes32 root, uint32 size) external whenNotPaused {
        bytes32 institutionId = _activeInstitutionOf(msg.sender);
        if (root == bytes32(0)) revert InvalidRoot();
        if (size == 0) revert InvalidSize();
        if (_batches[institutionId][root].anchoredAt != 0) revert BatchAlreadyAnchored(root);

        _batches[institutionId][root] = Batch({anchoredAt: uint64(block.timestamp), size: size, signer: msg.sender});
        emit BatchAnchored(institutionId, root, msg.sender, size);
    }

    /// @notice Revoke one credential of the caller's institution, including batches signed by its former wallets.
    /// @param reason 1 = issued in error, 2 = fraud, 3 = superseded, 4 = other. 0 is invalid.
    function revoke(
        bytes32 root,
        bytes32 credentialHash,
        bytes32[] calldata proof,
        uint8 reason
    ) external whenNotPaused {
        bytes32 institutionId = _activeInstitutionOf(msg.sender);
        if (reason == 0) revert InvalidReason();
        if (_batches[institutionId][root].anchoredAt == 0) revert UnknownBatch(root);
        if (!MerkleProof.verifyCalldata(proof, root, leafOf(credentialHash))) revert NotInBatch();

        bytes32 key = _revocationKey(institutionId, root, credentialHash);
        if (_revocations[key].revokedAt != 0) revert AlreadyRevoked();

        _revocations[key] = Revocation({revokedAt: uint64(block.timestamp), reason: reason, signer: msg.sender});
        emit CredentialRevoked(institutionId, root, credentialHash, msg.sender, reason);
    }

    /// @notice Anyone can call this, even while paused. `institutionId` must be derived from the credential payload.
    function verify(
        bytes32 institutionId,
        bytes32 root,
        bytes32 credentialHash,
        bytes32[] calldata proof
    ) external view returns (VerificationResult memory result) {
        Batch memory batch = _batches[institutionId][root];
        if (batch.anchoredAt == 0) return result; // UNKNOWN
        if (!MerkleProof.verifyCalldata(proof, root, leafOf(credentialHash))) return result; // UNKNOWN

        Revocation memory rev = _revocations[_revocationKey(institutionId, root, credentialHash)];
        result.institutionActive = _institutions[institutionId] == InstitutionState.ACTIVE;
        result.anchoredAt = batch.anchoredAt;
        result.signer = batch.signer;
        result.revokedAt = rev.revokedAt;
        result.reason = rev.reason;
        result.status = rev.revokedAt == 0 ? Status.VALID : Status.REVOKED;
    }

    function institutionState(bytes32 institutionId) external view returns (InstitutionState) {
        return _institutions[institutionId];
    }

    function institutionOf(address signer) external view returns (bytes32) {
        return _institutionOf[signer];
    }

    function getBatch(bytes32 institutionId, bytes32 root) external view returns (Batch memory) {
        return _batches[institutionId][root];
    }

    function leafOf(bytes32 credentialHash) public pure returns (bytes32) {
        return keccak256(bytes.concat(keccak256(abi.encode(credentialHash))));
    }

    function _activeInstitutionOf(address signer) private view returns (bytes32 institutionId) {
        institutionId = _institutionOf[signer];
        if (institutionId == bytes32(0)) revert NotASigner(signer);
        if (_institutions[institutionId] != InstitutionState.ACTIVE) revert InstitutionNotActive(institutionId);
    }

    function _revocationKey(bytes32 institutionId, bytes32 root, bytes32 credentialHash)
        private
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(institutionId, root, credentialHash));
    }
}
```

- [ ] **Step 4: Run to see it pass**

Run: `npm test -w @not/contracts`
Expected: `22 passing`

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add verify and revoke scoped to the anchoring institution"
```

---

### Task 7: Integration test + deploy script

**Files:**
- Test: `packages/contracts/test/integration.credential-core.test.js`
- Create: `packages/contracts/scripts/deploy.js`, `packages/contracts/.env.example`

**Interfaces:**
- Consumes: `@not/credential-core` (`computeCredentialHash`, `generateSalt`, `buildBatch`) and the final contract.
- Produces: `deployments/<network>.json` with `{ network, chainId, address, admin, deployer, blockNumber, txHash, deployedAt }`. Phase 2 reads `address`, `chainId` and `blockNumber` (listener start block) from this file.

- [ ] **Step 1: Write the integration test**

`packages/contracts/test/integration.credential-core.test.js`:

```js
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
```

- [ ] **Step 2: Run it**

Run: `npm test` (repo root, builds credential-core first)
Expected: credential-core `Tests  11 passed (11)`; contracts `23 passing`.

If it fails with `Cannot find module '@not/credential-core'`: run `npm install` at the root, then `npm run build -w @not/credential-core`.

- [ ] **Step 3: Deploy script and env example**

`packages/contracts/scripts/deploy.js`:

```js
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
```

`packages/contracts/.env.example`:

```
# Get an RPC URL from any Sepolia provider (Alchemy, Infura, ...).
SEPOLIA_RPC_URL=
# Private key of a TEST wallet funded from a Sepolia faucet. Never a real wallet.
DEPLOYER_PRIVATE_KEY=
# Optional: address that receives DEFAULT_ADMIN_ROLE (defaults to the deployer).
REGISTRY_ADMIN=
```

- [ ] **Step 4: Deploy to a local node**

Terminal 1: `cd packages/contracts && npx hardhat node`
Terminal 2: `npm run deploy:local -w @not/contracts`
Expected: `CredentialRegistry deployed to 0x5FbDB2315678afecb367f032d93F642f64180aa3 on localhost (chainId 31337)` and `Saved deployments/localhost.json` (git-ignored).

- [ ] **Step 5: Commit**

```bash
git add packages/contracts
git commit -m "feat(contracts): add credential-core integration test and deploy script"
```

---

### Task 8: CI + README

**Files:**
- Create: `.github/workflows/ci.yml`, `README.md`

- [ ] **Step 1: CI workflow**

`.github/workflows/ci.yml`:

```yaml
name: CI
on:
  push:
    branches: [main]
  pull_request:
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: .nvmrc
          cache: npm
      - run: npm ci
      - run: npm test
```

- [ ] **Step 2: README**

`README.md`:

````markdown
# Network of Trust (NoT) v2

Academic management platform with blockchain-anchored, privacy-preserving credentials.

- Architecture: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- Roadmap: [docs/ROADMAP.md](docs/ROADMAP.md)
- Why v2: [docs/reviews/2026-09-28-v1-review.md](docs/reviews/2026-09-28-v1-review.md)
- v1 code (reference only): [legacy/](legacy/)

## Quick start

```bash
nvm use            # Node 22
npm ci
npm test           # builds and tests all packages
```

## Packages

| Package | What |
|---|---|
| `packages/credential-core` | Canonical JSON, credential hash, Merkle batches (shared by API and web) |
| `packages/contracts` | `CredentialRegistry` smart contract, tests, deploy script |
````

- [ ] **Step 3: Verify from a clean clone**

```bash
rm -rf node_modules packages/*/node_modules packages/*/dist packages/contracts/artifacts packages/contracts/cache
npm ci && npm test
```

Expected: `Tests  11 passed (11)` and `23 passing`.

- [ ] **Step 4: Commit and open a PR**

```bash
git add .github README.md
git commit -m "ci: run build and tests on push and PR; add v2 README"
git push -u origin v2/phase-0-1
```

Open a PR to `main`. CI must be green before merging.

---

### Task 9: Deploy to Sepolia (manual, needs a human)

- [ ] **Step 1:** Create a NEW MetaMask account used only for this project. Get Sepolia test ETH from a faucet (search "Sepolia faucet"; some require a small mainnet balance or a login).
- [ ] **Step 2:** Get a Sepolia RPC URL from any provider (Alchemy, Infura, or another).
- [ ] **Step 3:** `cp packages/contracts/.env.example packages/contracts/.env`, fill `SEPOLIA_RPC_URL` and `DEPLOYER_PRIVATE_KEY` (the test account's key). Leave `REGISTRY_ADMIN` empty unless the admin should be a different address.
- [ ] **Step 4:** `npm run deploy:sepolia -w @not/contracts`
  Expected: `CredentialRegistry deployed to 0x... on sepolia (chainId 11155111)`.
- [ ] **Step 5:** Open the address on `https://sepolia.etherscan.io` and confirm the contract creation transaction.
- [ ] **Step 6:** Commit the deployment record (never the `.env`):

```bash
git add packages/contracts/deployments/sepolia.json
git commit -m "chore(contracts): record Sepolia deployment"
```

---

## Self-review (done by the plan author)

- Spec coverage: ARCHITECTURE sections 2 (rules 1, 4), 5 (payload, hash, salt, leaf), 6 (every function and design decision) map to Tasks 2 to 7. ROADMAP Phase 0 maps to Tasks 1 and 8, Phase 1 to Tasks 2 to 7 and 9.
- Every code block above was executed in a dry run on a copy of the repo: credential-core 11 tests, contracts 11 (Task 5) then 22 (Task 6) then 23 with integration, local deploy OK.
- Names are consistent: `computeCredentialHash`, `buildBatch`, `verifyProofLocally`, `anchorBatch`, `revoke`, `verify`, `leafOf`, `registerInstitution`, `addSigner`, `removeSigner`, `institutionId`.
