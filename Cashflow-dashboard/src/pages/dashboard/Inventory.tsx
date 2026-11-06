import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Loader2, Package, Plus, Pencil, Trash2 } from "lucide-react"
import { useInventory, useCompanyId, useDeleteInventory } from "@/hooks/useApi"
import InventoryFormDialog from "@/components/InventoryFormDialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import toast from "react-hot-toast"
import type { InventoryItem } from "@/lib/api"
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency"

function formatDate(dateString: string): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    if (isNaN(date.getTime())) return dateString
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return dateString
  }
}

export default function Inventory() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)

  // Dialog states
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [inventoryDialogMode, setInventoryDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | undefined>()

  // Delete confirmation dialog
  const [deleteInventoryDialogOpen, setDeleteInventoryDialogOpen] = useState(false)
  const [inventoryToDelete, setInventoryToDelete] = useState<InventoryItem | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [minQuantity, setMinQuantity] = useState("")
  const [maxQuantity, setMaxQuantity] = useState("")
  const [minValue, setMinValue] = useState("")
  const [maxValue, setMaxValue] = useState("")
  const [updatedStartDate, setUpdatedStartDate] = useState("")
  const [updatedEndDate, setUpdatedEndDate] = useState("")

  const { data: inventory = [], isLoading: loadingInventory, error: errorInventory } = useInventory(companyId)

  const deleteInventoryMut = useDeleteInventory()

  // Inventory handlers
  const handleCreateInventory = () => {
    setSelectedInventory(undefined)
    setInventoryDialogMode('create')
    setInventoryDialogOpen(true)
  }

  const handleEditInventory = (item: InventoryItem) => {
    setSelectedInventory(item)
    setInventoryDialogMode('edit')
    setInventoryDialogOpen(true)
  }

  const handleDeleteInventory = (item: InventoryItem) => {
    setInventoryToDelete(item)
    setDeleteInventoryDialogOpen(true)
  }

  const confirmDeleteInventory = async () => {
    if (!inventoryToDelete || !companyId) return
    try {
      await deleteInventoryMut.mutateAsync({
        inventoryId: inventoryToDelete.id,
        companyId,
      })
      toast.success('Inventory item deleted successfully')
      setDeleteInventoryDialogOpen(false)
      setInventoryToDelete(null)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete inventory item')
    }
  }

  // Filter inventory
  const filteredInventory = useMemo(() => {
    return inventory.filter((item) => {
      // Search filter
      const q = search.trim().toLowerCase()
      if (q) {
        const hay = (item.item_name || '').toLowerCase()
        if (!hay.includes(q)) return false
      }
      
      // Quantity filtering
      const quantity = Number(item.quantity ?? 0)
      if (minQuantity && !isNaN(Number(minQuantity)) && quantity < Number(minQuantity)) return false
      if (maxQuantity && !isNaN(Number(maxQuantity)) && quantity > Number(maxQuantity)) return false
      
      // Value filtering
      const value = Math.abs(Number(item.total_value ?? 0))
      if (minValue && !isNaN(Number(minValue)) && value < Math.abs(Number(minValue))) return false
      if (maxValue && !isNaN(Number(maxValue)) && value > Math.abs(Number(maxValue))) return false
      
      // Last updated date filtering
      if (updatedStartDate || updatedEndDate) {
        const updatedDateStr = item.last_updated
        if (!updatedDateStr) return false
        try {
          const updatedDate = new Date(updatedDateStr + 'T00:00:00Z')
          if (isNaN(updatedDate.getTime())) return false
          
          const start = updatedStartDate ? new Date(updatedStartDate + 'T00:00:00Z') : null
          const end = updatedEndDate ? new Date(updatedEndDate + 'T23:59:59Z') : null
          
          if (start && updatedDate < start) return false
          if (end && updatedDate > end) return false
        } catch {
          return false
        }
      }
      
      return true
    })
  }, [inventory, search, minQuantity, maxQuantity, minValue, maxValue, updatedStartDate, updatedEndDate])

  const totalInventoryValue = filteredInventory.reduce((sum, i) => sum + (i.total_value ?? 0), 0)
  const totalQuantity = filteredInventory.reduce((sum, i) => sum + (i.quantity ?? 0), 0)

  // Chart data preparation
  const inventoryChartData = filteredInventory.map(item => ({
    name: item.item_name || 'Unknown',
    value: item.total_value ?? 0,
    quantity: item.quantity ?? 0,
  }))

  const inventoryConfig = {
    value: {
      label: 'Total Value',
      color: '#f59e0b',
    },
  }

  if (errorInventory) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
          <p className="text-muted-foreground mt-1">Manage inventory items</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-destructive">
                {errorInventory?.message || "Failed to load inventory data"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Inventory</h1>
        <p className="text-muted-foreground mt-1">Manage inventory items and track current stock values</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Inventory Value</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInventory ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrencyAmount(totalInventoryValue, currency)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {inventory.length} {inventory.length === 1 ? 'item' : 'items'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Quantity</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInventory ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{totalQuantity.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Total units in stock
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Average Unit Cost</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingInventory ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">
                  {inventory.length > 0
                    ? formatCurrencyAmount(totalInventoryValue / totalQuantity, currency)
                    : formatCurrencyAmount(0, currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Weighted average
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Inventory Value Chart */}
      {inventory.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Inventory Value Breakdown</CardTitle>
            <CardDescription>Total value by item</CardDescription>
          </CardHeader>
          <CardContent>
            {loadingInventory ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : inventoryChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No inventory data available</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ChartContainer config={inventoryConfig} className="h-full w-full">
                  <BarChart data={inventoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45}
                      textAnchor="end"
                      height={80}
                      tick={{ fontSize: 12 }}
                    />
                    <YAxis tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                    <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Inventory</CardTitle>
              <CardDescription>Current inventory items and values</CardDescription>
            </div>
            <Button onClick={handleCreateInventory} size="sm" disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <div className="space-y-1">
                <Label htmlFor="search" className="text-xs text-muted-foreground">Search</Label>
                <Input 
                  id="search"
                  placeholder="Item name" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="minQuantity" className="text-xs text-muted-foreground">Min Quantity</Label>
                <Input 
                  id="minQuantity"
                  type="number" 
                  placeholder="0" 
                  value={minQuantity} 
                  onChange={(e) => setMinQuantity(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxQuantity" className="text-xs text-muted-foreground">Max Quantity</Label>
                <Input 
                  id="maxQuantity"
                  type="number" 
                  placeholder="0" 
                  value={maxQuantity} 
                  onChange={(e) => setMaxQuantity(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="minValue" className="text-xs text-muted-foreground">Min Value</Label>
                <Input 
                  id="minValue"
                  type="number" 
                  placeholder="0" 
                  value={minValue} 
                  onChange={(e) => setMinValue(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxValue" className="text-xs text-muted-foreground">Max Value</Label>
                <Input 
                  id="maxValue"
                  type="number" 
                  placeholder="0" 
                  value={maxValue} 
                  onChange={(e) => setMaxValue(e.target.value)} 
                />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Last Updated Range</Label>
                <div className="flex gap-2">
                  <Input 
                    type="date" 
                    placeholder="From" 
                    value={updatedStartDate} 
                    onChange={(e) => setUpdatedStartDate(e.target.value)} 
                    className="w-1/2" 
                    title="Updated from"
                  />
                  <Input 
                    type="date" 
                    placeholder="To" 
                    value={updatedEndDate} 
                    onChange={(e) => setUpdatedEndDate(e.target.value)} 
                    className="w-1/2" 
                    title="Updated to"
                  />
                </div>
              </div>
              <div className="flex items-center justify-between md:col-span-2">
                <div className="text-xs text-muted-foreground">
                  Showing {filteredInventory.length} of {inventory.length} items
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { 
                    setSearch(""); 
                    setMinQuantity(""); 
                    setMaxQuantity(""); 
                    setMinValue(""); 
                    setMaxValue(""); 
                    setUpdatedStartDate(""); 
                    setUpdatedEndDate(""); 
                  }}
                >
                  Clear filters
                </Button>
              </div>
            </div>
          </div>

          {loadingInventory ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading inventory...</div>
            </div>
          ) : filteredInventory.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">No inventory items found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-3 font-medium">Item Name</th>
                    <th className="py-3 font-medium">Quantity</th>
                    <th className="py-3 font-medium">Unit Cost</th>
                    <th className="py-3 font-medium">Total Value</th>
                    <th className="py-3 font-medium">Last Updated</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr 
                      key={item.id} 
                      className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 font-medium">{item.item_name || 'Unknown'}</td>
                      <td className="py-3">{item.quantity?.toLocaleString() ?? '0'}</td>
                      <td className="py-3">{formatCurrencyAmount(item.unit_cost ?? 0, currency)}</td>
                      <td className="py-3 font-medium">{formatCurrencyAmount(item.total_value ?? 0, currency)}</td>
                      <td className="py-3 text-gray-600">{formatDate(item.last_updated)}</td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditInventory(item)}
                            disabled={!companyId}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteInventory(item)}
                            disabled={!companyId || deleteInventoryMut.isPending}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Form Dialog */}
      <InventoryFormDialog
        open={inventoryDialogOpen}
        onOpenChange={setInventoryDialogOpen}
        mode={inventoryDialogMode}
        initial={selectedInventory}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteInventoryDialogOpen} onOpenChange={setDeleteInventoryDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Inventory Item</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this inventory item? This action cannot be undone.
              {inventoryToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{inventoryToDelete.item_name || 'Unknown'}</p>
                  <p className="text-sm">Quantity: {inventoryToDelete.quantity ?? 0}</p>
                  <p className="text-sm">Value: {formatCurrencyAmount(inventoryToDelete.total_value ?? 0, currency)}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteInventory}
              disabled={deleteInventoryMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteInventoryMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
