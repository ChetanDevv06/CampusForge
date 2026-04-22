/**
 * Content Moderation Utility
 * Handles text cleaning and safety checks for user-generated content.
 */

export interface ModerationResult {
  cleanText: string;
  isFlagged: boolean;
  reason: string | null;
  score: number;
}

/**
 * Moderates text content.
 * Currently disabled Gemini AI moderation to ensure consistent performance.
 * Performs basic local cleaning (if any) and returns the original text.
 */
export const moderateWithAI = async (text: string): Promise<ModerationResult> => {
  // AI Moderation is currently disabled.
  // Returning original text with a healthy status to allow normal app flow.
  return {
    cleanText: text,
    isFlagged: false,
    reason: null,
    score: 0
  };
};

/**
 * Sanitizes input text to prevent basic issues
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text.trim();
};
