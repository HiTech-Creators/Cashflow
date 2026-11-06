import axios, { AxiosError } from 'axios';
import toast from 'react-hot-toast';

// Base API configuration
const API_BASE_URL = "https://web-production-ce9f4.up.railway.app"
const ENABLE_LOGS = String(import.meta.env.VITE_ENABLE_LOGS).toLowerCase() === 'true';

export const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add auth token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  if (ENABLE_LOGS) {
    try {
      // eslint-disable-next-line no-console
      console.debug('API Request:', {
        method: config.method,
        url: `${config.baseURL ?? ''}${config.url ?? ''}`,
        params: config.params,
        data: config.data,
      });
    } catch {
      // ignore logging errors
    }
  }

  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => {
    if (ENABLE_LOGS) {
      try {
        // eslint-disable-next-line no-console
        console.debug('API Response:', {
          url: response.config?.url,
          status: response.status,
          data: response.data,
        });
      } catch {
        // ignore logging errors
      }
    }
    return response;
  },
  (error: AxiosError) => {
    if (ENABLE_LOGS) {
      try {
        // eslint-disable-next-line no-console
        console.error('API Error:', {
          url: error.config?.url,
          status: error.response?.status,
          data: (error.response as any)?.data,
          message: error.message,
        });
      } catch {
        // ignore logging errors
      }
    }

    // Friendly toast for rate limiting
    if (error.response?.status === 429) {
      // Throttle to avoid toast spam
      const now = Date.now();
      if (!(window as any).__last_rate_limit_toast || now - (window as any).__last_rate_limit_toast > 3000) {
        const details = (error.response.data as any)?.details || 'Too many requests. Please try again shortly.';
        toast.error(details);
        (window as any).__last_rate_limit_toast = now;
      }
    }

    // Handle common errors
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      localStorage.removeItem('novatech_auth_user');
      localStorage.removeItem('default_company_id');
      window.location.href = '/login';
    }

    // Friendly default errors
    const status = error.response?.status ?? 0
    const serverMessage = (error.response as any)?.data?.message || (error.response as any)?.data?.error
    if (status >= 500) {
      toast.error(serverMessage || 'Something went wrong on the server. Please try again later.')
    } else if (status >= 400 && status !== 401 && status !== 429) {
      toast.error(serverMessage || 'Request failed. Please check your input and try again.')
    } else if (!status) {
      toast.error('Network error. Please check your connection and try again.')
    }
    return Promise.reject(error);
  }
);

// ====================
// Type Definitions
// ====================

export interface ApiError {
  message: string;
  status?: number;
}

// Authentication Types
export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  default_company_id?: string;
  user?: {
    id: string;
    username: string;
    email?: string;
    role: string;
  };
}

export interface RegisterRequest {
  username: string;
  password: string;
  invitation_token: string;
}

export interface RegisterResponse {
  message: string;
  user?: {
    id: string;
    username: string;
    email?: string;
  };
}

export interface CreateSuperAdminRequest {
  username: string;
  email: string;
  password: string;
}

// User Types
export interface User {
  id: string;
  username: string;
  email: string;
  role: 'superadmin' | 'companyAdmin' | 'user';
  is_active: boolean;
  created_at: string;
  companies?: Array<{
    id: string;
    name: string;
    role: string;
  }>;
}

export interface InviteUserRequest {
  email: string;
  role: 'user' | 'companyAdmin';
}

export interface CreateCompanyAdminRequest {
  username: string;
  email: string;
  password: string;
}

// Company Types
export interface Company {
  id: string;
  name: string;
  currency: string;
  created_by: string;
  user_count: number;
  created_at: string;
}

export interface CreateCompanyRequest {
  name: string;
  currency: string;
}

export interface UpdateCompanyRequest {
  name?: string;
  currency?: string;
}

// Transaction Types
export interface Transaction {
  id: string;
  company_id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  currency: string;
  created_at: string;
  enhanced_description?: string;
}

export interface CreateTransactionRequest {
  company_id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  currency: string;
}

export interface UpdateTransactionRequest {
  date?: string;
  description?: string;
  amount?: number;
  type?: 'inflow' | 'outflow';
  category?: string;
  currency?: string;
}

