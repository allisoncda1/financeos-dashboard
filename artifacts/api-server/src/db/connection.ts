import { db, opsDb } from "@workspace/db";

// db    → FinanceOS Core (read-only Neon): entities, financial_periods, …
// opsDb → Dashboard operational DB (writable): budgets
export { db, opsDb };
