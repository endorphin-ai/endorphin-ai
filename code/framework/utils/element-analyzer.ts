/**
 * Element Analyzer - Smart Element Detection and Recommendations
 * Provides intelligent suggestions when elements are not found
 */

import type { Page } from 'playwright';
import { info, warn } from '../core/logger.js';

export interface ElementAlternative {
  selector: string;
  element: string;
  text: string;
  tagName: string;
  boundingBox?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  confidence: number;
  reason: string;
}

export interface AnalysisResult {
  alternatives: ElementAlternative[];
  recommendations: string[];
  screenshot?: string;
}

/**
 * Analyze page for alternative elements when target element is not found
 */
export class ElementAnalyzer {
  
  /**
   * Find alternative elements that might match the intended target
   */
  static async findAlternatives(
    page: Page, 
    originalSelector: string, 
    textToFind?: string
  ): Promise<AnalysisResult> {
    const alternatives: ElementAlternative[] = [];
    const recommendations: string[] = [];
    
    try {
      // Extract text from selector if it's a text-based selector
      const extractedText = textToFind || ElementAnalyzer.extractTextFromSelector(originalSelector);
      
      if (extractedText) {
        info(`🔍 Analyzing page for alternatives to text: "${extractedText}"`, { text: extractedText }, 'ElementAnalyzer');
        
        // Find links with similar text
        const links = await ElementAnalyzer.findSimilarLinks(page, extractedText);
        alternatives.push(...links);
        
        // Find buttons with similar text
        const buttons = await ElementAnalyzer.findSimilarButtons(page, extractedText);
        alternatives.push(...buttons);
        
        // Find clickable elements with similar text
        const clickableElements = await ElementAnalyzer.findSimilarClickableElements(page, extractedText);
        alternatives.push(...clickableElements);
        
        // Find elements with partial text matches
        const partialMatches = await ElementAnalyzer.findPartialTextMatches(page, extractedText);
        alternatives.push(...partialMatches);
      }
      
      // Generate recommendations based on findings
      recommendations.push(...ElementAnalyzer.generateRecommendations(alternatives, extractedText || undefined));
      
      // Sort alternatives by confidence
      alternatives.sort((a, b) => b.confidence - a.confidence);
      
      return {
        alternatives: alternatives.slice(0, 5), // Top 5 alternatives
        recommendations
      };
      
    } catch (error) {
      warn(`Error analyzing alternatives: ${error}`, { error }, 'ElementAnalyzer');
      return { alternatives: [], recommendations: [] };
    }
  }
  
