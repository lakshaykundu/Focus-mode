import type { BlockTarget } from './blockList';

/**
 * FocusGuard only ever reads, adds or removes dynamic rules whose IDs fall in this range,
 * so rules created by any other logic are never touched.
 */
export const RULE_ID_MIN = 1_000_000;
export const RULE_ID_MAX = 1_999_999;
const RULE_ID_SPACE = RULE_ID_MAX - RULE_ID_MIN + 1;

/** The subset of `chrome.declarativeNetRequest.Rule` FocusGuard produces. */
export interface BlockRule {
  id: number;
  priority: number;
  action: { type: 'block' };
  condition: {
    requestDomains: string[];
    excludedRequestDomains?: string[];
    resourceTypes: ['main_frame'];
  };
}

/** Shape of any installed dynamic rule, including ones FocusGuard didn't create. */
export interface InstalledRule {
  id: number;
  priority?: number;
  action?: { type?: string };
  condition?: {
    requestDomains?: string[];
    excludedRequestDomains?: string[];
    resourceTypes?: string[];
  };
}

/** The slice of `chrome.declarativeNetRequest` the rule manager needs. */
export interface DnrApi {
  getDynamicRules(): Promise<readonly InstalledRule[]>;
  updateDynamicRules(options: { removeRuleIds: number[]; addRules: BlockRule[] }): Promise<void>;
}

export class RuleUpdateError extends Error {
  constructor(cause: unknown) {
    const detail = cause instanceof Error ? cause.message : String(cause);
    super(`Couldn't update blocking rules: ${detail}`);
    this.name = 'RuleUpdateError';
  }
}

export function isFocusGuardRuleId(id: number): boolean {
  return Number.isInteger(id) && id >= RULE_ID_MIN && id <= RULE_ID_MAX;
}

/** 32-bit FNV-1a: small, fast and deterministic across browser sessions. */
export function fnv1a(input: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/**
 * Deterministic rule IDs: each domain hashes into FocusGuard's range. Collisions (very rare in a
 * million-slot space) are resolved by linear probing in sorted-domain order, so the result
 * depends only on the set of domains, never on the order the user added them.
 */
export function assignRuleIds(domains: Iterable<string>): Map<string, number> {
  const ids = new Map<string, number>();
  const used = new Set<number>();
  for (const domain of [...new Set(domains)].sort()) {
    let offset = fnv1a(domain) % RULE_ID_SPACE;
    while (used.has(RULE_ID_MIN + offset)) offset = (offset + 1) % RULE_ID_SPACE;
    const id = RULE_ID_MIN + offset;
    used.add(id);
    ids.set(domain, id);
  }
  return ids;
}

/** Build one `main_frame` block rule per target. Sub-resources are never blocked. */
export function buildBlockRules(targets: readonly BlockTarget[]): BlockRule[] {
  const ids = assignRuleIds(targets.map((target) => target.domain));
  return targets
    .map((target): BlockRule => {
      const condition: BlockRule['condition'] = {
        requestDomains: [target.domain],
        resourceTypes: ['main_frame'],
      };
      if (target.excludedDomains.length > 0) {
        condition.excludedRequestDomains = [...target.excludedDomains];
      }
      return { id: ids.get(target.domain)!, priority: 1, action: { type: 'block' }, condition };
    })
    .sort((a, b) => a.id - b.id);
}

/** Order-insensitive fingerprint used to decide whether an installed rule is already correct. */
function fingerprint(rule: InstalledRule): string {
  const condition = rule.condition ?? {};
  return JSON.stringify([
    rule.priority ?? 1,
    rule.action?.type,
    [...(condition.requestDomains ?? [])].sort(),
    [...(condition.excludedRequestDomains ?? [])].sort(),
    [...(condition.resourceTypes ?? [])].sort(),
  ]);
}

export interface RuleDiff {
  removeRuleIds: number[];
  addRules: BlockRule[];
}

/** Minimal change set that turns FocusGuard's installed rules into `desired`. */
export function diffRules(
  installed: readonly InstalledRule[],
  desired: readonly BlockRule[],
): RuleDiff {
  const ours = new Map(installed.filter((rule) => isFocusGuardRuleId(rule.id)).map((r) => [r.id, r]));
  const desiredById = new Map(desired.map((rule) => [rule.id, rule]));

  const removeRuleIds: number[] = [];
  const addRules: BlockRule[] = [];
  for (const [id, rule] of ours) {
    const want = desiredById.get(id);
    if (!want) removeRuleIds.push(id);
    else if (fingerprint(rule) !== fingerprint(want)) {
      // Same ID, different condition: replace it in the same atomic update.
      removeRuleIds.push(id);
      addRules.push(want);
    }
  }
  for (const rule of desired) {
    if (!ours.has(rule.id)) addRules.push(rule);
  }
  return {
    removeRuleIds: removeRuleIds.sort((a, b) => a - b),
    addRules: addRules.sort((a, b) => a.id - b.id),
  };
}

/**
 * Make the installed FocusGuard rules exactly match `targets` (an empty list removes them all).
 * Idempotent: when nothing differs, no update call is made. Throws `RuleUpdateError` on failure;
 * Chrome applies `updateDynamicRules` atomically, so a failure leaves the previous rules intact.
 */
export async function reconcileRules(dnr: DnrApi, targets: readonly BlockTarget[]): Promise<RuleDiff> {
  try {
    const installed = await dnr.getDynamicRules();
    const diff = diffRules(installed, buildBlockRules(targets));
    if (diff.removeRuleIds.length > 0 || diff.addRules.length > 0) {
      await dnr.updateDynamicRules(diff);
    }
    return diff;
  } catch (error) {
    throw error instanceof RuleUpdateError ? error : new RuleUpdateError(error);
  }
}