export interface TransactionsListResponse {
  transactions: Transaction[];
  pagination: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

// Forecasting Types
export interface Forecast {
  id: string;
  company_id: string;
  months: number;
  type: 'manual' | 'ai';
  scenario_name: string;
  scenario_params: Record<string, any>;
  created_at: string;
  results?: any;
}

export interface CreateForecastRequest {
  company_id: string;
  months: number;
  type: 'manual' | 'ai';
  scenario_name: string;
  scenario_params: Record<string, any>;
}

// Invoices Types
export type InvoiceStatus = 'draft' | 'sent' | 'paid' | 'overdue'

export interface InvoiceLineItem {
  description: string
  quantity: number
  rate: number
  amount: number
}

export interface InvoiceTemplate {
  id: string
  company_id: string
  template_name: string
  default_due_days?: number
  default_tax_rate?: number
  line_items_template?: InvoiceLineItem[]
  auto_generate?: boolean
  generation_frequency?: string
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface Invoice {
  id: string
  company_id: string
  invoice_number?: string
  customer_name: string
  customer_email?: string
  status: InvoiceStatus
  issue_date?: string
  due_date?: string
  subtotal?: number
  tax_rate?: number
  tax_amount?: number
  total_amount?: number
  line_items?: InvoiceLineItem[]
  created_at?: string
  updated_at?: string
}

export interface InvoicesListResponse {
  invoices: Invoice[]
  page: number
  per_page: number
  total: number
  pages: number
}

export interface InvoiceSummary {
  total_invoices: number
  by_status: Record<string, { count: number; total: number }>
  total_outstanding: number
  total_paid: number
  company_id?: string
}

// Dashboard Types
export interface DashboardKPIs {
  net_cash: number;
  current_balance: number;
  current_ratio: number | string;
  burn_rate: number;
  runway: number | null;
  inflows?: number;
  outflows?: number;
  company_id?: string;
}

// Working Capital Types
export interface Receivable {
  id: string;
  company_id: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'overdue' | 'paid';
  description?: string;
}

export interface Payable {
  id: string;
  company_id: string;
  amount: number;
  due_date: string;
  status: 'pending' | 'overdue' | 'paid';
  description?: string;
}

export interface InventoryItem {
  id: string;
  company_id: string;
  item_name: string;
  quantity: number;
  unit_cost: number;
  total_value: number;
  last_updated: string;
}

export interface CreateReceivableRequest {
  company_id: string;
  amount: number;
  due_date: string; // ISO format
  status?: 'pending' | 'overdue' | 'paid';
  description?: string;
}

export interface UpdateReceivableRequest {
  company_id: string;
  amount?: number;
  due_date?: string; // ISO format
  status?: 'pending' | 'overdue' | 'paid';
  description?: string;
}

export interface CreatePayableRequest {
  company_id: string;
  amount: number;
  due_date: string; // ISO format
  status?: 'pending' | 'overdue' | 'paid';
  description?: string;
}

export interface UpdatePayableRequest {
  company_id: string;
  amount?: number;
  due_date?: string; // ISO format
  status?: 'pending' | 'overdue' | 'paid';
  description?: string;
}

export interface CreateInventoryRequest {
  company_id: string;
  item_name: string;
  quantity: number;
  value: number;
}

export interface UpdateInventoryRequest {
  company_id: string;
  item_name?: string;
  quantity?: number;
  value?: number;
}

export interface AgingReport {
  '0-30': number;
  '31-60': number;
  '61-90': number;
  '90+': number;
}

// Budgeting Types
export interface Budget {
  id: string;
  company_id: string;
  category: string;
  amount: number;
  period: string; // YYYY-MM format
  spent: number;
  remaining: number;
  created_at: string;
}

export interface CreateBudgetRequest {
  company_id: string;
  category: string;
  amount: number;
  period: string;
}

export interface UpdateBudgetRequest {
  company_id: string;
  category?: string;
  amount?: number;
  period?: string;
}

export interface BudgetVariance {
  category: string;
  budgeted: number;
  actual: number;
  variance: number;
  variance_percentage: number;
}

// AI Features Types
export interface AICategorizeRequest {
  description: string;
  amount: number;
  merchant?: string;
}

export interface AICategorizeResponse {
  category: string;
  confidence: number;
  suggested_category: string;
}

export interface Anomaly {
  id: string;
  transaction_id: string;
  description: string;
  amount: number;
  anomaly_type: 'unusual_amount' | 'unusual_category' | 'duplicate' | 'outlier';
  severity: 'low' | 'medium' | 'high';
  detected_at: string;
}

export interface AIChatRequest {
  query: string;
  company_id: string;
}

export interface AIChatResponse {
  response?: string | {
    answer: string;
    data?: Record<string, unknown>;
    follow_up_questions?: string[];
    insights?: string[];
    action?: Record<string, unknown>;
  };
  answer?: string; // For backward compatibility
  insights?: string[];
  recommendations?: string[];
  follow_up_questions?: string[];
  data?: Record<string, unknown>;
  action?: Record<string, unknown>;
  company_id?: string;
}

export interface AIInsight {
  id: string;
  type: 'trend' | 'anomaly' | 'opportunity' | 'risk';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  generated_at: string;
}

export interface EnhanceDescriptionRequest {
  apply: boolean;
}

// File Operations Types
export interface UploadResponse {
  message: string;
  processed_count: number;
  errors?: string[];
}

export interface UploadInfo {
  message?: string;
  [key: string]: unknown;
}

export interface ExportResponse {
  download_url: string;
  filename: string;
}

// Financial Analysis Types
export interface SetInitialBalanceRequest {
  company_id: string;
  initial_balance: number;
}

export interface BalanceByDateRequest {
  company_id: string;
  date: string;
}

export interface CashOverview {
  operating_cash_flow: number;
  investing_cash_flow: number;
  financing_cash_flow: number;
  burn_rate: number;
  runway_months: number;
  current_balance: number;
}

export interface CashActivity {
  id: string;
  date: string;
  description: string;
  amount: number;
  type: 'inflow' | 'outflow';
  category: string;
  balance_after: number;
}

export interface MonthlyBalance {
  month: string;
  starting_balance: number;
  ending_balance: number;
  net_flow: number;
}

export interface MonthlyIncomeExpense {
  month: string;
  income: number;
  expenses: number;
  net: number;
}

export interface CashoutByCategory {
  category: string;
  amount: number;
  percentage: number;
}

// Reports & Forecasting Types
export interface CashFlowStatementData {
  operating_activities: {
    'Cash-customer': number;
    'Salary-suppliers': number;
    'Income-tax': number;
    'Other-cfo': number;
  };
  investing_activities: {
    'Buy-property-equipments': number;
    'Sell-property-equipments': number;
    'Buy-investment': number;
    'Sell-investment': number;
    'Other-cfi': number;
  };
  financing_activities: {
    'Issue-shares': number;
    'borrowings': number;
    'Repay-borrowings': number;
    'Pay-dividends': number;
    'Interest-paid': number;
    'Other-cff': number;
  };
}

export interface AIForecastResponse {
  forecast: Array<{
    month: string;
    predicted_inflows: number;
    predicted_outflows: number;
    confidence: number;
  }>;
  patterns: string[];
  risks: string[];
  recommendations: string[];
}

// User Settings Types
export interface UserSettings {
  theme: 'light' | 'dark';
  notifications: {
    email: boolean;
    push: boolean;
  };
  modules: string[];
  default_currency: string;
}

export interface UpdateProfileRequest {
  username?: string;
  email?: string;
}

export interface ChangePasswordRequest {
  current_password: string;
  new_password: string;
  confirm_password: string;
}

export interface UpdateModulesRequest {
  modules: string[];
}

// Bank Reconciliation Types
export type ReconciliationItemStatus = 'matched' | 'unmatched' | 'pending'

export interface BankStatementListItem {
  id: string
  bank_name: string
  account_number: string
  statement_date: string | null
  opening_balance: number
  closing_balance: number
  created_at?: string | null
}

export interface BankStatementListResponse {
  statements: BankStatementListItem[]
  total: number
  page: number
  per_page: number
  pages: number
  company_id: string
}

export interface BankStatementItem {
  id: string
  date: string | null
  description: string
  amount: number
  reference?: string | null
  status?: ReconciliationItemStatus
  matched_transaction?: {
    id: string
    description: string
    amount: number
  } | null
  reconciled_at?: string | null
}

export interface BankStatementDetailResponse {
  id: string
  bank_name: string
  account_number: string
  statement_date: string
  opening_balance: number
  closing_balance: number
  created_at?: string | null
  items: BankStatementItem[]
  items_count: number
}

export interface CreateBankStatementRequest {
  bank_name: string
  account_number: string
  statement_date: string
  opening_balance: number
  closing_balance: number
  items?: Array<{
    date?: string
    description: string
    amount: number
    reference?: string
  }>
}

export interface AutoMatchResponse {
  message: string
  matched_count: number
  unmatched_count: number
  matches: Array<Record<string, unknown>>
  errors: Array<Record<string, unknown> | string>
}

export interface ReconciliationStatusResponse {
  statement?: Record<string, unknown>
  summary?: Record<string, unknown>
  totals?: Record<string, unknown>
  discrepancies?: Array<Record<string, unknown>>
  error?: string
}

export interface PotentialMatchesResponse {
  item: {
    id: string
    date: string | null
    description: string
    amount: number
  }
  potential_matches: Array<{
    id: string
    date?: string
    description?: string
    amount?: number
    score?: number
  }>
  count: number
}

// Drawings / Equity Types
export type DrawingCategory = 'personal' | 'equity' | 'loan'

export interface Drawing {
  id: string
  owner: { id: string; username: string }
  date: string | null
  description: string
  amount: number
  category: DrawingCategory
  transaction_id?: string | null
  created_at?: string | null
}

export interface DrawingsListResponse {
  drawings: Drawing[]
  total: number
  total_amount: number
  page: number
  per_page: number
  pages: number
  company_id: string
}

export interface CreateDrawingRequest {
  owner_id: string
  date: string
  description: string
  amount: number
  category?: DrawingCategory
  create_transaction?: boolean
}

export interface EquityAccount {
  id: string
  owner: { id: string; username: string }
  opening_balance: number
  current_balance: number
  total_drawings: number
  total_contributions: number
  updated_at?: string | null
}

export interface EquityAccountsResponse {
  equity_accounts: EquityAccount[]
  company_id: string
}

export interface EquitySummaryResponse {
  owner: { id: string; username: string }
  equity_account: {
    opening_balance: number
    current_balance: number
    total_drawings: number
    total_contributions: number
  }
  drawings_by_category: Record<string, number>
  recent_drawings: Array<{
    id: string
    date: string | null
    description: string
    amount: number
    category: string
  }>
  company_id: string
}

export interface UpdateEquityAccountRequest {
  opening_balance?: number
  contribution?: number
}

// Salary / Expenses Types
export type EmployeeStatus = 'active' | 'inactive'
export type SalaryFrequency = 'hourly' | 'weekly' | 'biweekly' | 'monthly' | 'annual'
export type SalaryPaymentStatus = 'pending' | 'paid' | 'cancelled'
export type ExpenseAccountType = 'salary' | 'rent' | 'utilities' | 'supplies' | 'travel' | 'marketing' | 'insurance' | 'other'

export interface Employee {
  id: string
  employee_id?: string | null
  first_name: string
  last_name: string
  full_name?: string
  email: string
  position?: string | null
  department?: string | null
  salary_amount: number
  salary_frequency: SalaryFrequency
  status: EmployeeStatus
  hire_date?: string | null
}

export interface EmployeesListResponse {
  employees: Employee[]
  total: number
  page: number
  per_page: number
  pages: number
  company_id: string
}

export interface CreateEmployeeRequest {
  first_name: string
  last_name: string
  email: string
  employee_id?: string
  position?: string
  department?: string
  salary_amount: number
  salary_frequency?: SalaryFrequency
  hire_date?: string
}

export interface UpdateEmployeeRequest {
  first_name?: string
  last_name?: string
  email?: string
  employee_id?: string
  position?: string
  department?: string
  salary_amount?: number
  salary_frequency?: SalaryFrequency
  status?: EmployeeStatus
  hire_date?: string
  termination_date?: string
}

export interface SalaryPayment {
  id: string
  employee: { id: string; full_name: string }
  pay_period_start: string | null
  pay_period_end: string | null
  payment_date: string | null
  gross_amount: number
  tax_amount: number
  other_deductions: number
  net_amount: number
  status: SalaryPaymentStatus
}

export interface SalaryPaymentsListResponse {
  payments: SalaryPayment[]
  total: number
  summary?: { total_gross_paid?: number; total_net_paid?: number }
  page: number
  per_page: number
  pages: number
  company_id: string
}

export interface CreateSalaryPaymentRequest {
  employee_id: string
  pay_period_start: string
  pay_period_end: string
  payment_date: string
  gross_amount: number
  tax_amount?: number
  other_deductions?: number
  deduction_details?: Array<{ name: string; amount: number }>
  notes?: string
  create_transaction?: boolean
}

export interface ExpenseAccount {
  id: string
  account_code: string
  account_name: string
  description?: string | null
  account_type: ExpenseAccountType
  parent_account_id?: string | null
  is_active: boolean
}

export interface ExpenseAccountsResponse {
  expense_accounts: ExpenseAccount[]
  total: number
  company_id: string
}

export interface CreateExpenseAccountRequest {
  account_code: string
  account_name: string
  description?: string
  account_type?: ExpenseAccountType
  parent_account_id?: string | null
}

export interface UpdateExpenseAccountRequest {
  account_code?: string
  account_name?: string
  description?: string
  account_type?: ExpenseAccountType
  parent_account_id?: string | null
  is_active?: boolean
}

// System Health Types
export interface HealthCheckResponse {
  status: 'healthy' | 'unhealthy';
  database: boolean;
  redis: boolean;
  timestamp: string;
  uptime: number;
}

// ====================
// API Functions
// ====================

// Helper function for error handling
const handleApiError = (error: any, defaultMessage: string): never => {
  if (axios.isAxiosError(error) && error.response) {
    throw {
      message: error.response.data?.message || defaultMessage,
      status: error.response.status,
    } as ApiError;
  }
  throw {
    message: 'Network error. Please check your connection.',
    status: 0,
  } as ApiError;
};

// Authentication API
export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    try {
      const response = await api.post<LoginResponse>('/auth/login', credentials);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Login failed');
    }
  },

