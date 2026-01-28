/**
 * Intelligent Routing Engine
 * ML-based routing that optimizes for cost, quality, and performance
 */

import { analyzePrompt, recommendModel, type PromptAnalysis, type ModelRecommendation } from './prompt-analyzer';
import { db } from '@/lib/db';
import { providers, apiKeys, requestLogs } from '@/lib/db/schema';
import { eq, and, gte, sql } from 'drizzle-orm';

export interface RoutingPreferences {
  optimizeFor: 'cost' | 'quality' | 'speed' | 'balanced';
  maxCostPerRequest?: number;
  preferredProvider?: 'claude' | 'openai' | 'gemini';
  requireRegion?: string;
  allowFallback: boolean;
}

export interface RoutingDecision {
  providerId: string;
  providerName: string;
  model: string;
  reason: string;
  estimatedCost: number;
  confidence: number;
  analysis: PromptAnalysis;
  alternatives: Array<{
    providerId: string;
    providerName: string;
    model: string;
    reason: string;
  }>;
}

export interface ProviderPerformance {
  providerId: string;
  successRate: number;
  avgLatency: number;
  avgCost: number;
  requestCount: number;
  lastUsed: Date | null;
}

/**
 * Get historical performance metrics for providers
 */
export async function getProviderPerformance(
  hours: number = 24
): Promise<ProviderPerformance[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const performance = await db
    .select({
      providerId: requestLogs.providerId,
      totalRequests: sql<number>`count(*)::int`,
      successfulRequests: sql<number>`count(*) filter (where ${requestLogs.statusCode} < 400)::int`,
      avgLatency: sql<number>`avg(${requestLogs.latencyMs})::int`,
      avgCost: sql<number>`avg(${requestLogs.cost})::float`,
      lastUsed: sql<Date>`max(${requestLogs.createdAt})`,
    })
    .from(requestLogs)
    .where(gte(requestLogs.createdAt, since))
    .groupBy(requestLogs.providerId);

  return performance
    .filter((p) => p.providerId)
    .map(p => ({
    providerId: p.providerId as string,
    successRate: p.totalRequests > 0 ? p.successfulRequests / p.totalRequests : 0,
    avgLatency: p.avgLatency || 0,
    avgCost: p.avgCost || 0,
    requestCount: p.totalRequests,
    lastUsed: p.lastUsed,
  }));
}

/**
 * Calculate provider score based on preferences and performance
 */
function calculateProviderScore(
  provider: {
    id: string;
    name: string;
    type: string;
    region: string | null;
    isActive: boolean;
  },
  performance: ProviderPerformance | undefined,
  preferences: RoutingPreferences,
  modelRecommendation: ModelRecommendation
): number {
  let score = 100;

  // Check if provider matches recommended provider
  const providerType = provider.type.toLowerCase();
  if (!providerType.includes(modelRecommendation.provider)) {
    return 0; // Wrong provider type
  }

  // Region requirement
  if (preferences.requireRegion && provider.region !== preferences.requireRegion) {
    if (!preferences.allowFallback) return 0;
    score -= 30; // Penalty for wrong region
  }

  // Provider preference
  if (preferences.preferredProvider) {
    if (providerType.includes(preferences.preferredProvider)) {
      score += 20;
    } else if (!preferences.allowFallback) {
      return 0;
    }
  }

  // Performance-based scoring
  if (performance) {
    // Success rate (0-30 points)
    score += performance.successRate * 30;

    // Latency (0-20 points, inverse)
    const latencyScore = Math.max(0, 20 - (performance.avgLatency / 100));
    score += latencyScore;

    // Cost optimization (0-20 points, inverse)
    if (preferences.optimizeFor === 'cost' || preferences.optimizeFor === 'balanced') {
      const costScore = Math.max(0, 20 - (performance.avgCost * 100));
      score += costScore;
    }

    // Recency bonus
    if (performance.lastUsed) {
      const hoursSinceUse = (Date.now() - performance.lastUsed.getTime()) / (1000 * 60 * 60);
      if (hoursSinceUse < 1) score += 10;
      else if (hoursSinceUse < 24) score += 5;
    }
  }

  // Optimization preference adjustments
  switch (preferences.optimizeFor) {
    case 'cost':
      // Already factored in cost above
      break;
    case 'quality':
      // Prefer providers with higher success rates
      if (performance && performance.successRate > 0.95) score += 20;
      break;
    case 'speed':
      // Prefer providers with lower latency
      if (performance && performance.avgLatency < 500) score += 20;
      break;
    case 'balanced':
      // Already balanced in default scoring
      break;
  }

  return Math.max(0, score);
}

