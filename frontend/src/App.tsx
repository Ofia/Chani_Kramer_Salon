import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'
import { ViewingAsProvider } from './lib/viewingAs'
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
import DailyEntryPage       from './pages/bookkeeper/DailyEntryPage'
import PayrollEntryPage     from './pages/bookkeeper/PayrollEntryPage'
import ExpensesPage         from './pages/bookkeeper/ExpensesPage'
import DepositsPage         from './pages/bookkeeper/DepositsPage'
import WigOrdersPage        from './pages/bookkeeper/WigOrdersPage'
import EmployeesPage        from './pages/bookkeeper/EmployeesPage'
import CustomersPage        from './pages/bookkeeper/CustomersPage'
import HelloBoardPage       from './pages/bookkeeper/HelloBoardPage'
import OwnerLayout          from './pages/owner/OwnerLayout'
import OwnerDashboard       from './pages/owner/OwnerDashboard'
import SimulatorPage        from './pages/owner/SimulatorPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

// Redirects to /login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif' }}>Loading…</div>
  if (!user && !profile) return <Navigate to="/login" replace />
  return <>{children}</>
}

// Owner-only guard
function RequireOwner({ children }: { children: React.ReactNode }) {
  const { user, profile, loading } = useAuth()
  // Still waiting for initial session check OR user is logged in but profile hasn't arrived yet
  if (loading || (user && !profile)) return null
  if (profile?.role !== 'owner') return <Navigate to="/bookkeeper" replace />
  return <>{children}</>
}

function AppRoutes() {
  const { profile } = useAuth()

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/"
        element={
          <RequireAuth>
            <Navigate to={profile?.role === 'owner' ? '/owner' : '/bookkeeper/hello'} replace />
          </RequireAuth>
        }
      />

      {/* Bookkeeper routes — both roles can access */}
      <Route path="/bookkeeper" element={<RequireAuth><BookkeeperLayout /></RequireAuth>}>
        <Route index          element={<BookkeeperDashboard />} />
        <Route path="daily"   element={<DailyEntryPage />} />
        <Route path="payroll" element={<PayrollEntryPage />} />
        <Route path="expenses"element={<ExpensesPage />} />
        <Route path="deposits"element={<DepositsPage />} />
        <Route path="wigs"       element={<WigOrdersPage />} />
        <Route path="employees"  element={<EmployeesPage />} />
        <Route path="customers"  element={<CustomersPage />} />
        <Route path="hello"      element={<HelloBoardPage />} />
        <Route path="main-board" element={<OwnerDashboard />} />
      </Route>

      {/* Owner routes — owner only */}
      <Route path="/owner" element={<RequireAuth><RequireOwner><OwnerLayout /></RequireOwner></RequireAuth>}>
        <Route index           element={<OwnerDashboard />} />
        <Route path="simulate" element={<SimulatorPage />} />
      </Route>
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ViewingAsProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <AppRoutes />
            </ErrorBoundary>
          </BrowserRouter>
        </ViewingAsProvider>
      </AuthProvider>
    </QueryClientProvider>
  )
}
