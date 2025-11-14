# A2A Registry

A Model Context Protocol (MCP) server providing a unified registry for agents implementing the A2A (Agent-to-Agent) protocol. The registry exposes both a REST API and MCP tools for registering, querying, and managing agent metadata.

## Features

- **Dual API Access**: REST API and MCP server running on a single HTTP server
- **Intelligent Agent Registration**: Automatically fetches AgentCards from URLs using smart routing
- **Multiple Storage Backends**: JSON file or SQLite database
- **Concurrent Access**: SSE-based MCP transport allows multiple clients simultaneously
- **Full CRUD Operations**: Create, read, update, and delete agents
- **A2A Protocol Compliant**: Uses standard AgentCard model from `@a2a-js/sdk`

## Installation

```bash
npm install
npm run build
```

## Usage

### Basic Usage

```bash
# Start with default settings (JSON store, port 3000)
npm start

# Or run directly
node dist/index.js
```

### Configuration Options

```bash
# Use SQLite storage
node dist/index.js --store=sqlite --file=./agents.db

# Custom port
node dist/index.js --port=4000

# Custom JSON file location
node dist/index.js --store=json --file=./my-agents.json

# Combine options
node dist/index.js --store=sqlite --file=./agents.db --port=4000
```

### CLI Options

| Flag | Values | Description | Default |
|------|--------|-------------|---------|
| `--store` | `json`, `sqlite` | Storage backend | `json` |
| `--file` | path | Database or JSON file path | `a2a-registry.json` or `a2a-registry.db` |
| `--port` | number | HTTP server port | `3000` |
| `--help` | - | Show help message | - |

### Using PM2

```bash
# Start with PM2
pm2 start ecosystem.config.cjs

# View logs
pm2 logs a2a-registry

# Stop
pm2 stop a2a-registry

# Restart
pm2 restart a2a-registry
```

## API Endpoints

### REST API

All REST endpoints are under `/agents`:

#### List All Agents
```bash
GET /agents
```

#### Get Agent by Name
```bash
GET /agents/:name
```

#### Register New Agent
```bash
POST /agents
Content-Type: application/json

{
  "url": "https://example.com"
}
```

The registry will automatically:
1. Determine the AgentCard URL using intelligent routing
2. Fetch the AgentCard from the URL
3. Validate the AgentCard structure
4. Store it using the agent's name as the primary key

**URL Routing Examples:**
- `https://example.com` → Fetches from `https://example.com/.well-known/agent.json`
- `https://example.com/my-agent` → Fetches from `https://example.com/my-agent/.well-known/agent.json`
- `https://cdn.example.com/agent.json` → Fetches directly (URL ends with `.json`)

#### Update Agent
```bash
PUT /agents/:name
Content-Type: application/json

{
  "url": "https://new-url.com"  # Optional, re-fetches from existing URL if omitted
}
```

#### Delete Agent
```bash
DELETE /agents/:name
```

### MCP Server

The MCP server is available at `/mcp` using SSE (Server-Sent Events) transport.

#### Available MCP Tools

1. **a2a_register_agent**
   - Register a new agent by URL
   - Parameters: `{ url: string }`

2. **a2a_list_agents**
   - List all registered agents
   - Parameters: none

3. **a2a_get_agent**
   - Get agent details by name
   - Parameters: `{ name: string }`

4. **a2a_update_agent**
   - Update agent by re-fetching AgentCard
   - Parameters: `{ name: string, url?: string }`

5. **a2a_delete_agent**
   - Delete agent from registry
   - Parameters: `{ name: string }`

## Architecture

```
┌─────────────────────────────────────────┐
│     REST API        │     MCP Server    │
│   (HTTP Routes)     │   (MCP Tools)     │
├─────────────────────┴───────────────────┤
│          AgentService                   │
│  (Business Logic & Validation)          │
├─────────────────────────────────────────┤
│          Store Interface                │
│     (Storage Abstraction)               │
├─────────────────────────────────────────┤
│   JsonFileStore  │  SqliteStore         │
│   (Implementations)                     │
└─────────────────────────────────────────┘
```

### Key Design Principles

- **Service Layer Pattern**: AgentService encapsulates all business logic
- **No Code Duplication**: REST and MCP APIs are thin adapters calling AgentService
- **Intelligent Registration**: Automatic AgentCard discovery and fetching
- **Pluggable Storage**: Easy to add new storage backends
- **Concurrent Access**: Stateless SSE transport for MCP

## AgentCard Structure

The registry uses the standard AgentCard model from the A2A protocol. Required fields include:

- `name`: Agent name (used as primary key)
- `description`: Agent purpose and capabilities
- `url`: Primary A2A endpoint URL
- `version`: Agent version
- `capabilities`: Supported A2A protocol features
- `defaultInputModes`: Supported input MIME types
- `defaultOutputModes`: Supported output MIME types
- `skills`: Agent's distinct capabilities

See the [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/#55-agentcard-object-structure) for complete details.

## Development

### Project Structure

```
a2a-registry/
├── src/
│   ├── index.ts              # Main entry point
│   ├── types/                # TypeScript type definitions
│   ├── store/                # Storage implementations
│   │   ├── JsonFileStore.ts
│   │   └── SqliteStore.ts
│   ├── services/             # Business logic
│   │   └── AgentService.ts
│   ├── api/                  # REST API
│   │   └── restApi.ts
│   ├── mcp/                  # MCP server
│   │   └── mcpServer.ts
│   └── utils/                # Utilities
│       └── validation.ts
├── dist/                     # Compiled JavaScript
├── package.json
├── tsconfig.json
└── ecosystem.config.cjs      # PM2 configuration
```

### Build

```bash
npm run build
```

### Development Mode (with auto-reload)

```bash
npm run dev
```

### Clean Build

```bash
npm run clean
npm run build
```

## Error Handling

The registry provides clear, actionable error messages:

- **404**: Agent not found
- **409**: Agent already exists (use update instead)
- **400**: Invalid URL, fetch failure, or validation error
- **500**: Internal server error

All errors include helpful messages to guide next steps.

## License

MIT

## Contributing

Contributions are welcome! Please ensure:
1. Code follows the existing architecture patterns
2. All business logic is in AgentService
3. APIs are thin adapters
4. Tests pass and build succeeds

## Support

For issues or questions, please open an issue on GitHub.
