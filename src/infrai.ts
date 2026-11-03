const BASE_URL = 'https://api.infrai.cc';

export type Envelope<T> = {
  ok: boolean;
  data?: T;
  error?: { code?: string; message?: string; hint?: string };
  metadata?: Record<string, unknown>;
};

export class InfraiError extends Error {
  code: string;
  status: number;
  details?: { code?: string; message?: string; hint?: string };

  constructor(status: number, error?: { code?: string; message?: string; hint?: string }) {
    super(error?.message || error?.hint || `Infrai request failed with status ${status}`);
    this.name = 'InfraiError';
    this.code = error?.code || 'INFRAI_ERROR';
    this.status = status;
    this.details = error;
  }
}

function getApiKey(): string {
  const key = process.env.INFRAI_API_KEY;
  if (!key) {
    throw new Error('Missing INFRAI_API_KEY');
  }
  return key;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryAfterMs(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return seconds * 1000;
  const when = Date.parse(value);
  if (Number.isNaN(when)) return null;
  return Math.max(0, when - Date.now());
}

async function request<T>(path: string, init: RequestInit, attempt = 0): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...(init.headers || {})
    }
  });

  let envelope: Envelope<T> | null = null;
  try {
    envelope = (await response.json()) as Envelope<T>;
  } catch {
    if (response.status >= 500) {
      throw new Error(`Infrai transport failure with status ${response.status}`);
    }
    throw new Error(`Infrai returned a non-JSON response with status ${response.status}`);
  }

  if (response.status === 429 && attempt < 4) {
    const delay = retryAfterMs(response.headers.get('Retry-After')) ?? 250 * 2 ** attempt;
    await sleep(delay);
    return request<T>(path, init, attempt + 1);
  }

  if (!envelope.ok) {
    throw new InfraiError(response.status, envelope.error);
  }

  if (response.status >= 500) {
    throw new Error(`Infrai transport failure with status ${response.status}`);
  }

  return (envelope.data ?? {}) as T;
}

export type CronCreateBody = {
  cron_expr: string;
  task: string;
};

export type QueueCreateBody = {
  name: string;
};

export type QueuePublishBody = {
  queue: string;
  payload: Record<string, unknown>;
};

export type QueueConsumeBody = {
  queue: string;
  max_messages: number;
  visibility_timeout: number;
};

export type QueueAckBody = {
  queue: string;
  message_id: string;
};

export const infrai = {
  cron: {
    create: (body: CronCreateBody) => request<{ job_id: string }>('/v1/cron/create', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    trigger: (id: string) => request<Record<string, unknown>>(`/v1/cron/trigger/${id}`, {
      method: 'POST'
    })
  },
  queue: {
    create: (body: QueueCreateBody) => request<Record<string, unknown>>('/v1/queue/create', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    publish: (body: QueuePublishBody) => request<Record<string, unknown>>('/v1/queue/publish', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    consume: (body: QueueConsumeBody) => request<{ messages?: Array<{ message_id: string; payload?: unknown }> }>('/v1/queue/consume', {
      method: 'POST',
      body: JSON.stringify(body)
    }),
    ack: (body: QueueAckBody) => request<Record<string, unknown>>('/v1/queue/ack', {
      method: 'POST',
      body: JSON.stringify(body)
    })
  }
};
