/**
 * Property-Based Tests for Order Service
 * 
 * Feature: hybrid-clob-trading
 * 
 * These tests verify universal properties for order validation:
 * - Property 3: Signature Validation Correctness
 * - Property 4: Nonce Validation
 * - Property 5: Balance Sufficiency Check
 */

import { describe, test, expect } from "bun:test";
import * as fc from "fast-check";
import { ethers } from "ethers";
import { OrderService } from "../src/services/orderService";
import { OrderSigner } from "../src/services/orderSigner";
import { Ledger } from "../src/services/ledger";
import { MatchingEngine } from "../src/services/matchingEngine";
import { RiskEngine } from "../src/services/riskEngine";
import { Side, SignatureType, type SignedOrder } from "../src/types";

// Minimum 100 iterations per property test as per design doc
const NUM_RUNS = 100;

// Constants
const ONE = 10n ** 18n;
const CHAIN_ID = 137; // Polygon
const EXCHANGE_ADDRESS = "0x4bFb41d5B3570DeFd03C39a9A4D8dE6Bd8B8982E";

// Arbitraries for generating test data
const hexChar = fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f');
const marketIdArbitrary = fc.array(hexChar, { minLength: 64, maxLength: 64 }).map(chars => `0x${chars.join('')}`);
const tokenIdArbitrary = fc.bigInt({ min: 1n, max: 2n ** 64n - 1n });
const saltArbitrary = fc.bigInt({ min: 1n, max: 2n ** 128n - 1n });
const priceArbitrary = fc.integer({ min: 100, max: 9900 });
const amountArbitrary = fc.integer({ min: 100, max: 1000 }).map(n => BigInt(n) * ONE);

/**
 * Create a base order (without signature)
 */
function createBaseOrder(
  maker: string,
  marketId: string,
  tokenId: bigint,
  side: Side,
  price: number,
  amount: bigint,
  salt: bigint,
  nonce: bigint = 0n
): Omit<SignedOrder, "signature"> {
  let makerAmount: bigint;
  let takerAmount: bigint;
  
  if (side === Side.BUY) {
    takerAmount = amount;
    makerAmount = (BigInt(price) * amount) / 10000n;
  } else {
    makerAmount = amount;
    takerAmount = (BigInt(price) * amount) / 10000n;
  }
  
  return {
    salt,
    maker,
    signer: maker,
    taker: "0x0000000000000000000000000000000000000000",
    marketId,
    tokenId,
    side,
    makerAmount,
    takerAmount,
    expiration: 0n,
    nonce,
    feeRateBps: 0n,
    sigType: SignatureType.EOA,
  };
}

/**
 * Create a signed order using a wallet
 */
async function createSignedOrder(
  wallet: ethers.HDNodeWallet | ethers.Wallet,
  orderSigner: OrderSigner,
  marketId: string,
  tokenId: bigint,
  side: Side,
  price: number,
  amount: bigint,
  salt: bigint,
  nonce: bigint = 0n
): Promise<SignedOrder> {
  const baseOrder = createBaseOrder(
    wallet.address,
    marketId,
    tokenId,
    side,
    price,
    amount,
    salt,
    nonce
  );
  
  return orderSigner.signOrder(baseOrder, wallet as ethers.Signer);
}

/**
 * Create an order with an invalid signature
 */
function createOrderWithInvalidSignature(
  maker: string,
  marketId: string,
  tokenId: bigint,
  side: Side,
  price: number,
  amount: bigint,
  salt: bigint,
  nonce: bigint = 0n
): SignedOrder {
  const baseOrder = createBaseOrder(
    maker,
    marketId,
    tokenId,
    side,
    price,
    amount,
    salt,
    nonce
  );
  
  // Create an invalid signature (random bytes)
  return {
    ...baseOrder,
    signature: "0x" + "00".repeat(65),
  };
}

