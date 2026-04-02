
/**
 * VoiceService handles text-to-speech (TTS) functionalities.
 * It's designed to be a singleton or a set of static methods for global accessibility.
 * Future voice input functionality can be integrated here.
 */

class VoiceService {
  private synth: SpeechSynthesis | null = typeof window !== 'undefined' ? window.speechSynthesis : null;
  private currentLanguage: string = 'zh-TW';
  private customMappings: Record<string, string> = {};
  private currentTokens: { digits: string; units: string; negative: string } = { digits: '', units: '', negative: '' };
  private bestVoice: SpeechSynthesisVoice | null = null;

  constructor() {
    this.initVoiceSelection();
  }

  private initVoiceSelection() {
    if (!this.synth) return;

    const updateVoice = () => {
      this.bestVoice = this.findBestVoice();
    };

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = updateVoice;
    }
    updateVoice();
  }

  /**
   * Find the highest quality voice for the current language.
   * Priority: Natural/Neural/Online/Google > Desktop/Standard
   */
  private findBestVoice(): SpeechSynthesisVoice | null {
    if (!this.synth) return null;
    const voices = this.synth.getVoices();
    if (voices.length === 0) return null;

    const langLower = this.currentLanguage.toLowerCase();
    const mandarinVoices = voices.filter(v => v.lang.toLowerCase().includes(langLower) || v.lang.toLowerCase().includes('zh-'));

    if (mandarinVoices.length === 0) return null;

    // Sort by quality heuristics
    return mandarinVoices.sort((a, b) => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();
      
      // Keywords that indicate higher quality (Neural, Natural, Online, Google)
      const highQualityKeywords = ['natural', 'neural', 'online', 'google', 'premium'];
      const aIsHigh = highQualityKeywords.some(k => aName.includes(k));
      const bIsHigh = highQualityKeywords.some(k => bName.includes(k));

      if (aIsHigh && !bIsHigh) return -1;
      if (!aIsHigh && bIsHigh) return 1;
      
      // Prefer zh-TW over generic zh if current lang is zh-TW
      if (langLower.includes('tw')) {
        const aIsTW = a.lang.toLowerCase().includes('tw');
        const bIsTW = b.lang.toLowerCase().includes('tw');
        if (aIsTW && !bIsTW) return -1;
        if (!aIsTW && bIsTW) return 1;
      }

      return 0;
    })[0];
  }

  /**
   * Set the language for the voice synthesis.
   * @param lang Language code (e.g., 'zh-TW', 'en-US')
   */
  setLanguage(lang: string) {
    this.currentLanguage = lang;
    this.bestVoice = this.findBestVoice();
  }

  /**
   * Set custom text mappings for better clarity (e.g., {"5": "五"})
   * @param mappings A record of string to string for replacement
   */
  setCustomMappings(mappings: Record<string, string>) {
    this.customMappings = mappings;
  }

  /**
   * Set digits and units for number-to-text conversion.
   */
  setTokens(digits: string, units: string, negative: string) {
    this.currentTokens = { digits, units, negative };
  }

  /**
   * Speak a given text string. 
   * It will apply custom mappings before speaking.
   * @param text The text to be spoken.
   * @param isEnabled Global toggle check (passed from hook/state).
   */
  speak(text: string, isEnabled: boolean) {
    if (!this.synth || !isEnabled || !text) return;

    // [Warm-up Buffer] Use leading space to avoid "first syllable cutoff" bug on Windows/Chrome
    let processedText = ' ' + text;

    // Apply custom mappings (matching whole digits)
    Object.entries(this.customMappings).forEach(([target, replacement]) => {
      if (target === replacement) return;
      
      const isDigit = /^\d+$/.test(target);
      const regex = isDigit 
        ? new RegExp(`(?<!\\d)${target}(?!\\d)`, 'g')
        : new RegExp(target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
      
      processedText = processedText.replace(regex, replacement);
    });

    // Cancel previous speech if any to avoid stacking up long queues
    this.synth.cancel();

    const utterance = new SpeechSynthesisUtterance(processedText);
    utterance.lang = this.currentLanguage;
    utterance.voice = this.bestVoice;
    
    // [Optimization] Slower rate for better clarity on tones (requested by user)
    utterance.rate = 0.9;
    
    // [Fix] Keep natural pitch as requested by user
    utterance.pitch = 1.1;

    this.synth.speak(utterance);
  }

  /**
   * Raw speech without mappings if needed.
   */
  speakRaw(text: string, isEnabled: boolean) {
    if (!this.synth || !isEnabled || !text) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = this.currentLanguage;
    utterance.voice = this.bestVoice;
    utterance.rate = 0.9;
    utterance.pitch = 1.1;
    this.synth.speak(utterance);
  }

  /**
   * Future-proofing placeholder for voice recognition.
   */
  async startListening(): Promise<string> {
    console.warn("Voice input is not implemented yet.");
    return "";
  }
}

export const voiceService = new VoiceService();
