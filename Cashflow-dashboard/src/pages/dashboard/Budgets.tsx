import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ChartContainer, ChartTooltip, ChartTooltipContent, ChartLegend, ChartLegendContent } from "@/components/ui/chart"
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts"
import { Plus, Loader2, TrendingUp, Pencil, Trash2 } from "lucide-react"
import { useBudgets, useBudgetVariances, useDeleteBudget, useCompanyId } from "@/hooks/useApi"
import BudgetFormDialog from "@/components/BudgetFormDialog"
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
import type { Budget } from "@/lib/api"
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency"

// Get current month in YYYY-MM format
function getCurrentPeriod(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}


export default function Budgets() {
  const companyId = useCompanyId()
  const { data: currency = 'USD' } = useCompanyCurrency(companyId)
  const [selectedPeriod, setSelectedPeriod] = useState<string>(getCurrentPeriod())
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [minAmount, setMinAmount] = useState<string>('')
  const [maxAmount, setMaxAmount] = useState<string>('')
  const [varianceFilter, setVarianceFilter] = useState<'all' | 'positive' | 'negative' | 'zero'>('all')
  const [isModalOpen, setIsModalOpen] = useState(false)
  
  // Dialog states
  const [budgetDialogMode, setBudgetDialogMode] = useState<'create' | 'edit'>('create')
  const [selectedBudget, setSelectedBudget] = useState<Budget | undefined>()
  const [deleteBudgetDialogOpen, setDeleteBudgetDialogOpen] = useState(false)
  const [budgetToDelete, setBudgetToDelete] = useState<Budget | null>(null)

  const { data: allBudgets = [], isLoading: loadingBudgets } = useBudgets(companyId)
  const { data: variances = [], isLoading: loadingVariances } = useBudgetVariances(companyId, selectedPeriod)
  const deleteBudgetMut = useDeleteBudget()

  // Budget handlers
  const handleCreateBudget = () => {
    setSelectedBudget(undefined)
    setBudgetDialogMode('create')
    setIsModalOpen(true)
  }

  const handleEditBudget = (budget: Budget) => {
    setSelectedBudget(budget)
    setBudgetDialogMode('edit')
    setIsModalOpen(true)
  }

  const handleDeleteBudget = (budget: Budget) => {
    setBudgetToDelete(budget)
    setDeleteBudgetDialogOpen(true)
  }

  const confirmDeleteBudget = async () => {
    if (!budgetToDelete || !companyId) return
    try {
      await deleteBudgetMut.mutateAsync({
        budgetId: budgetToDelete.id,
        companyId,
      })
      toast.success('Budget deleted successfully')
      setDeleteBudgetDialogOpen(false)
      setBudgetToDelete(null)
    } catch (error: any) {
      toast.error(error?.message || 'Failed to delete budget')
    }
  }

  // Filter budgets based on all filters
  const budgets = useMemo(() => {
    let filtered = [...allBudgets]

    // Filter by period
    if (selectedPeriod) {
      filtered = filtered.filter(b => b.period === selectedPeriod)
    }

    // Filter by category
    if (selectedCategory && selectedCategory !== 'all') {
      filtered = filtered.filter(b => b.category === selectedCategory)
    }

    // Filter by amount range
    if (minAmount) {
      const min = Number(minAmount)
      if (!isNaN(min)) {
        filtered = filtered.filter(b => b.amount >= min)
      }
    }
    if (maxAmount) {
      const max = Number(maxAmount)
      if (!isNaN(max)) {
        filtered = filtered.filter(b => b.amount <= max)
      }
    }

    // Filter by variance
    if (varianceFilter !== 'all') {
      filtered = filtered.filter(budget => {
        const variance = variances.find(v => v.category === budget.category)
        const varianceAmount = variance?.variance ?? 0
        switch (varianceFilter) {
          case 'positive':
            return varianceAmount > 0
          case 'negative':
            return varianceAmount < 0
          case 'zero':
            return varianceAmount === 0
          default:
            return true
        }
      })
    }

    return filtered
  }, [allBudgets, selectedPeriod, selectedCategory, minAmount, maxAmount, varianceFilter, variances])

  // Get unique categories from all budgets
  const availableCategories = useMemo(() => {
    const categories = new Set<string>()
    allBudgets.forEach(b => b.category && categories.add(b.category))
    return Array.from(categories).sort()
  }, [allBudgets])

  // Chart data for Budget vs Actual
  const budgetVsActualData = useMemo(() => {
    if (!budgets || !variances) return []
    
    // Combine budgets and variances
    const varianceMap = new Map(variances.map(v => [v.category, v]))
    
    return budgets.map(budget => {
      const variance = varianceMap.get(budget.category)
      return {
        category: budget.category,
        budget: budget.amount,
        actual: variance?.actual || 0,
      }
    })
  }, [budgets, variances])

  // Chart data for Variance
  const varianceData = useMemo(() => {
    if (!variances) return []
    return variances.map(v => ({
      category: v.category,
      variance: v.variance,
    }))
  }, [variances])

  // Chart config
const budgetConfig = {
  budget: {
    label: "Budget",
    color: "#3b82f6",
  },
  actual: {
    label: "Actual",
    color: "#10b981",
  },
  }

  const varianceConfig = {
  variance: {
    label: "Variance",
    color: "#f59e0b",
  },
}

  // Get unique periods from all budgets
  const availablePeriods = useMemo(() => {
    const periods = new Set<string>()
    allBudgets.forEach(b => b.period && periods.add(b.period))
    return Array.from(periods).sort().reverse()
  }, [allBudgets])

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Budget Planning</h2>
          <p className="text-muted-foreground">Create and monitor budgets with variance analysis</p>
        </div>
        <Button onClick={handleCreateBudget} disabled={!companyId}>
          <Plus className="h-4 w-4 mr-2" />
          New Budget
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Filter budgets by multiple criteria</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-end gap-4">
            {/* Period Filter */}
            <div className="grid gap-2 min-w-[150px]">
              <Label htmlFor="filter-period">Period</Label>
              <Input
                id="filter-period"
                type="month"
                value={selectedPeriod}
                onChange={(e) => setSelectedPeriod(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Category Filter */}
            <div className="grid gap-2 min-w-[180px]">
              <Label htmlFor="filter-category">Category</Label>
              <Select
                value={selectedCategory}
                onValueChange={setSelectedCategory}
              >
                <SelectTrigger id="filter-category" className="w-full">
                  <SelectValue placeholder="All categories" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {availableCategories.map((category) => (
                    <SelectItem key={category} value={category}>
                      {category}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Min Amount Filter */}
            <div className="grid gap-2 min-w-[140px]">
              <Label htmlFor="filter-min-amount">Min Amount</Label>
              <Input
                id="filter-min-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="0.00"
                value={minAmount}
                onChange={(e) => setMinAmount(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Max Amount Filter */}
            <div className="grid gap-2 min-w-[140px]">
              <Label htmlFor="filter-max-amount">Max Amount</Label>
              <Input
                id="filter-max-amount"
                type="number"
                step="0.01"
                min="0"
                placeholder="No limit"
                value={maxAmount}
                onChange={(e) => setMaxAmount(e.target.value)}
                className="w-full"
              />
            </div>

            {/* Variance Filter */}
            <div className="grid gap-2 min-w-[200px]">
              <Label htmlFor="filter-variance">Variance</Label>
              <Select
                value={varianceFilter}
                onValueChange={(value: 'all' | 'positive' | 'negative' | 'zero') => setVarianceFilter(value)}
              >
                <SelectTrigger id="filter-variance" className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Variances</SelectItem>
                  <SelectItem value="positive">Positive (Under Budget)</SelectItem>
                  <SelectItem value="negative">Negative (Over Budget)</SelectItem>
                  <SelectItem value="zero">Zero (On Budget)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Clear Filters Button */}
            {(selectedPeriod !== getCurrentPeriod() || selectedCategory !== 'all' || minAmount || maxAmount || varianceFilter !== 'all') && (
              <div className="grid gap-2">
                <Label className="opacity-0">Clear</Label>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedPeriod(getCurrentPeriod())
                    setSelectedCategory('all')
                    setMinAmount('')
                    setMaxAmount('')
                    setVarianceFilter('all')
                  }}
                >
                  Clear All
                </Button>
              </div>
            )}
          </div>

          {/* Quick Period Buttons */}
          {availablePeriods.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t">
              <span className="text-sm text-muted-foreground self-center">Quick select:</span>
              {availablePeriods.slice(0, 5).map((period) => (
                <Button
                  key={period}
                  variant={selectedPeriod === period ? "default" : "outline"}
                  size="sm"
                  className="h-8 text-xs"
                  onClick={() => setSelectedPeriod(period)}
                >
                  {period}
                </Button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Budget vs Actual</CardTitle>
            <CardDescription>Comparison by category</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {loadingBudgets || loadingVariances ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !budgetVsActualData || budgetVsActualData.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center">No budget data available for this period</p>
            ) : (
            <div className="h-[350px] w-full">
              <ChartContainer config={budgetConfig} className="h-full w-full">
                  <BarChart data={budgetVsActualData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                  <ChartLegend content={<ChartLegendContent />} />
                  <Bar dataKey="budget" fill="var(--color-budget)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
            )}
          </CardContent>
        </Card>

        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle className="text-base">Budget Variance</CardTitle>
            <CardDescription>Over/under spending by category</CardDescription>
          </CardHeader>
          <CardContent className="flex-1 pb-4">
            {loadingVariances ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : !variances || variances.length === 0 ? (
              <p className="text-muted-foreground py-12 text-center">No variance data available for this period</p>
            ) : (
            <div className="h-[350px] w-full">
                <ChartContainer config={varianceConfig} className="h-full w-full">
                  <BarChart data={varianceData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis dataKey="category" angle={-45} textAnchor="end" height={80} />
                    <YAxis tickFormatter={(value) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} />
                    <ChartTooltip
                      content={<ChartTooltipContent />}
                      formatter={(value: number) => formatCurrencyAmount(value, currency)}
                    />
                  <Bar dataKey="variance" fill="var(--color-variance)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Budget Summary Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Budget Summary
          </CardTitle>
          <CardDescription>Detailed breakdown by category for period {selectedPeriod}</CardDescription>
        </CardHeader>
        <CardContent>
          {loadingBudgets || loadingVariances ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : !budgets || budgets.length === 0 ? (
            <p className="text-muted-foreground py-12 text-center">No budgets found for this period</p>
          ) : (
          <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Budget</TableHead>
                    <TableHead className="text-right">Actual</TableHead>
                    <TableHead className="text-right">Remaining</TableHead>
                    <TableHead className="text-right">Variance</TableHead>
                    <TableHead className="text-right">Variance %</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {budgets.map((budget) => {
                    const variance = variances.find(v => v.category === budget.category)
                    const actual = variance?.actual || 0
                    const varianceAmount = variance?.variance || (budget.amount - actual)
                    const variancePercentage = budget.amount > 0 ? (varianceAmount / budget.amount) * 100 : 0
                    const remaining = budget.amount - actual

                    return (
                      <TableRow key={budget.id}>
                        <TableCell className="font-medium">{budget.category}</TableCell>
                        <TableCell className="text-right">{formatCurrencyAmount(budget.amount, currency)}</TableCell>
                        <TableCell className="text-right">{formatCurrencyAmount(actual, currency)}</TableCell>
                        <TableCell className={`text-right font-medium ${remaining >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrencyAmount(remaining, currency)}
                        </TableCell>
                        <TableCell className={`text-right font-medium ${varianceAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrencyAmount(varianceAmount, currency)}
                        </TableCell>
                        <TableCell className={`text-right ${varianceAmount >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {variancePercentage.toFixed(1)}%
                        </TableCell>
                        <TableCell>{budget.period}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEditBudget(budget)}
                              disabled={!companyId}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDeleteBudget(budget)}
                              disabled={!companyId || deleteBudgetMut.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
          </div>
          )}
        </CardContent>
      </Card>

      <BudgetFormDialog
        open={isModalOpen}
        onOpenChange={setIsModalOpen}
        mode={budgetDialogMode}
        initial={selectedBudget}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteBudgetDialogOpen} onOpenChange={setDeleteBudgetDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Budget</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this budget? This action cannot be undone.
              {budgetToDelete && (
                <div className="mt-2 p-2 bg-muted rounded">
                  <p className="font-medium">{budgetToDelete.category}</p>
                  <p className="text-sm">{formatCurrencyAmount(budgetToDelete.amount, currency)}</p>
                  <p className="text-sm text-muted-foreground">Period: {budgetToDelete.period}</p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteBudget}
              disabled={deleteBudgetMut.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteBudgetMut.isPending ? 'Deleting...' : 'Delete'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}