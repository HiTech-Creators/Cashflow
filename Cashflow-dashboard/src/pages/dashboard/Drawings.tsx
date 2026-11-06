import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { useQuery } from "@tanstack/react-query"
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
import { userApi, type CreateDrawingRequest, type DrawingCategory } from "@/lib/api"
import { useCompanyId, useCreateDrawing, useDeleteDrawing, useDrawings, useEquityAccounts, useEquitySummary, useUpdateEquityAccount } from "@/hooks/useApi"
import { useCompanyCurrency } from "@/lib/currency"
import { AlertCircle, Loader2 } from "lucide-react"
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

export default function Drawings() {
  const companyId = useCompanyId()
  const ALL = "__all__"
  const { data: companyCurrency = "USD" } = useCompanyCurrency(companyId)

  const [filters, setFilters] = useState<{
    owner_id?: string
    category?: string
    start_date?: string
    end_date?: string
  }>({})

  const { data: drawingsRes, isLoading: isLoadingDrawings } = useDrawings(companyId, { ...filters, page: 1, per_page: 50 })
  const { data: equityAccounts } = useEquityAccounts(companyId)

  const createMut = useCreateDrawing()
  const deleteMut = useDeleteDrawing()
  const updateEquityMut = useUpdateEquityAccount()

  const { data: companyUsers } = useQuery({
    queryKey: ["company-users", companyId],
    queryFn: () => (companyId ? userApi.getCompanyUsers(companyId) : Promise.resolve([])),
    enabled: Boolean(companyId),
    staleTime: 60_000,
  })

  const owners = useMemo(() => {
    const users = Array.isArray(companyUsers) ? companyUsers : []
    const eqOwners = Array.isArray(equityAccounts?.equity_accounts) ? equityAccounts!.equity_accounts.map((a) => a.owner) : []
    const merged = [...users.map((u) => ({ id: u.id, username: u.username || u.email || "User" })), ...eqOwners]
    const seen = new Set<string>()
    return merged.filter((o) => {
      const id = String(o?.id || "")
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })
  }, [companyUsers, equityAccounts])

  const drawings = Array.isArray(drawingsRes?.drawings) ? drawingsRes!.drawings : []

  const [createOpen, setCreateOpen] = useState(false)
  const [selectedOwnerId, setSelectedOwnerId] = useState<string>("")
  const ownerForSummary = selectedOwnerId || filters.owner_id || owners[0]?.id || ""

  const { data: equitySummary } = useEquitySummary(companyId, ownerForSummary || undefined)

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Drawings</h2>
          <p className="text-muted-foreground">Track owner withdrawals and equity balances</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!companyId}>Record drawing</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>New drawing</DialogTitle>
              <DialogDescription>Record an owner withdrawal (optionally creates a linked transaction).</DialogDescription>
            </DialogHeader>
            <CreateDrawingForm
              owners={owners}
              onSubmit={(payload) => {
                if (!companyId) return toast.error("Please select a company first")
                createMut.mutate(
                  { companyId, payload },
                  {
                    onSuccess: () => {
                      toast.success("Drawing recorded")
                      setCreateOpen(false)
                    },
                    onError: () => toast.error("Failed to record drawing"),
                  }
                )
              }}
              isSubmitting={createMut.isPending}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <Card className="xl:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">Drawings ledger</CardTitle>
            <CardDescription>Filter by owner, category, and date range</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Owner</Label>
              <Select
                value={filters.owner_id || ALL}
                onValueChange={(v) => setFilters((p) => ({ ...p, owner_id: v === ALL ? undefined : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Owner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All owners</SelectItem>
                  {owners.map((o) => (
                    <SelectItem key={o.id} value={o.id}>
                      {o.username}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Category</Label>
              <Select
                value={filters.category || ALL}
                onValueChange={(v) => setFilters((p) => ({ ...p, category: v === ALL ? undefined : v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>All categories</SelectItem>
                  <SelectItem value="personal">Personal</SelectItem>
                  <SelectItem value="equity">Equity</SelectItem>
                  <SelectItem value="loan">Loan</SelectItem>
                </SelectContent>
              </Select>
              </div>

              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">Start date</Label>
              <Input
                type="date"
                value={filters.start_date || ""}
                onChange={(e) => setFilters((p) => ({ ...p, start_date: e.target.value || undefined }))}
              />
              </div>
              <div className="grid gap-1">
                <Label className="text-xs text-muted-foreground">End date</Label>
              <Input
                type="date"
                value={filters.end_date || ""}
                onChange={(e) => setFilters((p) => ({ ...p, end_date: e.target.value || undefined }))}
              />
              </div>
            </div>

            <div className="flex items-center justify-between mt-3">
              <div className="text-xs text-muted-foreground">
                Total drawings (filtered): {currency(drawings.reduce((sum, d) => sum + safeNumber(d?.amount, 0), 0), companyCurrency)}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFilters({})}
                disabled={!filters.owner_id && !filters.category && !filters.start_date && !filters.end_date}
              >
                Clear
              </Button>
            </div>

            <Separator className="my-4" />

            {isLoadingDrawings ? (
              <div className="text-sm text-muted-foreground">Loading drawings…</div>
            ) : drawings.length === 0 ? (
              <div className="text-sm text-muted-foreground">No drawings found.</div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawings.map((d, idx) => (
                    <TableRow key={String(d?.id || idx)}>
                      <TableCell className="text-gray-600">{formatIsoDate(d?.date)}</TableCell>
                      <TableCell className="font-medium">{String(d?.owner?.username || "—")}</TableCell>
                      <TableCell className="whitespace-normal">{String(d?.description || "")}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{String(d?.category || "personal")}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-red-600 font-medium">{currency(d?.amount, companyCurrency)}</TableCell>
                      <TableCell className="text-right">
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm" className="text-destructive" disabled={deleteMut.isPending}>
                              Delete
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete this drawing?</AlertDialogTitle>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => {
                                  const id = String(d?.id || "")
                                  if (!companyId || !id) return
                                  deleteMut.mutate(
                                    { companyId, drawingId: id },
                                    {
                                      onSuccess: () => toast.success("Deleted"),
                                      onError: () => toast.error("Failed to delete"),
                                    }
                                  )
                                }}
                              >
                                Delete
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

        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Equity</CardTitle>
            <CardDescription>Owner equity snapshot and quick updates</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="summary">
              <TabsList>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="accounts">Accounts</TabsTrigger>
              </TabsList>
              <TabsContent value="summary" className="mt-3 space-y-3">
                <div className="grid gap-2">
                  <Label>Owner</Label>
                  <Select value={ownerForSummary} onValueChange={(v) => setSelectedOwnerId(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                    <SelectContent>
                      {owners.map((o) => (
                        <SelectItem key={o.id} value={o.id}>
                          {o.username}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Current balance</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm font-medium">{currency(equitySummary?.equity_account?.current_balance, companyCurrency)}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Opening balance</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm font-medium">{currency(equitySummary?.equity_account?.opening_balance, companyCurrency)}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Total drawings</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm font-medium text-red-600">{currency(equitySummary?.equity_account?.total_drawings, companyCurrency)}</CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Contributions</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm font-medium text-green-700">{currency(equitySummary?.equity_account?.total_contributions, companyCurrency)}</CardContent>
                  </Card>
                </div>

                <EquityUpdateForm
                  onSubmit={(payload) => {
                    if (!companyId || !ownerForSummary) return
                    updateEquityMut.mutate(
                      { companyId, ownerId: ownerForSummary, payload },
                      {
                        onSuccess: () => toast.success("Equity updated"),
                        onError: () => toast.error("Failed to update equity"),
                      }
                    )
                  }}
                  isSubmitting={updateEquityMut.isPending}
                />
              </TabsContent>

              <TabsContent value="accounts" className="mt-3">
                {Array.isArray(equityAccounts?.equity_accounts) && equityAccounts!.equity_accounts.length > 0 ? (
                  <div className="space-y-2">
                    {equityAccounts!.equity_accounts.map((acc) => (
                      <div key={acc.id} className="rounded-md border p-3">
                        <div className="flex items-center justify-between">
                          <div className="font-medium">{acc.owner?.username || "Owner"}</div>
                          <div className="text-sm">{currency(acc.current_balance)}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Drawings {currency(acc.total_drawings)} • Contributions {currency(acc.total_contributions)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground">No equity accounts yet.</div>
                )}
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function CreateDrawingForm(props: {
  owners: Array<{ id: string; username: string }>
  onSubmit: (payload: CreateDrawingRequest) => void
  isSubmitting: boolean
}) {
  const [ownerId, setOwnerId] = useState(props.owners[0]?.id || "")
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState("")
  const [amount, setAmount] = useState("")
  const [category, setCategory] = useState<DrawingCategory>("personal")
  const [createTransaction, setCreateTransaction] = useState(true)
  const [errors, setErrors] = useState<Record<string, string>>({})

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Owner</Label>
          <Select value={ownerId} onValueChange={(v) => setOwnerId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Select owner" />
            </SelectTrigger>
            <SelectContent>
              {props.owners.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.username}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-2">
          <Label>Date</Label>
          <Input
            type="date"
            value={date}
            onChange={(e) => {
              setDate(e.target.value)
              if (errors.date) setErrors((p) => ({ ...p, date: "" }))
            }}
            className={errors.date ? "border-red-500" : ""}
          />
          {errors.date ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.date}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Amount</Label>
          <Input
            type="number"
            value={amount}
            onChange={(e) => {
              setAmount(e.target.value)
              if (errors.amount) setErrors((p) => ({ ...p, amount: "" }))
            }}
            placeholder="5000"
            className={errors.amount ? "border-red-500" : ""}
          />
          {errors.amount ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.amount}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Category</Label>
          <Select value={category} onValueChange={(v) => setCategory(v as DrawingCategory)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              <SelectItem value="equity">Equity</SelectItem>
              <SelectItem value="loan">Loan</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => {
            setDescription(e.target.value)
            if (errors.description) setErrors((p) => ({ ...p, description: "" }))
          }}
          rows={3}
          placeholder="Personal expense withdrawal"
          className={errors.description ? "border-red-500" : ""}
        />
        {errors.description ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.description}</p> : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-sm">
          <Checkbox checked={createTransaction} onCheckedChange={(v) => setCreateTransaction(Boolean(v))} />
          Create linked transaction
        </label>
        <DialogFooter>
          <Button
            onClick={() => {
              const newErrors: Record<string, string> = {}
              const amt = Number(amount)
              if (!ownerId) newErrors.owner = "Owner is required"
              if (!date) newErrors.date = "Date is required"
              else {
                const selected = new Date(`${date}T00:00:00Z`)
                const today = new Date()
                today.setHours(23, 59, 59, 999)
                if (Number.isFinite(selected.getTime()) && selected > today) newErrors.date = "Date cannot be in the future"
              }
              if (!description.trim()) newErrors.description = "Description is required"
              else if (description.trim().length < 3) newErrors.description = "Description must be at least 3 characters"
              if (!Number.isFinite(amt) || amt <= 0) newErrors.amount = "Amount must be positive"
              if (Object.keys(newErrors).length) {
                setErrors(newErrors)
                toast.error("Please fix the highlighted fields")
                return
              }
              props.onSubmit({
                owner_id: ownerId,
                date,
                description: description.trim(),
                amount: amt,
                category,
                create_transaction: createTransaction,
              })
            }}
            disabled={props.isSubmitting}
          >
            {props.isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving…
              </>
            ) : (
              "Save"
            )}
          </Button>
        </DialogFooter>
      </div>
    </div>
  )
}

function EquityUpdateForm(props: {
  onSubmit: (payload: { opening_balance?: number; contribution?: number }) => void
  isSubmitting: boolean
}) {
  const [openingBalance, setOpeningBalance] = useState("")
  const [contribution, setContribution] = useState("")

  return (
    <Card className="mt-2">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Update equity</CardTitle>
        <CardDescription>Set opening balance or record a contribution.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="grid gap-2">
            <Label>Opening balance</Label>
            <Input type="number" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} placeholder="100000" />
          </div>
          <div className="grid gap-2">
            <Label>Contribution</Label>
            <Input type="number" value={contribution} onChange={(e) => setContribution(e.target.value)} placeholder="25000" />
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <Button
            variant="secondary"
            disabled={props.isSubmitting}
            onClick={() => {
              const open = openingBalance.trim() ? Number(openingBalance) : undefined
              const contrib = contribution.trim() ? Number(contribution) : undefined
              if (open == null && contrib == null) return toast.error("Enter opening balance or contribution")
              if (open != null && !Number.isFinite(open)) return toast.error("Opening balance must be a number")
              if (contrib != null && (!Number.isFinite(contrib) || contrib <= 0)) return toast.error("Contribution must be positive")
              props.onSubmit({
                opening_balance: open,
                contribution: contrib,
              })
              setContribution("")
            }}
          >
            Apply
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}


