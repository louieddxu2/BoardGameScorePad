import 'fake-indexeddb/auto';
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { db } from '../../../../db';
import ShareCatalogTab from './ShareCatalogTab';

const fetchTemplateFromCloud = vi.fn();
const deleteTemplateFromCloud = vi.fn();
const syncCatalog = vi.fn();

vi.mock('../../../../services/templateShareService', () => ({
  fetchTemplateFromCloud: (...args: unknown[]) => fetchTemplateFromCloud(...args),
  deleteTemplateFromCloud: (...args: unknown[]) => deleteTemplateFromCloud(...args),
}));
vi.mock('../../../../features/official-boards/catalogSync', () => ({
  syncCatalog: (...args: unknown[]) => syncCatalog(...args),
}));
vi.mock('../../../../services/cloud/googleAuth', () => ({ googleAuth: { token: 'token', signIn: vi.fn() } }));
vi.mock('../../../../hooks/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('../../../../hooks/useConfirm', () => ({ useConfirm: () => ({ confirm: async () => true }) }));
vi.mock('../../../../i18n/cloud_library', () => ({ useCloudLibraryTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../../../../i18n/officialBoards', () => ({ useOfficialBoardsTranslation: () => ({ t: (key: string) => key }) }));

describe('ShareCatalogTab', () => {
  beforeEach(async () => {
    await Promise.all(db.tables.map((table) => table.clear()));
    await db.shareCatalog.bulkPut([
      { id: 'share-1', name: 'Cascadia', lang: 'en', bggName: 'Cascadia', createdAt: 2, downloadCount: 3 },
      { id: 'share-2', name: 'Already Here', createdAt: 1 },
    ]);
    syncCatalog.mockResolvedValue({ ran: 'none', changed: 0 });
  });
  afterEach(() => vi.clearAllMocks());

  it('lists the local catalog and downloads a payload only when importing', async () => {
    fetchTemplateFromCloud.mockResolvedValue({ id: 'share-1', name: 'Cascadia', payload: { name: 'Cascadia', columns: [{ id: 'c1', name: 'Bear' }] } });
    const onImport = vi.fn();
    render(
      <ShareCatalogTab
        userTemplates={[{ id: 'local', name: 'already here', columns: [], createdAt: 0 }]}
        onImport={onImport}
        onBusyChange={vi.fn()}
      />
    );

    await screen.findByText('Cascadia');
    expect(syncCatalog).toHaveBeenCalledWith('share');
    expect(fetchTemplateFromCloud).not.toHaveBeenCalled();
    // Matching local names show as imported; only the other one can be imported.
    expect(screen.getAllByText('lib_btn_import')).toHaveLength(1);

    await act(async () => {
      fireEvent.click(screen.getByText('lib_btn_import'));
    });
    expect(fetchTemplateFromCloud).toHaveBeenCalledWith('share-1');
    const [imported] = onImport.mock.calls[0][0];
    expect(imported).toMatchObject({ name: 'Cascadia', columns: [{ id: 'c1', name: 'Bear' }] });
    expect(imported.id).not.toBe('share-1');
  });

  it('removes a deleted share from the local catalog', async () => {
    deleteTemplateFromCloud.mockResolvedValue({ success: true });
    render(<ShareCatalogTab userTemplates={[]} onImport={vi.fn()} onBusyChange={vi.fn()} />);
    await screen.findByText('Cascadia');

    await act(async () => {
      fireEvent.click(screen.getAllByTitle('lib_btn_delete_tooltip')[0]);
    });
    expect(deleteTemplateFromCloud).toHaveBeenCalledWith('share-1', 'token');
    await waitFor(async () => expect(await db.shareCatalog.get('share-1')).toBeUndefined());
  });
});
