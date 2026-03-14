// In-memory metrics tracking for the live dashboard
// In production, this would be backed by Redis timeseries or Prometheus
let requestTimestamps = [];
let successCount = 0;
let rejectCount = 0;
let latencies = [];
let queueDepth = 0;

function setQueueDepth(depth) {
  queueDepth = depth;
}

function recordCheckout(success, latencyMs) {
  const now = Date.now();
  requestTimestamps.push(now);
  
  if (success) {
    successCount++;
  } else {
    rejectCount++;
  }

  latencies.push(latencyMs);
  if (latencies.length > 1000) {
    latencies.shift(); // Keep only last 1000 for P50/P99 calculation
  }
}

function getMetrics() {
  const now = Date.now();
  // Filter timestamps to only those in the last 10 seconds for QPS calculation
  requestTimestamps = requestTimestamps.filter(t => now - t <= 10000);
  
  // QPS = events in last 10s / 10
  const qps = Math.floor(requestTimestamps.length / 10);

  // Calculate latencies
  let p50 = 0;
  let p99 = 0;
  if (latencies.length > 0) {
    const sorted = [...latencies].sort((a, b) => a - b);
    p50 = sorted[Math.floor(sorted.length * 0.5)];
    p99 = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
  }

  return {
    qps,
    successCount,
    rejectCount,
    queueDepth,
    latencyP50: p50,
    latencyP99: p99
  };
}

module.exports = {
  setQueueDepth,
  recordCheckout,
  getMetrics
};