  /**
   * Extract text from various selector formats
   */
  private static extractTextFromSelector(selector: string): string | null {
    // Handle quoted text selectors
    if (selector.startsWith('"') && selector.endsWith('"')) {
      return selector.slice(1, -1);
    }
    
    // Handle has-text selectors
    const hasTextMatch = selector.match(/has-text\(['"](.+?)['"]\)/);
    if (hasTextMatch) {
      return hasTextMatch[1];
    }
    
    // Handle button:has-text selectors
    const buttonTextMatch = selector.match(/button:has-text\(['"](.+?)['"]\)/);
    if (buttonTextMatch) {
      return buttonTextMatch[1];
    }
    
    // Handle text= selectors
    const textMatch = selector.match(/text=['"](.+?)['"]/);
    if (textMatch) {
      return textMatch[1];
    }
    
    return null;
  }
  
  /**
   * Find links with similar text content
   */
  private static async findSimilarLinks(page: Page, targetText: string): Promise<ElementAlternative[]> {
    try {
      return await page.evaluate((text) => {
        const links = Array.from(document.querySelectorAll('a'));
        return links
          .filter(link => {
            const linkText = link.textContent?.trim() || '';
            return linkText.toLowerCase().includes(text.toLowerCase()) || 
                   text.toLowerCase().includes(linkText.toLowerCase());
          })
          .map(link => {
            const rect = link.getBoundingClientRect();
            const linkText = link.textContent?.trim() || '';
            const similarity = ElementAnalyzer.calculateTextSimilarity(text, linkText);
            
            return {
              selector: `a:has-text("${linkText}")`,
              element: 'link',
              text: linkText,
              tagName: 'a',
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              confidence: similarity,
              reason: `Link found with ${similarity > 0.8 ? 'exact' : 'similar'} text`
            };
          });
      }, targetText);
    } catch {
      return [];
    }
  }
  
  /**
   * Find buttons with similar text content
   */
  private static async findSimilarButtons(page: Page, targetText: string): Promise<ElementAlternative[]> {
    try {
      return await page.evaluate((text) => {
        const buttons = Array.from(document.querySelectorAll('button, input[type="button"], input[type="submit"]'));
        return buttons
          .filter(button => {
            const buttonText = button.textContent?.trim() || 
                             (button as HTMLInputElement).value || '';
            return buttonText.toLowerCase().includes(text.toLowerCase()) || 
                   text.toLowerCase().includes(buttonText.toLowerCase());
          })
          .map(button => {
            const rect = button.getBoundingClientRect();
            const buttonText = button.textContent?.trim() || 
                              (button as HTMLInputElement).value || '';
            const similarity = ElementAnalyzer.calculateTextSimilarity(text, buttonText);
            
            return {
              selector: `button:has-text("${buttonText}")`,
              element: 'button',
              text: buttonText,
              tagName: button.tagName.toLowerCase(),
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              confidence: similarity,
              reason: `Button found with ${similarity > 0.8 ? 'exact' : 'similar'} text`
            };
          });
      }, targetText);
    } catch {
      return [];
    }
  }
  
  /**
   * Find other clickable elements with similar text
   */
  private static async findSimilarClickableElements(page: Page, targetText: string): Promise<ElementAlternative[]> {
    try {
      return await page.evaluate((text) => {
        const clickableElements = Array.from(document.querySelectorAll('[onclick], [role="button"], .btn, .button'));
        return clickableElements
          .filter(element => {
            const elementText = element.textContent?.trim() || '';
            return elementText.toLowerCase().includes(text.toLowerCase()) || 
                   text.toLowerCase().includes(elementText.toLowerCase());
          })
          .map(element => {
            const rect = element.getBoundingClientRect();
            const elementText = element.textContent?.trim() || '';
            const similarity = ElementAnalyzer.calculateTextSimilarity(text, elementText);
            
            return {
              selector: `${element.tagName.toLowerCase()}:has-text("${elementText}")`,
              element: 'clickable element',
              text: elementText,
              tagName: element.tagName.toLowerCase(),
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              confidence: similarity * 0.8, // Lower confidence for generic clickable elements
              reason: `Clickable element found with ${similarity > 0.8 ? 'exact' : 'similar'} text`
            };
          });
      }, targetText);
    } catch {
      return [];
    }
  }
  
  /**
   * Find elements with partial text matches
   */
  private static async findPartialTextMatches(page: Page, targetText: string): Promise<ElementAlternative[]> {
    try {
      return await page.evaluate((text) => {
        const allElements = Array.from(document.querySelectorAll('*'));
        const words = text.toLowerCase().split(' ');
        
        return allElements
          .filter(element => {
            const elementText = element.textContent?.trim() || '';
            if (elementText.length === 0) return false;
            
            // Check if any word from target text appears in element text
            return words.some(word => 
              word.length > 2 && elementText.toLowerCase().includes(word)
            );
          })
          .slice(0, 10) // Limit to prevent too many results
          .map(element => {
            const rect = element.getBoundingClientRect();
            const elementText = element.textContent?.trim() || '';
            const similarity = ElementAnalyzer.calculateTextSimilarity(text, elementText) * 0.6;
            
            return {
              selector: `${element.tagName.toLowerCase()}:has-text("${elementText.substring(0, 20)}")`,
              element: 'partial match',
              text: elementText.substring(0, 50) + (elementText.length > 50 ? '...' : ''),
              tagName: element.tagName.toLowerCase(),
              boundingBox: {
                x: rect.x,
                y: rect.y,
                width: rect.width,
                height: rect.height
              },
              confidence: similarity,
              reason: `Partial text match found`
            };
          })
          .filter(alt => alt.confidence > 0.2); // Only include reasonable matches
      }, targetText);
    } catch {
      return [];
    }
  }
  
  /**
   * Calculate text similarity between two strings
   */
  private static calculateTextSimilarity(text1: string, text2: string): number {
    const str1 = text1.toLowerCase().trim();
    const str2 = text2.toLowerCase().trim();
    
    if (str1 === str2) return 1.0;
    if (str1.includes(str2) || str2.includes(str1)) return 0.8;
    
    // Simple Levenshtein-based similarity
    const maxLength = Math.max(str1.length, str2.length);
    if (maxLength === 0) return 1.0;
    
    const distance = ElementAnalyzer.levenshteinDistance(str1, str2);
    return 1 - (distance / maxLength);
  }
  
  /**
   * Calculate Levenshtein distance between two strings
   */
  private static levenshteinDistance(str1: string, str2: string): number {
    const matrix = Array(str2.length + 1).fill(null).map(() => Array(str1.length + 1).fill(null));
    
    for (let i = 0; i <= str1.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= str2.length; j++) matrix[j][0] = j;
    
    for (let j = 1; j <= str2.length; j++) {
      for (let i = 1; i <= str1.length; i++) {
        const indicator = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,     // deletion
          matrix[j - 1][i] + 1,     // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }
    
    return matrix[str2.length][str1.length];
  }
  
  /**
   * Generate human-readable recommendations based on found alternatives
   */
  private static generateRecommendations(alternatives: ElementAlternative[], targetText?: string): string[] {
    const recommendations: string[] = [];
    
    if (alternatives.length === 0) {
      recommendations.push(`No alternative elements found for "${targetText}"`);
      recommendations.push('Consider checking if:');
      recommendations.push('- The page has fully loaded');
      recommendations.push('- The element is inside a frame or iframe'); 
      recommendations.push('- The element appears after a specific action');
      return recommendations;
    }
    
    // Group alternatives by type
    const byType = alternatives.reduce((acc, alt) => {
      if (!acc[alt.element]) acc[alt.element] = [];
      acc[alt.element].push(alt);
      return acc;
    }, {} as Record<string, ElementAlternative[]>);
    
    // Generate specific recommendations
    Object.entries(byType).forEach(([type, alts]) => {
      const best = alts[0]; // Highest confidence
      if (best.confidence > 0.7) {
        recommendations.push(`✅ Found ${type} with similar text: "${best.text}"`);
        recommendations.push(`   Try selector: ${best.selector}`);
        if (best.boundingBox) {
          recommendations.push(`   Location: x:${Math.round(best.boundingBox.x)}, y:${Math.round(best.boundingBox.y)}`);
        }
      } else if (best.confidence > 0.4) {
        recommendations.push(`⚠️  Found possible ${type}: "${best.text}" (${Math.round(best.confidence * 100)}% match)`);
        recommendations.push(`   Consider: ${best.selector}`);
      }
    });
    
    return recommendations;
  }
}