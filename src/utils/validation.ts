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

  // capabilities should be an object (AgentCapabilities)
  if (typeof card.capabilities !== 'object' || card.capabilities === null || Array.isArray(card.capabilities)) {
    throw new InvalidAgentCardError('capabilities must be an object');
  }

  // Array validations
  if (!Array.isArray(card.defaultInputModes)) {
    throw new InvalidAgentCardError('defaultInputModes must be an array');
  }

  if (!Array.isArray(card.defaultOutputModes)) {
    throw new InvalidAgentCardError('defaultOutputModes must be an array');
  }

  if (!Array.isArray(card.skills)) {
    throw new InvalidAgentCardError('skills must be an array');
  }

  // Validate each skill in the array
  for (const skill of card.skills as unknown[]) {
    if (!skill || typeof skill !== 'object') {
      throw new InvalidAgentCardError('Each skill must be an object');
    }

    const skillObj = skill as Record<string, unknown>;

    // Required skill fields (only id, name, description, tags are required)
    const requiredSkillFields = ['id', 'name', 'description', 'tags'];
    for (const field of requiredSkillFields) {
      if (!(field in skillObj)) {
        throw new InvalidAgentCardError(`Skill is missing required field: ${field}`);
      }
    }

    // Type checks for required skill fields
    if (typeof skillObj.id !== 'string') {
      throw new InvalidAgentCardError('Skill id must be a string');
    }
    if (typeof skillObj.name !== 'string') {
      throw new InvalidAgentCardError('Skill name must be a string');
    }
    if (typeof skillObj.description !== 'string') {
      throw new InvalidAgentCardError('Skill description must be a string');
    }
    if (!Array.isArray(skillObj.tags)) {
      throw new InvalidAgentCardError('Skill tags must be an array');
    }

    // Type checks for optional skill fields (if present)
    if ('examples' in skillObj && !Array.isArray(skillObj.examples)) {
      throw new InvalidAgentCardError('Skill examples must be an array when provided');
    }
    if ('inputModes' in skillObj && !Array.isArray(skillObj.inputModes)) {
      throw new InvalidAgentCardError('Skill inputModes must be an array when provided');
    }
    if ('outputModes' in skillObj && !Array.isArray(skillObj.outputModes)) {
      throw new InvalidAgentCardError('Skill outputModes must be an array when provided');
    }
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
