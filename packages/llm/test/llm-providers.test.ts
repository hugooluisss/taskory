import { describe, expect, it, vi } from "vitest";
import { DeepSeekProvider } from "../src/providers/deepseek.provider";
import { OllamaProvider } from "../src/providers/ollama.provider";
import { LlmUnavailableError } from "../src/errors/llm-unavailable.error";

describe("Provider abstraction", () => {
  it("Ollama provider generates text through configured server", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            message: { content: "ok" },
            prompt_eval_count: 3,
            eval_count: 4,
          }),
        ),
      );
    const provider = new OllamaProvider({
      fetcher,
      baseUrl: "http://ollama",
      model: "model-x",
      timeoutMs: 42_000,
    });
    await expect(
      provider.complete({ system: "s", prompt: "p" }),
    ).resolves.toEqual({
      text: "ok",
      usage: { promptTokens: 3, completionTokens: 4, totalTokens: 7 },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "http://ollama/api/chat",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      stream: false,
      model: "model-x",
    });
  });

  it("Ollama provider requests JSON format when requested", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "{}" } })),
      );
    const provider = new OllamaProvider({ fetcher, baseUrl: "http://ollama" });
    await provider.complete({ system: "s", prompt: "p", json: true });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      format: "json",
    });
  });

  it("Ollama provider passes empty JSON-mode content to validation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify({ message: { content: "  " } })),
      );
    const provider = new OllamaProvider({ fetcher, baseUrl: "http://ollama" });
    await expect(
      provider.complete({ system: "s", prompt: "p", json: true }),
    ).resolves.toEqual({
      text: "  ",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
  });

  it("DeepSeek provider generates text through API", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 6, completion_tokens: 3, total_tokens: 9 },
          }),
        ),
      );
    const provider = new DeepSeekProvider({ fetcher, apiKey: "secret" });
    await expect(
      provider.complete({ system: "s", prompt: "p" }),
    ).resolves.toEqual({
      text: "ok",
      usage: { promptTokens: 6, completionTokens: 3, totalTokens: 9 },
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://api.deepseek.com/chat/completions",
      expect.objectContaining({
        headers: expect.objectContaining({ authorization: "Bearer secret" }),
      }),
    );
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      model: "deepseek-flash",
    });
  });

  it("DeepSeek provider requests JSON object mode when requested", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "{}" } }] }),
        ),
      );
    const provider = new DeepSeekProvider({ fetcher, apiKey: "secret" });
    await provider.complete({ system: "s", prompt: "p", json: true });
    expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
      response_format: { type: "json_object" },
    });
  });

  it("DeepSeek provider passes empty JSON-mode content to validation", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ choices: [{ message: { content: "" } }] }),
        ),
      );
    const provider = new DeepSeekProvider({ fetcher, apiKey: "secret" });
    await expect(
      provider.complete({ system: "s", prompt: "p", json: true }),
    ).resolves.toEqual({
      text: "",
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
    });
  });

  it("missing DeepSeek credentials fail with a controlled error", async () => {
    const fetcher = vi.fn<typeof fetch>();
    const provider = new DeepSeekProvider({ fetcher, apiKey: "" });
    expect(fetcher).not.toHaveBeenCalled();
    await expect(
      provider.complete({ system: "", prompt: "" }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it("provider failures return a controlled error with the cause", async () => {
    const cause = new Error("offline");
    const provider = new OllamaProvider({
      fetcher: vi.fn<typeof fetch>().mockRejectedValue(cause),
    });
    await expect(
      provider.complete({ system: "", prompt: "" }),
    ).rejects.toMatchObject({ name: "LlmUnavailableError", cause });
  });

  it("provider HTTP and malformed responses return a controlled error", async () => {
    const httpFailure = new OllamaProvider({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("", { status: 503 })),
    });
    const malformed = new DeepSeekProvider({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(JSON.stringify({ choices: [] }))),
      apiKey: "secret",
    });
    await expect(
      httpFailure.complete({ system: "", prompt: "" }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
    await expect(
      malformed.complete({ system: "", prompt: "" }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
  });

  it("real timeout abort is translated to LlmUnavailableError", async () => {
    const fetcher = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise((_resolve, reject) => {
          const signal = init?.signal;
          if (signal?.aborted) {
            reject(signal.reason);
            return;
          }
          signal?.addEventListener("abort", () => reject(signal.reason), {
            once: true,
          });
        }),
    );
    const provider = new OllamaProvider({ fetcher, timeoutMs: 10 });
    await expect(
      provider.complete({ system: "", prompt: "" }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
    expect(fetcher.mock.calls[0][1]?.signal?.aborted).toBe(true);
  });

  it("empty provider content is a controlled failure", async () => {
    const ollama = new OllamaProvider({
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(JSON.stringify({ message: { content: "  " } })),
        ),
    });
    const deepseek = new DeepSeekProvider({
      apiKey: "secret",
      fetcher: vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ choices: [{ message: { content: "" } }] }),
          ),
        ),
    });
    await expect(
      ollama.complete({ system: "", prompt: "" }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
    await expect(
      deepseek.complete({ system: "", prompt: "" }),
    ).rejects.toBeInstanceOf(LlmUnavailableError);
  });
});
