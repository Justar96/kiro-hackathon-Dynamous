import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import {
  MatchingEngine,
  OrderSigner,
  MerkleTree,
  RiskEngine,
  monitor,
  Ledger,
  OrderService,
  OrderErrorCode,
  SettlementService,
  ReconciliationService,
  BlockchainIndexer,
  sseBroadcaster,
} from "./services";
import type { SignedOrder, OrderBookEntry } from "./types";
import { Side, SignatureType } from "./types";

const app = new Hono();

// ============ Configuration ============

// Chain configuration
const CHAIN_ID = parseInt(process.env.CHAIN_ID || "137"); // Polygon mainnet by default

// Settlement batch interval (default: 60 seconds)
const SETTLEMENT_BATCH_INTERVAL_MS = parseInt(process.env.SETTLEMENT_BATCH_INTERVAL_MS || "60000");

// Reconciliation interval (default: 5 minutes)
const RECONCILIATION_INTERVAL_MS = parseInt(process.env.RECONCILIATION_INTERVAL_MS || "300000");

// Contract addresses
const EXCHANGE_ADDRESS = process.env.EXCHANGE_ADDRESS || "0x0000000000000000000000000000000000000000";
const VAULT_ADDRESS = process.env.VAULT_ADDRESS || "0x0000000000000000000000000000000000000000";

// ============ Service Initialization ============

console.log("[INIT] Initializing services...");

// Core services
// Requirement 1.3, 2.5, 2.7, 7.1: Ledger for balance management
const ledger = new Ledger();
console.log("[INIT] Ledger service initialized");

// Requirement 3.1-3.8: Matching engine with MINT/MERGE detection
const engine = new MatchingEngine(ledger);
console.log("[INIT] Matching engine initialized");

// Requirement 10.1-10.6: Risk engine with tier-based limits
const risk = new RiskEngine();
console.log("[INIT] Risk engine initialized");

// Order signer for EIP-712 signature verification
const signer = new OrderSigner(CHAIN_ID, EXCHANGE_ADDRESS);
console.log("[INIT] Order signer initialized");

// Requirement 2.3-2.7: Order service with full validation
const orderService = new OrderService(
  CHAIN_ID,
  EXCHANGE_ADDRESS,
  ledger,
  engine,
  risk
);
console.log("[INIT] Order service initialized");

// Settlement service (requires RPC and private key for on-chain operations)
// Requirement 4.1-4.7, 5.1-5.6: Settlement batching and CTFExchange integration
let settlementService: SettlementService | null = null;
if (process.env.RPC_URL && process.env.OPERATOR_PRIVATE_KEY) {
  settlementService = new SettlementService(
    process.env.RPC_URL,
    process.env.OPERATOR_PRIVATE_KEY,
    VAULT_ADDRESS,
    EXCHANGE_ADDRESS
  );
  
  // Wire settlement service with order service as order store
  // This allows settlement to retrieve signed orders by hash
  settlementService.setOrderStore(orderService);
  console.log("[INIT] Settlement service initialized and wired to order service");
} else {
  console.warn("[INIT] Settlement service not configured (missing RPC_URL or OPERATOR_PRIVATE_KEY)");
}

// Reconciliation service
// Requirement 8.1-8.5: Balance reconciliation between off-chain and on-chain
let reconciliationService: ReconciliationService | null = null;
if (process.env.RPC_URL && VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000") {
  reconciliationService = new ReconciliationService({
    rpcUrl: process.env.RPC_URL,
    vaultAddress: VAULT_ADDRESS,
    ledger,
    onAlert: (result) => {
      console.warn(`[RECONCILIATION ALERT] Discrepancy: ${(result.discrepancyPercent * 100).toFixed(4)}%`);
      monitor.inc("reconciliation_alerts_total");
    },
    onCriticalDiscrepancy: (result) => {
      console.error(`[CRITICAL] System paused due to discrepancy: ${(result.discrepancyPercent * 100).toFixed(4)}%`);
      monitor.inc("reconciliation_critical_total");
    },
  });
  console.log("[INIT] Reconciliation service initialized");
} else {
  console.warn("[INIT] Reconciliation service not configured (missing RPC_URL or VAULT_ADDRESS)");
}

// Indexer service
// Requirement 1.2, 1.4, 6.6, 7.4, 11.1, 11.4: Blockchain event monitoring
let indexer: BlockchainIndexer | null = null;
if (process.env.RPC_URL && VAULT_ADDRESS !== "0x0000000000000000000000000000000000000000" && EXCHANGE_ADDRESS !== "0x0000000000000000000000000000000000000000") {
  indexer = new BlockchainIndexer({
    rpcUrl: process.env.RPC_URL,
    settlementVaultAddress: VAULT_ADDRESS,
    ctfExchangeAddress: EXCHANGE_ADDRESS,
    ledger,
  });
  console.log("[INIT] Blockchain indexer initialized");
} else {
  console.warn("[INIT] Blockchain indexer not configured (missing RPC_URL, VAULT_ADDRESS, or EXCHANGE_ADDRESS)");
}

