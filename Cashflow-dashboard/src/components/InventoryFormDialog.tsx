import { useEffect, useState } from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { useCreateInventory, useUpdateInventory, useCompanyId } from '@/hooks/useApi'
import type { UpdateInventoryRequest, InventoryItem } from '@/lib/api'
import toast from 'react-hot-toast'

type Props = {
  open: boolean
  onOpenChange: (v: boolean) => void
  mode: 'create' | 'edit'
  initial?: InventoryItem
}

export default function InventoryFormDialog({ open, onOpenChange, mode, initial }: Props) {
  const companyId = useCompanyId()
  const createMut = useCreateInventory()
  const updateMut = useUpdateInventory()

  const [itemName, setItemName] = useState('')
  const [quantity, setQuantity] = useState('')
  const [value, setValue] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (open) {
      if (mode === 'edit' && initial) {
        setItemName(initial.item_name || '')
        setQuantity(initial.quantity != null ? String(initial.quantity) : '')
        setValue(initial.total_value != null ? String(initial.total_value) : '')
      } else {
        setItemName('')
        setQuantity('')
        setValue('')
      }
      setErrors({})
    }
  }, [open, mode, initial])

  const isSubmitting = createMut.isPending || updateMut.isPending

  const validateField = (field: string, value: any): string => {
    switch (field) {
      case 'itemName':
        if (!value || value.trim() === '') return 'Item name is required'
        return ''
      case 'quantity':
        if (!value || value.trim() === '') return 'Quantity is required'
        const numQuantity = Number(value)
        if (isNaN(numQuantity) || numQuantity < 0 || !Number.isInteger(numQuantity)) {
          return 'Quantity must be a non-negative integer'
        }
        return ''
      case 'value':
        if (!value || value.trim() === '') return 'Total value is required'
        const numValue = Number(value)
        if (isNaN(numValue) || numValue < 0) return 'Total value must be a non-negative number'
        return ''
      default:
        return ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    const itemNameError = validateField('itemName', itemName)
    if (itemNameError) newErrors.itemName = itemNameError
    
    const quantityError = validateField('quantity', quantity)
    if (quantityError) newErrors.quantity = quantityError
    
    const valueError = validateField('value', value)
    if (valueError) newErrors.value = valueError

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
      const quantityValue = Number(quantity)
      const valueNum = Number(value)

      if (mode === 'create') {
        await createMut.mutateAsync({
          company_id: companyId,
          item_name: itemName.trim(),
          quantity: quantityValue,
          value: valueNum,
        })
        toast.success('Inventory item created successfully')
      } else if (mode === 'edit' && initial?.id) {
        const payload: UpdateInventoryRequest = {
          company_id: companyId,
          item_name: itemName.trim(),
          quantity: quantityValue,
          value: valueNum,
        }
        await updateMut.mutateAsync({ inventoryId: initial.id, companyId, data: payload })
        toast.success('Inventory item updated successfully')
      }

      onOpenChange(false)
      setErrors({})
    } catch (error: any) {
      const errorMessage = error?.response?.data?.error || error?.message || 'Failed to save inventory item'
      toast.error(errorMessage)
    }
  }

  const handleFieldChange = (field: string, value: any) => {
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' })
    }

    switch (field) {
      case 'itemName':
        setItemName(value)
        break
      case 'quantity':
        setQuantity(value)
        break
      case 'value':
        setValue(value)
        break
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{mode === 'create' ? 'Add Inventory Item' : 'Edit Inventory Item'}</DialogTitle>
          <DialogDescription>Fill the details below.</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="itemName">Item Name <span className="text-red-500">*</span></Label>
            <Input
              id="itemName"
              type="text"
              value={itemName}
              onChange={(e) => handleFieldChange('itemName', e.target.value)}
              disabled={isSubmitting}
              placeholder="Enter item name"
              className={errors.itemName ? 'border-red-500' : ''}
            />
            {errors.itemName && (
              <p className="text-sm text-red-500">{errors.itemName}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="quantity">Quantity <span className="text-red-500">*</span></Label>
            <Input
              id="quantity"
              type="number"
              step="1"
              min="0"
              value={quantity}
              onChange={(e) => handleFieldChange('quantity', e.target.value)}
              disabled={isSubmitting}
              placeholder="0"
              className={errors.quantity ? 'border-red-500' : ''}
            />
            {errors.quantity && (
              <p className="text-sm text-red-500">{errors.quantity}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="value">Total Value <span className="text-red-500">*</span></Label>
            <Input
              id="value"
              type="number"
              step="0.01"
              min="0"
              value={value}
              onChange={(e) => handleFieldChange('value', e.target.value)}
              disabled={isSubmitting}
              placeholder="0.00"
              className={errors.value ? 'border-red-500' : ''}
            />
            {errors.value && (
              <p className="text-sm text-red-500">{errors.value}</p>
            )}
            {quantity && value && Number(quantity) > 0 && (
              <p className="text-xs text-muted-foreground">
                Unit cost: ${(Number(value) / Number(quantity)).toFixed(2)}
              </p>
            )}
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

