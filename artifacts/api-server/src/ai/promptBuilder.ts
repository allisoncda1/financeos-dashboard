/**
 * AI Platform — prompt builders.
 *
 * These construct the exact prompt strings a real LLM provider (e.g.
 * ClaudeProvider) will send. MockProvider ignores these entirely — it
 * builds deterministic output directly from AIContext. Each prompt:
 *   1. Opens with a system-level instruction (role + tone)
 *   2. Includes a JSON block of only the relevant structured context
 *      fields — never raw CSVs or Drive file contents
 *   3. Closes with the specific task instruction
 *
 * Prompts are never sent to the frontend and never logged with secrets —
 * they exist purely server-side for the provider that consumes them.
 */

import type { AIContext } from "./types";

const SYSTEM_PREAMBLE =
  "You are an experienced CFO advising the leadership of a multi-entity portfolio. " +
  "Respond in a professional, concise tone appropriate for an executive audience. " +
  "Base every statement strictly on the structured data provided below — never invent figures.";

function contextBlock(fields: Record<string, unknown>): string {
  return `\`\`\`json\n${JSON.stringify(fields, null, 2)}\n\`\`\``;
}

export function buildBriefingPrompt(context: AIContext): string {
  const fields = {
    portfolio: context.portfolio,
    entities: context.entities,
    alerts: context.alerts,
    validation: context.validation,
    freshness: context.freshness,
  };

  return [
    SYSTEM_PREAMBLE,
    "",
    "Portfolio data:",
    contextBlock(fields),
    "",
    "Task: Write a CFO-style executive briefing summarizing portfolio performance, " +
      "profitability, cash position, and any risks or opportunities that need leadership attention.",
  ].join("\n");
}

export function buildReportSummaryPrompt(context: AIContext): string {
  const fields = {
    portfolio: context.portfolio,
    alerts: context.alerts,
    reportSections: context.reportSections ?? {},
    period: context.period,
  };

  return [
    SYSTEM_PREAMBLE,
    "",
    "Report data:",
    contextBlock(fields),
    "",
    "Task: Write a 2-3 sentence executive summary of this financial report, " +
      "highlighting the most decision-relevant figures and any notable alerts.",
  ].join("\n");
}

export function buildAnalysisPrompt(context: AIContext): string {
  const fields = {
    entities: context.entities,
    portfolio: context.portfolio,
  };

  return [
    SYSTEM_PREAMBLE,
    "",
    "Entity financial data:",
    contextBlock(fields),
    "",
    "Task: Produce 3-5 bullet points analyzing entity-level financial performance — " +
      "call out the highest-revenue entity, the lowest-margin entity, the largest accounts " +
      "receivable risk, and the overall cash position.",
  ].join("\n");
}

export function buildQuestionPrompt(context: AIContext): string {
  const fields = {
    portfolio: context.portfolio,
    entities: context.entities,
    alerts: context.alerts,
    validation: context.validation,
    freshness: context.freshness,
  };

  return [
    SYSTEM_PREAMBLE,
    "",
    "Portfolio data:",
    contextBlock(fields),
    "",
    `Question: ${context.question ?? "(no question provided)"}`,
    "",
    "Task: Answer the question strictly from the data above. If the data does not contain " +
      "enough information to answer confidently, say so rather than guessing.",
  ].join("\n");
}
