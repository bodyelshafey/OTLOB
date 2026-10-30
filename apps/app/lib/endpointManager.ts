/**
 * Decides which API endpoint the app talks to, and when to change its mind.
 * Pure state machine (no React Native / axios / zustand imports) with every
 * side effect injected, so each scenario is unit-testable deterministically.
 * lib/apiEndpoint.ts wires the real fetch, clock and timers.
 *
 * Roles
 *   primary — Railway. Always preferred.
 *   local   — the developer's machine. Used ONLY as a fallback, and only when
 *             `failoverEnabled` (development builds with a local URL available).
 *
 * Passive mode (failoverEnabled = false — every release build): there is
 * nothing to switch to, so the manager never probes on startup, never polls
 * while the API is healthy, and exists only to (a) report "unavailable" after
 * real request failures and (b) notice recovery. Zero background traffic in
 * the normal case.
 *
 * Failover rules (see README §"Local / Railway"):
 *   - Selection is decided by health PROBES, never by one request's failure.
 *     A request failure merely *triggers* a re-check (rate-limited by a cooldown).
 *   - Leaving primary at runtime needs `runtimeConfirmations` failed probes.
 *   - Returning to primary needs `recoverySuccesses` consecutive healthy probes
 *     AND `minDwellMs` since the last switch (anti-flapping).
 *   - Recovery polling only runs while the app is in the foreground, with
 *     growing intervals (15s → 30s → 60s), and only while on the fallback or
 *     unavailable. Nothing polls while on a healthy primary.
 *   - The manager never replays or re-routes an in-flight request. It only
 *     changes where FUTURE requests go; whether a request may be retried is
 *     decided by the caller (lib/api.ts retries idempotent GETs only).
 */

export type EndpointId = "primary" | "local";
export type ConnectionStatus = "checking" | "ready" | "unavailable";

export interface EndpointSnapshot {
  status: ConnectionStatus;
  /** Endpoint requests are currently sent to (kept even while "unavailable"). */
  active: EndpointId;
  baseUrl: string;
  failoverEnabled: boolean;
  /** Running on local although a primary is configured. */
  onFallback: boolean;
  primaryUrl: string;
  localUrl: string;
}

export interface Tuning {
  /** Minimum gap between request-failure-triggered re-checks. */
  reselectCooldownMs: number;
  /** Pause between the confirming probes of a suspected-down primary. */
  confirmDelayMs: number;
  /** Failed probes required before leaving primary at runtime. */
  runtimeConfirmations: number;
  /** Foreground recovery-poll delays; the last value repeats. */
  recoveryIntervalsMs: number[];
  /** Consecutive healthy primary probes needed to return from the fallback. */
  recoverySuccesses: number;
  /** Minimum time on an endpoint before returning to primary. */
  minDwellMs: number;
}

export const DEFAULT_TUNING: Tuning = {
  reselectCooldownMs: 10_000,
  confirmDelayMs: 1_500,
  runtimeConfirmations: 2,
  recoveryIntervalsMs: [15_000, 30_000, 60_000],
  recoverySuccesses: 2,
  minDwellMs: 30_000,
};

export interface ManagerOptions {
  primaryUrl: string;
  /** "" when there is no local candidate. */
  localUrl: string;
  failoverEnabled: boolean;
  /** Resolve true iff the API at this base URL is healthy. Must bound its own time. */
  probe: (baseUrl: string) => Promise<boolean>;
  now?: () => number;
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
  sleep?: (ms: number) => Promise<void>;
  tuning?: Partial<Tuning>;
}

export class EndpointManager {
  private readonly primaryUrl: string;
  private readonly localUrl: string;
  private readonly hasPrimary: boolean;
  private readonly hasLocal: boolean;
  private readonly failover: boolean;
  private readonly tuning: Tuning;
  private readonly probe: (baseUrl: string) => Promise<boolean>;
  private readonly now: () => number;
  private readonly setTimer: (fn: () => void, ms: number) => unknown;
  private readonly clearTimer: (handle: unknown) => void;
  private readonly sleep: (ms: number) => Promise<void>;

  private status: ConnectionStatus;
  private active: EndpointId;
  private snapshot: EndpointSnapshot;
  private listeners = new Set<() => void>();

