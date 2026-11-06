import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import Privacy from './pages/Privacy.tsx'
import Login from './pages/Login.tsx'
import Signup from './pages/Signup.tsx'
import CreateSuperAdmin from './pages/CreateSuperAdmin.tsx'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import RootLayout from './components/layout/RootLayout.tsx'
import RequireAuth from './components/RequireAuth.tsx'
import RequireRole from './components/RequireRole.tsx'
import DashboardLayout from './components/layout/DashboardLayout.tsx'
import Overview from './pages/dashboard/Overview.tsx'
import Transactions from './pages/dashboard/Transactions.tsx'
import CashFlow from './pages/dashboard/CashFlow.tsx'
import Forecasting from './pages/dashboard/Forecasting.tsx'
import Analytics from './pages/dashboard/Analytics.tsx'
import WorkingCapital from './pages/dashboard/WorkingCapital.tsx'
import Receivables from './pages/dashboard/Receivables.tsx'
import Payables from './pages/dashboard/Payables.tsx'
import Inventory from './pages/dashboard/Inventory.tsx'
import Budgets from './pages/dashboard/Budgets.tsx'
import ImportExport from './pages/dashboard/ImportExport.tsx'
import Companies from './pages/dashboard/Companies.tsx'
import Users from './pages/dashboard/Users.tsx'
import Assistant from './pages/dashboard/Assistant.tsx'
import Settings from './pages/dashboard/Settings.tsx'
import BankReconciliation from './pages/dashboard/BankReconciliation.tsx'
import Drawings from './pages/dashboard/Drawings.tsx'
import SalaryExpenses from './pages/dashboard/SalaryExpenses.tsx'
import Invoices from './pages/dashboard/Invoices.tsx'
import BugReports from './pages/dashboard/BugReports.tsx'

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      { path: '/', element: <App /> },
      { path: '/privacy', element: <Privacy /> },
      { path: '/login', element: <Login /> },
      { path: '/signup', element: <Signup /> },
      { path: '/register', element: <Signup /> },
      { path: '/create-superadmin', element: <CreateSuperAdmin /> },
    ],
  },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/dashboard',
        element: <DashboardLayout />,
        children: [
          { index: true, element: <RequireRole route="/dashboard"><Overview /></RequireRole> },
          { path: 'transactions', element: <RequireRole route="/dashboard/transactions"><Transactions /></RequireRole> },
          { path: 'cashflow', element: <RequireRole route="/dashboard/cashflow"><CashFlow /></RequireRole> },
          { path: 'forecasting', element: <RequireRole route="/dashboard/forecasting"><Forecasting /></RequireRole> },
          { path: 'analytics', element: <RequireRole route="/dashboard/analytics"><Analytics /></RequireRole> },
          { path: 'assistant', element: <RequireRole route="/dashboard/assistant"><Assistant /></RequireRole> },
          { path: 'working-capital', element: <RequireRole route="/dashboard/working-capital"><WorkingCapital /></RequireRole> },
          { path: 'receivables', element: <RequireRole route="/dashboard/receivables"><Receivables /></RequireRole> },
          { path: 'payables', element: <RequireRole route="/dashboard/payables"><Payables /></RequireRole> },
          { path: 'inventory', element: <RequireRole route="/dashboard/inventory"><Inventory /></RequireRole> },
          { path: 'budgets', element: <RequireRole route="/dashboard/budgets"><Budgets /></RequireRole> },
          { path: 'invoices', element: <RequireRole route="/dashboard/invoices"><Invoices /></RequireRole> },
          { path: 'import-export', element: <RequireRole route="/dashboard/import-export"><ImportExport /></RequireRole> },
          { path: 'bug-reports', element: <RequireRole route="/dashboard/bug-reports"><BugReports /></RequireRole> },
          { path: 'bank-reconciliation', element: <RequireRole route="/dashboard/bank-reconciliation"><BankReconciliation /></RequireRole> },
          { path: 'drawings', element: <RequireRole route="/dashboard/drawings"><Drawings /></RequireRole> },
          { path: 'salary-expenses', element: <RequireRole route="/dashboard/salary-expenses"><SalaryExpenses /></RequireRole> },
          { path: 'settings', element: <RequireRole route="/dashboard/settings"><Settings /></RequireRole> },
          { path: 'companies', element: <RequireRole route="/dashboard/companies"><Companies /></RequireRole> },
          { path: 'users', element: <RequireRole route="/dashboard/users"><Users /></RequireRole> },
        ],
      },
    ],
  },
])

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster
        position="bottom-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 3000,
            iconTheme: {
              primary: '#10B981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 5000,
            iconTheme: {
              primary: '#EF4444',
              secondary: '#fff',
            },
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
