import { afterEach, expect, it, vi } from 'vitest';
import { fetchGameRules, fetchRuleSummary } from '../game-rules/rulesApi';
import { fetchGameCatalog, fetchGameCatalogVersion, fetchOfficialPack, fetchOfficialTemplate } from '../official-boards/officialApi';
import { setCloudDataEnabled } from './cloudDataPreference';

afterEach(() => {
  localStorage.clear();
  vi.restoreAllMocks();
});

it.each([
  ['game catalog version', fetchGameCatalogVersion, '/api/games/catalog/version'],
  ['game catalog', fetchGameCatalog, '/api/games/catalog'],
  ['scoreboard pack', () => fetchOfficialPack('zh-TW'), '/api/official/pack?lang=zh-TW'],
  ['scoreboard version', () => fetchOfficialTemplate('Built-in-Catan', 1), '/api/official/template/Built-in-Catan?version=1'],
  ['rules summary', () => fetchRuleSummary('13'), '/api/rules/summary?bggId=13'],
  ['game rules', () => fetchGameRules('catan'), '/api/rules/game?gameId=catan'],
] as const)('only requests the %s after opt-in and uses an anonymous GET', async (_label, read, expectedPath) => {
  const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ rules: null, summary: null }));

  await expect(read()).rejects.toMatchObject({ code: 'cloud_data_disabled' });
  expect(fetchMock).not.toHaveBeenCalled();

  setCloudDataEnabled(true);
  await read();
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0];
  const request = new Request(url, init);
  const requestUrl = new URL(request.url);
  expect(requestUrl.pathname + requestUrl.search).toBe(expectedPath);
  expect(request.method).toBe('GET');
  expect(request.credentials).toBe('omit');
  expect(request.referrerPolicy).toBe('no-referrer');
  expect(request.headers.has('Authorization')).toBe(false);
  expect(request.body).toBeNull();

  setCloudDataEnabled(false);
  await expect(read()).rejects.toMatchObject({ code: 'cloud_data_disabled' });
  expect(fetchMock).toHaveBeenCalledTimes(1);
});
