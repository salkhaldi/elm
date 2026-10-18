/** Bound actual streamed bytes, not just the optional Content-Length header. */
export async function readJakBody(request: Request, maxBytes: number): Promise<Uint8Array> {
  if (Number(request.headers.get("content-length")) > maxBytes) throw new RangeError("body_limit");
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let length = 0;
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const expired = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => { reject(new RangeError("body_timeout")); void reader.cancel().catch(() => {}); }, 15_000);
  });
  try {
    while (true) {
      const { done, value } = await Promise.race([reader.read(), expired]);
      if (done) break;
      length += value.byteLength;
      if (length > maxBytes) throw new RangeError("body_limit");
      chunks.push(value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    return bytes;
  } finally {
    clearTimeout(timeout);
    void reader.cancel().catch(() => {});
  }
}

export function isJakSameOrigin(request: Request) {
  try {
    const origin = new URL(request.headers.get("origin") ?? "");
    const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? new URL(request.url).host;
    return ["http:", "https:"].includes(origin.protocol) && origin.host === host && request.headers.get("sec-fetch-site") !== "cross-site";
  } catch { return false; }
}