  private started = false;
  private initial: Promise<void> | null = null;
  private selecting: Promise<void> | null = null;
  private ticking = false;
  /** When the last FAILURE-triggered re-check ran (startup/recovery/manual checks don't count). */
  private lastReselectAt = -Infinity;
  private lastSwitchAt = -Infinity;
  private recoveryOk = 0;
  private recoveryStep = 0;
  private timer: unknown = null;
  private foreground = true;
  private disposed = false;

  constructor(opts: ManagerOptions) {
    this.primaryUrl = opts.primaryUrl;
    this.localUrl = opts.localUrl;
    this.hasPrimary = !!opts.primaryUrl;
    this.hasLocal = !!opts.localUrl;
    // Failover needs BOTH endpoints; otherwise there's nothing to fail over to.
    this.failover = opts.failoverEnabled && this.hasPrimary && this.hasLocal;
    this.tuning = { ...DEFAULT_TUNING, ...opts.tuning };
    this.probe = opts.probe;
    this.now = opts.now ?? (() => Date.now());
    this.setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
    this.clearTimer = opts.clearTimer ?? ((h) => clearTimeout(h as ReturnType<typeof setTimeout>));
    this.sleep = opts.sleep ?? ((ms) => new Promise((r) => setTimeout(r, ms)));

    this.active = this.hasPrimary ? "primary" : "local";
    // Passive mode trusts the configured endpoint until real requests say otherwise.
    this.status = this.failover ? "checking" : "ready";
    this.snapshot = this.buildSnapshot();
  }

  // ---- read side -----------------------------------------------------------

  getSnapshot(): EndpointSnapshot {
    return this.snapshot;
  }

  getBaseUrl(): string {
    return this.snapshot.baseUrl;
  }

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // ---- lifecycle -----------------------------------------------------------

  /** Begin the initial endpoint selection (failover mode only). Idempotent. */
  start(): Promise<void> {
    if (!this.started) {
      this.started = true;
      if (this.failover) {
        // Startup is a single, fast probe per candidate — the user is waiting.
        this.initial = this.select(1).finally(() => {
          this.initial = null;
        });
      }
    }
    return this.initial ?? Promise.resolve();
  }

  /**
   * Resolves once the initial selection (if any) has finished. Bounded by the
   * probe timeouts, and always resolves — requests then go to whatever is
   * active, even when "unavailable", so they can fail naturally and be retried
   * by the user.
   */
  ensureReady(): Promise<void> {
    return this.initial ?? Promise.resolve();
  }

  dispose(): void {
    this.disposed = true;
    this.cancelTimer();
    this.listeners.clear();
  }

  /** App foreground/background. Recovery polling only runs in the foreground. */
  setForeground(foreground: boolean): void {
    this.foreground = foreground;
    this.cancelTimer();
    if (this.disposed || !foreground) return;
    // Coming back to the foreground: don't wait out a stale interval.
    if (this.needsRecovery()) {
      this.timer = this.setTimer(() => void this.tick(), 0);
    }
  }

  // ---- signals from the networking layer -----------------------------------

  /** The server answered with ANY HTTP response (even a 4xx): it is reachable. */
  reportSuccess(): void {
    if (this.status === "unavailable") this.commit(this.active, "ready");
  }

  /**
   * A request failed in a way that suggests the server is unavailable.
   * Triggers a (cooldown-limited, single-flight) health re-check; never
   * switches by itself and never touches the failed request.
   */
  reportFailure(): Promise<void> {
    return this.reselect(false).catch(() => {});
  }

  /** Manual retry from the UI: ignores the cooldown. */
  retry(): Promise<void> {
    return this.reselect(true, 1).catch(() => {});
  }

  // ---- internals -----------------------------------------------------------

  private reselect(force: boolean, confirmations = this.tuning.runtimeConfirmations): Promise<void> {
    if (this.selecting) return this.selecting;
    if (this.initial) return this.initial;
    // The cooldown only rate-limits failure-triggered re-checks against each
    // other (a burst of failing requests must not become a burst of probes).
    // It deliberately ignores startup/recovery selections, so the first real
    // failure after launch is never swallowed.
    if (!force && this.now() - this.lastReselectAt < this.tuning.reselectCooldownMs) {
      return Promise.resolve();
    }
    this.lastReselectAt = this.now();
    const run = this.select(confirmations);
    void run.finally(() => {
      this.lastReselectAt = this.now();
    });
    return run;
  }

