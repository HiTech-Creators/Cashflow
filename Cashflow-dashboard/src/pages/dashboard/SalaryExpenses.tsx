import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
import { useCancelSalaryPayment, useCompanyId, useCreateEmployee, useCreateExpenseAccount, useCreateSalaryPayment, useDeleteEmployee, useDeleteExpenseAccount, useEmployees, useExpenseAccounts, useProcessSalaryPayment, useSalaryPayments } from "@/hooks/useApi"
import type { CreateEmployeeRequest, CreateExpenseAccountRequest, CreateSalaryPaymentRequest, ExpenseAccountType, SalaryFrequency } from "@/lib/api"
import { AlertCircle, Loader2 } from "lucide-react"
import { useCompanyCurrency } from "@/lib/currency"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

function safeNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function formatIsoDate(value: unknown): string {
  if (typeof value !== "string") return ""
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10)
  const d = new Date(value)
  if (!Number.isFinite(d.getTime())) return ""
  return d.toISOString().slice(0, 10)
}

function currency(value: unknown, currencyCode = "USD"): string {
  const n = safeNumber(value, 0)
  const code = typeof currencyCode === "string" && currencyCode.trim() ? currencyCode : "USD"
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: code }).format(n)
  } catch {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n)
  }
}

export default function SalaryExpenses() {
  const companyId = useCompanyId()
  const ALL = "__all__"
  const { data: companyCurrency = "USD" } = useCompanyCurrency(companyId)

  const { data: employeesRes, isLoading: isLoadingEmployees, refetch: refetchEmployees } = useEmployees(companyId, { status: "active", page: 1, per_page: 200 })
  const employeesRaw = useMemo(() => (Array.isArray(employeesRes?.employees) ? employeesRes!.employees : []), [employeesRes])
  const [empQuery, setEmpQuery] = useState("")
  const [empDept, setEmpDept] = useState<string>(ALL)
  const employees = useMemo(() => {
    const q = empQuery.trim().toLowerCase()
    return employeesRaw.filter((e) => {
      if (!e) return false
      if (empDept !== ALL && String(e.department || "").toLowerCase() !== String(empDept).toLowerCase()) return false
      if (!q) return true
      const hay = `${e.full_name || ""} ${e.first_name || ""} ${e.last_name || ""} ${e.email || ""} ${e.department || ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [employeesRaw, empQuery, empDept, ALL])

  const [paymentsFilter, setPaymentsFilter] = useState<{ status?: string; employee_id?: string }>({})
  const { data: paymentsRes, isLoading: isLoadingPayments, refetch: refetchPayments } = useSalaryPayments(companyId, { ...paymentsFilter, page: 1, per_page: 50 })
  const payments = Array.isArray(paymentsRes?.payments) ? paymentsRes!.payments : []

  const [accountsFilter, setAccountsFilter] = useState<{ type?: string }>({})
  const { data: accountsRes, refetch: refetchAccounts } = useExpenseAccounts(companyId, { type: accountsFilter.type, active_only: true })
  const accounts = Array.isArray(accountsRes?.expense_accounts) ? accountsRes!.expense_accounts : []

  const createEmployeeMut = useCreateEmployee()
  const deleteEmployeeMut = useDeleteEmployee()

  const createPaymentMut = useCreateSalaryPayment()
  const processPaymentMut = useProcessSalaryPayment()
  const cancelPaymentMut = useCancelSalaryPayment()

  const createAccountMut = useCreateExpenseAccount()
  const deleteAccountMut = useDeleteExpenseAccount()

  const departments = useMemo(() => {
    const set = new Set<string>()
    employeesRaw.forEach((e) => {
      const d = String(e?.department || "").trim()
      if (d) set.add(d)
    })
    return Array.from(set).sort((a, b) => a.localeCompare(b))
  }, [employeesRaw])

  const employeeOptions = useMemo(() => {
    return employees
      .map((e) => ({
        id: String(e?.id || ""),
        label: String(e?.full_name || `${e?.first_name || ""} ${e?.last_name || ""}`.trim() || e?.email || "Employee"),
      }))
      .filter((x) => x.id)
  }, [employees])

  return (
    <div className="grid gap-6">
      <div className="flex flex-col gap-1">
        <h2 className="text-3xl font-bold tracking-tight">Salary & Expenses</h2>
        <p className="text-muted-foreground">Manage employees, salary payments, and expense accounts</p>
      </div>

      <Tabs defaultValue="employees" className="space-y-4">
        <TabsList className="w-fit">
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="payments">Salary Payments</TabsTrigger>
          <TabsTrigger value="accounts">Expense Accounts</TabsTrigger>
        </TabsList>

        <TabsContent value="employees" className="mt-4">
          <Card>
            <CardHeader className="space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <CardTitle className="text-base">Employees</CardTitle>
                    <Badge variant="secondary" className="h-6">Active: {employeesRaw.length}</Badge>
                  </div>
                  <CardDescription>Create and manage employee records.</CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <CreateEmployeeDialog
                    disabled={!companyId}
                    isSubmitting={createEmployeeMut.isPending}
                    onSubmit={async (payload) => {
                      if (!companyId) return toast.error("Please select a company first")
                      try {
                        await createEmployeeMut.mutateAsync({ companyId, payload })
                        toast.success("Employee created")
                        await refetchEmployees()
                      } catch {
                        toast.error("Failed to create employee")
                      }
                    }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="grid gap-1 md:col-span-2">
                  <Label className="text-xs text-muted-foreground">Search</Label>
                  <Input value={empQuery} onChange={(e) => setEmpQuery(e.target.value)} placeholder="Search name, email, department…" />
                </div>
                <div className="grid gap-1">
                  <Label className="text-xs text-muted-foreground">Department</Label>
                  <Select value={empDept} onValueChange={(v) => setEmpDept(v)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ALL}>All departments</SelectItem>
                      {departments.map((d) => (
                        <SelectItem key={d} value={d}>
                          {d}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-3 flex items-center justify-between">
                  <div className="text-xs text-muted-foreground">Showing {employees.length} of {employeesRaw.length}</div>
                  <Button variant="outline" size="sm" onClick={() => { setEmpQuery(""); setEmpDept(ALL) }} disabled={!empQuery && empDept === ALL}>
                    Clear
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-0">
              <Separator className="mb-4" />
              {isLoadingEmployees ? (
                <div className="text-sm text-muted-foreground">Loading employees…</div>
              ) : employeesRaw.length === 0 ? (
                <div className="text-sm text-muted-foreground flex items-center justify-between">
                  <span>No employees yet.</span>
                  <span className="text-xs">Create one to start tracking salary payments.</span>
                </div>
              ) : employees.length === 0 ? (
                <div className="text-sm text-muted-foreground">No employees match your filters.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4">Name</TableHead>
                      <TableHead className="px-4">Email</TableHead>
                      <TableHead className="px-4">Department</TableHead>
                      <TableHead className="px-4 text-right w-[140px]">Salary</TableHead>
                      <TableHead className="px-4 w-[130px]">Frequency</TableHead>
                      <TableHead className="px-4 text-right w-[140px]">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {employees.map((e, idx) => (
                      <TableRow key={String(e?.id || idx)}>
                        <TableCell className="px-4 font-medium whitespace-normal max-w-[360px]">
                          {String(e?.full_name || `${e?.first_name || ""} ${e?.last_name || ""}`.trim() || "—")}
                        </TableCell>
                        <TableCell className="px-4 text-gray-600 max-w-[260px] truncate">{String(e?.email || "—")}</TableCell>
                        <TableCell className="px-4">{String(e?.department || "—")}</TableCell>
                        <TableCell className="px-4 text-right tabular-nums">{currency(e?.salary_amount, companyCurrency)}</TableCell>
                        <TableCell className="px-4">
                          <Badge variant="outline">{String(e?.salary_frequency || "monthly")}</Badge>
                        </TableCell>
                        <TableCell className="px-4 text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive" disabled={deleteEmployeeMut.isPending}>
                                Deactivate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate this employee?</AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    const id = String(e?.id || "")
                                    if (!companyId || !id) return
                                    deleteEmployeeMut.mutate(
                                      { companyId, employeeId: id },
                                      {
                                        onSuccess: async () => {
                                          toast.success("Employee deactivated")
                                          await refetchEmployees()
                                        },
                                        onError: () => toast.error("Failed to deactivate"),
                                      }
                                    )
                                  }}
                                >
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
            <Select value={paymentsFilter.employee_id || ALL} onValueChange={(v) => setPaymentsFilter((p) => ({ ...p, employee_id: v === ALL ? undefined : v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Employee" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All employees</SelectItem>
                {employeeOptions.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={paymentsFilter.status || ALL} onValueChange={(v) => setPaymentsFilter((p) => ({ ...p, status: v === ALL ? undefined : v }))}>
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>All statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="cancelled">Cancelled</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex justify-end">
              <CreateSalaryPaymentDialog
                disabled={!companyId || employeeOptions.length === 0}
                employees={employeeOptions}
                isSubmitting={createPaymentMut.isPending}
                onSubmit={async (payload) => {
                  if (!companyId) return toast.error("Please select a company first")
                  try {
                    await createPaymentMut.mutateAsync({ companyId, payload })
                    toast.success("Payment created")
                    await refetchPayments()
                  } catch {
                    toast.error("Failed to create payment")
                  }
                }}
              />
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Salary Payments</CardTitle>
              <CardDescription>Track and process salary payments.</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-xs text-muted-foreground mb-3">
                Paid gross total: {currency(paymentsRes?.summary?.total_gross_paid, companyCurrency)} • Paid net total: {currency(paymentsRes?.summary?.total_net_paid, companyCurrency)}
              </div>
              {isLoadingPayments ? (
                <div className="text-sm text-muted-foreground">Loading payments…</div>
              ) : payments.length === 0 ? (
                <div className="text-sm text-muted-foreground">No salary payments found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Employee</TableHead>
                      <TableHead>Payment date</TableHead>
                      <TableHead className="text-right">Gross</TableHead>
                      <TableHead className="text-right">Net</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((p, idx) => {
                      const status = String(p?.status || "")
                      const isPending = status === "pending"
                      return (
                        <TableRow key={String(p?.id || idx)}>
                          <TableCell className="font-medium whitespace-normal">{String(p?.employee?.full_name || "—")}</TableCell>
                          <TableCell className="text-gray-600">{formatIsoDate(p?.payment_date)}</TableCell>
                          <TableCell className="text-right">{currency(p?.gross_amount, companyCurrency)}</TableCell>
                          <TableCell className="text-right">{currency(p?.net_amount, companyCurrency)}</TableCell>
                          <TableCell>
                            <Badge variant={status === "paid" ? "default" : status === "cancelled" ? "secondary" : "outline"}>{status || "unknown"}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {isPending ? (
                              <div className="flex justify-end gap-2">
                                <Button
                                  size="sm"
                                  variant="secondary"
                                  disabled={processPaymentMut.isPending}
                                  onClick={() => {
                                    const id = String(p?.id || "")
                                    if (!companyId || !id) return
                                    processPaymentMut.mutate(
                                      { companyId, paymentId: id },
                                      {
                                        onSuccess: async () => {
                                          toast.success("Payment processed")
                                          await refetchPayments()
                                        },
                                        onError: () => toast.error("Failed to process payment"),
                                      }
                                    )
                                  }}
                                >
                                  {processPaymentMut.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Processing…
                                    </>
                                  ) : (
                                    "Process"
                                  )}
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={cancelPaymentMut.isPending}
                                  onClick={() => {
                                    const id = String(p?.id || "")
                                    if (!companyId || !id) return
                                    cancelPaymentMut.mutate(
                                      { companyId, paymentId: id },
                                      {
                                        onSuccess: async () => {
                                          toast.success("Payment cancelled")
                                          await refetchPayments()
                                        },
                                        onError: () => toast.error("Failed to cancel payment"),
                                      }
                                    )
                                  }}
                                >
                                  {cancelPaymentMut.isPending ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                      Cancelling…
                                    </>
                                  ) : (
                                    "Cancel"
                                  )}
                                </Button>
                              </div>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="accounts" className="mt-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
            <div className="flex gap-3 items-center">
              <Select value={accountsFilter.type || ALL} onValueChange={(v) => setAccountsFilter({ type: v === ALL ? undefined : v })}>
                <SelectTrigger className="w-[220px]">
                  <SelectValue placeholder="Account type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All types</SelectItem>
                  {(["salary", "rent", "utilities", "supplies", "travel", "marketing", "insurance", "other"] as ExpenseAccountType[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div className="text-sm text-muted-foreground">Accounts: {accounts.length}</div>
            </div>
            <CreateExpenseAccountDialog
              disabled={!companyId}
              existingAccounts={accounts.map((a) => ({ id: a.id, label: `${a.account_code} • ${a.account_name}` }))}
              isSubmitting={createAccountMut.isPending}
              onSubmit={async (payload) => {
                if (!companyId) return toast.error("Please select a company first")
                try {
                  await createAccountMut.mutateAsync({ companyId, payload })
                  toast.success("Account created")
                  await refetchAccounts()
                } catch {
                  toast.error("Failed to create account")
                }
              }}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Expense Accounts</CardTitle>
              <CardDescription>Maintain the chart of accounts used for salary/expense tracking.</CardDescription>
            </CardHeader>
            <CardContent>
              {accounts.length === 0 ? (
                <div className="text-sm text-muted-foreground">No expense accounts found.</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Code</TableHead>
                      <TableHead>Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {accounts.map((a, idx) => (
                      <TableRow key={String(a?.id || idx)}>
                        <TableCell className="font-medium">{String(a?.account_code || "—")}</TableCell>
                        <TableCell className="whitespace-normal">{String(a?.account_name || "—")}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{String(a?.account_type || "other")}</Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground whitespace-normal">{String(a?.description || "—")}</TableCell>
                        <TableCell className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="sm" className="text-destructive" disabled={deleteAccountMut.isPending}>
                                Deactivate
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Deactivate this account?</AlertDialogTitle>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => {
                                    const id = String(a?.id || "")
                                    if (!companyId || !id) return
                                    deleteAccountMut.mutate(
                                      { companyId, accountId: id },
                                      {
                                        onSuccess: async () => {
                                          toast.success("Account deactivated")
                                          await refetchAccounts()
                                        },
                                        onError: () => toast.error("Failed to deactivate"),
                                      }
                                    )
                                  }}
                                >
                                  Deactivate
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function CreateEmployeeDialog(props: {
  disabled: boolean
  isSubmitting: boolean
  onSubmit: (payload: CreateEmployeeRequest) => void
}) {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateEmployeeRequest>({
    first_name: "",
    last_name: "",
    email: "",
    employee_id: "",
    position: "",
    department: "",
    salary_amount: 0,
    salary_frequency: "monthly",
    hire_date: "",
  })
  const [errors, setErrors] = useState<Record<string, string>>({})

  const set = <K extends keyof CreateEmployeeRequest>(k: K, v: CreateEmployeeRequest[K]) => {
    setForm((p) => ({ ...p, [k]: v }))
    if (errors[String(k)]) setErrors((p) => ({ ...p, [String(k)]: "" }))
  }

  const frequencies: SalaryFrequency[] = ["hourly", "weekly", "biweekly", "monthly", "annual"]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={props.disabled}>New employee</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create employee</DialogTitle>
          <DialogDescription>Add an employee record used for salary payments.</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>First name</Label>
            <Input value={form.first_name} onChange={(e) => set("first_name", e.target.value)} className={errors.first_name ? "border-red-500" : ""} />
            {errors.first_name ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.first_name}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Last name</Label>
            <Input value={form.last_name} onChange={(e) => set("last_name", e.target.value)} className={errors.last_name ? "border-red-500" : ""} />
            {errors.last_name ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.last_name}</p> : null}
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Email</Label>
            <Input value={form.email} onChange={(e) => set("email", e.target.value)} className={errors.email ? "border-red-500" : ""} />
            {errors.email ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.email}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Employee ID (optional)</Label>
            <Input value={form.employee_id || ""} onChange={(e) => set("employee_id", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Department (optional)</Label>
            <Input value={form.department || ""} onChange={(e) => set("department", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Position (optional)</Label>
            <Input value={form.position || ""} onChange={(e) => set("position", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Hire date (optional)</Label>
            <Input type="date" value={form.hire_date || ""} onChange={(e) => set("hire_date", e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Salary amount</Label>
            <Input
              type="number"
              value={String(form.salary_amount ?? 0)}
              onChange={(e) => set("salary_amount", Number(e.target.value))}
              className={errors.salary_amount ? "border-red-500" : ""}
            />
            {errors.salary_amount ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.salary_amount}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Salary frequency</Label>
            <Select value={String(form.salary_frequency || "monthly")} onValueChange={(v) => set("salary_frequency", v as SalaryFrequency)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {frequencies.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              const next: Record<string, string> = {}
              if (!form.first_name.trim()) next.first_name = "First name is required"
              if (!form.last_name.trim()) next.last_name = "Last name is required"
              if (!form.email.trim()) next.email = "Email is required"
              else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) next.email = "Email is not valid"
              if (!Number.isFinite(Number(form.salary_amount)) || Number(form.salary_amount) <= 0) next.salary_amount = "Salary amount must be positive"
              if (Object.keys(next).length) {
                setErrors(next)
                toast.error("Please fix the highlighted fields")
                return
              }
              props.onSubmit({
                first_name: form.first_name.trim(),
                last_name: form.last_name.trim(),
                email: form.email.trim(),
                employee_id: form.employee_id?.trim() || undefined,
                position: form.position?.trim() || undefined,
                department: form.department?.trim() || undefined,
                salary_amount: Number(form.salary_amount),
                salary_frequency: (form.salary_frequency || "monthly") as SalaryFrequency,
                hire_date: form.hire_date || undefined,
              })
              setOpen(false)
            }}
            disabled={props.isSubmitting}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateSalaryPaymentDialog(props: {
  disabled: boolean
  isSubmitting: boolean
  employees: Array<{ id: string; label: string }>
  onSubmit: (payload: CreateSalaryPaymentRequest) => void
}) {
  const [open, setOpen] = useState(false)

  const [employeeId, setEmployeeId] = useState(props.employees[0]?.id || "")
  const [payStart, setPayStart] = useState("")
  const [payEnd, setPayEnd] = useState("")
  const [paymentDate, setPaymentDate] = useState("")
  const [gross, setGross] = useState("")
  const [tax, setTax] = useState("")
  const [deductions, setDeductions] = useState("")
  const [notes, setNotes] = useState("")
  const [createTxn, setCreateTxn] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={props.disabled}>New payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create salary payment</DialogTitle>
          <DialogDescription>Create a payment record (optionally creates a transaction and marks it paid).</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="grid gap-2 md:col-span-2">
            <Label>Employee</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="Select employee" />
              </SelectTrigger>
              <SelectContent>
                {props.employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Pay period start</Label>
            <Input type="date" value={payStart} onChange={(e) => { setPayStart(e.target.value); if (errors.payStart) setErrors((p) => ({ ...p, payStart: "" })) }} className={errors.payStart ? "border-red-500" : ""} />
            {errors.payStart ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.payStart}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Pay period end</Label>
            <Input type="date" value={payEnd} onChange={(e) => { setPayEnd(e.target.value); if (errors.payEnd) setErrors((p) => ({ ...p, payEnd: "" })) }} className={errors.payEnd ? "border-red-500" : ""} />
            {errors.payEnd ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.payEnd}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Payment date</Label>
            <Input type="date" value={paymentDate} onChange={(e) => { setPaymentDate(e.target.value); if (errors.paymentDate) setErrors((p) => ({ ...p, paymentDate: "" })) }} className={errors.paymentDate ? "border-red-500" : ""} />
            {errors.paymentDate ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.paymentDate}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Gross amount</Label>
            <Input type="number" value={gross} onChange={(e) => { setGross(e.target.value); if (errors.gross) setErrors((p) => ({ ...p, gross: "" })) }} placeholder="3000" className={errors.gross ? "border-red-500" : ""} />
            {errors.gross ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.gross}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Tax amount (optional)</Label>
            <Input type="number" value={tax} onChange={(e) => setTax(e.target.value)} placeholder="600" />
          </div>
          <div className="grid gap-2">
            <Label>Other deductions (optional)</Label>
            <Input type="number" value={deductions} onChange={(e) => setDeductions(e.target.value)} placeholder="150" />
          </div>
        </div>

        <Separator />

        <div className="grid gap-2">
          <Label>Notes (optional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
        </div>

        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={createTxn} onCheckedChange={(v) => setCreateTxn(Boolean(v))} />
          Create linked transaction and mark as paid
        </label>

        <DialogFooter>
          <Button
            onClick={() => {
              const grossAmount = Number(gross)
              const taxAmount = tax.trim() ? Number(tax) : 0
              const otherDeductions = deductions.trim() ? Number(deductions) : 0

              const next: Record<string, string> = {}
              if (!employeeId) next.employeeId = "Employee is required"
              if (!payStart) next.payStart = "Start date is required"
              if (!payEnd) next.payEnd = "End date is required"
              if (payStart && payEnd) {
                const s = new Date(`${payStart}T00:00:00Z`)
                const e = new Date(`${payEnd}T00:00:00Z`)
                if (Number.isFinite(s.getTime()) && Number.isFinite(e.getTime()) && e < s) next.payEnd = "End date must be on/after start date"
              }
              if (!paymentDate) next.paymentDate = "Payment date is required"
              if (!Number.isFinite(grossAmount) || grossAmount <= 0) next.gross = "Gross amount must be positive"
              if (!Number.isFinite(taxAmount) || taxAmount < 0) next.tax = "Tax amount must be >= 0"
              if (!Number.isFinite(otherDeductions) || otherDeductions < 0) next.deductions = "Other deductions must be >= 0"
              if (Object.keys(next).length) {
                setErrors(next)
                toast.error("Please fix the highlighted fields")
                return
              }

              props.onSubmit({
                employee_id: employeeId,
                pay_period_start: payStart,
                pay_period_end: payEnd,
                payment_date: paymentDate,
                gross_amount: grossAmount,
                tax_amount: taxAmount || undefined,
                other_deductions: otherDeductions || undefined,
                notes: notes.trim() || undefined,
                create_transaction: createTxn,
              })
              setOpen(false)
            }}
            disabled={props.isSubmitting}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function CreateExpenseAccountDialog(props: {
  disabled: boolean
  isSubmitting: boolean
  existingAccounts: Array<{ id: string; label: string }>
  onSubmit: (payload: CreateExpenseAccountRequest) => void
}) {
  const NONE = "__none__"
  const [open, setOpen] = useState(false)
  const [code, setCode] = useState("")
  const [name, setName] = useState("")
  const [type, setType] = useState<ExpenseAccountType>("salary")
  const [desc, setDesc] = useState("")
  const [parentId, setParentId] = useState<string>("")
  const [errors, setErrors] = useState<Record<string, string>>({})

  const types: ExpenseAccountType[] = ["salary", "rent", "utilities", "supplies", "travel", "marketing", "insurance", "other"]

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button disabled={props.disabled}>New account</Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Create expense account</DialogTitle>
          <DialogDescription>Create an account used to categorize expenses (including salaries).</DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Account code</Label>
            <Input value={code} onChange={(e) => { setCode(e.target.value); if (errors.code) setErrors((p) => ({ ...p, code: "" })) }} placeholder="5100" className={errors.code ? "border-red-500" : ""} />
            {errors.code ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.code}</p> : null}
          </div>
          <div className="grid gap-2">
            <Label>Account type</Label>
            <Select
              value={type}
              onValueChange={(v) => {
                if ((types as string[]).includes(v)) setType(v as ExpenseAccountType)
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {types.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Account name</Label>
            <Input value={name} onChange={(e) => { setName(e.target.value); if (errors.name) setErrors((p) => ({ ...p, name: "" })) }} placeholder="Salaries Expense" className={errors.name ? "border-red-500" : ""} />
            {errors.name ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.name}</p> : null}
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Description (optional)</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} />
          </div>
          <div className="grid gap-2 md:col-span-2">
            <Label>Parent account (optional)</Label>
            <Select value={parentId || NONE} onValueChange={(v) => setParentId(v === NONE ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="No parent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>No parent</SelectItem>
                {props.existingAccounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            onClick={() => {
              const next: Record<string, string> = {}
              if (!code.trim()) next.code = "Account code is required"
              if (!name.trim()) next.name = "Account name is required"
              if (Object.keys(next).length) {
                setErrors(next)
                toast.error("Please fix the highlighted fields")
                return
              }
              props.onSubmit({
                account_code: code.trim(),
                account_name: name.trim(),
                account_type: type,
                description: desc.trim() || undefined,
                parent_account_id: parentId || null,
              })
              setOpen(false)
              setCode("")
              setName("")
              setDesc("")
              setParentId("")
            }}
            disabled={props.isSubmitting}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating…
              </>
            ) : (
              "Create"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}


