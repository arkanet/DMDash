/** Map feature keys -> env var names (Vite exposes only VITE_*). */
export const FLAG_ENV = {
  persistNodeDB: "VITE_PERSIST_NODE_DB",
  persistMessages: "VITE_PERSIST_MESSAGES",
  persistDevices: "VITE_PERSIST_DEVICES",
  persistApp: "VITE_PERSIST_APP",
} as const;

export type FlagKey = keyof typeof FLAG_ENV;
export type Flags = Record<FlagKey, boolean>;

type Listener = () => void;

class FeatureFlags {
  private base: Flags;
  private overrides: Partial<Flags> = {};
  private listeners = new Set<Listener>();

  constructor(base: Flags) {
    this.base = base;
  }

  get(key: FlagKey): boolean {
    return this.overrides[key] ?? this.base[key];
  }

  /** Get all flags */
  all(): Flags {
    return { ...this.base, ...this.overrides };
  }

  /** Optional dev/test override. Pass null to clear. */
  setOverride(key: FlagKey, val: boolean | null) {
    if (val === null) {
      delete this.overrides[key];
    } else {
      this.overrides[key] = val;
    }
    this.emit();
  }

  /** Set many at once */
  setOverrides(partial: Partial<Flags>) {
    for (const [k, v] of Object.entries(partial)) {
      this.setOverride(k as FlagKey, v as boolean);
      if (v === null) {
        delete this.overrides[k as FlagKey];
      } else {
        this.overrides[k as FlagKey] = v as boolean;
      }
    }
    this.emit();
  }

  subscribe(fn: Listener) {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    for (const listener of this.listeners) {
      listener();
    }
  }
}

export function createFeatureFlags(env: Record<string, unknown>): FeatureFlags {
  const base = Object.fromEntries(
    (Object.keys(FLAG_ENV) as FlagKey[]).map((key) => [key, env[FLAG_ENV[key]] !== undefined]),
  ) as Flags;
  return new FeatureFlags(base);
}

export const featureFlags = createFeatureFlags(import.meta.env);
