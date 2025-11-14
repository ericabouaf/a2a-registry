/**
 * AgentCard validation utilities
 */

import type { AgentCard } from '../types/index.js';
import { InvalidAgentCardError } from '../types/index.js';

/**
 * Validate that an object is a valid AgentCard
 * @param data - Object to validate
 * @throws InvalidAgentCardError if validation fails
 */
export function validateAgentCard(data: unknown): asserts data is AgentCard {
  if (!data || typeof data !== 'object') {
    throw new InvalidAgentCardError('AgentCard must be an object');
  }

  const card = data as Record<string, unknown>;

  // Required fields
  const requiredFields = [
    'name',
    'description',
    'url',
    'version',
    'capabilities',
    'defaultInputModes',
    'defaultOutputModes',
    'skills'
  ];

  for (const field of requiredFields) {
    if (!(field in card) || card[field] === undefined || card[field] === null) {
      throw new InvalidAgentCardError(`Missing required field: ${field}`);
    }
  }

  // Type checks
  if (typeof card.name !== 'string' || card.name.trim().length === 0) {
    throw new InvalidAgentCardError('name must be a non-empty string');
  }

  if (typeof card.description !== 'string') {
    throw new InvalidAgentCardError('description must be a string');
  }

  if (typeof card.url !== 'string' || !isValidUrl(card.url)) {
    throw new InvalidAgentCardError('url must be a valid URL string');
  }

  if (typeof card.version !== 'string') {
    throw new InvalidAgentCardError('version must be a string');
  }

  // Array validations
  if (!Array.isArray(card.capabilities)) {
    throw new InvalidAgentCardError('capabilities must be an array');
  }

  if (!Array.isArray(card.defaultInputModes)) {
    throw new InvalidAgentCardError('defaultInputModes must be an array');
  }

  if (!Array.isArray(card.defaultOutputModes)) {
    throw new InvalidAgentCardError('defaultOutputModes must be an array');
  }

  if (!Array.isArray(card.skills)) {
    throw new InvalidAgentCardError('skills must be an array');
  }

  // Optional fields validation
  if ('protocolVersion' in card && typeof card.protocolVersion !== 'string') {
    throw new InvalidAgentCardError('protocolVersion must be a string');
  }

  if ('preferredTransport' in card && typeof card.preferredTransport !== 'string') {
    throw new InvalidAgentCardError('preferredTransport must be a string');
  }

  if ('iconUrl' in card && card.iconUrl !== null && typeof card.iconUrl !== 'string') {
    throw new InvalidAgentCardError('iconUrl must be a string or null');
  }
}

/**
 * Check if a string is a valid URL
 */
function isValidUrl(urlString: string): boolean {
  try {
    new URL(urlString);
    return true;
  } catch {
    return false;
  }
}
