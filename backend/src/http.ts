export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const json = (value: unknown, status = 200) =>
  Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
export async function body<T>(request: Request): Promise<T> {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new HttpError(415, 'JSON required');
  try {
    return (await request.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON');
  }
}
export function method(request: Request, expected: string) {
  if (request.method !== expected) throw new HttpError(405, 'Method not allowed');
}
