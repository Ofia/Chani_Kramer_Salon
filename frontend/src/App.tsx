import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { AuthProvider, useAuth } from './lib/auth'

// Pages
import LoginPage            from './pages/LoginPage'
import BookkeeperLayout     from './pages/bookkeeper/BookkeeperLayout'
import DailyEntryPage       from './pages/bookkeeper/DailyEntryPage'
import PayrollEntryPage     from './pages/bookkeeper/PayrollEntryPage'
import ExpensesPage         from './pages/bookkeeper/ExpensesPage'
import DepositsPage         from './pages/bookkeeper/DepositsPage'
import BookkeeperDashboard  from './pages/bookkeeper/BookkeeperDashboard'
import OwnerLayout          from './pages/owner/OwnerLayout'
import OwnerDashboard       from './pages/owner/OwnerDashboard'
import SimulatorPage        from './pages/owner/SimulatorPage'

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 1000 * 60 * 5 } },
})

// Redirects to /login if not authenticated
function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', fontFamily:'sans-serif' }}>Loading…</div>
  if (!user)   return <Navigate to="/login" replace />
  return <>{children}</>
}

// Owner-only guard
function RequireOwner({ children }: { children: React.ReactNode }) {
  const { profile, loading } = useAuth()
  if (loading) return null
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
            <Navigate to={profile?.role === 'owner' ? '/owner' : '/bookkeeper'} replace />
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
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}
