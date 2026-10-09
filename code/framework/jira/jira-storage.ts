/**
 * JIRA Raw Data Storage for Endorphin AI
 * Handles saving and loading of raw JIRA ticket data
 */

import { promises as fs } from 'fs';
import { join, dirname } from 'path';
import type { JiraTicket } from '../types/config.js';
import { info, warn, logSuccess } from '../core/logger.js';

export class JiraStorage {
  private rawDataDir: string;

  constructor(rawDataDir: string = 'jira-raw') {
    this.rawDataDir = rawDataDir;
  }

  /**
   * Save tickets to raw data directory in batch
   */
  async saveTicketsBatch(tickets: JiraTicket[]): Promise<void> {
    // Ensure raw data directory exists
    await this.ensureDirectoryExists(this.rawDataDir);

    const savePromises = tickets.map(ticket => this.saveTicket(ticket));
    await Promise.all(savePromises);

    logSuccess(`Saved ${tickets.length} tickets`, { count: tickets.length, directory: this.rawDataDir }, 'JiraStorage');
  }

  /**
   * Save individual ticket to file
   */
  async saveTicket(ticket: JiraTicket): Promise<void> {
    const filename = `${ticket.key}.json`;
    const filepath = join(this.rawDataDir, filename);

    const ticketData = {
      ...ticket,
      fetchedAt: new Date().toISOString(),
      source: 'jira-api'
    };

    try {
      await fs.writeFile(filepath, JSON.stringify(ticketData, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to save ticket ${ticket.key}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load all tickets from raw data directory
   */
  async loadAllTickets(): Promise<JiraTicket[]> {
    try {
      const files = await fs.readdir(this.rawDataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      const tickets: JiraTicket[] = [];
      for (const file of jsonFiles) {
        try {
          const ticket = await this.loadTicket(file);
          tickets.push(ticket);
        } catch (error) {
          warn(`Failed to load ticket from ${file}`, { file, error: String(error) }, 'JiraStorage');
        }
      }

      return tickets;
    } catch (error) {
      if ((error as any).code === 'ENOENT') {
        return []; // Directory doesn't exist, return empty array
      }
      throw new Error(`Failed to load tickets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Load individual ticket from file
   */
  async loadTicket(filename: string): Promise<JiraTicket> {
    const filepath = join(this.rawDataDir, filename);
    
    try {
      const content = await fs.readFile(filepath, 'utf8');
      const data = JSON.parse(content);
      
      // Validate required fields
      if (!data.id || !data.key || !data.summary) {
        throw new Error(`Invalid ticket data in ${filename}`);
      }
      
      return data as JiraTicket;
    } catch (error) {
      throw new Error(`Failed to load ticket from ${filename}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if ticket already exists in storage
   */
  async ticketExists(ticketKey: string): Promise<boolean> {
    const filename = `${ticketKey}.json`;
    const filepath = join(this.rawDataDir, filename);

    try {
      await fs.access(filepath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get tickets that need updating (based on updated timestamp)
   */
  async getTicketsNeedingUpdate(remoteTickets: JiraTicket[]): Promise<JiraTicket[]> {
    const ticketsNeedingUpdate: JiraTicket[] = [];

    for (const remoteTicket of remoteTickets) {
      try {
        if (await this.ticketExists(remoteTicket.key)) {
          const localTicket = await this.loadTicket(`${remoteTicket.key}.json`);
          
          // Compare updated timestamps
          const remoteUpdated = new Date(remoteTicket.updated);
          const localUpdated = new Date(localTicket.updated);
          
          if (remoteUpdated > localUpdated) {
            ticketsNeedingUpdate.push(remoteTicket);
          }
        } else {
          // New ticket
          ticketsNeedingUpdate.push(remoteTicket);
        }
      } catch (error) {
        warn(`Error checking ticket ${remoteTicket.key}`, { ticketKey: remoteTicket.key, error: String(error) }, 'JiraStorage');
        ticketsNeedingUpdate.push(remoteTicket); // Include in update list if error
      }
    }

    return ticketsNeedingUpdate;
  }

  /**
   * Clean up old/deleted tickets
   */
  async cleanupOldTickets(currentTicketKeys: string[]): Promise<number> {
    try {
      const files = await fs.readdir(this.rawDataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      let deletedCount = 0;
      
      for (const file of jsonFiles) {
        const ticketKey = file.replace('.json', '');
        
        if (!currentTicketKeys.includes(ticketKey)) {
          const filepath = join(this.rawDataDir, file);
          await fs.unlink(filepath);
          deletedCount++;
          info(`Deleted old ticket: ${ticketKey}`, { ticketKey }, 'JiraStorage');
        }
      }
      
      return deletedCount;
    } catch (error) {
      warn('Failed to cleanup old tickets', { error: String(error) }, 'JiraStorage');
      return 0;
    }
  }

  /**
   * Get storage statistics
   */
  async getStorageStats(): Promise<{
    totalTickets: number;
    totalSize: number;
    oldestTicket?: string;
    newestTicket?: string;
  }> {
    try {
      const files = await fs.readdir(this.rawDataDir);
      const jsonFiles = files.filter(file => file.endsWith('.json'));
      
      let totalSize = 0;
      let oldestDate = new Date();
      let newestDate = new Date(0);
      let oldestTicket = '';
      let newestTicket = '';
      
      for (const file of jsonFiles) {
        const filepath = join(this.rawDataDir, file);
        const stats = await fs.stat(filepath);
        totalSize += stats.size;
        
        try {
          const ticket = await this.loadTicket(file);
          const ticketDate = new Date(ticket.updated);
          
          if (ticketDate < oldestDate) {
            oldestDate = ticketDate;
            oldestTicket = ticket.key;
          }
          
          if (ticketDate > newestDate) {
            newestDate = ticketDate;
            newestTicket = ticket.key;
          }
        } catch {
          // Skip invalid files
        }
      }
      
      return {
        totalTickets: jsonFiles.length,
        totalSize,
        ...(oldestTicket && { oldestTicket }),
        ...(newestTicket && { newestTicket })
      };
    } catch {
      return {
        totalTickets: 0,
        totalSize: 0
      };
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.mkdir(dirPath, { recursive: true });
    } catch (error) {
      throw new Error(`Failed to create directory ${dirPath}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Export tickets to JSON file
   */
  async exportTickets(outputPath: string): Promise<void> {
    const tickets = await this.loadAllTickets();
    
    // Ensure output directory exists
    await this.ensureDirectoryExists(dirname(outputPath));
    
    const exportData = {
      exportedAt: new Date().toISOString(),
      totalTickets: tickets.length,
      tickets
    };
    
    await fs.writeFile(outputPath, JSON.stringify(exportData, null, 2), 'utf8');
    logSuccess(`Exported ${tickets.length} tickets to ${outputPath}`, { count: tickets.length, outputPath }, 'JiraStorage');
  }

  /**
   * Import tickets from JSON file
   */
  async importTickets(inputPath: string): Promise<number> {
    try {
      const content = await fs.readFile(inputPath, 'utf8');
      const data = JSON.parse(content);
      
      if (!data.tickets || !Array.isArray(data.tickets)) {
        throw new Error('Invalid import file format');
      }
      
      await this.saveTicketsBatch(data.tickets);
      return data.tickets.length;
    } catch (error) {
      throw new Error(`Failed to import tickets: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}