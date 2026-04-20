import { NextResponse } from 'next/server';

const PROXY_CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': [
    'Content-Type',
    'Authorization',
    'x-api-key',
    'x-totp-code',
    'x-hmac-signature',
    'x-hmac-timestamp',
    'anthropic-version',
    'anthropic-beta',
    'openai-beta',
  ].join(', '),
  'Access-Control-Max-Age': '86400',
};

export function createProxyOptionsResponse(): NextResponse {
  return new NextResponse(null, {
    status: 204,
    headers: PROXY_CORS_HEADERS,
  });
}
