import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { useCreateReceivable, useUpdateReceivable, useCompanyId } from '@/hooks/useApi'
import type { UpdateReceivableRequest, Receivable } from '@/lib/api'
import toast from 'react-hot-toast'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  initial?: Receivable
}

export default function ReceivableFormDialog({ open, onOpenChange, mode, initial }: Props) {
  const companyId = useCompanyId()
  const createMut = useCreateReceivable()
  const updateMut = useUpdateReceivable()

  const [amount, setAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [status, setStatus] = useState<'pending' | 'overdue' | 'paid'>('pending')
  const [description, setDescription] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initial) {
        setAmount(initial.amount != null ? String(initial.amount) : '')
        setDueDate(initial.due_date ? initial.due_date.slice(0, 10) : '')
        setStatus(initial.status || 'pending')
        setDescription(initial.description || '')
      } else {
        setAmount('')
        setDueDate('')
        setStatus('pending')
        setDescription('')
      }
      setErrors({})
    }
  }, [open, mode, initial])

  const isSubmitting = createMut.isPending || updateMut.isPending

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'amount':
        if (!value || value.trim() === '') return 'Amount is required'
        const numAmount = Number(value)
        if (isNaN(numAmount) || numAmount <= 0) return 'Amount must be a positive number'
        return ''
      case 'dueDate':
        if (!value || value.trim() === '') return 'Due date is required'
        const date = new Date(value)
        if (isNaN(date.getTime())) return 'Invalid date format'
        return ''
      default:
        return ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    const amountError = validateField('amount', amount)
    if (amountError) newErrors.amount = amountError
    
    const dueDateError = validateField('dueDate', dueDate)
    if (dueDateError) newErrors.dueDate = dueDateError

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
      const amountValue = Number(amount)
      const dueDateISO = new Date(dueDate).toISOString()

      if (mode === 'create') {
        await createMut.mutateAsync({
          company_id: companyId,
          amount: amountValue,
          due_date: dueDateISO,
          status,
          description: description.trim() || undefined,
        })
        toast.success('Receivable created successfully')
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateReceivableRequest = {
          company_id: companyId,
          amount: amountValue,
          due_date: dueDateISO,
          status,
          description: description.trim() || undefined,
        }
        await updateMut.mutateAsync({ receivableId: initial.id, companyId, data: payload })
        toast.success('Receivable updated successfully')
      }

      onOpenChange(false)
      setErrors({})
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save receivable'
      toast.error(errorMessage)
    }
  }

  const handleFieldChange = (field: string, value: any) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }

    switch (field) {
      case 'amount':
        setAmount(value)
        break
      case 'dueDate':
        setDueDate(value)
        break
      case 'status':
        setStatus(value as 'pending' | 'overdue' | 'paid')
        break
      case 'description':
        setDescription(value)
        break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Receivable' : 'Edit Receivable'}</DialogTitle>
          <DialogDescription>Fill the details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="amount">Amount <span className="text-red-500">*</span></Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              min="0"
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

          <div className="grid gap-2">
            <Label htmlFor="dueDate">Due Date <span className="text-red-500">*</span></Label>
            <Input
              id="dueDate"
              type="date"
              value={dueDate}
              onChange={(e) => handleFieldChange('dueDate', e.target.value)}
              disabled={isSubmitting}
              className={errors.dueDate ? 'border-red-500' : ''}
            />
            {errors.dueDate && (
              <p className="text-sm text-red-500">{errors.dueDate}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value) => handleFieldChange('status', value)} disabled={isSubmitting}>
              <SelectTrigger id="status">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="overdue">Overdue</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => handleFieldChange('description', e.target.value)}
              disabled={isSubmitting}
              placeholder="Enter description (optional)"
              rows={3}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={isSubmitting}>
            {isSubmitting ? 'Saving...' : mode === 'create' ? 'Create' : 'Update'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

