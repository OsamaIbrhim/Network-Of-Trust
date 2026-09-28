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
    graduationDate: string;
    gpa?: string; // string, not number: avoids float formatting differences between runtimes
    honors?: string;
  };
  issuedAt: string;
}

/** 32 random bytes. Stored in the DB and printed in the QR, never on-chain. */
export function generateSalt(): Hex {
  return hexlify(randomBytes(32)) as Hex;
}

/** The salt stops anyone from guessing a hash by trying common names/degrees. */
export function computeCredentialHash(payload: CredentialPayload, salt: Hex): Hex {
  if (!isHexString(salt, 32)) throw new TypeError("salt must be a 32-byte hex string");
  return keccak256(toUtf8Bytes(canonicalJson({ v: 1, salt, payload }))) as Hex;
}