  register: async (userData: RegisterRequest): Promise<RegisterResponse> => {
    try {
      const response = await api.post<RegisterResponse>('/auth/register', userData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Registration failed');
    }
  },

  createSuperAdmin: async (adminData: CreateSuperAdminRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post('/auth/create-superadmin', adminData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to create super admin');
    }
  },
};

// Company Management API
export const companyApi = {
  createCompany: async (companyData: CreateCompanyRequest): Promise<Company> => {
    try {
      const response = await api.post<Company>('/api/companies', companyData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to create company');
    }
  },

  getUserCompanies: async (): Promise<Company[]> => {
    try {
      const response = await api.get('/api/companies');
      return Array.isArray(response.data?.companies) ? response.data.companies : [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch user companies');
    }
  },

  getCompanyDetails: async (companyId: string): Promise<Company> => {
    try {
      const response = await api.get<Company>(`/api/companies/${companyId}`);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch company details');
    }
  },

  updateCompany: async (companyId: string, companyData: UpdateCompanyRequest): Promise<Company> => {
    try {
      const response = await api.put<Company>(`/api/companies/${companyId}`, companyData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to update company');
    }
  },

  deleteCompany: async (companyId: string): Promise<void> => {
    try {
      await api.delete(`/api/companies/${companyId}`);
    } catch (error) {
      return handleApiError(error, 'Failed to delete company');
    }
  },

  getAllCompanies: async (): Promise<Company[]> => {
    try {
      const response = await api.get('/api/admin/companies');
      const adminCompanies = Array.isArray(response.data?.companies) ? response.data.companies : [];

      // For superadmin, also try to get user companies to include any additional ones
      let userCompanies: Company[] = [];
      try {
        const userResponse = await api.get('/api/companies');
        userCompanies = Array.isArray(userResponse.data?.companies) ? userResponse.data.companies : [];
      } catch {
        // Ignore error for user companies, admin companies are primary
      }

      // Combine and deduplicate by ID
      const allCompanies = [...adminCompanies];
      userCompanies.forEach(company => {
        if (!allCompanies.some(c => c.id === company.id)) {
          allCompanies.push(company);
        }
      });

      return allCompanies;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch all companies');
    }
  },
};

// User Management API
export const userApi = {
  inviteUser: async (companyId: string, inviteData: InviteUserRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/invite`, inviteData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to invite user');
    }
  },

  getCompanyUsers: async (companyId: string): Promise<User[]> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/users`);
      return response.data.users || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch company users');
    }
  },

  createCompanyAdmin: async (companyId: string, adminData: CreateCompanyAdminRequest): Promise<User> => {
    try {
      const response = await api.post<User>(`/api/companies/${companyId}/create-admin`, adminData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to create company admin');
    }
  },

  getAllUsers: async (): Promise<User[]> => {
    try {
      const response = await api.get('/api/admin/users');
      return response.data.users || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch all users');
    }
  },
};

// Transactions API
export const transactionApi = {
  createTransaction: async (transactionData: CreateTransactionRequest): Promise<Transaction> => {
    try {
      const response = await api.post<Transaction>('/api/transactions', transactionData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to create transaction');
    }
  },

  getTransactions: async (companyId: string, page = 1, perPage = 10): Promise<TransactionsListResponse> => {
    try {
      const response = await api.get<TransactionsListResponse>('/api/transactions', {
        params: { company_id: companyId, page, per_page: perPage }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch transactions');
    }
  },

  getTransactionDetails: async (transactionId: string, companyId: string): Promise<Transaction> => {
    try {
      const response = await api.get<Transaction>(`/api/edit/${transactionId}`, {
        params: { company_id: companyId }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch transaction details');
    }
  },

  updateTransaction: async (transactionId: string, companyId: string, transactionData: UpdateTransactionRequest): Promise<Transaction> => {
    try {
      const response = await api.post<Transaction>(`/api/edit/${transactionId}`, transactionData, {
        params: { company_id: companyId }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to update transaction');
    }
  },

  deleteTransaction: async (transactionId: string, companyId: string): Promise<void> => {
    try {
      await api.post(`/api/delete/${transactionId}`, { company_id: companyId });
    } catch (error) {
      return handleApiError(error, 'Failed to delete transaction');
    }
  },

  bulkSaveTransactions: async (transactions: CreateTransactionRequest[]): Promise<{ message: string; succeeded: number; failed: number }> => {
    try {
      const response = await api.post('/save_transactions', transactions);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to bulk save transactions');
    }
  },

  enhanceDescription: async (transactionId: string, apply: boolean): Promise<{ enhanced_description: string }> => {
    try {
      const response = await api.post(`/api/transactions/${transactionId}/enhance`, { apply });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to enhance transaction description');
    }
  },
};

// Forecasting API
export const forecastApi = {
  createForecast: async (forecastData: CreateForecastRequest): Promise<Forecast> => {
    try {
      const response = await api.post<Forecast>('/api/forecasts', forecastData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to create forecast');
    }
  },

  getForecasts: async (companyId: string): Promise<Forecast[]> => {
    try {
      const response = await api.get('/api/forecasts', {
        params: { company_id: companyId }
      });
      return response.data.forecasts || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch forecasts');
    }
  },

  createForecastFromSpeech: async (
    companyId: string,
    payload: { transcript: string; context?: string; scenario_name?: string }
  ): Promise<{ message: string; forecast: Forecast }> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) {
        throw new Error('Missing companyId')
      }

      const transcript = String(payload?.transcript ?? '').trim()
      if (!transcript) {
        throw new Error('Transcript is required')
      }

      const response = await api.post<{ message?: string; forecast?: any }>(
        `/api/companies/${encodeURIComponent(cid)}/forecasts/speech`,
        {
          transcript,
          context: payload?.context ? String(payload.context) : undefined,
          scenario_name: payload?.scenario_name ? String(payload.scenario_name) : undefined,
        }
      )

      const raw = response.data?.forecast ?? {}
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj
        if (obj?.$oid) return obj.$oid
        if (obj?.id) return String(obj.id)
        return ''
      }
      const getDate = (obj: any) => {
        const v = obj?.$date ?? obj
        if (!v) return ''
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? '' : d.toISOString()
      }

      const forecast: Forecast = {
        id: getId(raw?._id || raw?.id),
        company_id: getId(raw?.company_id) || cid,
        months: Number(raw?.months ?? 12),
        type: raw?.type === 'ai' ? 'ai' : 'manual',
        scenario_name: String(raw?.scenario_name ?? payload?.scenario_name ?? 'Speech Forecast'),
        scenario_params: raw?.scenario_params && typeof raw.scenario_params === 'object' ? raw.scenario_params : {},
        created_at: getDate(raw?.created_at) || new Date().toISOString(),
        results: raw?.results,
      }

      return { message: String(response.data?.message ?? 'Forecast created from speech'), forecast }
    } catch (error) {
      return handleApiError(error, 'Failed to create forecast from speech')
    }
  },

  getAIForecast: async (companyId: string): Promise<AIForecastResponse> => {
    try {
      const response = await api.get<AIForecastResponse>('/api/forecast', {
        params: { company_id: companyId }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to get AI forecast');
    }
  },
};

// Invoices API
export const invoicesApi = {
  listInvoiceTemplates: async (companyId: string): Promise<InvoiceTemplate[]> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) return []
      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/invoice-templates`)
      const raw = response.data ?? {}
      const items: any[] = Array.isArray(raw.templates) ? raw.templates : Array.isArray(raw) ? raw : (raw.invoice_templates || [])

      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj
        if (obj?.$oid) return obj.$oid
        if (obj?.id) return String(obj.id)
        return ''
      }
      const getDate = (obj: any) => {
        const v = obj?.$date ?? obj
        if (!v) return undefined
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? undefined : d.toISOString()
      }

      return items.map((tpl: any) => ({
        id: getId(tpl?._id || tpl?.id),
        company_id: getId(tpl?.company_id) || cid,
        template_name: String(tpl?.template_name ?? ''),
        default_due_days: tpl?.default_due_days != null ? Number(tpl.default_due_days) : undefined,
        default_tax_rate: tpl?.default_tax_rate != null ? Number(tpl.default_tax_rate) : undefined,
        line_items_template: Array.isArray(tpl?.line_items_template)
          ? tpl.line_items_template.map((li: any) => ({
              description: String(li?.description ?? ''),
              quantity: Number(li?.quantity ?? 0),
              rate: Number(li?.rate ?? 0),
              amount: Number(li?.amount ?? 0),
            }))
          : undefined,
        auto_generate: tpl?.auto_generate != null ? Boolean(tpl.auto_generate) : undefined,
        generation_frequency: tpl?.generation_frequency ? String(tpl.generation_frequency) : undefined,
        is_active: tpl?.is_active != null ? Boolean(tpl.is_active) : undefined,
        created_at: getDate(tpl?.created_at),
        updated_at: getDate(tpl?.updated_at),
      }))
    } catch (error) {
      return handleApiError(error, 'Failed to fetch invoice templates')
    }
  },

  listInvoices: async (
    companyId: string,
    params?: { status?: InvoiceStatus; page?: number; per_page?: number }
  ): Promise<InvoicesListResponse> => {
    try {
      const cid = String(companyId ?? '').trim()
      const page = Number(params?.page ?? 1)
      const per_page = Number(params?.per_page ?? 20)
      if (!cid) {
        return { invoices: [], page, per_page, total: 0, pages: 1 }
      }

      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/invoices`, {
        params: {
          status: params?.status,
          page,
          per_page,
        },
      })

      const raw = response.data ?? {}
      const items: any[] = Array.isArray(raw.invoices) ? raw.invoices : []

      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj
        if (obj?.$oid) return obj.$oid
        if (obj?.id) return String(obj.id)
        return ''
      }
      const getDate = (obj: any) => {
        const v = obj?.$date ?? obj
        if (!v) return undefined
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? undefined : d.toISOString()
      }

      const invoices: Invoice[] = items.map((inv: any) => {
        const lineItems: any[] = Array.isArray(inv?.line_items) ? inv.line_items : []
        return {
          id: getId(inv?._id || inv?.id),
          company_id: getId(inv?.company_id) || cid,
          invoice_number: inv?.invoice_number ? String(inv.invoice_number) : undefined,
          customer_name: String(inv?.customer_name ?? ''),
          customer_email: inv?.customer_email ? String(inv.customer_email) : undefined,
          status: (['draft', 'sent', 'paid', 'overdue'].includes(inv?.status) ? inv.status : 'draft') as InvoiceStatus,
          issue_date: inv?.issue_date ? String(inv.issue_date) : undefined,
          due_date: inv?.due_date ? String(inv.due_date) : undefined,
          subtotal: inv?.subtotal != null ? Number(inv.subtotal) : undefined,
          tax_rate: inv?.tax_rate != null ? Number(inv.tax_rate) : undefined,
          tax_amount: inv?.tax_amount != null ? Number(inv.tax_amount) : undefined,
          total_amount: inv?.total_amount != null ? Number(inv.total_amount) : undefined,
          line_items: lineItems.map((li: any) => ({
            description: String(li?.description ?? ''),
            quantity: Number(li?.quantity ?? 0),
            rate: Number(li?.rate ?? 0),
            amount: Number(li?.amount ?? 0),
          })),
          created_at: getDate(inv?.created_at),
          updated_at: getDate(inv?.updated_at),
        }
      })

      return {
        invoices,
        page: Number(raw?.page ?? page),
        per_page: Number(raw?.per_page ?? per_page),
        total: Number(raw?.total ?? invoices.length),
        pages: Number(raw?.pages ?? 1),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch invoices')
    }
  },

  getInvoice: async (companyId: string, invoiceId: string): Promise<Invoice | null> => {
    try {
      const cid = String(companyId ?? '').trim()
      const iid = String(invoiceId ?? '').trim()
      if (!cid || !iid) return null
      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/invoices/${encodeURIComponent(iid)}`)
      const raw = response.data?.invoice ?? response.data ?? {}
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj
        if (obj?.$oid) return obj.$oid
        if (obj?.id) return String(obj.id)
        return ''
      }
      const getDate = (obj: any) => {
        const v = obj?.$date ?? obj
        if (!v) return undefined
        const d = new Date(String(v))
        return isNaN(d.getTime()) ? undefined : d.toISOString()
      }
      const lineItems: any[] = Array.isArray(raw?.line_items) ? raw.line_items : []
      return {
        id: getId(raw?._id || raw?.id) || iid,
        company_id: getId(raw?.company_id) || cid,
        invoice_number: raw?.invoice_number ? String(raw.invoice_number) : undefined,
        customer_name: String(raw?.customer_name ?? ''),
        customer_email: raw?.customer_email ? String(raw.customer_email) : undefined,
        status: (['draft', 'sent', 'paid', 'overdue'].includes(raw?.status) ? raw.status : 'draft') as InvoiceStatus,
        issue_date: raw?.issue_date ? String(raw.issue_date) : undefined,
        due_date: raw?.due_date ? String(raw.due_date) : undefined,
        subtotal: raw?.subtotal != null ? Number(raw.subtotal) : undefined,
        tax_rate: raw?.tax_rate != null ? Number(raw.tax_rate) : undefined,
        tax_amount: raw?.tax_amount != null ? Number(raw.tax_amount) : undefined,
        total_amount: raw?.total_amount != null ? Number(raw.total_amount) : undefined,
        line_items: lineItems.map((li: any) => ({
          description: String(li?.description ?? ''),
          quantity: Number(li?.quantity ?? 0),
          rate: Number(li?.rate ?? 0),
          amount: Number(li?.amount ?? 0),
        })),
        created_at: getDate(raw?.created_at),
        updated_at: getDate(raw?.updated_at),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch invoice')
    }
  },

  createInvoice: async (
    companyId: string,
    payload: {
      customer_name: string
      customer_email?: string
      template_id?: string
      due_date?: string
      tax_rate?: number
      line_items: InvoiceLineItem[]
    }
  ): Promise<Invoice> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) throw new Error('Missing companyId')
      const response = await api.post(`/api/companies/${encodeURIComponent(cid)}/invoices`, payload)
      const created = response.data?.invoice ?? response.data ?? {}
      const inv = await invoicesApi.getInvoice(cid, String(created?.id ?? created?._id ?? ''))
      if (inv) return inv
      // fallback minimal mapping
      return {
        id: String(created?.id ?? ''),
        company_id: cid,
        customer_name: String(created?.customer_name ?? payload.customer_name ?? ''),
        customer_email: created?.customer_email ? String(created.customer_email) : payload.customer_email,
        status: (['draft', 'sent', 'paid', 'overdue'].includes(created?.status) ? created.status : 'draft') as InvoiceStatus,
        total_amount: created?.total_amount != null ? Number(created.total_amount) : undefined,
        line_items: payload.line_items,
      }
    } catch (error) {
      return handleApiError(error, 'Failed to create invoice')
    }
  },

  updateInvoice: async (
    companyId: string,
    invoiceId: string,
    payload: Partial<{
      status: InvoiceStatus
      payment_method: string
      notes: string
    }>
  ): Promise<Invoice> => {
    try {
      const cid = String(companyId ?? '').trim()
      const iid = String(invoiceId ?? '').trim()
      if (!cid || !iid) throw new Error('Missing ids')
      await api.put(`/api/companies/${encodeURIComponent(cid)}/invoices/${encodeURIComponent(iid)}`, payload)
      const inv = await invoicesApi.getInvoice(cid, iid)
      if (!inv) throw new Error('Invoice not found after update')
      return inv
    } catch (error) {
      return handleApiError(error, 'Failed to update invoice')
    }
  },

  deleteInvoice: async (companyId: string, invoiceId: string): Promise<{ message: string }> => {
    try {
      const cid = String(companyId ?? '').trim()
      const iid = String(invoiceId ?? '').trim()
      if (!cid || !iid) throw new Error('Missing ids')
      const response = await api.delete(`/api/companies/${encodeURIComponent(cid)}/invoices/${encodeURIComponent(iid)}`)
      const msg = response.data?.message ?? 'Invoice deleted successfully'
      return { message: String(msg) }
    } catch (error) {
      return handleApiError(error, 'Failed to delete invoice')
    }
  },

  getInvoiceSummary: async (companyId: string): Promise<InvoiceSummary> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) {
        return { total_invoices: 0, by_status: {}, total_outstanding: 0, total_paid: 0, company_id: '' }
      }
      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/invoices/summary`)
      const raw = response.data ?? {}
      return {
        total_invoices: Number(raw?.total_invoices ?? 0),
        by_status: (raw?.by_status && typeof raw.by_status === 'object') ? raw.by_status : {},
        total_outstanding: Number(raw?.total_outstanding ?? 0),
        total_paid: Number(raw?.total_paid ?? 0),
        company_id: raw?.company_id ? String(raw.company_id) : cid,
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch invoice summary')
    }
  },

  exportInvoicePdf: async (companyId: string, invoiceId: string): Promise<Blob> => {
    try {
      const cid = String(companyId ?? '').trim()
      const iid = String(invoiceId ?? '').trim()
      if (!cid || !iid) throw new Error('Missing ids')
      const response = await api.get(
        `/api/companies/${encodeURIComponent(cid)}/invoices/${encodeURIComponent(iid)}/export/pdf`,
        { responseType: 'blob' }
      )
      return response.data as Blob
    } catch (error) {
      return handleApiError(error, 'Failed to export invoice PDF')
    }
  },

  exportInvoicesCsv: async (companyId: string, status?: InvoiceStatus): Promise<Blob> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) throw new Error('Missing companyId')
      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/invoices/export/csv`, {
        params: { status },
        responseType: 'blob',
      })
      return response.data as Blob
    } catch (error) {
      return handleApiError(error, 'Failed to export invoices CSV')
    }
  },

  getInvoiceSpeech: async (
    companyId: string,
    invoiceId: string,
    style?: 'conversational' | 'formal' | 'executive'
  ): Promise<{ speech_text: string; invoice_id?: string; invoice_number?: string; style?: string }> => {
    try {
      const cid = String(companyId ?? '').trim()
      const iid = String(invoiceId ?? '').trim()
      if (!cid || !iid) {
        return { speech_text: '' }
      }
      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/invoices/${encodeURIComponent(iid)}/speech`, {
        params: { style: style || 'conversational' },
      })
      const raw = response.data ?? {}
      return {
        speech_text: String(raw?.speech_text ?? ''),
        invoice_id: raw?.invoice_id ? String(raw.invoice_id) : undefined,
        invoice_number: raw?.invoice_number ? String(raw.invoice_number) : undefined,
        style: raw?.style ? String(raw.style) : undefined,
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch invoice speech summary')
    }
  },
}

// Dashboard API
export const dashboardApi = {
  getKPIs: async (companyId: string): Promise<DashboardKPIs> => {
    try {
      const response = await api.get<{
        kpis: DashboardKPIs;
        inflows: number;
        outflows: number;
        company_id: string;
      }>('/api/dashboard', {
        params: { company_id: companyId }
      });
      // Check if response.data is a string that needs parsing
      let data: any;
      try {
        if (typeof response.data === 'string') {
          // Replace Infinity with null since Infinity is not valid JSON
          const responseString = response.data as string;
          const sanitizedJson = responseString.replace(/:\s*Infinity/g, ': null');
          data = JSON.parse(sanitizedJson);
        } else if (Array.isArray(response.data)) {
          console.log('Response.data is an array, accessing first element...')
          data = response.data[0];
        } else {
          data = response.data;
          // Handle Infinity values in already-parsed objects
          if (data && typeof data === 'object') {
            const sanitizeInfinity = (obj: any): any => {
              if (obj === Infinity || obj === -Infinity) {
                return null;
              }
              if (Array.isArray(obj)) {
                return obj.map(sanitizeInfinity);
              }
              if (obj && typeof obj === 'object') {
                const sanitized: any = {};
                for (const key in obj) {
                  sanitized[key] = sanitizeInfinity(obj[key]);
                }
                return sanitized;
              }
              return obj;
            };
            data = sanitizeInfinity(data);
          }
        }
        
        // Extract kpis from response and merge inflows/outflows
        const kpis = data?.kpis || {};
        const result = {
          net_cash: kpis.net_cash,
          current_balance: kpis.current_balance,
          current_ratio: kpis.current_ratio,
          burn_rate: kpis.burn_rate,
          runway: kpis.runway === Infinity ? Infinity : (kpis.runway ?? null),
          inflows: data?.inflows,
          outflows: data?.outflows,
          company_id: data?.company_id,
        };
        return result;
      } catch (parseError) {
        console.error('Error parsing response:', parseError)
        console.error('Response.data type:', typeof response.data)
        console.error('Response.data:', response.data)
        throw parseError;
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch dashboard KPIs');
    }
  },

  getDashboardSpeech: async (
    companyId: string,
    style?: 'conversational' | 'formal' | 'brief'
  ): Promise<{ speech_text: string; company_id?: string; style?: string }> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) return { speech_text: '' }
      const response = await api.get(`/api/companies/${encodeURIComponent(cid)}/dashboard/speech`, {
        params: { style: style || 'conversational' },
      })
      const raw = response.data ?? {}
      return {
        speech_text: String(raw?.speech_text ?? ''),
        company_id: raw?.company_id ? String(raw.company_id) : cid,
        style: raw?.style ? String(raw.style) : style,
      }
    } catch (error) {
      return handleApiError(error, 'Failed to generate dashboard speech')
    }
  },
};

