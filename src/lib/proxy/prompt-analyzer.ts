/**
 * Prompt Complexity Analysis
 * Analyzes incoming prompts to determine complexity metrics for intelligent routing
 */

export interface PromptAnalysis {
  complexity: 'low' | 'medium' | 'high' | 'very_high';
  tokenEstimate: number;
  hasCode: boolean;
  hasMultipleLanguages: boolean;
  hasStructuredData: boolean;
  instructionCount: number;
  requiresReasoning: boolean;
  contextLength: number;
  recommendedModel: 'fast' | 'balanced' | 'powerful';
  confidenceScore: number;
}

export interface ModelCapability {
  name: string;
  maxTokens: number;
  strengthAreas: string[];
  costPerMToken: number;
  speed: 'fast' | 'medium' | 'slow';
}

/**
 * Estimate token count for a given text
 * Rough approximation: ~4 characters per token
 */
export function estimateTokenCount(text: string): number {
  // More accurate estimation considering:
  // - Average English: ~4 chars/token
  // - Code: ~3 chars/token (more dense)
  // - Structured data: ~5 chars/token (more whitespace)

  const codeBlockMatches = text.match(/```[\s\S]*?```/g) || [];
  const codeLength = codeBlockMatches.reduce((sum, block) => sum + block.length, 0);
  const textLength = text.length - codeLength;

  const codeTokens = Math.ceil(codeLength / 3);
  const textTokens = Math.ceil(textLength / 4);

  return codeTokens + textTokens;
}

/**
 * Detect if prompt contains code
 */
