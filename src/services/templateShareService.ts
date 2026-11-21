import { GameTemplate } from '../types';
import { buildCloudHash } from '../utils/deepLink';
import { cloudClient } from './cloudClient';
import type { FetchResponse, UploadResponse } from './cloudClient';

export const buildCloudShareUrl = (cloudId: string, englishName?: string): string => {
  const hash = buildCloudHash(cloudId, englishName);
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${hash}`;
};

export const uploadTemplateToCloud = (
  template: GameTemplate,
  lang?: string,
  bggId?: string,
  bggName?: string
): Promise<UploadResponse> => {
  return cloudClient.uploadTemplateToCloud(template, lang, bggId, bggName);
};

export const fetchTemplateFromCloud = (cloudId: string): Promise<FetchResponse | null> => {
  return cloudClient.fetchTemplateFromCloud(cloudId);
};

/** Content of shared scoreboards chosen from the local share catalog; one D1 row per board. */
export const fetchShareTemplatesByIds = (ids: string[]): Promise<FetchResponse[]> => {
  return cloudClient.fetchShareTemplatesByIds(ids);
};