describe("Order Service Property Tests", () => {
  /**
   * Property 3: Signature Validation Correctness
   * 
   * For any signed order, the Order_Service SHALL accept the order if and only if
   * the signature was produced by the signer address using the correct EIP-712 
   * domain and order hash.
   * 
   * **Validates: Requirements 2.3**
   */
  describe("Property 3: Signature Validation Correctness", () => {
    test("valid signatures should be accepted", async () => {
      await fc.assert(
        fc.asyncProperty(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          async (marketId, tokenId, side, price, amount, salt) => {
            // Create a random wallet for signing
            const wallet = ethers.Wallet.createRandom();
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            const orderSigner = orderService.getOrderSigner();
            
            // Create and sign order
            const signedOrder = await createSignedOrder(
              wallet,
              orderSigner,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            // Verify signature validation passes
            // This should not throw
            expect(() => orderService.validateSignature(signedOrder)).not.toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("invalid signatures should be rejected", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          (marketId, tokenId, side, price, amount, salt) => {
            // Create a random address (not a real wallet)
            const fakeAddress = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create order with invalid signature
            const invalidOrder = createOrderWithInvalidSignature(
              fakeAddress,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            // Verify signature validation fails
            expect(() => orderService.validateSignature(invalidOrder)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("signature from wrong signer should be rejected", async () => {
      await fc.assert(
        fc.asyncProperty(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          async (marketId, tokenId, side, price, amount, salt) => {
            // Create two different wallets
            const wallet1 = ethers.Wallet.createRandom();
            const wallet2 = ethers.Wallet.createRandom();
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            const orderSigner = orderService.getOrderSigner();
            
            // Create order for wallet1 but sign with wallet2
            const baseOrder = createBaseOrder(
              wallet1.address, // maker is wallet1
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            // Sign with wallet2 (wrong signer)
            const signedOrder = await orderSigner.signOrder(
              { ...baseOrder, signer: wallet2.address },
              wallet2 as ethers.Signer
            );
            
            // Override maker to be wallet1 (mismatch)
            const tamperedOrder: SignedOrder = {
              ...signedOrder,
              maker: wallet1.address,
            };
            
            // Verify signature validation fails (signer != maker)
            expect(() => orderService.validateSignature(tamperedOrder)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("tampered order should be rejected", async () => {
      await fc.assert(
        fc.asyncProperty(
          marketIdArbitrary,
          tokenIdArbitrary,
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          async (marketId, tokenId, price, amount, salt) => {
            const wallet = ethers.Wallet.createRandom();
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            const orderSigner = orderService.getOrderSigner();
            
            // Create and sign a valid order
            const signedOrder = await createSignedOrder(
              wallet,
              orderSigner,
              marketId,
              tokenId,
              Side.BUY,
              price,
              amount,
              salt
            );
            
            // Tamper with the order (change amount)
            const tamperedOrder: SignedOrder = {
              ...signedOrder,
              makerAmount: signedOrder.makerAmount + 1n,
            };
            
            // Verify tampered order is rejected
            expect(() => orderService.validateSignature(tamperedOrder)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });


  /**
   * Property 4: Nonce Validation
   * 
   * For any order submission, the Order_Service SHALL accept the order if and only if
   * the order's nonce equals the user's current nonce in the Off_Chain_Ledger.
   * 
   * **Validates: Requirements 2.4, 11.2**
   */
  describe("Property 4: Nonce Validation", () => {
    test("order with correct nonce should be accepted", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          // Generate a nonce value
          fc.bigInt({ min: 0n, max: 100n }),
          (marketId, tokenId, side, price, amount, salt, nonce) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Set the user's nonce in ledger
            ledger.setNonce(maker, nonce);
            
            // Create order with matching nonce
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt,
              nonce // Same as ledger nonce
            );
            
            // Verify nonce validation passes
            expect(() => orderService.validateNonce(order)).not.toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("order with stale nonce (lower than current) should be rejected", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          // Current nonce must be > 0 to have a stale nonce
          fc.bigInt({ min: 1n, max: 100n }),
          (marketId, tokenId, side, price, amount, salt, currentNonce) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Set the user's nonce in ledger
            ledger.setNonce(maker, currentNonce);
            
            // Create order with stale nonce (lower than current)
            const staleNonce = currentNonce - 1n;
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt,
              staleNonce
            );
            
            // Verify nonce validation fails
            expect(() => orderService.validateNonce(order)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("order with future nonce (higher than current) should be rejected", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          fc.bigInt({ min: 0n, max: 100n }),
          (marketId, tokenId, side, price, amount, salt, currentNonce) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Set the user's nonce in ledger
            ledger.setNonce(maker, currentNonce);
            
            // Create order with future nonce (higher than current)
            const futureNonce = currentNonce + 1n;
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt,
              futureNonce
            );
            
            // Verify nonce validation fails
            expect(() => orderService.validateNonce(order)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("nonce validation is case-insensitive for addresses", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          fc.bigInt({ min: 0n, max: 100n }),
          (marketId, tokenId, side, price, amount, salt, nonce) => {
            // Create address with mixed case
            const lowerAddress = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            const upperAddress = lowerAddress.toUpperCase().replace('0X', '0x');
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Set nonce with lowercase address
            ledger.setNonce(lowerAddress, nonce);
            
            // Create order with uppercase address
            const order = createOrderWithInvalidSignature(
              upperAddress,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt,
              nonce
            );
            
            // Verify nonce validation passes (case-insensitive)
            expect(() => orderService.validateNonce(order)).not.toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });


  /**
   * Property 5: Balance Sufficiency Check
   * 
   * For any order submission, the Order_Service SHALL accept the order if and only if
   * the user's available balance (for the required token) is greater than or equal to
   * the order's makerAmount.
   * 
   * **Validates: Requirements 2.5**
   */
  describe("Property 5: Balance Sufficiency Check", () => {
    test("order with sufficient balance should be accepted", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          // Extra balance multiplier (1-10x the required amount)
          fc.integer({ min: 1, max: 10 }),
          (marketId, tokenId, side, price, amount, salt, multiplier) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create order to determine required amount
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            // Credit sufficient balance
            // For BUY: need collateral (tokenId = 0)
            // For SELL: need outcome tokens
            const requiredTokenId = side === Side.BUY ? 0n : tokenId;
            const requiredAmount = order.makerAmount;
            const creditAmount = requiredAmount * BigInt(multiplier);
            
            ledger.credit(maker, requiredTokenId, creditAmount);
            
            // Verify balance validation passes
            expect(() => orderService.validateBalance(order)).not.toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("order with insufficient balance should be rejected", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          // Deficit percentage (1-99% of required amount)
          fc.integer({ min: 1, max: 99 }),
          (marketId, tokenId, side, price, amount, salt, deficitPercent) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create order to determine required amount
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            // Credit insufficient balance
            const requiredTokenId = side === Side.BUY ? 0n : tokenId;
            const requiredAmount = order.makerAmount;
            
            // Only credit a fraction of required amount
            const creditAmount = (requiredAmount * BigInt(100 - deficitPercent)) / 100n;
            
            // Ensure we're actually crediting less than required
            fc.pre(creditAmount < requiredAmount);
            fc.pre(creditAmount > 0n);
            
            ledger.credit(maker, requiredTokenId, creditAmount);
            
            // Verify balance validation fails
            expect(() => orderService.validateBalance(order)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("order with zero balance should be rejected", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          (marketId, tokenId, side, price, amount, salt) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create order (no balance credited)
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            // Ensure order requires non-zero amount
            fc.pre(order.makerAmount > 0n);
            
            // Verify balance validation fails (zero balance)
            expect(() => orderService.validateBalance(order)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("BUY order should check collateral balance (tokenId = 0)", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          (marketId, tokenId, price, amount, salt) => {
            // Ensure tokenId is not 0 to distinguish from collateral
            fc.pre(tokenId !== 0n);
            
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create BUY order
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              Side.BUY,
              price,
              amount,
              salt
            );
            
            // Credit outcome tokens (wrong token for BUY)
            ledger.credit(maker, tokenId, order.makerAmount * 10n);
            
            // Should fail because we need collateral (tokenId = 0), not outcome tokens
            expect(() => orderService.validateBalance(order)).toThrow();
            
            // Now credit collateral
            ledger.credit(maker, 0n, order.makerAmount);
            
            // Should pass now
            expect(() => orderService.validateBalance(order)).not.toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("SELL order should check outcome token balance", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          (marketId, tokenId, price, amount, salt) => {
            // Ensure tokenId is not 0 to distinguish from collateral
            fc.pre(tokenId !== 0n);
            
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create SELL order
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              Side.SELL,
              price,
              amount,
              salt
            );
            
            // Credit collateral (wrong token for SELL)
            ledger.credit(maker, 0n, order.makerAmount * 10n);
            
            // Should fail because we need outcome tokens, not collateral
            expect(() => orderService.validateBalance(order)).toThrow();
            
            // Now credit outcome tokens
            ledger.credit(maker, tokenId, order.makerAmount);
            
            // Should pass now
            expect(() => orderService.validateBalance(order)).not.toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });

    test("locked balance should not count towards available balance", () => {
      fc.assert(
        fc.property(
          marketIdArbitrary,
          tokenIdArbitrary,
          fc.constantFrom(Side.BUY, Side.SELL),
          priceArbitrary,
          amountArbitrary,
          saltArbitrary,
          (marketId, tokenId, side, price, amount, salt) => {
            const maker = `0x${Array(40).fill(0).map(() => 
              Math.floor(Math.random() * 16).toString(16)
            ).join('')}`;
            
            // Create services
            const ledger = new Ledger();
            const matchingEngine = new MatchingEngine(ledger);
            const riskEngine = new RiskEngine();
            const orderService = new OrderService(
              CHAIN_ID,
              EXCHANGE_ADDRESS,
              ledger,
              matchingEngine,
              riskEngine
            );
            
            // Create order
            const order = createOrderWithInvalidSignature(
              maker,
              marketId,
              tokenId,
              side,
              price,
              amount,
              salt
            );
            
            const requiredTokenId = side === Side.BUY ? 0n : tokenId;
            const requiredAmount = order.makerAmount;
            
            // Credit exactly the required amount
            ledger.credit(maker, requiredTokenId, requiredAmount);
            
            // Should pass with full available balance
            expect(() => orderService.validateBalance(order)).not.toThrow();
            
            // Lock half the balance
            const lockAmount = requiredAmount / 2n;
            fc.pre(lockAmount > 0n);
            ledger.lock(maker, requiredTokenId, lockAmount);
            
            // Should now fail because available < required
            expect(() => orderService.validateBalance(order)).toThrow();
          }
        ),
        { numRuns: NUM_RUNS }
      );
    });
  });
});
