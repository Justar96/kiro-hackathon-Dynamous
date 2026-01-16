import { ethers } from "ethers";
import type { SignedOrder } from "../types";

/**
 * EIP-712 Order Signer and Verifier
 * 
 * Handles signing and verification of orders using EIP-712 typed data.
 * The order structure matches the CTFExchange contract's expected format.
 */

// EIP-712 Domain type hash
const DOMAIN_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
  )
);

// Order type hash - must match the frontend's ORDER_TYPES
const ORDER_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "Order(uint256 salt,address maker,address signer,address taker,uint256 tokenId,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 side,uint8 signatureType)"
  )
);

export class OrderSigner {
  private domainSeparator: string;

  constructor(
    private chainId: number,
    private exchangeAddress: string
  ) {
    // Compute EIP-712 domain separator
    this.domainSeparator = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          DOMAIN_TYPEHASH,
          ethers.keccak256(ethers.toUtf8Bytes("CTFExchange")),
          ethers.keccak256(ethers.toUtf8Bytes("1")),
          chainId,
          exchangeAddress,
        ]
      )
    );
  }

  /**
   * Compute the EIP-712 struct hash for an order
   */
  private computeStructHash(order: SignedOrder): string {
    return ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "bytes32",  // ORDER_TYPEHASH
          "uint256",  // salt
          "address",  // maker
          "address",  // signer
          "address",  // taker
          "uint256",  // tokenId
          "uint256",  // makerAmount
          "uint256",  // takerAmount
          "uint256",  // expiration
          "uint256",  // nonce
          "uint256",  // feeRateBps
          "uint8",    // side
          "uint8",    // signatureType
        ],
        [
          ORDER_TYPEHASH,
          order.salt,
          order.maker,
          order.signer,
          order.taker,
          order.tokenId,
          order.makerAmount,
          order.takerAmount,
          order.expiration,
          order.nonce,
          order.feeRateBps,
          order.side,
          order.sigType,
        ]
      )
    );
  }

  /**
   * Compute the EIP-712 hash of an order (the message that gets signed)
   */
  hashOrder(order: SignedOrder): string {
    const structHash = this.computeStructHash(order);

    // EIP-712: "\x19\x01" || domainSeparator || structHash
    // Use concat instead of solidityPacked for the prefix
    return ethers.keccak256(
      ethers.concat([
        "0x1901",
        this.domainSeparator,
        structHash,
      ])
    );
  }

  /**
   * Sign an order using EIP-712 typed data signing
   */
  async signOrder(
    order: Omit<SignedOrder, "signature">,
    signer: ethers.Signer
  ): Promise<SignedOrder> {
    // For backend signing, we use the typed data approach
    const domain = {
      name: "CTFExchange",
      version: "1",
      chainId: this.chainId,
      verifyingContract: this.exchangeAddress,
    };

    const types = {
      Order: [
        { name: "salt", type: "uint256" },
        { name: "maker", type: "address" },
        { name: "signer", type: "address" },
        { name: "taker", type: "address" },
        { name: "tokenId", type: "uint256" },
        { name: "makerAmount", type: "uint256" },
        { name: "takerAmount", type: "uint256" },
        { name: "expiration", type: "uint256" },
        { name: "nonce", type: "uint256" },
        { name: "feeRateBps", type: "uint256" },
        { name: "side", type: "uint8" },
        { name: "signatureType", type: "uint8" },
      ],
    };

    const message = {
      salt: order.salt,
      maker: order.maker,
      signer: order.signer,
      taker: order.taker,
      tokenId: order.tokenId,
      makerAmount: order.makerAmount,
      takerAmount: order.takerAmount,
      expiration: order.expiration,
      nonce: order.nonce,
      feeRateBps: order.feeRateBps,
      side: order.side,
      signatureType: order.sigType,
    };

    const signature = await (signer as ethers.Wallet).signTypedData(
      domain,
      types,
      message
    );

    return { ...order, signature };
  }

  /**
   * Verify an EIP-712 signature on an order
   * 
   * @param order - The signed order to verify
   * @returns true if the signature is valid and matches the signer
   */
  verifySignature(order: SignedOrder): boolean {
    try {
      // Compute the EIP-712 hash
      const orderHash = this.hashOrder(order);

      // Recover the signer from the signature
      // For EIP-712, we use recoverAddress with the digest directly
      const recovered = ethers.recoverAddress(orderHash, order.signature);

      // Verify the recovered address matches the order's signer
      // and that the signer is authorized (either maker or delegated signer)
      const signerMatches = recovered.toLowerCase() === order.signer.toLowerCase();
      const signerAuthorized = order.signer.toLowerCase() === order.maker.toLowerCase();

      return signerMatches && signerAuthorized;
    } catch (error) {
      // Invalid signature format or recovery failed
      console.error("[OrderSigner] Signature verification failed:", error);
      return false;
    }
  }

  /**
   * Get the domain separator for this signer
   */
  getDomainSeparator(): string {
    return this.domainSeparator;
  }
}