// Working Capital API
export const workingCapitalApi = {
  getReceivables: async (companyId: string): Promise<Receivable[]> => {
    try {
      const response = await api.get('/api/receivables', {
        params: { company_id: companyId }
      });
      return response.data.receivables || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch receivables');
    }
  },

  getPayables: async (companyId: string): Promise<Payable[]> => {
    try {
      const response = await api.get('/api/payables', {
        params: { company_id: companyId }
      });
      return response.data.payables || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch payables');
    }
  },

  getInventory: async (companyId: string): Promise<InventoryItem[]> => {
    try {
      const response = await api.get('/api/inventory', {
        params: { company_id: companyId }
      });
      return response.data.inventory || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch inventory');
    }
  },

  getAgingReport: async (companyId: string, type: 'receivables' | 'payables'): Promise<AgingReport | { report: AgingReport }> => {
    try {
      const response = await api.get('/api/aging', {
        params: { company_id: companyId, type }
      });
      // Backend returns: { report: {...}, company_id, type }
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch aging report');
    }
  },

  // Receivables CRUD
  createReceivable: async (receivableData: CreateReceivableRequest): Promise<Receivable> => {
    try {
      const response = await api.post<{ receivable: any; message: string }>('/api/receivables', receivableData);
      // Backend returns: { message: "...", receivable: {...} }
      const receivable = response.data.receivable || response.data;
      // Handle MongoDB ObjectId format
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      return {
        id: getId(receivable._id || receivable.id),
        company_id: getId(receivable.company_id) || receivableData.company_id,
        amount: Number(receivable.amount ?? 0),
        due_date: receivable.due_date || receivableData.due_date,
        status: (receivable.status || receivableData.status || 'pending') as 'pending' | 'overdue' | 'paid',
        description: receivable.description || receivableData.description,
      };
    } catch (error) {
      return handleApiError(error, 'Failed to create receivable');
    }
  },

  updateReceivable: async (receivableId: string, companyId: string, receivableData: UpdateReceivableRequest): Promise<Receivable> => {
    try {
      const response = await api.put<{ receivable: any; message: string }>(`/api/receivables/${receivableId}`, receivableData);
      // Backend returns: { message: "...", receivable: {...} }
      const receivable = response.data.receivable || response.data;
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      return {
        id: getId(receivable._id || receivable.id) || receivableId,
        company_id: getId(receivable.company_id) || companyId,
        amount: Number(receivable.amount ?? 0),
        due_date: receivable.due_date || receivableData.due_date || '',
        status: (receivable.status || receivableData.status || 'pending') as 'pending' | 'overdue' | 'paid',
        description: receivable.description || receivableData.description,
      };
    } catch (error) {
      return handleApiError(error, 'Failed to update receivable');
    }
  },

  deleteReceivable: async (receivableId: string, companyId: string): Promise<void> => {
    try {
      await api.delete(`/api/receivables/${receivableId}`, {
        params: { company_id: companyId }
      });
    } catch (error) {
      return handleApiError(error, 'Failed to delete receivable');
    }
  },

  // Payables CRUD
  createPayable: async (payableData: CreatePayableRequest): Promise<Payable> => {
    try {
      const response = await api.post<{ payable: any; message: string }>('/api/payables', payableData);
      // Backend returns: { message: "...", payable: {...} }
      const payable = response.data.payable || response.data;
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      return {
        id: getId(payable._id || payable.id),
        company_id: getId(payable.company_id) || payableData.company_id,
        amount: Number(payable.amount ?? 0),
        due_date: payable.due_date || payableData.due_date,
        status: (payable.status || payableData.status || 'pending') as 'pending' | 'overdue' | 'paid',
        description: payable.description || payableData.description,
      };
    } catch (error) {
      return handleApiError(error, 'Failed to create payable');
    }
  },

  updatePayable: async (payableId: string, companyId: string, payableData: UpdatePayableRequest): Promise<Payable> => {
    try {
      const response = await api.put<{ payable: any; message: string }>(`/api/payables/${payableId}`, payableData);
      // Backend returns: { message: "...", payable: {...} }
      const payable = response.data.payable || response.data;
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      return {
        id: getId(payable._id || payable.id) || payableId,
        company_id: getId(payable.company_id) || companyId,
        amount: Number(payable.amount ?? 0),
        due_date: payable.due_date || payableData.due_date || '',
        status: (payable.status || payableData.status || 'pending') as 'pending' | 'overdue' | 'paid',
        description: payable.description || payableData.description,
      };
    } catch (error) {
      return handleApiError(error, 'Failed to update payable');
    }
  },

  deletePayable: async (payableId: string, companyId: string): Promise<void> => {
    try {
      await api.delete(`/api/payables/${payableId}`, {
        params: { company_id: companyId }
      });
    } catch (error) {
      return handleApiError(error, 'Failed to delete payable');
    }
  },

  // Inventory CRUD
  createInventory: async (inventoryData: CreateInventoryRequest): Promise<InventoryItem> => {
    try {
      const response = await api.post<{ inventory: any; message: string }>('/api/inventory', inventoryData);
      // Backend returns: { message: "...", inventory: {...} }
      const inventory = response.data.inventory || response.data;
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      const getDate = (obj: any) => {
        if (!obj) return new Date().toISOString();
        if (typeof obj === 'string') return obj;
        if (obj.$date) return new Date(obj.$date).toISOString();
        if (obj instanceof Date) return obj.toISOString();
        return String(obj);
      };
      const quantity = Number(inventory.quantity ?? inventoryData.quantity ?? 0);
      const totalValue = Number(inventory.value ?? inventoryData.value ?? 0);
      const unitCost = quantity > 0 ? totalValue / quantity : 0;
      return {
        id: getId(inventory._id || inventory.id),
        company_id: getId(inventory.company_id) || inventoryData.company_id,
        item_name: String(inventory.item_name || inventoryData.item_name || 'Unknown'),
        quantity: quantity,
        unit_cost: unitCost,
        total_value: totalValue,
        last_updated: getDate(inventory.last_updated),
      };
    } catch (error) {
      return handleApiError(error, 'Failed to create inventory item');
    }
  },

  updateInventory: async (inventoryId: string, companyId: string, inventoryData: UpdateInventoryRequest): Promise<InventoryItem> => {
    try {
      const response = await api.put<{ inventory: any; message: string }>(`/api/inventory/${inventoryId}`, inventoryData);
      // Backend returns: { message: "...", inventory: {...} }
      const inventory = response.data.inventory || response.data;
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      const getDate = (obj: any) => {
        if (!obj) return new Date().toISOString();
        if (typeof obj === 'string') return obj;
        if (obj.$date) return new Date(obj.$date).toISOString();
        if (obj instanceof Date) return obj.toISOString();
        return String(obj);
      };
      const quantity = Number(inventory.quantity ?? inventoryData.quantity ?? 0);
      const totalValue = Number(inventory.value ?? inventoryData.value ?? 0);
      const unitCost = quantity > 0 ? totalValue / quantity : 0;
      return {
        id: getId(inventory._id || inventory.id) || inventoryId,
        company_id: getId(inventory.company_id) || companyId,
        item_name: String(inventory.item_name || inventoryData.item_name || 'Unknown'),
        quantity: quantity,
        unit_cost: unitCost,
        total_value: totalValue,
        last_updated: getDate(inventory.last_updated),
      };
    } catch (error) {
      return handleApiError(error, 'Failed to update inventory item');
    }
  },

  deleteInventory: async (inventoryId: string, companyId: string): Promise<void> => {
    try {
      await api.delete(`/api/inventory/${inventoryId}`, {
        params: { company_id: companyId }
      });
    } catch (error) {
      return handleApiError(error, 'Failed to delete inventory item');
    }
  },
};

