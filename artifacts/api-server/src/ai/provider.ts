/**
 * AI Platform — provider abstraction.
 *
 * This is the single seam between FinanceOS and any LLM. Every AI
 * capability (briefing, report summary, financial analysis, Q&A) is
 * expressed as an AIProvider method that takes only a structured AIContext
 * and returns an AIResponse. Swapping providers is a single config change
 * (AI_PROVIDER env var) — no caller ever needs to know which provider is
 * active.
 *
 * MockProvider is fully deterministic — no LLM, no API key, no network
 * call. ClaudeProvider calls the Anthropic API using ANTHROPIC_API_KEY and
 * is activated by setting AI_PROVIDER=claude.
 */

import Anthropic from "@anthropic-ai/sdk";
import { generateBriefing } from "./briefing";
import { num, isKnown, fmtMoney, fmtPct } from "./format";
import {
  buildAnalysisPrompt,
  buildBriefingPrompt,
  buildQuestionPrompt,
  buildReportSummaryPrompt,
} from "./promptBuilder";
import type { AIContext, AIResponse } from "./types";
import type { EntityMetrics } from "../lib/types";

export interface AIProvider {
  name: string;
  model: string;
  generateBriefing(context: AIContext): Promise<AIResponse>;
  summarizeReport(context: AIContext): Promise<AIResponse>;
  analyzeFinancials(context: AIContext): Promise<AIResponse>;
  answerQuestion(context: AIContext): Promise<AIResponse>;
}

function entityMetricsList(context: AIContext): EntityMetrics[] {
  return Object.values(context.entities).map((e) => e.metrics);
}

export class MockProvider implements AIProvider {
  name = "mock";
  model = "deterministic-v1";

  async generateBriefing(_context: AIContext): Promise<AIResponse> {
    // The AI Platform is the single owner of AI-generated content, but the
    // deterministic briefing composer (ai/briefing.ts) already knows how to
    // build a full BriefingResponse from live data — MockProvider reuses it
    // rather than re-implementing the same prose logic.
    const briefing = await generateBriefing();
    return {
      content: briefing.executiveSummary.join("\n\n"),
      structured: briefing,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
    };
  }

  async summarizeReport(context: AIContext): Promise<AIResponse> {
    const { portfolio, alerts, reportSections } = context;
    let content: string;

    if (reportSections && Object.keys(reportSections).length > 0) {
      const sectionNames = Object.keys(reportSections);
      content =
        `This report covers ${sectionNames.length} section${sectionNames.length === 1 ? "" : "s"} ` +
        `(${sectionNames.join(", ")}) for the portfolio as of ${portfolio.as_of}. ` +
        `Revenue YTD stands at ${fmtMoney(portfolio.portfolio_revenue_ytd)} across ${portfolio.entity_count} entities. ` +
        `${alerts.length > 0 ? `${alerts.length} active alert${alerts.length === 1 ? "" : "s"} require review.` : "No active alerts at this time."}`;
    } else {
      const critical = alerts.filter((a) => a.severity === "critical" || a.severity === "high").length;
      content =
        `Portfolio revenue YTD is ${fmtMoney(portfolio.portfolio_revenue_ytd)} across ${portfolio.entity_count} entities, ` +
        `with ${fmtMoney(portfolio.portfolio_net_income_ytd)} in net income. ` +
        `${critical > 0 ? `${critical} high-priority alert${critical === 1 ? "" : "s"} currently need attention.` : "No high-priority alerts are currently outstanding."}`;
    }

    return {
      content,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
    };
  }

