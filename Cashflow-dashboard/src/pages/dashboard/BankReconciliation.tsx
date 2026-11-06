import { useMemo, useState } from "react"
import toast from "react-hot-toast"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { AlertCircle, Loader2 } from "lucide-react"
import { useAutoMatchReconciliation, useBankStatementDetails, useBankStatements, useCompanyId, useCreateBankStatement, useManualMatchItem, usePotentialMatches, useReconciliationStatus, useUnmatchItem } from "@/hooks/useApi"
import { useCompanyCurrency } from "@/lib/currency"
import type { BankStatementItem, CreateBankStatementRequest } from "@/lib/api"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useQueryClient } from "@tanstack/react-query"

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

function StatusPill({ status }: { status: unknown }) {
  const s = String(status || "").toLowerCase()
  const variant = s === "matched" ? "default" : s === "unmatched" ? "secondary" : "outline"
  const label = s ? s[0].toUpperCase() + s.slice(1) : "Unknown"
  return (
    <Badge variant={variant} className={s === "matched" ? "bg-green-100 text-green-700 hover:bg-green-200" : undefined}>
      {label}
    </Badge>
  )
}

function PotentialMatchesDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string
  statementId?: string
  item?: { id?: string; description?: string; amount?: number; date?: string | null }
  currencyCode?: string
}) {
  const itemId = props.item?.id || ""
  const { data, isLoading } = usePotentialMatches(props.companyId, itemId || undefined, 5)
  const matchMut = useManualMatchItem()

  const matches = Array.isArray(data?.potential_matches) ? data!.potential_matches : []
  const [manualTxnId, setManualTxnId] = useState("")
  const [notes, setNotes] = useState("")
  const [err, setErr] = useState<string>("")

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Match item</DialogTitle>
          <DialogDescription>
            {props.item?.description || "Bank item"} • {currency(props.item?.amount, props.currencyCode)} • {formatIsoDate(props.item?.date)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {isLoading ? (
            <div className="text-sm text-muted-foreground">Loading potential matches…</div>
          ) : matches.length === 0 ? (
            <div className="text-sm text-muted-foreground">No potential matches found.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Score</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {matches.map((m, idx) => (
                  <TableRow key={m?.id || idx}>
                    <TableCell className="text-gray-600">{formatIsoDate(m?.date)}</TableCell>
                    <TableCell className="font-medium whitespace-normal">{String(m?.description || "—")}</TableCell>
                    <TableCell className="text-right">{currency(m?.amount, props.currencyCode)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">{safeNumber(m?.score, 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => {
                          const txnId = String(m?.id || "")
                          if (!txnId) return toast.error("Missing transaction id")
                          if (!itemId) return toast.error("Missing reconciliation item id")
                          setErr("")
                          matchMut.mutate(
                            { companyId: props.companyId, itemId, transaction_id: txnId, notes: notes.trim() || undefined, statementId: props.statementId },
                            {
                              onSuccess: () => {
                                toast.success("Matched")
                                props.onOpenChange(false)
                              },
                              onError: () => toast.error("Failed to match item"),
                            }
                          )
                        }}
                        disabled={matchMut.isPending}
                      >
                        Match
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>

        <Separator />

        <div className="grid gap-3">
          <div className="grid gap-2">
            <Label>Notes (optional)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. matched after reviewing reference" />
          </div>
          <div className="grid gap-2">
            <Label>Manual transaction id (optional)</Label>
            <div className="flex gap-2">
              <Input
                value={manualTxnId}
                onChange={(e) => {
                  setManualTxnId(e.target.value)
                  if (err) setErr("")
                }}
                placeholder="Paste a transaction_id to match"
              />
              <Button
                variant="secondary"
                disabled={matchMut.isPending}
                onClick={() => {
                  const txnId = manualTxnId.trim()
                  if (!itemId) return toast.error("Missing reconciliation item id")
                  if (!txnId) {
                    setErr("Transaction id is required for manual match.")
                    return
                  }
                  matchMut.mutate(
                    { companyId: props.companyId, itemId, transaction_id: txnId, notes: notes.trim() || undefined, statementId: props.statementId },
                    {
                      onSuccess: () => {
                        toast.success("Matched")
                        props.onOpenChange(false)
                      },
                      onError: () => toast.error("Failed to match item"),
                    }
                  )
                }}
              >
                Match by id
              </Button>
            </div>
            {err ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{err}</p> : null}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export default function BankReconciliation() {
  const ALL = "__all__"
  const companyId = useCompanyId()
  const { data: companyCurrency = "USD" } = useCompanyCurrency(companyId)
  const [page, setPage] = useState(1)
  const queryClient = useQueryClient()
  const { data: list, isLoading: isLoadingList, refetch: refetchStatements } = useBankStatements(companyId, page, 20)

  const [selectedStatementId, setSelectedStatementId] = useState<string>("")
  const statementId = selectedStatementId || ""

  const { data: statement, isLoading: isLoadingStatement, refetch: refetchStatement } = useBankStatementDetails(companyId, statementId || undefined)
  const { data: status, refetch: refetchStatus } = useReconciliationStatus(companyId, statementId || undefined)

  const createMut = useCreateBankStatement()
  const autoMatchMut = useAutoMatchReconciliation()
  const unmatchMut = useUnmatchItem()

  const [createOpen, setCreateOpen] = useState(false)
  const [matchOpen, setMatchOpen] = useState(false)
  const [matchItem, setMatchItem] = useState<BankStatementItem | null>(null)

  const summary = status?.summary as Record<string, unknown> | undefined
  const totals = status?.totals as Record<string, unknown> | undefined

  const statements = useMemo(() => (Array.isArray(list?.statements) ? list!.statements : []), [list])
  const items = useMemo(() => (Array.isArray(statement?.items) ? statement!.items : []), [statement])

  // Filters
  const [statementQuery, setStatementQuery] = useState("")
  const [itemQuery, setItemQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState<typeof ALL | "matched" | "unmatched">(ALL)
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")

  const parsedItemsHint = "Format: YYYY-MM-DD, Description, Amount, Reference(optional)\nExample:\n2026-01-05, Customer deposit, 5000, DEP001\n2026-01-10, Vendor payment, -2500, CHK001"

  const selectedTitle = useMemo(() => {
    const s = statements.find((x) => x?.id === statementId)
    if (!s) return ""
    return `${s.bank_name || "Bank"} • ${formatIsoDate(s.statement_date)}`
  }, [statements, statementId])

  const filteredStatements = useMemo(() => {
    const q = statementQuery.trim().toLowerCase()
    if (!q) return statements
    return statements.filter((s) => {
      const hay = `${s.bank_name || ""} ${s.account_number || ""} ${s.statement_date || ""}`.toLowerCase()
      return hay.includes(q)
    })
  }, [statements, statementQuery])

  const filteredItems = useMemo(() => {
    const q = itemQuery.trim().toLowerCase()
    const min = minAmount.trim() ? Number(minAmount) : null
    const max = maxAmount.trim() ? Number(maxAmount) : null
    const start = startDate ? new Date(`${startDate}T00:00:00Z`) : null
    const end = endDate ? new Date(`${endDate}T23:59:59Z`) : null

    return items.filter((it) => {
      if (!it) return false

      const row = it as BankStatementItem
      const matched = Boolean(row.matched_transaction)
      const itStatus = String(row.status || (matched ? "matched" : "unmatched")).toLowerCase()
      if (statusFilter !== ALL && itStatus !== statusFilter) return false

      if (q) {
        const hay = `${row.description || ""} ${row.reference || ""}`.toLowerCase()
        if (!hay.includes(q)) return false
      }

      const amt = Math.abs(Number(row.amount ?? 0))
      if (min != null && Number.isFinite(min) && amt < Math.abs(min)) return false
      if (max != null && Number.isFinite(max) && amt > Math.abs(max)) return false

      if (start || end) {
        const d = new Date(String(row.date || ""))
        if (!Number.isFinite(d.getTime())) return false
        if (start && d < start) return false
        if (end && d > end) return false
      }

      return true
    })
  }, [items, itemQuery, statusFilter, minAmount, maxAmount, startDate, endDate])

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bank Reconciliation</h2>
          <p className="text-muted-foreground">Upload statements, auto-match, and reconcile transactions</p>
        </div>

        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button disabled={!companyId}>New Statement</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create bank statement</DialogTitle>
              <DialogDescription>Add a statement and optional items for reconciliation.</DialogDescription>
            </DialogHeader>

            <CreateStatementForm
              onSubmit={async (payload) => {
                if (!companyId) {
                  toast.error("Please select a company first")
                  return
                }
                try {
                  const res = await createMut.mutateAsync({ companyId, payload })
                  toast.success((res as { message?: string })?.message || "Statement created")
                  const newId = String((res as { statement?: { id?: string } })?.statement?.id || "")
                  await queryClient.invalidateQueries({ queryKey: ["bank-statements", companyId] })
                  await refetchStatements()
                  if (newId) {
                    setSelectedStatementId(newId)
                    await queryClient.invalidateQueries({ queryKey: ["bank-statement", companyId, newId] })
                  }
                  setCreateOpen(false)
                } catch {
                  toast.error("Failed to create statement")
                }
              }}
              isSubmitting={createMut.isPending}
              parsedItemsHint={parsedItemsHint}
              currencyCode={companyCurrency}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Statements</CardTitle>
            <CardDescription>Select a statement to reconcile</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoadingList ? (
              <div className="text-sm text-muted-foreground">Loading statements…</div>
            ) : filteredStatements.length === 0 ? (
              <div className="text-sm text-muted-foreground">No bank statements yet.</div>
            ) : (
              <div className="space-y-2">
                <div className="grid gap-2">
                  <Label className="text-xs text-muted-foreground">Search statements</Label>
                  <Input value={statementQuery} onChange={(e) => setStatementQuery(e.target.value)} placeholder="Search by bank, date, account…" />
                </div>
                {filteredStatements.map((s) => {
                  const active = String(s?.id || "") === statementId
                  return (
                    <button
                      key={String(s?.id || "")}
                      className={`w-full text-left rounded-md border p-3 hover:bg-muted/40 transition ${active ? "border-primary bg-muted/30" : ""}`}
                      onClick={() => setSelectedStatementId(String(s?.id || ""))}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-medium truncate">{String(s?.bank_name || "Bank")}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {formatIsoDate(s?.statement_date)} • {String(s?.account_number || "")}
                          </div>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <div>Open {currency(s?.opening_balance, companyCurrency)}</div>
                          <div>Close {currency(s?.closing_balance, companyCurrency)}</div>
                        </div>
                      </div>
                    </button>
                  )
                })}

                <div className="flex items-center justify-between pt-2">
                  <div className="text-xs text-muted-foreground">
                    Page {Number(list?.page ?? page)} of {Number(list?.pages ?? 1)} • Total {Number(list?.total ?? filteredStatements.length)}
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page >= Number(list?.pages ?? 1)}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle className="text-base">{statementId ? selectedTitle || "Statement" : "Select a statement"}</CardTitle>
            <CardDescription>Reconcile items and track match progress</CardDescription>
          </CardHeader>
          <CardContent>
            {!statementId ? (
              <div className="text-sm text-muted-foreground">Pick a statement from the left to start reconciling.</div>
            ) : isLoadingStatement ? (
              <div className="text-sm text-muted-foreground">Loading statement…</div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
                  <div className="text-sm text-muted-foreground">
                    {formatIsoDate(statement?.statement_date)} • Items {Number(statement?.items_count ?? items.length)}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        if (!companyId || !statementId) return
                        autoMatchMut.mutate(
                          { companyId, statementId, dateTolerance: 2 },
                          {
                            onSuccess: async (res) => {
                              toast.success(res?.message || "Auto-match completed")
                              await Promise.allSettled([refetchStatement(), refetchStatus()])
                            },
                            onError: () => toast.error("Auto-match failed"),
                          }
                        )
                      }}
                      disabled={!companyId || autoMatchMut.isPending}
                    >
                      {autoMatchMut.isPending ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Auto-matching…
                        </>
                      ) : (
                        "Auto-match"
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Match progress</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="flex justify-between">
                        <span>Matched</span>
                        <span className="font-medium">{safeNumber(summary?.matched, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Unmatched</span>
                        <span className="font-medium">{safeNumber(summary?.unmatched, 0)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Rate</span>
                        <span className="font-medium">{safeNumber(summary?.match_rate, 0).toFixed(1)}%</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Bank totals</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="flex justify-between">
                        <span>Inflows</span>
                        <span className="font-medium">{currency(totals?.bank_inflows, companyCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Outflows</span>
                        <span className="font-medium">{currency(totals?.bank_outflows, companyCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Net</span>
                        <span className="font-medium">{currency(totals?.bank_net, companyCurrency)}</span>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Matched amount</CardTitle>
                    </CardHeader>
                    <CardContent className="text-sm">
                      <div className="flex justify-between">
                        <span>Matched</span>
                        <span className="font-medium">{currency(totals?.matched_amount, companyCurrency)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Expected Δ</span>
                        <span className="font-medium">{currency(totals?.expected_balance_change, companyCurrency)}</span>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                <Separator />

                <Tabs defaultValue="items">
                  <TabsList>
                    <TabsTrigger value="items">Items</TabsTrigger>
                    <TabsTrigger value="discrepancies">Discrepancies</TabsTrigger>
                  </TabsList>
                  <TabsContent value="items" className="mt-3">
                    {items.length === 0 ? (
                      <div className="text-sm text-muted-foreground">No reconciliation items on this statement.</div>
                    ) : (
                      <div className="grid gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                          <div className="md:col-span-2 grid gap-1">
                            <Label className="text-xs text-muted-foreground">Search</Label>
                            <Input value={itemQuery} onChange={(e) => setItemQuery(e.target.value)} placeholder="Description / reference…" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Status</Label>
                            <Select
                              value={statusFilter}
                              onValueChange={(v) => {
                                if (v === ALL || v === "matched" || v === "unmatched") {
                                  setStatusFilter(v)
                                }
                              }}
                            >
                              <SelectTrigger><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value={ALL}>All</SelectItem>
                                <SelectItem value="matched">Matched</SelectItem>
                                <SelectItem value="unmatched">Unmatched</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Min amount</Label>
                            <Input type="number" value={minAmount} onChange={(e) => setMinAmount(e.target.value)} placeholder="0" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Max amount</Label>
                            <Input type="number" value={maxAmount} onChange={(e) => setMaxAmount(e.target.value)} placeholder="0" />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">Start date</Label>
                            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                          </div>
                          <div className="grid gap-1">
                            <Label className="text-xs text-muted-foreground">End date</Label>
                            <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                          </div>
                          <div className="md:col-span-5 flex items-center justify-between">
                            <div className="text-xs text-muted-foreground">
                              Showing {filteredItems.length} of {items.length} items
                            </div>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => { setItemQuery(""); setStatusFilter(ALL); setMinAmount(""); setMaxAmount(""); setStartDate(""); setEndDate("") }}
                              disabled={!itemQuery && statusFilter === ALL && !minAmount && !maxAmount && !startDate && !endDate}
                            >
                              Clear filters
                            </Button>
                          </div>
                        </div>

                        <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Date</TableHead>
                            <TableHead>Bank description</TableHead>
                            <TableHead className="text-right">Amount</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Matched transaction</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredItems.map((it, idx) => {
                            const row = it as BankStatementItem
                            const matched = row.matched_transaction
                            const itId = String(row.id || "")
                            const statusVal = String(row.status || (matched ? "matched" : "unmatched"))
                            return (
                              <TableRow key={itId || idx}>
                                <TableCell className="text-gray-600">{formatIsoDate(row.date)}</TableCell>
                                <TableCell className="font-medium whitespace-normal">{String(row.description || "")}</TableCell>
                                <TableCell className="text-right">{currency(row.amount, companyCurrency)}</TableCell>
                                <TableCell>
                                  <StatusPill status={statusVal} />
                                </TableCell>
                                <TableCell className="whitespace-normal">
                                  {matched ? (
                                    <div className="text-xs">
                                      <div className="font-medium">{String(matched?.description || "—")}</div>
                                      <div className="text-muted-foreground">{currency(matched?.amount, companyCurrency)}</div>
                                    </div>
                                  ) : (
                                    <span className="text-xs text-muted-foreground">—</span>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex justify-end gap-2">
                                    {matched ? (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                          if (!companyId || !itId) return
                                          unmatchMut.mutate(
                                            { companyId, itemId: itId, statementId },
                                            {
                                              onSuccess: async () => {
                                                toast.success("Unmatched")
                                                await Promise.allSettled([refetchStatement(), refetchStatus()])
                                              },
                                              onError: () => toast.error("Failed to unmatch"),
                                            }
                                          )
                                        }}
                                        disabled={unmatchMut.isPending}
                                      >
                                        Unmatch
                                      </Button>
                                    ) : (
                                      <Button
                                        size="sm"
                                        onClick={() => {
                                          setMatchItem(it as BankStatementItem)
                                          setMatchOpen(true)
                                        }}
                                        disabled={!itId}
                                      >
                                        Match
                                      </Button>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                        </Table>
                      </div>
                    )}
                  </TabsContent>
                  <TabsContent value="discrepancies" className="mt-3">
                    {Array.isArray(status?.discrepancies) && status!.discrepancies.length > 0 ? (
                      <pre className="text-xs bg-muted/40 rounded-md p-3 overflow-auto">{JSON.stringify(status!.discrepancies, null, 2)}</pre>
                    ) : (
                      <div className="text-sm text-muted-foreground">No discrepancies reported.</div>
                    )}
                  </TabsContent>
                </Tabs>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <PotentialMatchesDialog
        open={matchOpen}
        onOpenChange={(o) => {
          setMatchOpen(o)
          if (!o) setMatchItem(null)
        }}
        companyId={companyId}
        statementId={statementId || undefined}
        item={matchItem || undefined}
        currencyCode={companyCurrency}
      />
    </div>
  )
}

function CreateStatementForm(props: {
  onSubmit: (payload: CreateBankStatementRequest) => Promise<void> | void
  isSubmitting: boolean
  parsedItemsHint: string
  currencyCode: string
}) {
  const [bankName, setBankName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [statementDate, setStatementDate] = useState("")
  const [openingBalance, setOpeningBalance] = useState("")
  const [closingBalance, setClosingBalance] = useState("")
  const [itemsText, setItemsText] = useState("")
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [itemsParseInfo, setItemsParseInfo] = useState<{ count: number; invalid: number }>({ count: 0, invalid: 0 })

  const normalizeIsoDate = (raw: string): string | null => {
    const v = raw.trim()
    if (!v) return ""
    // Accept YYYY-M-D (or YYYY-MM-DD) and normalize to YYYY-MM-DD
    const m = v.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/)
    if (m) {
      const year = m[1]
      const month = m[2].padStart(2, "0")
      const day = m[3].padStart(2, "0")
      const normalized = `${year}-${month}-${day}`
      // Basic sanity check (Date parsing)
      const d = new Date(`${normalized}T00:00:00Z`)
      return Number.isFinite(d.getTime()) ? normalized : null
    }
    // Already ISO with time; keep if parsable
    if (/^\d{4}-\d{2}-\d{2}T/.test(v)) {
      const d = new Date(v)
      return Number.isFinite(d.getTime()) ? v : null
    }
    return null
  }

  const parseItems = (): { items: CreateBankStatementRequest["items"]; invalid: number; count: number } => {
    const lines = itemsText
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)

    const items: NonNullable<CreateBankStatementRequest["items"]> = []
    let invalid = 0
    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim())
      const [date, description, amountRaw, reference] = parts
      if (!description || !amountRaw) {
        invalid += 1
        continue
      }
      const amount = Number(amountRaw)
      if (!Number.isFinite(amount)) {
        invalid += 1
        continue
      }
      const normalizedDate = date ? normalizeIsoDate(date) : ""
      if (date && normalizedDate == null) {
        invalid += 1
        continue
      }
      items.push({
        date: normalizedDate || undefined,
        description,
        amount,
        reference: reference || undefined,
      })
    }
    return { items: items.length ? items : undefined, invalid, count: lines.length }
  }

  return (
    <div className="grid gap-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="grid gap-2">
          <Label>Bank name</Label>
          <Input
            value={bankName}
            onChange={(e) => {
              setBankName(e.target.value)
              if (errors.bank_name) setErrors((p) => ({ ...p, bank_name: "" }))
            }}
            placeholder="First National Bank"
            className={errors.bank_name ? "border-red-500" : ""}
          />
          {errors.bank_name ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.bank_name}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Account number</Label>
          <Input
            value={accountNumber}
            onChange={(e) => {
              setAccountNumber(e.target.value)
              if (errors.account_number) setErrors((p) => ({ ...p, account_number: "" }))
            }}
            placeholder="1234567890"
            inputMode="numeric"
            className={errors.account_number ? "border-red-500" : ""}
          />
          {errors.account_number ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.account_number}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Statement date</Label>
          <Input
            type="date"
            value={statementDate}
            onChange={(e) => {
              setStatementDate(e.target.value)
              if (errors.statement_date) setErrors((p) => ({ ...p, statement_date: "" }))
            }}
            className={errors.statement_date ? "border-red-500" : ""}
          />
          {errors.statement_date ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.statement_date}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Opening balance</Label>
          <Input
            type="number"
            value={openingBalance}
            onChange={(e) => {
              setOpeningBalance(e.target.value)
              if (errors.opening_balance) setErrors((p) => ({ ...p, opening_balance: "" }))
            }}
            placeholder="10000"
            className={errors.opening_balance ? "border-red-500" : ""}
          />
          {errors.opening_balance ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.opening_balance}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Closing balance</Label>
          <Input
            type="number"
            value={closingBalance}
            onChange={(e) => {
              setClosingBalance(e.target.value)
              if (errors.closing_balance) setErrors((p) => ({ ...p, closing_balance: "" }))
            }}
            placeholder="12500"
            className={errors.closing_balance ? "border-red-500" : ""}
          />
          {errors.closing_balance ? <p className="text-sm text-destructive flex items-center gap-1"><AlertCircle className="h-3 w-3" />{errors.closing_balance}</p> : null}
        </div>
        <div className="grid gap-2">
          <Label>Currency</Label>
          <Input value={props.currencyCode} disabled />
          <p className="text-xs text-muted-foreground">Uses the company currency for display.</p>
        </div>
      </div>

      <div className="grid gap-2">
        <Label>Items (optional)</Label>
        <Textarea
          value={itemsText}
          onChange={(e) => {
            setItemsText(e.target.value)
            const res = parseItems()
            setItemsParseInfo({ count: res.count, invalid: res.invalid })
          }}
          rows={6}
          placeholder={props.parsedItemsHint}
        />
        <div className="text-xs text-muted-foreground">Paste rows as comma-separated values. Amount can be negative for outflows.</div>
        {itemsText.trim() ? (
          <div className="text-xs text-muted-foreground">
            Parsed {Math.max(itemsParseInfo.count - itemsParseInfo.invalid, 0)} item(s){itemsParseInfo.invalid ? ` • ${itemsParseInfo.invalid} invalid line(s)` : ""}
          </div>
        ) : null}
      </div>

      <DialogFooter>
        <Button
          onClick={() => {
            const newErrors: Record<string, string> = {}
            if (!bankName.trim()) newErrors.bank_name = "Bank name is required"
            const acc = accountNumber.trim()
            if (!acc) newErrors.account_number = "Account number is required"
            else if (!/^\d{4,}$/.test(acc.replace(/\s+/g, ""))) newErrors.account_number = "Account number should be at least 4 digits"
            if (!statementDate) newErrors.statement_date = "Statement date is required"
            else {
              const d = new Date(`${statementDate}T00:00:00Z`)
              const today = new Date()
              today.setHours(23, 59, 59, 999)
              if (Number.isFinite(d.getTime()) && d > today) newErrors.statement_date = "Statement date cannot be in the future"
            }
            const opening = Number(openingBalance)
            const closing = Number(closingBalance)
            if (!Number.isFinite(opening)) newErrors.opening_balance = "Opening balance must be a number"
            if (!Number.isFinite(closing)) newErrors.closing_balance = "Closing balance must be a number"
            if (Object.keys(newErrors).length) {
              setErrors(newErrors)
              toast.error("Please fix the highlighted fields")
              return
            }

            const parsed = parseItems()
            props.onSubmit({
              bank_name: bankName.trim(),
              account_number: accountNumber.trim(),
              statement_date: statementDate,
              opening_balance: opening,
              closing_balance: closing,
              items: parsed.items,
            })
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
    </div>
  )
}


