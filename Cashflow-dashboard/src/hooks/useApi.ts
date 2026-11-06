import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSyncExternalStore } from 'react'
import {
  dashboardApi,
  financialApi,
  transactionApi,
  type CreateTransactionRequest,
  type UpdateTransactionRequest,
  type CreateForecastRequest,
  reportsApi,
  forecastApi,
  workingCapitalApi,
  budgetApi,
  aiApi,
  reconciliationApi,
  drawingsApi,
  salaryApi,
  invoicesApi,
  type CreateBudgetRequest,
  type UpdateBudgetRequest,
  type CreateReceivableRequest,
  type UpdateReceivableRequest,
  type CreatePayableRequest,
  type UpdatePayableRequest,
  type CreateInventoryRequest,
  type UpdateInventoryRequest,
  type CreateBankStatementRequest,
  type CreateDrawingRequest,
  type UpdateEquityAccountRequest,
  type CreateEmployeeRequest,
  type UpdateEmployeeRequest,
  type CreateSalaryPaymentRequest,
  type CreateExpenseAccountRequest,
  type UpdateExpenseAccountRequest,
  type InvoiceStatus,
  type InvoiceLineItem,
  bugReportApi,
  type BugReport,
  type BugReportComment,
} from '@/lib/api'
import { getDefaultCompanyId } from '@/lib/auth'

export function useDefaultCompanyId() {
  return useSyncExternalStore(
    (onStoreChange) => {
      const handler = () => onStoreChange()
      window.addEventListener('storage', handler)
      window.addEventListener('company-id-changed', handler as EventListener)
      return () => {
        window.removeEventListener('storage', handler)
        window.removeEventListener('company-id-changed', handler as EventListener)
      }
    },
    () => getDefaultCompanyId() || '',
    () => ''
  )
}

export function useCompanyId(providedCompanyId?: string) {
  const stored = useDefaultCompanyId()
  return providedCompanyId || stored || ''
}

export function useDashboardKpis(companyId?: string) {
  const cid = useCompanyId(companyId)
  
  return useQuery({
    queryKey: ['dashboard-kpis', cid],
    queryFn: () => dashboardApi.getKPIs(cid),
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useDashboardSpeech(
  companyId?: string,
  style?: 'conversational' | 'formal' | 'brief'
) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['dashboard-speech', cid, style ?? 'conversational'],
    queryFn: () => dashboardApi.getDashboardSpeech(cid, style),
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useMonthlyBalances(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['monthly-balances', cid],
    queryFn: () => financialApi.getMonthlyBalances(cid),
    select: (data: any) => {
      // Handle multiple shapes: array of {month,balance} OR {labels,balances} OR nested in data
      if (Array.isArray(data)) {
        // If already array of objects
        const arr = data as any[]
        if (arr.length && typeof arr[0] === 'object' && 'month' in arr[0]) {
          return arr.map((it: any) => ({ month: String(it.month ?? ''), balance: Number(it.balance ?? 0) }))
        }
        // If array of numbers; synthesize labels
        return arr.map((v: any, i: number) => ({ month: String(i + 1), balance: Number(v ?? 0) }))
      }
      const labels: string[] = data?.labels || data?.data?.labels || []
      const balances: number[] = data?.balances || data?.data?.balances || []
      return labels.map((label, i) => ({ month: label, balance: Number(balances[i] ?? 0) }))
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useMonthlyIncomeExpense(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['monthly-income-expense', cid],
    queryFn: () => financialApi.getMonthlyIncomeExpense(cid),
    select: (data: any) => {
      // Backend returns: { success: true, data: { labels: [], income: [], expense: [] } }
      const labels: string[] = data?.labels || data?.data?.labels || []
      const income: number[] = data?.income || data?.data?.income || []
      // Backend uses 'expense' (singular) in the response
      const expense: number[] = data?.expenses || data?.expense || data?.data?.expense || data?.data?.expenses || []
      
      // Debug: log if no data
      if (labels.length === 0 && income.length === 0 && expense.length === 0) {
        console.log('Monthly income/expense data:', data)
      }
      
      return labels.map((label, i) => ({ 
        month: label, 
        income: income[i] ?? 0, 
        expenses: expense[i] ?? 0 
      }))
    },
    enabled: Boolean(cid),
    staleTime: 30_000, // Refresh more frequently
    refetchOnWindowFocus: true, // Refetch when window regains focus
  })
}

export function useRecentTransactions(companyId?: string, page = 1, perPage = 10) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['transactions', cid, page, perPage],
    queryFn: () => transactionApi.getTransactions(cid, page, perPage),
    select: (data: any) => {
      const raw = data || {}
      const items: any[] = Array.isArray(raw.transactions) ? raw.transactions : []

      const normalized = items.map((t: any) => {
        let obj: any = t
        if (typeof t === 'string') {
          try { obj = JSON.parse(t) } catch { obj = t }
        }
        const id = obj._id?.$oid || obj.id || ''
        const companyId = obj.company_id?.$oid || obj.company_id || cid
        const dateVal = obj.date?.$date ?? obj.date
        const createdVal = obj.created_at?.$date ?? obj.created_at
        const updatedVal = obj.updated_at?.$date ?? obj.updated_at

        const toIso = (v: any) => {
          if (typeof v === 'number') {
            const d = new Date(v)
            return isNaN(d.getTime()) ? '' : d.toISOString()
          }
          if (typeof v === 'string') {
            const d = new Date(v)
            return isNaN(d.getTime()) ? v : d.toISOString()
          }
          return ''
        }

        return {
          id,
          company_id: companyId,
          date: toIso(dateVal),
          description: obj.description ?? '',
          amount: Number(obj.amount ?? 0),
          type: (obj.type === 'outflow' ? 'outflow' : 'inflow') as 'inflow' | 'outflow',
          category: obj.category ?? '',
          currency: obj.currency ?? '',
          created_at: toIso(createdVal),
          enhanced_description: obj.enhanced_description,
          updated_at: toIso(updatedVal),
        }
      })

      return { ...raw, transactions: normalized }
    },
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useTransactions(companyId?: string, page = 1, perPage = 10) {
  return useRecentTransactions(companyId, page, perPage)
}

export function useCreateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payload: CreateTransactionRequest) => transactionApi.createTransaction(payload),
    onSuccess: (_data, variables) => {
      const cid = variables.company_id
      queryClient.invalidateQueries({ queryKey: ['transactions', cid] })
      queryClient.invalidateQueries({ queryKey: ['monthly-income-expense', cid] })
      queryClient.invalidateQueries({ queryKey: ['monthly-balances', cid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', cid] })
      queryClient.invalidateQueries({ queryKey: ['cash-overview', cid] })
      queryClient.invalidateQueries({ queryKey: ['cash-activities', cid] })
    },
  })
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { transactionId: string; companyId: string; data: UpdateTransactionRequest }) =>
      transactionApi.updateTransaction(args.transactionId, args.companyId, args.data),
    onSuccess: (_d, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['transactions', cid] })
      queryClient.invalidateQueries({ queryKey: ['monthly-income-expense', cid] })
      queryClient.invalidateQueries({ queryKey: ['monthly-balances', cid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', cid] })
      queryClient.invalidateQueries({ queryKey: ['cash-overview', cid] })
      queryClient.invalidateQueries({ queryKey: ['cash-activities', cid] })
    },
  })
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { transactionId: string; companyId: string }) =>
      transactionApi.deleteTransaction(args.transactionId, args.companyId),
    onSuccess: (_d, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['transactions', cid] })
      queryClient.invalidateQueries({ queryKey: ['monthly-income-expense', cid] })
      queryClient.invalidateQueries({ queryKey: ['monthly-balances', cid] })
      queryClient.invalidateQueries({ queryKey: ['dashboard-kpis', cid] })
      queryClient.invalidateQueries({ queryKey: ['cash-overview', cid] })
      queryClient.invalidateQueries({ queryKey: ['cash-activities', cid] })
    },
  })
}

