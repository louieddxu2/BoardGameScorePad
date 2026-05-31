const AI_USAGE_LIMIT_KEY = 'ai_generator_attempt_timestamps_v1';
const AI_USAGE_WINDOW_MS = 60 * 60 * 1000;
const AI_USAGE_MAX_ATTEMPTS = 5;

const getStorage = (): Storage | null => {
    try {
        return typeof window !== 'undefined' ? window.localStorage : null;
    } catch {
        return null;
    }
};

export const recordAiGenerationAttempt = (now = Date.now()): boolean => {
    const storage = getStorage();
    if (!storage) return true;

    const windowStart = now - AI_USAGE_WINDOW_MS;
    let recentAttempts: number[] = [];

    try {
        const parsed = JSON.parse(storage.getItem(AI_USAGE_LIMIT_KEY) || '[]');
        if (Array.isArray(parsed)) {
            recentAttempts = parsed
                .filter((value): value is number => typeof value === 'number' && Number.isFinite(value))
                .filter(timestamp => timestamp >= windowStart);
        }
    } catch {
        recentAttempts = [];
    }

    if (recentAttempts.length >= AI_USAGE_MAX_ATTEMPTS) {
        storage.setItem(AI_USAGE_LIMIT_KEY, JSON.stringify(recentAttempts));
        return false;
    }

    storage.setItem(AI_USAGE_LIMIT_KEY, JSON.stringify([...recentAttempts, now]));
    return true;
};
