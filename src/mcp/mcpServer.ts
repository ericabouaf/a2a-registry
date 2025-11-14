/**
 * MCP Server for A2A Registry
 * Provides tools for agent registration, listing, and management
 * Thin adapter layer that calls AgentService methods
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { z } from 'zod';
import type { AgentService } from '../services/AgentService.js';
import {
  AgentFetchError,
  InvalidAgentCardError,
  AgentAlreadyExistsError
} from '../types/index.js';

// Input/Output schemas for MCP tools
const RegisterAgentInputSchema = {
  url: z.string()
    .url('Must be a valid URL')
    .describe('Agent URL to fetch the AgentCard from (can be base URL or direct .json URL)')
};

const AgentCardOutputSchema = {
  agentCard: z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    version: z.string(),
    capabilities: z.object({
      streaming: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      stateTransitionHistory: z.boolean().optional(),
      extensions: z.array(z.any()).optional()
    }).passthrough(),
    defaultInputModes: z.array(z.string()),
    defaultOutputModes: z.array(z.string()),
    skills: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      examples: z.array(z.string()).optional(),
      inputModes: z.array(z.string()).optional(),
      outputModes: z.array(z.string()).optional(),
      security: z.array(z.any()).optional()
    }).passthrough())
  }).passthrough()
};

const GetAgentInputSchema = {
  name: z.string()
    .min(1, 'Name cannot be empty')
    .describe('Agent name to retrieve')
};

const UpdateAgentInputSchema = {
  name: z.string()
    .min(1, 'Name cannot be empty')
    .describe('Agent name to update'),
  url: z.string()
    .url('Must be a valid URL')
    .optional()
    .describe('Optional new URL to fetch updated AgentCard from')
};

const DeleteAgentInputSchema = {
  name: z.string()
    .min(1, 'Name cannot be empty')
    .describe('Agent name to delete')
};

const DeleteAgentOutputSchema = {
  success: z.boolean(),
  message: z.string()
};

const AgentListOutputSchema = {
  agents: z.array(z.object({
    name: z.string(),
    description: z.string(),
    url: z.string(),
    version: z.string(),
    capabilities: z.object({
      streaming: z.boolean().optional(),
      pushNotifications: z.boolean().optional(),
      stateTransitionHistory: z.boolean().optional(),
      extensions: z.array(z.any()).optional()
    }).passthrough(),
    defaultInputModes: z.array(z.string()),
    defaultOutputModes: z.array(z.string()),
    skills: z.array(z.object({
      id: z.string(),
      name: z.string(),
      description: z.string(),
      tags: z.array(z.string()),
      examples: z.array(z.string()).optional(),
      inputModes: z.array(z.string()).optional(),
      outputModes: z.array(z.string()).optional(),
      security: z.array(z.any()).optional()
    }).passthrough())
  }).passthrough())
};

/**
 * Create and configure MCP server instance
 */
