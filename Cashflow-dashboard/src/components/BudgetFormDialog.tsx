import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useCreateBudget, useUpdateBudget, useCompanyId } from '@/hooks/useApi'
import type { UpdateBudgetRequest, Budget } from '@/lib/api'
import toast from 'react-hot-toast'
import { AlertCircle, Loader2 } from 'lucide-react'

// Common budget categories
const BUDGET_CATEGORIES = [
  'Marketing',
  'Sales',
  'Operations',
  'Engineering',
  'HR',
  'Finance',
  'IT',
  'Legal',
  'R&D',
  'Customer Support',
  'Administration',
  'Facilities',
  'Travel',
  'Training',
  'Equipment',
  'Software',
  'Other',
]

// Get current month in YYYY-MM format
function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  initial?: Budget
}

export default function BudgetFormDialog({ open, onOpenChange, mode, initial }: Props) {
  const companyId = useCompanyId()
  const createMut = useCreateBudget()
  const updateMut = useUpdateBudget()

  const [category, setCategory] = useState('')
  const [amount, setAmount] = useState('')
  const [period, setPeriod] = useState(getCurrentPeriod())
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initial) {
        setCategory(initial.category || '')
        setAmount(initial.amount != null ? String(initial.amount) : '')
        setPeriod(initial.period || getCurrentPeriod())
      } else {
        setCategory('')
        setAmount('')
        setPeriod(getCurrentPeriod())
      }
      setErrors({})
    }
  }, [open, mode, initial])

  const isSubmitting = createMut.isPending || updateMut.isPending

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'category':
        if (!value || value.trim() === '') return 'Category is required'
        return ''
      case 'amount':
        if (!value || value.trim() === '') return 'Amount is required'
        const numValue = Number(value)
        if (isNaN(numValue)) return 'Amount must be a valid number'
        if (numValue <= 0) return 'Amount must be greater than 0'
        if (numValue > 1000000000) return 'Amount cannot exceed $1,000,000,000'
        return ''
      case 'period':
        if (!value || value.trim() === '') return 'Period is required'
        const periodRegex = /^\d{4}-\d{2}$/
        if (!periodRegex.test(value)) return 'Period must be in YYYY-MM format (e.g., 2024-01)'
        const [year, month] = value.split('-').map(Number)
        if (month < 1 || month > 12) return 'Month must be between 01 and 12'
        if (year < 2000 || year > 2100) return 'Year must be between 2000 and 2100'
        return ''
      default:
        return ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    const categoryError = validateField('category', category)
    if (categoryError) newErrors.category = categoryError
    
    const amountError = validateField('amount', amount)
    if (amountError) newErrors.amount = amountError
    
    const periodError = validateField('period', period)
    if (periodError) newErrors.period = periodError

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const onSubmit = async () => {
    if (!companyId) {
      toast.error('Please select a company')
      return
    }

    if (!validateForm()) {
      return
    }

    try {
      if (mode === 'create') {
        await createMut.mutateAsync({
          company_id: companyId,
          category: category.trim(),
          amount: Number(amount),
          period: period.trim(),
        })
        toast.success('Budget created successfully')
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateBudgetRequest = {
          company_id: companyId,
          category: category.trim(),
          amount: Number(amount),
          period: period.trim(),
        }
        await updateMut.mutateAsync({ budgetId: initial.id, companyId, data: payload })
        toast.success('Budget updated successfully')
      }

      onOpenChange(false)
      setErrors({})
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || `Failed to ${mode === 'create' ? 'create' : 'update'} budget`
      toast.error(errorMessage)
    }
  }

  const handleFieldChange = (field: string, value: any) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }

    switch (field) {
      case 'category':
        setCategory(value)
        break
      case 'amount':
        setAmount(value)
        break
      case 'period':
        setPeriod(value)
        break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Create New Budget' : 'Edit Budget'}</DialogTitle>
          <DialogDescription>
            {mode === 'create' 
              ? 'Create a budget for a specific category and period. Select a category from the dropdown and choose the month.'
              : 'Update the budget details below.'}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="category">Category <span className="text-red-500">*</span></Label>
            <Select
              value={category}
              onValueChange={(value) => handleFieldChange('category', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="category" className={errors.category ? 'border-red-500' : ''}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {BUDGET_CATEGORIES.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.category && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.category}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="amount">Amount (USD) <span className="text-red-500">*</span></Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0.01"
              placeholder="0.00"
              value={amount}
              onChange={(e) => handleFieldChange('amount', e.target.value)}
              className={errors.amount ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.amount && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.amount}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="period">Period <span className="text-red-500">*</span></Label>
            <Input
              id="period"
              type="month"
              value={period}
              onChange={(e) => handleFieldChange('period', e.target.value)}
              className={errors.period ? 'border-red-500' : ''}
              disabled={isSubmitting}
            />
            {errors.period && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" />
                {errors.period}
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Select the year and month for this budget
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {mode === 'create' ? 'Creating...' : 'Updating...'}
              </>
            ) : (
              mode === 'create' ? 'Create Budget' : 'Update Budget'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

