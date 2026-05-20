import { GameTemplate } from '../types';
import { buildCloudHash } from '../utils/deepLink';
import { cloudClient } from './cloudClient';
import type { FetchResponse, UploadResponse } from './cloudClient';

export const buildCloudShareUrl = (cloudId: string, englishName?: string): string => {
  const hash = buildCloudHash(cloudId, englishName);
  const { origin, pathname, search } = window.location;
  return `${origin}${pathname}${search}${hash}`;
};

export const uploadTemplateToCloud = (template: GameTemplate, lang?: string): Promise<UploadResponse> => {
  return cloudClient.uploadTemplateToCloud(template, lang);
};

export const fetchTemplateFromCloud = (cloudId: string): Promise<FetchResponse | null> => {
  return cloudClient.fetchTemplateFromCloud(cloudId);
};

export const fetchPublicTemplates = (): Promise<FetchResponse[]> => {
  return cloudClient.fetchPublicTemplates();
};


