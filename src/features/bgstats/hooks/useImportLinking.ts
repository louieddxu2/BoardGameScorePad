
import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { ImportCategoryData, ManualLink } from '../types';

interface UseImportLinkingProps {
  categoryData: ImportCategoryData;
  categoryType: 'game' | 'player' | 'location';
}

const DISPLAY_LIMIT = 20;

export const useImportLinking = ({ categoryData, categoryType }: UseImportLinkingProps) => {
  // 1. Selection State
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
  
  // 2. Search State
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  
  // 3. Links State (Map<ImportID, ManualLink>)
  const [links, setLinks] = useState<Map<number, ManualLink>>(new Map());
  
  // State to track the last successfully linked local ID (for scroll positioning)
  const [lastLinkedLocalId, setLastLinkedLocalId] = useState<string | null>(null);

  // [Optimization] Create Fuse instance only when the source data changes
  // This prevents rebuilding the index on every keystroke or selection change
  const fuseInstance = useMemo(() => {
      return new Fuse(categoryData.importUnmatched, {
          keys: ['name'],
          threshold: 0.3, 
          ignoreLocation: false,
          distance: 100, 
      });
  }, [categoryData.importUnmatched]);

  // --- Logic: Search & Filtering ---
  // Calculates which import items to show on the right side
  const { displayedImportItems, suggestedMatchId, activeLinkedImportId, totalImportCount } = useMemo(() => {
    
    // 1. Determine which Import ID is currently linked to the selected Local ID
    let currentLinkedId: number | null = null;
    if (selectedLocalId) {
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
    if (manualSearchQuery.trim()) {
        fuseSearchTerm = manualSearchQuery.trim();
    } 
    else if (selectedLocalId) {
        const selectedLocalItem = categoryData.localUnmatched.find(item => item.id === selectedLocalId);
        if (selectedLocalItem) {
            fuseSearchTerm = selectedLocalItem.name;
        }
    }

    // 3. Perform Search
    let searchResultItems: typeof allItems = [];
    let bestMatchId: number | null = null;
    let totalMatches = 0;

    if (fuseSearchTerm) {
        const results = fuseInstance.search(fuseSearchTerm);
        bestMatchId = results.length > 0 ? results[0].item.id : null;
        totalMatches = results.length;
        // Limit search results processing to avoid huge array mapping
        searchResultItems = results.slice(0, DISPLAY_LIMIT).map(r => r.item);
    } else {
        totalMatches = allItems.length;
        // If no search, we just take the top items from the raw list
        searchResultItems = allItems.slice(0, DISPLAY_LIMIT);
    }

    // 4. Assemble Final List
    // Priority: [Linked Item] -> [Search Results / Default List]
    // Note: We need to deduplicate. If the Linked Item is also in Search Results, don't show it twice.
    
    let linkedItem: typeof allItems[0] | undefined;
    if (currentLinkedId !== null) {
        linkedItem = allItems.find(i => i.id === currentLinkedId);
    }

    let finalDisplayList: typeof allItems = [];

    if (linkedItem) {
        finalDisplayList.push(linkedItem);
        // Append results, filtering out the linked item
        const rest = searchResultItems.filter(i => i.id !== currentLinkedId);
        finalDisplayList.push(...rest);
    } else {
        finalDisplayList = searchResultItems;
    }

    // 5. Final Cut
    // Strictly limit to prevent rendering crashes
    const truncatedList = finalDisplayList.slice(0, DISPLAY_LIMIT);
    
    return { 
        displayedImportItems: truncatedList,
        totalImportCount: totalMatches, // Return total matches before slicing
        suggestedMatchId: bestMatchId,
        activeLinkedImportId: currentLinkedId
    };

  }, [categoryData.importUnmatched, categoryData.localUnmatched, selectedLocalId, manualSearchQuery, links, fuseInstance]);

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
        return newLinks;
      }
      
      // Clear any existing link for this Local ID (One-to-One logic for UI consistency)
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
    totalImportCount,
    links,
    handleLocalSelect,
    handleImportSelect,
    getLinkStatus,
    suggestedMatchId,
    lastLinkedLocalId,
    activeLinkedImportId // Expose the ID of the item linked to the CURRENT selection
  };
};
