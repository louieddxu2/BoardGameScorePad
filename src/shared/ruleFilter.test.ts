import { expect, test } from 'vitest';
import ruleTypesSource from './ruleTypes.ts?raw';
import ruleFilterSource from './ruleFilter.ts?raw';

// Exact copies of the rules site's src/shared files (BoardGameHelper, docs/scorepad-integration.md),
// so the score pad filters rules as the site does. Never edit them here: when this test fails, copy
// both files from the rules site again and update SHARED_RULE_FILTER_SHA256 to the hash recorded in
// its scripts/shared-rule-filter.test.ts. The hash covers ruleTypes.ts then ruleFilter.ts, with LF endings.
const SHARED_RULE_FILTER_SHA256 = '39b9a298a213021b4765f5891acaf0de96a242dafbbd90ce9fd59a68514e8d85';

const normalize = (source: string) => source.replace(/\r\n/g, '\n');

const sha256Hex = async (text: string) => {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
};

test('the rule filter copied from the rules site matches its recorded hash', async () => {
  expect(await sha256Hex(normalize(ruleTypesSource) + normalize(ruleFilterSource))).toBe(SHARED_RULE_FILTER_SHA256);
});

test('the shared files import nothing beyond each other, so two files are the whole copy', () => {
  const imports = (source: string) => [...normalize(source).matchAll(/^(?:import|export)[^;]*?from\s+'([^']+)'/gm)].map((match) => match[1]);
  expect(imports(ruleTypesSource)).toEqual([]);
  expect(imports(ruleFilterSource)).toEqual(['./ruleTypes']);
});
