/**
 * AgentService - Business logic for agent operations
 * Handles URL discovery, AgentCard fetching, validation, and storage operations
 */

import axios, { AxiosError } from 'axios';
import type { Store, AgentCard } from '../types/index.js';
import {
  AgentFetchError,
  InvalidAgentCardError,
  AgentAlreadyExistsError
} from '../types/index.js';
import { validateAgentCard } from '../utils/validation.js';

export class AgentService {
  constructor(private store: Store) {}

  /**
   * Register a new agent by fetching its AgentCard from the provided URL
   * @param url - Agent URL (can be base URL or direct .json URL)
   * @returns The registered AgentCard
   * @throws AgentFetchError if the AgentCard cannot be fetched
   * @throws InvalidAgentCardError if the fetched data is invalid
   * @throws AgentAlreadyExistsError if an agent with the same name exists
   */
  async registerAgent(url: string): Promise<AgentCard> {
    // Fetch and validate the AgentCard
    const agentCard = await this.fetchAgentCard(url);

    // Store the AgentCard
    return await this.store.createAgent(agentCard);
  }

  /**
   * List all registered agents
   */
  async listAgents(): Promise<AgentCard[]> {
    return await this.store.listAgents();
  }

  /**
   * Get a single agent by name
   * @param name - Agent name
   * @returns AgentCard or null if not found
   */
  async getAgent(name: string): Promise<AgentCard | null> {
    return await this.store.getAgent(name);
  }

  /**
   * Update an existing agent by re-fetching its AgentCard
   * @param name - Agent name
   * @param url - Optional new URL (if not provided, uses the agent's existing URL)
   * @returns The updated AgentCard or null if agent not found
   * @throws AgentFetchError if the AgentCard cannot be fetched
   * @throws InvalidAgentCardError if validation fails or name changed
   */
  async updateAgent(name: string, url?: string): Promise<AgentCard | null> {
    // Get existing agent
    const existingAgent = await this.store.getAgent(name);
    if (!existingAgent) {
      return null;
    }

    // Determine which URL to use
    const fetchUrl = url ?? existingAgent.url;

    // Fetch and validate the AgentCard
    const agentCard = await this.fetchAgentCard(fetchUrl);

    // Ensure the name hasn't changed
    if (agentCard.name !== name) {
      throw new InvalidAgentCardError(
        `Cannot update agent '${name}': fetched AgentCard has different name '${agentCard.name}'`
      );
    }

    // Update the agent
    return await this.store.updateAgent(name, agentCard);
  }

  /**
   * Delete an agent by name
   * @param name - Agent name
   * @returns true if deleted, false if not found
   */
  async deleteAgent(name: string): Promise<boolean> {
    return await this.store.deleteAgent(name);
  }

  /**
   * Fetch an AgentCard from a URL using intelligent routing
   * @param url - Agent URL (can be base URL or direct .json URL)
   * @returns The fetched and validated AgentCard
   * @throws AgentFetchError if the fetch fails
   * @throws InvalidAgentCardError if validation fails
   */
  private async fetchAgentCard(url: string): Promise<AgentCard> {
    // Determine the AgentCard URL using intelligent routing
    const agentCardUrl = this.determineAgentCardUrl(url);

    try {
      // Make HTTP GET request
      const response = await axios.get(agentCardUrl, {
        timeout: 30000,
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'A2A-Registry/1.0'
        },
        validateStatus: (status) => status === 200
      });

      // Parse JSON response
      const data = response.data;

      // Validate AgentCard structure
      validateAgentCard(data);

      return data;
    } catch (error) {
      if (error instanceof InvalidAgentCardError) {
        throw error;
      }

      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError;
        if (axiosError.response) {
          throw new AgentFetchError(
            agentCardUrl,
            `HTTP ${axiosError.response.status}: ${axiosError.response.statusText}`
          );
        } else if (axiosError.code === 'ECONNABORTED') {
          throw new AgentFetchError(agentCardUrl, 'Request timeout');
        } else if (axiosError.code === 'ENOTFOUND') {
          throw new AgentFetchError(agentCardUrl, 'DNS lookup failed');
        } else {
          throw new AgentFetchError(agentCardUrl, axiosError.message);
        }
      }

      throw new AgentFetchError(
        agentCardUrl,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  /**
   * Determine the AgentCard URL using intelligent routing
   * @param url - Input URL
   * @returns The AgentCard URL to fetch from
   */
  private determineAgentCardUrl(url: string): string {
    // If the URL ends with .json, use it directly
    if (url.endsWith('.json')) {
      return url;
    }

    // Otherwise, append /.well-known/agent-card.json
    // Remove trailing slash if present
    const baseUrl = url.replace(/\/$/, '');
    return `${baseUrl}/.well-known/agent-card.json`;
  }
}
