import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Loader2, Package, Receipt, FileText, Clock, TrendingUp, Plus, Pencil, Trash2 } from "lucide-react"
import { useReceivables, usePayables, useInventory, useAgingReport, useCompanyId, useDeleteReceivable, useDeletePayable, useDeleteInventory } from "@/hooks/useApi"
import ReceivableFormDialog from "@/components/ReceivableFormDialog"
import PayableFormDialog from "@/components/PayableFormDialog"
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
import type { Receivable, Payable, InventoryItem } from "@/lib/api"
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

function getStatusBadgeVariant(status: 'pending' | 'overdue' | 'paid') {
  switch (status) {
    case 'paid':
      return 'default'
    case 'overdue':
      return 'destructive'
    case 'pending':
      return 'secondary'
    default:
      return 'secondary'
  }
}

export default function WorkingCapital() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)
  const [agingType, setAgingType] = useState<'receivables' | 'payables'>('receivables')

  // Dialog states
  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false)
  const [payableDialogOpen, setPayableDialogOpen] = useState(false)
  const [inventoryDialogOpen, setInventoryDialogOpen] = useState(false)
  const [receivableDialogMode, setReceivableDialogMode] = useState<'create' | 'edit'>('create')
  const [payableDialogMode, setPayableDialogMode] = useState<'create' | 'edit'>('create')
  const [inventoryDialogMode, setInventoryDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | undefined>()
  const [selectedPayable, setSelectedPayable] = useState<Payable | undefined>()
  const [selectedInventory, setSelectedInventory] = useState<InventoryItem | undefined>()

  // Delete confirmation dialogs
  const [deleteReceivableDialogOpen, setDeleteReceivableDialogOpen] = useState(false)
  const [deletePayableDialogOpen, setDeletePayableDialogOpen] = useState(false)
  const [deleteInventoryDialogOpen, setDeleteInventoryDialogOpen] = useState(false)
  const [receivableToDelete, setReceivableToDelete] = useState<Receivable | null>(null)
  const [payableToDelete, setPayableToDelete] = useState<Payable | null>(null)
  const [inventoryToDelete, setInventoryToDelete] = useState<InventoryItem | null>(null)

  const { data: receivables = [], isLoading: loadingReceivables, error: errorReceivables } = useReceivables(companyId)
  const { data: payables = [], isLoading: loadingPayables, error: errorPayables } = usePayables(companyId)
  const { data: inventory = [], isLoading: loadingInventory, error: errorInventory } = useInventory(companyId)
  const { data: agingReport, isLoading: loadingAging, error: errorAging } = useAgingReport(companyId, agingType)

  const deleteReceivableMut = useDeleteReceivable()
  const deletePayableMut = useDeletePayable()
  const deleteInventoryMut = useDeleteInventory()

  // Receivable handlers
  const handleCreateReceivable = () => {
    setSelectedReceivable(undefined)
    setReceivableDialogMode('create')
    setReceivableDialogOpen(true)
  }

  const handleEditReceivable = (receivable: Receivable) => {
    setSelectedReceivable(receivable)
    setReceivableDialogMode('edit')
    setReceivableDialogOpen(true)
  }

  const handleDeleteReceivable = (receivable: Receivable) => {
    setReceivableToDelete(receivable)
    setDeleteReceivableDialogOpen(true)
  }

  const confirmDeleteReceivable = async () => {
    if (!receivableToDelete || !companyId) return
    try {
      await deleteReceivableMut.mutateAsync({
        receivableId: receivableToDelete.id,
        companyId,
      })
      toast.success('Receivable deleted successfully')
      setDeleteReceivableDialogOpen(false)
      setReceivableToDelete(null)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete receivable')
    }
  }

  // Payable handlers
  const handleCreatePayable = () => {
    setSelectedPayable(undefined)
    setPayableDialogMode('create')
    setPayableDialogOpen(true)
  }

  const handleEditPayable = (payable: Payable) => {
    setSelectedPayable(payable)
    setPayableDialogMode('edit')
    setPayableDialogOpen(true)
  }

  const handleDeletePayable = (payable: Payable) => {
    setPayableToDelete(payable)
    setDeletePayableDialogOpen(true)
  }

  const confirmDeletePayable = async () => {
    if (!payableToDelete || !companyId) return
    try {
      await deletePayableMut.mutateAsync({
        payableId: payableToDelete.id,
        companyId,
      })
      toast.success('Payable deleted successfully')
      setDeletePayableDialogOpen(false)
      setPayableToDelete(null)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete payable')
    }
  }

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

  const isLoading = loadingReceivables || loadingPayables || loadingInventory || loadingAging
  const hasError = errorReceivables || errorPayables || errorInventory || errorAging

  // Calculate summary metrics
  const totalReceivables = receivables.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const totalPayables = payables.reduce((sum, p) => sum + (p.amount ?? 0), 0)
  const totalInventoryValue = inventory.reduce((sum, i) => sum + (i.total_value ?? 0), 0)
  const overdueReceivables = receivables.filter(r => r.status === 'overdue').reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const overduePayables = payables.filter(p => p.status === 'overdue').reduce((sum, p) => sum + (p.amount ?? 0), 0)

  // Chart data preparation
  const agingChartData = useMemo(() => {
    if (!agingReport) return []
    return [
      { bucket: '0-30', amount: agingReport['0-30'] ?? 0 },
      { bucket: '31-60', amount: agingReport['31-60'] ?? 0 },
      { bucket: '61-90', amount: agingReport['61-90'] ?? 0 },
      { bucket: '90+', amount: agingReport['90+'] ?? 0 },
    ]
  }, [agingReport])

  const receivablesPayablesComparison = useMemo(() => [
    { category: 'Receivables', amount: totalReceivables },
    { category: 'Payables', amount: totalPayables },
    { category: 'Net', amount: totalReceivables - totalPayables },
  ], [totalReceivables, totalPayables])

  const statusDistribution = useMemo(() => {
    const recPending = receivables.filter(r => r.status === 'pending').length
    const recOverdue = receivables.filter(r => r.status === 'overdue').length
    const recPaid = receivables.filter(r => r.status === 'paid').length
    const payPending = payables.filter(p => p.status === 'pending').length
    const payOverdue = payables.filter(p => p.status === 'overdue').length
    const payPaid = payables.filter(p => p.status === 'paid').length
    
    return [
      { status: 'Pending', receivables: recPending, payables: payPending },
      { status: 'Overdue', receivables: recOverdue, payables: payOverdue },
      { status: 'Paid', receivables: recPaid, payables: payPaid },
    ]
  }, [receivables, payables])

  const inventoryChartData = useMemo(() => {
    return inventory.map(item => ({
      name: item.item_name || 'Unknown',
      value: item.total_value ?? 0,
      quantity: item.quantity ?? 0,
    }))
  }, [inventory])

  // Chart configs
  const agingConfig = {
    amount: {
      label: 'Amount',
      color: '#3b82f6',
    },
  }

  const comparisonConfig = {
    amount: {
      label: 'Amount',
      color: '#10b981',
    },
  }

  const statusConfig = {
    receivables: {
      label: 'Receivables',
      color: '#3b82f6',
    },
    payables: {
      label: 'Payables',
      color: '#ef4444',
    },
  }

  const inventoryConfig = {
    value: {
      label: 'Total Value',
      color: '#f59e0b',
    },
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Working Capital</h2>
        <p className="text-muted-foreground">Manage receivables, payables, inventory, and aging reports</p>
      </div>

      {hasError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              {errorReceivables?.message || errorPayables?.message || errorInventory?.message || errorAging?.message || "Failed to load working capital data"}
            </p>
          </CardContent>
        </Card>
      )}

      {!companyId && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Please select a company to view working capital data</p>
          </CardContent>
        </Card>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
            <Receipt className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingReceivables ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrencyAmount(totalReceivables, currency)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {receivables.length} {receivables.length === 1 ? 'item' : 'items'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Payables</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingPayables ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrencyAmount(totalPayables, currency)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {payables.length} {payables.length === 1 ? 'item' : 'items'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Inventory Value</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loadingInventory ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
            {isLoading ? (
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive">
                  {formatCurrencyAmount(overdueReceivables + overduePayables, currency)}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Receivables: {formatCurrencyAmount(overdueReceivables, currency)} | Payables: {formatCurrencyAmount(overduePayables, currency)}
                </p>
              </>
            )}
            </CardContent>
          </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Receivables vs Payables Comparison */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Receivables vs Payables</CardTitle>
            <CardDescription>Comparison of outstanding amounts</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : receivablesPayablesComparison.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ChartContainer config={comparisonConfig} className="h-full w-full">
                  <BarChart data={receivablesPayablesComparison}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="category" />
                    <YAxis tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                    <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Status Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status Distribution</CardTitle>
            <CardDescription>Receivables and payables by status</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : statusDistribution.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No data available</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ChartContainer config={statusConfig} className="h-full w-full">
                  <BarChart data={statusDistribution}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="status" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar dataKey="receivables" fill="var(--color-receivables)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="payables" fill="var(--color-payables)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aging Report with Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Aging Report
          </CardTitle>
          <CardDescription>Breakdown by time buckets</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={agingType} onValueChange={(value) => setAgingType(value as 'receivables' | 'payables')}>
            <TabsList>
              <TabsTrigger value="receivables">Receivables</TabsTrigger>
              <TabsTrigger value="payables">Payables</TabsTrigger>
            </TabsList>
            <TabsContent value="receivables" className="mt-4">
              {loadingAging ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !agingReport ? (
                <p className="text-muted-foreground py-12 text-center">No aging data available</p>
              ) : (
                <>
                  <div className="h-[300px] w-full mb-4">
                    <ChartContainer config={agingConfig} className="h-full w-full">
                      <BarChart data={agingChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="bucket" />
                        <YAxis tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value: number) => formatCurrencyAmount(value, currency)}
                        />
                        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">0-30 Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['0-30'] ?? 0, currency)}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">31-60 Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['31-60'] ?? 0, currency)}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">61-90 Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['61-90'] ?? 0, currency)}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">90+ Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['90+'] ?? 0, currency)}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-lg font-bold">{formatCurrencyAmount(agingReport.total ?? 0, currency)}</span>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
            <TabsContent value="payables" className="mt-4">
              {loadingAging ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : !agingReport ? (
                <p className="text-muted-foreground py-12 text-center">No aging data available</p>
              ) : (
                <>
                  <div className="h-[300px] w-full mb-4">
                    <ChartContainer config={agingConfig} className="h-full w-full">
                      <BarChart data={agingChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis dataKey="bucket" />
                        <YAxis tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
                        <ChartTooltip 
                          content={<ChartTooltipContent />}
                          formatter={(value: number) => formatCurrencyAmount(value, currency)}
                        />
                        <Bar dataKey="amount" fill="var(--color-amount)" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">0-30 Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['0-30'] ?? 0, currency)}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">31-60 Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['31-60'] ?? 0, currency)}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">61-90 Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['61-90'] ?? 0, currency)}</div>
                    </div>
                    <div className="text-center p-4 border rounded-lg">
                      <div className="text-sm text-muted-foreground">90+ Days</div>
                      <div className="text-2xl font-bold mt-2">{formatCurrencyAmount(agingReport['90+'] ?? 0, currency)}</div>
                    </div>
                  </div>
                  <div className="mt-4 pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Total</span>
                      <span className="text-lg font-bold">{formatCurrencyAmount(agingReport.total ?? 0, currency)}</span>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

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

      {/* Receivables Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Receipt className="h-5 w-5" />
                Accounts Receivable
              </CardTitle>
              <CardDescription>Outstanding payments from customers</CardDescription>
            </div>
            <Button onClick={handleCreateReceivable} size="sm" disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Receivable
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingReceivables ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : receivables.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No receivables found</p>
              <Button onClick={handleCreateReceivable} variant="outline" size="sm" disabled={!companyId}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Receivable
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {receivables.map((receivable) => (
                  <TableRow key={receivable.id}>
                    <TableCell className="font-medium max-w-[300px] truncate" title={receivable.description || ''}>
                      {receivable.description || 'N/A'}
                    </TableCell>
                    <TableCell>{formatCurrencyAmount(receivable.amount ?? 0, currency)}</TableCell>
                    <TableCell>{formatDate(receivable.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(receivable.status)}>
                        {receivable.status.charAt(0).toUpperCase() + receivable.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditReceivable(receivable)}
                          disabled={!companyId}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteReceivable(receivable)}
                          disabled={!companyId || deleteReceivableMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Payables Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Accounts Payable
              </CardTitle>
              <CardDescription>Outstanding payments to vendors</CardDescription>
            </div>
            <Button onClick={handleCreatePayable} size="sm" disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Payable
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingPayables ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : payables.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No payables found</p>
              <Button onClick={handleCreatePayable} variant="outline" size="sm" disabled={!companyId}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Payable
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Description</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payables.map((payable) => (
                  <TableRow key={payable.id}>
                    <TableCell className="font-medium max-w-[300px] truncate" title={payable.description || ''}>
                      {payable.description || 'N/A'}
                    </TableCell>
                    <TableCell>{formatCurrencyAmount(payable.amount ?? 0, currency)}</TableCell>
                    <TableCell>{formatDate(payable.due_date)}</TableCell>
                    <TableCell>
                      <Badge variant={getStatusBadgeVariant(payable.status)}>
                        {payable.status.charAt(0).toUpperCase() + payable.status.slice(1)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEditPayable(payable)}
                          disabled={!companyId}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeletePayable(payable)}
                          disabled={!companyId || deletePayableMut.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Inventory Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Inventory
              </CardTitle>
              <CardDescription>Current inventory items and values</CardDescription>
            </div>
            <Button onClick={handleCreateInventory} size="sm" disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Item
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {loadingInventory ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : inventory.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No inventory items found</p>
              <Button onClick={handleCreateInventory} variant="outline" size="sm" disabled={!companyId}>
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Item
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Item Name</TableHead>
                  <TableHead>Quantity</TableHead>
                  <TableHead>Unit Cost</TableHead>
                  <TableHead>Total Value</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {inventory.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.item_name || 'Unknown'}</TableCell>
                    <TableCell>{item.quantity ?? 0}</TableCell>
                    <TableCell>{formatCurrencyAmount(item.unit_cost ?? 0, currency)}</TableCell>
                    <TableCell>{formatCurrencyAmount(item.total_value ?? 0, currency)}</TableCell>
                    <TableCell>{formatDate(item.last_updated)}</TableCell>
                    <TableCell className="text-right">
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
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Form Dialogs */}
      <ReceivableFormDialog
        open={receivableDialogOpen}
        onOpenChange={setReceivableDialogOpen}
        mode={receivableDialogMode}
        initial={selectedReceivable}
      />
      <PayableFormDialog
        open={payableDialogOpen}
        onOpenChange={setPayableDialogOpen}
        mode={payableDialogMode}
        initial={selectedPayable}
      />
      <InventoryFormDialog
        open={inventoryDialogOpen}
        onOpenChange={setInventoryDialogOpen}
        mode={inventoryDialogMode}
        initial={selectedInventory}
      />

      {/* Delete Confirmation Dialogs */}
      <AlertDialog open={deleteReceivableDialogOpen} onOpenChange={setDeleteReceivableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Receivable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this receivable? This action cannot be undone.
              {receivableToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{receivableToDelete.description || 'No description'}</p>
                  <p className="text-sm">{formatCurrencyAmount(receivableToDelete.amount ?? 0, currency)}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteReceivable}
              disabled={deleteReceivableMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteReceivableMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={deletePayableDialogOpen} onOpenChange={setDeletePayableDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Payable</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this payable? This action cannot be undone.
              {payableToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{payableToDelete.description || 'No description'}</p>
                  <p className="text-sm">{formatCurrencyAmount(payableToDelete.amount ?? 0, currency)}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeletePayable}
              disabled={deletePayableMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deletePayableMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
