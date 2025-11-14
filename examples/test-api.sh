#!/bin/bash
# Test script for A2A Registry REST API
# Make sure the server is running before executing this script

BASE_URL="http://localhost:3000"

echo "=== Testing A2A Registry REST API ==="
echo

# Test health endpoint
echo "1. Testing health endpoint..."
curl -s "$BASE_URL/health" | jq '.'
echo
echo

# Test root endpoint
echo "2. Testing root endpoint..."
curl -s "$BASE_URL/" | jq '.'
echo
echo

# Test listing agents (should be empty initially)
echo "3. Listing agents (should be empty)..."
curl -s "$BASE_URL/agents" | jq '.'
echo
echo

# Note: To test registration, you would need a real AgentCard endpoint
# Example (replace with actual URL):
# echo "4. Registering an agent..."
# curl -s -X POST "$BASE_URL/agents" \
#   -H "Content-Type: application/json" \
#   -d '{"url": "https://your-agent.com"}' | jq '.'

echo "=== Manual Test Examples ==="
echo
echo "To register an agent:"
echo "curl -X POST $BASE_URL/agents -H 'Content-Type: application/json' -d '{\"url\": \"https://your-agent-url.com\"}'"
echo
echo "To get an agent by name:"
echo "curl $BASE_URL/agents/YourAgentName"
echo
echo "To update an agent:"
echo "curl -X PUT $BASE_URL/agents/YourAgentName -H 'Content-Type: application/json' -d '{\"url\": \"https://new-url.com\"}'"
echo
echo "To delete an agent:"
echo "curl -X DELETE $BASE_URL/agents/YourAgentName"
echo
