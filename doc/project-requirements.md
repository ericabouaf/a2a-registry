A2A Registry — Project Requirements

1. Overview

The A2A Registry is a Node.js/TypeScript project that provides a unified way to register, store, and query agents implementing the A2A (Agent-to-Agent) protocol. It exposes:
	•	An MCP server using the @modelcontextprotocol/sdk with Streamable HTTP transport (SSE).
	•	A REST API offering CRUD operations on AgentCard resources.
	•	A flexible storage abstraction supporting multiple backends. (for the time being, JSON files or SQLite databases)

Both the MCP server and REST API run on a single HTTP server, making the registry accessible to multiple agents concurrently without session management overhead.

The project uses the standard AgentCard model from the `@a2a-js/sdk` package, ensuring compatibility with the official A2A protocol specification.

This document specifies all functional and technical requirements.

⸻

2. Main Objectives
	1.	Maintain a persistent registry of A2A agents.
	2.	Provide programmatic access via:
	•	MCP API (Streamable HTTP/SSE transport)
	•	REST API (HTTP)
	3.	Support concurrent access from multiple agents without session management.
	4.	Allow multiple storage backends:
	•	JSON file
	•	SQLite database
	5.	Allow selecting the backend at runtime through CLI parameters.
	6.	Offer a clean, extensible architecture ready for future features.

⸻

3. Agent Model

The registry uses the standard **AgentCard** model from the A2A protocol specification, as defined in the `@a2a-js/sdk` package.

3.1. AgentCard Structure

The AgentCard is the official A2A metadata format describing an agent's identity, capabilities, and interaction requirements. All required and optional fields are defined by the A2A protocol specification (see https://a2a-protocol.org/latest/specification/#55-agentcard-object-structure).

**Key required fields include:**
- `name`: Human-readable agent name
- `description`: Agent purpose and capabilities
- `url`: Primary A2A endpoint URL
- `version`: Agent version
- `capabilities`: Supported A2A protocol features
- `defaultInputModes`: Supported input MIME types
- `defaultOutputModes`: Supported output MIME types
- `skills`: Agent's distinct capabilities

**Optional fields include:**
- `protocolVersion`: A2A protocol version (defaults to "0.3.0")
- `preferredTransport`: Transport protocol (defaults to "JSONRPC")
- `iconUrl`, `provider`, `documentationUrl`, `securitySchemes`, etc.

3.2. AgentCard Discovery

When registering a new agent, only the agent's URL is required. The registry must:
1. Accept the agent URL as input
2. Determine the AgentCard URL using intelligent routing:
   - If the URL ends with `.json`, use it directly as the AgentCard URL
   - Otherwise, append `/.well-known/agent-card.json` to the base URL
3. Make an HTTP GET request to the determined AgentCard URL
4. Validate that the response is a valid AgentCard object
5. Store the fetched AgentCard in the registry

**Examples:**
- Input: `https://example.com` → Fetch from: `https://example.com/.well-known/agent-card.json`
- Input: `https://example.com/my-agent` → Fetch from: `https://example.com/my-agent/.well-known/agent-card.json`
- Input: `https://example.com/agents/my-agent.json` → Fetch from: `https://example.com/agents/my-agent.json` (direct)
- Input: `https://cdn.example.com/agentcard.json` → Fetch from: `https://cdn.example.com/agentcard.json` (direct)

**Note:** The agent's `name` field serves as the primary key in the registry. Agent names must be unique.

3.3. Type Imports

The project must import AgentCard and related types from `@a2a-js/sdk`:

```typescript
import type { AgentCard } from '@a2a-js/sdk';
```

⸻

4. Storage Abstraction Layer

The project must define a Store interface that works with AgentCard objects.

4.1. Store Interface

```typescript
interface Store {
  listAgents(): Promise<AgentCard[]>;
  getAgent(name: string): Promise<AgentCard | null>;
  createAgent(agentCard: AgentCard): Promise<AgentCard>;
  updateAgent(name: string, agentCard: AgentCard): Promise<AgentCard | null>;
  deleteAgent(name: string): Promise<boolean>;
}
```

**Notes:**
- All methods use `name` as the identifier (primary key), not a generated ID
- The `createAgent` method receives an already-fetched AgentCard and will fail if an agent with the same name already exists
- The URL discovery and fetching logic is handled at a higher level (in the API/service layer) before persisting to storage

4.2. Implementations

Two storage implementations must be provided:
	1.	JsonFileStore
	•	Stores data in a JSON file on disk.
	•	Automatically initializes the file if missing.
	•	Keeps all data in memory and flushes to disk on every change.
	•	Uses agent name as the object key for quick lookups.
	2.	SqliteStore
	•	Persists agents in a SQLite database.
	•	Uses better-sqlite3 for synchronous, fast access.
	•	Must create the agents table if it does not exist.
	•	Uses agent name as the PRIMARY KEY in the database schema.

4.3. Runtime Configuration

The storage backend must be selectable at runtime:

--store=json   --file=./agents.json
--store=sqlite --file=./agents.db

