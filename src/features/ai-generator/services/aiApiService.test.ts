import { describe, it, expect } from 'vitest';
import { transformToTemplate } from './aiApiService';

describe('aiApiService - transformToTemplate (Expander)', () => {
  it('should expand multiplier formula like a1×3 and a1*(-5)', () => {
    const rawAiData = {
      name: 'Test Game',
      columns: [
        { name: 'Normal', formula: 'a1×3' },
        { name: 'Negative', formula: 'a1*(-5)' }
      ]
    };

    const result = transformToTemplate(rawAiData, { promptTokenCount: 0, candidatesTokenCount: 0, totalTokenCount: 0 });
    const template = result.template;
    
    expect(template.columns![0].formula).toBe('a1×c1');
    expect(template.columns![0].constants?.c1).toBe(3);
    
    expect(template.columns![1].formula).toBe('a1×c1');
    expect(template.columns![1].constants?.c1).toBe(-5);
  });

  it('should expand chart shorthand [0,1,3]>[0,1,3]', () => {
    const rawAiData = {
      name: 'Test Game',
      columns: [
        { 
          name: 'Chart', 
          formula: 'f1(a1)', 
          functions: { f1: '[0,1,3]>[0,1,3]' } 
        }
      ]
    };

    const result = transformToTemplate(rawAiData);
    const template = result.template;
    const f1 = template.columns![0].functions?.f1 as any[];
    
    expect(f1).toBeDefined();
    expect(f1.length).toBe(3);
    expect(f1[0].min).toBe(0);
    expect(f1[0].score).toBe(0);
    expect(f1[2].min).toBe(3);
    expect(f1[2].score).toBe(3);
  });

  it('should expand button shorthand ["A","B"]>[10,20]', () => {
    const rawAiData = {
      name: 'Test Game',
      columns: [
        { 
          name: 'Buttons', 
          quickActions: '["Yes","No"]>[10,0]' 
        }
      ]
    };

    const result = transformToTemplate(rawAiData);
    const template = result.template;
    const col = template.columns![0];
    
    expect(col.inputType).toBe('clicker');
    expect(col.quickActions).toHaveLength(2);
    expect(col.quickActions![0].label).toBe('Yes');
    expect(col.quickActions![0].value).toBe(10);
  });

  it('should expand color names to hex codes', () => {
    const rawAiData = {
      name: 'Test Game',
      columns: [
        { name: 'Red Item', color: '紅' },
        { name: 'Blue Item', color: 'Blue' }
      ]
    };

    const result = transformToTemplate(rawAiData);
    const template = result.template;
    
    expect(template.columns![0].color).toBe('#ef4444');
    expect(template.columns![1].color).toBe('#3b82f6');
  });
});
