/**
 * JIRA API Client for Endorphin AI
 * Handles authentication and ticket fetching from JIRA Cloud
 */

import type { JiraConfig, JiraTicket } from '../types/config.js';
import { info, error as logError } from '../core/logger.js';

export class JiraClient {
  private config: JiraConfig;
  private authHeader: string;

  constructor(config: JiraConfig) {
    this.config = config;
    // Create Basic Auth header for JIRA Cloud API
    const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
    this.authHeader = `Basic ${auth}`;
  }

  /**
   * Fetch tickets from JIRA based on project ID, issue type, and label
   */
  async fetchTickets(): Promise<JiraTicket[]> {
    const tickets: JiraTicket[] = [];
    let startAt = 0;
    const maxResults = 50;
    let hasMore = true;

    while (hasMore) {
      const jql = `project = "${this.config.projectId}" AND issuetype = "${this.config.issueTypeId}" AND labels = "${this.config.label}"`;
      
      const searchUrl = `${this.config.url}/rest/api/3/search`;
      const params = new URLSearchParams({
        jql,
        startAt: startAt.toString(),
        maxResults: maxResults.toString(),
        fields: 'summary,description,issuetype,status,labels,created,updated'
      });

      try {
        const response = await fetch(`${searchUrl}?${params}`, {
          method: 'GET',
          headers: {
            'Authorization': this.authHeader,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`JIRA API error (${response.status}): ${errorText}`);
        }

        const data = await response.json();
        
        if (!data.issues || !Array.isArray(data.issues)) {
          throw new Error('Invalid response format from JIRA API');
        }

        // Process tickets
        for (const issue of data.issues) {
          tickets.push(this.mapJiraIssueToTicket(issue));
        }

        // Check if we need to fetch more
        hasMore = data.startAt + data.issues.length < data.total;
        startAt += maxResults;

        info(`Fetched ${data.issues.length} tickets (${tickets.length}/${data.total} total)`, { 
          fetched: data.issues.length, 
          totalSoFar: tickets.length, 
          totalAvailable: data.total 
        }, 'JiraClient');

      } catch (error) {
        throw new Error(`Failed to fetch JIRA tickets: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return tickets;
  }

  /**
   * Test JIRA connection and credentials
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.config.url}/rest/api/3/myself`, {
        method: 'GET',
        headers: {
          'Authorization': this.authHeader,
          'Accept': 'application/json'
        }
      });

      return response.ok;
    } catch (error) {
      logError('JIRA connection test failed', error instanceof Error ? error : undefined, { error: String(error) }, 'JiraClient');
      return false;
    }
  }

  /**
   * Map JIRA API issue format to our internal ticket format
   */
  private mapJiraIssueToTicket(issue: any): JiraTicket {
    return {
      id: issue.id,
      key: issue.key,
      summary: issue.fields.summary || '',
      description: this.extractPlainTextFromDescription(issue.fields.description),
      issueType: issue.fields.issuetype?.name || '',
      status: issue.fields.status?.name || '',
      labels: issue.fields.labels || [],
      created: issue.fields.created || '',
      updated: issue.fields.updated || ''
    };
  }

  /**
   * Extract plain text from JIRA's ADF (Atlassian Document Format) description
   */
  private extractPlainTextFromDescription(description: any): string {
    if (!description) return '';
    
    // Handle both string and ADF object formats
    if (typeof description === 'string') {
      return description;
    }

    // If it's ADF format, extract text from content nodes
    if (description.content && Array.isArray(description.content)) {
      return this.extractTextFromADFContent(description.content);
    }

    return '';
  }

  /**
   * Recursively extract text from ADF content nodes
   */
  private extractTextFromADFContent(content: any[]): string {
    let text = '';
    
    for (const node of content) {
      if (node.type === 'text') {
        text += node.text;
      } else if (node.content && Array.isArray(node.content)) {
        text += this.extractTextFromADFContent(node.content);
      }
      
      // Add line breaks for paragraphs
      if (node.type === 'paragraph') {
        text += '\n';
      }
    }
    
    return text.trim();
  }

  /**
   * Validate JIRA configuration
   */
  static validateConfig(config: JiraConfig): string[] {
    const errors: string[] = [];

    if (!config.url) {
      errors.push('JIRA URL is required');
    } else if (!config.url.startsWith('https://')) {
      errors.push('JIRA URL must start with https://');
    }

    if (!config.email) {
      errors.push('JIRA email is required');
    } else if (!config.email.includes('@')) {
      errors.push('JIRA email must be a valid email address');
    }

    if (!config.apiToken) {
      errors.push('JIRA API token is required');
    }

    if (!config.projectId) {
      errors.push('JIRA project ID is required');
    }

    if (!config.issueTypeId) {
      errors.push('JIRA issue type ID is required');
    }

    if (!config.label) {
      errors.push('JIRA label is required');
    }

    return errors;
  }
}