Default values:
	•	If store = json → default file: a2a-registry.json
	•	If store = sqlite → default file: a2a-registry.db

⸻

5. Service Layer Architecture

To avoid code duplication between the REST API and MCP server, the project must implement a service layer that encapsulates all business logic.

5.1. AgentService

A central `AgentService` class/module must be created to handle all agent operations:

```typescript
class AgentService {
  constructor(private store: Store) {}

  async registerAgent(url: string): Promise<AgentCard>;
  async listAgents(): Promise<AgentCard[]>;
  async getAgent(name: string): Promise<AgentCard | null>;
  async updateAgent(name: string, url?: string): Promise<AgentCard | null>;
  async deleteAgent(name: string): Promise<boolean>;
}
```

**Responsibilities:**
- Intelligent URL routing (`.json` detection)
- AgentCard fetching from remote URLs
- AgentCard validation
- Interaction with the Store layer
- Error handling and normalization

5.2. Architecture Layers

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

**Key principles:**
- REST routes and MCP tools are thin adapters that call AgentService methods
- All business logic resides in AgentService
- Both APIs share the same AgentService instance
- Store is injected into AgentService for testability

⸻

6. AgentCard Fetching

The AgentCard fetching logic is part of the AgentService and handles discovery and validation.

6.1. Discovery Process

```typescript
async function fetchAgentCard(url: string): Promise<AgentCard> {
  // 1. Determine the AgentCard URL using intelligent routing
  const agentCardUrl = url.endsWith('.json')
    ? url  // Use URL directly if it's a JSON file
    : `${url}/.well-known/agent-card.json`;  // Otherwise append well-known path

  // 2. Make HTTP GET request
  const response = await fetch(agentCardUrl);

  // 3. Parse JSON response
  const agentCard = await response.json();

  // 4. Validate AgentCard structure
  validateAgentCard(agentCard);

  return agentCard;
}
```

**Note:** This function should be a private method within AgentService, called by `registerAgent` and `updateAgent` methods.

6.2. Validation Requirements

The fetched AgentCard must be validated to ensure:
- All required fields are present (name, description, url, version, capabilities, defaultInputModes, defaultOutputModes, skills)
- Field types match the AgentCard specification
- URLs are well-formed
- Arrays contain valid elements

6.3. Error Handling

The service must handle:
- Network errors (connection timeout, DNS failure)
- HTTP errors (404, 500, etc.)
- Invalid JSON responses
- Missing required fields
- Type validation failures

All errors should be propagated with clear, actionable messages.

⸻

7. REST API Requirements

The project exposes an HTTP API providing full CRUD access to agents.

**Implementation Note:** REST route handlers must be thin adapters that:
1. Parse HTTP request parameters and body
2. Call the appropriate AgentService method
3. Transform the result into HTTP responses with appropriate status codes
4. Handle errors and convert them to appropriate HTTP error responses

7.1. Base URL

/agents

7.2. Endpoints

GET /agents
	•	Returns the full list of agents.

GET /agents/:name
	•	Returns a single agent by name.
	•	The name parameter should be URL-encoded if it contains special characters.
	•	Returns 404 if not found.

POST /agents
	•	Registers a new agent.
	•	Expects a JSON body with a single field: `{ "url": "https://agent-url.com" }`
	•	The URL can be either:
		- A base URL (e.g., `https://example.com`) → fetches from `/.well-known/agent-card.json`
		- A direct JSON URL (e.g., `https://example.com/agent.json`) → fetches directly
	•	The server will:
		1. Determine the AgentCard URL using intelligent routing (check if URL ends with `.json`)
		2. Fetch the AgentCard from the determined URL
		3. Validate the fetched AgentCard structure
		4. Store the AgentCard using the agent's name as the key
	•	Returns 201 with the created AgentCard resource.
	•	Returns 400 if the URL is invalid or the AgentCard cannot be fetched/validated.
	•	Returns 409 if an agent with the same name already exists.

