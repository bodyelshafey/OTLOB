/**
 * Deterministic clock + timer queue for EndpointManager. `advance(ms)` runs
 * every timer that falls due (in order), letting promises settle in between,
 * so multi-step async flows (probe → confirm delay → probe → commit) are
 * exercised without any real waiting.
 */
const flush = async () => {
  for (let i = 0; i < 25; i++) await new Promise((r) => setImmediate(r));
};

class FakeClock {
  constructor() {
    this.t = 0;
    this.timers = [];
    this.seq = 0;
    this.now = () => this.t;
    this.setTimer = (fn, ms) => {
      const handle = { id: ++this.seq, at: this.t + ms, fn };
      this.timers.push(handle);
      return handle;
    };
    this.clearTimer = (handle) => {
      this.timers = this.timers.filter((x) => x !== handle);
    };
    this.sleep = (ms) => new Promise((resolve) => this.setTimer(resolve, ms));
  }

  get pending() {
    return this.timers.length;
  }

  async settle() {
    await flush();
  }

  async advance(ms) {
    const target = this.t + ms;
    for (;;) {
      await flush();
      const due = this.timers.filter((x) => x.at <= target).sort((a, b) => a.at - b.at || a.id - b.id)[0];
      if (!due) break;
      this.timers = this.timers.filter((x) => x !== due);
      this.t = Math.max(this.t, due.at);
      due.fn();
    }
    this.t = target;
    await flush();
  }
}

/** Scriptable network: which base URLs currently answer their health probe. */
class FakeNetwork {
  constructor(up = {}) {
    this.up = { ...up };
    this.calls = [];
    this.probe = async (url) => {
      this.calls.push(url);
      return !!this.up[url];
    };
  }
  callsTo(url) {
    return this.calls.filter((c) => c === url).length;
  }
}

module.exports = { FakeClock, FakeNetwork, flush };