export function createMcpServer(agentService: AgentService): McpServer {
  const server = new McpServer({
    name: 'a2a-registry-mcp-server',
    version: '1.0.0'
  });

  // Register a2a_register_agent tool
  server.registerTool(
    'a2a_register_agent',
    {
      title: 'Register Agent',
      description: `Register a new agent in the A2A Registry by fetching its AgentCard from a URL.

This tool registers a new agent by automatically fetching and validating its AgentCard. It uses intelligent URL routing:
- If URL ends with .json, fetches directly from that URL
- Otherwise, appends /.well-known/agent-card.json to the URL

The fetched AgentCard is validated to ensure it contains all required fields (name, description, url, version, capabilities object, defaultInputModes, defaultOutputModes, skills array) and stored in the registry using the agent's name as the primary key.

Args:
  - url (string): Agent URL to fetch the AgentCard from
    Examples:
      - "https://example.com" → fetches from https://example.com/.well-known/agent-card.json
      - "https://example.com/my-agent" → fetches from https://example.com/my-agent/.well-known/agent-card.json
      - "https://cdn.example.com/agent.json" → fetches directly from the provided URL

Returns:
  Success: The registered AgentCard as JSON with all fields including name, description, url, version, capabilities, skills, etc.

Examples:
  - Use when: "Register the agent at https://myagent.com"
  - Use when: "Add a new agent from https://agents.example.com/assistant.json"
  - Don't use when: Agent is already registered (use a2a_update_agent instead)

Error Handling:
  - Returns error if agent with same name already exists → Use a2a_update_agent to update instead
  - Returns error if URL cannot be reached → Check URL is correct and accessible
  - Returns error if AgentCard validation fails → Ensure the AgentCard follows A2A protocol specification
  - Returns error if required fields are missing → AgentCard must include name, description, url, version, capabilities (object), defaultInputModes, defaultOutputModes, and skills (array)`,
      inputSchema: RegisterAgentInputSchema,
      outputSchema: AgentCardOutputSchema
    },
    async ({ url }) => {
      try {
        const agentCard = await agentService.registerAgent(url);
        const output = { agentCard };
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(agentCard, null, 2)
            }
          ],
          structuredContent: output
        };
      } catch (error) {
        if (error instanceof AgentAlreadyExistsError) {
          throw new Error(`${error.message}. Use a2a_update_agent to update the existing agent instead.`);
        }
        if (error instanceof AgentFetchError || error instanceof InvalidAgentCardError) {
          throw new Error(error.message);
        }
        throw error;
      }
    }
  );

  // Register a2a_list_agents tool
  server.registerTool(
    'a2a_list_agents',
    {
      title: 'List Agents',
      description: `List all agents registered in the A2A Registry.

This tool returns the complete list of all registered agents with their full AgentCard data. Each AgentCard includes all metadata about the agent including name, description, capabilities, supported input/output modes, and skills.

Args:
  No arguments required

Returns:
  Array of AgentCard objects, each containing:
    - name: Agent name
    - description: Agent purpose and capabilities
    - url: Primary A2A endpoint URL
    - version: Agent version
    - capabilities: Object with optional features (streaming, pushNotifications, stateTransitionHistory, extensions)
    - defaultInputModes: Supported input MIME types
    - defaultOutputModes: Supported output MIME types
    - skills: Array of skill objects, each with id, name, description, tags (required), and optional examples, inputModes, outputModes
    - And other optional fields (protocolVersion, preferredTransport, iconUrl, etc.)

Examples:
  - Use when: "Show me all registered agents"
  - Use when: "What agents are available?"
  - Use when: "List the agents in the registry"`,
      inputSchema: {},
      outputSchema: AgentListOutputSchema
    },
    async () => {
      const agents = await agentService.listAgents();
      const output = { agents };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agents, null, 2)
          }
        ],
        structuredContent: output
      };
    }
  );

  // Register a2a_get_agent tool
  server.registerTool(
    'a2a_get_agent',
    {
      title: 'Get Agent',
      description: `Get detailed information about a specific agent by name.

This tool retrieves the complete AgentCard for a single agent identified by its name. The agent name serves as the unique identifier in the registry.

Args:
  - name (string): Agent name to retrieve
    Example: "MyAssistant", "weather-agent", "translation-bot"

Returns:
  The complete AgentCard object with all metadata, or an error if the agent is not found.

Examples:
  - Use when: "Get details for the agent named 'MyAssistant'"
  - Use when: "Show me information about the weather-agent"
  - Use when: "What are the capabilities of translation-bot?"

Error Handling:
  - Returns error if agent not found → Use a2a_list_agents to see available agents`,
      inputSchema: GetAgentInputSchema,
      outputSchema: AgentCardOutputSchema
    },
    async ({ name }) => {
      const agent = await agentService.getAgent(name);

      if (!agent) {
        throw new Error(`Agent '${name}' not found. Use a2a_list_agents to see available agents.`);
      }

      const output = { agentCard: agent };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agent, null, 2)
          }
        ],
        structuredContent: output
      };
    }
  );

  // Register a2a_update_agent tool
  server.registerTool(
    'a2a_update_agent',
    {
      title: 'Update Agent',
      description: `Update an existing agent by re-fetching its AgentCard.

This tool updates an agent's information by re-fetching and revalidating its AgentCard. You can optionally provide a new URL if the agent's endpoint has changed. The agent is identified by name, and the fetched AgentCard must have the same name.

Args:
  - name (string): Agent name to update (primary key)
  - url (string, optional): New URL to fetch AgentCard from. If not provided, uses the agent's existing URL

Returns:
  The updated AgentCard with refreshed data

Examples:
  - Use when: "Update the agent named 'MyAssistant'" → Re-fetches from current URL
  - Use when: "Update MyAssistant with new URL https://newurl.com" → Fetches from new URL
  - Use when: "Refresh the weather-agent data"

Error Handling:
  - Returns error if agent not found → Use a2a_register_agent to register new agents
  - Returns error if URL cannot be reached → Check URL is correct and accessible
  - Returns error if fetched AgentCard has different name → Cannot change agent name during update
  - Returns error if validation fails → Ensure AgentCard follows A2A protocol specification`,
      inputSchema: UpdateAgentInputSchema,
      outputSchema: AgentCardOutputSchema
    },
    async ({ name, url }) => {
      const agentCard = await agentService.updateAgent(name, url);

      if (!agentCard) {
        throw new Error(`Agent '${name}' not found. Use a2a_register_agent to register new agents.`);
      }

      const output = { agentCard };
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(agentCard, null, 2)
          }
        ],
        structuredContent: output
      };
    }
  );

  // Register a2a_delete_agent tool
  server.registerTool(
    'a2a_delete_agent',
    {
      title: 'Delete Agent',
      description: `Delete an agent from the registry by name.

This tool permanently removes an agent from the registry. The agent is identified by its name.

Args:
  - name (string): Agent name to delete

Returns:
  Success confirmation message

Examples:
  - Use when: "Delete the agent named 'MyAssistant'"
  - Use when: "Remove weather-agent from the registry"

Error Handling:
  - Returns error if agent not found → Use a2a_list_agents to see available agents`,
      inputSchema: DeleteAgentInputSchema,
      outputSchema: DeleteAgentOutputSchema
    },
    async ({ name }) => {
      const deleted = await agentService.deleteAgent(name);

      if (!deleted) {
        throw new Error(`Agent '${name}' not found. Use a2a_list_agents to see available agents.`);
      }

      const output = {
        success: true,
        message: `Successfully deleted agent '${name}'`
      };
      return {
        content: [
          {
            type: 'text',
            text: output.message
          }
        ],
        structuredContent: output
      };
    }
  );

  return server;
}

/**
 * Connect MCP server to stdio transport
 */
export async function connectStdio(server: McpServer): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('A2A Registry MCP server running via stdio');
}

/**
 * Create StreamableHTTP transport for HTTP (replaces deprecated SSE transport)
 * Note: This should be used with a POST endpoint, not GET
 */
export function createStreamableHttpTransport(): StreamableHTTPServerTransport {
  return new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined, // Stateless mode - no session management
    enableJsonResponse: true
  });
}
