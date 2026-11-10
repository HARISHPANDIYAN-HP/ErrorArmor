import { logger } from '../utils/logger.js';

/** Queue interface. Swap InMemoryQueue for BullMQ/SQS/etc. by implementing enqueue(jobId). */
export class JobQueue {
  // eslint-disable-next-line no-unused-vars
  enqueue(jobId) { throw new Error('enqueue() not implemented'); }
}

export class InMemoryQueue extends JobQueue {
  constructor(handler, concurrency = 2) {
    super();
    this.handler = handler;
    this.concurrency = concurrency;
    this.pending = [];
    this.running = 0;
  }

  enqueue(jobId) {
    this.pending.push(String(jobId));
    setImmediate(() => this.pump());
  }

  pump() {
    while (this.running < this.concurrency && this.pending.length) {
      const id = this.pending.shift();
      this.running++;
      Promise.resolve()
        .then(() => this.handler(id))
        .catch((e) => logger.error('Job handler crashed', { id, error: e?.message }))
        .finally(() => { this.running--; this.pump(); });
    }
  }
}
