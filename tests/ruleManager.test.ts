import { describe, expect, it } from 'vitest';
import type { BlockTarget } from '@/lib/blockList';
import {
  RULE_ID_MAX,
  RULE_ID_MIN,
  RuleUpdateError,
  assignRuleIds,
  buildBlockRules,
  diffRules,
  fnv1a,
  reconcileRules,
} from '@/lib/ruleManager';
import { FakeDnr } from './helpers/fakes';

const t = (domain: string, excludedDomains: string[] = []): BlockTarget => ({ domain, excludedDomains });

describe('buildBlockRules', () => {
  it('creates one main_frame block rule per domain using requestDomains', () => {
    const [rule] = buildBlockRules([t('instagram.com')]);
    expect(rule).toEqual({
      id: expect.any(Number),
      priority: 1,
      action: { type: 'block' },
      condition: { requestDomains: ['instagram.com'], resourceTypes: ['main_frame'] },
    });
    // No urlFilter substring matching, and no sub-resource blocking.
    expect(rule!.condition).not.toHaveProperty('urlFilter');
  });

  it('adds excludedRequestDomains for independently allowed subdomains', () => {
    const [rule] = buildBlockRules([t('youtube.com', ['music.youtube.com'])]);
    expect(rule!.condition.excludedRequestDomains).toEqual(['music.youtube.com']);
  });

  it('allocates unique IDs inside the FocusGuard range', () => {
    const rules = buildBlockRules(['a.com', 'b.com', 'c.com', 'd.org'].map((d) => t(d)));
    const ids = rules.map((r) => r.id);
    expect(new Set(ids).size).toBe(4);
    for (const id of ids) {
      expect(id).toBeGreaterThanOrEqual(RULE_ID_MIN);
      expect(id).toBeLessThanOrEqual(RULE_ID_MAX);
    }
  });
});

describe('rule ID stability', () => {
  it('gives a domain the same ID regardless of order or other domains', () => {
    const a = assignRuleIds(['instagram.com', 'reddit.com']);
    const b = assignRuleIds(['x.com', 'reddit.com', 'tiktok.com', 'instagram.com']);
    expect(a.get('instagram.com')).toBe(b.get('instagram.com'));
    expect(a.get('reddit.com')).toBe(b.get('reddit.com'));
    expect(a.get('instagram.com')).toBe(RULE_ID_MIN + (fnv1a('instagram.com') % (RULE_ID_MAX - RULE_ID_MIN + 1)));
  });

  it('resolves hash collisions deterministically by linear probing', () => {
    // Find two domains whose hashes collide in the ID space.
    const space = RULE_ID_MAX - RULE_ID_MIN + 1;
    const seen = new Map<number, string>();
    let pair: [string, string] | null = null;
    for (let i = 0; !pair; i++) {
      const domain = `site${i}.com`;
      const slot = fnv1a(domain) % space;
      const other = seen.get(slot);
      if (other) pair = [other, domain];
      else seen.set(slot, domain);
    }
    const [first, second] = pair.sort();
    const ids = assignRuleIds([second!, first!]);
    expect(ids.get(first!)).toBe(RULE_ID_MIN + (fnv1a(first!) % space));
    expect(ids.get(second!)).toBe(ids.get(first!)! + 1);
    expect(assignRuleIds([first!, second!])).toEqual(ids);
  });
});

describe('diffRules / reconcileRules', () => {
  it('is idempotent: a second reconcile makes no update call', async () => {
    const dnr = new FakeDnr();
    await reconcileRules(dnr, [t('instagram.com'), t('reddit.com')]);
    expect(dnr.updateCalls).toBe(1);
    const diff = await reconcileRules(dnr, [t('reddit.com'), t('instagram.com')]);
    expect(diff).toEqual({ removeRuleIds: [], addRules: [] });
    expect(dnr.updateCalls).toBe(1);
  });

  it('adds and removes only what changed', async () => {
    const dnr = new FakeDnr();
    await reconcileRules(dnr, [t('instagram.com'), t('reddit.com')]);
    const ids = assignRuleIds(['instagram.com', 'reddit.com', 'x.com']);
    const diff = await reconcileRules(dnr, [t('instagram.com'), t('x.com')]);
    expect(diff.removeRuleIds).toEqual([ids.get('reddit.com')]);
    expect(diff.addRules.map((r) => r.condition.requestDomains[0])).toEqual(['x.com']);
    expect(dnr.blockedDomains()).toEqual(['instagram.com', 'x.com']);
  });

  it('replaces a rule whose condition changed, in one atomic update', async () => {
    const dnr = new FakeDnr();
    await reconcileRules(dnr, [t('youtube.com')]);
    await reconcileRules(dnr, [t('youtube.com', ['music.youtube.com'])]);
    const [rule] = await dnr.getDynamicRules();
    expect(rule!.condition?.excludedRequestDomains).toEqual(['music.youtube.com']);
    expect(dnr.updateCalls).toBe(2);
  });

  it('never touches rules outside the FocusGuard ID range', async () => {
    const dnr = new FakeDnr();
    const foreign = { id: 7, priority: 1, action: { type: 'block' }, condition: { requestDomains: ['ads.example'] } };
    dnr.rules.set(7, foreign);
    await reconcileRules(dnr, [t('instagram.com')]);
    await reconcileRules(dnr, []);
    expect([...dnr.rules.values()]).toEqual([foreign]);
    expect(diffRules([foreign], []).removeRuleIds).toEqual([]);
  });

  it('wraps Chrome failures in RuleUpdateError and leaves previous rules intact', async () => {
    const dnr = new FakeDnr();
    await reconcileRules(dnr, [t('instagram.com')]);
    dnr.failNextUpdate = 'Dynamic rule count exceeded';
    await expect(reconcileRules(dnr, [t('reddit.com')])).rejects.toBeInstanceOf(RuleUpdateError);
    expect(dnr.blockedDomains()).toEqual(['instagram.com']);
  });
});
