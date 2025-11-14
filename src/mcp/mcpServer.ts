/**
 * MCP Server for A2A Registry
 * Provides tools for agent registration, listing, and management
 * Thin adapter layer that calls AgentService methods
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';
import type { AgentService } from '../services/AgentService.js';
import {
  AgentFetchError,
  InvalidAgentCardError,
  AgentAlreadyExistsError
} from '../types/index.js';

// Input schemas for MCP tools
const RegisterAgentSchema = z.object({
  url: z.string()
    .url('Must be a valid URL')
    .describe('Agent URL to fetch the AgentCard from (can be base URL or direct .json URL)')
}).strict();

const GetAgentSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .describe('Agent name to retrieve')
}).strict();

const UpdateAgentSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .describe('Agent name to update'),
  url: z.string()
    .url('Must be a valid URL')
    .optional()
    .describe('Optional new URL to fetch updated AgentCard from')
}).strict();

const DeleteAgentSchema = z.object({
  name: z.string()
    .min(1, 'Name cannot be empty')
    .describe('Agent name to delete')
}).strict();

/**
 * Create and configure MCP server instance
 */
export function createMcpServer(agentService: AgentService): Server {
  const server = new Server(
    {
      name: 'a2a-registry-mcp-server',
      version: '1.0.0'
    },
    {
      capabilities: {
        tools: {}
      }
    }
  );

  // Register tools/list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'a2a_register_agent',
          description: `Register a new agent in the A2A Registry by fetching its AgentCard from a URL.

This tool registers a new agent by automatically fetching and validating its AgentCard. It uses intelligent URL routing:
- If URL ends with .json, fetches directly from that URL
- Otherwise, appends /.well-known/agent.json to the URL

The fetched AgentCard is validated to ensure it contains all required fields (name, description, url, version, capabilities, defaultInputModes, defaultOutputModes, skills) and stored in the registry using the agent's name as the primary key.

Args:
  - url (string): Agent URL to fetch the AgentCard from
    Examples:
      - "https://example.com" → fetches from https://example.com/.well-known/agent.json
      - "https://example.com/my-agent" → fetches from https://example.com/my-agent/.well-known/agent.json
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
  - Returns error if required fields are missing → AgentCard must include name, description, url, version, capabilities, defaultInputModes, defaultOutputModes, and skills`,
          inputSchema: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'Agent URL to fetch the AgentCard from (can be base URL or direct .json URL)'
              }
            },
            required: ['url']
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: false,
            openWorldHint: true
          }
        },
        {
          name: 'a2a_list_agents',
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
    - capabilities: Supported A2A protocol features
    - defaultInputModes: Supported input MIME types
    - defaultOutputModes: Supported output MIME types
    - skills: Agent's distinct capabilities
    - And other optional fields (protocolVersion, preferredTransport, iconUrl, etc.)

Examples:
  - Use when: "Show me all registered agents"
  - Use when: "What agents are available?"
  - Use when: "List the agents in the registry"`,
          inputSchema: {
            type: 'object',
            properties: {}
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        },
        {
          name: 'a2a_get_agent',
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
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Agent name to retrieve'
              }
            },
            required: ['name']
          },
          annotations: {
            readOnlyHint: true,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: false
          }
        },
        {
          name: 'a2a_update_agent',
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
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Agent name to update'
              },
              url: {
                type: 'string',
                description: 'Optional new URL to fetch updated AgentCard from'
              }
            },
            required: ['name']
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: false,
            idempotentHint: true,
            openWorldHint: true
          }
        },
        {
          name: 'a2a_delete_agent',
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
          inputSchema: {
            type: 'object',
            properties: {
              name: {
                type: 'string',
                description: 'Agent name to delete'
              }
            },
            required: ['name']
          },
          annotations: {
            readOnlyHint: false,
            destructiveHint: true,
            idempotentHint: true,
            openWorldHint: false
          }
        }
      ]
    };
  });

  // Register tools/call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case 'a2a_register_agent': {
          const params = RegisterAgentSchema.parse(args);
          const agentCard = await agentService.registerAgent(params.url);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(agentCard, null, 2)
              }
            ]
          };
        }

        case 'a2a_list_agents': {
          const agents = await agentService.listAgents();
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(agents, null, 2)
              }
            ]
          };
        }

        case 'a2a_get_agent': {
          const params = GetAgentSchema.parse(args);
          const agent = await agentService.getAgent(params.name);

          if (!agent) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Error: Agent '${params.name}' not found. Use a2a_list_agents to see available agents.`
                }
              ]
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(agent, null, 2)
              }
            ]
          };
        }

        case 'a2a_update_agent': {
          const params = UpdateAgentSchema.parse(args);
          const agentCard = await agentService.updateAgent(params.name, params.url);

          if (!agentCard) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Error: Agent '${params.name}' not found. Use a2a_register_agent to register new agents.`
                }
              ]
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(agentCard, null, 2)
              }
            ]
          };
        }

        case 'a2a_delete_agent': {
          const params = DeleteAgentSchema.parse(args);
          const deleted = await agentService.deleteAgent(params.name);

          if (!deleted) {
            return {
              isError: true,
              content: [
                {
                  type: 'text',
                  text: `Error: Agent '${params.name}' not found. Use a2a_list_agents to see available agents.`
                }
              ]
            };
          }

          return {
            content: [
              {
                type: 'text',
                text: `Successfully deleted agent '${params.name}'`
              }
            ]
          };
        }

        default:
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: `Unknown tool: ${name}`
              }
            ]
          };
      }
    } catch (error) {
      // Handle validation errors
      if (error instanceof z.ZodError) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Validation error: ${error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ')}`
            }
          ]
        };
      }

      // Handle application errors
      if (error instanceof AgentAlreadyExistsError) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}. Use a2a_update_agent to update the existing agent instead.`
            }
          ]
        };
      }

      if (error instanceof AgentFetchError || error instanceof InvalidAgentCardError) {
        return {
          isError: true,
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }

      // Handle unexpected errors
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Unexpected error: ${error instanceof Error ? error.message : String(error)}`
          }
        ]
      };
    }
  });

  return server;
}

/**
 * Connect MCP server to stdio transport
 */
export async function connectStdio(server: Server): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('A2A Registry MCP server running via stdio');
}

/**
 * Create SSE transport for HTTP
 */
export function createSseTransport(endpoint: string, response: any): SSEServerTransport {
  return new SSEServerTransport(endpoint, response);
}