// Budgeting API
export const budgetApi = {
  createBudget: async (budgetData: CreateBudgetRequest): Promise<Budget> => {
    try {
      const response = await api.post<Budget>('/api/budgets', budgetData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to create budget');
    }
  },

  getBudgets: async (companyId: string, period?: string): Promise<Budget[]> => {
    try {
      const params: any = { company_id: companyId };
      if (period) params.period = period;
      const response = await api.get('/api/budgets', { params });
      return response.data.budgets || [];
    } catch (error) {
      return handleApiError(error, 'Failed to fetch budgets');
    }
  },

  getBudgetVariances: async (companyId: string, period: string): Promise<{ variance: Record<string, number>, company_id: string, period: string }> => {
    try {
      const response = await api.get('/api/variances', {
        params: { company_id: companyId, period }
      });
      // Backend returns: { variance: { category: variance_amount }, company_id, period }
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch budget variances');
    }
  },

  updateBudget: async (budgetId: string, companyId: string, budgetData: UpdateBudgetRequest): Promise<Budget> => {
    try {
      const response = await api.put<{ budget: any; message: string }>(`/api/budgets/${budgetId}`, budgetData);
      // Backend returns: { message: "...", budget: {...} }
      const budget = response.data.budget || response.data;
      const getId = (obj: any) => {
        if (typeof obj === 'string') return obj;
        if (obj?.$oid) return obj.$oid;
        if (obj?.id) return String(obj.id);
        return '';
      };
      const getDate = (obj: any) => {
        if (!obj) return new Date().toISOString();
        if (typeof obj === 'string') return obj;
        if (obj.$date) return new Date(obj.$date).toISOString();
        if (obj instanceof Date) return obj.toISOString();
        return String(obj);
      };
      return {
        id: getId(budget._id || budget.id) || budgetId,
        company_id: getId(budget.company_id) || companyId,
        category: String(budget.category || budgetData.category || ''),
        amount: Number(budget.amount ?? budgetData.amount ?? 0),
        period: String(budget.period || budgetData.period || ''),
        spent: Number(budget.spent ?? 0),
        remaining: Number(budget.remaining ?? (Number(budget.amount ?? 0) - Number(budget.spent ?? 0))),
        created_at: getDate(budget.created_at),
      };
    } catch (error) {
      return handleApiError(error, 'Failed to update budget');
    }
  },

  deleteBudget: async (budgetId: string, companyId: string): Promise<void> => {
    try {
      await api.delete(`/api/budgets/${budgetId}`, {
        params: { company_id: companyId }
      });
    } catch (error) {
      return handleApiError(error, 'Failed to delete budget');
    }
  },
};

// AI Features API
export const aiApi = {
  categorizeTransaction: async (categorizeData: AICategorizeRequest): Promise<AICategorizeResponse> => {
    try {
      const response = await api.post<AICategorizeResponse>('/api/ai/categorize', categorizeData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to categorize transaction');
    }
  },

  detectAnomalies: async (companyId: string): Promise<Anomaly[]> => {
    try {
      const response = await api.get('/api/ai/anomalies', {
        params: { company_id: companyId }
      });
      return response.data.anomalies || [];
    } catch (error) {
      return handleApiError(error, 'Failed to detect anomalies');
    }
  },

  chat: async (chatData: AIChatRequest): Promise<AIChatResponse> => {
    try {
      const response = await api.post<AIChatResponse>('/api/ai/chat', chatData);
      // Backend returns { response: {...}, company_id: string }
      // where response can be a string or an object with { answer, data, follow_up_questions, insights, action }
      const data = response.data;
      
      // Handle both string and object response formats
      if (typeof data.response === 'string') {
        return {
          ...data,
          answer: data.response,
        } as AIChatResponse;
      } else if (typeof data.response === 'object' && data.response !== null) {
        // Response is an object with nested structure
        const responseObj = data.response as { answer?: string; insights?: string[]; follow_up_questions?: string[]; data?: Record<string, unknown>; action?: Record<string, unknown> };
        return {
          ...data,
          answer: responseObj.answer || '',
          insights: responseObj.insights || data.insights || [],
          follow_up_questions: responseObj.follow_up_questions || [],
          data: responseObj.data,
          action: responseObj.action,
        } as AIChatResponse;
      }
      
      // Fallback
      return {
        ...data,
        answer: data.answer || (typeof data.response === 'string' ? data.response : ''),
      } as AIChatResponse;
    } catch (error: any) {
      // Don't return a value from handleApiError, throw instead
      const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || 'Failed to process AI chat request';
      throw new Error(errorMessage);
    }
  },

  getInsights: async (companyId: string): Promise<AIInsight[]> => {
    try {
      const response = await api.get('/api/ai/insights', {
        params: { company_id: companyId }
      });
      /**
       * Backend returns: { insights: { alerts: [], opportunities: [], trends: [], recommendations: [], generated_at }, company_id }
       * (Some older/alternate implementations may return an array; we normalize both.)
       */
      const raw: unknown = (response.data as { insights?: unknown } | undefined)?.insights;
      const nowIso = new Date().toISOString();

      const isRecord = (value: unknown): value is Record<string, unknown> =>
        typeof value === 'object' && value !== null && !Array.isArray(value);

      const toSeverity = (value: unknown): 'low' | 'medium' | 'high' => {
        const v = String(value || '').toLowerCase();
        if (v === 'critical') return 'high';
        if (v === 'high') return 'high';
        if (v === 'low') return 'low';
        return 'medium';
      };

      const asText = (value: unknown): string => {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        try {
          return JSON.stringify(value);
        } catch {
          return String(value);
        }
      };

      // If backend returns an array already, pass it through (hook will further normalize)
      if (Array.isArray(raw)) return raw as unknown as AIInsight[];

      // If backend returns categorized insights object, flatten it into AIInsight[]
      if (isRecord(raw)) {
        const generatedAt = (typeof raw.generated_at === 'string') ? raw.generated_at : nowIso;

        const flattenCategory = (
          category: 'alerts' | 'opportunities' | 'trends' | 'recommendations',
          type: AIInsight['type'],
          items: unknown
        ): AIInsight[] => {
          if (!Array.isArray(items)) return [];
          return items.map((item: unknown, idx: number) => {
            const obj: Record<string, unknown> = isRecord(item) ? item : {};
            // Backend spec uses: { title, message, severity, action_required, suggested_action }
            const title =
              (obj.title || obj.heading)
                ? String(obj.title || obj.heading)
                : category.slice(0, 1).toUpperCase() + category.slice(1);
            const message = obj.message ?? obj.description ?? obj.text ?? obj.content;
            const suggested = obj.suggested_action ?? obj.suggestedAction;
            const description =
              [asText(message), suggested ? `Suggested action: ${asText(suggested)}` : '']
                .filter(Boolean)
                .join('\n');

            return {
              id: String(obj.id || `${category}-${idx}`),
              type,
              title,
              description: description || 'Insight',
              severity: toSeverity(obj.severity),
              generated_at: String(obj.generated_at || obj.created_at || generatedAt),
            };
          });
        };

        return [
          ...flattenCategory('alerts', 'risk', raw.alerts),
          ...flattenCategory('opportunities', 'opportunity', raw.opportunities),
          ...flattenCategory('trends', 'trend', raw.trends),
          ...flattenCategory('recommendations', 'opportunity', raw.recommendations),
        ];
      }

      return [];
    } catch (error: unknown) {
      // Return empty array on error instead of throwing to prevent infinite loading
      const errorMessage = (error as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string })?.response?.data?.error 
        || (error as { response?: { data?: { message?: string }; status?: number }; message?: string })?.response?.data?.message
        || (error as { message?: string })?.message
        || 'Unknown error';
      const status = (error as { response?: { status?: number } })?.response?.status;
      
      console.error('Failed to fetch AI insights:', {
        message: errorMessage,
        status,
        companyId,
        error
      });
      
      // Don't throw - return empty array to prevent UI breaking
      return [];
    }
  },
};

// File Operations API
export const fileApi = {
  importTransactionsCSV: async (
    companyId: string,
    file: File,
    validateOnly: boolean = false
  ): Promise<{
    message: string
    imported_count?: number
    validated_count?: number
    transactions?: unknown[]
    errors: string[]
  }> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) throw new Error('Missing companyId')
      
      const formData = new FormData()
      formData.append('file', file)
      
      const response = await api.post(
        `/api/companies/${encodeURIComponent(cid)}/transactions/import/csv${validateOnly ? '?validate_only=true' : ''}`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      )
      
      return {
        message: response.data?.message || 'Import completed',
        imported_count: response.data?.imported_count,
        validated_count: response.data?.validated_count,
        transactions: response.data?.transactions,
        errors: response.data?.errors || []
      }
    } catch (error) {
      return handleApiError(error, 'Failed to import transactions')
    }
  },

  exportTransactionsCSV: async (
    companyId: string,
    options?: {
      include_balance?: boolean
      start_date?: string
      end_date?: string
    }
  ): Promise<Blob> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) throw new Error('Missing companyId')
      
      const params: Record<string, string> = {}
      if (options?.include_balance) params.include_balance = 'true'
      if (options?.start_date) params.start_date = options.start_date
      if (options?.end_date) params.end_date = options.end_date
      
      const response = await api.get(
        `/api/companies/${encodeURIComponent(cid)}/transactions/export/csv`,
        {
          params,
          responseType: 'blob'
        }
      )
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to export transactions to CSV')
    }
  },

  exportTransactionsPDF: async (
    companyId: string,
    options?: {
      start_date?: string
      end_date?: string
      title?: string
    }
  ): Promise<Blob> => {
    try {
      const cid = String(companyId ?? '').trim()
      if (!cid) throw new Error('Missing companyId')
      
      const params: Record<string, string> = {}
      if (options?.start_date) params.start_date = options.start_date
      if (options?.end_date) params.end_date = options.end_date
      if (options?.title) params.title = options.title
      
      const response = await api.get(
        `/api/companies/${encodeURIComponent(cid)}/transactions/export/pdf`,
        {
          params,
          responseType: 'blob'
        }
      )
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to export transactions to PDF')
    }
  },
};

