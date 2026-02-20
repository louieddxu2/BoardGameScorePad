
import { useState, useMemo } from 'react';
import Fuse from 'fuse.js';
import { ImportCategoryData, ManualLink } from '../types';

interface UseImportLinkingProps {
  categoryData: ImportCategoryData;
  categoryType: 'game' | 'player' | 'location';
}

const DISPLAY_LIMIT = 20;

export const useImportLinking = ({ categoryData, categoryType }: UseImportLinkingProps) => {
  // 1. Selection State (Driver: Local Item on Left)
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
  
  // 2. Search State (Filters Import Items on Right)
  const [manualSearchQuery, setManualSearchQuery] = useState('');
  
  // 3. Links State (Map<ImportID, ManualLink>)
  const [links, setLinks] = useState<Map<number, ManualLink>>(new Map());
  
  // State to track the last successfully linked local ID (for scroll positioning on left side)
  const [lastLinkedLocalId, setLastLinkedLocalId] = useState<string | null>(null);

  // [Target: Import Items] Create Fuse instance for IMPORT items
  const fuseInstance = useMemo(() => {
      return new Fuse(categoryData.importUnmatched, {
          keys: ['name'],
          threshold: 0.3, 
          ignoreLocation: false,
          distance: 100, 
      });
  }, [categoryData.importUnmatched]);

  // --- Logic: Search & Filtering ---
  // Calculates which IMPORT items to show on the RIGHT side based on LEFT selection
  const { displayedImportItems, suggestedMatchId, activeLinkedImportId, totalImportCount } = useMemo(() => {
    
    // 1. Determine which Import ID is currently linked to the selected Local ID
    let currentLinkedImportId: number | null = null;
    if (selectedLocalId) {
        // We have to search the map values
        for (const [importId, link] of links.entries()) {
            if (link.targetId === selectedLocalId) {
                currentLinkedImportId = importId;
                break;
            }
        }
    }

    let fuseSearchTerm = '';
    const allImportItems = categoryData.importUnmatched;

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

    // 3. Perform Search on IMPORT items
    let searchResultItems: typeof allImportItems = [];
    let bestMatchId: number | null = null;
    let totalMatches = 0;

    if (fuseSearchTerm) {
        const results = fuseInstance.search(fuseSearchTerm);
        bestMatchId = results.length > 0 ? results[0].item.id : null;
        totalMatches = results.length;
        searchResultItems = results.slice(0, DISPLAY_LIMIT).map(r => r.item);
    } else {
        totalMatches = allImportItems.length;
        // Default list
        searchResultItems = allImportItems.slice(0, DISPLAY_LIMIT);
    }

    // 4. Assemble Final List
    // Priority: [Linked Item] -> [Search Results]
    
    let linkedItem: typeof allImportItems[0] | undefined;
    if (currentLinkedImportId !== null) {
        linkedItem = allImportItems.find(i => i.id === currentLinkedImportId);
    }

    let finalDisplayList: typeof allImportItems = [];

    if (linkedItem) {
        finalDisplayList.push(linkedItem);
        const rest = searchResultItems.filter(i => i.id !== currentLinkedImportId);
        finalDisplayList.push(...rest);
    } else {
        finalDisplayList = searchResultItems;
    }

    // 5. Final Cut
    const truncatedList = finalDisplayList.slice(0, DISPLAY_LIMIT);
    
    return { 
        displayedImportItems: truncatedList,
        totalImportCount: totalMatches,
        suggestedMatchId: bestMatchId,
        activeLinkedImportId: currentLinkedImportId
    };

  }, [categoryData.importUnmatched, categoryData.localUnmatched, selectedLocalId, manualSearchQuery, links, fuseInstance]);

  // --- Actions ---

  const handleLocalSelect = (id: string | number) => {
    setSelectedLocalId(String(id));
    setManualSearchQuery(''); 
  };

  const handleImportSelect = (importId: number) => {
    // Only allow linking if a local item is selected
    if (!selectedLocalId) return;
    
    setLinks(prev => {
      const newLinks = new Map<number, ManualLink>(prev);
      
      // Check if this import item is already linked to THIS local item (Toggle off)
      const existingLink = newLinks.get(importId);
      if (existingLink && existingLink.targetId === selectedLocalId) {
        newLinks.delete(importId);
        return newLinks;
      }

      // Check if this Local ID is already linked to ANOTHER import item (One-to-One logic for this specific Local ID)
      // Remove any existing link pointing to selectedLocalId
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
            setManualSearchQuery('');
        }
    }
  };

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
    activeLinkedImportId 
  };
};
