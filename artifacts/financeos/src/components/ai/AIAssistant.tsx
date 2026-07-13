import { useEffect, useState } from "react";
import { ArrowUp, X } from "lucide-react";

const MASCOT_SRC = "/branding/finos-mascot.png";

export function AIAssistant() {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <div className="group relative">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Ask FinanceOS AI"
          aria-expanded={open}
          aria-controls="ai-chat-panel"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200/80 bg-white shadow-[0_1px_4px_rgba(16,24,40,0.08)] transition-all duration-200 hover:scale-105 hover:shadow-[0_3px_10px_rgba(16,24,40,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-400"
          data-testid="button-ai-assistant"
        >
          <img
            src={MASCOT_SRC}
            alt=""
            className="h-7 w-7 object-contain"
            draggable={false}
          />
        </button>
        <span
          className="pointer-events-none absolute right-0 top-full z-50 mt-2 whitespace-nowrap rounded-md bg-gray-900 px-2.5 py-1.5 text-[11px] font-medium text-white opacity-0 shadow-md transition-opacity duration-200 group-hover:opacity-100"
          role="tooltip"
          data-testid="tooltip-ai-assistant"
        >
          Ask FinanceOS AI
        </span>
      </div>

      {open && (
        <div
          className="fixed inset-0 z-40 bg-gray-900/10"
          onClick={() => setOpen(false)}
          data-testid="backdrop-ai-panel"
        />
      )}

      <aside
        id="ai-chat-panel"
        className={`fixed right-0 top-0 z-50 flex h-full w-full max-w-[380px] flex-col border-l border-gray-200/80 bg-white shadow-[-8px_0_30px_rgba(16,24,40,0.08)] transition-transform duration-300 ease-out ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
        aria-hidden={!open}
        data-testid="panel-ai-chat"
      >
        <header className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
          <img
            src={MASCOT_SRC}
            alt=""
            className="h-8 w-8 object-contain"
            draggable={false}
          />
          <div className="min-w-0 flex-1">
            <h2 className="text-[14px] font-semibold text-gray-900">FinanceOS AI</h2>
            <p className="text-[11px] text-gray-400">Your financial copilot</p>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="flex h-8 w-8 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-50 hover:text-gray-600"
            data-testid="button-close-ai-panel"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <div className="flex-1 overflow-y-auto px-5 py-6">
          <div className="rounded-2xl rounded-tl-md bg-gray-50 px-4 py-3">
            <p className="text-[13px] leading-relaxed text-gray-600">
              Hi, I&apos;m your FinanceOS assistant. Ask me anything about your
              business — performance, cash flow, forecasts or invoices.
            </p>
          </div>
        </div>

        <footer className="border-t border-gray-100 px-4 py-4">
          <div className="flex items-center gap-2 rounded-[14px] border border-gray-200/80 bg-white px-4 py-2.5 shadow-sm transition-shadow focus-within:shadow-[0_2px_10px_rgba(99,102,241,0.12)]">
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ask me anything about your business..."
              className="w-full bg-transparent text-[13px] text-gray-800 placeholder:text-gray-400 focus:outline-none"
              data-testid="input-ai-panel-prompt"
            />
            <button
              type="button"
              aria-label="Send"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-white transition-transform duration-200 hover:scale-105"
              data-testid="button-ai-panel-send"
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
          </div>
        </footer>
      </aside>
    </>
  );
}
