import type { AlarmsApi, FocusDeps } from '@/lib/focusController';
import type { BlockRule, DnrApi, InstalledRule } from '@/lib/ruleManager';
import type { StorageArea } from '@/lib/storage';
import type { TabInfo, TabsApi } from '@/lib/tabEnforcer';

/** In-memory chrome.storage.local. Values are deep-cloned like the real API. */
export class FakeStorage implements StorageArea {
  data = new Map<string, unknown>();
  failNextSet = false;

  async get(keys: string[]) {
    const out: Record<string, unknown> = {};
    for (const key of keys) if (this.data.has(key)) out[key] = structuredClone(this.data.get(key));
    return out;
  }

  async set(items: Record<string, unknown>) {
    if (this.failNextSet) {
      this.failNextSet = false;
      throw new Error('QUOTA_BYTES quota exceeded');
    }
    for (const [key, value] of Object.entries(items)) this.data.set(key, structuredClone(value));
  }
}

/** In-memory declarativeNetRequest dynamic rules with Chrome's atomic, ID-checked updates. */
export class FakeDnr implements DnrApi {
  rules = new Map<number, InstalledRule>();
  updateCalls = 0;
  failNextUpdate: string | null = null;

  async getDynamicRules() {
    return [...this.rules.values()].map((rule) => structuredClone(rule));
  }

  async updateDynamicRules({ removeRuleIds, addRules }: { removeRuleIds: number[]; addRules: BlockRule[] }) {
    this.updateCalls++;
    if (this.failNextUpdate) {
      const message = this.failNextUpdate;
      this.failNextUpdate = null;
      throw new Error(message);
    }
    const next = new Map(this.rules);
    for (const id of removeRuleIds) next.delete(id);
    for (const rule of addRules) {
      if (next.has(rule.id)) throw new Error(`Rule with id ${rule.id} does not have a unique ID.`);
      next.set(rule.id, structuredClone(rule));
    }
    this.rules = next;
  }

  /** Domains currently blocked by FocusGuard-range rules. */
  blockedDomains(): string[] {
    return [...this.rules.values()]
      .filter((rule) => rule.id >= 1_000_000 && rule.id <= 1_999_999)
      .flatMap((rule) => rule.condition?.requestDomains ?? [])
      .sort();
  }
}

export class FakeAlarms implements AlarmsApi {
  alarms = new Map<string, number>();

  async create(name: string, info: { when: number }) {
    this.alarms.set(name, info.when);
  }
  async clear(name: string) {
    return this.alarms.delete(name);
  }
  async get(name: string) {
    const scheduledTime = this.alarms.get(name);
    return scheduledTime === undefined ? undefined : { scheduledTime };
  }
}

export class FakeTabs implements TabsApi {
  reloaded: number[] = [];
  constructor(public tabs: TabInfo[] = []) {}

  async query() {
    return this.tabs.map((tab) => ({ ...tab }));
  }
  async reload(tabId: number) {
    if (!this.tabs.some((tab) => tab.id === tabId)) throw new Error(`No tab with id: ${tabId}`);
    this.reloaded.push(tabId);
  }
}

export function createFakeDeps(start = new Date(2026, 9, 13, 9, 0).getTime()) {
  const clock = { now: start };
  let counter = 0;
  const storage = new FakeStorage();
  const dnr = new FakeDnr();
  const alarms = new FakeAlarms();
  const tabs = new FakeTabs();
  const deps: FocusDeps = {
    storage,
    dnr,
    alarms,
    tabs,
    now: () => clock.now,
    createId: () => `session-${++counter}`,
  };
  return {
    deps,
    storage,
    dnr,
    alarms,
    tabs,
    clock,
    advance(ms: number) {
      clock.now += ms;
    },
  };
}