  async analyzeFinancials(context: AIContext): Promise<AIResponse> {
    const metrics = entityMetricsList(context);
    const bullets: string[] = [];

    if (metrics.length === 0) {
      return {
        content: "No entity financial data is currently available for analysis.",
        provider: this.name,
        model: this.model,
        generatedAt: new Date().toISOString(),
      };
    }

    const byRevenue = [...metrics].filter((m) => isKnown(m.revenue_ytd)).sort((a, b) => b.revenue_ytd - a.revenue_ytd);
    if (byRevenue[0]) {
      bullets.push(`${byRevenue[0].entity} leads the portfolio in revenue at ${fmtMoney(byRevenue[0].revenue_ytd)} YTD.`);
    }

    const byMargin = [...metrics].filter((m) => isKnown(m.net_margin_pct)).sort((a, b) => a.net_margin_pct - b.net_margin_pct);
    if (byMargin[0]) {
      bullets.push(`${byMargin[0].entity} has the lowest net margin at ${fmtPct(byMargin[0].net_margin_pct)}, warranting a closer look at cost structure.`);
    }

    const byArRisk = [...metrics]
      .filter((m) => isKnown(m.open_ar) && isKnown(m.ar_overdue_pct))
      .sort((a, b) => b.open_ar * (b.ar_overdue_pct / 100) - a.open_ar * (a.ar_overdue_pct / 100));
    if (byArRisk[0] && num(byArRisk[0].ar_overdue_pct) > 0) {
      bullets.push(
        `${byArRisk[0].entity} carries the largest AR risk exposure — ${fmtMoney(byArRisk[0].open_ar)} open with ${fmtPct(byArRisk[0].ar_overdue_pct)} overdue.`,
      );
    }

    const totalCash = metrics.reduce((sum, m) => sum + num(m.cash_on_hand), 0);
    bullets.push(`Combined cash on hand across the portfolio is ${fmtMoney(totalCash)}.`);

    const profitable = metrics.filter((m) => isKnown(m.net_income_ytd) && m.net_income_ytd > 0).length;
    bullets.push(`${profitable} of ${metrics.length} entities are profitable YTD.`);

    return {
      content: bullets.map((b) => `• ${b}`).join("\n"),
      structured: { bullets },
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
    };
  }

  async answerQuestion(context: AIContext): Promise<AIResponse> {
    const question = (context.question ?? "").toLowerCase().trim();
    const { portfolio } = context;
    let content =
      "Based on current FinanceOS data, I cannot answer that question without additional context.";

    if (question.length > 0) {
      if (question.includes("revenue")) {
        content = `Portfolio revenue YTD is ${fmtMoney(portfolio.portfolio_revenue_ytd)} across ${portfolio.entity_count} entities.`;
      } else if (question.includes("net income") || question.includes("profit")) {
        content = `Portfolio net income YTD is ${fmtMoney(portfolio.portfolio_net_income_ytd)} at a ${fmtPct(portfolio.portfolio_net_margin_pct)} net margin.`;
      } else if (question.includes("cash")) {
        content = `Portfolio cash on hand is ${fmtMoney(portfolio.portfolio_cash_on_hand)}.`;
      } else if (question.includes("receivable") || question.includes(" ar")) {
        content = `Open accounts receivable across the portfolio is ${fmtMoney(portfolio.portfolio_open_ar)}.`;
      } else if (question.includes("payable") || question.includes(" ap")) {
        content = `Open accounts payable across the portfolio is ${fmtMoney(portfolio.portfolio_open_ap)}.`;
      } else if (question.includes("alert") || question.includes("risk")) {
        content =
          context.alerts.length > 0
            ? `There are currently ${context.alerts.length} active alert(s) across the portfolio.`
            : "There are no active alerts across the portfolio right now.";
      }
    }

    return {
      content,
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
    };
  }
}

/**
 * ClaudeProvider — real Anthropic-backed provider. Requires
 * ANTHROPIC_API_KEY to be set; activated by AI_PROVIDER=claude. Consumes
 * only the structured AIContext via the promptBuilder templates — never
 * raw CSV/Drive data. The API key never leaves the server and is never
 * included in any response or log.
 */
export class ClaudeProvider implements AIProvider {
  name = "claude";
  model = "claude-sonnet-4-5";

  private client: Anthropic | null = null;

  private getClient(): Anthropic {
    if (!this.client) {
      const apiKey = process.env["ANTHROPIC_API_KEY"];
      if (!apiKey) {
        throw new Error(
          "ClaudeProvider not configured — ANTHROPIC_API_KEY is missing from the environment",
        );
      }
      this.client = new Anthropic({ apiKey });
    }
    return this.client;
  }

