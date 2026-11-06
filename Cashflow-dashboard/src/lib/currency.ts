import { companyApi } from './api'
import { getDefaultCompanyId } from './auth'
import { useQuery } from '@tanstack/react-query'

export function getCurrencySymbol(currency: string): string {
  const currencyMap: Record<string, string> = {
    'USD': '$',
    'EUR': '€',
    'GBP': '£',
    'JPY': '¥',
    'INR': '₹',
    'CAD': 'C$',
    'AUD': 'A$',
    'CHF': 'CHF',
    'CNY': '¥',
    'MXN': 'MX$',
  }
  return currencyMap[currency?.toUpperCase()] || currency || '$'
}

export function formatCurrencyAmount(amount: number, currency: string = 'USD', options?: { minimumFractionDigits?: number; maximumFractionDigits?: number }): string {
  const currencyCode = currency?.toUpperCase() || 'USD'
  const defaultOptions = {
    style: 'currency' as const,
    currency: currencyCode,
    minimumFractionDigits: options?.minimumFractionDigits ?? 2,
    maximumFractionDigits: options?.maximumFractionDigits ?? 2,
  }

  try {
    return new Intl.NumberFormat('en-US', defaultOptions).format(amount)
  } catch (e) {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: options?.minimumFractionDigits ?? 2,
      maximumFractionDigits: options?.maximumFractionDigits ?? 2,
    }).format(amount)
  }
}

export function useCompanyCurrency(companyId?: string) {
  const defaultCompanyId = getDefaultCompanyId()
  const cid = companyId || defaultCompanyId || ''

  return useQuery({
    queryKey: ['company-currency', cid],
    queryFn: async () => {
      if (!cid) return 'USD'
      try {
        const company = await companyApi.getCompanyDetails(cid)
        return company.currency || 'USD'
      } catch {
        return 'USD'
      }
    },
    enabled: Boolean(cid),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  })
}

