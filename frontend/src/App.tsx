import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { Component, type ReactNode } from 'react'

class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() {
    if (this.state.error) {
      const e = this.state.error as Error
      return (
        <div style={{ padding: 40, fontFamily: 'monospace' }}>
          <h2 style={{ color: '#DF5198' }}>Something crashed</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{e.message}</pre>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11, color: '#777' }}>{e.stack}</pre>
          <button onClick={() => this.setState({ error: null })} style={{ marginTop: 16 }}>Try again</button>
        </div>
      )
    }
    return this.props.children
  }
}

// Pages
import LoginPage            from './pages/LoginPage'
import BookkeeperLayout     from './pages/bookkeeper/BookkeeperLayout'
import BookkeeperDashboard  from './pages/bookkeeper/BookkeeperDashboard'

import PayrollEntryPage     from './pages/bookkeeper/PayrollEntryPage'
import ExpensesPage         from './pages/bookkeeper/ExpensesPage'
import DepositsPage         from './pages/bookkeeper/DepositsPage'
import WigOrdersPage        from './pages/bookkeeper/WigOrdersPage'
import SalesManagementPage  from './pages/bookkeeper/SalesManagementPage'
import POSPage              from './pages/bookkeeper/POSPage'
import EmployeesPage        from './pages/bookkeeper/EmployeesPage'
import CustomersPage        from './pages/bookkeeper/CustomersPage'
import HelloBoardPage       from './pages/bookkeeper/HelloBoardPage'
import OwnerDashboard            from './pages/owner/OwnerDashboard'
import InventoryPage             from './pages/bookkeeper/InventoryPage'
import ProvidersPage             from './pages/bookkeeper/ProvidersPage'
import OperationOverviewPage     from './pages/bookkeeper/OperationOverviewPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif' }}>Loading…</div>
  if (!user && !profile) return <Navigate to="/login" replace />
  return <>{children}</>
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RequireAuth><Navigate to="/bookkeeper/hello" replace /></RequireAuth>} />

      <Route path="/bookkeeper" element={<RequireAuth><BookkeeperLayout /></RequireAuth>}>
        <Route index            element={<BookkeeperDashboard />} />
        <Route path="hello"     element={<HelloBoardPage />} />
        <Route path="pos"       element={<POSPage />} />
        <Route path="daily"     element={<Navigate to="/bookkeeper/overview" replace />} />
        <Route path="overview"  element={<OperationOverviewPage />} />
        <Route path="payroll"   element={<PayrollEntryPage />} />
        <Route path="expenses"  element={<ExpensesPage />} />
        <Route path="deposits"  element={<DepositsPage />} />
        <Route path="wigs"      element={<WigOrdersPage />} />
        <Route path="sales"     element={<SalesManagementPage />} />
        <Route path="providers" element={<ProvidersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="employees" element={<EmployeesPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="main-board" element={<OwnerDashboard />} />
      </Route>

      {/* Catch-all: anything unknown → hello board */}
      <Route path="*" element={<Navigate to="/bookkeeper/hello" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <ErrorBoundary>
            <AppRoutes />
          </ErrorBoundary>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
