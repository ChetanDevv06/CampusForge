/**
 * Content Moderation Utility
 * Handles text cleaning and safety checks for user-generated content.
 */

import BAD_WORDS from './badWords.json';
import { GoogleGenerativeAI } from "@google/generative-ai";

export interface ModerationResult {
  cleanText: string;
  isFlagged: boolean;
  reason: string | null;
  score: number;
}

const genAI = new GoogleGenerativeAI(process.env.EXPO_PUBLIC_GEMINI_API_KEY || "");

// AI Moderation with Gemini (Universal Web SDK)
export const moderateWithGemini = async (text: string, base64Image?: string) => {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const prompt = `You are a campus safety moderator. Analyze the following ${base64Image ? 'text and image' : 'text'} for:
    1. Hate speech or harassment
    2. Explicit adult content
    3. Illegal activities or drug promotion
    4. Severe profanity
    
    ${text ? `Text: "${text}"` : ''}
    
    Return ONLY a JSON object with:
    {
      "isFlagged": boolean,
      "reason": "short explanation in 5 words",
      "confidence": 0-1
    }`;

    const parts: any[] = [prompt];
    if (base64Image) {
      parts.push({
        inlineData: {
          data: base64Image,
          mimeType: 'image/jpeg'
        }
      });
    }

    const result = await model.generateContent(parts);
    const response = await result.response;
    const jsonText = response.text();
    // Clean potential markdown from response
    const cleanedJson = jsonText.replace(/```json|```/g, '').trim();
    return JSON.parse(cleanedJson);
  } catch (error) {
    console.error("Gemini Moderation Failed:", error);
    return { isFlagged: false, reason: "AI offline", confidence: 0 };
  }
};

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