// Financial Analysis API
export const financialApi = {
  setInitialBalance: async (data: SetInitialBalanceRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post('/set-initial-balance', data);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to set initial balance');
    }
  },

  getBalanceByDate: async (data: BalanceByDateRequest): Promise<{ balance: number }> => {
    try {
      const response = await api.post('/balance-by-date', data);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to calculate balance');
    }
  },

  getCashOverview: async (companyId: string): Promise<CashOverview> => {
    try {
      const response = await api.get<CashOverview>('/cash-overview', {
        params: { company_id: companyId }
      });
      
      // Handle string responses and Infinity values (same as dashboard KPIs)
      let data: any;
      if (typeof response.data === 'string') {
        // Replace Infinity with null since Infinity is not valid JSON
        const responseString = response.data as string;
        const sanitizedJson = responseString.replace(/:\s*Infinity/g, ': null');
        data = JSON.parse(sanitizedJson);
      } else if (Array.isArray(response.data)) {
        data = response.data[0];
      } else {
        data = response.data;
        // Handle Infinity values in already-parsed objects
        if (data && typeof data === 'object') {
          const sanitizeInfinity = (obj: any): any => {
            if (obj === Infinity || obj === -Infinity) {
              return null;
            }
            if (Array.isArray(obj)) {
              return obj.map(sanitizeInfinity);
            }
            if (obj && typeof obj === 'object') {
              const sanitized: any = {};
              for (const key in obj) {
                sanitized[key] = sanitizeInfinity(obj[key]);
              }
              return sanitized;
            }
            return obj;
          };
          data = sanitizeInfinity(data);
        }
      }
      
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch cash overview');
    }
  },

  getCashActivities: async (companyId: string, page = 1, perPage = 10): Promise<{ transactions: CashActivity[]; total: number; page: number; per_page: number; pages: number }> => {
    try {
      const response = await api.get('/cash-activities', {
        params: { company_id: companyId, page, per_page: perPage }
      });
      
      // Handle string responses and Infinity values (same as other endpoints)
      let data: any;
      if (typeof response.data === 'string') {
        const responseString = response.data as string;
        const sanitizedJson = responseString.replace(/:\s*Infinity/g, ': null');
        data = JSON.parse(sanitizedJson);
      } else if (Array.isArray(response.data)) {
        data = response.data[0];
      } else {
        data = response.data;
        // Handle Infinity values in already-parsed objects
        if (data && typeof data === 'object') {
          const sanitizeInfinity = (obj: any): any => {
            if (obj === Infinity || obj === -Infinity) {
              return null;
            }
            if (Array.isArray(obj)) {
              return obj.map(sanitizeInfinity);
            }
            if (obj && typeof obj === 'object') {
              const sanitized: any = {};
              for (const key in obj) {
                sanitized[key] = sanitizeInfinity(obj[key]);
              }
              return sanitized;
            }
            return obj;
          };
          data = sanitizeInfinity(data);
        }
      }
      
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch cash activities');
    }
  },

  getMonthlyBalances: async (companyId: string): Promise<MonthlyBalance[] | { data: { labels: string[]; balances: number[] } }> => {
    try {
      const response = await api.get('/api/monthly-balances', {
        params: { company_id: companyId }
      });
      
      // Handle string responses and Infinity values (same as other endpoints)
      let data: any;
      if (typeof response.data === 'string') {
        const responseString = response.data as string;
        const sanitizedJson = responseString.replace(/:\s*Infinity/g, ': null');
        data = JSON.parse(sanitizedJson);
      } else if (Array.isArray(response.data)) {
        data = response.data[0];
      } else {
        data = response.data;
        // Handle Infinity values in already-parsed objects
        if (data && typeof data === 'object') {
          const sanitizeInfinity = (obj: any): any => {
            if (obj === Infinity || obj === -Infinity) {
              return null;
            }
            if (Array.isArray(obj)) {
              return obj.map(sanitizeInfinity);
            }
            if (obj && typeof obj === 'object') {
              const sanitized: any = {};
              for (const key in obj) {
                sanitized[key] = sanitizeInfinity(obj[key]);
              }
              return sanitized;
            }
            return obj;
          };
          data = sanitizeInfinity(data);
        }
      }
      
      // Backend returns { success: true, data: { labels: [], balances: [] } }
      return data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch monthly balances');
    }
  },

  getMonthlyIncomeExpense: async (companyId: string): Promise<any> => {
    try {
      const response = await api.get('/api/monthly-income-expense', {
        params: { company_id: companyId }
      });
      // Backend returns: { success: true, data: { labels: [], income: [], expense: [] } }
      // Return the full response so the hook can process it
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch monthly income/expense data');
    }
  },

  getCashoutByCategories: async (companyId: string): Promise<{ data: { labels: string[]; amounts: number[] } }> => {
    try {
      const response = await api.get('/api/cashout-categories', {
        params: { company_id: companyId }
      });
      // Backend returns: { success: true, data: { labels: [], amounts: [] } }
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch cashout by categories');
    }
  },
};

