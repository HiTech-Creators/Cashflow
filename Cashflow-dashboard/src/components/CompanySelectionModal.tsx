import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { companyApi, type Company } from '@/lib/api'
import { getCurrentUser, getDefaultCompanyId, setDefaultCompanyId } from '@/lib/auth'
import { Loader2, Building2 } from 'lucide-react'
import { useQueryClient } from '@tanstack/react-query'

interface CompanySelectionModalProps {
  open: boolean
  onClose: () => void
}

export default function CompanySelectionModal({ open, onClose }: CompanySelectionModalProps) {
  const queryClient = useQueryClient()
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (open) {
      let mounted = true
      const fetchCompanies = async () => {
        setIsLoading(true)
        setError(null)

        try {
          const user = getCurrentUser()
          if (!user) {
            if (mounted) {
              setError('User not authenticated. Please log in again.')
              setIsLoading(false)
            }
            return
          }

          const companiesList = user?.role === 'superadmin' 
            ? await companyApi.getAllCompanies() 
            : await companyApi.getUserCompanies()

          if (!mounted) return

          // Validate companies array
          const validCompanies = Array.isArray(companiesList) 
            ? companiesList.filter((c): c is Company => c != null && typeof c === 'object' && typeof c.id === 'string' && c.id.trim() !== '' && typeof c.name === 'string' && c.name.trim() !== '')
            : []

          if (validCompanies.length === 0) {
            setError('No companies available. Please contact your administrator.')
            setCompanies([])
          } else {
            setCompanies(validCompanies)
            // Pre-select the first company if available
            const firstCompanyId = validCompanies[0]?.id
            if (firstCompanyId && typeof firstCompanyId === 'string') {
              setSelectedCompanyId(firstCompanyId)
            }
          }
        } catch (err) {
          if (mounted) {
            setError(err instanceof Error ? err.message : 'Failed to load companies')
            setCompanies([])
          }
        } finally {
          if (mounted) {
            setIsLoading(false)
          }
        }
      }

      fetchCompanies()
      return () => {
        mounted = false
      }
    }
  }, [open])

  const handleSelect = async () => {
    if (!selectedCompanyId || typeof selectedCompanyId !== 'string' || selectedCompanyId.trim() === '') {
      setError('Please select a company')
      return
    }

    // Verify the selected company exists in the list
    const companyExists = companies.some(c => c?.id === selectedCompanyId)
    if (!companyExists) {
      setError('Selected company is invalid. Please select a different company.')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      // Store the selected company in localStorage
      setDefaultCompanyId(selectedCompanyId)
      
      // Dispatch event to notify other components
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('company-id-changed'))
      }
      
      // Invalidate all queries that depend on company ID
      if (queryClient) {
        queryClient.invalidateQueries({ queryKey: ['dashboard-kpis'] })
        queryClient.invalidateQueries({ queryKey: ['monthly-balances'] })
        queryClient.invalidateQueries({ queryKey: ['monthly-income-expense'] })
        queryClient.invalidateQueries({ queryKey: ['transactions'] })
        queryClient.invalidateQueries({ queryKey: ['cash-overview'] })
        queryClient.invalidateQueries({ queryKey: ['cash-activities'] })
        queryClient.invalidateQueries({ queryKey: ['cashout-categories'] })
      }
      
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save company selection')
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCompany = companies.find((c): c is Company => c != null && typeof c === 'object' && c.id === selectedCompanyId)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      // Prevent closing modal if no company is selected (user must select a company)
      if (!isOpen && !isSubmitting) {
        const currentCompanyId = getDefaultCompanyId()
        if (!currentCompanyId || typeof currentCompanyId !== 'string' || currentCompanyId.trim() === '') {
          // No company selected, prevent closing
          return
        }
        onClose()
      }
    }}>
      <DialogContent 
        className="sm:max-w-[500px]" 
        onPointerDownOutside={(e) => {
          // Prevent closing by clicking outside if no company is selected
          const currentCompanyId = getDefaultCompanyId()
          if (!currentCompanyId || typeof currentCompanyId !== 'string' || currentCompanyId.trim() === '') {
            e.preventDefault()
          } else if (isSubmitting) {
            e.preventDefault()
          }
        }}
        onEscapeKeyDown={(e) => {
          // Prevent closing with Escape if no company is selected
          const currentCompanyId = getDefaultCompanyId()
          if (!currentCompanyId || typeof currentCompanyId !== 'string' || currentCompanyId.trim() === '') {
            e.preventDefault()
          }
        }}
      >
        <DialogHeader>
          <div className="flex items-center gap-3">
            
            <div>
              <DialogTitle>Select a Company</DialogTitle>
              <DialogDescription className="mt-1">
                Please select a company to continue. This will be saved as your default company.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="py-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              <span className="ml-2 text-sm text-muted-foreground">Loading companies...</span>
            </div>
          ) : error && companies.length === 0 ? (
            <div className="py-8 text-center">
              <p className="text-sm text-destructive">{error}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Company</label>
                <Select 
                  value={selectedCompanyId} 
                  onValueChange={setSelectedCompanyId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a company">
                      {selectedCompany && selectedCompany.name ? (
                        `${selectedCompany.name}${selectedCompany.currency ? ` (${selectedCompany.currency})` : ''}`
                      ) : (
                        'Select a company'
                      )}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {companies.map((company) => {
                      if (!company || !company.id || !company.name) return null
                      return (
                        <SelectItem key={company.id} value={company.id}>
                          {company.name}{company.currency ? ` (${company.currency})` : ''}
                        </SelectItem>
                      )
                    })}
                  </SelectContent>
                </Select>
              </div>
              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            onClick={handleSelect}
            disabled={!selectedCompanyId || isLoading || isSubmitting || companies.length === 0}
            className="w-full sm:w-auto"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Continue'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

