import { useEffect, useState } from 'react'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { companyApi, type Company } from '@/lib/api'
import { getCurrentUser, getDefaultCompanyId } from '@/lib/auth'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'

export default function CompanySelector() {
  const queryClient = useQueryClient()
  const [companies, setCompanies] = useState<Company[]>([])
  const [value, setValue] = useState<string>(() => getDefaultCompanyId() || '')
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const user = getCurrentUser()

    const fetchCompanies = async () => {
      setIsLoading(true)
      setError(null)

      try {
        const companies = user?.role === 'superadmin' ? await companyApi.getAllCompanies() : await companyApi.getUserCompanies()

        if (!mounted) return

        // Validate companies array
        const validCompanies = Array.isArray(companies) ? companies.filter(c => c?.id && c?.name) : []
        setCompanies(validCompanies)

        // Check if we have a default company ID from localStorage
        const defaultCompanyId = getDefaultCompanyId()
        const exists = validCompanies.some((c) => c?.id === defaultCompanyId)

        let newValue = ''

        if (defaultCompanyId && exists) {
          // Use the default company if it exists in the list
          newValue = defaultCompanyId
          console.log('CompanySelector - Using existing default company:', newValue)
        } else if (defaultCompanyId && !exists) {
          // Clear invalid default company
          console.warn('CompanySelector - Default company not found in list, clearing:', defaultCompanyId)
          localStorage.removeItem('default_company_id')
          newValue = ''
        }
        // Removed auto-selection of first company - user must select via modal

        if (newValue) {
          console.log('CompanySelector - Setting company:', newValue)
          setValue(newValue)
          // Dispatch event to notify other components on first load
          window.dispatchEvent(new Event('company-id-changed'))
        } else {
          // No company selected, ensure value is empty
          setValue('')
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to load companies')
        }
      } finally {
        if (mounted) {
          setIsLoading(false)
          setIsInitialized(true)
        }
      }
    }

    fetchCompanies()
    return () => { mounted = false }
  }, [])

  // Listen for company ID changes (when user logs in or switches companies)
  useEffect(() => {
    const handleCompanyChange = () => {
      const newDefaultCompanyId = getDefaultCompanyId()
      if (newDefaultCompanyId && companies.some(c => c.id === newDefaultCompanyId)) {
        setValue(newDefaultCompanyId)
      }
    }

    const handleAuthSuccess = () => {
      // When user logs in successfully, refresh companies and set default
      const user = getCurrentUser()
      const fetchCompanies = user?.role === 'superadmin' ? companyApi.getAllCompanies() : companyApi.getUserCompanies()

      fetchCompanies.then((list) => {
        setCompanies(list)
        const defaultCompanyId = getDefaultCompanyId()
        if (defaultCompanyId && list.some(c => c.id === defaultCompanyId)) {
          setValue(defaultCompanyId)
        }
        // Removed auto-selection - user must select via modal
      }).catch(() => {})
    }

    window.addEventListener('company-id-changed', handleCompanyChange)
    window.addEventListener('auth-login-success', handleAuthSuccess)

    // Also check on auth state changes
    const checkAuth = () => {
      const newDefaultCompanyId = getDefaultCompanyId()
      if (newDefaultCompanyId && companies.some(c => c.id === newDefaultCompanyId)) {
        setValue(newDefaultCompanyId)
      }
    }
    window.addEventListener('storage', checkAuth)

    return () => {
      window.removeEventListener('company-id-changed', handleCompanyChange)
      window.removeEventListener('auth-login-success', handleAuthSuccess)
      window.removeEventListener('storage', checkAuth)
    }
  }, [companies])

  const onChange = (id: string) => {
    console.log('CompanySelector - Changing company to:', id)
    setValue(id)
    localStorage.setItem('default_company_id', id)
    window.dispatchEvent(new Event('company-id-changed'))
    // Invalidate all queries that depend on company ID
    queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
    queryClient.invalidateQueries({ queryKey: ['monthly-balances'] })
    queryClient.invalidateQueries({ queryKey: ['monthly-income-expense'] })
    queryClient.invalidateQueries({ queryKey: ['transactions'] })
    queryClient.invalidateQueries({ queryKey: ['cash-overview'] })
    queryClient.invalidateQueries({ queryKey: ['cash-activities'] })
    queryClient.invalidateQueries({ queryKey: ['cashout-categories'] })
  }

  const selectedCompany = companies.find(c => c?.id === value)

  if (error) {
    return (
      <Select disabled>
        <SelectTrigger className="w-[220px]">
          <SelectValue placeholder="Error loading companies" />
        </SelectTrigger>
      </Select>
    )
  }

  return (
    <Select value={value} onValueChange={onChange} disabled={!isInitialized || isLoading}>
      <SelectTrigger className="w-[220px]">
        <SelectValue placeholder={isLoading ? "Loading companies..." : isInitialized ? "Select company" : "Initializing..."}>
          {isLoading ? (
            <div className="flex items-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading...
            </div>
          ) : selectedCompany ? (
            `${selectedCompany.name} (${selectedCompany.currency})`
          ) : isInitialized ? (
            "Select company"
          ) : (
            "Loading..."
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {companies.map((c) => (
          <SelectItem key={c?.id || 'unknown'} value={c?.id || ''}>
            {c?.name || 'Unknown'} ({c?.currency || 'N/A'})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}


