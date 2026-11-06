import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { useCreateTransaction, useUpdateTransaction, useCompanyId } from '@/hooks/useApi'
import { useCompanyCurrency } from '@/lib/currency'
import type { UpdateTransactionRequest } from '@/lib/api'
import toast from 'react-hot-toast'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  initial?: {
    id?: string
    date?: string
    description?: string
    amount?: number
    type?: 'inflow' | 'outflow'
    category?: string
    currency?: string
  }
}

export default function TransactionFormDialog({ open, onOpenChange, mode, initial }: Props) {
  const companyId = useCompanyId()
  const { data: companyCurrency = 'USD' } = useCompanyCurrency(companyId)
  const createMut = useCreateTransaction()
  const updateMut = useUpdateTransaction()

  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'inflow' | 'outflow'>('inflow')
  const [category, setCategory] = useState('')
  const [currency, setCurrency] = useState('USD')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      // Set today's date as default for create mode
      const today = new Date().toISOString().split('T')[0]
      setDate(initial?.date?.slice(0, 10) || (mode === 'create' ? today : ''))
      setDescription(initial?.description || '')
      setAmount(initial?.amount != null ? String(Math.abs(initial.amount)) : '')
      setType(initial?.type || 'inflow')
      setCategory(initial?.category || '')
      // Use initial currency if editing, otherwise use company currency as default
      setCurrency(initial?.currency || companyCurrency || 'USD')
      setErrors({}) // Clear errors when opening
    }
  }, [open, initial, mode, companyCurrency])

  // Update currency when company currency changes (if not editing)
  useEffect(() => {
    if (open && mode === 'create' && !initial?.currency && companyCurrency) {
      setCurrency(companyCurrency)
    }
  }, [open, mode, initial?.currency, companyCurrency])

  const isSubmitting = createMut.isPending || updateMut.isPending

  const validateField = (field: string, value: unknown): string => {
    switch (field) {
      case 'date': {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return 'Date is required'
        }
        const selectedDate = new Date(value as string)
        const today = new Date()
        today.setHours(23, 59, 59, 999) // End of today
        if (selectedDate > today) {
          return 'Date cannot be in the future'
        }
        return ''
      }
      case 'description': {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return 'Description is required'
        }
        const strValue = String(value)
        if (strValue.trim().length < 3) {
          return 'Description must be at least 3 characters'
        }
        if (strValue.length > 500) {
          return 'Description must be less than 500 characters'
        }
        return ''
      }
      case 'amount': {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return 'Amount is required'
        }
        const numValue = Number(value)
        if (isNaN(numValue)) {
          return 'Amount must be a valid number'
        }
        if (numValue <= 0) {
          return 'Amount must be greater than 0'
        }
        if (numValue > 1000000000) {
          return 'Amount cannot exceed $1,000,000,000'
        }
        return ''
      }
      case 'category': {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return 'Category is required'
        }
        return ''
      }
      case 'currency': {
        if (!value || (typeof value === 'string' && value.trim() === '')) {
          return 'Currency is required'
        }
        return ''
      }
      default:
        return ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    newErrors.date = validateField('date', date)
    newErrors.description = validateField('description', description)
    newErrors.amount = validateField('amount', amount)
    newErrors.category = validateField('category', category)
    newErrors.currency = validateField('currency', currency)

    setErrors(newErrors)
    
    // Check if there are any errors
    return Object.values(newErrors).every(error => error === '')
  }

  const onSubmit = async () => {
    if (!companyId) {
      toast.error('Company ID is missing. Please refresh the page.')
      return
    }

    // Validate all fields
    if (!validateForm()) {
      const errorCount = Object.values(errors).filter(e => e !== '').length
      if (errorCount > 0) {
        toast.error(`Please fix ${errorCount} error${errorCount > 1 ? 's' : ''} before submitting`)
      }
      return
    }

    try {
      // Backend checks amount sign: positive = income, negative = expense
      // So we need to make outflow transactions negative
      const amountValue = type === 'outflow' 
        ? -Math.abs(Number(amount))  // Negative for expenses
        : Math.abs(Number(amount))   // Positive for income

      if (mode === 'create') {
        await createMut.mutateAsync({
          company_id: companyId,
          date,
          description: description.trim(),
          amount: amountValue,
          type,
          category,
          currency,
        })
        toast.success('Transaction added successfully')
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateTransactionRequest = {
          date,
          description: description.trim(),
          amount: amountValue,
          type,
          category,
          currency,
        }
        await updateMut.mutateAsync({ transactionId: initial.id, companyId, data: payload })
        toast.success('Transaction updated successfully')
      }

      onOpenChange(false)
      setErrors({}) // Clear errors on success
    } catch (error: unknown) {
      const errorMessage = (error as { response?: { data?: { error?: string } }; message?: string })?.response?.data?.error || (error as { message?: string })?.message || 'Failed to save transaction'
      toast.error(errorMessage)
    }
  }

  const handleFieldChange = (field: string, value: unknown) => {
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }

    switch (field) {
      case 'date':
        setDate(String(value))
        break
      case 'description':
        setDescription(String(value))
        break
      case 'amount':
        setAmount(String(value))
        break
      case 'type':
        setType(value as 'inflow' | 'outflow')
        break
      case 'category':
        setCategory(String(value))
        break
      case 'currency':
        setCurrency(String(value))
        break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Transaction' : 'Edit Transaction'}</DialogTitle>
          <DialogDescription>Fill the details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="date">Date <span className="text-red-500">*</span></Label>
            <Input 
              id="date" 
              type="date" 
              value={date} 
              onChange={(e) => handleFieldChange('date', e.target.value)} 
              disabled={isSubmitting}
              className={errors.date ? 'border-red-500' : ''}
            />
            {errors.date && (
              <p className="text-sm text-red-500">{errors.date}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="desc">Description <span className="text-red-500">*</span></Label>
            <Input 
              id="desc" 
              value={description} 
              onChange={(e) => handleFieldChange('description', e.target.value)} 
              disabled={isSubmitting}
              placeholder="Enter transaction description"
              className={errors.description ? 'border-red-500' : ''}
            />
            {errors.description && (
              <p className="text-sm text-red-500">{errors.description}</p>
            )}
          </div>
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
            <Input 
              id="amount" 
              type="number" 
              step="0.01" 
              min="0.01"
              value={amount} 
              onChange={(e) => handleFieldChange('amount', e.target.value)} 
              disabled={isSubmitting}
              placeholder="0.00"
              className={errors.amount ? 'border-red-500' : ''}
            />
            {errors.amount && (
              <p className="text-sm text-red-500">{errors.amount}</p>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>Type <span className="text-red-500">*</span></Label>
              <Select value={type} onValueChange={(v: 'inflow' | 'outflow') => handleFieldChange('type', v)}>
                <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="inflow">Inflow</SelectItem>
                  <SelectItem value="outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label>Category <span className="text-red-500">*</span></Label>
              <Select 
                value={category} 
                onValueChange={(v) => handleFieldChange('category', v)} 
                disabled={isSubmitting}
              >
                <SelectTrigger className={errors.category ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="operating">Operating</SelectItem>
                  <SelectItem value="investing">Investing</SelectItem>
                  <SelectItem value="financing">Financing</SelectItem>
                  <SelectItem value="revenue">Revenue</SelectItem>
                  <SelectItem value="expenses">Expenses</SelectItem>
                  <SelectItem value="assets">Assets</SelectItem>
                  <SelectItem value="equipment">Equipment</SelectItem>
                  <SelectItem value="loans">Loans</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                </SelectContent>
              </Select>
              {errors.category && (
                <p className="text-sm text-red-500">{errors.category}</p>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Currency <span className="text-red-500">*</span></Label>
              <Select 
                value={currency} 
                onValueChange={(v) => handleFieldChange('currency', v)} 
                disabled={isSubmitting}
              >
                <SelectTrigger className={errors.currency ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD - US Dollar</SelectItem>
                  <SelectItem value="EUR">EUR - Euro</SelectItem>
                  <SelectItem value="GBP">GBP - British Pound</SelectItem>
                  <SelectItem value="JPY">JPY - Japanese Yen</SelectItem>
                  <SelectItem value="INR">INR - Indian Rupee</SelectItem>
                  <SelectItem value="CAD">CAD - Canadian Dollar</SelectItem>
                  <SelectItem value="AUD">AUD - Australian Dollar</SelectItem>
                  <SelectItem value="CHF">CHF - Swiss Franc</SelectItem>
                  <SelectItem value="CNY">CNY - Chinese Yuan</SelectItem>
                  <SelectItem value="MXN">MXN - Mexican Peso</SelectItem>
                </SelectContent>
              </Select>
              {errors.currency && (
                <p className="text-sm text-red-500">{errors.currency}</p>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>Cancel</Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>{isSubmitting ? 'Saving...' : 'Save'}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


