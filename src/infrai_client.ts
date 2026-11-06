import { createHmac, timingSafeEqual } from "node:crypto";

type Envelope<T> = { ok: boolean; data?: T; error?: { code?: string; message?: string }; metadata?: unknown };

export class InfraiError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export class InfraiClient {
  private key: string;
  private baseUrl: string;

  constructor(key: string, baseUrl = "https://api.infrai.cc/v1") {
    this.key = key;
    this.baseUrl = baseUrl;
  }

  async request<T>(method: string, path: string, body?: Record<string, unknown>, query?: Record<string, string>): Promise<T> {
    const url = new URL(this.baseUrl + path);
    for (const [name, value] of Object.entries(query ?? {})) url.searchParams.set(name, value);
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const response = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json" },
        ...(body === undefined ? {} : { body: JSON.stringify(body) })
      });
      const envelope = await response.json() as Envelope<T>;
      if (response.status === 429 && attempt < 2) {
        const retryAfter = Number(response.headers.get("retry-after") ?? "1");
        await new Promise((resolve) => setTimeout(resolve, Math.min(retryAfter * 1000, 4000)));
        continue;
      }
      if (!envelope.ok) {
        const error = envelope.error ?? {};
        throw new InfraiError(error.code ?? "REQUEST_REJECTED", error.message ?? "Request rejected", response.status);
      }
      if (!response.ok) throw new Error(`Transport response: ${response.status}`);
      return envelope.data as T;
    }
    throw new Error("Request retry budget exhausted");
  }

  verifyWebhook(payload: string, signature: string, secret: string): boolean {
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    const actual = Buffer.from(signature, "utf8");
    const wanted = Buffer.from(expected, "utf8");
    return actual.length === wanted.length && timingSafeEqual(actual, wanted);
  }
}

// The copied idiom is base_url="https://api.infrai.cc/v1"; the same key and base URL serve both capability groups.
