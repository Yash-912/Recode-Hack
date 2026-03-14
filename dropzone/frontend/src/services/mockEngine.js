/* Mock Flash Sale Engine
   Simulates the backend for standalone demo */

const NAMES = [
  'Alex', 'Jordan', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Quinn', 'Drew',
  'Avery', 'Blake', 'Charlie', 'Dakota', 'Emery', 'Finley', 'Harper', 'Kai',
  'Logan', 'Parker', 'Reese', 'Sage', 'Skyler', 'Tatum', 'Val', 'Wren',
];

function randomName() {
  return NAMES[Math.floor(Math.random() * NAMES.length)];
}

function randomId() {
  return Math.random().toString(36).substring(2, 6).toUpperCase();
}

function randomLatency(min = 15, max = 120) {
  return Math.floor(Math.random() * (max - min) + min);
}

export function createMockEngine(initialStock = 10) {
  let stock = initialStock;
  const totalStock = initialStock;
  let sold = 0;
  let rejected = 0;
  let queueDepth = 0;
  const events = [];
  const listeners = {};

  function emit(event, data) {
    if (listeners[event]) {
      listeners[event].forEach(fn => fn(data));
    }
  }

  function on(event, fn) {
    if (!listeners[event]) listeners[event] = [];
    listeners[event].push(fn);
    return () => {
      listeners[event] = listeners[event].filter(f => f !== fn);
    };
  }

  function attemptPurchase() {
    const name = randomName();
    const id = randomId();
    const latency = randomLatency();

    if (stock > 0) {
      stock--;
      sold++;
      const event = {
        id: Date.now().toString() + id,
        type: 'confirmed',
        userId: id,
        userName: name,
        latency,
        remaining: stock,
        timestamp: Date.now(),
      };
      events.unshift(event);
      emit('purchase', event);
      emit('inventory_update', { remaining: stock, total: totalStock });
      return event;
    } else {
      rejected++;
      const event = {
        id: Date.now().toString() + id,
        type: 'rejected',
        userId: id,
        userName: name,
        latency,
        remaining: 0,
        timestamp: Date.now(),
      };
      events.unshift(event);
      emit('purchase', event);
      return event;
    }
  }

  function naiveAttemptPurchase() {
    const name = randomName();
    const id = randomId();
    const latency = randomLatency();
    const readStock = stock;

    // Naive: read then write with a gap (simulated race)
    if (readStock > 0) {
      stock--;
      sold++;
      const event = {
        id: Date.now().toString() + id,
        type: 'confirmed',
        userId: id,
        userName: name,
        latency,
        remaining: stock,
        timestamp: Date.now(),
      };
      events.unshift(event);
      emit('purchase', event);
      emit('inventory_update', { remaining: stock, total: totalStock });
      return event;
    } else {
      rejected++;
      const event = {
        id: Date.now().toString() + id,
        type: 'rejected',
        userId: id,
        userName: name,
        latency,
        remaining: stock,
        timestamp: Date.now(),
      };
      events.unshift(event);
      emit('purchase', event);
      return event;
    }
  }

  function reset(newStock) {
    stock = newStock || initialStock;
    sold = 0;
    rejected = 0;
    queueDepth = 0;
    events.length = 0;
    emit('reset', { stock, total: totalStock });
    emit('inventory_update', { remaining: stock, total: newStock || totalStock });
  }

  function getState() {
    return {
      stock,
      totalStock,
      sold,
      rejected,
      queueDepth,
      events: events.slice(0, 50),
    };
  }

  function simulateLoad(count = 500, mode = 'protected', interval = 5) {
    let i = 0;
    queueDepth = count;
    emit('load_start', { count, mode });

    const timer = setInterval(() => {
      if (i >= count) {
        clearInterval(timer);
        queueDepth = 0;
        emit('load_complete', getState());
        return;
      }

      const batchSize = Math.min(Math.floor(Math.random() * 5) + 1, count - i);
      for (let j = 0; j < batchSize; j++) {
        if (mode === 'naive') {
          naiveAttemptPurchase();
        } else {
          attemptPurchase();
        }
        i++;
        queueDepth = Math.max(0, count - i);
      }
      emit('queue_update', { depth: queueDepth });
    }, interval);

    return () => clearInterval(timer);
  }

  return { on, attemptPurchase, naiveAttemptPurchase, reset, getState, simulateLoad };
}

export function createDemoEngine() {
  const naiveEngine = createMockEngine(10);
  const protectedEngine = createMockEngine(10);

  function runComparison(requestCount = 100) {
    // Naive: allow overselling by batching concurrent reads
    naiveEngine.reset(10);
    protectedEngine.reset(10);

    const naiveCancel = naiveEngine.simulateLoad(requestCount, 'naive', 3);
    const protectedCancel = protectedEngine.simulateLoad(requestCount, 'protected', 3);

    return () => {
      naiveCancel();
      protectedCancel();
    };
  }

  return { naiveEngine, protectedEngine, runComparison };
}
