import { and, eq, sql, type SQL } from 'drizzle-orm';
import { db } from '@/lib/db';
import { apiKeys } from '@/lib/db/schema';
import { Role, type AdminContext } from '@/lib/auth/rbac';

export function apiKeyAccessCondition(apiKeyId: string, adminContext: AdminContext): SQL {
  if (adminContext.role === Role.SUPER_ADMIN) {
    return eq(apiKeys.id, apiKeyId);
  }

  if (!adminContext.organizationId) {
    return sql`false`;
  }

  return and(
    eq(apiKeys.id, apiKeyId),
    eq(apiKeys.organizationId, adminContext.organizationId)
  )!;
}

export async function canAccessApiKey(
  apiKeyId: string,
  adminContext: AdminContext
): Promise<boolean> {
  const [apiKey] = await db
    .select({ id: apiKeys.id })
    .from(apiKeys)
    .where(apiKeyAccessCondition(apiKeyId, adminContext))
    .limit(1);

  return Boolean(apiKey);
}
