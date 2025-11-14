# A2A Registry Architecture

## Overview

The A2A Registry is built following MCP (Model Context Protocol) best practices and implements a clean service-layer architecture that eliminates code duplication between the REST API and MCP server.

## Architecture Layers

```
┌─────────────────────────────────────────┐
│     REST API        │     MCP Server    │
│   (HTTP Routes)     │   (MCP Tools)     │
│   Thin Adapters                         │
├─────────────────────┴───────────────────┤
│          AgentService                   │
│  (Business Logic & Validation)          │
│  - URL Discovery                        │
│  - AgentCard Fetching                   │
│  - Validation                           │
│  - Error Handling                       │
├─────────────────────────────────────────┤
│          Store Interface                │
│     (Storage Abstraction)               │
│  - listAgents()                         │
│  - getAgent(name)                       │
│  - createAgent(agentCard)               │
│  - updateAgent(name, agentCard)         │
│  - deleteAgent(name)                    │
├─────────────────────────────────────────┤
│   JsonFileStore  │  SqliteStore         │
│   (Implementations)                     │
└─────────────────────────────────────────┘
```

## Key Design Principles

### 1. Service Layer Pattern

All business logic is centralized in `AgentService`:
- URL discovery and intelligent routing
- AgentCard fetching from remote URLs
- AgentCard validation
- Error handling and normalization

Both REST API and MCP server are **thin adapters** that:
1. Parse request parameters
2. Call appropriate AgentService methods
3. Transform results into response format
4. Handle errors appropriately

This ensures:
- **No code duplication** between APIs
- **Single source of truth** for business logic
- **Easy testing** through service layer
- **Consistent behavior** across all interfaces

### 2. Storage Abstraction

The `Store` interface provides a clean abstraction over persistence:
- Implementations are swappable at runtime
- Business logic is storage-agnostic
- Easy to add new backends (PostgreSQL, MongoDB, etc.)

Current implementations:
- **JsonFileStore**: Simple file-based storage for development
- **SqliteStore**: Database storage for production

### 3. Intelligent Agent Registration

The registry implements smart URL routing for AgentCard discovery:

```typescript
// If URL ends with .json, use directly
https://cdn.example.com/agent.json
  → Fetch: https://cdn.example.com/agent.json

// Otherwise, append /.well-known/agent.json
https://example.com
  → Fetch: https://example.com/.well-known/agent.json

https://example.com/my-agent
  → Fetch: https://example.com/my-agent/.well-known/agent.json
```

This follows A2A protocol conventions while supporting flexible deployments.

### 4. MCP Best Practices

Following MCP server development guidelines:

**Tool Design:**
- Tool names use snake_case with service prefix (`a2a_register_agent`)
- Comprehensive descriptions with examples and error guidance
- Proper tool annotations (readOnlyHint, destructiveHint, etc.)
- Input validation using Zod schemas

**Error Handling:**
- Errors returned within tool results (not protocol-level)
- Clear, actionable error messages
- Guidance on next steps

**Transport:**
- SSE (Server-Sent Events) transport for stateless operation
- Supports multiple concurrent clients
- No session management overhead

## Component Details

### AgentService

**Location:** `src/services/AgentService.ts`

**Responsibilities:**
- `registerAgent(url)` - Fetch and register new agent
- `listAgents()` - Return all agents
- `getAgent(name)` - Get single agent
- `updateAgent(name, url?)` - Re-fetch and update agent
- `deleteAgent(name)` - Remove agent
- `fetchAgentCard(url)` - Private: HTTP fetch with validation
- `determineAgentCardUrl(url)` - Private: Intelligent URL routing

**Key Features:**
- Axios-based HTTP client with timeouts
- Comprehensive error handling
- AgentCard validation
- Name uniqueness enforcement

### Store Implementations

**JsonFileStore** (`src/store/JsonFileStore.ts`):
- In-memory Map with disk persistence
- Lazy initialization
- Atomic writes (full file rewrite)
- Graceful handling of missing/corrupted files

**SqliteStore** (`src/store/SqliteStore.ts`):
- better-sqlite3 for synchronous operations
- Automatic schema creation
- Primary key on agent name
- UNIQUE constraint enforcement

### REST API

**Location:** `src/api/restApi.ts`

**Endpoints:**
- `GET /agents` → `agentService.listAgents()`
- `GET /agents/:name` → `agentService.getAgent(name)`
- `POST /agents` → `agentService.registerAgent(url)`
- `PUT /agents/:name` → `agentService.updateAgent(name, url?)`
- `DELETE /agents/:name` → `agentService.deleteAgent(name)`

**Status Codes:**
- 200: Success
- 201: Created
- 204: No content (successful delete)
- 400: Bad request (validation, fetch errors)
- 404: Not found
- 409: Conflict (duplicate name)
- 500: Internal server error

### MCP Server

