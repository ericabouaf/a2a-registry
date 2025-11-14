/**
 * SQLite database storage implementation
 */

import Database from 'better-sqlite3';
import type { Store, AgentCard } from '../types/index.js';
import { AgentAlreadyExistsError } from '../types/index.js';

export class SqliteStore implements Store {
  private db: Database.Database;

  constructor(filePath: string) {
    this.db = new Database(filePath);
    this.initialize();
  }

  /**
   * Create agents table if it doesn't exist
   */
  private initialize(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        name TEXT PRIMARY KEY,
        agent_card TEXT NOT NULL
      )
    `);
  }

  async listAgents(): Promise<AgentCard[]> {
    const rows = this.db.prepare('SELECT agent_card FROM agents').all() as Array<{ agent_card: string }>;
    return rows.map(row => JSON.parse(row.agent_card) as AgentCard);
  }

  async getAgent(name: string): Promise<AgentCard | null> {
    const row = this.db.prepare('SELECT agent_card FROM agents WHERE name = ?').get(name) as { agent_card: string } | undefined;
    return row ? (JSON.parse(row.agent_card) as AgentCard) : null;
  }

  async createAgent(agentCard: AgentCard): Promise<AgentCard> {
    try {
      const stmt = this.db.prepare('INSERT INTO agents (name, agent_card) VALUES (?, ?)');
      stmt.run(agentCard.name, JSON.stringify(agentCard));
      return agentCard;
    } catch (error) {
      if (error instanceof Error && error.message.includes('UNIQUE constraint failed')) {
        throw new AgentAlreadyExistsError(agentCard.name);
      }
      throw error;
    }
  }

  async updateAgent(name: string, agentCard: AgentCard): Promise<AgentCard | null> {
    const stmt = this.db.prepare('UPDATE agents SET agent_card = ? WHERE name = ?');
    const result = stmt.run(JSON.stringify(agentCard), name);

    if (result.changes === 0) {
      return null;
    }

    return agentCard;
  }

  async deleteAgent(name: string): Promise<boolean> {
    const stmt = this.db.prepare('DELETE FROM agents WHERE name = ?');
    const result = stmt.run(name);
    return result.changes > 0;
  }

  /**
   * Close the database connection
   */
  close(): void {
    this.db.close();
  }
}