  private async complete(prompt: string, maxTokens: number): Promise<{ text: string; tokensUsed: number }> {
    const message = await this.getClient().messages.create({
      model: this.model,
      max_tokens: maxTokens,
      messages: [{ role: "user", content: prompt }],
    });

    const text = message.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();

    return { text, tokensUsed: message.usage.input_tokens + message.usage.output_tokens };
  }

  private response(text: string, tokensUsed: number, structured?: unknown): AIResponse {
    return {
      content: text,
      ...(structured !== undefined ? { structured } : {}),
      provider: this.name,
      model: this.model,
      generatedAt: new Date().toISOString(),
      tokensUsed,
    };
  }

  async generateBriefing(context: AIContext): Promise<AIResponse> {
    const entityNames = Object.values(context.entities)
      .map((e) => e.metrics.entity)
      .filter((name): name is string => typeof name === "string" && name.length > 0);

    const prompt = [
      buildBriefingPrompt(context),
      "",
      "Output format: Respond with ONLY a JSON object (no markdown fences, no prose outside the JSON) with exactly these keys:",
      `{"greeting": "Good morning|afternoon|evening — Weekday, Month Day, Year", "executiveSummary": string[], "highlights": [{"icon": string, "text": string, "sentiment": "positive"|"negative"|"neutral"}], "priorities": [{"title": string, "description": string, "severity": "high"|"medium"|"low", "entity": string, "recommendedAction": string, "status": "New"}], "risks": [{"title": string, "description": string, "severity": "high"|"medium"|"low", "entity": string}], "opportunities": [{"title": string, "description": string, "entity": string}], "confidenceScore": number, "generatedAt": string}`,
      `Rules: severity must be exactly "high", "medium", or "low" — never "critical" and never a severity prefix in titles. entity must be exactly one of: ${entityNames.join(", ")} (or "Portfolio" for portfolio-level items). Use icon names from: trending-up, trending-down, minus, alert-triangle, alert-circle, award, package, refresh-cw. Set generatedAt to "${new Date().toISOString()}". confidenceScore is 0-100 based on data completeness. If a data field is null, describe it as "not available" — never write the words null, NaN, or undefined in any output text.`,
    ].join("\n");

    const { text, tokensUsed } = await this.complete(prompt, 4096);

    let structured: unknown;
    try {
      const jsonText = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
      structured = JSON.parse(jsonText);
    } catch {
      structured = undefined;
    }

    return this.response(text, tokensUsed, structured);
  }

  async summarizeReport(context: AIContext): Promise<AIResponse> {
    const { text, tokensUsed } = await this.complete(buildReportSummaryPrompt(context), 1024);
    return this.response(text, tokensUsed);
  }

  async analyzeFinancials(context: AIContext): Promise<AIResponse> {
    const prompt = [
      buildAnalysisPrompt(context),
      "",
      "Output format: plain bullet points only, one per line, each starting with \"• \". No headings, no horizontal rules, no markdown formatting, no preamble.",
    ].join("\n");
    const { text, tokensUsed } = await this.complete(prompt, 2048);
    const bullets = text
      .split("\n")
      .map((line) => line.replace(/^[•\-*]\s*/, "").trim())
      .filter((line) => line.length > 0 && !/^#|^-{2,}$|^\*{1,2}$/.test(line));
    return this.response(text, tokensUsed, { bullets });
  }

  async answerQuestion(context: AIContext): Promise<AIResponse> {
    const { text, tokensUsed } = await this.complete(buildQuestionPrompt(context), 2048);
    return this.response(text, tokensUsed);
  }
}

const mockProvider = new MockProvider();
const claudeProvider = new ClaudeProvider();

/**
 * getProvider — the single config point for switching AI providers.
 * Reads AI_PROVIDER from the environment (default "mock"). Switching to a
 * real LLM in production is a one-variable change — no caller needs to
 * change.
 */
export function getProvider(): AIProvider {
  const configured = (process.env["AI_PROVIDER"] ?? "mock").toLowerCase();
  if (configured === "claude") return claudeProvider;
  return mockProvider;
}
