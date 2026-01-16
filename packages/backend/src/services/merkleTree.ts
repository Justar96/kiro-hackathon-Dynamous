import { ethers } from "ethers";

interface BalanceEntry {
  address: string;
  amount: bigint;
}

interface MerkleProofResult {
  leaf: string;
  proof: string[];
  root: string;
}

export class MerkleTree {
  private leaves: string[];
  private layers: string[][];

  constructor(entries: BalanceEntry[]) {
    // Create leaves: keccak256(abi.encodePacked(address, amount))
    this.leaves = entries.map((e) =>
      ethers.keccak256(
        ethers.solidityPacked(["address", "uint256"], [e.address, e.amount])
      )
    );

    // Sort leaves for deterministic tree
    this.leaves.sort();

    // Build tree
    this.layers = [this.leaves];
    this.buildTree();
  }

  private buildTree(): void {
    let currentLayer = this.leaves;

    while (currentLayer.length > 1) {
      const nextLayer: string[] = [];

      for (let i = 0; i < currentLayer.length; i += 2) {
        const left = currentLayer[i];
        const right = currentLayer[i + 1] || left; // Duplicate if odd

        // Sort pair for consistent hashing
        const [first, second] = left < right ? [left, right] : [right, left];
        const parent = ethers.keccak256(
          ethers.solidityPacked(["bytes32", "bytes32"], [first, second])
        );
        nextLayer.push(parent);
      }

      this.layers.push(nextLayer);
      currentLayer = nextLayer;
    }
  }

  getRoot(): string {
    return this.layers[this.layers.length - 1][0] || ethers.ZeroHash;
  }

  getProof(address: string, amount: bigint): MerkleProofResult {
    const leaf = ethers.keccak256(
      ethers.solidityPacked(["address", "uint256"], [address, amount])
    );

    let index = this.leaves.indexOf(leaf);
    if (index === -1) {
      throw new Error("Leaf not found in tree");
    }

    const proof: string[] = [];

    for (let i = 0; i < this.layers.length - 1; i++) {
      const layer = this.layers[i];
      const isRight = index % 2 === 1;
      const siblingIndex = isRight ? index - 1 : index + 1;

      // If sibling exists, add it to proof
      // If sibling doesn't exist (odd layer), the node was paired with itself
      // In that case, we add the node itself as the sibling
      if (siblingIndex < layer.length) {
        proof.push(layer[siblingIndex]);
      } else {
        // Node was duplicated - add itself as sibling
        proof.push(layer[index]);
      }

      index = Math.floor(index / 2);
    }

    return { leaf, proof, root: this.getRoot() };
  }

  static verify(proof: string[], root: string, leaf: string): boolean {
    let hash = leaf;

    for (const sibling of proof) {
      const [first, second] = hash < sibling ? [hash, sibling] : [sibling, hash];
      hash = ethers.keccak256(
        ethers.solidityPacked(["bytes32", "bytes32"], [first, second])
      );
    }

    return hash === root;
  }
}