/**
 * Select optimal provider using intelligent routing
 */
export async function selectProvider(
  prompt: string,
  systemPrompt: string | undefined,
  preferences: RoutingPreferences,
  apiKeyId?: string
): Promise<RoutingDecision> {
  // Step 1: Analyze prompt complexity
  const analysis = analyzePrompt(prompt, systemPrompt);

  // Step 2: Get model recommendation
  const modelRec = recommendModel(
    analysis,
    preferences.preferredProvider,
    preferences.maxCostPerRequest
  );

  // Step 3: Get available providers
  const providerConditions = [eq(providers.isActive, true)];

  // Filter by API key's allowed providers if specified
  if (apiKeyId) {
    const [key] = await db
      .select({ providerId: apiKeys.providerId })
      .from(apiKeys)
      .where(eq(apiKeys.id, apiKeyId))
      .limit(1);

    if (key) {
      providerConditions.push(eq(providers.id, key.providerId));
    }
  }

  const availableProviders = await db
    .select({
      id: providers.id,
      name: providers.name,
      type: providers.type,
      model: providers.model,
      region: providers.region,
      isActive: providers.isActive,
    })
    .from(providers)
    .where(and(...providerConditions));

  if (availableProviders.length === 0) {
    throw new Error('No active providers available');
  }

  // Step 4: Get provider performance metrics
  const performanceMetrics = await getProviderPerformance(24);
  const performanceMap = new Map(
    performanceMetrics.map(p => [p.providerId, p])
  );

  // Step 5: Score and rank providers
  const scoredProviders = availableProviders
    .map(provider => ({
      provider,
      performance: performanceMap.get(provider.id),
      score: calculateProviderScore(
        provider,
        performanceMap.get(provider.id),
        preferences,
        modelRec
      ),
    }))
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scoredProviders.length === 0) {
    throw new Error('No suitable provider found matching criteria');
  }

  // Step 6: Select best provider
  const best = scoredProviders[0];
  const alternatives = scoredProviders.slice(1, 4);

  // Generate routing reason
  let reason = `Selected based on ${preferences.optimizeFor} optimization. `;
  reason += `Prompt complexity: ${analysis.complexity}. `;
  if (best.performance) {
    reason += `Success rate: ${(best.performance.successRate * 100).toFixed(1)}%, `;
    reason += `Avg latency: ${best.performance.avgLatency}ms.`;
  }

  return {
    providerId: best.provider.id,
    providerName: best.provider.name,
    model: best.provider.model || modelRec.modelName,
    reason,
    estimatedCost: modelRec.estimatedCost,
    confidence: analysis.confidenceScore * (best.score / 100),
    analysis,
    alternatives: alternatives.map(alt => ({
      providerId: alt.provider.id,
      providerName: alt.provider.name,
      model: alt.provider.model || modelRec.modelName,
      reason: `Score: ${alt.score.toFixed(0)}/100`,
    })),
  };
}

/**
 * Generate routing recommendations for existing API keys
 */
