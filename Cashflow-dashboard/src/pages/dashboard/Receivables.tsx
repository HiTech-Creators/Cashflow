import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Loader2, Receipt, Plus, Pencil, Trash2 } from "lucide-react"
import { useReceivables, useAgingReport, useCompanyId, useDeleteReceivable } from "@/hooks/useApi"
import ReceivableFormDialog from "@/components/ReceivableFormDialog"
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
import type { Receivable } from "@/lib/api"
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

export default function Receivables() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)

  // Dialog states
  const [receivableDialogOpen, setReceivableDialogOpen] = useState(false)
  const [receivableDialogMode, setReceivableDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedReceivable, setSelectedReceivable] = useState<Receivable | undefined>()

  // Delete confirmation dialog
  const [deleteReceivableDialogOpen, setDeleteReceivableDialogOpen] = useState(false)
  const [receivableToDelete, setReceivableToDelete] = useState<Receivable | null>(null)

  // Filters
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "overdue" | "paid">("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [dueStartDate, setDueStartDate] = useState("")
  const [dueEndDate, setDueEndDate] = useState("")

  const { data: receivables = [], isLoading: loadingReceivables, error: errorReceivables } = useReceivables(companyId)
  const { data: agingReport, isLoading: loadingAging, error: errorAging } = useAgingReport(companyId, 'receivables')

  const deleteReceivableMut = useDeleteReceivable()

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

  // Filter receivables
  const filteredReceivables = useMemo(() => {
    return receivables.filter((r) => {
      // Search filter
      const q = search.trim().toLowerCase()
      if (q) {
        const hay = (r.description || '').toLowerCase()
        if (!hay.includes(q)) return false
      }
      
      // Status filter
      if (statusFilter !== "all" && r.status !== statusFilter) return false
      
      // Amount filtering
      const amount = Math.abs(Number(r.amount || 0))
      if (minAmount && !isNaN(Number(minAmount)) && amount < Math.abs(Number(minAmount))) return false
      if (maxAmount && !isNaN(Number(maxAmount)) && amount > Math.abs(Number(maxAmount))) return false
      
      // Due date filtering
      if (dueStartDate || dueEndDate) {
        const dueDateStr = r.due_date
        if (!dueDateStr) return false
        try {
          const dueDate = new Date(dueDateStr + 'T00:00:00Z')
          if (isNaN(dueDate.getTime())) return false
          
          const start = dueStartDate ? new Date(dueStartDate + 'T00:00:00Z') : null
          const end = dueEndDate ? new Date(dueEndDate + 'T23:59:59Z') : null
          
          if (start && dueDate < start) return false
          if (end && dueDate > end) return false
        } catch {
          return false
        }
      }
      
      return true
    })
  }, [receivables, search, statusFilter, minAmount, maxAmount, dueStartDate, dueEndDate])

  const totalReceivables = filteredReceivables.reduce((sum, r) => sum + (r.amount ?? 0), 0)
  const overdueReceivables = filteredReceivables.filter(r => r.status === 'overdue').reduce((sum, r) => sum + (r.amount ?? 0), 0)

  // Chart data preparation
  const agingChartData = agingReport ? [
    { bucket: '0-30', amount: agingReport['0-30'] ?? 0 },
    { bucket: '31-60', amount: agingReport['31-60'] ?? 0 },
    { bucket: '61-90', amount: agingReport['61-90'] ?? 0 },
    { bucket: '90+', amount: agingReport['90+'] ?? 0 },
  ] : []

  const agingConfig = {
    amount: {
      label: "Amount",
      color: "#3b82f6",
    },
  }

  if (errorReceivables || errorAging) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Receivables</h1>
          <p className="text-muted-foreground mt-1">Manage accounts receivable</p>
        </div>
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <p className="text-destructive">
                {errorReceivables?.message || errorAging?.message || "Failed to load receivables data"}
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
        <h1 className="text-3xl font-bold tracking-tight">Receivables</h1>
        <p className="text-muted-foreground mt-1">Manage accounts receivable and track outstanding payments</p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Total Receivables</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReceivables ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
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
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Overdue Amount</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReceivables ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold text-destructive">{formatCurrencyAmount(overdueReceivables, currency)}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {receivables.filter(r => r.status === 'overdue').length} overdue {receivables.filter(r => r.status === 'overdue').length === 1 ? 'item' : 'items'}
                </p>
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Pending Amount</CardTitle>
          </CardHeader>
          <CardContent>
            {loadingReceivables ? (
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            ) : (
              <>
                <div className="text-2xl font-bold">{formatCurrencyAmount(
                  receivables.filter(r => r.status === 'pending').reduce((sum, r) => sum + (r.amount ?? 0), 0),
                  currency
                )}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  {receivables.filter(r => r.status === 'pending').length} pending {receivables.filter(r => r.status === 'pending').length === 1 ? 'item' : 'items'}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Aging Report Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Aging Report</CardTitle>
          <CardDescription>Breakdown by time buckets</CardDescription>
        </CardHeader>
        <CardContent>
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
        </CardContent>
      </Card>

      {/* Receivables Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">Accounts Receivable</CardTitle>
              <CardDescription>Outstanding payments from customers</CardDescription>
            </div>
            <Button onClick={handleCreateReceivable} size="sm" disabled={!companyId}>
              <Plus className="h-4 w-4 mr-2" />
              Add Receivable
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
                  placeholder="Description" 
                  value={search} 
                  onChange={(e) => setSearch(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="status" className="text-xs text-muted-foreground">Status</Label>
                <Select value={statusFilter} onValueChange={(v: string) => setStatusFilter(v as any)}>
                  <SelectTrigger id="status"><SelectValue placeholder="All Status" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="overdue">Overdue</SelectItem>
                    <SelectItem value="paid">Paid</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="minAmount" className="text-xs text-muted-foreground">Min Amount</Label>
                <Input 
                  id="minAmount"
                  type="number" 
                  placeholder="0" 
                  value={minAmount} 
                  onChange={(e) => setMinAmount(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="maxAmount" className="text-xs text-muted-foreground">Max Amount</Label>
                <Input 
                  id="maxAmount"
                  type="number" 
                  placeholder="0" 
                  value={maxAmount} 
                  onChange={(e) => setMaxAmount(e.target.value)} 
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Due Date Range</Label>
                <div className="flex gap-2">
                  <Input 
                    type="date" 
                    placeholder="From" 
                    value={dueStartDate} 
                    onChange={(e) => setDueStartDate(e.target.value)} 
                    className="w-1/2" 
                    title="Due date from"
                  />
                  <Input 
                    type="date" 
                    placeholder="To" 
                    value={dueEndDate} 
                    onChange={(e) => setDueEndDate(e.target.value)} 
                    className="w-1/2" 
                    title="Due date to"
                  />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                Showing {filteredReceivables.length} of {receivables.length} receivables
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => { 
                  setSearch(""); 
                  setStatusFilter("all"); 
                  setMinAmount(""); 
                  setMaxAmount(""); 
                  setDueStartDate(""); 
                  setDueEndDate(""); 
                }}
              >
                Clear filters
              </Button>
            </div>
          </div>

          {loadingReceivables ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Loading receivables...</div>
            </div>
          ) : filteredReceivables.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">No receivables found</div>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-3 font-medium">Description</th>
                    <th className="py-3 font-medium">Amount</th>
                    <th className="py-3 font-medium">Due Date</th>
                    <th className="py-3 font-medium">Status</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReceivables.map((receivable) => (
                    <tr 
                      key={receivable.id} 
                      className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                    >
                      <td className="py-3 font-medium max-w-[300px] truncate" title={receivable.description || ''}>
                        {receivable.description || 'N/A'}
                      </td>
                      <td className="py-3">{formatCurrencyAmount(receivable.amount ?? 0, currency)}</td>
                      <td className="py-3 text-gray-600">{formatDate(receivable.due_date)}</td>
                      <td className="py-3">
                        <Badge variant={getStatusBadgeVariant(receivable.status)}>
                          {receivable.status.charAt(0).toUpperCase() + receivable.status.slice(1)}
                        </Badge>
                      </td>
                      <td className="py-3 text-right">
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
      <ReceivableFormDialog
        open={receivableDialogOpen}
        onOpenChange={setReceivableDialogOpen}
        mode={receivableDialogMode}
        initial={selectedReceivable}
      />

      {/* Delete Confirmation Dialog */}
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
    </div>
  )
}
