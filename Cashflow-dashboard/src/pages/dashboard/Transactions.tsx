import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts"
import { Plus, Upload } from "lucide-react"
import toast from "react-hot-toast"
import { useMonthlyIncomeExpense, useTransactions, useCompanyId, useDeleteTransaction } from "@/hooks/useApi"
import { getCategoryColor } from "@/lib/utils"
import TransactionFormDialog from "@/components/TransactionFormDialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { hasPermission } from "@/lib/permissions"


const transactionConfig = {
  inflows: { label: "Inflows", color: "#6366F1" },
  outflows: { label: "Outflows", color: "#8B5CF6" },
}

// Valid ISO currency codes from backend
const VALID_CURRENCIES = ['USD', 'EUR', 'GBP', 'JPY', 'INR', 'CAD', 'AUD', 'CHF', 'CNY', 'MXN']

function validateCurrencyCode(currency: any): string {
  if (!currency || typeof currency !== 'string') return 'USD'
  const upper = currency.toUpperCase().trim()
  // Must be exactly 3 uppercase letters and in valid list
  if (upper.length === 3 && /^[A-Z]{3}$/.test(upper) && VALID_CURRENCIES.includes(upper)) {
    return upper
  }
  return 'USD' // Default fallback
}

export default function Transactions() {
  const companyId = useCompanyId()
  const { data: incExp, isLoading: isLoadingIncExp } = useMonthlyIncomeExpense()
  const [page, setPage] = useState(1)
  const { data: txns, isLoading: isLoadingTxns } = useTransactions(companyId, page, 10)
  const deleteMut = useDeleteTransaction()
  const [openCreate, setOpenCreate] = useState(false) as any
  const [editTxn, setEditTxn] = useState<any | null>(null)
  
  // Permission checks
  const canDelete = hasPermission('delete_transactions')
  const canEdit = hasPermission('edit_transactions')

  // Filters
  const [query, setQuery] = useState("")
  const [typeFilter, setTypeFilter] = useState<"all" | "inflow" | "outflow">("all")
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const transactionData = (Array.isArray(incExp) ? incExp : []).map((m) => ({ month: m.month, inflows: m.income, outflows: m.expenses }))

  // Apply filters with null safety
  const filteredTxns = (Array.isArray(txns?.transactions) ? txns.transactions : []).filter((t: any) => {
    if (!t) return false
    // Filter by type (inflow/outflow)
    if (typeFilter !== "all" && t.type !== typeFilter) return false
    // Search in description and category
    const q = query.trim().toLowerCase()
    if (q && !(`${t.description || ""} ${t.category || ""}`.toLowerCase().includes(q))) return false
    // Amount filtering - use absolute value for comparison
    const amt = Math.abs(Number(t.amount || 0))
    if (minAmount && !isNaN(Number(minAmount)) && amt < Math.abs(Number(minAmount))) return false
    if (maxAmount && !isNaN(Number(maxAmount)) && amt > Math.abs(Number(maxAmount))) return false

    // Date filtering - more robust parsing
    if (startDate || endDate) {
      const dateStr = t.date
      if (!dateStr) return false

      let transactionDate: Date | null = null
      try {
        // Try different date formats
        if (typeof dateStr === 'string' && /^\d{4}-\d{2}-\d{2}/.test(dateStr)) {
          transactionDate = new Date(dateStr + 'T00:00:00Z')
        } else if (typeof dateStr === 'string') {
          transactionDate = new Date(dateStr)
        } else if (typeof dateStr === 'number') {
          transactionDate = new Date(dateStr)
        }

        if (!transactionDate || isNaN(transactionDate.getTime())) return false

        const start = startDate ? new Date(startDate + 'T00:00:00Z') : null
        const end = endDate ? new Date(endDate + 'T23:59:59Z') : null

        if (start && transactionDate < start) return false
        if (end && transactionDate > end) return false
      } catch {
        return false
      }
    }

    return true
  })

  const categoryTotals: Record<string, number> = {}
  filteredTxns.forEach((t: any) => {
    const category = t.category || 'Other'
    const amount = Math.abs(Number(t.amount || 0))
    categoryTotals[category] = (categoryTotals[category] || 0) + amount
  })
  const categoryData = Object.entries(categoryTotals).map(([name, value]: [string, number]) => ({
    name,
    value,
    fill: getCategoryColor(name)
  }))

  const formatDate = (value: unknown): string => {
    try {
      if (typeof value === 'string') {
        if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
        const d = new Date(value)
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
        const d2 = new Date(`${value}T00:00:00Z`)
        if (!isNaN(d2.getTime())) return d2.toISOString().slice(0, 10)
      } else if (typeof value === 'number') {
        const ms = value > 1e12 ? value : value * 1000
        const d = new Date(ms)
        if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10)
      }
    } catch {}
    return ''
  }

  const rows = filteredTxns.map((t: any) => {
    // Ensure we use the correct fields from backend
    const amount = Number(t.amount || 0)
    const isOutflow = t.type === 'outflow'
    return {
      id: t.id || t._id || '',
      date: formatDate(t.date),
      desc: t.description || '',
      category: t.category || '',
      currency: validateCurrencyCode(t.currency), // Validate currency code
      type: t.type || (amount < 0 ? 'outflow' : 'inflow'),
      amount: isOutflow ? -Math.abs(amount) : Math.abs(amount),
      originalAmount: amount, // Keep original for filtering
    }
  })

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Transactions</h2>
          <p className="text-muted-foreground">Track inflows and outflows with categorization</p>
        </div>
        <div className="flex gap-2">
          <Button 
            variant="secondary"
            onClick={() => {
              const input = document.createElement('input')
              input.type = 'file'
              input.accept = '.csv,.xlsx,.xls'
              input.onchange = async (e: any) => {
                const file = e.target.files?.[0]
                if (!file) return
                if (!companyId) {
                  toast.error("Please select a company first")
                  return
                }
                try {
                  const { fileApi } = await import('@/lib/api')
                  const response = await fileApi.uploadTransactions(file)
                  toast.success(`Successfully imported ${response.processed_count || 0} transactions`)
                  if (response.errors && response.errors.length > 0) {
                    toast.error(`Some errors occurred: ${response.errors.join(', ')}`)
                  }
                  // Refresh transactions
                  window.location.reload()
                } catch (error: any) {
                  const errorMessage = error?.response?.data?.error || error?.response?.data?.message || error?.message || "Failed to import file"
                  toast.error(errorMessage)
                }
              }
              input.click()
            }}
            disabled={!companyId}
          >
            <Upload className="h-4 w-4 mr-2" />
            Import CSV
          </Button>
          <Button onClick={() => setOpenCreate(true)}>
            <Plus className="h-4 w-4 mr-2" />
            Add Transaction
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Transaction Flow</CardTitle>
            <CardDescription>Monthly inflows vs outflows</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="h-[300px] w-full">
              {isLoadingIncExp ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">Loading chart data...</div>
                </div>
              ) : (
                <ChartContainer config={transactionConfig} className="h-full w-full">
                  <BarChart data={transactionData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={(props: any) => <ChartLegendContent {...props} />} wrapperStyle={{}} />
                    <Bar dataKey="inflows" fill="var(--color-inflows)" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="outflows" fill="var(--color-outflows)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Category Breakdown</CardTitle>
            <CardDescription>Transaction distribution by category</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="h-[300px] w-full">
              {isLoadingTxns ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">Loading category data...</div>
                </div>
              ) : categoryData.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <div className="text-muted-foreground">No transaction data available</div>
                </div>
              ) : (
                <ChartContainer config={transactionConfig} className="h-full w-full">
                  <PieChart>
                    <ChartTooltip content={<ChartTooltipContent hideLabel />} />
                    <Pie
                      data={categoryData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      fill="#8884d8"
                      label
                    >
                      {categoryData.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <ChartLegend content={(props: any) => <ChartLegendContent {...props} />} wrapperStyle={{}} />
                  </PieChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Transactions</CardTitle>
          <CardDescription>Latest financial activities</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
              <Input placeholder="Search description or category" value={query} onChange={(e) => setQuery(e.target.value)} />
              <Select value={typeFilter} onValueChange={(v: any) => setTypeFilter(v)}>
                <SelectTrigger><SelectValue placeholder="Type" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="inflow">Inflow</SelectItem>
                  <SelectItem value="outflow">Outflow</SelectItem>
                </SelectContent>
              </Select>
              <Input type="number" placeholder="Min amount" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} />
              <Input type="number" placeholder="Max amount" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} />
              <div className="flex gap-2">
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-1/2" />
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-1/2" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-xs text-muted-foreground">Showing {filteredTxns.length} of {txns?.total ?? filteredTxns.length} transactions</div>
              <Button variant="outline" size="sm" onClick={() => { setQuery(""); setTypeFilter("all"); setMinAmount(""); setMaxAmount(""); setStartDate(""); setEndDate("") }}>Clear filters</Button>
            </div>
          </div>
          <div className="overflow-x-auto">
            {isLoadingTxns ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">Loading transactions...</div>
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-muted-foreground">No transactions found</div>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-3 font-medium">Date</th>
                    <th className="py-3 font-medium">Description</th>
                    <th className="py-3 font-medium">Category</th>
                    <th className="py-3 font-medium">Type</th>
                    <th className="py-3 text-right font-medium">Amount</th>
                    <th className="py-3 text-right font-medium">Currency</th>
                    <th className="py-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r: any, i: number) => {
                    const originalTxn = filteredTxns[i]
                    return (
                      <tr key={r.id || i} className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer">
                        <td className="py-3 text-gray-600">{r.date || 'N/A'}</td>
                        <td className="py-3 font-medium">{r.desc || 'N/A'}</td>
                        <td className="py-3">
                          {r.category ? (
                            <span
                              className="px-2 py-1 rounded-full text-xs text-white"
                              style={{ backgroundColor: getCategoryColor(r.category) }}
                            >
                              {r.category}
                            </span>
                          ) : (
                            <span className="text-gray-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="py-3">
                          <Badge
                            variant={r.type === 'inflow' ? 'default' : 'secondary'}
                            className={
                              r.type === 'inflow'
                                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                                : 'bg-red-100 text-red-700 hover:bg-red-200'
                            }
                          >
                            {r.type === 'inflow' ? 'Income' : 'Expense'}
                          </Badge>
                        </td>
                        <td className={`py-3 text-right font-medium ${r.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                          {r.amount < 0 ? "-" : "+"}
                          {(() => {
                            const currencyCode = validateCurrencyCode(r.currency)
                            try {
                              return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: currencyCode,
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(Math.abs(r.amount || 0))
                            } catch (e) {
                              // Fallback if currency is still invalid
                              return new Intl.NumberFormat('en-US', {
                                style: 'currency',
                                currency: 'USD',
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              }).format(Math.abs(r.amount || 0))
                            }
                          })()}
                        </td>
                        <td className="py-3 text-right text-xs text-gray-500">
                          {validateCurrencyCode(r.currency)}
                        </td>
                        <td className="py-3 text-right">
                          <div className="flex gap-2 justify-end">
                            {canEdit && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditTxn(originalTxn)}
                                disabled={!originalTxn}
                              >
                                Edit
                              </Button>
                            )}
                            {canDelete && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-destructive"
                                    disabled={!originalTxn}
                                  >
                                    Delete
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>Delete this transaction?</AlertDialogTitle>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => {
                                        if (originalTxn?.id && companyId) {
                                          deleteMut.mutate(
                                            { transactionId: originalTxn.id, companyId },
                                            {
                                              onSuccess: () => toast.success("Transaction deleted"),
                                              onError: () => toast.error("Failed to delete transaction"),
                                            }
                                          )
                                        }
                                      }}
                                    >
                                      Delete
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-muted-foreground">Page {txns?.pagination?.page ?? txns?.page ?? page} of {txns?.pagination?.total_pages ?? txns?.pages ?? 1} • Total {txns?.pagination?.total ?? txns?.total ?? rows.length}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" disabled={(txns?.page || page) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                <Button variant="outline" size="sm" disabled={(txns?.page || page) >= (txns?.pages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <TransactionFormDialog open={openCreate} onOpenChange={setOpenCreate} mode="create" />
      <TransactionFormDialog open={!!editTxn} onOpenChange={(v) => setEditTxn(v ? editTxn : null)} mode="edit" initial={editTxn || undefined} />
    </div>
  )
}


