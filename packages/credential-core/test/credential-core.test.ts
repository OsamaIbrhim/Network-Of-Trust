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
