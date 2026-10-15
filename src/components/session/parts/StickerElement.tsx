
import React, { useMemo } from 'react';
import { Ghost, Cat, Dog, Rabbit, Bird, Bot, VenetianMask, Smile, Zap, Heart, Star } from 'lucide-react';
import { getPerceivedLuminance } from '../../../utils/ui';

// Crowns are reserved for actual winners, never anonymous identities.
const ICONS = [Ghost, Cat, Dog, Rabbit, Bird, Bot, VenetianMask, Smile, Zap, Heart, Star];

interface StickerElementProps {
    id: string; // Used for seeding
    color: string; // Player color
    className?: string;
    iconIndex?: number;
}

// Simple deterministic hash
const getHash = (str: string) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = (hash << 5) - hash + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
};

/** Allocate against the whole roster so masking/unmasking or reordering cannot reassign stickers. */
export const getPlayerStickerIndices = (playerIds: readonly string[]): Map<string, number> => {
    const indices = new Map<string, number>();
    const used = new Set<number>();
    for (const id of Array.from(new Set(playerIds)).sort()) {
        // More players than shapes must reuse a shape; keep the search bounded.
        if (used.size === ICONS.length) used.clear();
        let index = getHash(id) % ICONS.length;
        while (used.has(index)) index = (index + 1) % ICONS.length;
        used.add(index);
        indices.set(id, index);
    }
    return indices;
};

const StickerElement: React.FC<StickerElementProps> = ({ id, color, className, iconIndex }) => {
    const { Icon, rotation } = useMemo(() => {
        const hash = getHash(id);
        
        const selectedIndex = iconIndex ?? hash % ICONS.length;
        // Increase rotation range slightly for more natural sticker look
        const rotationDeg = (hash % 20) - 10; // -10 to 10 deg tilt
        
        return {
            Icon: ICONS[selectedIndex],
            rotation: rotationDeg
        };
    }, [id, iconIndex]);
    // Resolve the actual color, including theme-dependent text-color fallbacks.
    const outlineColor = getPerceivedLuminance(color) < 128 ? '#f8fafc' : '#0f172a';

    return (
        <div 
            className={`relative inline-flex items-center justify-center ${className}`}
            style={{ 
                transform: `rotate(${rotation}deg)`,
            }}
        >
            {/* 
               Sticker Style:
               - Large Icon
               - Colored stroke using player color
               - Semi-transparent fill (Jelly look) to make it stand out but not block completely
               - Contrasting outline beneath the original stroke for either theme
               - Subtle drop shadow to lift it off the background
            */}
            <Icon
                data-sticker-outline="true"
                aria-hidden="true"
                size={48}
                color={outlineColor}
                fill="none"
                strokeWidth={4.5}
                className="absolute inset-0"
            />
            <Icon 
                data-sticker-icon="true"
                size={48} 
                color={color} 
                fill={color} 
                fillOpacity={0.25}
                strokeWidth={2.5}
                className="relative filter drop-shadow-sm"
            />
        </div>
    );
};

export default StickerElement;
