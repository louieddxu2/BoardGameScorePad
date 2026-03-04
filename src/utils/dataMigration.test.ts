
import { describe, it, expect } from 'vitest';
import { migrateColumn, migrateTemplate } from './dataMigration';

describe('Data Migration Tests', () => {
    describe('migrateColumn', () => {
        it('should preserve core properties', () => {
            const oldCol = {
                id: 'col-3',
                name: 'Full Column',
                isScoring: false,
                displayMode: 'overlay',
                color: '#ff0000'
            };
            const migrated = migrateColumn(oldCol);
            expect(migrated.id).toBe('col-3');
            expect(migrated.name).toBe('Full Column');
            expect(migrated.isScoring).toBe(false);
            expect(migrated.displayMode).toBe('overlay');
            expect(migrated.color).toBe('#ff0000');
        });

        it('should discard unknown properties (data purity)', () => {
            // This ensures the JSON remains clean for cloud de-duplication/hashing
            const oldCol = {
                id: 'col-4',
                name: 'Dirty Column',
                obsoleteData: 'trash',
                randomKey: 123
            };
            const migrated = migrateColumn(oldCol) as any;
            expect(migrated.obsoleteData).toBeUndefined();
            expect(migrated.randomKey).toBeUndefined();
            expect(migrated.id).toBe('col-4');
        });
    });

    describe('migrateTemplate', () => {
        it('should migrate all columns in a template', () => {
            const template = {
                id: 'temp-1',
                name: 'Test Template',
                columns: [
                    { id: 'c1', name: 'C1' },
                    { id: 'c2', name: 'C2' }
                ]
            };
            const migrated = migrateTemplate(template);
            expect(migrated.columns[0].id).toBe('c1');
            expect(migrated.columns[1].id).toBe('c2');
        });
    });
});