// Alert logging
monitor.onAlert((alert) => {
  console.log(`[ALERT:${alert.severity}] ${alert.message}`);
});

// Settlement state (legacy - for backwards compatibility)
let currentEpoch = 0;
const epochData = new Map<number, { root: string; proofs: Map<string, { amount: bigint; proof: string[] }> }>();

// SSE clients for order book updates
const sseClients = new Map<string, Set<(event: string, data: unknown) => void>>();

// ============ Health Endpoints ============

/**
 * GET /health - System health check
 * Requirement 8.4
 */
app.get("/health", (c) => {
  const isHealthy = reconciliationService?.isHealthy() ?? true;
  const isPaused = reconciliationService?.isPaused() ?? false;
  
  return c.json({
    status: isHealthy ? "ok" : "degraded",
    paused: isPaused,
    timestamp: Date.now(),
    services: {
      ledger: true,
      matchingEngine: true,
      riskEngine: true,
      settlement: settlementService !== null,
      reconciliation: reconciliationService !== null,
      indexer: indexer !== null,
    },
  });
});

/**
 * GET /health/reconciliation - Reconciliation status
 * Requirement 8.4
 */
app.get("/health/reconciliation", async (c) => {
  if (!reconciliationService) {
    return c.json({ error: "Reconciliation service not configured" }, 503);
  }

  const stats = reconciliationService.getStats();
  const history = reconciliationService.getHistory(10);
  const isHealthy = reconciliationService.isHealthy();
  const isPaused = reconciliationService.isPaused();

  return c.json({
    healthy: isHealthy,
    paused: isPaused,
    stats: {
      totalChecks: stats.totalChecks,
      healthyChecks: stats.healthyChecks,
      discrepancyChecks: stats.discrepancyChecks,
      lastRun: stats.lastRun,
      averageDiscrepancyPercent: stats.averageDiscrepancyPercent,
      maxDiscrepancyPercent: stats.maxDiscrepancyPercent,
    },
    recentHistory: history.map((r) => ({
      timestamp: r.timestamp,
      healthy: r.healthy,
      discrepancyPercent: r.discrepancyPercent,
      onChainTotal: r.onChainTotal.toString(),
      offChainTotal: r.offChainTotal.toString(),
    })),
  });
});

// ============ Order Endpoints ============

/**
 * POST /api/orders - Submit signed order
 * Requirements: 2.3, 7.1, 9.1, 9.2, 9.3
 */
