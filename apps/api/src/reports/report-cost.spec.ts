import { reportCostMicros } from "./report-cost";

describe("Report pricing", () => {
  const inputRate = process.env.LLM_PRICE_INPUT_PER_MTOK;
  const outputRate = process.env.LLM_PRICE_OUTPUT_PER_MTOK;

  afterEach(() => {
    if (inputRate === undefined) delete process.env.LLM_PRICE_INPUT_PER_MTOK;
    else process.env.LLM_PRICE_INPUT_PER_MTOK = inputRate;
    if (outputRate === undefined) delete process.env.LLM_PRICE_OUTPUT_PER_MTOK;
    else process.env.LLM_PRICE_OUTPUT_PER_MTOK = outputRate;
  });

  it("uses zero cost by default for Ollama", () => {
    delete process.env.LLM_PRICE_INPUT_PER_MTOK;
    delete process.env.LLM_PRICE_OUTPUT_PER_MTOK;
    expect(
      reportCostMicros("ollama", {
        promptTokens: 10,
        completionTokens: 20,
        totalTokens: 30,
      }),
    ).toBe(0);
  });

  it("uses conservative DeepSeek cache-miss defaults", () => {
    delete process.env.LLM_PRICE_INPUT_PER_MTOK;
    delete process.env.LLM_PRICE_OUTPUT_PER_MTOK;
    expect(
      reportCostMicros("deepseek", {
        promptTokens: 10,
        completionTokens: 5,
        totalTokens: 15,
      }),
    ).toBe(9);
  });

  it("uses server-wide prices and rounds to integer micro-dollars", () => {
    process.env.LLM_PRICE_INPUT_PER_MTOK = "0.25";
    process.env.LLM_PRICE_OUTPUT_PER_MTOK = "0.5";
    expect(
      reportCostMicros("ollama", {
        promptTokens: 3,
        completionTokens: 1,
        totalTokens: 4,
      }),
    ).toBe(1);
  });
});