export function useCashOverview(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['cash-overview', cid],
    queryFn: () => financialApi.getCashOverview(cid),
    select: (data: any) => {
      // Backend returns: { total_cfo, total_cfi, total_cff, balance, initial_balance, burn_rate, runway_months }
      if (!data) {
        return {
          current_balance: 0,
          burn_rate: 0,
          runway_months: null,
          total_cfo: 0,
          total_cfi: 0,
          total_cff: 0,
          initial_balance: 0,
        }
      }
      
      // Handle Infinity values
      const runwayMonthsValue = data.runway_months
      const isInfinity = runwayMonthsValue === Infinity || 
                        runwayMonthsValue === Number.POSITIVE_INFINITY ||
                        runwayMonthsValue === 1.7976931348623157e+308 ||
                        runwayMonthsValue === 'Infinity' ||
                        String(runwayMonthsValue) === 'Infinity'
      
      return {
        current_balance: Number(data.balance ?? 0),
        burn_rate: Number(data.burn_rate ?? 0),
        runway_months: isInfinity ? null : (Number(data.runway_months) ?? null),
        total_cfo: Number(data.total_cfo ?? 0),
        total_cfi: Number(data.total_cfi ?? 0),
        total_cff: Number(data.total_cff ?? 0),
        initial_balance: Number(data.initial_balance ?? 0),
      }
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useCashoutCategories(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['cashout-categories', cid],
    queryFn: () => financialApi.getCashoutByCategories(cid),
    select: (data: any) => {
      // Backend returns: { success: true, data: { labels: [], amounts: [] } }
      const labels: string[] = data?.data?.labels || data?.labels || []
      const amounts: number[] = data?.data?.amounts || data?.amounts || []
      return labels.map((name, i) => ({ 
        name: String(name || 'Unknown'), 
        value: Number(amounts[i] ?? 0),
        fill: `hsl(${(i * 137.5) % 360}, 70%, 50%)` // Generate colors for pie chart
      }))
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useGenerateCashflowStatement() {
  return useMutation({
    mutationFn: async (companyId: string) => {
      const blob = await reportsApi.generateCashflowStatement(companyId)
      // Create download link
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `cash_flow_statement_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      window.URL.revokeObjectURL(url)
      return blob
    },
    onSuccess: () => {
      // Optionally invalidate related queries if needed
    },
  })
}

export function useCashActivities(companyId?: string, page = 1, perPage = 5) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['cash-activities', cid, page, perPage],
    queryFn: () => financialApi.getCashActivities(cid, page, perPage),
    select: (data: any) => {
      const items: any[] = Array.isArray(data?.transactions) ? data.transactions : []
      const mapped = items.map((t) => ({
        id: t.id,
        date: t.date,
        description: t.description,
        type: t.type,
        amount: Number(t.amount ?? 0),
        category: t.category,
        currency: t.currency,
      }))
      return {
        items: mapped,
        page: Number(data?.page ?? 1),
        pages: Number(data?.pages ?? 1),
        per_page: Number(data?.per_page ?? perPage),
        total: Number(data?.total ?? mapped.length),
      }
    },
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useCashflowStatementData(companyId?: string, category?: string, subcategory?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['cashflow-statement-data', cid, category, subcategory],
    queryFn: () => reportsApi.getCashFlowStatementData(cid!, category!, subcategory!),
    enabled: Boolean(cid && category && subcategory),
    staleTime: 60_000,
  })
}

export function useForecasts(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['forecasts', cid],
    queryFn: () => forecastApi.getForecasts(cid),
    select: (data: any) => {
      // Backend returns: { forecasts: [...], company_id: ... }
      const forecastsArray = Array.isArray(data) ? data : (data?.forecasts || [])
      
      return forecastsArray.map((forecast: any) => {
        // Handle string responses
        if (typeof forecast === 'string') {
          try {
            forecast = JSON.parse(forecast)
          } catch {
            return null
          }
        }
        
        // Handle MongoDB ObjectId format
        const getId = (obj: any) => {
          if (typeof obj === 'string') return obj
          if (obj?.$oid) return obj.$oid
          if (obj?.id) return String(obj.id)
          return ''
        }
        
        const getDate = (obj: any) => {
          if (!obj) return null
          if (typeof obj === 'string') {
            const d = new Date(obj)
            return isNaN(d.getTime()) ? null : obj
          }
          if (obj.$date) {
            // MongoDB date format: {"$date": timestamp}
            return new Date(obj.$date).toISOString()
          }
          if (obj instanceof Date) return obj.toISOString()
          return String(obj)
        }
        
        // Parse projections if it's a string
        let projections = forecast.projections || {}
        if (typeof projections === 'string') {
          try {
            projections = JSON.parse(projections)
          } catch {
            projections = {}
          }
        }
        
        return {
          id: getId(forecast._id || forecast.id),
          company_id: getId(forecast.company_id) || cid,
          scenario_name: String(forecast.scenario_name || 'Unnamed Forecast'),
          projections: projections,
          type: forecast.type || 'manual',
          created_at: getDate(forecast.created_at),
        }
      }).filter((f: any) => f !== null) // Remove null entries
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useAIForecast(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['ai-forecast', cid],
    queryFn: () => forecastApi.getAIForecast(cid),
    select: (data: any) => {
      // Backend returns: { success, ai_analysis, patterns, forecasts: { '90_days': [...] }, risk_metrics }
      // Also handle the format from forecastApi.getAIForecast which might return { forecast: [...], patterns, risks, recommendations }
      if (!data) return null
      
      // If it's already in the expected format, return as is
      if (data.forecast || data.forecasts || data.patterns) {
        return data
      }
      
      // Otherwise, try to normalize the response
      return {
        ...data,
        forecasts: data.forecasts || data.forecast || {},
        patterns: data.patterns || [],
        risks: data.risks || [],
        recommendations: data.recommendations || [],
        risk_metrics: data.risk_metrics || {},
        ai_analysis: data.ai_analysis || '',
      }
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
    retry: 1, // Only retry once for AI forecast
  })
}

export function useCreateForecastFromSpeech() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: async (vars: {
      companyId: string
      transcript: string
      context?: string
      scenarioName?: string
    }) => {
      return forecastApi.createForecastFromSpeech(vars.companyId, {
        transcript: vars.transcript,
        context: vars.context,
        scenario_name: vars.scenarioName,
      })
    },
    onSuccess: async (_data, vars) => {
      const cid = String(vars?.companyId ?? '').trim()
      if (cid) {
        await qc.invalidateQueries({ queryKey: ['forecasts', cid] })
      }
    },
  })
}

export function useInvoices(
  companyId?: string,
  params?: { status?: InvoiceStatus; page?: number; per_page?: number }
) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['invoices', cid, params?.status ?? 'all', params?.page ?? 1, params?.per_page ?? 20],
    queryFn: () => invoicesApi.listInvoices(cid, params),
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useInvoiceSpeech(
  companyId?: string,
  invoiceId?: string,
  style?: 'conversational' | 'formal' | 'executive'
) {
  const cid = useCompanyId(companyId)
  const iid = String(invoiceId ?? '').trim()
  return useQuery({
    queryKey: ['invoice-speech', cid, iid, style ?? 'conversational'],
    queryFn: () => invoicesApi.getInvoiceSpeech(cid, iid, style),
    enabled: Boolean(cid && iid),
    staleTime: 60_000,
  })
}

export function useInvoiceSummary(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['invoice-summary', cid],
    queryFn: () => invoicesApi.getInvoiceSummary(cid),
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useCreateInvoice() {
  const qc = useQueryClient()
  const companyId = useDefaultCompanyId()
  return useMutation({
    mutationFn: async (vars: {
      companyId: string
      customer_name: string
      customer_email?: string
      template_id?: string
      due_date?: string
      tax_rate?: number
      line_items: InvoiceLineItem[]
    }) => {
      return invoicesApi.createInvoice(vars.companyId, {
        customer_name: vars.customer_name,
        customer_email: vars.customer_email,
        template_id: vars.template_id,
        due_date: vars.due_date,
        tax_rate: vars.tax_rate,
        line_items: vars.line_items,
      })
    },
    onSuccess: async (_data, vars) => {
      const cid = String(vars?.companyId ?? '').trim() || companyId
      if (cid) {
        await qc.invalidateQueries({ queryKey: ['invoices', cid] })
        await qc.invalidateQueries({ queryKey: ['invoice-summary', cid] })
      }
    },
  })
}

export function useUpdateInvoice() {
  const qc = useQueryClient()
  const companyId = useDefaultCompanyId()
  return useMutation({
    mutationFn: async (vars: {
      companyId: string
      invoiceId: string
      status?: InvoiceStatus
      payment_method?: string
      notes?: string
    }) => {
      return invoicesApi.updateInvoice(vars.companyId, vars.invoiceId, {
        status: vars.status,
        payment_method: vars.payment_method,
        notes: vars.notes,
      })
    },
    onSuccess: async (_data, vars) => {
      const cid = String(vars?.companyId ?? '').trim() || companyId
      const iid = String(vars?.invoiceId ?? '').trim()
      if (cid) {
        await qc.invalidateQueries({ queryKey: ['invoices', cid] })
        await qc.invalidateQueries({ queryKey: ['invoice-summary', cid] })
      }
      if (cid && iid) {
        await qc.invalidateQueries({ queryKey: ['invoice', cid, iid] })
        await qc.invalidateQueries({ queryKey: ['invoice-speech', cid, iid] })
      }
    },
  })
}

export function useDeleteInvoice() {
  const qc = useQueryClient()
  const companyId = useDefaultCompanyId()
  return useMutation({
    mutationFn: async (vars: { companyId: string; invoiceId: string }) => {
      return invoicesApi.deleteInvoice(vars.companyId, vars.invoiceId)
    },
    onSuccess: async (_data, vars) => {
      const cid = String(vars?.companyId ?? '').trim() || companyId
      if (cid) {
        await qc.invalidateQueries({ queryKey: ['invoices', cid] })
        await qc.invalidateQueries({ queryKey: ['invoice-summary', cid] })
      }
    },
  })
}

export function useInvoice(companyId?: string, invoiceId?: string) {
  const cid = useCompanyId(companyId)
  const iid = String(invoiceId ?? '').trim()
  return useQuery({
    queryKey: ['invoice', cid, iid],
    queryFn: () => invoicesApi.getInvoice(cid, iid),
    enabled: Boolean(cid && iid),
    staleTime: 60_000,
  })
}

export function useCreateForecast() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (forecastData: CreateForecastRequest) => forecastApi.createForecast(forecastData),
    onSuccess: (_data, variables) => {
      const cid = variables.company_id
      queryClient.invalidateQueries({ queryKey: ['forecasts', cid] })
    },
  })
}

// Working Capital Hooks
export function useReceivables(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['receivables', cid],
    queryFn: () => workingCapitalApi.getReceivables(cid),
    select: (data) => {
      if (!Array.isArray(data)) return []
      return data.map((item: any) => {
        // Handle JSON string responses from backend
        let parsed: any = item
        if (typeof item === 'string') {
          try {
            parsed = JSON.parse(item)
          } catch {
            parsed = item
          }
        }
        
        // Extract MongoDB ObjectId format
        const getId = (obj: any) => {
          if (typeof obj === 'string') return obj
          if (obj?.$oid) return obj.$oid
          if (obj?.id) return String(obj.id)
          return ''
        }
        
        const getDate = (obj: any) => {
          if (!obj) return ''
          if (typeof obj === 'string') return obj
          if (obj.$date) {
            // MongoDB date format: {"$date": timestamp}
            return new Date(obj.$date).toISOString()
          }
          if (obj instanceof Date) return obj.toISOString()
          return String(obj)
        }
        
        const description = String(parsed.description || '')
        
        return {
          id: getId(parsed._id || parsed.id),
          company_id: getId(parsed.company_id || cid),
          amount: Number(parsed.amount ?? 0),
          due_date: getDate(parsed.due_date),
          status: (parsed.status === 'paid' ? 'paid' : parsed.status === 'overdue' ? 'overdue' : 'pending') as 'pending' | 'overdue' | 'paid',
          description: description || undefined,
        }
      })
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function usePayables(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['payables', cid],
    queryFn: () => workingCapitalApi.getPayables(cid),
    select: (data) => {
      if (!Array.isArray(data)) return []
      return data.map((item: any) => {
        // Handle JSON string responses from backend
        let parsed: any = item
        if (typeof item === 'string') {
          try {
            parsed = JSON.parse(item)
          } catch {
            parsed = item
          }
        }
        
        // Extract MongoDB ObjectId format
        const getId = (obj: any) => {
          if (typeof obj === 'string') return obj
          if (obj?.$oid) return obj.$oid
          if (obj?.id) return String(obj.id)
          return ''
        }
        
        const getDate = (obj: any) => {
          if (!obj) return ''
          if (typeof obj === 'string') return obj
          if (obj.$date) {
            // MongoDB date format: {"$date": timestamp}
            return new Date(obj.$date).toISOString()
          }
          if (obj instanceof Date) return obj.toISOString()
          return String(obj)
        }
        
        const description = String(parsed.description || '')
        
        return {
          id: getId(parsed._id || parsed.id),
          company_id: getId(parsed.company_id || cid),
          amount: Number(parsed.amount ?? 0),
          due_date: getDate(parsed.due_date),
          status: (parsed.status === 'paid' ? 'paid' : parsed.status === 'overdue' ? 'overdue' : 'pending') as 'pending' | 'overdue' | 'paid',
          description: description || undefined,
        }
      })
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useInventory(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['inventory', cid],
    queryFn: () => workingCapitalApi.getInventory(cid),
    select: (data) => {
      if (!Array.isArray(data)) return []
      return data.map((item: any) => {
        // Handle JSON string responses from backend
        let parsed: any = item
        if (typeof item === 'string') {
          try {
            parsed = JSON.parse(item)
          } catch {
            parsed = item
          }
        }
        
        // Extract MongoDB ObjectId format
        const getId = (obj: any) => {
          if (typeof obj === 'string') return obj
          if (obj?.$oid) return obj.$oid
          if (obj?.id) return String(obj.id)
          return ''
        }
        
        const getDate = (obj: any) => {
          if (!obj) return ''
          if (typeof obj === 'string') return obj
          if (obj.$date) {
            // MongoDB date format: {"$date": timestamp}
            return new Date(obj.$date).toISOString()
          }
          if (obj instanceof Date) return obj.toISOString()
          return String(obj)
        }
        
        const quantity = Number(parsed.quantity ?? 0)
        const totalValue = Number(parsed.value ?? 0)
        const unitCost = quantity > 0 ? totalValue / quantity : 0
        
        return {
          id: getId(parsed._id || parsed.id),
          company_id: getId(parsed.company_id || cid),
          item_name: String(parsed.item_name || 'Unknown'),
          quantity: quantity,
          unit_cost: unitCost,
          total_value: totalValue,
          last_updated: getDate(parsed.last_updated),
        }
      })
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useAgingReport(companyId?: string, type: 'receivables' | 'payables' = 'receivables') {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['aging-report', cid, type],
    queryFn: () => workingCapitalApi.getAgingReport(cid, type),
    select: (data: any) => {
      // Backend returns: { report: { "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }, company_id, type }
      const report = data?.report || data
      const days0to30 = Number(report?.['0-30'] ?? report?.days_1_30 ?? report?.current ?? 0)
      const days31to60 = Number(report?.['31-60'] ?? report?.days_31_60 ?? 0)
      const days61to90 = Number(report?.['61-90'] ?? report?.days_61_90 ?? 0)
      const days90Plus = Number(report?.['90+'] ?? report?.days_90_plus ?? 0)
      const total = days0to30 + days31to60 + days61to90 + days90Plus
      
      return {
        '0-30': days0to30,
        '31-60': days31to60,
        '61-90': days61to90,
        '90+': days90Plus,
        total,
      }
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

// Budgeting Hooks
export function useBudgets(companyId?: string, period?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['budgets', cid, period],
    queryFn: () => budgetApi.getBudgets(cid, period),
    select: (data: any) => {
      if (!Array.isArray(data)) return []
      return data.map((item: any) => {
        // Backend now returns properly serialized data with all fields
        return {
          id: String(item.id || ''),
          company_id: String(item.company_id || cid),
          category: String(item.category || 'Unknown'),
          amount: Number(item.amount ?? 0),
          period: String(item.period || ''),
          spent: Number(item.spent ?? 0),
          remaining: Number(item.remaining ?? (Number(item.amount ?? 0) - Number(item.spent ?? 0))),
          created_at: item.created_at ? (typeof item.created_at === 'string' ? item.created_at : new Date(item.created_at).toISOString()) : '',
        }
      })
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useBudgetVariances(companyId?: string, period?: string) {
  const cid = useCompanyId(companyId)
  const { data: budgets } = useBudgets(cid, period)
  
  return useQuery({
    queryKey: ['budget-variances', cid, period],
    queryFn: () => budgetApi.getBudgetVariances(cid, period || ''),
    select: (data: any) => {
      // Backend returns: { variance: { category: variance_amount }, company_id, period }
      // variance = budgeted - actual, so actual = budgeted - variance
      const varianceDict = data?.variance || {}
      
      // Create a map of category to budgeted amount
      const budgetMap = new Map<string, number>()
      budgets?.forEach(budget => {
        budgetMap.set(budget.category, budget.amount)
      })
      
      // Convert dictionary to array format with calculated values
      return Object.entries(varianceDict).map(([category, varianceAmount]: [string, any]) => {
        const varianceValue = Number(varianceAmount ?? 0)
        const budgeted = budgetMap.get(category) || 0
        const actual = budgeted - varianceValue // variance = budgeted - actual
        const variancePercentage = budgeted > 0 ? (varianceValue / budgeted) * 100 : 0
        
        return {
          category: String(category),
          budgeted,
          actual,
          variance: varianceValue,
          variance_percentage: variancePercentage,
        }
      })
    },
    enabled: Boolean(cid && period),
    staleTime: 60_000,
  })
}

export function useCreateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (budgetData: CreateBudgetRequest) => budgetApi.createBudget(budgetData),
    onSuccess: (_data, variables) => {
      const cid = variables.company_id
      queryClient.invalidateQueries({ queryKey: ['budgets', cid] })
      queryClient.invalidateQueries({ queryKey: ['budget-variances', cid] })
    },
  })
}

export function useUpdateBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { budgetId: string; companyId: string; data: UpdateBudgetRequest }) =>
      budgetApi.updateBudget(args.budgetId, args.companyId, args.data),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['budgets', cid] })
      queryClient.invalidateQueries({ queryKey: ['budget-variances', cid] })
    },
  })
}

export function useDeleteBudget() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { budgetId: string; companyId: string }) =>
      budgetApi.deleteBudget(args.budgetId, args.companyId),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['budgets', cid] })
      queryClient.invalidateQueries({ queryKey: ['budget-variances', cid] })
    },
  })
}

// Working Capital Mutations
export function useCreateReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (receivableData: CreateReceivableRequest) => workingCapitalApi.createReceivable(receivableData),
    onSuccess: (_data, variables) => {
      const cid = variables.company_id
      queryClient.invalidateQueries({ queryKey: ['receivables', cid] })
      queryClient.invalidateQueries({ queryKey: ['aging-report', cid] })
    },
  })
}

export function useUpdateReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { receivableId: string; companyId: string; data: UpdateReceivableRequest }) =>
      workingCapitalApi.updateReceivable(args.receivableId, args.companyId, args.data),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['receivables', cid] })
      queryClient.invalidateQueries({ queryKey: ['aging-report', cid] })
    },
  })
}

export function useDeleteReceivable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { receivableId: string; companyId: string }) =>
      workingCapitalApi.deleteReceivable(args.receivableId, args.companyId),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['receivables', cid] })
      queryClient.invalidateQueries({ queryKey: ['aging-report', cid] })
    },
  })
}

export function useCreatePayable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (payableData: CreatePayableRequest) => workingCapitalApi.createPayable(payableData),
    onSuccess: (_data, variables) => {
      const cid = variables.company_id
      queryClient.invalidateQueries({ queryKey: ['payables', cid] })
      queryClient.invalidateQueries({ queryKey: ['aging-report', cid] })
    },
  })
}

export function useUpdatePayable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { payableId: string; companyId: string; data: UpdatePayableRequest }) =>
      workingCapitalApi.updatePayable(args.payableId, args.companyId, args.data),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['payables', cid] })
      queryClient.invalidateQueries({ queryKey: ['aging-report', cid] })
    },
  })
}

export function useDeletePayable() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { payableId: string; companyId: string }) =>
      workingCapitalApi.deletePayable(args.payableId, args.companyId),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['payables', cid] })
      queryClient.invalidateQueries({ queryKey: ['aging-report', cid] })
    },
  })
}

export function useCreateInventory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (inventoryData: CreateInventoryRequest) => workingCapitalApi.createInventory(inventoryData),
    onSuccess: (_data, variables) => {
      const cid = variables.company_id
      queryClient.invalidateQueries({ queryKey: ['inventory', cid] })
    },
  })
}

export function useUpdateInventory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { inventoryId: string; companyId: string; data: UpdateInventoryRequest }) =>
      workingCapitalApi.updateInventory(args.inventoryId, args.companyId, args.data),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['inventory', cid] })
    },
  })
}

export function useDeleteInventory() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { inventoryId: string; companyId: string }) =>
      workingCapitalApi.deleteInventory(args.inventoryId, args.companyId),
    onSuccess: (_data, variables) => {
      const cid = variables.companyId
      queryClient.invalidateQueries({ queryKey: ['inventory', cid] })
    },
  })
}

// AI Features Hooks
export function useAIChat() {
  return useMutation({
    mutationFn: (chatData: { query: string; company_id: string }) => aiApi.chat(chatData),
  })
}

export function useAIInsights(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['ai-insights', cid],
    queryFn: async () => {
      if (!cid || typeof cid !== 'string' || cid.trim() === '') {
        console.warn('useAIInsights: No company ID provided')
        return []
      }
      try {
        return await aiApi.getInsights(cid)
      } catch (error: unknown) {
        // Return empty array on error instead of throwing
        const errorMessage = (error as { response?: { data?: { error?: string; message?: string }; status?: number }; message?: string })?.response?.data?.error 
          || (error as { response?: { data?: { message?: string }; status?: number }; message?: string })?.response?.data?.message
          || (error as { message?: string })?.message
          || 'Unknown error';
        const status = (error as { response?: { status?: number } })?.response?.status;
        
        console.error('Failed to fetch AI insights:', {
          message: errorMessage,
          status,
          companyId: cid,
          error
        });
        return []
      }
    },
    select: (data: any) => {
      // Handle case where queryFn returns empty array on error
      if (Array.isArray(data) && data.length === 0) {
        return []
      }
      
      // Backend returns: { insights: [...], company_id: ... }
      const insights = Array.isArray(data) ? data : (data?.insights || [])
      
      // Return empty array if no insights
      if (!insights || insights.length === 0) {
        return []
      }
      
      return insights.map((insight: any, index: number) => {
        // Handle different insight formats
        if (typeof insight === 'string') {
          return {
            id: `insight-${index}`,
            type: 'trend' as const,
            title: 'Insight',
            description: insight,
            severity: 'medium' as const,
            generated_at: new Date().toISOString(),
          }
        }
        
        return {
          id: insight.id || `insight-${index}`,
          type: (insight.type || 'trend') as 'trend' | 'anomaly' | 'opportunity' | 'risk',
          title: insight.title || insight.heading || 'Insight',
          description: insight.description || insight.text || insight.content || String(insight),
          severity: (insight.severity || 'medium') as 'low' | 'medium' | 'high',
          generated_at: insight.generated_at || insight.created_at || new Date().toISOString(),
        }
      })
    },
    enabled: Boolean(cid),
    staleTime: 60_000,
    retry: 1, // Only retry once
    retryOnMount: false, // Don't retry on mount if it failed
  })
}

// =============================================================================
// Bank Reconciliation Hooks
// =============================================================================

export function useBankStatements(companyId?: string, page = 1, perPage = 20) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['bank-statements', cid, page, perPage],
    queryFn: () => reconciliationApi.listBankStatements(cid, page, perPage),
    select: (data: any) => {
      const statements = Array.isArray(data?.statements) ? data.statements : []
      return {
        statements: statements.map((s: any) => ({
          id: String(s?.id ?? ''),
          bank_name: String(s?.bank_name ?? ''),
          account_number: String(s?.account_number ?? ''),
          statement_date: (typeof s?.statement_date === 'string') ? s.statement_date : null,
          opening_balance: Number(s?.opening_balance ?? 0),
          closing_balance: Number(s?.closing_balance ?? 0),
          created_at: (typeof s?.created_at === 'string') ? s.created_at : null,
        })),
        total: Number(data?.total ?? statements.length),
        page: Number(data?.page ?? page),
        per_page: Number(data?.per_page ?? perPage),
        pages: Number(data?.pages ?? 1),
        company_id: String(data?.company_id ?? cid),
      }
    },
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useCreateBankStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; payload: CreateBankStatementRequest }) =>
      reconciliationApi.createBankStatement(args.companyId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements', variables.companyId] })
    },
  })
}

export function useBankStatementDetails(companyId?: string, statementId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['bank-statement', cid, statementId],
    queryFn: () => reconciliationApi.getBankStatement(cid, statementId!),
    enabled: Boolean(cid && statementId),
    staleTime: 10_000,
  })
}

export function useDeleteBankStatement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; statementId: string }) =>
      reconciliationApi.deleteBankStatement(args.companyId, args.statementId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statements', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['bank-statement', variables.companyId, variables.statementId] })
    },
  })
}

export function useReconciliationStatus(companyId?: string, statementId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['reconciliation-status', cid, statementId],
    queryFn: () => reconciliationApi.getReconciliationStatus(cid, statementId!),
    enabled: Boolean(cid && statementId),
    staleTime: 10_000,
  })
}

export function useAutoMatchReconciliation() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; statementId: string; dateTolerance?: number }) =>
      reconciliationApi.autoMatch(args.companyId, args.statementId, args.dateTolerance ?? 2),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement', variables.companyId, variables.statementId] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-status', variables.companyId, variables.statementId] })
    },
  })
}

export function usePotentialMatches(companyId?: string, itemId?: string, dateTolerance = 5) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['reconciliation-potential-matches', cid, itemId, dateTolerance],
    queryFn: () => reconciliationApi.getPotentialMatches(cid, itemId!, dateTolerance),
    enabled: Boolean(cid && itemId),
    staleTime: 10_000,
  })
}

export function useManualMatchItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; itemId: string; transaction_id: string; notes?: string; statementId?: string }) =>
      reconciliationApi.manualMatchItem(args.companyId, args.itemId, { transaction_id: args.transaction_id, notes: args.notes }),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-status', variables.companyId] })
      if (variables.statementId) {
        queryClient.invalidateQueries({ queryKey: ['bank-statement', variables.companyId, variables.statementId] })
        queryClient.invalidateQueries({ queryKey: ['reconciliation-status', variables.companyId, variables.statementId] })
      }
    },
  })
}

export function useUnmatchItem() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; itemId: string; statementId?: string }) =>
      reconciliationApi.unmatchItem(args.companyId, args.itemId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['bank-statement', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['reconciliation-status', variables.companyId] })
      if (variables.statementId) {
        queryClient.invalidateQueries({ queryKey: ['bank-statement', variables.companyId, variables.statementId] })
        queryClient.invalidateQueries({ queryKey: ['reconciliation-status', variables.companyId, variables.statementId] })
      }
    },
  })
}

// =============================================================================
// Drawings / Equity Hooks
// =============================================================================

export function useDrawings(companyId?: string, params?: { owner_id?: string; category?: string; start_date?: string; end_date?: string; page?: number; per_page?: number }) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['drawings', cid, params],
    queryFn: () => drawingsApi.listDrawings(cid, params),
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useCreateDrawing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; payload: CreateDrawingRequest }) => drawingsApi.createDrawing(args.companyId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drawings', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['equity-accounts', variables.companyId] })
    },
  })
}

export function useDeleteDrawing() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; drawingId: string }) => drawingsApi.deleteDrawing(args.companyId, args.drawingId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['drawings', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['equity-accounts', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['equity-summary', variables.companyId] })
    },
  })
}

export function useEquityAccounts(companyId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['equity-accounts', cid],
    queryFn: () => drawingsApi.listEquityAccounts(cid),
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useEquitySummary(companyId?: string, ownerId?: string) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['equity-summary', cid, ownerId],
    queryFn: () => drawingsApi.getEquitySummary(cid, ownerId!),
    enabled: Boolean(cid && ownerId),
    staleTime: 30_000,
  })
}

export function useUpdateEquityAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; ownerId: string; payload: UpdateEquityAccountRequest }) =>
      drawingsApi.updateEquityAccount(args.companyId, args.ownerId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['equity-accounts', variables.companyId] })
      queryClient.invalidateQueries({ queryKey: ['equity-summary', variables.companyId, variables.ownerId] })
    },
  })
}

// =============================================================================
// Salary / Expense Hooks
// =============================================================================

export function useEmployees(companyId?: string, params?: { status?: string; department?: string; page?: number; per_page?: number }) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['employees', cid, params],
    queryFn: () => salaryApi.listEmployees(cid, params),
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; payload: CreateEmployeeRequest }) => salaryApi.createEmployee(args.companyId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.companyId] })
    },
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; employeeId: string; payload: UpdateEmployeeRequest }) =>
      salaryApi.updateEmployee(args.companyId, args.employeeId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.companyId] })
    },
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; employeeId: string }) => salaryApi.deleteEmployee(args.companyId, args.employeeId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['employees', variables.companyId] })
    },
  })
}

export function useSalaryPayments(companyId?: string, params?: { employee_id?: string; status?: string; start_date?: string; end_date?: string; page?: number; per_page?: number }) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['salary-payments', cid, params],
    queryFn: () => salaryApi.listSalaryPayments(cid, params),
    enabled: Boolean(cid),
    staleTime: 30_000,
  })
}

export function useCreateSalaryPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; payload: CreateSalaryPaymentRequest }) => salaryApi.createSalaryPayment(args.companyId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['salary-payments', variables.companyId] })
    },
  })
}

export function useProcessSalaryPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; paymentId: string }) => salaryApi.processSalaryPayment(args.companyId, args.paymentId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['salary-payments', variables.companyId] })
    },
  })
}

export function useCancelSalaryPayment() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; paymentId: string }) => salaryApi.cancelSalaryPayment(args.companyId, args.paymentId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['salary-payments', variables.companyId] })
    },
  })
}

export function useExpenseAccounts(companyId?: string, params?: { type?: string; active_only?: boolean }) {
  const cid = useCompanyId(companyId)
  return useQuery({
    queryKey: ['expense-accounts', cid, params],
    queryFn: () => salaryApi.listExpenseAccounts(cid, params),
    enabled: Boolean(cid),
    staleTime: 60_000,
  })
}

export function useCreateExpenseAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; payload: CreateExpenseAccountRequest }) => salaryApi.createExpenseAccount(args.companyId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-accounts', variables.companyId] })
    },
  })
}

export function useUpdateExpenseAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; accountId: string; payload: UpdateExpenseAccountRequest }) =>
      salaryApi.updateExpenseAccount(args.companyId, args.accountId, args.payload),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-accounts', variables.companyId] })
    },
  })
}

export function useDeleteExpenseAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (args: { companyId: string; accountId: string }) => salaryApi.deleteExpenseAccount(args.companyId, args.accountId),
    onSuccess: (_d, variables) => {
      queryClient.invalidateQueries({ queryKey: ['expense-accounts', variables.companyId] })
    },
  })
}

// Bug Reports Hooks
export function useBugReports(params?: {
  status?: string
  severity?: string
  category?: string
  search?: string
  page?: number
  per_page?: number
}) {
  return useQuery({
    queryKey: ['bug-reports', params?.status, params?.severity, params?.category, params?.search, params?.page ?? 1, params?.per_page ?? 20],
    queryFn: () => bugReportApi.listBugReports(params),
    staleTime: 30_000,
  })
}

export function useBugReport(bugId?: string) {
  const bid = String(bugId ?? '').trim()
  return useQuery({
    queryKey: ['bug-report', bid],
    queryFn: () => bugReportApi.getBugReport(bid),
    enabled: Boolean(bid),
    staleTime: 30_000,
  })
}

export function useSubmitBugReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
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
    }) => {
      return bugReportApi.submitBugReport(vars)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bug-reports'] })
    },
  })
}

export function useUpdateBugReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: {
      bugId: string
      data: Partial<{
        title: string
        description: string
        severity: 'low' | 'medium' | 'high' | 'critical'
        category: 'ui' | 'api' | 'performance' | 'data' | 'security' | 'feature_request' | 'other'
        status: 'open' | 'in_progress' | 'resolved' | 'closed' | 'wont_fix'
        priority: number
        resolution_notes: string
      }>
    }) => {
      return bugReportApi.updateBugReport(vars.bugId, vars.data)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['bug-reports'] })
      qc.invalidateQueries({ queryKey: ['bug-report', vars.bugId] })
    },
  })
}

export function useDeleteBugReport() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { bugId: string }) => {
      return bugReportApi.deleteBugReport(vars.bugId)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bug-reports'] })
    },
  })
}

export function useAddBugReportComment() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (vars: { bugId: string; comment: string }) => {
      return bugReportApi.addBugReportComment(vars.bugId, vars.comment)
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ['bug-report', vars.bugId] })
      qc.invalidateQueries({ queryKey: ['bug-report-comments', vars.bugId] })
    },
  })
}

export function useBugReportComments(bugId?: string) {
  const bid = String(bugId ?? '').trim()
  return useQuery({
    queryKey: ['bug-report-comments', bid],
    queryFn: () => bugReportApi.getBugReportComments(bid),
    enabled: Boolean(bid),
    staleTime: 30_000,
  })
}


