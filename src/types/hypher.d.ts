declare module 'hypher' {
  interface HypherPattern {
    patterns: Record<string, unknown>;
  }
  export default class Hypher {
    constructor(pattern: HypherPattern);
    hyphenate(word: string): string[];
  }
}

declare module 'hyphenation.en-us' {
  const pattern: import('hypher').HypherPattern;
  export default pattern;
}
