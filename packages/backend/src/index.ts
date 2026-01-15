import { Hono } from "hono";
import { MatchingEngine } from "./services/matchingEngine";
import { OrderSigner } from "./services/orderSigner";
import { MerkleTree } from "./services/merkleTree";
import { RiskEngine } from "./services/riskEngine";
import { monitor } from "./services/monitor";
import type { SignedOrder } from "./types";
import { Side, SignatureType } from "./types";

const app = new Hono();

// Initialize services
const engine = new MatchingEngine();
const risk = new RiskEngine();
const signer = new OrderSigner(
  137, // Polygon mainnet
  process.env.EXCHANGE_ADDRESS || "0x0000000000000000000000000000000000000000"
);

// Alert logging
monitor.onAlert((alert) => {
  console.log(`[ALERT:${alert.severity}] ${alert.message}`);
});

// Settlement state
let currentEpoch = 0;
const epochData = new Map<number, { root: string; proofs: Map<string, { amount: bigint; proof: string[] }> }>();

// ============ Health ============

app.get("/health", (c) => c.json({ status: "ok", timestamp: Date.now() }));

// ============ Orders ============

app.post("/orders", async (c) => {
  try {
    const body = await c.req.json();
    const order = parseOrder(body);

    // Verify signature
    if (!signer.verifySignature(order)) {
      monitor.inc("orders_rejected_total", { reason: "invalid_signature" });
      return c.json({ error: "Invalid signature" }, 400);
    }

    // Risk validation
    const riskCheck = risk.validateOrder(order);
    if (!riskCheck.valid) {
      monitor.inc("orders_rejected_total", { reason: riskCheck.reason || "risk" });
      return c.json({ error: riskCheck.reason }, 400);
    }

    // Add to matching engine
    const { trades, orderId } = engine.addOrder(order);
    risk.recordOrder(orderId, order);

    monitor.inc("orders_accepted_total");
    monitor.inc("trades_matched_total", {}, trades.length);

    return c.json({
      orderId,
      trades: trades.map((t) => ({
        id: t.id,
        amount: t.amount.toString(),
        price: t.price.toString(),
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    monitor.inc("orders_rejected_total", { reason: "parse_error" });
    return c.json({ error: message }, 400);
  }
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

// ============ Order Book ============

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

// ============ Balances ============

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

// ============ Settlement ============

app.get("/settlement/pending", (c) => {
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
    })),
  });
});

app.post("/settlement/batch", async (c) => {
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

// ============ Monitoring ============

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

// ============ Risk ============

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

// ============ Start Server ============

const port = parseInt(process.env.PORT || "3001");

export default {
  port,
  fetch: app.fetch,
};

console.log(`Backend running on port ${port}`);
