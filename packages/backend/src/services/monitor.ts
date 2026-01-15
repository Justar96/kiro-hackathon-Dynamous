type MetricType = "counter" | "gauge" | "histogram";

interface Metric {
  name: string;
  type: MetricType;
  value: number;
  labels: Record<string, string>;
  timestamp: number;
}

interface Alert {
  id: string;
  severity: "info" | "warning" | "critical";
  message: string;
  timestamp: number;
  resolved: boolean;
}

type AlertHandler = (alert: Alert) => void;

export class Monitor {
  private metrics = new Map<string, Metric>();
  private alerts: Alert[] = [];
  private alertHandlers: AlertHandler[] = [];
  private thresholds = new Map<string, { warning: number; critical: number }>();

  // Counters
  inc(name: string, labels: Record<string, string> = {}, delta = 1): void {
    const key = this.key(name, labels);
    const current = this.metrics.get(key);
    this.metrics.set(key, {
      name,
      type: "counter",
      value: (current?.value || 0) + delta,
      labels,
      timestamp: Date.now(),
    });
    this.checkThreshold(name, labels);
  }

  // Gauges
  set(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.key(name, labels);
    this.metrics.set(key, { name, type: "gauge", value, labels, timestamp: Date.now() });
    this.checkThreshold(name, labels);
  }

  // Histograms (simplified - stores latest value)
  observe(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.key(name, labels);
    this.metrics.set(key, { name, type: "histogram", value, labels, timestamp: Date.now() });
  }

  get(name: string, labels: Record<string, string> = {}): number {
    return this.metrics.get(this.key(name, labels))?.value || 0;
  }

  setThreshold(name: string, warning: number, critical: number): void {
    this.thresholds.set(name, { warning, critical });
  }

  private checkThreshold(name: string, labels: Record<string, string>): void {
    const threshold = this.thresholds.get(name);
    if (!threshold) return;

    const value = this.get(name, labels);
    const labelStr = JSON.stringify(labels);

    if (value >= threshold.critical) {
      this.raiseAlert("critical", `${name} critical: ${value} (${labelStr})`);
    } else if (value >= threshold.warning) {
      this.raiseAlert("warning", `${name} warning: ${value} (${labelStr})`);
    }
  }

  raiseAlert(severity: Alert["severity"], message: string): void {
    const alert: Alert = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      severity,
      message,
      timestamp: Date.now(),
      resolved: false,
    };
    this.alerts.push(alert);
    this.alertHandlers.forEach((h) => h(alert));
  }

  resolveAlert(id: string): void {
    const alert = this.alerts.find((a) => a.id === id);
    if (alert) alert.resolved = true;
  }

  onAlert(handler: AlertHandler): void {
    this.alertHandlers.push(handler);
  }

  getAlerts(includeResolved = false): Alert[] {
    return includeResolved ? this.alerts : this.alerts.filter((a) => !a.resolved);
  }

  getMetrics(): Metric[] {
    return Array.from(this.metrics.values());
  }

  // Prometheus-style export
  export(): string {
    const lines: string[] = [];
    for (const m of this.metrics.values()) {
      const labels = Object.entries(m.labels)
        .map(([k, v]) => `${k}="${v}"`)
        .join(",");
      const labelStr = labels ? `{${labels}}` : "";
      lines.push(`${m.name}${labelStr} ${m.value}`);
    }
    return lines.join("\n");
  }

  private key(name: string, labels: Record<string, string>): string {
    return `${name}:${JSON.stringify(labels)}`;
  }
}

// Singleton instance
export const monitor = new Monitor();

// Pre-configure thresholds
monitor.setThreshold("orders_rejected_total", 10, 50);
monitor.setThreshold("settlement_failures_total", 1, 5);
monitor.setThreshold("pending_trades_count", 500, 1000);