**Location:** `src/mcp/mcpServer.ts`

**Tools:**
1. `a2a_register_agent` - Register new agent
2. `a2a_list_agents` - List all agents
3. `a2a_get_agent` - Get agent by name
4. `a2a_update_agent` - Update existing agent
5. `a2a_delete_agent` - Delete agent

**Transport:** SSE (Server-Sent Events)
- Endpoint: `/mcp`
- Stateless: New transport per connection
- Supports multiple concurrent clients

## Data Flow Examples

### Registering an Agent (REST)

```
1. Client: POST /agents {"url": "https://example.com"}
2. REST API: Parse request body
3. REST API: Call agentService.registerAgent(url)
4. AgentService: Determine AgentCard URL
5. AgentService: HTTP GET https://example.com/.well-known/agent.json
6. AgentService: Validate AgentCard structure
7. AgentService: Call store.createAgent(agentCard)
8. Store: Check uniqueness, persist data
9. Store: Return agentCard
10. AgentService: Return agentCard
11. REST API: Return 201 with agentCard JSON
```

### Registering an Agent (MCP)

```
1. Client: Call tool a2a_register_agent {"url": "https://example.com"}
2. MCP Server: Parse and validate parameters with Zod
3. MCP Server: Call agentService.registerAgent(url)
4. AgentService: [Same as above, steps 4-10]
5. MCP Server: Return success with agentCard
```

Notice that steps 4-10 are identical - the AgentService encapsulates all business logic.

## Error Handling Strategy

### Custom Error Types

- `AgentNotFoundError` - Agent doesn't exist
- `AgentAlreadyExistsError` - Duplicate name
- `InvalidAgentCardError` - Validation failure
- `AgentFetchError` - Network/HTTP errors

### Error Propagation

1. **Storage Layer**: Throws specific errors
2. **Service Layer**: Catches and wraps errors with context
3. **API Layer**: Translates to appropriate HTTP status or MCP error

Example:
```
Store throws AgentAlreadyExistsError
  ↓
AgentService propagates error
  ↓
REST API → 409 Conflict
MCP Tool → isError: true with message
```

## Testing Strategy

### Unit Testing

- Store implementations: Test CRUD operations
- AgentService: Mock store, test business logic
- Validation: Test edge cases

### Integration Testing

- Full stack: REST API + AgentService + Store
- MCP tools: Tool calls + AgentService + Store
- Real HTTP fetching with test servers

### Manual Testing

- Use `examples/test-api.sh` for REST API
- Use MCP Inspector for MCP tools
- Test with real AgentCard endpoints

## Extension Points

### Adding a New Storage Backend

1. Implement the `Store` interface
2. Add to store factory in `src/index.ts`
3. Add CLI option
4. Update documentation

Example for PostgreSQL:
```typescript
export class PostgresStore implements Store {
  // Implement all Store methods
}
```

### Adding New MCP Tools

1. Define Zod schema for input validation
2. Add tool definition in `ListToolsRequestSchema` handler
3. Add tool implementation in `CallToolRequestSchema` handler
4. Call AgentService methods (don't duplicate logic)

### Adding Business Logic

Add methods to `AgentService` - both APIs will automatically benefit.

## Production Deployment

### Using PM2

```bash
pm2 start ecosystem.config.cjs
```

Configuration in `ecosystem.config.cjs`:
- Single instance (agents table doesn't require clustering)
- 500MB memory limit
- Auto-restart on failure
- Log rotation

### Environment Considerations

- Use SQLite for production (better concurrent access)
- Mount data directory as persistent volume
- Configure appropriate port
- Set up log aggregation
- Monitor health endpoint

### Scaling Considerations

Current design:
- Single process per deployment
- SQLite provides good concurrent read performance
- Writes are serialized (acceptable for registry use case)

For high-write scenarios:
- Implement PostgresStore
- Use connection pooling
- Add caching layer (Redis)

## Security Considerations

1. **Input Validation**: Zod schemas validate all inputs
2. **URL Validation**: Validated before HTTP requests
3. **Error Messages**: Don't expose internal details
4. **Rate Limiting**: Should be added at reverse proxy level
5. **Authentication**: Not implemented (add middleware as needed)

## Maintenance

### Adding Dependencies

Update both `dependencies` and `devDependencies` in `package.json`.

Rebuild:
```bash
npm install
npm run build
```

### Database Migrations

SQLite schema is auto-created. For changes:
1. Update schema in `SqliteStore.initialize()`
2. Implement migration logic if needed
3. Test with existing data

### Monitoring

Health check: `GET /health`

Logs:
- stdout: Operational messages
- stderr: Error messages
- PM2: `pm2 logs a2a-registry`

## References

- [A2A Protocol Specification](https://a2a-protocol.org/latest/specification/)
- [MCP Protocol Documentation](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [A2A JavaScript SDK](https://github.com/a2a-protocol/a2a-js)
