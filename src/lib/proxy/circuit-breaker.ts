/**
 * Circuit Breaker Pattern Implementation
 *
 * Prevents cascading failures by stopping requests to failing services.
 * Automatically recovers when service becomes healthy again.
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Service is down, requests are blocked
 * - HALF_OPEN: Testing if service has recovered
 */

import { kv } from '@vercel/kv';

// ============================================================================
// Types
// ============================================================================

export enum CircuitState {
  CLOSED = 'CLOSED',
  OPEN = 'OPEN',
  HALF_OPEN = 'HALF_OPEN',
}

export interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Milliseconds before trying half-open
  monitoringWindow: number; // Milliseconds to track failures
}

export interface CircuitBreakerStatus {
  providerId: string;
  providerName: string;
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number | null;
  lastSuccessTime: number | null;
  nextAttemptTime: number | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  config: CircuitBreakerConfig;
}

// ============================================================================
// Default Configuration
// ============================================================================

const DEFAULT_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open after 5 consecutive failures
  successThreshold: 2, // Close after 2 consecutive successes
  timeout: 60000, // Try half-open after 60 seconds
  monitoringWindow: 300000, // Monitor failures over 5 minutes
};

// ============================================================================
// Circuit Breaker State Management
// ============================================================================

/**
 * Get circuit breaker status for a provider
 */
export async function getCircuitBreakerStatus(
  providerId: string,
  providerName: string = 'Unknown'
): Promise<CircuitBreakerStatus> {
  const stateKey = `circuit_breaker:${providerId}:state`;
  const statsKey = `circuit_breaker:${providerId}:stats`;

  try {
    const [state, stats] = await Promise.all([
      kv.get<string>(stateKey),
      kv.hgetall(statsKey),
    ]);

    const currentState = (state as CircuitState) || CircuitState.CLOSED;

    return {
      providerId,
      providerName,
      state: currentState,
      failureCount: parseInt((stats?.failureCount as string) || '0'),
      successCount: parseInt((stats?.successCount as string) || '0'),
      lastFailureTime: stats?.lastFailureTime
        ? parseInt(stats.lastFailureTime as string)
        : null,
      lastSuccessTime: stats?.lastSuccessTime
        ? parseInt(stats.lastSuccessTime as string)
        : null,
      nextAttemptTime: stats?.nextAttemptTime
        ? parseInt(stats.nextAttemptTime as string)
        : null,
      totalRequests: parseInt((stats?.totalRequests as string) || '0'),
      totalFailures: parseInt((stats?.totalFailures as string) || '0'),
      totalSuccesses: parseInt((stats?.totalSuccesses as string) || '0'),
      config: DEFAULT_CONFIG,
    };
  } catch (error) {
    console.error('[CircuitBreaker] Error getting status:', error);
    return {
      providerId,
      providerName,
      state: CircuitState.CLOSED,
      failureCount: 0,
      successCount: 0,
      lastFailureTime: null,
      lastSuccessTime: null,
      nextAttemptTime: null,
      totalRequests: 0,
      totalFailures: 0,
      totalSuccesses: 0,
      config: DEFAULT_CONFIG,
    };
  }
}

/**
 * Check if circuit breaker allows the request
 */
export async function isCircuitBreakerOpen(providerId: string): Promise<boolean> {
  const stateKey = `circuit_breaker:${providerId}:state`;
  const statsKey = `circuit_breaker:${providerId}:stats`;

  try {
    const state = await kv.get<string>(stateKey);

    // If CLOSED, allow request
    if (!state || state === CircuitState.CLOSED) {
      return false;
    }

    // If OPEN, check if timeout has passed
    if (state === CircuitState.OPEN) {
      const stats = await kv.hgetall(statsKey);
      const nextAttemptTime = stats?.nextAttemptTime
        ? parseInt(stats.nextAttemptTime as string)
        : null;

      if (nextAttemptTime && Date.now() >= nextAttemptTime) {
        // Timeout passed, transition to HALF_OPEN
        await kv.set(stateKey, CircuitState.HALF_OPEN);
        await kv.hset(statsKey, {
          successCount: '0',
          failureCount: '0',
        });
        return false; // Allow request in HALF_OPEN
      }

      return true; // Still in timeout, block request
    }

    // If HALF_OPEN, allow request
    return false;
  } catch (error) {
    console.error('[CircuitBreaker] Error checking state:', error);
    return false; // Fail open (allow request on error)
  }
}

/**
 * Record a successful request
 */
export async function recordSuccess(providerId: string): Promise<void> {
  const stateKey = `circuit_breaker:${providerId}:state`;
  const statsKey = `circuit_breaker:${providerId}:stats`;

  try {
    const state = await kv.get<string>(stateKey);
    const now = Date.now();

    // Update stats
    await kv.hincrby(statsKey, 'successCount', 1);
    await kv.hincrby(statsKey, 'totalSuccesses', 1);
    await kv.hincrby(statsKey, 'totalRequests', 1);
    await kv.hset(statsKey, { lastSuccessTime: now.toString() });

    // Reset failure count on success
    await kv.hset(statsKey, { failureCount: '0' });

    // State transitions
    if (state === CircuitState.HALF_OPEN) {
      const stats = await kv.hgetall(statsKey);
      const successCount = parseInt((stats?.successCount as string) || '0');

      // If enough successes in HALF_OPEN, transition to CLOSED
      if (successCount >= DEFAULT_CONFIG.successThreshold) {
        await kv.set(stateKey, CircuitState.CLOSED);
        await kv.hset(statsKey, {
          successCount: '0',
          failureCount: '0',
          nextAttemptTime: '0',
        });
        console.log(`[CircuitBreaker] ${providerId} recovered: HALF_OPEN → CLOSED`);
      }
    }
  } catch (error) {
    console.error('[CircuitBreaker] Error recording success:', error);
  }
}