PUT /agents/:name
	•	Re-fetches and updates an existing agent's AgentCard.
	•	The name parameter should be URL-encoded if it contains special characters.
	•	No request body required (or optionally accepts `{ "url": "new-url" }` to change the agent's URL).
	•	The server will:
		1. Re-fetch the AgentCard from the agent's URL (or new URL if provided)
		2. Validate the fetched AgentCard
		3. Update the stored data (note: if the fetched AgentCard has a different name, this should fail)
	•	Returns 200 with the updated AgentCard resource.
	•	Returns 404 if agent does not exist.
	•	Returns 400 if the AgentCard cannot be fetched/validated or if the name has changed.

DELETE /agents/:name
	•	Deletes the agent by name.
	•	The name parameter should be URL-encoded if it contains special characters.
	•	Returns 204 if successful.
	•	Returns 404 if not found.

7.3. Server Configuration
	•	Default port: 3000
	•	Configurable via CLI: --port=XXXX

⸻

8. MCP Server Requirements

The MCP server must:
	•	Be implemented using @modelcontextprotocol/sdk.
	•	Start automatically when the application runs.
	•	Use Streamable HTTP transport (SSE - Server-Sent Events) without session management.
	•	Be accessible on the same HTTP server as the REST API (different endpoint path).
	•	Use the same storage backend as the REST API.

**Implementation Note:** MCP tool handlers must be thin adapters that:
1. Parse MCP tool call parameters
2. Call the appropriate AgentService method
3. Transform the result into MCP tool responses
4. Handle errors and convert them to MCP error responses

8.1. Transport Configuration

The MCP server must use the Streamable HTTP transport because:
- The registry is shared between multiple agents
- No session state needs to be maintained
- HTTP transport allows concurrent access from multiple clients
- Compatible with standard HTTP infrastructure (load balancers, proxies, etc.)

**Endpoint structure:**
- REST API: `/agents` (CRUD operations)
- MCP Server: `/mcp` (MCP protocol over SSE)

8.2. Tools to Implement

The following MCP tools must be implemented:

1. **registerAgent**
	•	Input: `{ url: string }`
	•	Fetches the AgentCard from the provided URL
	•	Stores it in the registry using the agent's name as the primary key
	•	Returns the created AgentCard or an MCP error if fetch/validation fails or if an agent with the same name already exists

2. **listAgents**
	•	No input required
	•	Returns the full list of registered agents

3. **getAgent**
	•	Input: `{ name: string }`
	•	Returns the agent by name or an MCP error if not found

4. **updateAgent** (optional, recommended)
	•	Input: `{ name: string, url?: string }`
	•	Re-fetches the AgentCard from the agent's URL (or new URL if provided)
	•	Updates the registry (fails if the fetched AgentCard has a different name)
	•	Returns the updated AgentCard or an MCP error

5. **deleteAgent** (optional, recommended)
	•	Input: `{ name: string }`
	•	Removes the agent from the registry by name
	•	Returns success confirmation or an MCP error

⸻

9. Command-line Interface Requirements

The app must accept CLI parameters in the format:

node dist/index.js \
  --store=sqlite \
  --file=/path/to/agents.db \
  --port=4000

Supported flags:

Flag	Values	Description
--store	json, sqlite	Choose storage backend
--file	any path	Database or JSON file path
--port	number	HTTP port

All flags are optional.

⸻

10. Runtime Architecture

When the application launches:
	1.	CLI options are parsed.
	2.	The correct Store implementation is instantiated.
	3.	An AgentService instance is created with the Store.
	4.	A single HTTP server starts with multiple endpoints:
		- REST API endpoints at `/agents`
		- MCP server endpoint at `/mcp` (using Streamable HTTP/SSE transport)
	5.	Both the REST API and MCP server share the same AgentService instance.
	6.	The server listens on the configured port (default: 3000).

**Dependency flow:**
```
Store → AgentService → { REST API, MCP Server }
```

⸻

11. PM2 Configuration

The project must ship with an ecosystem.config.cjs containing:
	•	Script: dist/index.js
	•	Example args for using SQLite
	•	Minimal restart and memory options
	•	No Dockerfile required

⸻

12. Non-functional Requirements

12.1. Code Quality
	•	Written in TypeScript
	•	Follows ES2022 module syntax
	•	Strict mode enabled
	•	No code duplication between REST API and MCP server (use AgentService)

12.2. Reliability
	•	Storage failures must throw clear errors.
	•	JSON store must gracefully handle missing/corrupted files.
	•	SQLite store must ensure schema is created on startup.
	•	Agent name uniqueness must be enforced at the storage layer.
	•	Attempting to create an agent with an existing name must fail with a clear error.

12.3. Extensibility

The project must be built so it’s easy to add:
	•	New MCP tools
	•	Additional storage backends
	•	Additional metadata fields for agents
	•	New business logic in AgentService without affecting API layers

12.4. Performance
	•	JSON store: optimized for small to medium datasets
	•	SQLite store: optimized for larger datasets and concurrent reads

⸻

13. Future Extensions (Non-required but anticipated)
	•	Agent health-checks
	•	A2A discovery mechanisms
	•	Authentication for REST API
	•	Web UI for browsing agents
	•	Webhooks on registry changes

⸻

14. Summary

The A2A Registry is a lightweight but extensible system for storing and serving A2A agent metadata, exposed both through an MCP interface and an HTTP REST API.

**Key architectural features:**
- **Service Layer Pattern**: AgentService encapsulates all business logic, eliminating code duplication between REST and MCP APIs
- **Intelligent Registration**: Provide only a URL, and the registry automatically fetches the standard AgentCard using intelligent routing
- **Concurrent Access**: Streamable HTTP transport for MCP allows multiple agents to access the registry simultaneously
- **Pluggable Storage**: Supports JSON file or SQLite backends, selectable at runtime

Agent registration is simplified: provide only a URL, and the registry automatically fetches the standard AgentCard from the agent's `.well-known/agent-card.json` endpoint (or directly from a `.json` URL). This ensures full compatibility with the official A2A protocol specification via the `@a2a-js/sdk` package.

The system is operational with a single command, using PM2 in production.