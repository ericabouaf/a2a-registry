/**
 * REST API for agent CRUD operations
 * Thin adapter layer that calls AgentService methods
 */

import express, { Request, Response, Router } from 'express';
import type { AgentService } from '../services/AgentService.js';
import {
  AgentFetchError,
  InvalidAgentCardError,
  AgentAlreadyExistsError
} from '../types/index.js';

/**
 * Create Express router for REST API endpoints
 */
export function createRestApi(agentService: AgentService): Router {
  const router = Router();

  // Middleware to parse JSON
  router.use(express.json());

  /**
   * GET /agents
   * List all agents
   */
  router.get('/agents', async (req: Request, res: Response) => {
    try {
      const agents = await agentService.listAgents();
      res.json(agents);
    } catch (error) {
      console.error('Error listing agents:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * GET /agents/:name
   * Get a single agent by name
   */
  router.get('/agents/:name', async (req: Request, res: Response) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const agent = await agentService.getAgent(name);

      if (!agent) {
        res.status(404).json({
          error: 'Not found',
          message: `Agent '${name}' not found`
        });
        return;
      }

      res.json(agent);
    } catch (error) {
      console.error('Error getting agent:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  /**
   * POST /agents
   * Register a new agent
   * Body: { "url": "https://agent-url.com" }
   */
  router.post('/agents', async (req: Request, res: Response) => {
    try {
      const { url } = req.body;

      if (!url || typeof url !== 'string') {
        res.status(400).json({
          error: 'Bad request',
          message: 'Request body must include a "url" field'
        });
        return;
      }

      const agentCard = await agentService.registerAgent(url);
      res.status(201).json(agentCard);
    } catch (error) {
      if (error instanceof AgentAlreadyExistsError) {
        res.status(409).json({
          error: 'Conflict',
          message: error.message
        });
      } else if (error instanceof AgentFetchError || error instanceof InvalidAgentCardError) {
        res.status(400).json({
          error: 'Bad request',
          message: error.message
        });
      } else {
        console.error('Error registering agent:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  /**
   * PUT /agents/:name
   * Update an existing agent by re-fetching its AgentCard
   * Body (optional): { "url": "https://new-url.com" }
   */
  router.put('/agents/:name', async (req: Request, res: Response) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const { url } = req.body || {};

      // Validate URL if provided
      if (url !== undefined && typeof url !== 'string') {
        res.status(400).json({
          error: 'Bad request',
          message: 'If provided, "url" must be a string'
        });
        return;
      }

      const agentCard = await agentService.updateAgent(name, url);

      if (!agentCard) {
        res.status(404).json({
          error: 'Not found',
          message: `Agent '${name}' not found`
        });
        return;
      }

      res.json(agentCard);
    } catch (error) {
      if (error instanceof AgentFetchError || error instanceof InvalidAgentCardError) {
        res.status(400).json({
          error: 'Bad request',
          message: error.message
        });
      } else {
        console.error('Error updating agent:', error);
        res.status(500).json({
          error: 'Internal server error',
          message: error instanceof Error ? error.message : String(error)
        });
      }
    }
  });

  /**
   * DELETE /agents/:name
   * Delete an agent by name
   */
  router.delete('/agents/:name', async (req: Request, res: Response) => {
    try {
      const name = decodeURIComponent(req.params.name);
      const deleted = await agentService.deleteAgent(name);

      if (!deleted) {
        res.status(404).json({
          error: 'Not found',
          message: `Agent '${name}' not found`
        });
        return;
      }

      res.status(204).send();
    } catch (error) {
      console.error('Error deleting agent:', error);
      res.status(500).json({
        error: 'Internal server error',
        message: error instanceof Error ? error.message : String(error)
      });
    }
  });

  return router;
}
