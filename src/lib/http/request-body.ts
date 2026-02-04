export async function readJsonBodyIfPresent(
  request: Request
): Promise<{ body: unknown; rawBodyText: string }> {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return { body: null, rawBodyText: '' };
  }

  const contentType = request.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    return { body: null, rawBodyText: '' };
  }

  const rawBodyText = await request.clone().text();
  if (!rawBodyText) {
    return { body: null, rawBodyText: '' };
  }

  return { body: JSON.parse(rawBodyText), rawBodyText };
}

