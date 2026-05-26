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

export const fetchPublicTemplates = (options?: { bggId?: string; query?: string }): Promise<FetchResponse[]> => {
  return cloudClient.fetchPublicTemplates(options);
};

export const deleteTemplateFromCloud = (id: string, token: string): Promise<{ success: boolean }> => {
  return cloudClient.deleteTemplateFromCloud(id, token);
};


