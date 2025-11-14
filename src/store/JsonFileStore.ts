/**
 * JSON file-based storage implementation
 */

import { promises as fs } from 'fs';
import { existsSync } from 'fs';
import type { Store, AgentCard } from '../types/index.js';
import { AgentAlreadyExistsError, AgentNotFoundError } from '../types/index.js';

export class JsonFileStore implements Store {
  private filePath: string;
  private agents: Map<string, AgentCard>;
  private initialized: boolean = false;

  constructor(filePath: string) {
    this.filePath = filePath;
    this.agents = new Map();
  }

  /**
   * Initialize the store by loading data from file
   */
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    if (existsSync(this.filePath)) {
      try {
        const data = await fs.readFile(this.filePath, 'utf-8');
        const parsed = JSON.parse(data);

        if (typeof parsed === 'object' && parsed !== null) {
          Object.entries(parsed).forEach(([name, agentCard]) => {
            this.agents.set(name, agentCard as AgentCard);
          });
        }
      } catch (error) {
        console.error(`Warning: Could not read ${this.filePath}, starting with empty registry`);
      }
    }

    this.initialized = true;
  }

  /**
   * Persist current state to disk
   */
  private async persist(): Promise<void> {
    const data: Record<string, AgentCard> = {};
    this.agents.forEach((agentCard, name) => {
      data[name] = agentCard;
    });

    await fs.writeFile(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async listAgents(): Promise<AgentCard[]> {
    await this.initialize();
    return Array.from(this.agents.values());
  }

  async getAgent(name: string): Promise<AgentCard | null> {
    await this.initialize();
    return this.agents.get(name) ?? null;
  }

  async createAgent(agentCard: AgentCard): Promise<AgentCard> {
    await this.initialize();

    if (this.agents.has(agentCard.name)) {
      throw new AgentAlreadyExistsError(agentCard.name);
    }

    this.agents.set(agentCard.name, agentCard);
    await this.persist();
    return agentCard;
  }

  async updateAgent(name: string, agentCard: AgentCard): Promise<AgentCard | null> {
    await this.initialize();

    if (!this.agents.has(name)) {
      return null;
    }

    this.agents.set(name, agentCard);
    await this.persist();
    return agentCard;
  }

  async deleteAgent(name: string): Promise<boolean> {
    await this.initialize();

    if (!this.agents.has(name)) {
      return false;
    }

    this.agents.delete(name);
    await this.persist();
    return true;
  }
}
