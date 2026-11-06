"use client";

import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Plus,
  TrendingUp,
  Brain,
  Target,
  AlertTriangle,
  Sparkles,
  ChevronRight,
  BarChart3,
  Activity,
  Shield,
  RefreshCcw,
  ArrowUpRight,
  Info,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useForecasts, useAIForecast, useCreateForecast, useCompanyId, useDashboardKpis, useCashOverview, useAIInsights, useMonthlyIncomeExpense, useCashActivities } from "@/hooks/useApi";
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency";
import toast from "react-hot-toast";
import type { CreateForecastRequest } from "@/lib/api";

// Helper functions
function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return 'N/A';
  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'N/A';
    return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch {
    return 'N/A';
  }
}

function RiskGauge({ value, label, description, status }: { value: number; label: string; description: string; status: "good" | "moderate" | "warning" }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="flex items-center gap-1 text-sm font-medium cursor-help">
              {label} <Info className="size-3 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent>
              <p className="max-w-xs text-xs">{description}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <span className={cn(
          "text-sm font-semibold",
          status === "good" && "text-green-600",
          status === "moderate" && "text-yellow-600",
          status === "warning" && "text-red-600"
        )}>
          {value.toFixed(1)}
        </span>
      </div>
      <Progress 
        value={Math.min(value * (status === "good" ? 50 : status === "moderate" ? 35 : 20), 100)} 
        className={cn(
          "h-2",
          status === "good" && "[&>div]:bg-green-600",
          status === "moderate" && "[&>div]:bg-yellow-600",
          status === "warning" && "[&>div]:bg-red-600"
        )}
      />
    </div>
  );
}