// Reports & Forecasting API
export const reportsApi = {
  generateCashflowStatement: async (companyId: string): Promise<Blob> => {
    try {
      const response = await api.get('/api/generate_cashflow_statement', {
        params: { company_id: companyId },
        responseType: 'blob'
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to generate cashflow statement');
    }
  },

  getAIForecast: async (companyId: string): Promise<AIForecastResponse> => {
    try {
      const response = await api.get<AIForecastResponse>('/api/forecast', {
        params: { company_id: companyId }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to get AI forecast');
    }
  },

  getCashFlowStatementData: async (companyId: string, category: string, subcategory: string): Promise<any> => {
    try {
      const response = await api.get('/api/cashflow-statement/transactions', {
        params: { company_id: companyId, category, subcategory }
      });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch cash flow statement data');
    }
  },
};

// User Settings API
export const settingsApi = {
  getSettings: async (): Promise<UserSettings> => {
    try {
      const response = await api.get<UserSettings>('/api/settings');
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch user settings');
    }
  },

  updateProfile: async (profileData: UpdateProfileRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post('/api/update_profile', profileData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to update profile');
    }
  },

  changePassword: async (passwordData: ChangePasswordRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post('/api/change_password', passwordData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to change password');
    }
  },

  updateModules: async (modulesData: UpdateModulesRequest): Promise<{ message: string }> => {
    try {
      const response = await api.post('/api/update_modules', modulesData);
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to update modules');
    }
  },
};

// System Health API
export const healthApi = {
  checkHealth: async (): Promise<HealthCheckResponse> => {
    try {
      const response = await api.get<HealthCheckResponse>('/health');
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to check system health');
    }
  },

  checkStatus: async (): Promise<HealthCheckResponse> => {
    try {
      const response = await api.get<HealthCheckResponse>('/status');
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to check system status');
    }
  },
};

// Bank Reconciliation API
export const reconciliationApi = {
  listBankStatements: async (companyId: string, page = 1, perPage = 20): Promise<BankStatementListResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/bank-statements`, { params: { page, per_page: perPage } })
      const data = response.data || {}
      return {
        statements: Array.isArray(data.statements) ? data.statements : (Array.isArray(data.statements_data) ? data.statements_data : []),
        total: Number(data.total ?? 0),
        page: Number(data.page ?? page),
        per_page: Number(data.per_page ?? perPage),
        pages: Number(data.pages ?? 1),
        company_id: String(data.company_id ?? companyId),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch bank statements')
    }
  },

  createBankStatement: async (companyId: string, payload: CreateBankStatementRequest): Promise<{ message: string; statement?: { id: string } }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/bank-statements`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to create bank statement')
    }
  },

  getBankStatement: async (companyId: string, statementId: string): Promise<BankStatementDetailResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/bank-statements/${statementId}`)
      const data = response.data || {}
      return {
        id: String(data.id ?? statementId),
        bank_name: String(data.bank_name ?? ''),
        account_number: String(data.account_number ?? ''),
        statement_date: String(data.statement_date ?? ''),
        opening_balance: Number(data.opening_balance ?? 0),
        closing_balance: Number(data.closing_balance ?? 0),
        created_at: typeof data.created_at === 'string' ? data.created_at : null,
        items: Array.isArray(data.items) ? data.items : [],
        items_count: Number(data.items_count ?? (Array.isArray(data.items) ? data.items.length : 0)),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch bank statement details')
    }
  },

  deleteBankStatement: async (companyId: string, statementId: string): Promise<{ message: string }> => {
    try {
      const response = await api.delete(`/api/companies/${companyId}/bank-statements/${statementId}`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to delete bank statement')
    }
  },

  autoMatch: async (companyId: string, statementId: string, dateTolerance = 2): Promise<AutoMatchResponse> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/reconciliation/${statementId}/auto-match`, null, {
        params: { date_tolerance: dateTolerance },
      })
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to auto-match reconciliation')
    }
  },

  getReconciliationStatus: async (companyId: string, statementId: string): Promise<ReconciliationStatusResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/reconciliation/${statementId}`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to fetch reconciliation status')
    }
  },

  getPotentialMatches: async (companyId: string, itemId: string, dateTolerance = 5): Promise<PotentialMatchesResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/reconciliation/items/${itemId}/potential-matches`, {
        params: { date_tolerance: dateTolerance },
      })
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to fetch potential matches')
    }
  },

  manualMatchItem: async (companyId: string, itemId: string, payload: { transaction_id: string; notes?: string }): Promise<{ message: string; item?: unknown }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/reconciliation/items/${itemId}/match`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to match item')
    }
  },

  unmatchItem: async (companyId: string, itemId: string): Promise<{ success?: boolean; message?: string } | Record<string, unknown>> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/reconciliation/items/${itemId}/unmatch`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to unmatch item')
    }
  },
}

// Drawings / Equity API
export const drawingsApi = {
  listDrawings: async (companyId: string, params?: { owner_id?: string; category?: string; start_date?: string; end_date?: string; page?: number; per_page?: number }): Promise<DrawingsListResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/drawings`, { params: { ...params } })
      const data = response.data || {}
      return {
        drawings: Array.isArray(data.drawings) ? data.drawings : [],
        total: Number(data.total ?? 0),
        total_amount: Number(data.total_amount ?? 0),
        page: Number(data.page ?? params?.page ?? 1),
        per_page: Number(data.per_page ?? params?.per_page ?? 20),
        pages: Number(data.pages ?? 1),
        company_id: String(data.company_id ?? companyId),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch drawings')
    }
  },

  createDrawing: async (companyId: string, payload: CreateDrawingRequest): Promise<{ message: string; drawing?: unknown }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/drawings`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to create drawing')
    }
  },

  deleteDrawing: async (companyId: string, drawingId: string): Promise<{ message: string }> => {
    try {
      const response = await api.delete(`/api/companies/${companyId}/drawings/${drawingId}`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to delete drawing')
    }
  },

  listEquityAccounts: async (companyId: string): Promise<EquityAccountsResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/equity`)
      const data = response.data || {}
      return {
        equity_accounts: Array.isArray(data.equity_accounts) ? data.equity_accounts : [],
        company_id: String(data.company_id ?? companyId),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch equity accounts')
    }
  },

  getEquitySummary: async (companyId: string, ownerId: string): Promise<EquitySummaryResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/equity/${ownerId}`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to fetch equity summary')
    }
  },

  updateEquityAccount: async (companyId: string, ownerId: string, payload: UpdateEquityAccountRequest): Promise<{ message: string; equity_account?: unknown }> => {
    try {
      const response = await api.put(`/api/companies/${companyId}/equity/${ownerId}`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to update equity account')
    }
  },
}