export async function generateRoutingRecommendations(
  apiKeyId: string,
  days: number = 30
): Promise<{
  currentProvider: string;
  recommendedProvider: string;
  potentialSavings: number;
  reason: string;
}[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  // Get recent requests for this API key
  const recentRequests = await db
    .select({
      id: requestLogs.id,
      providerId: requestLogs.providerId,
      model: requestLogs.model,
      promptTokens: requestLogs.promptTokens,
      completionTokens: requestLogs.completionTokens,
      cost: requestLogs.cost,
      createdAt: requestLogs.createdAt,
    })
    .from(requestLogs)
    .where(
      and(
        eq(requestLogs.apiKeyId, apiKeyId),
        gte(requestLogs.createdAt, since)
      )
    )
    .limit(1000);

  if (recentRequests.length === 0) {
    return [];
  }

  // Analyze request patterns
  const providerUsage = new Map<string, { count: number; totalCost: number }>();

  for (const request of recentRequests) {
    if (!request.providerId) {
      continue;
    }
    const existing = providerUsage.get(request.providerId) || { count: 0, totalCost: 0 };
    existing.count++;
    existing.totalCost += parseFloat(request.cost?.toString() || '0');
    providerUsage.set(request.providerId, existing);
  }

  // Generate recommendations
  const recommendations = [];

  for (const [providerId, usage] of providerUsage) {
    const avgCost = usage.totalCost / usage.count;

    // Find cheaper alternatives
    // Simple recommendation: if using expensive model, suggest cheaper alternative
    const [currentProvider] = await db
      .select({ name: providers.name, model: providers.model })
      .from(providers)
      .where(eq(providers.id, providerId))
      .limit(1);

    if (!currentProvider) continue;

    // Check if a cheaper model would work (simple heuristic)
    const currentModel = currentProvider.model?.toLowerCase() || '';
    let recommendedModel = '';
    let potentialSavings = 0;

    if (currentModel.includes('opus') || currentModel.includes('gpt-4')) {
      recommendedModel = 'claude-sonnet-4 or gpt-4o-mini';
      potentialSavings = avgCost * 0.7; // ~70% savings
    } else if (currentModel.includes('sonnet')) {
      recommendedModel = 'claude-haiku-4 or gpt-4o-mini';
      potentialSavings = avgCost * 0.85; // ~85% savings
    }

    if (potentialSavings > 0) {
      recommendations.push({
        currentProvider: currentProvider.name,
        recommendedProvider: recommendedModel,
        potentialSavings: potentialSavings * usage.count,
        reason: `Analyzing ${usage.count} requests over ${days} days, switching to ${recommendedModel} could save ~$${potentialSavings.toFixed(4)} per request`,
      });
    }
  }

  return recommendations;
}

/**
 * Auto-routing configuration stored in API key metadata
 */
export interface AutoRoutingConfig {
  enabled: boolean;
  preferences: RoutingPreferences;
  learningEnabled: boolean;
  overrideModel?: string;
}

/**
 * Get auto-routing config for an API key
 */
export async function getAutoRoutingConfig(apiKeyId: string): Promise<AutoRoutingConfig | null> {
  const [key] = await db
    .select({ metadata: apiKeys.metadata })
    .from(apiKeys)
    .where(eq(apiKeys.id, apiKeyId))
    .limit(1);

  if (!key || !key.metadata) return null;

  const metadata = key.metadata as { autoRouting?: AutoRoutingConfig };
  return metadata.autoRouting || null;
}

/**
 * Update auto-routing config for an API key
 */
export async function updateAutoRoutingConfig(
  apiKeyId: string,
  config: AutoRoutingConfig
): Promise<void> {
  const [key] = await db
    .select({ metadata: apiKeys.metadata })
    .from(apiKeys)
    .where(eq(apiKeys.id, apiKeyId))
    .limit(1);

  const metadata = (key?.metadata as Record<string, unknown> | null) || {};
  metadata.autoRouting = config;

  await db
    .update(apiKeys)
    .set({ metadata, updatedAt: new Date() })
    .where(eq(apiKeys.id, apiKeyId));
}
