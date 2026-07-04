/**
 * Report Engine — renderers.
 *
 * A Renderer takes a fully-assembled BuiltReport and serializes it for a
 * specific output format. The builder never knows which renderer will run;
 * only getRenderer() maps a requested format to its implementation.
 * Renderers only transform presentation — they never recalculate data.
 */

import type { BuiltReport } from "./builder";
import { HtmlRenderer } from "./renderers/html";
import { PdfRenderer } from "./renderers/pdf";
import { ExcelRenderer } from "./renderers/excel";

export interface Renderer {
  format: string;
  render(report: BuiltReport): unknown | Promise<unknown>;
}

export const JsonRenderer: Renderer = {
  format: "json",
  render(report: BuiltReport): unknown {
    return report;
  },
};

const RENDERERS: Record<string, Renderer> = {
  json: JsonRenderer,
  html: HtmlRenderer,
  pdf: PdfRenderer,
  excel: ExcelRenderer,
};

export function getRenderer(format: string): Renderer {
  const renderer = RENDERERS[format];
  if (renderer) return renderer;

  throw new Error(`Unsupported format: "${format}"`);
}
