const DEFAULT_APP_URL = 'http://localhost:3000';

function normalizeUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

export function getRequiredEnv(name: keyof NodeJS.ProcessEnv): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} environment variable is not set`);
  }

  return value;
}

export function getAppBaseUrl(): string {
  const explicitBaseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL;

  if (explicitBaseUrl) {
    return normalizeUrl(explicitBaseUrl);
  }

  if (process.env.VERCEL_URL) {
    return normalizeUrl(`https://${process.env.VERCEL_URL}`);
  }

  return DEFAULT_APP_URL;
}

export function formatHealthCheckError(error: unknown): string {
  if (process.env.NODE_ENV === 'development' && error instanceof Error) {
    return error.message;
  }

  return 'Dependency check failed';
}