/**
 * Record a failed request
 */
export async function recordFailure(providerId: string): Promise<void> {
  const stateKey = `circuit_breaker:${providerId}:state`;
  const statsKey = `circuit_breaker:${providerId}:stats`;

  try {
    const state = await kv.get<string>(stateKey);
    const now = Date.now();

    // Update stats
    await kv.hincrby(statsKey, 'failureCount', 1);
    await kv.hincrby(statsKey, 'totalFailures', 1);
    await kv.hincrby(statsKey, 'totalRequests', 1);
    await kv.hset(statsKey, { lastFailureTime: now.toString() });

    // Reset success count on failure
    await kv.hset(statsKey, { successCount: '0' });

    const stats = await kv.hgetall(statsKey);
    const failureCount = parseInt((stats?.failureCount as string) || '0');

    // State transitions
    if (state === CircuitState.HALF_OPEN) {
      // Any failure in HALF_OPEN reopens the circuit
      await kv.set(stateKey, CircuitState.OPEN);
      const nextAttemptTime = now + DEFAULT_CONFIG.timeout;
      await kv.hset(statsKey, {
        nextAttemptTime: nextAttemptTime.toString(),
        failureCount: '0',
      });
      console.log(
        `[CircuitBreaker] ${providerId} failed recovery: HALF_OPEN → OPEN (retry at ${new Date(nextAttemptTime).toISOString()})`
      );
    } else if (state !== CircuitState.OPEN && failureCount >= DEFAULT_CONFIG.failureThreshold) {
      // Open circuit if failure threshold reached
      await kv.set(stateKey, CircuitState.OPEN);
      const nextAttemptTime = now + DEFAULT_CONFIG.timeout;
      await kv.hset(statsKey, {
        nextAttemptTime: nextAttemptTime.toString(),
      });
      console.log(
        `[CircuitBreaker] ${providerId} circuit opened: ${failureCount} failures (retry at ${new Date(nextAttemptTime).toISOString()})`
      );
    }
  } catch (error) {
    console.error('[CircuitBreaker] Error recording failure:', error);
  }
}

/**
 * Manually reset circuit breaker (force CLOSED state)
 */
export async function resetCircuitBreaker(providerId: string): Promise<void> {
  const stateKey = `circuit_breaker:${providerId}:state`;
  const statsKey = `circuit_breaker:${providerId}:stats`;

  try {
    await kv.set(stateKey, CircuitState.CLOSED);
    await kv.hset(statsKey, {
      successCount: '0',
      failureCount: '0',
      nextAttemptTime: '0',
    });
    console.log(`[CircuitBreaker] ${providerId} manually reset to CLOSED`);
  } catch (error) {
    console.error('[CircuitBreaker] Error resetting:', error);
    throw error;
  }
}

/**
 * Manually open circuit breaker (force OPEN state)
 */
export async function openCircuitBreaker(providerId: string): Promise<void> {
  const stateKey = `circuit_breaker:${providerId}:state`;
  const statsKey = `circuit_breaker:${providerId}:stats`;

  try {
    const now = Date.now();
    const nextAttemptTime = now + DEFAULT_CONFIG.timeout;

    await kv.set(stateKey, CircuitState.OPEN);
    await kv.hset(statsKey, {
      nextAttemptTime: nextAttemptTime.toString(),
    });
    console.log(`[CircuitBreaker] ${providerId} manually opened`);
  } catch (error) {
    console.error('[CircuitBreaker] Error opening:', error);
    throw error;
  }
}

/**
 * Get all circuit breaker statuses
 */
export async function getAllCircuitBreakerStatuses(
  providerIds: Array<{ id: string; name: string }>
): Promise<CircuitBreakerStatus[]> {
  const statuses = await Promise.all(
    providerIds.map(p => getCircuitBreakerStatus(p.id, p.name))
  );

  return statuses;
}

/**
 * Calculate circuit breaker health metrics
 */
export function calculateHealthMetrics(status: CircuitBreakerStatus): {
  successRate: number;
  failureRate: number;
  availability: number;
  healthScore: number;
} {
  const total = status.totalRequests || 1; // Avoid division by zero
  const successRate = (status.totalSuccesses / total) * 100;
  const failureRate = (status.totalFailures / total) * 100;

  // Availability: 100% if CLOSED, 0% if OPEN, 50% if HALF_OPEN
  let availability = 100;
  if (status.state === CircuitState.OPEN) {
    availability = 0;
  } else if (status.state === CircuitState.HALF_OPEN) {
    availability = 50;
  }

  // Health score: weighted average of success rate and availability
  const healthScore = (successRate * 0.7 + availability * 0.3);

  return {
    successRate,
    failureRate,
    availability,
    healthScore,
  };
}
