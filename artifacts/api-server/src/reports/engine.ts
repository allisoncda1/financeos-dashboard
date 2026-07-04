/**
 * Report Engine — top-level entry point.
 *
 * Wires the builder (data assembly) to the renderer (output serialization).
 * Callers (routes/reports.ts) never need to know about either sub-module.
 */

import { buildReport, type ReportRequest, type BuiltReport } from "./builder";
import { getRenderer } from "./renderer";

export async function generateReport(
  request: ReportRequest,
): Promise<{ report: BuiltReport; output: unknown }> {
  const report = await buildReport(request);
  const output = await getRenderer(request.format).render(report);
  return { report, output };
}