function CreateForecastDialog({ onClose }: { onClose: () => void }) {
  const companyId = useCompanyId();
  const [scenarioName, setScenarioName] = useState("");
  const [forecastType, setForecastType] = useState("ai");
  const [forecastPeriod, setForecastPeriod] = useState("6");
  const [assumptions, setAssumptions] = useState("");
  const createForecastMutation = useCreateForecast();

  const handleSubmit = async () => {
    if (!companyId) {
      toast.error("No company selected");
      return;
    }

    if (!scenarioName.trim()) {
      toast.error("Please enter a scenario name");
      return;
    }

    try {
      const payload: CreateForecastRequest = {
        company_id: companyId,
        months: parseInt(forecastPeriod),
        type: forecastType as "manual" | "ai",
        scenario_name: scenarioName,
        scenario_params: {
          ...(assumptions.trim() && { assumptions: assumptions.trim() }),
          growth_rate: 0.05,
          seasonality: false,
        },
      };
      
      await createForecastMutation.mutateAsync(payload);
      toast.success("Forecast created successfully");
      onClose();
      setScenarioName("");
      setAssumptions("");
    } catch (error) {
      toast.error((error as Error)?.message || "Failed to create forecast");
    }
  };

  return (
    <DialogContent className="sm:max-w-[500px]">
      <DialogHeader>
        <DialogTitle>Create New Forecast</DialogTitle>
        <DialogDescription>
          Generate a cashflow forecast based on your historical data.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-4 py-4">
        <div className="grid gap-2">
          <Label htmlFor="name">Scenario Name</Label>
          <Input 
            id="name" 
            placeholder="e.g., Q2 Growth Scenario" 
            value={scenarioName}
            onChange={(e) => setScenarioName(e.target.value)}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div className="grid gap-2">
            <Label htmlFor="type">Forecast Type</Label>
            <Select value={forecastType} onValueChange={setForecastType}>
              <SelectTrigger>
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai">
                  <div className="flex items-center gap-2">
                    <Sparkles className="size-4 text-primary" />
                    AI-Powered
                  </div>
                </SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="months">Forecast Period</Label>
            <Select value={forecastPeriod} onValueChange={setForecastPeriod}>
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="3">3 Months</SelectItem>
                <SelectItem value="6">6 Months</SelectItem>
                <SelectItem value="12">12 Months</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid gap-2">
          <Label htmlFor="assumptions">Assumptions (Optional)</Label>
          <Textarea 
            id="assumptions" 
            placeholder="e.g., Expected 10% revenue growth, stable expenses..."
            value={assumptions}
            onChange={(e) => setAssumptions(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 p-3 rounded-lg bg-primary/5 border border-primary/10">
          <Brain className="size-4 text-primary" />
          <span className="text-sm text-muted-foreground">
            AI will analyze patterns and generate projections
          </span>
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onClose}>Cancel</Button>
        <Button onClick={handleSubmit} disabled={createForecastMutation.isPending}>
          <Sparkles className="size-4 mr-1" /> {createForecastMutation.isPending ? "Generating..." : "Generate Forecast"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

export default function ForecastsPage() {
  const companyId = useCompanyId();
  const { data: currency = 'USD' } = useCompanyCurrency(companyId);
  const [selectedPeriod, setSelectedPeriod] = useState("6m");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewAllOpen, setViewAllOpen] = useState(false);

  const { data: forecasts = [] } = useForecasts(companyId);
  const { data: aiForecast } = useAIForecast(companyId);
  const { data: dashboardKpis } = useDashboardKpis(companyId);
  const { data: cashOverview } = useCashOverview(companyId);
  const { data: insights = [], isLoading: isLoadingInsights } = useAIInsights(companyId);
  const { data: monthlyIncExp = [] } = useMonthlyIncomeExpense(companyId);
  const { data: activitiesPage } = useCashActivities(companyId, 1, 10000);

  // Extract risk metrics from AI forecast or use defaults
  const riskMetrics = useMemo(() => {
    if (aiForecast?.risk_metrics) {
      return {
        runway_months: aiForecast.risk_metrics.runway_months ?? cashOverview?.runway_months ?? 0,
        burn_rate: aiForecast.risk_metrics.burn_rate ?? cashOverview?.burn_rate ?? 0,
        liquidity_ratio: aiForecast.risk_metrics.liquidity_ratio ?? 2.5,
        cash_flow_volatility: aiForecast.risk_metrics.cash_flow_volatility ?? 0.15,
      };
    }
    return {
      runway_months: cashOverview?.runway_months ?? 0,
      burn_rate: cashOverview?.burn_rate ?? 0,
      liquidity_ratio: 2.5,
      cash_flow_volatility: 0.15,
    };
  }, [aiForecast, cashOverview]);

  const { runway_months, burn_rate, liquidity_ratio, cash_flow_volatility } = riskMetrics;

  // Transform forecast data for chart using real AI forecast data
  const forecastData = useMemo(() => {
    const currentBalance = dashboardKpis?.current_balance ?? 0;
    
    // Get AI forecast data if available
    if (aiForecast?.forecasts && typeof aiForecast.forecasts === 'object' && aiForecast.forecasts['90_days']) {
      const dailyForecasts = aiForecast.forecasts['90_days'] || [];
      // Group by month (approximately 30 days per month)
      const monthlyData: Record<string, number[]> = {};
      dailyForecasts.forEach((value: number, dayIndex: number) => {
        const date = new Date();
        date.setDate(date.getDate() + dayIndex + 1);
        const monthKey = date.toISOString().slice(0, 7); // YYYY-MM
        if (!monthlyData[monthKey]) {
          monthlyData[monthKey] = [];
        }
        monthlyData[monthKey].push(Number(value || 0));
      });
      
      // Convert to chart format
      const sortedMonths = Object.keys(monthlyData).sort().slice(0, 6);
      return sortedMonths.map((monthKey, index) => {
        const values = monthlyData[monthKey];
        const avgValue = values.reduce((sum, v) => sum + v, 0) / values.length;
        const monthDate = new Date(monthKey + '-01');
        const monthName = monthDate.toLocaleDateString('en-US', { month: 'short' });
        
        // Calculate optimistic (10% above) and conservative (10% below)
        const forecastValue = avgValue * 30; // Convert daily to monthly
        const optimisticValue = forecastValue * 1.1;
        const conservativeValue = forecastValue * 0.9;
        
        return {
          month: monthName,
          actual: index === 0 ? currentBalance : null,
          forecast: forecastValue,
          optimistic: optimisticValue,
          conservative: conservativeValue,
        };
      });
    }
    
    // Fallback: use current balance and project forward
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
    return months.map((month, index) => {
      const isPast = index === 0;
      const forecastValue = currentBalance * Math.pow(1.05, index);
      const optimisticValue = currentBalance * Math.pow(1.08, index);
      const conservativeValue = currentBalance * Math.pow(1.02, index);
      
      return {
        month,
        actual: isPast ? currentBalance : null,
        forecast: forecastValue,
        optimistic: optimisticValue,
        conservative: conservativeValue,
      };
    });
  }, [dashboardKpis?.current_balance, aiForecast]);

  // Monthly projection data from real API data
  const monthlyProjection = useMemo(() => {
    if (monthlyIncExp.length > 0) {
      // Use last 5 months of data and project forward
      const last5Months = monthlyIncExp.slice(-5);
      return last5Months.map((item) => {
        // Format month name properly
        let monthName = item.month;
        if (monthName.length > 3) {
          // If it's a full month name or date string, extract short name
          try {
            const date = new Date(monthName);
            if (!isNaN(date.getTime())) {
              monthName = date.toLocaleDateString('en-US', { month: 'short' });
            } else {
              // Try to extract month from string like "2024-01" or "January 2024"
              if (monthName.includes('-')) {
                const [year, month] = monthName.split('-');
                const date = new Date(parseInt(year), parseInt(month) - 1, 1);
                monthName = date.toLocaleDateString('en-US', { month: 'short' });
              } else {
                monthName = monthName.slice(0, 3);
              }
            }
          } catch {
            monthName = monthName.slice(0, 3);
          }
        }
        
        return {
          month: monthName,
          revenue: item.income || 0,
          expenses: item.expenses || 0,
          net: (item.income || 0) - (item.expenses || 0),
        };
      });
    }
    
    // Fallback: calculate from transactions
    const transactions = activitiesPage?.items || [];
    const monthly: Record<string, { revenue: number; expenses: number }> = {};
    transactions.forEach((t: {
      date?: string;
      type?: string;
      amount?: number;
    }) => {
      if (!t.date) return;
      try {
        const date = new Date(t.date);
        if (isNaN(date.getTime())) return;
        const monthKey = date.toISOString().slice(0, 7);
        if (!monthly[monthKey]) {
          monthly[monthKey] = { revenue: 0, expenses: 0 };
        }
        const amount = Number(t.amount || 0);
        if (t.type === 'inflow') {
          monthly[monthKey].revenue += amount;
        } else if (t.type === 'outflow') {
          monthly[monthKey].expenses += Math.abs(amount);
        }
      } catch {
        // Skip invalid dates
      }
    });
    
    const sorted = Object.entries(monthly)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .slice(-5)
      .map(([monthKey, data]) => {
        const date = new Date(monthKey + '-01');
        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          revenue: data.revenue,
          expenses: data.expenses,
          net: data.revenue - data.expenses,
        };
      });
    
    // If no data, generate next 5 months from current date
    if (sorted.length === 0) {
      const now = new Date();
      return Array.from({ length: 5 }, (_, i) => {
        const date = new Date(now.getFullYear(), now.getMonth() + i + 1, 1);
        return {
          month: date.toLocaleDateString('en-US', { month: 'short' }),
          revenue: 0,
          expenses: 0,
          net: 0,
        };
      });
    }
    
    return sorted;
  }, [monthlyIncExp, activitiesPage]);

  // Transform forecasts for display using real API data
  type ForecastItem = {
    id: string;
    scenario_name?: string;
    type?: string;
    projections?: Record<string, number>;
    created_at?: string;
  };

  // Transform forecasts for display using real API data (dynamic - updates when forecasts change)
  const allSavedForecasts = useMemo(() => {
    if (!forecasts || forecasts.length === 0) {
      return [];
    }
    
    return forecasts.map((forecast: ForecastItem) => {
      const projections = forecast.projections || {};
      const projectionKeys = Object.keys(projections);
      
      // Calculate total net cash flow from all projections
      let totalNetCashFlow = 0;
      if (projectionKeys.length > 0) {
        // Use the last projection value or average if multiple
        const values = projectionKeys.map(key => Number(projections[key] || 0));
        const lastProjection = Number(projections[projectionKeys[projectionKeys.length - 1]] || 0);
        totalNetCashFlow = lastProjection !== 0 ? lastProjection : (values.reduce((sum, val) => sum + val, 0) / values.length);
      }
      
      return {
        id: forecast.id,
        scenario_name: forecast.scenario_name || 'Unnamed Forecast',
        type: forecast.type || 'manual',
        months: projectionKeys.length || 6,
        created_at: forecast.created_at || new Date().toISOString(),
        projections: {
          net_cash_flow: totalNetCashFlow,
        },
      };
    });
  }, [forecasts]);

  // Show only first 3 in the card
  const savedForecasts = useMemo(() => allSavedForecasts.slice(0, 3), [allSavedForecasts]);

  // Transform AI insights from useAIInsights hook (same as Assistant page)
  const aiInsights = useMemo(() => {
    if (!insights || !Array.isArray(insights) || insights.length === 0) {
      return [];
    }
    
    return insights.slice(0, 3).map((insight: {
      id?: string;
      type?: string;
      title?: string;
      description?: string;
      recommendation?: string;
      severity?: string;
    }) => {
      // Map insight types to display types
      let displayType: 'opportunity' | 'warning' | 'info' = 'info';
      if (insight.type === 'opportunity' || insight.severity === 'low') {
        displayType = 'opportunity';
      } else if (insight.type === 'risk' || insight.severity === 'high') {
        displayType = 'warning';
      }
      
      return {
        type: displayType,
        title: insight.title || 'Insight',
        recommendation: insight.recommendation || insight.description || '',
      };
    });
  }, [insights]);

  const formatCurrencyValue = (value: number) => formatCurrencyAmount(value, currency, { minimumFractionDigits: 0, maximumFractionDigits: 0 });

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Forecasts & Analytics</h1>
          <p className="text-muted-foreground">
            AI-powered cashflow predictions and financial insights
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={selectedPeriod} onValueChange={setSelectedPeriod}>
            <SelectTrigger className="w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="3m">3 Months</SelectItem>
              <SelectItem value="6m">6 Months</SelectItem>
              <SelectItem value="12m">12 Months</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" className="gap-1">
            <RefreshCcw className="size-4" /> Refresh
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1">
                <Plus className="size-4" /> New Forecast
              </Button>
            </DialogTrigger>
            <CreateForecastDialog onClose={() => setDialogOpen(false)} />
          </Dialog>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Projected Balance</p>
                <p className="text-2xl font-bold text-green-600">
                  {formatCurrencyValue(forecastData[forecastData.length - 1]?.forecast ?? 0)}
                </p>
                {forecastData.length > 1 && forecastData[0]?.actual && (
                  <p className="text-xs text-green-600 flex items-center gap-1">
                    <TrendingUp className="size-3" /> 
                    {((forecastData[forecastData.length - 1]?.forecast ?? 0) / (forecastData[0]?.actual ?? 1) - 1) * 100 > 0 ? '+' : ''}
                    {(((forecastData[forecastData.length - 1]?.forecast ?? 0) / (forecastData[0]?.actual ?? 1) - 1) * 100).toFixed(1)}% in {forecastData.length - 1} months
                  </p>
                )}
              </div>
              <div className="p-2.5 rounded-xl bg-green-100">
                <TrendingUp className="size-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Cash Runway</p>
                <p className="text-2xl font-bold">
                  {runway_months !== null && !isNaN(runway_months) ? runway_months.toFixed(1) : '∞'} months
                </p>
                <p className="text-xs text-muted-foreground">At current burn rate</p>
              </div>
              <div className="p-2.5 rounded-xl bg-primary/10">
                <Target className="size-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Burn Rate</p>
                <p className="text-2xl font-bold">{formatCurrencyValue(burn_rate)}/mo</p>
                <p className="text-xs text-muted-foreground">Net monthly outflow</p>
              </div>
              <div className="p-2.5 rounded-xl bg-yellow-100">
                <Activity className="size-5 text-yellow-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Liquidity Ratio</p>
                <p className="text-2xl font-bold text-green-600">{liquidity_ratio.toFixed(1)}x</p>
                <p className="text-xs text-green-600">Healthy position</p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-100">
                <Shield className="size-5 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Cash Balance Forecast</CardTitle>
              <CardDescription>Projected vs actual with confidence bands</CardDescription>
            </div>
            <div className="flex gap-2">
              <Badge variant="outline" className="gap-1">
                <span className="size-2 rounded-full bg-primary" /> Forecast
              </Badge>
              <Badge variant="outline" className="gap-1 text-green-600 border-green-600/30">
                <span className="size-2 rounded-full bg-green-600" /> Optimistic
              </Badge>
              <Badge variant="outline" className="gap-1 text-yellow-600 border-yellow-600/30">
                <span className="size-2 rounded-full bg-yellow-600" /> Conservative
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <ChartContainer
              config={{
                actual: { label: "Actual", color: "hsl(var(--foreground))" },
                forecast: { label: "Forecast", color: "hsl(var(--chart-1))" },
                optimistic: { label: "Optimistic", color: "hsl(var(--chart-2))" },
                conservative: { label: "Conservative", color: "hsl(var(--chart-4))" },
              }}
              className="h-[300px] w-full"
            >
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={forecastData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fontSize: 12 }} />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12 }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value: number) => formatCurrencyValue(value)} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="optimistic"
                    stroke="hsl(var(--chart-2))"
                    fill="hsl(var(--chart-2))"
                    fillOpacity={0.1}
                    strokeDasharray="4 4"
                  />
                  <Area
                    type="monotone"
                    dataKey="conservative"
                    stroke="hsl(var(--chart-4))"
                    fill="hsl(var(--chart-4))"
                    fillOpacity={0.1}
                    strokeDasharray="4 4"
                  />
                  <Line
                    type="monotone"
                    dataKey="forecast"
                    stroke="hsl(var(--chart-1))"
                    strokeWidth={3}
                    dot={{ fill: "hsl(var(--chart-1))", strokeWidth: 2, r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="actual"
                    stroke="hsl(var(--foreground))"
                    strokeWidth={2}
                    dot={{ fill: "hsl(var(--foreground))", strokeWidth: 2, r: 4 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </ChartContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Shield className="size-4 text-primary" />
              Risk Assessment
            </CardTitle>
            <CardDescription>Financial health indicators</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <RiskGauge
              value={liquidity_ratio}
              label="Liquidity Ratio"
              description="Ability to meet short-term obligations. Above 2.0 is healthy."
              status="good"
            />
            <RiskGauge
              value={runway_months !== null && !isNaN(runway_months) ? runway_months : 0}
              label="Runway (Months)"
              description="Time until cash depletion at current burn rate."
              status={runway_months !== null && runway_months > 6 ? "good" : runway_months !== null && runway_months > 3 ? "moderate" : "warning"}
            />
            <RiskGauge
              value={cash_flow_volatility * 100}
              label="Volatility Score"
              description="Cash flow variability. Lower is more stable."
              status="good"
            />
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Overall Health</span>
                <Badge className="bg-green-100 text-green-700">Excellent</Badge>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Monthly Projections</CardTitle>
          <CardDescription>Expected revenue, expenses, and net cashflow</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer
            config={{
              revenue: { label: "Revenue", color: "hsl(var(--chart-2))" },
              expenses: { label: "Expenses", color: "hsl(var(--chart-5))" },
              net: { label: "Net", color: "hsl(var(--chart-1))" },
            }}
            className="h-[250px] w-full"
          >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyProjection} margin={{ top: 10, right: 10, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
                  <XAxis 
                    dataKey="month" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    interval={0}
                    angle={0}
                    textAnchor="middle"
                    height={30}
                  />
                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }}
                    tickFormatter={(value) => `${(value / 1000).toFixed(0)}K`}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent formatter={(value: number) => formatCurrencyValue(value)} />}
                  />
                  <Bar dataKey="revenue" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="expenses" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Saved Forecasts</CardTitle>
              <CardDescription>Your forecast scenarios</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setViewAllOpen(true)}>
              View All <ChevronRight className="size-4 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {savedForecasts && savedForecasts.length > 0 ? (
                savedForecasts.map((forecast: {
                  id: string;
                  scenario_name: string;
                  type: string;
                  months: number;
                  created_at: string;
                  projections: { net_cash_flow: number };
                }) => (
                  <div
                    key={forecast.id}
                    className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        forecast.type === "ai" ? "bg-primary/10" : "bg-muted"
                      )}>
                        {forecast.type === "ai" ? (
                          <Sparkles className="size-4 text-primary" />
                        ) : (
                          <BarChart3 className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{forecast.scenario_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {forecast.months} months · {formatDate(forecast.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">
                        {formatCurrencyValue(forecast.projections.net_cash_flow)}
                      </p>
                      <p className="text-xs text-muted-foreground">Net cashflow</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No forecasts available</p>
                  <p className="text-sm">Create your first forecast to get started</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-transparent">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-lg bg-primary/10">
                <Brain className="size-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">AI Recommendations</CardTitle>
                <CardDescription>Actionable insights for your business</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoadingInsights ? (
              <div className="flex items-center justify-center py-8">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-gray-300 border-t-gray-900"></div>
              </div>
            ) : aiInsights.length > 0 ? (
              <div className="space-y-3">
                {aiInsights.map((insight: {
                  type: 'opportunity' | 'warning' | 'info';
                  title: string;
                  recommendation: string;
                }, i: number) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "p-3 rounded-lg border cursor-pointer hover:border-primary/30 transition-colors",
                    insight.type === "opportunity" && "bg-green-50 border-green-200",
                    insight.type === "warning" && "bg-yellow-50 border-yellow-200",
                    insight.type === "info" && "bg-primary/5 border-primary/20"
                  )}
                >
                  <div className="flex items-start gap-2">
                    <div className={cn(
                      "p-1 rounded",
                      insight.type === "opportunity" && "bg-green-100 text-green-600",
                      insight.type === "warning" && "bg-yellow-100 text-yellow-600",
                      insight.type === "info" && "bg-primary/10 text-primary"
                    )}>
                      {insight.type === "opportunity" ? (
                        <ArrowUpRight className="size-3" />
                      ) : insight.type === "warning" ? (
                        <AlertTriangle className="size-3" />
                      ) : (
                        <Info className="size-3" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{insight.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {insight.recommendation}
                      </p>
                    </div>
                  </div>
                </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Brain className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No insights available</p>
                <p className="text-xs mt-1">Insights will appear here as your data grows</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View All Forecasts Dialog */}
      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>All Saved Forecasts</DialogTitle>
            <DialogDescription>
              View and manage all your forecast scenarios
            </DialogDescription>
          </DialogHeader>
          <div className="mt-4 max-h-[60vh] overflow-y-auto">
            {allSavedForecasts.length > 0 ? (
              <div className="space-y-3">
                {allSavedForecasts.map((forecast: {
                  id: string;
                  scenario_name: string;
                  type: string;
                  months: number;
                  created_at: string;
                  projections: { net_cash_flow: number };
                }) => (
                  <div
                    key={forecast.id}
                    className="flex items-center justify-between p-4 rounded-lg border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "p-2 rounded-lg",
                        forecast.type === "ai" ? "bg-primary/10" : "bg-muted"
                      )}>
                        {forecast.type === "ai" ? (
                          <Sparkles className="size-4 text-primary" />
                        ) : (
                          <BarChart3 className="size-4 text-muted-foreground" />
                        )}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{forecast.scenario_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {forecast.months} months · {formatDate(forecast.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-green-600">
                        {formatCurrencyValue(forecast.projections.net_cash_flow)}
                      </p>
                      <p className="text-xs text-muted-foreground">Net cashflow</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No forecasts available</p>
                <p className="text-sm">Create your first forecast to get started</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewAllOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
