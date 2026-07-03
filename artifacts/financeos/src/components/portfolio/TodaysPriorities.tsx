
import { useState, useEffect } from "react";
import Link from "@/lib/next-compat";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { ArrowUpRight, ChevronDown, CheckCircle2 } from "lucide-react";
import type { PriorityItem } from "@/lib/briefing";

type Status = "new" | "acknowledged" | "in_progress" | "resolved";
const LS_KEY = "financeos_op_statuses";

const STATUS_ORDER: Status[] = ["new", "acknowledged", "in_progress", "resolved"];
const STATUS_LABEL: Record<Status, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  in_progress: "In Progress",
  resolved: "Resolved",
};
const STATUS_STYLE: Record<Status, { bg: string; text: string }> = {
  new:          { bg: "bg-red-50",    text: "text-red-700" },
  acknowledged: { bg: "bg-amber-50",  text: "text-amber-700" },
  in_progress:  { bg: "bg-blue-50",   text: "text-blue-700" },
  resolved:     { bg: "bg-gray-100",  text: "text-gray-400" },
};
const SEV_STYLE: Record<string, string> = {
  high:   "bg-red-500",
  medium: "bg-amber-400",
  low:    "bg-blue-400",
};

const ease = [0.16, 1, 0.3, 1] as [number, number, number, number];

export function TodaysPriorities({ priorities }: { priorities: PriorityItem[] }) {
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [showResolved, setShowResolved] = useState(false);
  const [toastId, setToastId] = useState<string | null>(null);
  const reduced = useReducedMotion();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(LS_KEY);
      if (raw) setStatuses(JSON.parse(raw));
    } catch {}
  }, []);

  const getStatus = (id: string): Status => statuses[id] ?? "new";

  const advance = (id: string) => {
    setStatuses((prev) => {
      const cur = prev[id] ?? "new";
      const nextIdx = Math.min(STATUS_ORDER.indexOf(cur) + 1, STATUS_ORDER.length - 1);
      const next = { ...prev, [id]: STATUS_ORDER[nextIdx] };
      try { localStorage.setItem(LS_KEY, JSON.stringify(next)); } catch {}
      return next;
    });
    // Show brief success toast when reaching resolved
    const cur = statuses[id] ?? "new";
    if (STATUS_ORDER.indexOf(cur) === STATUS_ORDER.length - 2) {
      setToastId(id);
      setTimeout(() => setToastId(null), 2000);
    }
  };

  const active   = priorities.filter((p) => getStatus(p.id) !== "resolved");
  const resolved = priorities.filter((p) => getStatus(p.id) === "resolved");

  const itemVariants = {
    hidden: { opacity: 0, x: -8 },
    show:   { opacity: 1, x: 0, transition: { duration: 0.2, ease } },
    exit:   { opacity: 0, x: 8, height: 0, transition: { duration: 0.18, ease } },
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <h2 className="text-[13px] font-semibold text-gray-900">Today&apos;s Priorities</h2>
            <AnimatePresence>
              {active.length > 0 && (
                <motion.span
                  key={active.length}
                  className="bg-red-500 text-white text-[9px] font-bold rounded-full w-4 h-4 flex items-center justify-center"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1,   opacity: 1 }}
                  exit={{    scale: 0.6, opacity: 0 }}
                  transition={{ duration: 0.15, ease }}
                >
                  {active.length}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
          <span className="text-[10px] text-gray-400">
            {resolved.length}/{priorities.length} resolved
          </span>
        </div>

        <div className="divide-y divide-gray-50">
          <AnimatePresence initial={false}>
            {active.length === 0 && (
              <motion.p
                key="empty"
                className="px-4 py-6 text-[12px] text-gray-400 text-center"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.2 }}
              >
                All priorities resolved — great work!
              </motion.p>
            )}
            {active.map((item, i) => {
              const status = getStatus(item.id);
              const ss = STATUS_STYLE[status];
              return (
                <motion.div
                  key={item.id}
                  variants={reduced ? undefined : itemVariants}
                  initial="hidden"
                  animate="show"
                  exit="exit"
                  layout
                  className="px-4 py-3 flex items-start gap-3"
                >
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
                    <span className={`w-2 h-2 rounded-full ${SEV_STYLE[item.severity]}`} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="inline-block w-1.5 h-4 rounded-sm flex-shrink-0"
                        style={{ background: item.entityColor }}
                      />
                      <p className="text-[12px] font-semibold text-gray-900 truncate">{item.title}</p>
                    </div>
                    <p className="text-[11px] text-gray-500 leading-relaxed ml-3.5">{item.description}</p>
                    <div className="flex items-center gap-2 mt-1.5 ml-3.5">
                      <motion.span
                        key={status}
                        className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${ss.bg} ${ss.text}`}
                        initial={reduced ? false : { opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.15, ease }}
                      >
                        {STATUS_LABEL[status]}
                      </motion.span>
                      <Link
                        href={item.href}
                        className="flex items-center gap-0.5 text-[10px] text-emerald-600 font-medium hover:text-emerald-700 transition-colors"
                      >
                        {item.action}
                        <ArrowUpRight className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>

                  {status !== "resolved" && (
                    <motion.button
                      onClick={() => advance(item.id)}
                      className="flex-shrink-0 text-[10px] font-medium text-gray-400 hover:text-gray-700 bg-gray-50 hover:bg-gray-100 px-2 py-1 rounded-lg transition-colors mt-0.5"
                      whileHover={reduced ? undefined : { scale: 1.03 }}
                      whileTap={reduced  ? undefined : { scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                    >
                      {STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1]
                        ? `→ ${STATUS_LABEL[STATUS_ORDER[STATUS_ORDER.indexOf(status) + 1]]}`
                        : "Resolved"}
                    </motion.button>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>

        {/* Resolved toggle */}
        {resolved.length > 0 && (
          <div className="border-t border-gray-100">
            <button
              onClick={() => setShowResolved((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2 text-[10px] text-gray-400 hover:bg-gray-50 transition-colors"
            >
              <span>{resolved.length} resolved item{resolved.length !== 1 ? "s" : ""}</span>
              <motion.span
                animate={{ rotate: showResolved ? 180 : 0 }}
                transition={{ duration: 0.15 }}
              >
                <ChevronDown className="w-3 h-3" />
              </motion.span>
            </button>
            <AnimatePresence>
              {showResolved && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{   height: 0, opacity: 0 }}
                  transition={{ duration: 0.18, ease }}
                  className="overflow-hidden"
                >
                  <div className="divide-y divide-gray-50 opacity-40">
                    {resolved.map((item) => (
                      <div key={item.id} className="px-4 py-2 flex items-center gap-3">
                        <span className="w-2 h-2 rounded-full bg-gray-300 flex-shrink-0" />
                        <p className="text-[11px] text-gray-500 truncate line-through">{item.title}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      {/* Success toast on resolve */}
      <AnimatePresence>
        {toastId && (
          <motion.div
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg bg-emerald-600 text-white text-[13px] font-semibold"
            initial={reduced ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1,  y: 0,  scale: 1 }}
            exit={reduced    ? { opacity: 0 } : { opacity: 0, y: 8,  scale: 0.97 }}
            transition={{ duration: 0.2, ease }}
          >
            <CheckCircle2 className="w-4 h-4" />
            Marked as Resolved
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
