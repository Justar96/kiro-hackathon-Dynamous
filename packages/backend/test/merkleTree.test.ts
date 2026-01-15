import { describe, test, expect } from "bun:test";
import { MerkleTree } from "../src/services/merkleTree";

describe("MerkleTree", () => {
  test("should create tree with single entry", () => {
    const entries = [{ address: "0x1234567890123456789012345678901234567890", amount: 100n }];
    const tree = new MerkleTree(entries);
    
    expect(tree.getRoot()).toBeDefined();
    expect(tree.getRoot().length).toBe(66); // 0x + 64 hex chars
  });

  test("should create tree with multiple entries", () => {
    const entries = [
      { address: "0x1111111111111111111111111111111111111111", amount: 100n },
      { address: "0x2222222222222222222222222222222222222222", amount: 200n },
      { address: "0x3333333333333333333333333333333333333333", amount: 300n },
    ];
    const tree = new MerkleTree(entries);
    
    expect(tree.getRoot()).toBeDefined();
  });

  test("should generate valid proof", () => {
    const entries = [
      { address: "0x1111111111111111111111111111111111111111", amount: 100n },
      { address: "0x2222222222222222222222222222222222222222", amount: 200n },
    ];
    const tree = new MerkleTree(entries);
    
    const { leaf, proof, root } = tree.getProof(entries[0].address, entries[0].amount);
    
    expect(leaf).toBeDefined();
    expect(proof).toBeArray();
    expect(root).toBe(tree.getRoot());
  });

  test("should verify valid proof", () => {
    const entries = [
      { address: "0x1111111111111111111111111111111111111111", amount: 100n },
      { address: "0x2222222222222222222222222222222222222222", amount: 200n },
      { address: "0x3333333333333333333333333333333333333333", amount: 300n },
      { address: "0x4444444444444444444444444444444444444444", amount: 400n },
    ];
    const tree = new MerkleTree(entries);
    
    for (const entry of entries) {
      const { leaf, proof, root } = tree.getProof(entry.address, entry.amount);
      const isValid = MerkleTree.verify(proof, root, leaf);
      expect(isValid).toBe(true);
    }
  });

  test("should reject invalid proof", () => {
    const entries = [
      { address: "0x1111111111111111111111111111111111111111", amount: 100n },
      { address: "0x2222222222222222222222222222222222222222", amount: 200n },
    ];
    const tree = new MerkleTree(entries);
    
    const { proof, root } = tree.getProof(entries[0].address, entries[0].amount);
    
    // Try to verify with wrong amount
    const { leaf: wrongLeaf } = tree.getProof(entries[1].address, entries[1].amount);
    const isValid = MerkleTree.verify(proof, root, wrongLeaf);
    
    expect(isValid).toBe(false);
  });

  test("should throw for non-existent leaf", () => {
    const entries = [{ address: "0x1111111111111111111111111111111111111111", amount: 100n }];
    const tree = new MerkleTree(entries);
    
    expect(() => {
      tree.getProof("0x9999999999999999999999999999999999999999", 999n);
    }).toThrow("Leaf not found");
  });
});
