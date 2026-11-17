import { ApiError } from "./api-error.js";
import type {
  ApiErrorEnvelope,
  Activity,
  ActivityList,
  ReportJob,
  ReportResult,
} from "../types/api.js";

type Fetcher = typeof fetch;

export class UpstreamUnavailable extends Error {
  constructor() {
    super("The Taskory API is temporarily unavailable; this can be retried");
    this.name = "UpstreamUnavailable";
  }
}

export class TaskoryApiClient {
  constructor(
    private readonly baseUrl: string,
    private readonly fetcher: Fetcher = fetch,
    private readonly timeoutMs = 15_000,
  ) {}

  async validateToken(token: string): Promise<{ valid: true }> {
    await this.get("/auth/me", token);
    return { valid: true };
  }

  listActivities(
    token: string,
    filters: Record<string, string | number | undefined>,
  ): Promise<ActivityList> {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined) query.set(key, String(value));
    }
    return this.get(`/activities${query.size ? `?${query}` : ""}`, token);
  }

  createActivity(token: string, input: unknown): Promise<Activity> {
    return this.send("/activities", token, "POST", input);
  }

  updateActivity(token: string, id: string, input: unknown): Promise<Activity> {
    return this.send(
      `/activities/${encodeURIComponent(id)}`,
      token,
      "PATCH",
      input,
    );
  }

  async deleteActivity(token: string, id: string): Promise<void> {
    await this.send(`/activities/${encodeURIComponent(id)}`, token, "DELETE");
  }

  createReport(
    token: string,
    input: unknown,
  ): Promise<ReportResult | ReportJob> {
    return this.send("/reports", token, "POST", input);
  }

  getReport(token: string, id: string): Promise<ReportJob> {
    return this.get(`/reports/${encodeURIComponent(id)}`, token);
  }

  private get<T>(path: string, token: string): Promise<T> {
    return this.send(path, token, "GET");
  }

  private async send<T>(
    path: string,
    token: string,
    method: string,
    body?: unknown,
  ): Promise<T> {
    let response: Response;
    try {
      response = await this.fetcher(`${this.baseUrl}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${token}`,
          ...(body === undefined ? {} : { "content-type": "application/json" }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch {
      throw new UpstreamUnavailable();
    }
    if (response.status >= 500) throw new UpstreamUnavailable();
    if (!response.ok) {
      let envelope: Partial<ApiErrorEnvelope> = {};
      try {
        envelope = (await response.json()) as ApiErrorEnvelope;
      } catch {
        envelope.message = response.statusText || "Taskory API request failed.";
      }
      throw new ApiError(
        response.status,
        envelope.code ?? "API_ERROR",
        envelope.message ?? "Taskory API request failed.",
        response.headers.get("retry-after") ?? undefined,
      );
    }
    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
  }
}
