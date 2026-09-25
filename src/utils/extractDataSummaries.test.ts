import { describe, expect, it } from 'vitest';
import type { GameTemplate } from '../types';
import { extractTemplateSummary } from './extractDataSummaries';

describe('extractTemplateSummary scoreboard structure', () => {
  it('retains whether a template has scoring columns without retaining the columns', () => {
    const template: GameTemplate = {
      id: 'full-template',
      name: 'Full Scoreboard',
      columns: [{ id: 'score', name: 'Score', formula: 'a1', inputType: 'keypad', isScoring: true }],
      createdAt: 1
    };

    const summary = extractTemplateSummary(template, new Set());

    expect(summary.hasScoringColumns).toBe(true);
    expect(summary.columns).toEqual([]);
  });

  it('marks simple templates as having no scoring columns', () => {
    const template: GameTemplate = {
      id: 'simple-template',
      name: 'Simple Scoreboard',
      columns: [],
      createdAt: 1
    };

    expect(extractTemplateSummary(template, new Set()).hasScoringColumns).toBe(false);
  });
});
