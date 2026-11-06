import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Area, AreaChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { TrendingUp, TrendingDown, DollarSign } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useMemo, useState } from "react"
import { useCashOverview, useMonthlyBalances, useCashActivities, useCompanyId } from "@/hooks/useApi"
import { reportsApi, financialApi } from "@/lib/api"
import toast from "react-hot-toast"
import { Input } from "@/components/ui/input"
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency"

const cashFlowConfig = {
  net: {
    label: "Net Cash Flow",
    color: "#3b82f6",
  },
}

export default function CashFlow() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)
  const { data: overview, isLoading: isLoadingOverview } = useCashOverview(companyId)
  const { data: monthlyBalances, isLoading: isLoadingBalances } = useMonthlyBalances(companyId)
  const [page, setPage] = useState(1)
  const { data: activities, isLoading: isLoadingActivities } = useCashActivities(companyId, page, 10)
  // Get all transactions for calculating totals
  const { data: allActivities } = useCashActivities(companyId, 1, 10000)

  const netSeries = Array.isArray(monthlyBalances) && monthlyBalances.length > 0
    ? monthlyBalances.map((b: any) => ({ month: b.month, net: Number(b.balance ?? 0) }))
    : []

  const [initialBalance, setInitialBalance] = useState<string>("")
  const [settingInit, setSettingInit] = useState(false)

  const [balanceDate, setBalanceDate] = useState<string>("")
  const [balanceByDate, setBalanceByDate] = useState<number | null>(null)
  const [calcLoading, setCalcLoading] = useState(false)

  const handleSetInitial = async () => {
    // Validate company ID
    if (!companyId) {
      toast.error('Please select a company first')
      return
    }

    // Validate input is not empty
    if (!initialBalance.trim()) {
      toast.error('Please enter an initial balance amount')
      return
    }

    // Validate input is a valid number
    const valNum = Number(initialBalance.trim())
    if (isNaN(valNum)) {
      toast.error('Please enter a valid number')
      return
    }

    // Validate number is finite (not Infinity or -Infinity)
    if (!isFinite(valNum)) {
      toast.error('Amount must be a finite number')
      return
    }

    // Validate reasonable range (optional - can be adjusted)
    const MAX_AMOUNT = 999999999999 // 999 billion
    if (Math.abs(valNum) > MAX_AMOUNT) {
      toast.error(`Amount must be between -${MAX_AMOUNT.toLocaleString()} and ${MAX_AMOUNT.toLocaleString()}`)
      return
    }

    try {
      setSettingInit(true)
      await financialApi.setInitialBalance({ company_id: companyId, initial_balance: valNum } as any)
      toast.success('Initial balance updated successfully')
      setInitialBalance('') // Clear input on success
    } catch (error: any) {
      // Extract user-friendly error message
      const errorMessage = error?.message || error?.response?.data?.message || error?.response?.data?.error
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error('Failed to update initial balance. Please try again.')
      }
    } finally {
      setSettingInit(false)
    }
  }

  const handleCalcBalance = async () => {
    // Validate company ID
    if (!companyId) {
      toast.error('Please select a company first')
      return
    }

    // Validate date is provided
    if (!balanceDate.trim()) {
      toast.error('Please select a date')
      return
    }

    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(balanceDate)) {
      toast.error('Please enter a valid date in YYYY-MM-DD format')
      return
    }

    // Validate date is not in the future (optional business rule)
    const selectedDate = new Date(balanceDate)
    const today = new Date()
    today.setHours(23, 59, 59, 999) // End of today
    
    if (selectedDate > today) {
      toast.error('Cannot calculate balance for future dates')
      return
    }

    // Validate date is reasonable (not too far in the past, e.g., 1900)
    const MIN_DATE = new Date('1900-01-01')
    if (selectedDate < MIN_DATE) {
      toast.error('Date must be after January 1, 1900')
      return
    }

    try {
      setCalcLoading(true)
      const res = await financialApi.getBalanceByDate({ company_id: companyId, date: balanceDate } as any)
      const bal = Number((res as any)?.balance ?? 0)
      
      if (!isFinite(bal)) {
        toast.error('Invalid balance calculated. Please check your data.')
        return
      }

      setBalanceByDate(bal)
      toast.success(`Balance calculated: ${formatCurrencyAmount(bal, currency)}`)
    } catch (error: any) {
      // Extract user-friendly error message
      const errorMessage = error?.message || error?.response?.data?.message || error?.response?.data?.error
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error('Failed to calculate balance. Please check the date and try again.')
      }
    } finally {
      setCalcLoading(false)
    }
  }

  // Calculate CFO/CFI/CFF from transactions on frontend (since backend categorization is strict)
  const calculatedTotals = useMemo(() => {
    const transactions = allActivities?.items || []
    
    // Define category keywords for each cash flow type (case-insensitive matching)
    const cfoKeywords = ['operating', 'revenue', 'expenses', 'expense', 'marketing', 'salary', 
                          'salaries', 'supplier', 'suppliers', 'customer', 'customers', 'tax',
                          'rent', 'utilities', 'office', 'consulting', 'service', 'services',
                          'advertising', 'promotion', 'campaign', 'training', 'bonus', 'bonuses',
                          'it expenses', 'it expense', 'maintenance', 'upgrade', 'upgrades']
    const cfiKeywords = ['investing', 'investment', 'assets', 'asset', 'equipment', 'property',
                          'infrastructure', 'server', 'servers', 'purchase', 'acquisition']
    const cffKeywords = ['financing', 'loan', 'loans', 'equity', 'dividend', 'dividends',
                          'borrowing', 'borrowings', 'repay', 'repayment', 'shares', 'share']
    
    let totalCFO = 0
    let totalCFI = 0
    let totalCFF = 0
    
    transactions.forEach((transaction: any) => {
      const amount = transaction.type === 'inflow' 
        ? Number(transaction.amount || 0) 
        : -Number(transaction.amount || 0)
      
      if (!transaction.category) {
        // Default to CFO if no category
        totalCFO += amount
        return
      }
      
      const categoryLower = String(transaction.category).toLowerCase()
      
      // Check if category matches any CFO keywords
      if (cfoKeywords.some(keyword => categoryLower.includes(keyword))) {
        totalCFO += amount
      }
      // Check if category matches any CFI keywords
      else if (cfiKeywords.some(keyword => categoryLower.includes(keyword))) {
        totalCFI += amount
      }
      // Check if category matches any CFF keywords
      else if (cffKeywords.some(keyword => categoryLower.includes(keyword))) {
        totalCFF += amount
      }
      else {
        // Default to CFO for unknown categories (most transactions are operating)
        totalCFO += amount
      }
    })
    
    return {
      CFO: totalCFO,
      CFI: totalCFI,
      CFF: totalCFF,
    }
  }, [allActivities])
  
  // Initialize with zeros if no data yet
  const displayTotals = calculatedTotals || { CFO: 0, CFI: 0, CFF: 0 }

  const statementSummary = useMemo(() => {
    // Use calculated totals from frontend instead of backend
    return displayTotals
  }, [displayTotals])

  const handleExport = async () => {
    // Validate company ID
    if (!companyId) {
      toast.error('Please select a company first')
      return
    }

    // Check if there's any data to export
    if (!overview || (!overview.total_cfo && !overview.total_cfi && !overview.total_cff)) {
      toast.error('No cash flow data available to export. Please add some transactions first.')
      return
    }

    try {
      const blob = await reportsApi.generateCashflowStatement(companyId)
      
      // Validate blob was received
      if (!blob || blob.size === 0) {
        toast.error('Export file is empty. Please try again.')
        return
      }

      const url = window.URL.createObjectURL(blob as any)
      const a = document.createElement('a')
      a.href = url
      a.download = `cashflow_statement_${new Date().toISOString().split('T')[0]}.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
      toast.success('Cashflow statement exported successfully')
    } catch (error: any) {
      // Extract user-friendly error message
      const errorMessage = error?.message || error?.response?.data?.message || error?.response?.data?.error
      if (errorMessage) {
        toast.error(errorMessage)
      } else {
        toast.error('Failed to export cashflow statement. Please try again.')
      }
    }
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Cash Flow</h2>
          <p className="text-muted-foreground">Overview, trends and recent activities</p>
        </div>
        <Button 
          onClick={handleExport}
          disabled={!companyId || isLoadingOverview}
        >
          {isLoadingOverview ? 'Loading…' : 'Export Cashflow Statement'}
        </Button>
      </div>

      {!companyId ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <p className="text-muted-foreground">Please select a company to view cash flow data</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            { label: "Operating (CFO)", value: isLoadingOverview ? '—' : formatCurrencyAmount(displayTotals.CFO, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), color: "#8b5cf6", icon: TrendingUp, positive: displayTotals.CFO >= 0 },
            { label: "Investing (CFI)", value: isLoadingOverview ? '—' : formatCurrencyAmount(displayTotals.CFI, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), color: "#ec4899", icon: TrendingDown, positive: displayTotals.CFI >= 0 },
            { label: "Financing (CFF)", value: isLoadingOverview ? '—' : formatCurrencyAmount(displayTotals.CFF, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 }), color: "#14b8a6", icon: DollarSign, positive: displayTotals.CFF >= 0 },
          ].map((b) => (
            <Card key={b.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{b.label}</CardTitle>
                <b.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: b.color }}>{b.value}</div>
                <p className="text-xs text-muted-foreground mt-1">Current totals</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <Card className="flex flex-col xl:col-span-2">
          <CardHeader>
            <CardTitle>Monthly Cash Flow Trends</CardTitle>
            <CardDescription>Net cash flow over time</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            <div className="h-[400px] w-full">
              {isLoadingBalances ? (
                <div className="h-full w-full animate-pulse rounded-md bg-muted" />
              ) : netSeries.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  No balance data available
                </div>
              ) : (
                <ChartContainer config={cashFlowConfig} className="h-full w-full">
                  <AreaChart data={netSeries}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="month" />
                    <YAxis />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Area
                      type="monotone"
                      dataKey="net"
                      stroke="var(--color-net)"
                      fill="var(--color-net)"
                      fillOpacity={0.3}
                      strokeWidth={3}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Set Initial Balance</CardTitle>
              <CardDescription>Sets starting cash balance</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Input 
                type="number" 
                placeholder="Amount (can be negative)" 
                value={initialBalance} 
                onChange={(e) => {
                  const value = e.target.value
                  // Allow negative numbers, decimals, and empty input
                  if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                    setInitialBalance(value)
                  }
                }}
                step="0.01"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && initialBalance.trim() && !settingInit && companyId) {
                    handleSetInitial()
                  }
                }}
              />
              {!companyId && (
                <p className="text-xs text-amber-600">Please select a company first</p>
              )}
              <Button 
                onClick={handleSetInitial} 
                disabled={settingInit || !companyId || !initialBalance.trim()}
              >
                {settingInit ? 'Saving…' : 'Save'}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Balance by Date</CardTitle>
              <CardDescription>Calculate balance for a specific date</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {!companyId && (
                <p className="text-xs text-amber-600 mb-1">Please select a company first</p>
              )}
              <div className="flex gap-2">
                <Input 
                  type="date" 
                  value={balanceDate} 
                  onChange={(e) => setBalanceDate(e.target.value)}
                  max={new Date().toISOString().split('T')[0]} // Prevent future dates
                />
                <Button 
                  onClick={handleCalcBalance} 
                  disabled={calcLoading || !companyId || !balanceDate}
                >
                  {calcLoading ? 'Calculating…' : 'Calculate'}
                </Button>
              </div>
              {balanceByDate !== null && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Balance on {balanceDate}: </span>
                  <span className="font-semibold">{formatCurrencyAmount(balanceByDate, currency)}</span>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Statement Summary</CardTitle>
              <CardDescription>Totals by activities</CardDescription>
            </CardHeader>
            <CardContent>
              {!statementSummary ? (
                <div className="text-sm text-muted-foreground">No statement data</div>
              ) : (
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-muted-foreground">CFO</div>
                    <div className="font-medium">{formatCurrencyAmount(statementSummary.CFO || 0, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">CFI</div>
                    <div className="font-medium">{formatCurrencyAmount(statementSummary.CFI || 0, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  </div>
                  <div>
                    <div className="text-muted-foreground">CFF</div>
                    <div className="font-medium">{formatCurrencyAmount(statementSummary.CFF || 0, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Cash Activities</CardTitle>
          <CardDescription>Latest movements</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoadingActivities ? (
            <div className="h-32 w-full animate-pulse rounded-md bg-muted" />
          ) : (!activities || !activities.items || activities.items.length === 0) ? (
            <div className="text-sm text-muted-foreground">No recent activities</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-muted-foreground border-b">
                  <tr>
                    <th className="py-3 font-medium">Date</th>
                    <th className="py-3 font-medium">Description</th>
                    <th className="py-3 font-medium">Category</th>
                    <th className="py-3 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {activities.items.map((a: any) => (
                    <tr key={a.id} className="border-b last:border-0">
                      <td className="py-3">{String(a.date).slice(0, 10)}</td>
                      <td className="py-3 font-medium">{a.description}</td>
                      <td className="py-3">{a.category}</td>
                      <td className={`py-3 text-right font-medium ${a.amount < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatCurrencyAmount(a.amount, currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-muted-foreground">Page {activities.page} of {activities.pages} • Total {activities.total}</div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" disabled={(activities.page || 1) <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>Previous</Button>
                  <Button variant="outline" size="sm" disabled={(activities.page || 1) >= (activities.pages || 1)} onClick={() => setPage((p) => p + 1)}>Next</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}