export function hasCodeContent(text: string): boolean {
  // Check for code blocks
  if (text.includes('```')) return true;

  // Check for common programming patterns
  const codePatterns = [
    /function\s+\w+\s*\(/,
    /const\s+\w+\s*=/,
    /class\s+\w+/,
    /import\s+.*from/,
    /def\s+\w+\s*\(/,
    /public\s+class/,
    /<\w+>.*<\/\w+>/,
    /\{\s*"\w+"\s*:/,
  ];

  return codePatterns.some(pattern => pattern.test(text));
}

/**
 * Detect multiple programming languages
 */
export function hasMultipleLanguages(text: string): boolean {
  const languageMarkers = {
    javascript: [/function\s+\w+/, /const\s+\w+/, /=>/],
    python: [/def\s+\w+/, /import\s+\w+/, /if\s+__name__/],
    java: [/public\s+class/, /private\s+\w+/, /System\.out/],
    go: [/func\s+\w+/, /package\s+\w+/, /defer\s+/],
    rust: [/fn\s+\w+/, /let\s+mut/, /impl\s+\w+/],
    sql: [/SELECT\s+.*FROM/, /INSERT\s+INTO/, /CREATE\s+TABLE/i],
  };

  const detectedLanguages = Object.entries(languageMarkers)
    .filter(([_, patterns]) => patterns.some(pattern => pattern.test(text)))
    .map(([lang]) => lang);

  return detectedLanguages.length > 1;
}

/**
 * Detect structured data (JSON, XML, CSV)
 */
export function hasStructuredData(text: string): boolean {
  // JSON detection
  if (/\{\s*"[^"]+"\s*:/.test(text)) return true;
  if (/\[\s*\{/.test(text)) return true;

  // XML detection
  if (/<\?xml/.test(text)) return true;
  if (/<\w+>.*<\/\w+>/.test(text)) return true;

  // CSV detection (simple heuristic)
  const lines = text.split('\n');
  if (lines.length > 2) {
    const commasInFirstLine = (lines[0].match(/,/g) || []).length;
    if (commasInFirstLine > 2) {
      const commasInSecondLine = (lines[1].match(/,/g) || []).length;
      if (commasInFirstLine === commasInSecondLine) return true;
    }
  }

  return false;
}

/**
 * Count explicit instructions in prompt
 */
export function countInstructions(text: string): number {
  const instructionPatterns = [
    /^\d+\./m,  // Numbered lists
    /^-\s+/m,   // Bullet points
    /^•\s+/m,   // Bullet points (unicode)
    /\bstep\s+\d+/i,
    /\bfirst,?\s+/i,
    /\bsecond,?\s+/i,
    /\bthen\b/i,
    /\bnext,?\s+/i,
    /\bfinally,?\s+/i,
  ];

  let count = 0;
  for (const pattern of instructionPatterns) {
    const matches = text.match(new RegExp(pattern, 'gm'));
    if (matches) count += matches.length;
  }

  // Also count imperative verbs at start of sentences
  const sentences = text.split(/[.!?]+/);
  const imperativeVerbs = [
    'write', 'create', 'generate', 'build', 'implement', 'design',
    'explain', 'describe', 'analyze', 'compare', 'evaluate', 'summarize',
    'calculate', 'solve', 'find', 'determine', 'identify', 'list',
  ];

  for (const sentence of sentences) {
    const trimmed = sentence.trim().toLowerCase();
    if (imperativeVerbs.some(verb => trimmed.startsWith(verb))) {
      count++;
    }
  }

  return count;
}

/**
 * Detect if prompt requires complex reasoning
 */
export function requiresReasoning(text: string): boolean {
  const reasoningKeywords = [
    /\bwhy\b/i,
    /\bhow\s+would\b/i,
    /\bexplain\b/i,
    /\bcompare\b/i,
    /\banalyze\b/i,
    /\bevaluate\b/i,
    /\bwhat\s+if\b/i,
    /\bconsider\b/i,
    /\bthink\s+about\b/i,
    /\breason\b/i,
    /\blogic\b/i,
    /\bderive\b/i,
    /\bprove\b/i,
    /\bjustify\b/i,
  ];

  return reasoningKeywords.some(pattern => pattern.test(text));
}

/**
 * Analyze prompt complexity
 */
export function analyzePrompt(prompt: string, systemPrompt?: string): PromptAnalysis {
  const fullText = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const tokenEstimate = estimateTokenCount(fullText);
  const hasCode = hasCodeContent(fullText);
  const hasMultiLang = hasMultipleLanguages(fullText);
  const hasStructured = hasStructuredData(fullText);
  const instructionCount = countInstructions(fullText);
  const needsReasoning = requiresReasoning(fullText);
  const contextLength = fullText.length;

  // Calculate complexity score
  let complexityScore = 0;

  // Token count contributes to complexity
  if (tokenEstimate > 10000) complexityScore += 3;
  else if (tokenEstimate > 5000) complexityScore += 2;
  else if (tokenEstimate > 1000) complexityScore += 1;

  // Code and data increase complexity
  if (hasCode) complexityScore += 1;
  if (hasMultiLang) complexityScore += 2;
  if (hasStructured) complexityScore += 1;

  // Multiple instructions increase complexity
  if (instructionCount > 10) complexityScore += 2;
  else if (instructionCount > 5) complexityScore += 1;

  // Reasoning requirements
  if (needsReasoning) complexityScore += 2;

  // Determine complexity level
  let complexity: PromptAnalysis['complexity'];
  if (complexityScore <= 2) complexity = 'low';
  else if (complexityScore <= 5) complexity = 'medium';
  else if (complexityScore <= 8) complexity = 'high';
  else complexity = 'very_high';

  // Recommend model tier
  let recommendedModel: PromptAnalysis['recommendedModel'];
  if (complexity === 'low' && !needsReasoning) {
    recommendedModel = 'fast';
  } else if (complexity === 'very_high' || (needsReasoning && hasMultiLang)) {
    recommendedModel = 'powerful';
  } else {
    recommendedModel = 'balanced';
  }

  // Calculate confidence (0-1)
  const confidenceScore = Math.min(1, 0.5 + (instructionCount * 0.05) + (hasCode ? 0.2 : 0) + (needsReasoning ? 0.15 : 0));

  return {
    complexity,
    tokenEstimate,
    hasCode,
    hasMultipleLanguages: hasMultiLang,
    hasStructuredData: hasStructured,
    instructionCount,
    requiresReasoning: needsReasoning,
    contextLength,
    recommendedModel,
    confidenceScore,
  };
}

/**
 * Model capability database
 */
export const MODEL_CAPABILITIES: Record<string, ModelCapability> = {
  // Claude models
  'claude-opus-4': {
    name: 'Claude Opus 4',
    maxTokens: 200000,
    strengthAreas: ['reasoning', 'code', 'analysis', 'multi-step'],
    costPerMToken: 15.0,
    speed: 'slow',
  },
  'claude-sonnet-4': {
    name: 'Claude Sonnet 4',
    maxTokens: 200000,
    strengthAreas: ['balanced', 'code', 'general'],
    costPerMToken: 3.0,
    speed: 'medium',
  },
  'claude-haiku-4': {
    name: 'Claude Haiku 4',
    maxTokens: 200000,
    strengthAreas: ['fast', 'simple', 'extraction'],
    costPerMToken: 0.25,
    speed: 'fast',
  },

  // OpenAI models
  'gpt-4o': {
    name: 'GPT-4o',
    maxTokens: 128000,
    strengthAreas: ['reasoning', 'multimodal', 'analysis'],
    costPerMToken: 5.0,
    speed: 'medium',
  },
  'gpt-4o-mini': {
    name: 'GPT-4o Mini',
    maxTokens: 128000,
    strengthAreas: ['fast', 'general', 'affordable'],
    costPerMToken: 0.15,
    speed: 'fast',
  },

  // Gemini models
  'gemini-2.0-flash-exp': {
    name: 'Gemini 2.0 Flash',
    maxTokens: 1000000,
    strengthAreas: ['long-context', 'fast', 'multimodal'],
    costPerMToken: 0.10,
    speed: 'fast',
  },
  'gemini-1.5-pro': {
    name: 'Gemini 1.5 Pro',
    maxTokens: 2000000,
    strengthAreas: ['long-context', 'reasoning', 'multimodal'],
    costPerMToken: 1.25,
    speed: 'medium',
  },
};

/**
 * Get cost-optimized model recommendation
 */
export interface ModelRecommendation {
  modelName: string;
  provider: 'claude' | 'openai' | 'gemini';
  reason: string;
  estimatedCost: number;
  alternativeModels: Array<{
    modelName: string;
    provider: string;
    reason: string;
    estimatedCost: number;
  }>;
}

export function recommendModel(
  analysis: PromptAnalysis,
  preferredProvider?: string,
  maxCostPerRequest?: number
): ModelRecommendation {
  const { complexity, tokenEstimate, recommendedModel, requiresReasoning } = analysis;

  // Get suitable models
  const suitableModels = Object.entries(MODEL_CAPABILITIES)
    .filter(([_, capability]) => {
      // Check token limit
      if (tokenEstimate > capability.maxTokens) return false;

      // Check cost limit
      if (maxCostPerRequest) {
        const estimatedCost = (tokenEstimate / 1000000) * capability.costPerMToken;
        if (estimatedCost > maxCostPerRequest) return false;
      }

      return true;
    })
    .map(([modelName, capability]) => ({
      modelName,
      ...capability,
      estimatedCost: (tokenEstimate / 1000000) * capability.costPerMToken,
    }));

  // Sort by cost (ascending)
  suitableModels.sort((a, b) => a.estimatedCost - b.estimatedCost);

  // Filter by recommended tier
  let recommendedModels = suitableModels;
  if (recommendedModel === 'fast') {
    recommendedModels = suitableModels.filter(m => m.speed === 'fast');
  } else if (recommendedModel === 'powerful') {
    recommendedModels = suitableModels.filter(m => m.speed !== 'fast');
  }

  // Apply provider preference
  if (preferredProvider) {
    const preferredModels = recommendedModels.filter(m =>
      m.modelName.toLowerCase().includes(preferredProvider.toLowerCase())
    );
    if (preferredModels.length > 0) {
      recommendedModels = preferredModels;
    }
  }

  // Pick the best model
  const bestModel = recommendedModels[0] || suitableModels[0];

  if (!bestModel) {
    throw new Error('No suitable model found for this request');
  }

  // Generate reason
  let reason = `Best for ${complexity} complexity tasks`;
  if (requiresReasoning) reason += ' with reasoning';
  if (analysis.hasCode) reason += ' and code';
  reason += `. Estimated cost: $${bestModel.estimatedCost.toFixed(4)}`;

  // Get alternatives
  const alternatives = suitableModels
    .filter(m => m.modelName !== bestModel.modelName)
    .slice(0, 3)
    .map(m => {
      let altReason = m.speed === 'fast' ? 'Faster and cheaper' : 'More powerful';
      if (m.strengthAreas.includes('long-context')) altReason += ', supports longer context';

      return {
        modelName: m.modelName,
        provider: m.modelName.startsWith('claude') ? 'claude' :
                  m.modelName.startsWith('gpt') ? 'openai' : 'gemini',
        reason: altReason,
        estimatedCost: m.estimatedCost,
      };
    });

  return {
    modelName: bestModel.modelName,
    provider: bestModel.modelName.startsWith('claude') ? 'claude' :
              bestModel.modelName.startsWith('gpt') ? 'openai' : 'gemini',
    reason,
    estimatedCost: bestModel.estimatedCost,
    alternativeModels: alternatives,
  };
}
