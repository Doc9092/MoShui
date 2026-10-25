/**
 * Озвучивание китайского текста через встроенный Web Speech API (window.speechSynthesis).
 * Безопасно обрабатывает отсутствие поддержки синтезатора или голосов zh-CN.
 */
export function speakChinese(text: string, rate = 0.85): boolean {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return false;
  }

  const cleanText = text.trim();
  if (!cleanText) {
    return false;
  }

  try {
    const synth = window.speechSynthesis;
    synth.cancel();

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'zh-CN';
    utterance.rate = Math.max(0.5, Math.min(rate, 1.5));
    utterance.pitch = 1.0;

    const voices = synth.getVoices();
    if (Array.isArray(voices) && voices.length > 0) {
      const zhVoice =
        voices.find((v) => v.lang.toLowerCase() === 'zh-cn') ||
        voices.find((v) => v.lang.toLowerCase().startsWith('zh-hans')) ||
        voices.find((v) => v.lang.toLowerCase().startsWith('zh'));

      if (zhVoice) {
        utterance.voice = zhVoice;
      }
    }

    synth.speak(utterance);
    return true;
  } catch (err) {
    console.warn('Не удалось воспроизвести озвучку:', err);
    return false;
  }
}
