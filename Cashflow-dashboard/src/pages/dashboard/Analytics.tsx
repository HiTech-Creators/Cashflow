import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, Line, LineChart, Pie, PieChart, Cell, XAxis, YAxis, CartesianGrid } from "recharts"
import { Button } from "@/components/ui/button"
import { Loader2, Download, TrendingUp, DollarSign, PieChart as PieChartIcon } from "lucide-react"
import { useMonthlyBalances, useMonthlyIncomeExpense, useGenerateCashflowStatement, useCompanyId, useCashActivities } from "@/hooks/useApi"
import toast from "react-hot-toast"
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency"

const monthlyBalanceConfig = {
  balance: {
    label: "Balance",
    color: "#3b82f6",
  },
}

const incomeExpenseConfig = {
  income: {
    label: "Income",
    color: "#10b981",
  },
  expenses: {
    label: "Expenses",
    color: "#ef4444",
  },
}

const categoryConfig = {
  value: {
    label: "Amount",
  },
}

// Color generator for categories
const getCategoryColor = (name: string, index: number): string => {
  const colors = [
    "#ef4444", // red
    "#f59e0b", // orange
    "#eab308", // yellow
    "#84cc16", // lime
    "#22c55e", // green
    "#10b981", // emerald
    "#14b8a6", // teal
    "#06b6d4", // cyan
    "#3b82f6", // blue
    "#6366f1", // indigo
    "#8b5cf6", // purple
    "#a855f7", // violet
    "#d946ef", // fuchsia
    "#ec4899", // pink
    "#f43f5e", // rose
  ]
  // Use hash of name for consistent color, fallback to index
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash)
  }
  return colors[Math.abs(hash) % colors.length] || colors[index % colors.length]
}

export default function Analytics() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)
  const { data: monthlyBalances, isLoading: loadingBalances, error: errorBalances } = useMonthlyBalances(companyId)
  const { data: incomeExpense, isLoading: loadingIncomeExpense, error: errorIncomeExpense } = useMonthlyIncomeExpense(companyId)
  // Removed useCashoutCategories - calculating expenses from transactions on frontend instead
  const generateStatement = useGenerateCashflowStatement()
  // Get all transactions to calculate expenses on frontend
  const { data: allActivities, isLoading: loadingActivities } = useCashActivities(companyId, 1, 10000)

  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false)

  const handleGenerateStatement = async () => {
    if (!companyId) {
      toast.error("Please select a company")
      return
    }

    setIsGeneratingStatement(true)
    try {
      await generateStatement.mutateAsync(companyId)
      toast.success("Cash flow statement downloaded successfully")
    } catch (error: any) {
      toast.error(error?.message || "Failed to generate cash flow statement")
    } finally {
      setIsGeneratingStatement(false)
    }
  }

  // Transform monthly balances data for chart
  const balanceChartData = monthlyBalances?.map((item) => ({
    month: item.month || "",
    balance: item.balance ?? 0,
  })) || []

  // Transform income/expense data for chart
  const incomeExpenseChartData = incomeExpense?.map((item) => ({
    month: item.month || "",
    income: item.income ?? 0,
    expenses: item.expenses ?? 0,
  })) || []

  // Calculate expenses by category from transactions on frontend (since backend categorization is strict)
  const categoryChartData = useMemo(() => {
    const transactions = allActivities?.items || []
    
    // Calculate expenses by category from transactions (only outflow/negative amounts)
    const expensesByCategory = transactions
      .filter((t: any) => {
        // Filter for expenses: outflow type OR negative amount
        return t.type === 'outflow' || (t.amount && Number(t.amount) < 0)
      })
      .reduce((acc: Record<string, number>, t: any) => {
        const category = t.category || 'Other'
        // Use absolute value for expense amounts
        const amount = Math.abs(Number(t.amount || 0))
        if (amount > 0) {
          acc[category] = (acc[category] || 0) + amount
        }
        return acc
      }, {})
    
    // Format for pie chart
    return Object.entries(expensesByCategory)
      .map(([name, value], index) => ({
        name: String(name),
        value: Number(value),
        fill: getCategoryColor(String(name), index),
      }))
      .sort((a, b) => b.value - a.value) // Sort by value descending
  }, [allActivities])

  const isLoading = loadingBalances || loadingIncomeExpense || loadingActivities
  const hasError = errorBalances || errorIncomeExpense

  return (
    <div className="grid gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics</h2>
          <p className="text-muted-foreground">Financial insights and visualizations</p>
        </div>
        <Button
          onClick={handleGenerateStatement}
          disabled={isGeneratingStatement || !companyId}
          variant="outline"
        >
          {isGeneratingStatement ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Generating...
            </>
          ) : (
            <>
              <Download className="mr-2 h-4 w-4" />
              Download Cash Flow Statement
            </>
          )}
        </Button>
      </div>

      {hasError && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">
              {errorBalances?.message || errorIncomeExpense?.message || "Failed to load analytics data"}
            </p>
          </CardContent>
        </Card>
      )}

      {!companyId && (
        <Card>
          <CardContent className="pt-6">
            <p className="text-muted-foreground">Please select a company to view analytics</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Monthly Balance Trends */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              Monthly Balance Trends
            </CardTitle>
            <CardDescription>Cash balance over time</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : balanceChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No balance data available</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ChartContainer config={monthlyBalanceConfig} className="h-full w-full">
                  <LineChart data={balanceChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="balance" 
                      stroke="var(--color-balance)" 
                      strokeWidth={2}
                      dot={{ fill: "var(--color-balance)", r: 4 }}
                    />
                  </LineChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Income vs Expense */}
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Income vs Expenses
            </CardTitle>
            <CardDescription>Monthly comparison</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : incomeExpenseChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No income/expense data available</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ChartContainer config={incomeExpenseConfig} className="h-full w-full">
                  <BarChart data={incomeExpenseChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 12 }}
                      angle={-45}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis 
                      tick={{ fontSize: 12 }}
                      tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    />
                    <ChartTooltip 
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar 
                      dataKey="income" 
                      fill="var(--color-income)" 
                      radius={[4, 4, 0, 0]} 
                    />
                    <Bar 
                      dataKey="expenses" 
                      fill="var(--color-expenses)" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Expense Breakdown by Category */}
        <Card className="flex flex-col lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <PieChartIcon className="h-4 w-4" />
              Expense Breakdown by Category
            </CardTitle>
            <CardDescription>Total spending by category</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : categoryChartData.length === 0 ? (
              <div className="h-[300px] flex items-center justify-center">
                <p className="text-muted-foreground">No expense category data available</p>
              </div>
            ) : (
              <div className="h-[300px] w-full">
                <ChartContainer config={categoryConfig} className="h-full w-full">
                  <PieChart>
                    <ChartTooltip 
                      content={<ChartTooltipContent hideLabel />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                    <Pie
                      data={categoryChartData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value, percent }: any) => 
                        `${name}: ${formatCurrencyAmount(Number(value), currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} (${(Number(percent) * 100).toFixed(1)}%)`
                      }
                    >
                      {categoryChartData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={entry.fill || `hsl(${(index * 137.5) % 360}, 70%, 50%)`} 
                        />
                      ))}
                    </Pie>
                    <ChartLegend 
                      content={<ChartLegendContent />}
                      verticalAlign="bottom"
                      height={36}
                    />
                  </PieChart>
                </ChartContainer>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
