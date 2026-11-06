import { useState, useMemo, useEffect } from "react"
import { motion } from "framer-motion"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip } from "@/components/ui/chart"
import { Line, LineChart, XAxis, YAxis, CartesianGrid, Bar, BarChart, PieChart, Pie, Cell, Area, AreaChart } from "recharts"
import { TrendingUp, TrendingDown, Wallet, Zap, ArrowUpRight, ArrowDownRight, Lightbulb, AlertTriangle, Info, Download, Plus, HelpCircle, ChevronRight, AlertCircle, Target } from "lucide-react"
import { useCashActivities, useCompanyId, useDashboardKpis, useAIInsights, useRecentTransactions, useInvoiceSummary } from "@/hooks/useApi"
import { getCategoryColor, cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Progress } from "@/components/ui/progress"
import { useCompanyCurrency, formatCurrencyAmount, getCurrencySymbol } from "@/lib/currency"
import { useNavigate } from "react-router-dom"
import { fileApi } from "@/lib/api"
import toast from "react-hot-toast"

// KPICard Component
function KPICard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  tooltip,
}: {
  title: string
  value: string
  change?: string
  changeType?: "positive" | "negative" | "neutral"
  icon: React.ComponentType<{ className?: string }>
  tooltip?: string
}) {
  return (
    <motion.div variants={item}>
      <Card className="relative overflow-hidden group hover:shadow-md transition-shadow">
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className="text-sm font-medium text-muted-foreground flex items-center gap-1 cursor-help">
                      {title}
                      {tooltip && <Info className="size-3" />}
                    </p>
                  </TooltipTrigger>
                  {tooltip && (
                    <TooltipContent>
                      <p className="max-w-xs text-xs">{tooltip}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
              <p className="text-2xl font-bold tracking-tight">{value}</p>
              {change && (
                <div
                  className={cn(
                    "flex items-center gap-1 text-xs font-medium",
                    changeType === "positive" && "text-green-600",
                    changeType === "negative" && "text-destructive",
                    changeType === "neutral" && "text-muted-foreground"
                  )}
                >
                  {changeType === "positive" ? (
                    <TrendingUp className="size-3" />
                  ) : changeType === "negative" ? (
                    <TrendingDown className="size-3" />
                  ) : null}
                  {change}
                </div>
              )}
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
              <Icon className="size-5" />
            </div>
          </div>
        </CardContent>
        <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20 opacity-0 group-hover:opacity-100 transition-opacity" />
      </Card>
    </motion.div>
  )
}

// Motion variants for KPI cards
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
}

export default function Overview() {
  const companyId = useCompanyId()
  const navigate = useNavigate()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)
  const { data: dashboardKpis, isLoading: kpisLoading } = useDashboardKpis(companyId)
  const { data: activitiesPage, isLoading: isLoadingActivities } = useCashActivities(companyId, 1, 10000)
  const { data: insights, isLoading: isLoadingInsights } = useAIInsights(companyId)
  const { data: recentTransactionsData } = useRecentTransactions(companyId, 1, 5)
  const { data: invoiceSummary } = useInvoiceSummary(companyId)
  const transactions = activitiesPage?.items || []
  const recentTransactions = recentTransactionsData?.transactions || []

  // Calculate monthly revenue and expenses
  const monthlyData = useMemo(() => {
    const monthly: Record<string, { revenue: number; expenses: number }> = {}
    
    transactions.forEach((t: any) => {
      if (!t.date) return
      
      try {
        const date = typeof t.date === 'string' ? new Date(t.date) : new Date(t.date)
        if (isNaN(date.getTime())) return
        
        const monthKey = date.toISOString().slice(0, 7) // YYYY-MM format
        
        if (!monthly[monthKey]) {
          monthly[monthKey] = { revenue: 0, expenses: 0 }
        }
        
        const amount = Number(t.amount || 0)
        if (t.type === 'inflow') {
          monthly[monthKey].revenue += amount
        } else if (t.type === 'outflow') {
          monthly[monthKey].expenses += Math.abs(amount)
        }
      } catch (e) {
        // Skip invalid dates
      }
    })
    
    return Object.entries(monthly)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.month.localeCompare(b.month))
      .slice(-6) // Last 6 months
  }, [transactions])

  // Calculate current month revenue and expenses
  const currentMonth = useMemo(() => {
    const now = new Date()
    const currentMonthKey = now.toISOString().slice(0, 7)
    return monthlyData.find(m => m.month === currentMonthKey) || { revenue: 0, expenses: 0 }
  }, [monthlyData])

  // Calculate previous month for comparison
  const previousMonth = useMemo(() => {
    const now = new Date()
    now.setMonth(now.getMonth() - 1)
    const prevMonthKey = now.toISOString().slice(0, 7)
    return monthlyData.find(m => m.month === prevMonthKey) || { revenue: 0, expenses: 0 }
  }, [monthlyData])

  // Calculate trends
  const revenueTrend = previousMonth.revenue > 0 
    ? ((currentMonth.revenue - previousMonth.revenue) / previousMonth.revenue) * 100 
    : 0
  const expensesTrend = previousMonth.expenses > 0 
    ? ((currentMonth.expenses - previousMonth.expenses) / previousMonth.expenses) * 100 
    : 0
  const netCashFlow = currentMonth.revenue - currentMonth.expenses

  // Format month labels for chart (Aug, Sep, Oct, etc.) - Last 6 months with area chart data
  const cashFlowChartData = useMemo(() => {
    // Get last 6 months of data
    const last6Months = monthlyData.slice(-6)
    
    // If we don't have enough data, create placeholder data
    if (last6Months.length === 0) {
      const now = new Date()
      const months = []
      const baseBalance = dashboardKpis?.current_balance || 0
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push({
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          balance: baseBalance,
        })
      }
      return months
    }
    
    // Calculate cumulative balance showing upward trend
    const baseBalance = dashboardKpis?.current_balance || 0
    let runningBalance = baseBalance
    
    return last6Months.map((m, index) => {
      const date = new Date(m.month + '-01')
      // For the first month, use base balance
      if (index === 0) {
        runningBalance = baseBalance
      } else {
        // Add net flow for each subsequent month
        runningBalance += (m.revenue - m.expenses)
      }
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        balance: Math.max(0, runningBalance),
      }
    })
  }, [monthlyData, dashboardKpis?.current_balance])

  // Calculate cash runway
  const burnRate = Math.abs(dashboardKpis?.burn_rate || 0)
  const currentBalance = dashboardKpis?.current_balance || 0
  const runwayMonths = burnRate > 0 ? currentBalance / burnRate : Infinity
  const runwayPercentage = runwayMonths !== Infinity && runwayMonths > 0 
    ? Math.min(100, (runwayMonths / 12) * 100) 
    : 100

  const formatAmount = (amount: number) => {
    const symbol = getCurrencySymbol(currency)
    if (Math.abs(amount) >= 1000) {
      return `${symbol}${(amount / 1000).toFixed(0)}K`
    }
    return `${symbol}${amount.toFixed(0)}`
  }

  // Format Y-axis labels for area chart (0K, 200K, 400K, etc.)
  const formatYAxisLabel = (value: number) => {
    const symbol = getCurrencySymbol(currency)
    return `${symbol}${(value / 1000).toFixed(0)}K`
  }

  const formatFullAmount = (amount: number) => {
    return formatCurrencyAmount(amount, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })
  }

  const handleExportReport = async () => {
    if (!companyId) {
      toast.error("Please select a company first")
      return
    }
    try {
      const blob = await fileApi.exportTransactionsPdf(companyId)
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dashboard-report-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast.success("Report exported successfully")
    } catch (error) {
      toast.error("Failed to export report")
    }
  }

  // Calculate expense breakdown by category
  const expenseBreakdown = useMemo(() => {
    const breakdown: Record<string, number> = {}
    
    transactions.forEach((t: any) => {
      if (t.type === 'outflow' || (t.amount && Number(t.amount) < 0)) {
        const category = t.category || 'Other'
        const amount = Math.abs(Number(t.amount || 0))
        breakdown[category] = (breakdown[category] || 0) + amount
      }
    })
    
    const total = Object.values(breakdown).reduce((sum, val) => sum + val, 0)
    
    return Object.entries(breakdown)
      .map(([name, value]) => ({
        name,
        value: Number(value),
        percentage: total > 0 ? Math.round((value / total) * 100) : 0,
        fill: getCategoryColor(name),
      }))
      .sort((a, b) => b.value - a.value)
  }, [transactions])

  // Prepare income vs expenses chart data (last 6 months)
  const incomeExpenseChartData = useMemo(() => {
    const last6Months = monthlyData.slice(-6)
    return last6Months.map((m) => {
      const date = new Date(m.month + '-01')
      return {
        month: date.toLocaleDateString('en-US', { month: 'short' }),
        income: m.revenue,
        expenses: m.expenses,
      }
    })
  }, [monthlyData])

  // Format date for display
  const formatTransactionDate = (dateString: string) => {
    try {
      const date = new Date(dateString)
      return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
    } catch {
      return dateString
    }
  }

  // Get insight icon and color
  const getInsightConfig = (insight: any) => {
    const type = insight.type?.toLowerCase() || ''
    if (type.includes('strong') || type.includes('improve') || type.includes('opportunity')) {
      return { icon: Lightbulb, color: 'bg-green-50', iconColor: 'text-green-600' }
    }
    if (type.includes('rising') || type.includes('risk') || type.includes('alert')) {
      return { icon: AlertTriangle, color: 'bg-orange-50', iconColor: 'text-orange-600' }
    }
    return { icon: Info, color: 'bg-blue-50', iconColor: 'text-blue-600' }
  }

  // Invoice summary calculations
  const totalOutstanding = invoiceSummary?.total_outstanding ?? 0
  const totalCollected = invoiceSummary?.total_paid ?? 0
  const totalInvoiceAmount = totalOutstanding + totalCollected
  const collectionRate = totalInvoiceAmount > 0 ? Math.round((totalCollected / totalInvoiceAmount) * 100) : 0
  const overdueCount = invoiceSummary?.by_status?.overdue?.count ?? 0
  const overdueAmount = invoiceSummary?.by_status?.overdue?.total ?? 0

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Welcome back! Here's your financial overview.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExportReport} disabled={!companyId}>
            <Download className="h-4 w-4 mr-2" />
            Export Report
          </Button>
          <Button onClick={() => navigate("/dashboard/transactions?action=create")} disabled={!companyId}>
            <Plus className="h-4 w-4 mr-2" />
            New Transaction
          </Button>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid gap-4 md:grid-cols-2 lg:grid-cols-4"
      >
        <KPICard
          title="Cash Balance"
          value={kpisLoading ? '—' : formatFullAmount(dashboardKpis?.current_balance ?? 0)}
          change="+12.5% from last month"
          changeType="positive"
          icon={Wallet}
          tooltip="Total available cash across all accounts"
        />
        <KPICard
          title="Monthly Revenue"
          value={isLoadingActivities ? '—' : formatFullAmount(currentMonth.revenue)}
          change={`${revenueTrend < 0 ? '' : '+'}${revenueTrend.toFixed(1)}% from last month`}
          changeType={revenueTrend < 0 ? "negative" : "positive"}
          icon={TrendingUp}
          tooltip="Total income received this month"
        />
        <KPICard
          title="Monthly Expenses"
          value={isLoadingActivities ? '—' : formatFullAmount(currentMonth.expenses)}
          change={`${expensesTrend < 0 ? '' : '+'}${expensesTrend.toFixed(1)}% from last month`}
          changeType={expensesTrend < 0 ? "positive" : "negative"}
          icon={TrendingDown}
          tooltip="Total expenses paid this month"
        />
        <KPICard
          title="Net Cash Flow"
          value={isLoadingActivities ? '—' : formatFullAmount(netCashFlow)}
          change="Positive flow"
          changeType="positive"
          icon={Zap}
          tooltip="Revenue minus expenses for this month"
        />
      </motion.div>

      {/* Cash Flow Trend and Cash Runway */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Cash Flow Trend */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Cash Flow Trend</CardTitle>
                <CardDescription>6-month cash position overview</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/forecasting")}>
                View Forecast &gt;
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              {isLoadingActivities || kpisLoading ? (
                <div className="h-full w-full animate-pulse rounded-md bg-gray-100" />
              ) : cashFlowChartData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">No data available</p>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    balance: { label: "Balance", color: "#3B82F6" },
                  }}
                  className="h-full w-full"
                >
                  <AreaChart data={cashFlowChartData}>
                    <defs>
                      <linearGradient id="balanceGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#9CA3AF" stopOpacity={0.4} />
                        <stop offset="100%" stopColor="#9CA3AF" stopOpacity={0.1} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#6B7280", fontSize: 12 }}
                      tickLine={{ stroke: "#E5E7EB" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                    />
                    <YAxis
                      tick={{ fill: "#6B7280", fontSize: 12 }}
                      tickLine={{ stroke: "#E5E7EB" }}
                      axisLine={{ stroke: "#E5E7EB" }}
                      tickFormatter={formatYAxisLabel}
                      domain={['dataMin', 'dataMax']}
                      allowDecimals={false}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border bg-white p-2 shadow-sm">
                            <div className="flex items-center gap-2 text-sm">
                              <div className="h-2 w-2 rounded-full bg-gray-400" />
                              <span className="text-gray-600">Balance:</span>
                              <span className="font-medium">{formatFullAmount(payload[0].value as number)}</span>
                            </div>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="balance"
                      stroke="#6B7280"
                      strokeWidth={2}
                      fill="url(#balanceGradient)"
                      fillOpacity={1}
                    />
                  </AreaChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Cash Runway */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Target className="size-4 text-primary" />
              Cash Runway
            </CardTitle>
            <CardDescription>Time until cash depletion</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center py-4">
              <p className="text-4xl font-bold text-primary">
                {runwayMonths !== Infinity && !isNaN(runwayMonths)
                  ? runwayMonths.toFixed(1)
                  : '∞'}
              </p>
              <p className="text-sm text-muted-foreground">months remaining</p>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Runway Health</span>
                <span
                  className={cn(
                    "font-medium",
                    runwayMonths > 6 ? "text-green-600" : runwayMonths > 3 ? "text-yellow-600" : "text-red-600"
                  )}
                >
                  {runwayMonths > 6 ? "Healthy" : runwayMonths > 3 ? "Moderate" : "Critical"}
                </span>
              </div>
              <Progress
                value={runwayPercentage}
                className={cn(
                  "h-2",
                  runwayMonths > 6 && "[&>div]:bg-green-600",
                  runwayMonths <= 6 && runwayMonths > 3 && "[&>div]:bg-yellow-600",
                  runwayMonths <= 3 && "[&>div]:bg-red-600"
                )}
              />
            </div>

            <div className="pt-2 border-t space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Monthly Burn Rate</span>
                <span className="font-medium">{formatFullAmount(burnRate)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Current Balance</span>
                <span className="font-medium">{formatFullAmount(currentBalance)}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>AI Insights</CardTitle>
              <CardDescription>Smart recommendations for your business</CardDescription>
            </div>
            {insights && Array.isArray(insights) && insights.length > 0 && (
              <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/assistant")}>
                {insights.length} new insight{insights.length !== 1 ? 's' : ''}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingInsights ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"></div>
            </div>
          ) : insights && Array.isArray(insights) && insights.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-3">
              {insights.slice(0, 3).map((insight: any, index: number) => {
                const config = getInsightConfig(insight)
                const Icon = config.icon
                return (
                  <div
                    key={insight.id || index}
                    className={`p-4 rounded-lg ${config.color} border`}
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Icon className={`h-5 w-5 ${config.iconColor} shrink-0 mt-0.5`} />
                      <div className="flex-1">
                        <h4 className="font-semibold text-sm mb-1">{insight.title || 'Insight'}</h4>
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {insight.description || insight.content || ''}
                        </p>
                      </div>
                    </div>
                    {insight.recommendation && (
                      <a
                        href="#"
                        className="text-xs text-blue-600 hover:underline inline-flex items-center gap-1"
                        onClick={(e) => {
                          e.preventDefault()
                          navigate("/dashboard/assistant")
                        }}
                      >
                        {insight.recommendation.length > 50 
                          ? `${insight.recommendation.slice(0, 50)}... →`
                          : `${insight.recommendation} →`}
                      </a>
                    )}
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Lightbulb className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">No insights available</p>
              <p className="text-xs mt-1">Insights will appear here as your data grows</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions and Invoice Status */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Recent Transactions */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Recent Transactions</CardTitle>
                <CardDescription>Latest financial activities</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/transactions")}>
                  View All <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
                <Button size="sm" onClick={() => navigate("/dashboard/transactions?action=create")}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 max-h-[400px] overflow-y-auto">
              {isLoadingActivities ? (
                <div className="text-center py-8 text-muted-foreground">
                  <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900 mx-auto"></div>
                </div>
              ) : recentTransactions.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">No recent transactions</p>
                </div>
              ) : (
                recentTransactions.map((t: any) => {
                  const isInflow = t.type === 'inflow' || (t.amount && Number(t.amount) > 0)
                  const amount = Math.abs(Number(t.amount || 0))
                  return (
                    <div key={t.id} className="flex items-center justify-between py-2 border-b last:border-0">
                      <div className="flex items-center gap-3 flex-1">
                        <div className={`h-8 w-8 rounded-full flex items-center justify-center ${
                          isInflow ? 'bg-green-100' : 'bg-red-100'
                        }`}>
                          {isInflow ? (
                            <ArrowUpRight className="h-4 w-4 text-green-600" />
                          ) : (
                            <ArrowDownRight className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{t.description || 'N/A'}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatTransactionDate(t.date)} · {t.category || 'Uncategorized'}
                          </p>
                        </div>
                      </div>
                      <div className={`text-sm font-medium ${
                        isInflow ? 'text-green-600' : 'text-gray-700'
                      }`}>
                        {isInflow ? '+' : '-'}{formatFullAmount(amount)}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* Invoice Status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Invoice Status</CardTitle>
                <CardDescription>Outstanding & collected</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard/invoices")}>
                View <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-lg bg-orange-50 border border-orange-100">
                <p className="text-sm text-muted-foreground mb-1">Outstanding</p>
                <p className="text-lg font-bold">{formatFullAmount(totalOutstanding)}</p>
              </div>
              <div className="p-4 rounded-lg bg-green-50 border border-green-100">
                <p className="text-sm text-muted-foreground mb-1">Collected</p>
                <p className="text-lg font-bold">{formatFullAmount(totalCollected)}</p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Collection Rate</span>
                <span className="text-sm font-medium">{collectionRate}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2.5">
                <div
                  className="bg-blue-600 h-2.5 rounded-full transition-all"
                  style={{ width: `${collectionRate}%` }}
                />
              </div>
            </div>
            {overdueCount > 0 && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <p className="text-sm text-red-700">
                  {overdueCount} overdue invoice{overdueCount !== 1 ? 's' : ''} ({formatFullAmount(overdueAmount)})
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Income vs Expenses and Expense Breakdown */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Income vs Expenses */}
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[300px] w-full">
              {isLoadingActivities ? (
                <div className="h-full w-full animate-pulse rounded-md bg-gray-100" />
              ) : incomeExpenseChartData.length === 0 ? (
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  <p className="text-sm">No data available</p>
                </div>
              ) : (
                <ChartContainer
                  config={{
                    income: { label: "Income", color: "#1F2937" },
                    expenses: { label: "Expenses", color: "#1F2937" },
                  }}
                  className="h-full w-full"
                >
                  <BarChart data={incomeExpenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis
                      dataKey="month"
                      tick={{ fill: "#6B7280", fontSize: 12 }}
                      tickLine={{ stroke: "#E5E7EB" }}
                    />
                    <YAxis
                      tick={{ fill: "#6B7280", fontSize: 12 }}
                      tickLine={{ stroke: "#E5E7EB" }}
                      tickFormatter={(value) => formatAmount(value)}
                    />
                    <ChartTooltip
                      content={({ active, payload }) => {
                        if (!active || !payload?.length) return null
                        return (
                          <div className="rounded-lg border bg-white p-2 shadow-sm">
                            {payload.map((entry: any, index: number) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                <div className="h-2 w-2 rounded-full bg-gray-900" />
                                <span className="text-gray-600">{entry.name}:</span>
                                <span className="font-medium">{formatFullAmount(entry.value)}</span>
                              </div>
                            ))}
                          </div>
                        )
                      }}
                    />
                    <Bar dataKey="income" fill="#1F2937" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="expenses" fill="#1F2937" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Expense Breakdown */}
        <Card>
          <CardHeader>
            <CardTitle>Expense Breakdown</CardTitle>
            <CardDescription>By category</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Donut Chart */}
              <div className="relative flex items-center justify-center min-h-[260px]">
                {isLoadingActivities ? (
                  <div className="h-[260px] w-[260px] animate-pulse rounded-full bg-gray-100" />
                ) : expenseBreakdown.length === 0 ? (
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground">No expense data</p>
                  </div>
                ) : (
                  <>
                    <PieChart width={260} height={260}>
                      <Pie
                        data={expenseBreakdown}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={110}
                        innerRadius={70}
                        strokeWidth={0}
                      >
                        {expenseBreakdown.map((entry: any, index: number) => (
                          <Cell key={`cell-${index}`} fill={entry.fill} />
                        ))}
                      </Pie>
                    </PieChart>
                  </>
                )}
              </div>

              {/* Legend */}
              <div className="flex flex-col justify-center space-y-3">
                {expenseBreakdown.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No categories</div>
                ) : (
                  expenseBreakdown.map((category: any, index: number) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div
                          className="h-3 w-3 rounded"
                          style={{ backgroundColor: category.fill }}
                        />
                        <span className="text-sm text-gray-700 capitalize">{category.name}</span>
                      </div>
                      <span className="text-sm font-medium text-gray-900">
                        {category.percentage}%
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
