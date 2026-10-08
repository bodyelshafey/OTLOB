// The backend's HttpExceptionFilter wraps `exception.getResponse()` under a
// `message` key. For a plain HttpException constructed with a string, that's
// fine — `message` is a string. But for NestJS's own ValidationPipe errors
// (and anything else constructed with an object/array), `getResponse()`
// itself returns `{ statusCode, message, error }` — so the outer `message`
// ends up being that whole object, not a string. Rendering it directly as a
// React child crashes with "Objects are not valid as a React child".
//
// This unwraps whichever shape actually comes back and always returns a
// plain string, so it's always safe to render.
export function getErrorMessage(err: unknown, fallback: string): string {
  const data = (err as any)?.response?.data;
  let msg: unknown = data?.message ?? data;

  // One extra level of nesting from the ValidationPipe case described above.
  if (msg && typeof msg === 'object' && !Array.isArray(msg) && 'message' in (msg as any)) {
    msg = (msg as any).message;
  }

  if (Array.isArray(msg)) return msg.filter((m) => typeof m === 'string').join('، ') || fallback;
  if (typeof msg === 'string' && msg.trim()) return msg;
  return fallback;
}
