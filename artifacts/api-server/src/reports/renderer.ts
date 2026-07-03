/**
 * Report Engine — renderers.
 *
 * A Renderer takes a fully-assembled BuiltReport and serializes it for a
 * specific output format. The builder never knows which renderer will run;
 * only getRenderer() maps a requested format to its implementation. Phase 1
 * ships only JSON — pdf/excel/html are reserved slots for later sprints.
 */

import type { BuiltReport } from "./builder";

export interface Renderer {
  format: string;
  render(report: BuiltReport): unknown;
}

export const JsonRenderer: Renderer = {
  format: "json",
  render(report: BuiltReport): unknown {
    return report;
  },
};

const RENDERERS: Record<string, Renderer> = {
  json: JsonRenderer,
};

const UNIMPLEMENTED_FORMATS: Record<string, string> = {
  pdf: "PDF renderer not yet implemented — coming in Sprint 16",
  excel: "Excel renderer not yet implemented — coming in Sprint 16",
  html: "HTML renderer not yet implemented — coming in Sprint 16",
};

export function getRenderer(format: string): Renderer {
  const renderer = RENDERERS[format];
  if (renderer) return renderer;

  const message = UNIMPLEMENTED_FORMATS[format];
  if (message) throw new Error(message);

  throw new Error(`Unsupported report format: "${format}"`);
}
