/**
 * Cost calculation for Claude API usage
 * Pricing as of January 2025 (update as needed)
 * All prices in USD cents per token
 */

export interface ModelPricing {
  inputPricePerMillion: number; // USD per 1M tokens
  outputPricePerMillion: number; // USD per 1M tokens
}

// Claude model pricing (as of January 2025)
// Source: https://www.anthropic.com/pricing
const MODEL_PRICING: Record<string, ModelPricing> = {
  // Claude 3.5 Sonnet
  'claude-3-5-sonnet-20241022': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },
  'claude-3-5-sonnet-20240620': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },

  // Claude 3.5 Haiku
  'claude-3-5-haiku-20241022': {
    inputPricePerMillion: 1.00,
    outputPricePerMillion: 5.00,
  },

  // Claude 3 Opus
  'claude-3-opus-20240229': {
    inputPricePerMillion: 15.00,
    outputPricePerMillion: 75.00,
  },

  // Claude 3 Sonnet
  'claude-3-sonnet-20240229': {
    inputPricePerMillion: 3.00,
    outputPricePerMillion: 15.00,
  },

  // Claude 3 Haiku
  'claude-3-haiku-20240307': {
    inputPricePerMillion: 0.25,
    outputPricePerMillion: 1.25,
  },

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

/**
 * Estimate cost for a given token count (before making request)
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
  const minCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens * 0.8);
  const maxCost = calculateCost(model, estimatedInputTokens, estimatedOutputTokens * 1.2);

  return {
    minCostCents: minCost,
    maxCostCents: maxCost,
    formattedMin: formatCost(minCost),
    formattedMax: formatCost(maxCost),
  };
}