app.post("/api/orders", async (c) => {
  try {
    const body = await c.req.json();
    const order = parseOrder(body);

    // Use OrderService for full validation
    const result = orderService.submitOrder(order);

    if (result.status === "rejected") {
      monitor.inc("orders_rejected_total", { reason: result.errorCode || "unknown" });
      return c.json({
        error: result.error,
        errorCode: result.errorCode,
      }, 400);
    }

    monitor.inc("orders_accepted_total");
    monitor.inc("trades_matched_total", {}, result.trades.length);

    // Get the order entry for SSE broadcast
    const orderEntry = orderService.getOrder(result.orderId);
    
    // Broadcast order added event via SSE broadcaster
    // Requirement 9.1: Broadcast SSE event when order is added
    if (orderEntry && orderEntry.remaining > 0n) {
      sseBroadcaster.broadcastOrderAdded(order.marketId, orderEntry);
    }

    // Broadcast trades via SSE broadcaster
    // Requirement 9.3: Broadcast trade events
    for (const trade of result.trades) {
      sseBroadcaster.broadcastTrade(order.marketId, trade);
      
      // Broadcast order updates for partial fills
      // Requirement 9.2: Broadcast order updates
      const makerOrder = engine.getOrder(trade.makerOrderHash);
      if (makerOrder) {
        const originalAmount = makerOrder.order.makerAmount;
        const filled = originalAmount - makerOrder.remaining;
        sseBroadcaster.broadcastOrderUpdated(
          order.marketId,
          order.tokenId,
          trade.makerOrderHash,
          filled,
          makerOrder.remaining
        );
      }
    }

    // Broadcast price update if trades occurred
    if (result.trades.length > 0) {
      const lastTrade = result.trades[result.trades.length - 1];
      const bestBid = engine.getBestBid(order.marketId, order.tokenId);
      const bestAsk = engine.getBestAsk(order.marketId, order.tokenId);
      sseBroadcaster.broadcastPriceUpdate(
        order.marketId,
        order.tokenId,
        lastTrade.price,
        bestBid,
        bestAsk
      );
    }

    // Legacy SSE broadcast for backwards compatibility
    broadcastOrderBookUpdate(order.marketId, order.tokenId, "order_added", {
      orderId: result.orderId,
      side: order.side,
      price: order.makerAmount.toString(),
      quantity: order.takerAmount.toString(),
    });

    // Broadcast trades (legacy)
    for (const trade of result.trades) {
      broadcastOrderBookUpdate(order.marketId, order.tokenId, "trade", {
        id: trade.id,
        price: trade.price.toString(),
        amount: trade.amount.toString(),
        maker: trade.maker,
        taker: trade.taker,
      });
    }

    return c.json({
      orderId: result.orderId,
      status: result.status,
      trades: result.trades.map((t) => ({
        id: t.id,
        amount: t.amount.toString(),
        price: t.price.toString(),
        matchType: t.matchType,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    monitor.inc("orders_rejected_total", { reason: "parse_error" });
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /api/orders/:id - Cancel order
 * Requirements: 7.1, 9.2
 */
app.delete("/api/orders/:id", async (c) => {
  const orderId = c.req.param("id");
  const maker = c.req.header("X-Maker-Address");

  if (!maker) {
    return c.json({ error: "Missing X-Maker-Address header" }, 400);
  }

  // Get order before cancellation for SSE broadcast
  const order = orderService.getOrder(orderId);
  
  const success = orderService.cancelOrder(orderId, maker);
  if (!success) {
    return c.json({ error: "Order not found or unauthorized" }, 404);
  }

  monitor.inc("orders_cancelled_total");

  // Broadcast order removal via SSE broadcaster
  // Requirement 9.2: Broadcast SSE event when order is cancelled
  if (order) {
    sseBroadcaster.broadcastOrderRemoved(
      order.order.marketId,
      order.order.tokenId,
      orderId
    );
    
    // Broadcast price update after cancellation
    const bestBid = engine.getBestBid(order.order.marketId, order.order.tokenId);
    const bestAsk = engine.getBestAsk(order.order.marketId, order.order.tokenId);
    if (bestBid || bestAsk) {
      sseBroadcaster.broadcastPriceUpdate(
        order.order.marketId,
        order.order.tokenId,
        bestBid?.price ?? bestAsk?.price ?? 0n,
        bestBid,
        bestAsk
      );
    }

    // Legacy SSE broadcast for backwards compatibility
    broadcastOrderBookUpdate(order.order.marketId, order.order.tokenId, "order_removed", {
      orderId,
    });
  }

  return c.json({ success: true });
});

/**
 * GET /api/orders/:id - Get order status
 */
app.get("/api/orders/:id", (c) => {
  const orderId = c.req.param("id");
  const order = orderService.getOrder(orderId);

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  return c.json({
    id: order.id,
    maker: order.order.maker,
    marketId: order.order.marketId,
    tokenId: order.order.tokenId.toString(),
    side: order.order.side,
    price: order.order.makerAmount.toString(),
    quantity: order.order.takerAmount.toString(),
    remaining: order.remaining.toString(),
    timestamp: order.timestamp,
  });
});

/**
 * GET /api/orders/user/:addr - Get user's orders
 */
app.get("/api/orders/user/:addr", (c) => {
  const address = c.req.param("addr");
  const orders = orderService.getUserOrders(address);

  return c.json({
    orders: orders.map((o) => ({
      id: o.id,
      marketId: o.order.marketId,
      tokenId: o.order.tokenId.toString(),
      side: o.order.side,
      price: o.order.makerAmount.toString(),
      quantity: o.order.takerAmount.toString(),
      remaining: o.remaining.toString(),
      timestamp: o.timestamp,
    })),
  });
});

// ============ Order Book Endpoints ============

/**
 * GET /api/orderbook/:marketId/:tokenId - Get order book
 * Requirements: 9.1, 9.2, 9.3, 9.4
 */
app.get("/api/orderbook/:marketId/:tokenId", (c) => {
  const marketId = c.req.param("marketId");
  const tokenId = BigInt(c.req.param("tokenId"));
  const depth = parseInt(c.req.query("depth") || "10");

  const { bids, asks } = engine.getOrderBook(marketId, tokenId, depth);

  return c.json({
    marketId,
    tokenId: tokenId.toString(),
    bids: bids.map((b) => ({
      id: b.id,
      price: engine.calculatePrice(b.order).toString(),
      quantity: b.remaining.toString(),
      maker: b.order.maker,
    })),
    asks: asks.map((a) => ({
      id: a.id,
      price: engine.calculatePrice(a.order).toString(),
      quantity: a.remaining.toString(),
      maker: a.order.maker,
    })),
    timestamp: Date.now(),
  });
});

/**
 * GET /api/orderbook/:marketId/:tokenId/stream - SSE subscription
 * Requirements: 9.1, 9.2, 9.3, 9.4, 9.5
 */
app.get("/api/orderbook/:marketId/:tokenId/stream", async (c) => {
  const marketId = c.req.param("marketId");
  const tokenId = BigInt(c.req.param("tokenId"));
  const marketKey = `${marketId}-${tokenId}`;

  return streamSSE(c, async (stream) => {
    // Send initial order book state
    // Requirement 9.4: Send current order book state on subscription
    const { bids, asks } = engine.getOrderBook(marketId, tokenId, 50);
    await stream.writeSSE({
      event: "snapshot",
      data: JSON.stringify({
        marketId,
        tokenId: tokenId.toString(),
        bids: bids.map((b) => ({
          id: b.id,
          price: engine.calculatePrice(b.order).toString(),
          quantity: b.remaining.toString(),
        })),
        asks: asks.map((a) => ({
          id: a.id,
          price: engine.calculatePrice(a.order).toString(),
          quantity: a.remaining.toString(),
        })),
      }),
    });

    // Register with SSE broadcaster
    const unsubscribe = sseBroadcaster.subscribeOrderbook(
      marketId,
      tokenId,
      async (event: string, data: unknown) => {
        try {
          await stream.writeSSE({
            event,
            data: JSON.stringify(data),
          });
        } catch {
          // Client disconnected
        }
      }
    );

    // Also register with legacy SSE clients for backwards compatibility
    const clientCallback = async (event: string, data: unknown) => {
      try {
        await stream.writeSSE({
          event,
          data: JSON.stringify(data),
        });
      } catch {
        // Client disconnected
      }
    };

    if (!sseClients.has(marketKey)) {
      sseClients.set(marketKey, new Set());
    }
    sseClients.get(marketKey)!.add(clientCallback);

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      try {
        await stream.writeSSE({ event: "ping", data: "" });
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(keepAlive);
      unsubscribe();
      sseClients.get(marketKey)?.delete(clientCallback);
    });

    // Keep stream open
    await new Promise(() => {});
  });
});

/**
 * GET /api/orderbook/:marketId/:tokenId/best - Get best bid/ask
 */
app.get("/api/orderbook/:marketId/:tokenId/best", (c) => {
  const marketId = c.req.param("marketId");
  const tokenId = BigInt(c.req.param("tokenId"));

  const bestBid = engine.getBestBid(marketId, tokenId);
  const bestAsk = engine.getBestAsk(marketId, tokenId);

  return c.json({
    bid: bestBid
      ? { price: bestBid.price.toString(), quantity: bestBid.quantity.toString() }
      : null,
    ask: bestAsk
      ? { price: bestAsk.price.toString(), quantity: bestAsk.quantity.toString() }
      : null,
    spread: bestBid && bestAsk
      ? (bestAsk.price - bestBid.price).toString()
      : null,
  });
});

// ============ Balance Endpoints ============

/**
 * GET /api/balances/:addr - Get user balances
 * Requirement 1.5
 */
app.get("/api/balances/:addr", (c) => {
  const address = c.req.param("addr");
  const allBalances = ledger.getAllBalances(address);

  const balances: Record<string, { available: string; locked: string; total: string }> = {};
  for (const [tokenId, balance] of allBalances) {
    balances[tokenId.toString()] = {
      available: balance.available.toString(),
      locked: balance.locked.toString(),
      total: (balance.available + balance.locked).toString(),
    };
  }

  return c.json({
    address,
    balances,
    nonce: ledger.getNonce(address).toString(),
  });
});

/**
 * GET /api/balances/:addr/:tokenId - Get specific token balance
 */
app.get("/api/balances/:addr/:tokenId", (c) => {
  const address = c.req.param("addr");
  const tokenId = BigInt(c.req.param("tokenId"));

  const balance = ledger.getBalance(address, tokenId);

  return c.json({
    address,
    tokenId: tokenId.toString(),
    available: balance.available.toString(),
    locked: balance.locked.toString(),
    total: (balance.available + balance.locked).toString(),
  });
});

/**
 * GET /api/deposits/:addr - Get deposit history
 * Requirement 1.5
 */
app.get("/api/deposits/:addr", (c) => {
  const address = c.req.param("addr");

  if (!indexer) {
    return c.json({ error: "Indexer not configured" }, 503);
  }

  const pendingDeposits = indexer.getUserPendingDeposits(address);

  return c.json({
    address,
    pending: pendingDeposits.map((d) => ({
      txHash: d.txHash,
      amount: d.amount.toString(),
      blockNumber: d.blockNumber,
      confirmations: d.confirmations,
      requiredConfirmations: indexer!.getRequiredConfirmations(),
      indexed: d.indexed,
    })),
  });
});

/**
 * GET /api/withdrawals/:addr - Get withdrawal proofs
 * Requirements: 6.1, 6.2
 */
app.get("/api/withdrawals/:addr", (c) => {
  const address = c.req.param("addr");

  if (!settlementService) {
    return c.json({ error: "Settlement service not configured" }, 503);
  }

  const unclaimedEpochs = settlementService.getUnclaimedEpochs(address);
  const proofs = unclaimedEpochs.map((epochId) => {
    const proof = settlementService!.getProof(epochId, address);
    return proof ? {
      epochId,
      amount: proof.amount.toString(),
      proof: proof.proof,
    } : null;
  }).filter(Boolean);

  return c.json({
    address,
    unclaimedEpochs,
    proofs,
  });
});

// ============ Settlement Endpoints ============

/**
 * GET /api/settlement/epochs - Get recent epochs
 */
app.get("/api/settlement/epochs", (c) => {
  if (!settlementService) {
    return c.json({ error: "Settlement service not configured" }, 503);
  }

  const batches = settlementService.getAllBatches();
  const limit = parseInt(c.req.query("limit") || "10");

  return c.json({
    currentEpoch: settlementService.getCurrentEpoch(),
    epochs: batches.slice(-limit).map((b) => ({
      epochId: b.epochId,
      merkleRoot: b.merkleRoot,
      tradeCount: b.trades.length,
      status: b.status,
      timestamp: b.timestamp,
    })),
  });
});

/**
 * GET /api/settlement/proof/:epochId/:addr - Get withdrawal proof
 * Requirement 6.2
 */
app.get("/api/settlement/proof/:epochId/:addr", (c) => {
  const epochId = parseInt(c.req.param("epochId"));
  const address = c.req.param("addr");

  if (!settlementService) {
    return c.json({ error: "Settlement service not configured" }, 503);
  }

  const proof = settlementService.getProof(epochId, address);
  if (!proof) {
    return c.json({ error: "No proof found for this address in this epoch" }, 404);
  }

  const batch = settlementService.getBatch(epochId);

  return c.json({
    epochId,
    address,
    amount: proof.amount.toString(),
    proof: proof.proof,
    merkleRoot: batch?.merkleRoot,
  });
});

/**
 * GET /api/settlement/pending - Get pending trades
 */
app.get("/api/settlement/pending", (c) => {
  const trades = engine.getPendingTrades();
  monitor.set("pending_trades_count", trades.length);

  return c.json({
    count: trades.length,
    trades: trades.map((t) => ({
      id: t.id,
      maker: t.maker,
      taker: t.taker,
      tokenId: t.tokenId.toString(),
      amount: t.amount.toString(),
      price: t.price.toString(),
      matchType: t.matchType,
    })),
  });
});

/**
 * GET /api/settlement/stream - SSE subscription for settlement events
 * Requirement 4.7: Emit settlement event for frontend updates
 */
app.get("/api/settlement/stream", async (c) => {
  return streamSSE(c, async (stream) => {
    // Send current epoch info
    const currentEpoch = settlementService?.getCurrentEpoch() ?? 0;
    await stream.writeSSE({
      event: "connected",
      data: JSON.stringify({ currentEpoch }),
    });

    // Register with SSE broadcaster for settlement events
    const unsubscribe = sseBroadcaster.subscribeSettlement(
      async (event: string, data: unknown) => {
        try {
          await stream.writeSSE({
            event,
            data: JSON.stringify(data),
          });
        } catch {
          // Client disconnected
        }
      }
    );

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      try {
        await stream.writeSSE({ event: "ping", data: "" });
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(keepAlive);
      unsubscribe();
    });

    // Keep stream open
    await new Promise(() => {});
  });
});

/**
 * GET /api/balances/:addr/stream - SSE subscription for balance updates
 */
app.get("/api/balances/:addr/stream", async (c) => {
  const address = c.req.param("addr");

  return streamSSE(c, async (stream) => {
    // Send current balances
    const allBalances = ledger.getAllBalances(address);
    const balances: Record<string, { available: string; locked: string }> = {};
    for (const [tokenId, balance] of allBalances) {
      balances[tokenId.toString()] = {
        available: balance.available.toString(),
        locked: balance.locked.toString(),
      };
    }
    
    await stream.writeSSE({
      event: "snapshot",
      data: JSON.stringify({
        address,
        balances,
        nonce: ledger.getNonce(address).toString(),
      }),
    });

    // Register with SSE broadcaster for balance updates
    const unsubscribe = sseBroadcaster.subscribeBalance(
      address,
      async (event: string, data: unknown) => {
        try {
          await stream.writeSSE({
            event,
            data: JSON.stringify(data),
          });
        } catch {
          // Client disconnected
        }
      }
    );

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      try {
        await stream.writeSSE({ event: "ping", data: "" });
      } catch {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Cleanup on disconnect
    stream.onAbort(() => {
      clearInterval(keepAlive);
      unsubscribe();
    });

    // Keep stream open
    await new Promise(() => {});
  });
});

/**
 * POST /api/settlement/batch - Create settlement batch (legacy)
 */
app.post("/api/settlement/batch", async (c) => {
  const trades = engine.clearPendingTrades();
  
  if (trades.length === 0) {
    return c.json({ error: "No pending trades" }, 400);
  }

  // Compute balance deltas
  const deltas = new Map<string, bigint>();
  for (const trade of trades) {
    const cost = (trade.price * trade.amount) / (10n ** 18n);
    
    const buyerDelta = deltas.get(trade.maker) || 0n;
    deltas.set(trade.maker, buyerDelta - cost);
    
    const sellerDelta = deltas.get(trade.taker) || 0n;
    deltas.set(trade.taker, sellerDelta + cost);
  }

  // Build Merkle tree from positive balances
  const entries = Array.from(deltas.entries())
    .filter(([_, amount]) => amount > 0n)
    .map(([address, amount]) => ({ address, amount }));

  if (entries.length === 0) {
    return c.json({ epochId: 0, merkleRoot: null, entries: 0 });
  }

  const tree = new MerkleTree(entries);
  const merkleRoot = tree.getRoot();

  // Store proofs
  const proofs = new Map<string, { amount: bigint; proof: string[] }>();
  for (const entry of entries) {
    const { proof } = tree.getProof(entry.address, entry.amount);
    proofs.set(entry.address.toLowerCase(), { amount: entry.amount, proof });
  }

  currentEpoch++;
  epochData.set(currentEpoch, { root: merkleRoot, proofs });

  monitor.inc("settlement_batches_total");
  monitor.inc("trades_settled_total", {}, trades.length);

  return c.json({
    epochId: currentEpoch,
    merkleRoot,
    entries: entries.length,
    totalAmount: entries.reduce((a, b) => a + b.amount, 0n).toString(),
  });
});

// ============ Legacy Endpoints (backwards compatibility) ============

app.post("/orders", async (c) => {
  // Redirect to new endpoint
  const url = new URL(c.req.url);
  url.pathname = "/api/orders";
  return c.redirect(url.toString(), 307);
});

app.delete("/orders/:orderId", async (c) => {
  const orderId = c.req.param("orderId");
  const maker = c.req.header("X-Maker-Address");

  if (!maker) {
    return c.json({ error: "Missing X-Maker-Address header" }, 400);
  }

  const order = engine.getOrder(orderId);
  const success = engine.cancelOrder(orderId, maker);
  if (!success) {
    return c.json({ error: "Order not found or unauthorized" }, 404);
  }

  if (order) {
    risk.releaseOrder(orderId, maker, order.remaining);
  }
  monitor.inc("orders_cancelled_total");

  return c.json({ success: true });
});

app.get("/orderbook/:marketId/:tokenId", (c) => {
  const marketId = c.req.param("marketId");
  const tokenId = BigInt(c.req.param("tokenId"));
  const depth = parseInt(c.req.query("depth") || "10");

  const { bids, asks } = engine.getOrderBook(marketId, tokenId, depth);

  return c.json({
    bids: bids.map((b) => ({
      id: b.id,
      price: b.order.makerAmount.toString(),
      quantity: b.remaining.toString(),
    })),
    asks: asks.map((a) => ({
      id: a.id,
      price: a.order.takerAmount.toString(),
      quantity: a.remaining.toString(),
    })),
  });
});

app.get("/orderbook/:marketId/:tokenId/best", (c) => {
  const marketId = c.req.param("marketId");
  const tokenId = BigInt(c.req.param("tokenId"));

  const bestBid = engine.getBestBid(marketId, tokenId);
  const bestAsk = engine.getBestAsk(marketId, tokenId);

  return c.json({
    bid: bestBid
      ? { price: bestBid.price.toString(), quantity: bestBid.quantity.toString() }
      : null,
    ask: bestAsk
      ? { price: bestAsk.price.toString(), quantity: bestAsk.quantity.toString() }
      : null,
  });
});

app.get("/balances/:address/:tokenId", (c) => {
  const address = c.req.param("address");
  const tokenId = BigInt(c.req.param("tokenId"));

  const balance = engine.getBalance(address, tokenId);

  return c.json({
    available: balance.available.toString(),
    locked: balance.locked.toString(),
  });
});

app.post("/balances/:address/deposit", async (c) => {
  const address = c.req.param("address");
  const body = await c.req.json();
  const tokenId = BigInt(body.tokenId || "0");
  const amount = BigInt(body.amount);

  engine.deposit(address, tokenId, amount);

  return c.json({ success: true });
});

app.get("/settlement/epoch/:epochId", (c) => {
  const epochId = parseInt(c.req.param("epochId"));
  const data = epochData.get(epochId);

  if (!data) {
    return c.json({ error: "Epoch not found" }, 404);
  }

  return c.json({
    epochId,
    merkleRoot: data.root,
    claimants: data.proofs.size,
  });
});

app.get("/settlement/proof/:epochId/:address", (c) => {
  const epochId = parseInt(c.req.param("epochId"));
  const address = c.req.param("address").toLowerCase();
  const data = epochData.get(epochId);

  if (!data) {
    return c.json({ error: "Epoch not found" }, 404);
  }

  const proofData = data.proofs.get(address);
  if (!proofData) {
    return c.json({ error: "No claim for this address" }, 404);
  }

  return c.json({
    epochId,
    address,
    amount: proofData.amount.toString(),
    proof: proofData.proof,
    merkleRoot: data.root,
  });
});

// ============ Monitoring Endpoints ============

app.get("/metrics", (c) => {
  c.header("Content-Type", "text/plain");
  return c.text(monitor.export());
});

app.get("/alerts", (c) => {
  const includeResolved = c.req.query("resolved") === "true";
  return c.json(monitor.getAlerts(includeResolved));
});

app.post("/alerts/:id/resolve", (c) => {
  monitor.resolveAlert(c.req.param("id"));
  return c.json({ success: true });
});

// ============ Risk Endpoints ============

app.get("/risk/:address", (c) => {
  const address = c.req.param("address");
  const limits = risk.getLimits(address);
  return c.json({
    exposure: risk.getExposure(address).toString(),
    activeOrders: risk.getActiveOrderCount(address),
    limits: {
      maxOrderSize: limits.maxOrderSize.toString(),
      maxExposure: limits.maxExposure.toString(),
      maxOrdersPerMinute: limits.maxOrdersPerMinute,
      maxWithdrawalPerDay: limits.maxWithdrawalPerDay.toString(),
    },
  });
});

app.post("/risk/:address/limits", async (c) => {
  const address = c.req.param("address");
  const body = await c.req.json();
  risk.setLimits(address, {
    maxOrderSize: body.maxOrderSize ? BigInt(body.maxOrderSize) : undefined,
    maxExposure: body.maxExposure ? BigInt(body.maxExposure) : undefined,
    maxOrdersPerMinute: body.maxOrdersPerMinute,
    maxWithdrawalPerDay: body.maxWithdrawalPerDay ? BigInt(body.maxWithdrawalPerDay) : undefined,
  });
  return c.json({ success: true });
});

// ============ Helpers ============

function parseOrder(body: Record<string, unknown>): SignedOrder {
  return {
    salt: BigInt(body.salt as string),
    maker: body.maker as string,
    signer: body.signer as string,
    taker: (body.taker as string) || "0x0000000000000000000000000000000000000000",
    marketId: body.marketId as string,
    tokenId: BigInt(body.tokenId as string),
    side: body.side as Side,
    makerAmount: BigInt(body.makerAmount as string),
    takerAmount: BigInt(body.takerAmount as string),
    expiration: BigInt(body.expiration as string),
    nonce: BigInt(body.nonce as string),
    feeRateBps: BigInt(body.feeRateBps as string),
    sigType: (body.sigType as SignatureType) || SignatureType.EOA,
    signature: body.signature as string,
  };
}

/**
 * Broadcast order book update to all SSE clients for a market
 */
function broadcastOrderBookUpdate(
  marketId: string,
  tokenId: bigint,
  event: string,
  data: unknown
): void {
  const marketKey = `${marketId}-${tokenId}`;
  const clients = sseClients.get(marketKey);
  
  if (clients) {
    for (const callback of clients) {
      callback(event, data);
    }
  }
}

// ============ Start Server ============

const port = parseInt(process.env.PORT || "3001");

// ============ Background Services Startup ============

// Start indexer on server startup
// Requirement 1.2, 1.4: Monitor blockchain events for deposits
// Requirement 11.1, 11.4: Sync nonces from on-chain
if (indexer) {
  const startBlock = process.env.START_BLOCK ? parseInt(process.env.START_BLOCK) : undefined;
  indexer.start(startBlock).then(() => {
    console.log(`[INDEXER] Started monitoring from block ${indexer!.getCurrentBlock()}`);
  }).catch((error) => {
    console.error("[INDEXER] Failed to start:", error);
  });
}

// Settlement batch interval timer
// Requirement 4.1: Create batches at configurable intervals (default: 60 seconds)
let settlementIntervalId: ReturnType<typeof setInterval> | null = null;
if (settlementService) {
  settlementIntervalId = setInterval(async () => {
    try {
      // Get pending trades from matching engine
      const pendingTrades = engine.getPendingTrades();
      
      if (pendingTrades.length > 0) {
        console.log(`[SETTLEMENT] Processing ${pendingTrades.length} pending trades`);
        
        // Clear pending trades from engine and add to settlement service
        const trades = engine.clearPendingTrades();
        settlementService!.addTrades(trades);
        
        // Create batch
        const batch = await settlementService!.createBatch();
        
        if (batch) {
          console.log(`[SETTLEMENT] Created batch epoch ${batch.epochId} with ${batch.trades.length} trades`);
          monitor.inc("settlement_batches_created_total");
          
          // Commit batch to on-chain vault
          try {
            const txHash = await settlementService!.commitBatch(batch);
            console.log(`[SETTLEMENT] Committed epoch ${batch.epochId}, tx: ${txHash}`);
            monitor.inc("settlement_batches_committed_total");
            
            // Broadcast epoch committed event via SSE
            // Requirement 4.7: Emit settlement event for frontend updates
            sseBroadcaster.broadcastEpochCommitted(batch.epochId, batch.merkleRoot);
            
            // Execute settlement on CTFExchange
            const result = await settlementService!.executeSettlement(batch);
            if (result.success) {
              console.log(`[SETTLEMENT] Settled epoch ${batch.epochId} with ${result.txHashes.length} transactions`);
              monitor.inc("settlement_batches_settled_total");
              monitor.inc("trades_settled_total", {}, batch.trades.length);
            } else {
              console.error(`[SETTLEMENT] Failed to settle epoch ${batch.epochId}:`, result.error);
              monitor.inc("settlement_batches_failed_total");
            }
          } catch (error) {
            console.error(`[SETTLEMENT] Failed to commit/settle batch:`, error);
            monitor.inc("settlement_errors_total");
          }
        }
      }
    } catch (error) {
      console.error("[SETTLEMENT] Batch processing error:", error);
      monitor.inc("settlement_errors_total");
    }
  }, SETTLEMENT_BATCH_INTERVAL_MS);
  
  console.log(`[SETTLEMENT] Batch interval started (every ${SETTLEMENT_BATCH_INTERVAL_MS / 1000}s)`);
}

// Reconciliation interval timer
// Requirement 8.1: Periodically compare off-chain and on-chain balances
let reconciliationIntervalId: ReturnType<typeof setInterval> | null = null;
if (reconciliationService) {
  reconciliationIntervalId = setInterval(async () => {
    try {
      const result = await reconciliationService!.reconcile();
      monitor.inc("reconciliation_checks_total");
      
      if (!result.healthy) {
        console.warn(`[RECONCILIATION] Discrepancy detected: ${(result.discrepancyPercent * 100).toFixed(4)}%`);
      }
    } catch (error) {
      console.error("[RECONCILIATION] Check failed:", error);
      monitor.inc("reconciliation_errors_total");
    }
  }, RECONCILIATION_INTERVAL_MS);
  
  console.log(`[RECONCILIATION] Interval started (every ${RECONCILIATION_INTERVAL_MS / 1000}s)`);
}

// Graceful shutdown handler
const shutdown = async () => {
  console.log("[SHUTDOWN] Graceful shutdown initiated...");
  
  // Stop settlement interval
  if (settlementIntervalId) {
    clearInterval(settlementIntervalId);
    console.log("[SHUTDOWN] Settlement interval stopped");
  }
  
  // Stop reconciliation interval
  if (reconciliationIntervalId) {
    clearInterval(reconciliationIntervalId);
    console.log("[SHUTDOWN] Reconciliation interval stopped");
  }
  
  // Stop indexer
  if (indexer) {
    indexer.stop();
    console.log("[SHUTDOWN] Indexer stopped");
  }
  
  // Process any remaining pending trades
  if (settlementService) {
    const pendingTrades = engine.getPendingTrades();
    if (pendingTrades.length > 0) {
      console.log(`[SHUTDOWN] Processing ${pendingTrades.length} remaining trades...`);
      const trades = engine.clearPendingTrades();
      settlementService.addTrades(trades);
      
      try {
        const batch = await settlementService.createBatch();
        if (batch) {
          await settlementService.commitBatch(batch);
          console.log(`[SHUTDOWN] Final batch committed: epoch ${batch.epochId}`);
        }
      } catch (error) {
        console.error("[SHUTDOWN] Failed to process final batch:", error);
      }
    }
  }
  
  console.log("[SHUTDOWN] Shutdown complete");
  process.exit(0);
};

// Register shutdown handlers
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

export default {
  port,
  fetch: app.fetch,
};

console.log(`[STARTUP] Backend running on port ${port}`);
console.log(`[STARTUP] Chain ID: ${CHAIN_ID}`);
console.log(`[STARTUP] Exchange address: ${EXCHANGE_ADDRESS}`);
console.log(`[STARTUP] Vault address: ${VAULT_ADDRESS}`);
