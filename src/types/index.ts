/**
 * Type definitions for A2A Registry
 */

import type { AgentCard } from '@a2a-js/sdk';

// Export AgentCard type from SDK
export type { AgentCard };

/**
 * Storage backend options
 */
export type StoreType = 'json' | 'sqlite';

/**
 * Store interface for agent persistence
 */
export interface Store {
  /**
   * List all agents in the registry
   */
  listAgents(): Promise<AgentCard[]>;

  /**
   * Get a single agent by name
   * @param name - Agent name (primary key)
   * @returns AgentCard or null if not found
   */
  getAgent(name: string): Promise<AgentCard | null>;

  /**
   * Create a new agent
   * @param agentCard - AgentCard to store
   * @returns The created AgentCard
   * @throws Error if an agent with the same name already exists
   */
  createAgent(agentCard: AgentCard): Promise<AgentCard>;

  /**
   * Update an existing agent
   * @param name - Agent name (primary key)
   * @param agentCard - Updated AgentCard
   * @returns The updated AgentCard or null if not found
   */
  updateAgent(name: string, agentCard: AgentCard): Promise<AgentCard | null>;

  /**
   * Delete an agent by name
   * @param name - Agent name (primary key)
   * @returns true if deleted, false if not found
   */
  deleteAgent(name: string): Promise<boolean>;
}

/**
 * CLI configuration
 */
export interface CliConfig {
  store: StoreType;
  file: string;
  port: number;
}

/**
 * Custom error types
 */
export class AgentNotFoundError extends Error {
  constructor(name: string) {
    super(`Agent '${name}' not found`);
    this.name = 'AgentNotFoundError';
  }
}

export class AgentAlreadyExistsError extends Error {
  constructor(name: string) {
    super(`Agent '${name}' already exists`);
    this.name = 'AgentAlreadyExistsError';
  }
}

export class InvalidAgentCardError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidAgentCardError';
  }
}

export class AgentFetchError extends Error {
  constructor(url: string, cause: string) {
    super(`Failed to fetch AgentCard from ${url}: ${cause}`);
    this.name = 'AgentFetchError';
  }
}
