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
 * call. ClaudeProvider is an intentional stub for a future sprint: it
 * throws until ANTHROPIC_API_KEY + AI_PROVIDER=claude are configured.
 */

import { generateBriefing } from "./briefing";
import { num, isKnown, fmtMoney, fmtPct } from "./format";
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
 * ClaudeProvider — intentional stub for a future sprint. All methods throw
 * until ANTHROPIC_API_KEY is set and AI_PROVIDER=claude is configured.
 * Never called unless AI_PROVIDER=claude is explicitly set.
 */
export class ClaudeProvider implements AIProvider {
  name = "claude";
  model = "claude-sonnet-4-6";

  private notConfigured(): never {
    throw new Error(
      "ClaudeProvider not yet configured — set ANTHROPIC_API_KEY and set AI_PROVIDER=claude in environment",
    );
  }

  async generateBriefing(_context: AIContext): Promise<AIResponse> {
    this.notConfigured();
  }

  async summarizeReport(_context: AIContext): Promise<AIResponse> {
    this.notConfigured();
  }

  async analyzeFinancials(_context: AIContext): Promise<AIResponse> {
    this.notConfigured();
  }

  async answerQuestion(_context: AIContext): Promise<AIResponse> {
    this.notConfigured();
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
