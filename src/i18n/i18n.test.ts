import { describe, it, expect } from 'vitest';

import { columnEditorTranslations } from './column_editor';
import { appTranslations } from './app';
import { dashboardTranslations } from './dashboard';
import { gameFlowTranslations } from './game_flow';
import { bgStatsTranslations } from './bgstats';
import { cloudOnboardingTranslations } from './cloud_onboarding';
import { gameSettingsTranslations } from './gameSettings';
import { inspectorTranslations } from './inspector';
import { sessionTranslations } from './session';
import { commonTranslations } from './common';
import { cloudTranslations } from './cloud';
import { historyTranslations } from './history';
import { setupTranslations } from './setup';
import { dataManagerTranslations } from './data_manager';
import { templateEditorTranslations } from './template_editor';
import { scannerTranslations } from './scanner';

type BiTranslations = {
  'zh-TW': Record<string, unknown>;
  en: Record<string, unknown>;
};

const expectSameKeysForLanguages = (
  moduleName: string,
  translations: BiTranslations,
) => {
  const zhKeys = Object.keys(translations['zh-TW']).sort();
  const enKeys = Object.keys(translations.en).sort();

  expect(zhKeys.length, `${moduleName}: zh-TW 應至少有一個 key`).toBeGreaterThan(0);
  expect(enKeys.length, `${moduleName}: en 應至少有一個 key`).toBeGreaterThan(0);
  expect(enKeys, `${moduleName}: zh-TW / en 的 key 應完全一致`).toEqual(zhKeys);
};

describe('i18n 雙語模組結構檢查', () => {
  it('column_editor 雙語 key 應一致', () => {
    expectSameKeysForLanguages('column_editor', columnEditorTranslations);
  });

  it('app 雙語 key 應一致', () => {
    expectSameKeysForLanguages('app', appTranslations as BiTranslations);
  });

  it('dashboard 雙語 key 應一致', () => {
    expectSameKeysForLanguages('dashboard', dashboardTranslations as BiTranslations);
  });

  it('game_flow 雙語 key 應一致', () => {
    expectSameKeysForLanguages('game_flow', gameFlowTranslations as BiTranslations);
  });

  it('bgstats 雙語 key 應一致', () => {
    expectSameKeysForLanguages('bgstats', bgStatsTranslations as BiTranslations);
  });

  it('cloud_onboarding 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'cloud_onboarding',
      cloudOnboardingTranslations as BiTranslations,
    );
  });

  it('gameSettings 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'gameSettings',
      gameSettingsTranslations as BiTranslations,
    );
  });

  it('inspector 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'inspector',
      inspectorTranslations as BiTranslations,
    );
  });

  it('session 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'session',
      sessionTranslations as BiTranslations,
    );
  });

  it('common 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'common',
      commonTranslations as BiTranslations,
    );
  });

  it('cloud 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'cloud',
      cloudTranslations as BiTranslations,
    );
  });

  it('history 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'history',
      historyTranslations as BiTranslations,
    );
  });

  it('setup 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'setup',
      setupTranslations as BiTranslations,
    );
  });

  it('dataManager 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'dataManager',
      dataManagerTranslations as BiTranslations,
    );
  });

  it('templateEditor 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'templateEditor',
      templateEditorTranslations as BiTranslations,
    );
  });

  it('scanner 雙語 key 應一致', () => {
    expectSameKeysForLanguages(
      'scanner',
      scannerTranslations as BiTranslations,
    );
  });
});

