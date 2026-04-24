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

import BAD_WORDS from './badWords.json';

// Escape special characters so regex doesn't break on phrases with hyphens or asterisks
const escapeRegExp = (str: string) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
};

const pattern = BAD_WORDS.map(escapeRegExp).join('|');

/**
 * Moderates text content locally using a regex-based blocklist.
 * Replaces the previously disabled AI moderation for better performance.
 */
export const moderateWithAI = async (text: string): Promise<ModerationResult> => {
  if (!text) return { cleanText: '', isFlagged: false, reason: null, score: 0 };
  
  let cleanText = text;
  let isFlagged = false;

  const regex = new RegExp(`\\b(${pattern})\\b`, 'gi');
  
  if (regex.test(cleanText)) {
    isFlagged = true;
    cleanText = cleanText.replace(regex, (match) => '*'.repeat(match.length));
  }

  return {
    cleanText,
    isFlagged,
    reason: isFlagged ? 'Contains inappropriate language' : null,
    score: isFlagged ? 1 : 0
  };
};

/**
 * Sanitizes input text to prevent basic issues
 */
export const sanitizeText = (text: string): string => {
  if (!text) return '';
  return text.trim();
};
