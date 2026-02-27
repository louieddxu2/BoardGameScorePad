
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../../db';
import { LocalImage } from '../../../../types';

export const useImageSource = (searchTerm: string) => {
    return useLiveQuery(async () => {
        let collection = db.images.toCollection();
        if (searchTerm.trim()) {
            const lower = searchTerm.toLowerCase();
            collection = collection.filter(img =>
                img.id.toLowerCase().includes(lower) ||
                img.relatedId.toLowerCase().includes(lower)
            );
        }
        const records = await collection.reverse().offset(0).limit(50).toArray();

        // Resolve source names
        return await Promise.all(records.map(async (img) => {
            let sourceName = img.relatedId;
            try {
                if (img.relatedType === 'template') {
                    const template = await db.templates.get(img.relatedId);
                    if (template) sourceName = template.name;
                } else if (img.relatedType === 'session') {
                    // Try history first (completed games)
                    const history = await db.history.get(img.relatedId);
                    if (history) {
                        sourceName = history.gameName;
                    } else {
                        // Try active sessions
                        const session = await db.sessions.get(img.relatedId);
                        if (session) sourceName = session.name;
                    }
                }
            } catch (e) {
                console.warn(`Failed to resolve source name for ${img.id}`, e);
            }
            return { ...img, sourceName };
        }));
    }, [searchTerm]);
};
