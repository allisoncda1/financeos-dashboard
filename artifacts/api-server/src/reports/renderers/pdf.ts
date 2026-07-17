/**
 * Report Engine — PDF renderer.
 *
 * Converts the HTML renderer's output into a print-ready PDF via Puppeteer.
 * Renderers only transform presentation — the HTML content itself (and all
 * underlying data) comes entirely from HtmlRenderer / BuiltReport.
 */

import puppeteer from "puppeteer";
import type { Renderer } from "../renderer";
import type { BuiltReport } from "../builder";
import { HtmlRenderer, escapeHtml } from "./html";

export const PdfRenderer: Renderer = {
  format: "pdf",

  async render(report: BuiltReport): Promise<Buffer> {
    const html = HtmlRenderer.render(report) as string;
    const reportTitle = escapeHtml(`${report.template.name} — ${report.period}`);

    let browser;
    try {
      browser = await puppeteer.launch({
        executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    } catch {
      browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
      });
    }

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: "load" });

      const pdfBuffer = await page.pdf({
        format: "A4",
        printBackground: true,
        margin: { top: "16mm", bottom: "16mm", left: "18mm", right: "18mm" },
        displayHeaderFooter: true,
        headerTemplate: `<div style="width:100%;height:0;padding:0;margin:0;"></div>`,
        footerTemplate: `<div style="font-size:8pt;width:100%;display:flex;justify-content:space-between;padding:0 18mm;color:#94a3b8;font-family:system-ui,Arial,sans-serif;box-sizing:border-box;"><span>Prepared from QuickBooks Online records. Internal management reporting, not an audited statement.</span><span>Page <span class="pageNumber"></span></span></div>`,
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  },
};
