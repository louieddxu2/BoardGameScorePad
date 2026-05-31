import { describe, expect, it } from 'vitest';

import aiPromptModalSource from './components/AiPromptModal.tsx?raw';
import useAiSimpleGeneratorSource from './hooks/useAiSimpleGenerator.ts?raw';
import useAiGeneratorSource from './hooks/useAiGenerator.ts?raw';
import aiApiServiceSource from './services/aiApiService.ts?raw';
import backendAiGeneratorSource from '../../../api/ai-generator.js?raw';

const FRONTEND_MODEL_SOURCES = [
  aiPromptModalSource,
  useAiSimpleGeneratorSource,
  useAiGeneratorSource,
  aiApiServiceSource,
];

function extractModelNames(source: string) {
  return Array.from(source.matchAll(/['"](gem(?:ini|ma)-[^'"]+)['"]/g), match => match[1]);
}

function extractBackendAllowedModels() {
  const allowedModelsBlock = backendAiGeneratorSource.match(/const ALLOWED_MODELS = new Set\(\[([\s\S]*?)\]\);/);
  if (!allowedModelsBlock) {
    throw new Error('Unable to locate ALLOWED_MODELS in api/ai-generator.js');
  }
  return new Set(extractModelNames(allowedModelsBlock[1]));
}

describe('AI model names', () => {
  it('keeps frontend model calls aligned with the backend allowlist', () => {
    const frontendModels = new Set(
      FRONTEND_MODEL_SOURCES.flatMap(source => extractModelNames(source))
    );
    const backendModels = extractBackendAllowedModels();

    expect([...frontendModels].sort()).toEqual([...backendModels].sort());
  });
});
