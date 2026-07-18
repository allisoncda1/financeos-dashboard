import { Switch, Route, Router as WouterRouter } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { CommandBar } from "@/components/layout/CommandBar";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import PortfolioPage from "@/pages/portfolio";
import AccountingOverviewPage from "@/pages/accounting/index";
import TransactionsPage from "@/pages/accounting/transactions/index";
import UncategorizedTransactionsPage from "@/pages/accounting/transactions/uncategorized";
import CategorizedTransactionsPage from "@/pages/accounting/transactions/categorized";
import ReconciliationPage from "@/pages/accounting/reconciliation/index";
import ReconciliationAccountsPage from "@/pages/accounting/reconciliation/accounts";
import MatchCenterPage from "@/pages/accounting/reconciliation/match-center";
import CashFlowPage from "@/pages/analyze/cashflow";
import ConsolidatedPage from "@/pages/analyze/consolidated";
import HistoryPage from "@/pages/analyze/history";
import PerformancePage from "@/pages/analyze/performance";
import IntegrityPage from "@/pages/control/integrity";
import SettingsPage from "@/pages/control/settings";
import ValidationPage from "@/pages/control/validation";
import OperationsPage from "@/pages/operations";
import ReportsPage from "@/pages/reports";
import ReportDraftEditor from "@/pages/reportDraftEditor";
import EntityPage from "@/pages/entity/dashboard";
import EntityBankingPage from "@/pages/entity/banking";
import EntityCustomersPage from "@/pages/entity/customers";
import EntityFinancialsPage from "@/pages/entity/financials";
import EntityReportsPage from "@/pages/entity/reports";
import EntityVendorsPage from "@/pages/entity/vendors";
import BudgetOverviewPage from "@/pages/budget/index";
import BudgetBuilderPage from "@/pages/budget/builder";
import BudgetVsActualPage from "@/pages/budget/budget-vs-actual";
import BudgetPnLPage from "@/pages/budget/pnl";
import BudgetCashFlowPage from "@/pages/budget/cash-flow";
import BudgetBalanceSheetPage from "@/pages/budget/balance-sheet";
import { BudgetEntityProvider } from "@/lib/budget-context";
import BudgetDepartmentsPage from "@/pages/budget/departments";
import BudgetVersionsPage from "@/pages/budget/versions";
import BudgetAssumptionsPage from "@/pages/budget/assumptions";
import BudgetReportsPage from "@/pages/budget/reports";
import BudgetSettingsPage from "@/pages/budget/settings";
import AnalyticsOverviewPage from "@/pages/analytics/index";
import CostCentersPage from "@/pages/analytics/cost-centers";
import SharedExpensesPage from "@/pages/analytics/shared-expenses";
import AllocationRulesPage from "@/pages/analytics/allocation-rules";
import AllocationsPage from "@/pages/analytics/allocations";
import DepartmentPnlPage from "@/pages/analytics/department-pnl";
import EntityProfitabilityPage from "@/pages/analytics/entity-profitability";
import ClientProfitabilityPage from "@/pages/analytics/client-profitability";
import ProjectProfitabilityPage from "@/pages/analytics/project-profitability";
import AllocationSimulatorPage from "@/pages/analytics/simulator";
import AnalyticsReportsPage from "@/pages/analytics/reports";
import AnalyticsSettingsPage from "@/pages/analytics/settings";
import { AnalyticsProvider } from "@/lib/analytics-context";
import AccountingWorkspacePage from "@/pages/accounting/workspace";
import AccountingInvoicesPage from "@/pages/accounting/invoices";
import AccountingTransactionsPage from "@/pages/accounting/transactions";
import AccountingReconciliationPage from "@/pages/accounting/reconciliation";
import AccountingCustomersPage from "@/pages/accounting/customers";
import AccountingVendorsPage from "@/pages/accounting/vendors";
import AccountingChartOfAccountsPage from "@/pages/accounting/chart-of-accounts";
import AccountingRulesPage from "@/pages/accounting/rules";
import AccountingJournalEntriesPage from "@/pages/accounting/journal-entries";
import AccountingFixedAssetsPage from "@/pages/accounting/fixed-assets";
import AccountingMonthEndClosePage from "@/pages/accounting/month-end-close";
import AccountingSettingsPage from "@/pages/accounting/settings";
import CommissionOverviewPage from "@/pages/commissions/overview";
import CommissionInvoicesPage from "@/pages/commissions/invoices";
import CommissionSalesRepsPage from "@/pages/commissions/sales-reps";
import CommissionClientsPage from "@/pages/commissions/clients";
import CommissionPlansPage from "@/pages/commissions/plans";
import CommissionCalculationsPage from "@/pages/commissions/calculations";
import CommissionPayoutsPage from "@/pages/commissions/payouts";
import CommissionReportsPage from "@/pages/commissions/reports";
import CommissionSettingsPage from "@/pages/commissions/settings";
import ForecastOverviewPage from "@/pages/forecast/overview";
import RevenueForecastPage from "@/pages/forecast/revenue";
import CashFlowForecastPage from "@/pages/forecast/cash-flow";
import PnlForecastPage from "@/pages/forecast/pnl";
import BalanceSheetForecastPage from "@/pages/forecast/balance-sheet";
import ForecastScenariosPage from "@/pages/forecast/scenarios";
import ForecastDriversPage from "@/pages/forecast/drivers";
import ForecastReportsPage from "@/pages/forecast/reports";
import ForecastSettingsPage from "@/pages/forecast/settings";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={PortfolioPage} />
      <Route path="/accounting" component={AccountingOverviewPage} />
      <Route path="/accounting/transactions" component={TransactionsPage} />
      <Route path="/accounting/transactions/uncategorized" component={UncategorizedTransactionsPage} />
      <Route path="/accounting/transactions/categorized" component={CategorizedTransactionsPage} />
      <Route path="/accounting/reconciliation" component={ReconciliationPage} />
      <Route path="/accounting/reconciliation/accounts" component={ReconciliationAccountsPage} />
      <Route path="/accounting/reconciliation/match-center" component={MatchCenterPage} />
      <Route path="/analyze/cashflow" component={CashFlowPage} />
      <Route path="/analyze/consolidated" component={ConsolidatedPage} />
      <Route path="/analyze/history" component={HistoryPage} />
      <Route path="/analyze/performance" component={PerformancePage} />
      <Route path="/control/integrity" component={IntegrityPage} />
      <Route path="/control/settings" component={SettingsPage} />
      <Route path="/control/validation" component={ValidationPage} />
      <Route path="/operations" component={OperationsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/reports/draft/:draftId" component={ReportDraftEditor} />
      <Route path="/entity/:slug" component={EntityPage} />
      <Route path="/entity/:slug/banking" component={EntityBankingPage} />
      <Route path="/entity/:slug/customers" component={EntityCustomersPage} />
      <Route path="/entity/:slug/financials" component={EntityFinancialsPage} />
      <Route path="/entity/:slug/reports" component={EntityReportsPage} />
      <Route path="/entity/:slug/vendors" component={EntityVendorsPage} />
      <Route path="/budget">
        <BudgetEntityProvider>
          <Switch>
            <Route path="/budget" component={BudgetOverviewPage} />
            <Route path="/budget/builder" component={BudgetBuilderPage} />
            <Route path="/budget/budget-vs-actual" component={BudgetVsActualPage} />
            <Route path="/budget/departments" component={BudgetDepartmentsPage} />
            <Route path="/budget/pnl" component={BudgetPnLPage} />
            <Route path="/budget/cash-flow" component={BudgetCashFlowPage} />
            <Route path="/budget/balance-sheet" component={BudgetBalanceSheetPage} />
            <Route path="/budget/versions" component={BudgetVersionsPage} />
            <Route path="/budget/assumptions" component={BudgetAssumptionsPage} />
            <Route path="/budget/reports" component={BudgetReportsPage} />
            <Route path="/budget/settings" component={BudgetSettingsPage} />
          </Switch>
        </BudgetEntityProvider>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function BudgetRoutes() {
  return (
    <BudgetEntityProvider>
      <Switch>
        <Route path="/budget" component={BudgetOverviewPage} />
        <Route path="/budget/builder" component={BudgetBuilderPage} />
        <Route path="/budget/budget-vs-actual" component={BudgetVsActualPage} />
        <Route path="/budget/departments" component={BudgetDepartmentsPage} />
        <Route path="/budget/pnl" component={BudgetPnLPage} />
        <Route path="/budget/cash-flow" component={BudgetCashFlowPage} />
        <Route path="/budget/balance-sheet" component={BudgetBalanceSheetPage} />
        <Route path="/budget/versions" component={BudgetVersionsPage} />
        <Route path="/budget/assumptions" component={BudgetAssumptionsPage} />
        <Route path="/budget/reports" component={BudgetReportsPage} />
        <Route path="/budget/settings" component={BudgetSettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </BudgetEntityProvider>
  );
}

function AnalyticsRoutes() {
  return (
    <AnalyticsProvider>
      <Switch>
        <Route path="/analytics" component={AnalyticsOverviewPage} />
        <Route path="/analytics/cost-centers" component={CostCentersPage} />
        <Route path="/analytics/shared-expenses" component={SharedExpensesPage} />
        <Route path="/analytics/allocation-rules" component={AllocationRulesPage} />
        <Route path="/analytics/allocations" component={AllocationsPage} />
        <Route path="/analytics/department-pnl" component={DepartmentPnlPage} />
        <Route path="/analytics/entity-profitability" component={EntityProfitabilityPage} />
        <Route path="/analytics/client-profitability" component={ClientProfitabilityPage} />
        <Route path="/analytics/project-profitability" component={ProjectProfitabilityPage} />
        <Route path="/analytics/simulator" component={AllocationSimulatorPage} />
        <Route path="/analytics/reports" component={AnalyticsReportsPage} />
        <Route path="/analytics/settings" component={AnalyticsSettingsPage} />
        <Route component={NotFound} />
      </Switch>
    </AnalyticsProvider>
  );
}

function AccountingRoutes() {
  return (
    <Switch>
      <Route path="/accounting" component={AccountingWorkspacePage} />
      <Route path="/accounting/invoices">
        <AccountingInvoicesPage />
      </Route>
      <Route path="/accounting/invoices/draft">
        <AccountingInvoicesPage filter="draft" />
      </Route>
      <Route path="/accounting/invoices/sent">
        <AccountingInvoicesPage filter="sent" />
      </Route>
      <Route path="/accounting/invoices/paid">
        <AccountingInvoicesPage filter="paid" />
      </Route>
      <Route path="/accounting/invoices/recurring">
        <AccountingInvoicesPage filter="recurring" />
      </Route>
      <Route path="/accounting/transactions">
        <AccountingTransactionsPage />
      </Route>
      <Route path="/accounting/transactions/uncategorized">
        <AccountingTransactionsPage view="uncategorized" />
      </Route>
      <Route path="/accounting/transactions/categorized">
        <AccountingTransactionsPage view="categorized" />
      </Route>
      <Route path="/accounting/transactions/rules">
        <AccountingTransactionsPage view="rules" />
      </Route>
      <Route path="/accounting/reconciliation">
        <AccountingReconciliationPage />
      </Route>
      <Route path="/accounting/reconciliation/accounts">
        <AccountingReconciliationPage view="accounts" />
      </Route>
      <Route path="/accounting/reconciliation/match-center">
        <AccountingReconciliationPage view="match-center" />
      </Route>
      <Route path="/accounting/reconciliation/history">
        <AccountingReconciliationPage view="history" />
      </Route>
      <Route path="/accounting/customers" component={AccountingCustomersPage} />
      <Route path="/accounting/vendors" component={AccountingVendorsPage} />
      <Route path="/accounting/chart-of-accounts" component={AccountingChartOfAccountsPage} />
      <Route path="/accounting/rules" component={AccountingRulesPage} />
      <Route path="/accounting/journal-entries" component={AccountingJournalEntriesPage} />
      <Route path="/accounting/fixed-assets" component={AccountingFixedAssetsPage} />
      <Route path="/accounting/month-end-close" component={AccountingMonthEndClosePage} />
      <Route path="/accounting/settings" component={AccountingSettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function CommissionRoutes() {
  return (
    <Switch>
      <Route path="/commissions" component={CommissionOverviewPage} />
      <Route path="/commissions/invoices" component={CommissionInvoicesPage} />
      <Route path="/commissions/sales-reps" component={CommissionSalesRepsPage} />
      <Route path="/commissions/clients" component={CommissionClientsPage} />
      <Route path="/commissions/plans" component={CommissionPlansPage} />
      <Route path="/commissions/calculations" component={CommissionCalculationsPage} />
      <Route path="/commissions/payouts" component={CommissionPayoutsPage} />
      <Route path="/commissions/reports" component={CommissionReportsPage} />
      <Route path="/commissions/settings" component={CommissionSettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function ForecastRoutes() {
  return (
    <Switch>
      <Route path="/forecast" component={ForecastOverviewPage} />
      <Route path="/forecast/revenue" component={RevenueForecastPage} />
      <Route path="/forecast/cash-flow" component={CashFlowForecastPage} />
      <Route path="/forecast/pnl" component={PnlForecastPage} />
      <Route path="/forecast/balance-sheet" component={BalanceSheetForecastPage} />
      <Route path="/forecast/scenarios" component={ForecastScenariosPage} />
      <Route path="/forecast/drivers" component={ForecastDriversPage} />
      <Route path="/forecast/reports" component={ForecastReportsPage} />
      <Route path="/forecast/settings" component={ForecastSettingsPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/login" component={LoginPage} />
      <Route path="/home">
        <ProtectedRoute>
          <HomePage />
        </ProtectedRoute>
      </Route>
      <Route path="/budget/*?">
        <ProtectedRoute>
          <BudgetRoutes />
        </ProtectedRoute>
      </Route>
      <Route path="/analytics/*?">
        <ProtectedRoute>
          <AnalyticsRoutes />
        </ProtectedRoute>
      </Route>
      <Route path="/accounting/*?">
        <ProtectedRoute>
          <AccountingRoutes />
        </ProtectedRoute>
      </Route>
      <Route path="/commissions/*?">
        <ProtectedRoute>
          <CommissionRoutes />
        </ProtectedRoute>
      </Route>
      <Route path="/forecast/*?">
        <ProtectedRoute>
          <ForecastRoutes />
        </ProtectedRoute>
      </Route>
      <Route>
        <ProtectedRoute>
          <AppShell>
            <AppRoutes />
          </AppShell>
          <CommandBar />
        </ProtectedRoute>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
      <AuthProvider>
        <Router />
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;
