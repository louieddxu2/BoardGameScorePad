
import React, { useMemo } from 'react';
import { Ghost, Cat, Dog, Rabbit, Bird, Bot, VenetianMask, Smile, Crown, Zap, Heart, Star } from 'lucide-react';

const ICONS = [Ghost, Cat, Dog, Rabbit, Bird, Bot, VenetianMask, Smile, Crown, Zap, Heart, Star];

interface StickerElementProps {
    id: string; // Used for seeding
    color: string; // Player color
    className?: string;
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

const StickerElement: React.FC<StickerElementProps> = ({ id, color, className }) => {
    const { Icon, rotation } = useMemo(() => {
        const hash = getHash(id);
        
        const iconIndex = hash % ICONS.length;
        // Increase rotation range slightly for more natural sticker look
        const rotationDeg = (hash % 20) - 10; // -10 to 10 deg tilt
        
        return {
            Icon: ICONS[iconIndex],
            rotation: rotationDeg
        };
    }, [id]);

    return (
        <div 
            className={`inline-flex items-center justify-center ${className}`}
            style={{ 
                transform: `rotate(${rotation}deg)`,
            }}
        >
            {/* 
               Sticker Style:
               - Large Icon
               - Colored stroke using player color
               - Semi-transparent fill (Jelly look) to make it stand out but not block completely
               - Subtle drop shadow to lift it off the background
            */}
            <Icon 
                size={48} 
                color={color} 
                fill={color} 
                fillOpacity={0.25}
                strokeWidth={2.5}
                className="filter drop-shadow-sm"
            />
        </div>
    );
};

export default StickerElement;
