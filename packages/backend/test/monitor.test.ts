import { describe, it, expect, beforeEach } from "bun:test";
import { Monitor } from "../src/services/monitor";

describe("Monitor", () => {
  let monitor: Monitor;

  beforeEach(() => {
    monitor = new Monitor();
  });

  it("should increment counter", () => {
    monitor.inc("test_counter");
    expect(monitor.get("test_counter")).toBe(1);
    
    monitor.inc("test_counter", {}, 5);
    expect(monitor.get("test_counter")).toBe(6);
  });

  it("should set gauge", () => {
    monitor.set("test_gauge", 42);
    expect(monitor.get("test_gauge")).toBe(42);
    
    monitor.set("test_gauge", 100);
    expect(monitor.get("test_gauge")).toBe(100);
  });

  it("should track metrics with labels", () => {
    monitor.inc("requests", { method: "GET" });
    monitor.inc("requests", { method: "POST" });
    monitor.inc("requests", { method: "GET" });
    
    expect(monitor.get("requests", { method: "GET" })).toBe(2);
    expect(monitor.get("requests", { method: "POST" })).toBe(1);
  });

  it("should raise alerts", () => {
    const alerts: string[] = [];
    monitor.onAlert((alert) => alerts.push(alert.message));
    
    monitor.raiseAlert("warning", "Test warning");
    expect(alerts).toContain("Test warning");
  });

  it("should trigger alert on threshold", () => {
    const alerts: string[] = [];
    monitor.onAlert((alert) => alerts.push(alert.severity));
    
    monitor.setThreshold("errors", 5, 10);
    
    for (let i = 0; i < 6; i++) {
      monitor.inc("errors");
    }
    
    expect(alerts).toContain("warning");
  });

  it("should resolve alerts", () => {
    monitor.raiseAlert("info", "Test");
    const alert = monitor.getAlerts()[0];
    
    expect(monitor.getAlerts().length).toBe(1);
    
    monitor.resolveAlert(alert.id);
    expect(monitor.getAlerts().length).toBe(0);
    expect(monitor.getAlerts(true).length).toBe(1);
  });

  it("should export prometheus format", () => {
    monitor.inc("http_requests", { status: "200" });
    monitor.set("active_connections", 5);
    
    const output = monitor.export();
    expect(output).toContain('http_requests{status="200"} 1');
    expect(output).toContain("active_connections 5");
  });

  it("should return all metrics", () => {
    monitor.inc("counter1");
    monitor.set("gauge1", 10);
    
    const metrics = monitor.getMetrics();
    expect(metrics.length).toBe(2);
  });
});
