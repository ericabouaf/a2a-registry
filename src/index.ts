#!/usr/bin/env node
/**
 * A2A Registry - Main entry point
 *
 * Starts both REST API and MCP server on a single HTTP server
 * Supports multiple storage backends (JSON file or SQLite)
 */

import express from 'express';
import { JsonFileStore } from './store/JsonFileStore.js';
import { SqliteStore } from './store/SqliteStore.js';
import { AgentService } from './services/AgentService.js';
import { createRestApi } from './api/restApi.js';
import { createMcpServer, createSseTransport } from './mcp/mcpServer.js';
import type { Store, StoreType, CliConfig } from './types/index.js';

/**
 * Parse CLI arguments
 */
function parseCliArgs(): CliConfig {
  const args = process.argv.slice(2);
  const config: CliConfig = {
    store: 'json',
    file: '',
    port: 3000
  };

  for (const arg of args) {
    if (arg.startsWith('--store=')) {
      const value = arg.substring('--store='.length) as StoreType;
      if (value !== 'json' && value !== 'sqlite') {
        console.error(`Error: Invalid store type '${value}'. Must be 'json' or 'sqlite'.`);
        process.exit(1);
      }
      config.store = value;
    } else if (arg.startsWith('--file=')) {
      config.file = arg.substring('--file='.length);
    } else if (arg.startsWith('--port=')) {
      const value = parseInt(arg.substring('--port='.length), 10);
      if (isNaN(value) || value < 1 || value > 65535) {
        console.error(`Error: Invalid port '${value}'. Must be a number between 1 and 65535.`);
        process.exit(1);
      }
      config.port = value;
    } else if (arg === '--help' || arg === '-h') {
      console.log(`
A2A Registry Server

Usage: node dist/index.js [options]

Options:
  --store=<type>    Storage backend: 'json' or 'sqlite' (default: json)
  --file=<path>     Database or JSON file path
                    Default for json: a2a-registry.json
                    Default for sqlite: a2a-registry.db
  --port=<number>   HTTP port (default: 3000)
  --help, -h        Show this help message

Examples:
  node dist/index.js
  node dist/index.js --store=sqlite --file=./agents.db --port=4000
  node dist/index.js --store=json --file=./my-agents.json

Endpoints:
  REST API:   http://localhost:<port>/agents
  MCP Server: http://localhost:<port>/mcp (SSE transport)
      `);
      process.exit(0);
    } else {
      console.error(`Error: Unknown argument '${arg}'. Use --help for usage information.`);
      process.exit(1);
    }
  }

  // Set default file path based on store type
  if (!config.file) {
    config.file = config.store === 'json' ? 'a2a-registry.json' : 'a2a-registry.db';
  }

  return config;
}

/**
 * Create store instance based on configuration
 */
function createStore(config: CliConfig): Store {
  if (config.store === 'json') {
    console.error(`Using JSON file store: ${config.file}`);
    return new JsonFileStore(config.file);
  } else {
    console.error(`Using SQLite store: ${config.file}`);
    return new SqliteStore(config.file);
  }
}

/**
 * Main function
 */
async function main() {
  // Parse CLI arguments
  const config = parseCliArgs();

  // Create store
  const store = createStore(config);

  // Create AgentService
  const agentService = new AgentService(store);

  // Create Express app
  const app = express();

  // Mount REST API
  const restApi = createRestApi(agentService);
  app.use(restApi);

  // Create MCP server
  const mcpServer = createMcpServer(agentService);

  // Mount MCP endpoint with SSE transport
  app.get('/mcp', async (req, res) => {
    console.error('MCP client connected via SSE');

    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Create SSE transport for this connection
    const transport = createSseTransport('/mcp', res);

    // Connect MCP server to this transport
    await mcpServer.connect(transport);

    // Handle client disconnect
    req.on('close', () => {
      console.error('MCP client disconnected');
    });
  });

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // Root endpoint
  app.get('/', (req, res) => {
    res.json({
      name: 'A2A Registry',
      version: '1.0.0',
      endpoints: {
        restApi: '/agents',
        mcpServer: '/mcp',
        health: '/health'
      },
      documentation: 'https://github.com/yourusername/a2a-registry'
    });
  });

  // Start HTTP server
  app.listen(config.port, () => {
    console.error(`
┌─────────────────────────────────────────────────────────┐
│  A2A Registry Server                                    │
├─────────────────────────────────────────────────────────┤
│  Storage:     ${config.store.padEnd(45)}│
│  File:        ${config.file.padEnd(45)}│
│  Port:        ${config.port.toString().padEnd(45)}│
├─────────────────────────────────────────────────────────┤
│  REST API:    http://localhost:${config.port}/agents${' '.repeat(22)}│
│  MCP Server:  http://localhost:${config.port}/mcp${' '.repeat(25)}│
│  Health:      http://localhost:${config.port}/health${' '.repeat(22)}│
└─────────────────────────────────────────────────────────┘
    `);
  });
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