// Salary / Expenses API
export const salaryApi = {
  listEmployees: async (companyId: string, params?: { status?: string; department?: string; page?: number; per_page?: number }): Promise<EmployeesListResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/employees`, { params: { ...params } })
      const data = response.data || {}
      return {
        employees: Array.isArray(data.employees) ? data.employees : [],
        total: Number(data.total ?? 0),
        page: Number(data.page ?? params?.page ?? 1),
        per_page: Number(data.per_page ?? params?.per_page ?? 20),
        pages: Number(data.pages ?? 1),
        company_id: String(data.company_id ?? companyId),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch employees')
    }
  },

  createEmployee: async (companyId: string, payload: CreateEmployeeRequest): Promise<{ message: string; employee?: unknown }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/employees`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to create employee')
    }
  },

  updateEmployee: async (companyId: string, employeeId: string, payload: UpdateEmployeeRequest): Promise<{ message: string; employee?: unknown }> => {
    try {
      const response = await api.put(`/api/companies/${companyId}/employees/${employeeId}`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to update employee')
    }
  },

  deleteEmployee: async (companyId: string, employeeId: string): Promise<{ message: string }> => {
    try {
      const response = await api.delete(`/api/companies/${companyId}/employees/${employeeId}`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to delete employee')
    }
  },

  listSalaryPayments: async (companyId: string, params?: { employee_id?: string; status?: string; start_date?: string; end_date?: string; page?: number; per_page?: number }): Promise<SalaryPaymentsListResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/salary-payments`, { params: { ...params } })
      const data = response.data || {}
      return {
        payments: Array.isArray(data.payments) ? data.payments : [],
        total: Number(data.total ?? 0),
        summary: data.summary,
        page: Number(data.page ?? params?.page ?? 1),
        per_page: Number(data.per_page ?? params?.per_page ?? 20),
        pages: Number(data.pages ?? 1),
        company_id: String(data.company_id ?? companyId),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch salary payments')
    }
  },

  createSalaryPayment: async (companyId: string, payload: CreateSalaryPaymentRequest): Promise<{ message: string; payment?: unknown }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/salary-payments`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to create salary payment')
    }
  },

  processSalaryPayment: async (companyId: string, paymentId: string): Promise<{ message: string; payment?: unknown }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/salary-payments/${paymentId}/process`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to process salary payment')
    }
  },

  cancelSalaryPayment: async (companyId: string, paymentId: string): Promise<{ message: string; payment_id?: string }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/salary-payments/${paymentId}/cancel`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to cancel salary payment')
    }
  },

  listExpenseAccounts: async (companyId: string, params?: { type?: string; active_only?: boolean }): Promise<ExpenseAccountsResponse> => {
    try {
      const response = await api.get(`/api/companies/${companyId}/expense-accounts`, { params: { ...params } })
      const data = response.data || {}
      return {
        expense_accounts: Array.isArray(data.expense_accounts) ? data.expense_accounts : [],
        total: Number(data.total ?? 0),
        company_id: String(data.company_id ?? companyId),
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch expense accounts')
    }
  },

  createExpenseAccount: async (companyId: string, payload: CreateExpenseAccountRequest): Promise<{ message: string; account?: unknown }> => {
    try {
      const response = await api.post(`/api/companies/${companyId}/expense-accounts`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to create expense account')
    }
  },

  updateExpenseAccount: async (companyId: string, accountId: string, payload: UpdateExpenseAccountRequest): Promise<{ message: string; account?: unknown }> => {
    try {
      const response = await api.put(`/api/companies/${companyId}/expense-accounts/${accountId}`, payload)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to update expense account')
    }
  },

  deleteExpenseAccount: async (companyId: string, accountId: string): Promise<{ message: string }> => {
    try {
      const response = await api.delete(`/api/companies/${companyId}/expense-accounts/${accountId}`)
      return response.data
    } catch (error) {
      return handleApiError(error, 'Failed to delete expense account')
    }
  },
}

// Home/Dashboard API
export const homeApi = {
  getHomeData: async (companyId?: string, page = 1): Promise<any> => {
    try {
      const params: any = { page };
      if (companyId) params.company_id = companyId;
      const response = await api.get('/', { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch home data');
    }
  },

  getHomeDataAlt: async (companyId?: string, page = 1): Promise<any> => {
    try {
      const params: any = { page };
      if (companyId) params.company_id = companyId;
      const response = await api.get('/home', { params });
      return response.data;
    } catch (error) {
      return handleApiError(error, 'Failed to fetch home data');
    }
  },
};

// Bug Reports API
export interface BugReport {
  id: string
  title: string
  description: string
  reported_by?: {
    id: string
    username?: string
  }
  company_id?: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  category: 'ui' | 'api' | 'performance' | 'data' | 'security' | 'feature_request' | 'other'
  status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix'
  priority?: number
  browser?: string
  device?: string
  url_path?: string
  attachments?: string[]
  comments?: Array<{
    user_id: string
    username?: string
    comment: string
    timestamp: string
  }>
  resolved_by?: string
  resolved_at?: string
  resolution_notes?: string
  created_at?: string
  updated_at?: string
}

export interface BugReportListResponse {
  bug_reports: BugReport[]
  total: number
  page: number
  per_page: number
  pages: number
}

export interface BugReportComment {
  user_id: string
  username?: string
  comment: string
  timestamp: string
}

export const bugReportApi = {
  submitBugReport: async (
    data: {
      title: string
      description: string
      company_id?: string
      severity?: 'low' | 'medium' | 'high' | 'critical'
      category?: 'ui' | 'api' | 'performance' | 'data' | 'security' | 'feature_request' | 'other'
      priority?: number
      browser?: string
      device?: string
      url_path?: string
      attachments?: File[]
    }
  ): Promise<BugReport> => {
    try {
      const formData = new FormData()
      formData.append('title', String(data.title ?? '').trim())
      formData.append('description', String(data.description ?? '').trim())
      
      if (data.company_id) {
        formData.append('company_id', String(data.company_id).trim())
      }
      if (data.severity) {
        formData.append('severity', data.severity)
      }
      if (data.category) {
        formData.append('category', data.category)
      }
      if (data.priority != null) {
        formData.append('priority', String(data.priority))
      }
      if (data.browser) {
        formData.append('browser', String(data.browser).trim())
      }
      if (data.device) {
        formData.append('device', String(data.device).trim())
      }
      if (data.url_path) {
        formData.append('url_path', String(data.url_path).trim())
      }
      
      if (data.attachments && Array.isArray(data.attachments)) {
        data.attachments.forEach((file) => {
          if (file instanceof File) {
            formData.append('attachments', file)
          }
        })
      }

      const response = await api.post('/api/bug-reports', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      const raw = response.data ?? {}
      return {
        id: String(raw.id ?? ''),
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        reported_by: raw.reported_by ? {
          id: String(raw.reported_by.id ?? ''),
          username: raw.reported_by.username ? String(raw.reported_by.username) : undefined
        } : undefined,
        company_id: raw.company_id ? String(raw.company_id) : undefined,
        severity: (['low', 'medium', 'high', 'critical'].includes(raw.severity) ? raw.severity : 'medium') as BugReport['severity'],
        category: (['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other'].includes(raw.category) ? raw.category : 'other') as BugReport['category'],
        status: (['open', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(raw.status) ? raw.status : 'open') as BugReport['status'],
        priority: raw.priority != null ? Number(raw.priority) : undefined,
        browser: raw.browser ? String(raw.browser) : undefined,
        device: raw.device ? String(raw.device) : undefined,
        url_path: raw.url_path ? String(raw.url_path) : undefined,
        attachments: Array.isArray(raw.attachments) ? raw.attachments.map((a: unknown) => String(a ?? '')) : undefined,
        comments: Array.isArray(raw.comments) ? raw.comments.map((c: unknown) => {
          const comment = c as { user_id?: unknown; username?: unknown; comment?: unknown; timestamp?: unknown }
          return {
            user_id: String(comment.user_id ?? ''),
            username: comment.username ? String(comment.username) : undefined,
            comment: String(comment.comment ?? ''),
            timestamp: String(comment.timestamp ?? '')
          }
        }) : undefined,
        resolved_by: raw.resolved_by ? String(raw.resolved_by) : undefined,
        resolved_at: raw.resolved_at ? String(raw.resolved_at) : undefined,
        resolution_notes: raw.resolution_notes ? String(raw.resolution_notes) : undefined,
        created_at: raw.created_at ? String(raw.created_at) : undefined,
        updated_at: raw.updated_at ? String(raw.updated_at) : undefined
      }
    } catch (error) {
      return handleApiError(error, 'Failed to submit bug report')
    }
  },

  listBugReports: async (params?: {
    status?: string
    severity?: string
    category?: string
    search?: string
    page?: number
    per_page?: number
  }): Promise<BugReportListResponse> => {
    try {
      const response = await api.get('/api/bug-reports', { params })
      const raw = response.data ?? {}
      return {
        bug_reports: Array.isArray(raw.bug_reports) ? raw.bug_reports.map((br: unknown) => {
          const report = br as Record<string, unknown>
          return {
            id: String(report.id ?? ''),
            title: String(report.title ?? ''),
            description: String(report.description ?? ''),
            severity: (['low', 'medium', 'high', 'critical'].includes(report.severity) ? report.severity : 'medium') as BugReport['severity'],
            category: (['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other'].includes(report.category) ? report.category : 'other') as BugReport['category'],
            status: (['open', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(report.status) ? report.status : 'open') as BugReport['status']
          } as BugReport
        }) : [],
        total: Number(raw.total ?? 0),
        page: Number(raw.page ?? 1),
        per_page: Number(raw.per_page ?? 20),
        pages: Number(raw.pages ?? 1)
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch bug reports')
    }
  },

  getBugReport: async (bugId: string): Promise<BugReport> => {
    try {
      const bid = String(bugId ?? '').trim()
      if (!bid) throw new Error('Missing bugId')
      
      const response = await api.get(`/api/bug-reports/${encodeURIComponent(bid)}`)
      const raw = response.data ?? {}
      return {
        id: String(raw.id ?? ''),
        title: String(raw.title ?? ''),
        description: String(raw.description ?? ''),
        reported_by: raw.reported_by ? {
          id: String(raw.reported_by.id ?? ''),
          username: raw.reported_by.username ? String(raw.reported_by.username) : undefined
        } : undefined,
        company_id: raw.company_id ? String(raw.company_id) : undefined,
        severity: (['low', 'medium', 'high', 'critical'].includes(raw.severity) ? raw.severity : 'medium') as BugReport['severity'],
        category: (['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other'].includes(raw.category) ? raw.category : 'other') as BugReport['category'],
        status: (['open', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(raw.status) ? raw.status : 'open') as BugReport['status'],
        priority: raw.priority != null ? Number(raw.priority) : undefined,
        browser: raw.browser ? String(raw.browser) : undefined,
        device: raw.device ? String(raw.device) : undefined,
        url_path: raw.url_path ? String(raw.url_path) : undefined,
        attachments: Array.isArray(raw.attachments) ? raw.attachments.map((a: unknown) => String(a ?? '')) : undefined,
        comments: Array.isArray(raw.comments) ? raw.comments.map((c: unknown) => {
          const comment = c as { user_id?: unknown; username?: unknown; comment?: unknown; timestamp?: unknown }
          return {
            user_id: String(comment.user_id ?? ''),
            username: comment.username ? String(comment.username) : undefined,
            comment: String(comment.comment ?? ''),
            timestamp: String(comment.timestamp ?? '')
          }
        }) : undefined,
        resolved_by: raw.resolved_by ? String(raw.resolved_by) : undefined,
        resolved_at: raw.resolved_at ? String(raw.resolved_at) : undefined,
        resolution_notes: raw.resolution_notes ? String(raw.resolution_notes) : undefined,
        created_at: raw.created_at ? String(raw.created_at) : undefined,
        updated_at: raw.updated_at ? String(raw.updated_at) : undefined
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch bug report')
    }
  },

  updateBugReport: async (
    bugId: string,
    data: Partial<{
      title: string
      description: string
      severity: 'low' | 'medium' | 'high' | 'critical'
      category: 'ui' | 'api' | 'performance' | 'data' | 'security' | 'feature_request' | 'other'
      status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix'
      priority: number
      resolution_notes: string
    }>
  ): Promise<BugReport> => {
    try {
      const bid = String(bugId ?? '').trim()
      if (!bid) throw new Error('Missing bugId')
      
      const payload: Record<string, unknown> = {}
      if (data.title != null) payload.title = String(data.title).trim()
      if (data.description != null) payload.description = String(data.description).trim()
      if (data.severity != null) payload.severity = data.severity
      if (data.category != null) payload.category = data.category
      if (data.status != null) payload.status = data.status
      if (data.priority != null) payload.priority = Number(data.priority)
      if (data.resolution_notes != null) payload.resolution_notes = String(data.resolution_notes).trim()

      const response = await api.put(`/api/bug-reports/${encodeURIComponent(bid)}`, payload)
      const raw = response.data ?? {}
      return {
        id: String(raw.id ?? bid),
        title: String(raw.title ?? data.title ?? ''),
        description: String(raw.description ?? data.description ?? ''),
        severity: (['low', 'medium', 'high', 'critical'].includes(raw.severity) ? raw.severity : 'medium') as BugReport['severity'],
        category: (['ui', 'api', 'performance', 'data', 'security', 'feature_request', 'other'].includes(raw.category) ? raw.category : 'other') as BugReport['category'],
        status: (['open', 'in_progress', 'resolved', 'closed', 'wont_fix'].includes(raw.status) ? raw.status : 'open') as BugReport['status']
      } as BugReport
    } catch (error) {
      return handleApiError(error, 'Failed to update bug report')
    }
  },

  deleteBugReport: async (bugId: string): Promise<void> => {
    try {
      const bid = String(bugId ?? '').trim()
      if (!bid) throw new Error('Missing bugId')
      await api.delete(`/api/bug-reports/${encodeURIComponent(bid)}`)
    } catch (error) {
      return handleApiError(error, 'Failed to delete bug report')
    }
  },

  addBugReportComment: async (bugId: string, comment: string): Promise<BugReportComment> => {
    try {
      const bid = String(bugId ?? '').trim()
      if (!bid) throw new Error('Missing bugId')
      const commentText = String(comment ?? '').trim()
      if (!commentText) throw new Error('Comment is required')
      
      const response = await api.post(`/api/bug-reports/${encodeURIComponent(bid)}/comments`, {
        comment: commentText
      })
      const raw = response.data ?? {}
      return {
        user_id: String(raw.user_id ?? ''),
        username: raw.username ? String(raw.username) : undefined,
        comment: String(raw.comment ?? commentText),
        timestamp: String(raw.timestamp ?? new Date().toISOString())
      }
    } catch (error) {
      return handleApiError(error, 'Failed to add comment')
    }
  },

  getBugReportComments: async (bugId: string): Promise<{ comments: BugReportComment[]; count: number }> => {
    try {
      const bid = String(bugId ?? '').trim()
      if (!bid) throw new Error('Missing bugId')
      
      const response = await api.get(`/api/bug-reports/${encodeURIComponent(bid)}/comments`)
      const raw = response.data ?? {}
      return {
        comments: Array.isArray(raw.comments) ? raw.comments.map((c: unknown) => {
          const comment = c as { user_id?: unknown; username?: unknown; comment?: unknown; timestamp?: unknown }
          return {
            user_id: String(comment.user_id ?? ''),
            username: comment.username ? String(comment.username) : undefined,
            comment: String(comment.comment ?? ''),
            timestamp: String(comment.timestamp ?? '')
          }
        }) : [],
        count: Number(raw.count ?? 0)
      }
    } catch (error) {
      return handleApiError(error, 'Failed to fetch comments')
    }
  },
};
