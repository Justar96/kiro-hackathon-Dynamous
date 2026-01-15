import { ethers } from "ethers";
import type { SignedOrder } from "../types";

const ORDER_TYPEHASH = ethers.keccak256(
  ethers.toUtf8Bytes(
    "Order(uint256 salt,address maker,address signer,address taker,bytes32 marketId,uint256 tokenId,uint8 side,uint256 makerAmount,uint256 takerAmount,uint256 expiration,uint256 nonce,uint256 feeRateBps,uint8 sigType)"
  )
);

export class OrderSigner {
  private domainSeparator: string;

  constructor(
    private chainId: number,
    private exchangeAddress: string
  ) {
    this.domainSeparator = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["bytes32", "bytes32", "bytes32", "uint256", "address"],
        [
          ethers.keccak256(
            ethers.toUtf8Bytes(
              "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
            )
          ),
          ethers.keccak256(ethers.toUtf8Bytes("CTFExchange")),
          ethers.keccak256(ethers.toUtf8Bytes("1")),
          chainId,
          exchangeAddress,
        ]
      )
    );
  }

  hashOrder(order: SignedOrder): string {
    const structHash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "bytes32",
          "uint256",
          "address",
          "address",
          "address",
          "bytes32",
          "uint256",
          "uint8",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint256",
          "uint8",
        ],
        [
          ORDER_TYPEHASH,
          order.salt,
          order.maker,
          order.signer,
          order.taker,
          order.marketId,
          order.tokenId,
          order.side,
          order.makerAmount,
          order.takerAmount,
          order.expiration,
          order.nonce,
          order.feeRateBps,
          order.sigType,
        ]
      )
    );

    return ethers.keccak256(
      ethers.solidityPacked(
        ["string", "bytes32", "bytes32"],
        ["\x19\x01", this.domainSeparator, structHash]
      )
    );
  }

  async signOrder(
    order: Omit<SignedOrder, "signature">,
    signer: ethers.Signer
  ): Promise<SignedOrder> {
    const orderHash = this.hashOrder({ ...order, signature: "0x" });
    const signature = await signer.signMessage(ethers.getBytes(orderHash));
    return { ...order, signature };
  }

  verifySignature(order: SignedOrder): boolean {
    const orderHash = this.hashOrder(order);
    try {
      const recovered = ethers.verifyMessage(
        ethers.getBytes(orderHash),
        order.signature
      );
      return (
        recovered.toLowerCase() === order.signer.toLowerCase() &&
        order.signer.toLowerCase() === order.maker.toLowerCase()
      );
    } catch {
      return false;
    }
  }
}
