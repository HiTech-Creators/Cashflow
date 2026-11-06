import { getCurrentUser, type UserRole } from './auth'

export type Permission = 
  | 'view_dashboard'
  | 'view_transactions'
  | 'create_transactions'
  | 'edit_transactions'
  | 'delete_transactions'
  | 'view_cashflow'
  | 'view_forecasting'
  | 'view_analytics'
  | 'view_working_capital'
  | 'view_budgets'
  | 'manage_budgets'
  | 'view_import_export'
  | 'use_import_export'
  | 'view_assistant'
  | 'view_settings'
  | 'manage_companies'
  | 'create_companies'
  | 'edit_companies'
  | 'delete_companies'
  | 'manage_users'
  | 'invite_users'
  | 'invite_company_admins'

export function getRoleLevel(role: UserRole): number {
  switch (role) {
    case 'superadmin':
      return 1
    case 'companyAdmin':
      return 2
    case 'user':
      return 3
    default:
      return 3
  }
}

export function hasPermission(permission: Permission): boolean {
  const user = getCurrentUser()
  if (!user) return false

  const role = user.role
  const roleLevel = getRoleLevel(role)

  if (roleLevel === 1) {
    return true
  }

  const permissions: Record<UserRole, Permission[]> = {
    superadmin: [],
    companyAdmin: [
      'view_dashboard',
      'view_transactions',
      'create_transactions',
      'edit_transactions',
      'delete_transactions',
      'view_cashflow',
      'view_forecasting',
      'view_analytics',
      'view_working_capital',
      'view_budgets',
      'manage_budgets',
      'view_import_export',
      'use_import_export',
      'view_assistant',
      'view_settings',
      'manage_users',
      'invite_users',
    ],
    user: [
      'view_dashboard',
      'view_transactions',
      'create_transactions',
      'edit_transactions',
      'view_cashflow',
      'view_forecasting',
      'view_analytics',
      'view_working_capital',
      'view_budgets',
      'view_assistant',
      'view_settings',
    ],
  }

  return permissions[role]?.includes(permission) ?? false
}

export function canAccessRoute(route: string): boolean {
  const user = getCurrentUser()
  if (!user) return false

  const roleLevel = getRoleLevel(user.role)

  const routePermissions: Record<string, number[]> = {
    '/dashboard': [1, 2, 3],
    '/dashboard/overview': [1, 2, 3],
    '/dashboard/transactions': [1, 2, 3],
    '/dashboard/bank-reconciliation': [1, 2, 3],
    '/dashboard/drawings': [1, 2, 3],
    '/dashboard/salary-expenses': [1, 2, 3],
    '/dashboard/cashflow': [1, 2, 3],
    '/dashboard/forecasting': [1, 2, 3],
    '/dashboard/analytics': [1, 2, 3],
    '/dashboard/assistant': [1, 2, 3],
    '/dashboard/working-capital': [1, 2, 3],
    '/dashboard/receivables': [1, 2, 3],
    '/dashboard/payables': [1, 2, 3],
    '/dashboard/inventory': [1, 2, 3],
    '/dashboard/budgets': [1, 2, 3],
    '/dashboard/invoices': [1, 2, 3],
    '/dashboard/bug-reports': [1, 2, 3],
    '/dashboard/settings': [1, 2, 3],
    '/dashboard/import-export': [1, 2],
    '/dashboard/companies': [1],
    '/dashboard/users': [1, 2],
  }

  const allowedLevels = routePermissions[route] || []
  return allowedLevels.includes(roleLevel)
}

export function isSuperAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'superadmin'
}

export function isCompanyAdmin(): boolean {
  const user = getCurrentUser()
  return user?.role === 'companyAdmin'
}

export function isUser(): boolean {
  const user = getCurrentUser()
  return user?.role === 'user'
}

export function canManageCompanies(): boolean {
  return hasPermission('manage_companies')
}

export function canManageUsers(): boolean {
  return hasPermission('manage_users')
}

export function canInviteUsers(): boolean {
  return hasPermission('invite_users')
}

export function canInviteCompanyAdmins(): boolean {
  return hasPermission('invite_company_admins')
}

