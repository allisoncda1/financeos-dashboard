import { Switch, Route, Router as WouterRouter } from "wouter";
import { AppShell } from "@/components/layout/AppShell";
import { CommandBar } from "@/components/layout/CommandBar";
import NotFound from "@/pages/not-found";
import LoginPage from "@/pages/login";
import HomePage from "@/pages/home";
import { AuthProvider } from "@/lib/auth";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";

import PortfolioPage from "@/pages/portfolio";
import CashFlowPage from "@/pages/analyze/cashflow";
import ConsolidatedPage from "@/pages/analyze/consolidated";
import HistoryPage from "@/pages/analyze/history";
import PerformancePage from "@/pages/analyze/performance";
import IntegrityPage from "@/pages/control/integrity";
import SettingsPage from "@/pages/control/settings";
import ValidationPage from "@/pages/control/validation";
import OperationsPage from "@/pages/operations";
import ReportsPage from "@/pages/reports";
import EntityPage from "@/pages/entity/dashboard";
import EntityBankingPage from "@/pages/entity/banking";
import EntityCustomersPage from "@/pages/entity/customers";
import EntityFinancialsPage from "@/pages/entity/financials";
import EntityReportsPage from "@/pages/entity/reports";
import EntityVendorsPage from "@/pages/entity/vendors";
import BudgetDashboardPage from "@/pages/budget/dashboard";

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={PortfolioPage} />
      <Route path="/analyze/cashflow" component={CashFlowPage} />
      <Route path="/analyze/consolidated" component={ConsolidatedPage} />
      <Route path="/analyze/history" component={HistoryPage} />
      <Route path="/analyze/performance" component={PerformancePage} />
      <Route path="/control/integrity" component={IntegrityPage} />
      <Route path="/control/settings" component={SettingsPage} />
      <Route path="/control/validation" component={ValidationPage} />
      <Route path="/operations" component={OperationsPage} />
      <Route path="/reports" component={ReportsPage} />
      <Route path="/entity/:slug" component={EntityPage} />
      <Route path="/entity/:slug/banking" component={EntityBankingPage} />
      <Route path="/entity/:slug/customers" component={EntityCustomersPage} />
      <Route path="/entity/:slug/financials" component={EntityFinancialsPage} />
      <Route path="/entity/:slug/reports" component={EntityReportsPage} />
      <Route path="/entity/:slug/vendors" component={EntityVendorsPage} />
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
      <Route path="/budget">
        <ProtectedRoute>
          <BudgetDashboardPage />
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
