
import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { ImportCategoryData, ManualLink } from '../types';

interface UseImportLinkingProps {
  categoryData: ImportCategoryData;
  categoryType: 'game' | 'player' | 'location';
}

export const useImportLinking = ({ categoryData, categoryType }: UseImportLinkingProps) => {
  // 1. Selection State
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
  
  // 2. Search State
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  
  // 3. Links State (Map<ImportID, ManualLink>)
  const [links, setLinks] = useState<Map<number, ManualLink>>(new Map());
  
  // State to track the last successfully linked local ID (for scroll positioning)
  const [lastLinkedLocalId, setLastLinkedLocalId] = useState<string | null>(null);

  // --- Logic: Search & Filtering ---
  // Calculates which import items to show on the right side
  const { displayedImportItems, suggestedMatchId, activeLinkedImportId } = useMemo(() => {
    
    // 1. Determine which Import ID is currently linked to the selected Local ID
    let currentLinkedId: number | null = null;
    if (selectedLocalId) {
        // Iterate map to find key by value.targetId
        for (const [importId, link] of links.entries()) {
            if (link.targetId === selectedLocalId) {
                currentLinkedId = importId;
                break;
            }
        }
    }

    let fuseSearchTerm = '';
    const allItems = categoryData.importUnmatched;

    // 2. Determine Search Term
    // Priority 1: Manual search query
    if (manualSearchQuery.trim()) {
        fuseSearchTerm = manualSearchQuery.trim();
    } 
    // Priority 2: Selection-based auto-search (Suggestion)
    else if (selectedLocalId) {
        const selectedLocalItem = categoryData.localUnmatched.find(item => item.id === selectedLocalId);
        if (selectedLocalItem) {
            fuseSearchTerm = selectedLocalItem.name;
        }
    }

    // 3. Prepare the base list (excluding the currently linked item to avoid duplication in sort)
    let itemsToSearch = allItems;
    let linkedItem: typeof allItems[0] | undefined;

    if (currentLinkedId !== null) {
        linkedItem = allItems.find(i => i.id === currentLinkedId);
        if (linkedItem) {
            itemsToSearch = allItems.filter(i => i.id !== currentLinkedId);
        }
    }

    let searchResultItems: typeof allItems = [];
    let bestMatchId: number | null = null;
    let remainingItems: typeof allItems = [];

    // 4. Perform Search (if needed)
    if (fuseSearchTerm) {
        const fuse = new Fuse(itemsToSearch, {
            keys: ['name'],
            threshold: 0.3, 
            ignoreLocation: false,
            distance: 100, 
        });

        const results = fuse.search(fuseSearchTerm);
        
        // Suggestion logic
        bestMatchId = results.length > 0 ? results[0].item.id : null;

        searchResultItems = results.map(r => r.item);
        const searchResultIds = new Set(searchResultItems.map(item => item.id));
        remainingItems = itemsToSearch.filter(item => !searchResultIds.has(item.id));
    } else {
        // No search term, just list everything else
        remainingItems = itemsToSearch;
    }

    // 5. Final Sort Order: [Linked Item] -> [Search Results] -> [Remaining]
    const finalDisplayList = [
        ...(linkedItem ? [linkedItem] : []),
        ...searchResultItems,
        ...remainingItems
    ];
    
    return { 
        displayedImportItems: finalDisplayList,
        suggestedMatchId: bestMatchId,
        activeLinkedImportId: currentLinkedId
    };

  }, [categoryData.importUnmatched, categoryData.localUnmatched, selectedLocalId, manualSearchQuery, links]);

  // --- Actions ---

  const handleLocalSelect = (id: string | number) => {
    const strId = String(id);
    setSelectedLocalId(prev => prev === strId ? null : strId);
    setManualSearchQuery(''); // Clear manual search when switching selection context
  };

  const handleImportSelect = (importId: number) => {
    // Only allow linking if a local item is selected
    if (!selectedLocalId) return;

    setLinks(prev => {
      const newLinks = new Map<number, ManualLink>(prev);
      
      // Check if already linked to THIS local ID (Toggle Off)
      const existingLink = newLinks.get(importId);
      if (existingLink && existingLink.targetId === selectedLocalId) {
        newLinks.delete(importId);
        // If we toggle off, we don't return here because we might want to auto-advance? 
        // No, toggle off usually means "I made a mistake, let me uncheck". 
        // We probably shouldn't auto-advance on toggle off.
        return newLinks;
      }
      
      // If this import item was linked to ANOTHER local item, overwrite it?
      // Yes, map key is importId, so setting it simply overwrites.
      
      // Also, if the CURRENT local item was linked to something else, we need to find and remove that?
      // No, `links` is Map<ImportID, Link>. 
      // If Local A was linked to Import A, and now we link Local A to Import B...
      // We need to remove the entry for Import A if we want 1-to-1 mapping.
      // But the current structure allows Many Imports -> One Local (e.g. merge multiple spellings).
      // However, usually we want One Local -> One Import for this specific use case?
      // Let's assume One-to-One for clarity, so we should clear previous link for this LocalID.
      
      // Clear any existing link for this Local ID
      for (const [key, link] of newLinks.entries()) {
          if (link.targetId === selectedLocalId) {
              newLinks.delete(key);
          }
      }

      // Create New Link
      let linkType: ManualLink['type'] = 'game';
      if (categoryType === 'player') linkType = 'player';
      if (categoryType === 'location') linkType = 'location';
      
      newLinks.set(importId, {
        targetId: selectedLocalId,
        type: linkType
      });

      return newLinks;
    });

    // --- Post-Link Auto Advance ---
    setLastLinkedLocalId(selectedLocalId);

    // Find next unmatched local item
    const currentIndex = categoryData.localUnmatched.findIndex(item => item.id === selectedLocalId);
    if (currentIndex !== -1) {
        let nextIndex = currentIndex + 1;
        if (nextIndex < categoryData.localUnmatched.length) {
            const nextItem = categoryData.localUnmatched[nextIndex];
            setSelectedLocalId(nextItem.id);
            setManualSearchQuery('');
        } else {
            // End of list: Stay on the current item (don't deselect), but clear search
            setManualSearchQuery('');
        }
    }
  };

  // Helper to check status
  const getLinkStatus = (importId: number) => links.has(importId);

  return {
    selectedLocalId,
    manualSearchQuery,
    setManualSearchQuery,
    displayedImportItems,
    links,
    handleLocalSelect,
    handleImportSelect,
    getLinkStatus,
    suggestedMatchId,
    lastLinkedLocalId,
    activeLinkedImportId // Expose the ID of the item linked to the CURRENT selection
  };
};
