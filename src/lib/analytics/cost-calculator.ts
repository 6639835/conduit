/**
 * Cost calculation for Claude, OpenAI, and Gemini API usage
 * Pricing dates vary by provider; update as needed
 * All prices in USD per 1M tokens
 */

export interface ModelPricing {
  inputPricePerMillion: number; // USD per 1M tokens
  outputPricePerMillion: number; // USD per 1M tokens
}

// Provider pricing tables (USD per 1M tokens).
// Notes:
// - OpenAI rates below use Standard tier text-token pricing for text models.
// - OpenAI image/audio models use the image/audio token pricing tables.
// - Gemini rates use standard text pricing unless noted; some models have higher rates for long prompts or audio.
// Sources: Anthropic pricing + model IDs, OpenAI API pricing, Gemini API pricing.
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Anthropic Claude 4.5 (pricing from models overview; input/output per MTok)
  'claude-sonnet-4-5-20250929': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-haiku-4-5-20251001': {
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 5.00,
  },
  'claude-opus-4-5-20251101': {
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 25.00,
  },
  // Claude 4.5 aliases
  'claude-sonnet-4-5': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-haiku-4-5': {
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 5.00,
  },
  'claude-opus-4-5': {
    inputPricePerMillion: 5.00,
    outputPricePerMillion: 25.00,
  },

  // Anthropic Claude 4.x / 3.x (pricing from Anthropic pricing table)
  'claude-opus-4-1-20250805': {
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
  },
  'claude-opus-4-1': {
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
  },
  'claude-opus-4-20250514': {
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
  },
  'claude-opus-4-0': {
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
  },
  'claude-sonnet-4-20250514': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-sonnet-4-0': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-7-sonnet-20250219': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-7-sonnet-latest': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-5-sonnet-20241022': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-5-sonnet-20240620': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-5-sonnet-latest': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-5-haiku-20241022': {
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
  },
  'claude-3-5-haiku-latest': {
    inputPricePerMillion: 0.80,
    outputPricePerMillion: 4.00,
  },
  'claude-3-opus-20240229': {
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
  },
  'claude-3-sonnet-20240229': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-haiku-20240307': {
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
  },

  // OpenAI text models (Standard tier text tokens)
  'gpt-5.2': { inputPricePerMillion: 1.75, outputPricePerMillion: 14.00 },
  'gpt-5.1': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5-mini': { inputPricePerMillion: 0.25, outputPricePerMillion: 2.00 },
  'gpt-5-nano': { inputPricePerMillion: 0.05, outputPricePerMillion: 0.40 },
  'gpt-5.2-chat-latest': { inputPricePerMillion: 1.75, outputPricePerMillion: 14.00 },
  'gpt-5.1-chat-latest': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5-chat-latest': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5.2-codex': { inputPricePerMillion: 1.75, outputPricePerMillion: 14.00 },
  'gpt-5.1-codex-max': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5.1-codex': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5-codex': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-5.2-pro': { inputPricePerMillion: 21.00, outputPricePerMillion: 168.00 },
  'gpt-5-pro': { inputPricePerMillion: 15.00, outputPricePerMillion: 120.00 },
  'gpt-4.1': { inputPricePerMillion: 2.00, outputPricePerMillion: 8.00 },
  'gpt-4.1-mini': { inputPricePerMillion: 0.40, outputPricePerMillion: 1.60 },
  'gpt-4.1-nano': { inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
  'gpt-4o': { inputPricePerMillion: 2.50, outputPricePerMillion: 10.00 },
  'gpt-4o-2024-05-13': { inputPricePerMillion: 5.00, outputPricePerMillion: 15.00 },
  'gpt-4o-mini': { inputPricePerMillion: 0.15, outputPricePerMillion: 0.60 },
  'o1': { inputPricePerMillion: 15.00, outputPricePerMillion: 60.00 },
  'o1-pro': { inputPricePerMillion: 150.00, outputPricePerMillion: 600.00 },
  'o3-pro': { inputPricePerMillion: 20.00, outputPricePerMillion: 80.00 },
  'o3': { inputPricePerMillion: 2.00, outputPricePerMillion: 8.00 },
  'o3-deep-research': { inputPricePerMillion: 10.00, outputPricePerMillion: 40.00 },
  'o4-mini': { inputPricePerMillion: 1.10, outputPricePerMillion: 4.40 },
  'o4-mini-deep-research': { inputPricePerMillion: 2.00, outputPricePerMillion: 8.00 },
  'o3-mini': { inputPricePerMillion: 1.10, outputPricePerMillion: 4.40 },
  'o1-mini': { inputPricePerMillion: 1.10, outputPricePerMillion: 4.40 },
  'gpt-5.1-codex-mini': { inputPricePerMillion: 0.25, outputPricePerMillion: 2.00 },
  'codex-mini-latest': { inputPricePerMillion: 1.50, outputPricePerMillion: 6.00 },
  'gpt-5-search-api': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gpt-4o-mini-search-preview': { inputPricePerMillion: 0.15, outputPricePerMillion: 0.60 },
  'gpt-4o-search-preview': { inputPricePerMillion: 2.50, outputPricePerMillion: 10.00 },
  'computer-use-preview': { inputPricePerMillion: 3.00, outputPricePerMillion: 12.00 },

  // OpenAI image token models (image tokens)
  'gpt-image-1.5': { inputPricePerMillion: 8.00, outputPricePerMillion: 32.00 },
  'chatgpt-image-latest': { inputPricePerMillion: 8.00, outputPricePerMillion: 32.00 },
  'gpt-image-1': { inputPricePerMillion: 10.00, outputPricePerMillion: 40.00 },
  'gpt-image-1-mini': { inputPricePerMillion: 2.50, outputPricePerMillion: 8.00 },

  // OpenAI audio token models (audio tokens)
  'gpt-realtime': { inputPricePerMillion: 32.00, outputPricePerMillion: 64.00 },
  'gpt-realtime-mini': { inputPricePerMillion: 10.00, outputPricePerMillion: 20.00 },
  'gpt-4o-realtime-preview': { inputPricePerMillion: 40.00, outputPricePerMillion: 80.00 },
  'gpt-4o-mini-realtime-preview': { inputPricePerMillion: 10.00, outputPricePerMillion: 20.00 },
  'gpt-audio': { inputPricePerMillion: 32.00, outputPricePerMillion: 64.00 },
  'gpt-audio-mini': { inputPricePerMillion: 10.00, outputPricePerMillion: 20.00 },
  'gpt-4o-audio-preview': { inputPricePerMillion: 40.00, outputPricePerMillion: 80.00 },
  'gpt-4o-mini-audio-preview': { inputPricePerMillion: 10.00, outputPricePerMillion: 20.00 },

  // Gemini text models (standard text pricing)
  'gemini-3-flash-preview': { inputPricePerMillion: 0.50, outputPricePerMillion: 3.00 },
  'gemini-2.5-pro': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },
  'gemini-2.5-flash': { inputPricePerMillion: 0.30, outputPricePerMillion: 2.50 },
  'gemini-2.5-flash-preview-09-2025': { inputPricePerMillion: 0.30, outputPricePerMillion: 2.50 },
  'gemini-2.5-flash-lite': { inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
  'gemini-2.5-flash-lite-preview-09-2025': { inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
  'gemini-2.0-flash': { inputPricePerMillion: 0.10, outputPricePerMillion: 0.40 },
  'gemini-2.0-flash-lite': { inputPricePerMillion: 0.075, outputPricePerMillion: 0.30 },
  'gemini-2.5-computer-use-preview-10-2025': { inputPricePerMillion: 1.25, outputPricePerMillion: 10.00 },

  // Gemini audio/image models (audio/image token pricing where provided)
  'gemini-2.5-flash-native-audio-preview-12-2025': { inputPricePerMillion: 3.00, outputPricePerMillion: 12.00 },
  'gemini-2.5-flash-preview-tts': { inputPricePerMillion: 0.50, outputPricePerMillion: 10.00 },
  'gemini-2.5-pro-preview-tts': { inputPricePerMillion: 1.00, outputPricePerMillion: 20.00 },
  'gemini-2.5-flash-image': { inputPricePerMillion: 0.30, outputPricePerMillion: 30.00 },

  // Default pricing (fallback for unknown models)
  default: {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
};

/**
 * Calculate cost in cents for a given usage
 * Returns cost in cents (integer)
 */
export function calculateCost(
  model: string,
  tokensInput: number,
  tokensOutput: number
): number {
  // Get pricing for model (fallback to default if not found)
  const pricing = MODEL_PRICING[model] || MODEL_PRICING.default;

  // Calculate cost in USD
  const inputCostUsd = (tokensInput / 1_000_000) * pricing.inputPricePerMillion;
  const outputCostUsd = (tokensOutput / 1_000_000) * pricing.outputPricePerMillion;
  const totalCostUsd = inputCostUsd + outputCostUsd;

  // Convert to cents and round
  return Math.round(totalCostUsd * 100);
}

/**
 * Format cost in cents to human-readable string
 */
export function formatCost(costCents: number): string {
  const dollars = costCents / 100;

  if (dollars < 0.01) {
    return '<$0.01';
  }

  return `$${dollars.toFixed(2)}`;
}

/**
 * Get pricing information for a model
 */
export function getModelPricing(model: string): ModelPricing {
  return MODEL_PRICING[model] || MODEL_PRICING.default;
}

/**
 * List all available models with pricing
 */
export function getAllModelPricing(): Record<string, ModelPricing> {
  return { ...MODEL_PRICING };
}

// Cost estimation variance constants
const COST_ESTIMATE_MIN_MULTIPLIER = 0.8; // -20% variance
const COST_ESTIMATE_MAX_MULTIPLIER = 1.2; // +20% variance

/**
 * Estimate cost for a given token count (before making request)
 * Uses ±20% variance on output tokens to provide a cost range
 */
export function estimateCost(
  model: string,
  estimatedInputTokens: number,
  estimatedOutputTokens: number
): {
  minCostCents: number;
  maxCostCents: number;
  formattedMin: string;
  formattedMax: string;
} {
  const minCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens * COST_ESTIMATE_MIN_MULTIPLIER);
  const maxCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens * COST_ESTIMATE_MAX_MULTIPLIER);

  return {
    minCostCents: minCost,
    maxCostCents: maxCost,
    formattedMin: formatCost(minCost),
    formattedMax: formatCost(maxCost),
  };
}
