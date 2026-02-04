export function shouldTrustProxyHeaders(): boolean {
  if (process.env.TRUST_PROXY === 'true') return true;
  if (process.env.TRUST_PROXY === 'false') return false;

  // Default: trust on Vercel, require explicit opt-in elsewhere.
  return process.env.VERCEL === '1';
}