  private candidates(): EndpointId[] {
    if (this.hasPrimary) return this.failover ? ["primary", "local"] : ["primary"];
    return this.hasLocal ? ["local"] : [];
  }

  private urlOf(id: EndpointId): string {
    return id === "primary" ? this.primaryUrl : this.localUrl;
  }

  private async safeProbe(id: EndpointId): Promise<boolean> {
    try {
      return await this.probe(this.urlOf(id));
    } catch {
      return false;
    }
  }

  private async probeConfirmed(id: EndpointId, attempts: number): Promise<boolean> {
    for (let i = 0; i < attempts; i++) {
      if (await this.safeProbe(id)) return true;
      if (i < attempts - 1) await this.sleep(this.tuning.confirmDelayMs);
    }
    return false;
  }

  private select(confirmations: number): Promise<void> {
    if (this.selecting) return this.selecting;
    this.selecting = this.doSelect(confirmations).finally(() => {
      this.selecting = null;
      this.updateTimer();
    });
    return this.selecting;
  }

  private async doSelect(confirmations: number): Promise<void> {
    const candidates = this.candidates();
    for (let i = 0; i < candidates.length; i++) {
      const id = candidates[i];
      // Only the preferred endpoint gets the confirming re-probes; a fallback
      // candidate is accepted on a single healthy answer.
      const ok = i === 0 ? await this.probeConfirmed(id, confirmations) : await this.safeProbe(id);
      if (this.disposed) return;
      if (ok) {
        this.commit(id, "ready");
        return;
      }
    }
    this.commit(this.active, "unavailable");
  }

  private needsRecovery(): boolean {
    if (this.candidates().length === 0) return false;
    return this.status === "unavailable" || (this.failover && this.active === "local");
  }

  private cancelTimer(): void {
    if (this.timer != null) {
      this.clearTimer(this.timer);
      this.timer = null;
    }
  }

  private updateTimer(): void {
    this.cancelTimer();
    if (this.disposed || !this.foreground || !this.needsRecovery()) return;
    const steps = this.tuning.recoveryIntervalsMs;
    const delay = steps[Math.min(this.recoveryStep, steps.length - 1)];
    this.timer = this.setTimer(() => void this.tick(), delay);
  }

  private async tick(): Promise<void> {
    this.timer = null;
    if (this.disposed || !this.foreground || this.ticking) return;
    if (this.selecting) {
      this.updateTimer();
      return;
    }
    this.ticking = true;
    try {
      if (this.status === "unavailable") {
        await this.select(1);
        if (this.status === "unavailable") this.recoveryStep++;
      } else if (this.failover && this.active === "local") {
        const ok = await this.safeProbe("primary");
        this.recoveryOk = ok ? this.recoveryOk + 1 : 0;
        const dwelled = this.now() - this.lastSwitchAt >= this.tuning.minDwellMs;
        if (ok && this.recoveryOk >= this.tuning.recoverySuccesses && dwelled) {
          this.commit("primary", "ready");
        } else if (!ok) {
          this.recoveryStep++; // primary still down: back off
        }
      }
    } finally {
      this.ticking = false;
      this.updateTimer();
    }
  }

  private commit(active: EndpointId, status: ConnectionStatus): void {
    if (this.disposed) return;
    const endpointChanged = active !== this.active;
    const statusChanged = status !== this.status;
    if (!endpointChanged && !statusChanged) return;

    if (endpointChanged) {
      this.active = active;
      this.lastSwitchAt = this.now();
    }
    this.status = status;
    this.recoveryOk = 0;
    this.recoveryStep = 0;
    this.snapshot = this.buildSnapshot();
    this.updateTimer();
    for (const l of [...this.listeners]) l();
  }

  private buildSnapshot(): EndpointSnapshot {
    return {
      status: this.status,
      active: this.active,
      baseUrl: this.urlOf(this.active),
      failoverEnabled: this.failover,
      onFallback: this.hasPrimary && this.active === "local",
      primaryUrl: this.primaryUrl,
      localUrl: this.localUrl,
    };
  }
}
