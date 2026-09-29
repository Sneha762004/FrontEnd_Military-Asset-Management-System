import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AppLayout, RequirePermission } from './components/AppLayout';
import { Spinner } from './components/Modal';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { PurchasesPage } from './pages/PurchasesPage';
import { TransfersPage } from './pages/TransfersPage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { ExpendituresPage } from './pages/ExpendituresPage';
import { LedgerPage } from './pages/LedgerPage';
import { UsersPage } from './pages/UsersPage';
import { AuditPage } from './pages/AuditPage';
import { NotFoundPage } from './pages/NotFoundPage';

export function App() {
  const { user, initialising } = useAuth();

  if (initialising) {
    return (
      <div className="flex min-h-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-ink-400">
          <Spinner className="h-6 w-6" />
          <p className="text-sm">Restoring your session&hellip;</p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginPage />;

  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<DashboardPage />} />
        <Route path="ledger" element={<LedgerPage />} />
        <Route
          path="purchases"
          element={
            <RequirePermission permission="purchase:read">
              <PurchasesPage />
            </RequirePermission>
          }
        />
        <Route
          path="transfers"
          element={
            <RequirePermission permission="transfer:read">
              <TransfersPage />
            </RequirePermission>
          }
        />
        <Route
          path="assignments"
          element={
            <RequirePermission permission="assignment:read">
              <AssignmentsPage />
            </RequirePermission>
          }
        />
        <Route
          path="expenditures"
          element={
            <RequirePermission permission="expenditure:read">
              <ExpendituresPage />
            </RequirePermission>
          }
        />
        <Route
          path="users"
          element={
            <RequirePermission permission="user:read">
              <UsersPage />
            </RequirePermission>
          }
        />
        <Route
          path="audit"
          element={
            <RequirePermission permission="audit:read">
              <AuditPage />
            </RequirePermission>
          }
        />
        <Route path="404" element={<NotFoundPage />} />
        <Route path="*" element={<Navigate to="/404" replace />} />
      </Route>
    </Routes>
  );
}
