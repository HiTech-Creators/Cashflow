import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Plus,
  MoreVertical,
  Calendar,
  Send
} from "lucide-react"
import toast from "react-hot-toast"
import { useCompanyId, useCreateForecastFromSpeech, useCreateInvoice, useInvoices, useInvoiceSummary, useUpdateInvoice } from "@/hooks/useApi"
import type { Invoice, InvoiceStatus, InvoiceLineItem } from "@/lib/api"
import { SpeechToTextModal } from "@/components/SpeechToTextModal"
import { useCompanyCurrency, formatCurrencyAmount } from "@/lib/currency"
import { invoicesApi } from "@/lib/api"

const STATUS_ALL = "__all__"

// Helper function to format date
function formatDate(dateString?: string): string {
  if (!dateString) return "—"
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })
  } catch {
    return dateString.slice(0, 10)
  }
}

// Helper function to get days ago
function getDaysAgo(dateString?: string): string | null {
  if (!dateString) return null
  try {
    const date = new Date(dateString)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - date.getTime())
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24))
    if (diffDays === 0) return "Today"
    if (diffDays === 1) return "1 day ago"
    return `${diffDays} days ago`
  } catch {
    return null
  }
}

// Status badge component
function StatusBadge({ status }: { status: InvoiceStatus | string }) {
  const statusConfig = {
    draft: { label: "Draft", icon: FileText, className: "text-gray-600" },
    sent: { label: "Sent", icon: Clock, className: "text-blue-600" },
    paid: { label: "Paid", icon: CheckCircle2, className: "text-green-600" },
    overdue: { label: "Overdue", icon: AlertCircle, className: "text-red-600" },
  }
  
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.draft
  const Icon = config.icon
  
  return (
    <div className="flex items-center gap-2">
      <Icon className={`h-4 w-4 ${config.className}`} />
      <span className="capitalize">{config.label}</span>
    </div>
  )
}

export default function Invoices() {
  const companyId = useCompanyId()
  const { data: currency = "USD" } = useCompanyCurrency(companyId)

  const [speechOpen, setSpeechOpen] = useState(false)
  const [createInvoiceOpen, setCreateInvoiceOpen] = useState(false)
  const [status, setStatus] = useState<string>(STATUS_ALL)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const perPage = 20
  
  // Additional filters for invoices
  const [minAmount, setMinAmount] = useState("")
  const [maxAmount, setMaxAmount] = useState("")
  const [dueStartDate, setDueStartDate] = useState("")
  const [dueEndDate, setDueEndDate] = useState("")

  const createFromSpeech = useCreateForecastFromSpeech()
  const createInvoice = useCreateInvoice()
  const updateInvoice = useUpdateInvoice()
  const summaryQuery = useInvoiceSummary(companyId)
  const invoicesQuery = useInvoices(companyId, {
    status: status === STATUS_ALL ? undefined : (status as InvoiceStatus),
    page,
    per_page: perPage,
  })

  const totalPages = Number(invoicesQuery.data?.pages ?? 1)
  const summary = summaryQuery.data

  const filtered = useMemo(() => {
    const invoicesList = invoicesQuery.data?.invoices ?? []
    
    return invoicesList.filter((inv) => {
      // Search filter
      const q = search.trim().toLowerCase()
      if (q) {
        const hay = [
          inv.invoice_number ?? "",
          inv.customer_name ?? "",
          inv.customer_email ?? "",
          inv.status ?? "",
        ]
          .join(" ")
          .toLowerCase()
        if (!hay.includes(q)) return false
      }
      
      // Note: Status filter is already handled by the API call
      
      // Amount filtering
      const amount = Math.abs(Number(inv.total_amount || 0))
      if (minAmount && !isNaN(Number(minAmount)) && amount < Math.abs(Number(minAmount))) return false
      if (maxAmount && !isNaN(Number(maxAmount)) && amount > Math.abs(Number(maxAmount))) return false
      
      // Due date filtering
      if (dueStartDate || dueEndDate) {
        const dueDateStr = inv.due_date
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
  }, [invoicesQuery.data?.invoices, search, minAmount, maxAmount, dueStartDate, dueEndDate])

  // Calculate summary stats
  const draftCount = summary?.by_status?.draft?.count ?? 0
  const draftTotal = summary?.by_status?.draft?.total ?? 0
  const sentCount = summary?.by_status?.sent?.count ?? 0
  const sentTotal = summary?.by_status?.sent?.total ?? 0
  const paidCount = summary?.by_status?.paid?.count ?? 0
  const paidTotal = summary?.by_status?.paid?.total ?? 0
  const overdueCount = summary?.by_status?.overdue?.count ?? 0
  const overdueTotal = summary?.by_status?.overdue?.total ?? 0

  const totalOutstanding = summary?.total_outstanding ?? 0
  const totalCollected = summary?.total_paid ?? 0
  const totalAmount = totalOutstanding + totalCollected
  const collectionRate = totalAmount > 0 ? Math.round((totalCollected / totalAmount) * 100) : 0


  const onExportCsv = async () => {
    const cid = String(companyId ?? "").trim()
    if (!cid) {
      toast.error("Please select a company first")
      return
    }
    const statusFilter = status === STATUS_ALL ? undefined : (status as InvoiceStatus)
    const blob = await invoicesApi.exportInvoicesCsv(cid, statusFilter)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `invoices_${cid}_${statusFilter ?? "all"}_${new Date().toISOString().slice(0, 10)}.csv`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
    toast.success("Invoices exported")
  }

  const onDownloadPdf = async (inv: Invoice) => {
    const cid = String(companyId ?? "").trim()
    if (!cid) {
      toast.error("Please select a company first")
      return
    }
    const iid = String(inv?.id ?? "").trim()
    if (!iid) return
    const blob = await invoicesApi.exportInvoicePdf(cid, iid)
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    const safeNum = (inv.invoice_number || iid.slice(0, 8)).replace(/[^\w.-]+/g, "_")
    a.download = `invoice_${safeNum}.pdf`
    document.body.appendChild(a)
    a.click()
    window.URL.revokeObjectURL(url)
    document.body.removeChild(a)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1">Create, manage, and track your invoices</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={onExportCsv} disabled={!companyId}>
            <Download className="h-4 w-4 mr-2" />
            Export All
          </Button>
          <Button onClick={() => setCreateInvoiceOpen(true)} disabled={!companyId}>
            <Plus className="h-4 w-4 mr-2" />
            + New Invoice
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Draft</p>
                <p className="text-2xl font-bold mt-1">{draftCount}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrencyAmount(draftTotal, currency)}
                </p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Sent</p>
                <p className="text-2xl font-bold mt-1">{sentCount}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrencyAmount(sentTotal, currency)}
                </p>
              </div>
              <Clock className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Paid</p>
                <p className="text-2xl font-bold mt-1 text-green-600">{paidCount}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrencyAmount(paidTotal, currency)}
                </p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Overdue</p>
                <p className="text-2xl font-bold mt-1 text-red-600">{overdueCount}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {formatCurrencyAmount(overdueTotal, currency)}
                </p>
              </div>
              <AlertCircle className="h-8 w-8 text-red-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Collection Rate */}
      <Card>
        <CardContent className="p-6">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Collection Rate</h3>
              <span className="text-sm font-medium">{collectionRate}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full transition-all"
                style={{ width: `${collectionRate}%` }}
              />
            </div>
            <div className="flex items-center justify-end gap-6">
              <div>
                <p className="text-sm text-muted-foreground">Outstanding</p>
                <p className="text-sm font-medium text-orange-600">
                  {formatCurrencyAmount(totalOutstanding, currency)}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Collected</p>
                <p className="text-sm font-medium text-green-600">
                  {formatCurrencyAmount(totalCollected, currency)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* All Invoices */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">All Invoices</CardTitle>
          <CardDescription>Latest invoice activities</CardDescription>
        </CardHeader>
        <CardContent>

            {/* Filters */}
            <div className="mb-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="space-y-1">
                  <Label htmlFor="search" className="text-xs text-muted-foreground">Search</Label>
                  <Input 
                    id="search"
                    placeholder="Invoice, customer, email" 
                    value={search} 
                    onChange={(e) => setSearch(e.target.value)} 
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="status" className="text-xs text-muted-foreground">Status</Label>
                  <Select value={status} onValueChange={(v: string) => { setStatus(v); setPage(1) }}>
                    <SelectTrigger id="status"><SelectValue placeholder="All Status" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={STATUS_ALL}>All Status</SelectItem>
                      <SelectItem value="draft">Draft</SelectItem>
                      <SelectItem value="sent">Sent</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="overdue">Overdue</SelectItem>
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
                  Showing {filtered.length} of {invoicesQuery.data?.total ?? filtered.length} invoices
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => { 
                    setSearch(""); 
                    setStatus(STATUS_ALL); 
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

            <div className="overflow-x-auto">
              {invoicesQuery.isLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">Loading invoices...</div>
                </div>
              ) : filtered.length === 0 ? (
                <div className="flex items-center justify-center py-8">
                  <div className="text-muted-foreground">No invoices found</div>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="text-left text-muted-foreground border-b">
                    <tr>
                      <th className="py-3 font-medium">Invoice</th>
                      <th className="py-3 font-medium">Customer</th>
                      <th className="py-3 font-medium">Issue Date</th>
                      <th className="py-3 font-medium">Due Date</th>
                      <th className="py-3 font-medium">Status</th>
                      <th className="py-3 text-right font-medium">Amount</th>
                      <th className="py-3 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((inv) => {
                      const dueDateAgo = inv.due_date && inv.status === "overdue" 
                        ? getDaysAgo(inv.due_date) 
                        : null
                      
                      return (
                        <tr 
                          key={inv.id} 
                          className="border-b last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors cursor-pointer"
                        >
                          <td className="py-3 font-medium">
                            {inv.invoice_number || inv.id.slice(0, 8)}
                          </td>
                          <td className="py-3">
                            <div>
                              <div className="font-medium">{inv.customer_name || "—"}</div>
                              {inv.customer_email && (
                                <div className="text-sm text-muted-foreground">
                                  {inv.customer_email}
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="py-3 text-gray-600">{formatDate(inv.issue_date)}</td>
                          <td className="py-3">
                            <div>
                              <div className="text-gray-600">{formatDate(inv.due_date)}</div>
                              {dueDateAgo && (
                                <div className="text-sm text-red-600">{dueDateAgo}</div>
                              )}
                            </div>
                          </td>
                          <td className="py-3">
                            <StatusBadge status={inv.status || "draft"} />
                          </td>
                          <td className="py-3 text-right font-medium">
                            {formatCurrencyAmount(Number(inv.total_amount ?? 0), currency)}
                          </td>
                          <td className="py-3 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 w-8 p-0"
                              onClick={() => onDownloadPdf(inv)}
                              title="Download PDF"
                            >
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
              <div className="flex items-center justify-between mt-3">
                <div className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} • Total {invoicesQuery.data?.total ?? filtered.length}
                </div>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page <= 1} 
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    Previous
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    disabled={page >= totalPages} 
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </div>
        </CardContent>
      </Card>

      {/* Create Invoice Modal */}
      <CreateInvoiceModal
        open={createInvoiceOpen}
        onOpenChange={setCreateInvoiceOpen}
        currency={currency}
        onCreate={async (invoiceData, status) => {
          const cid = String(companyId ?? "").trim()
          if (!cid) {
            toast.error("Please select a company first")
            return
          }
          // Create invoice - note: issue_date might be set automatically by backend
          // If backend doesn't accept it in create, we can update it after creation
          const invoice = await createInvoice.mutateAsync({ 
            companyId: cid, 
            customer_name: invoiceData.customer_name,
            customer_email: invoiceData.customer_email,
            due_date: invoiceData.due_date,
            tax_rate: invoiceData.tax_rate,
            line_items: invoiceData.line_items,
          })
          
          // If issue_date was provided and differs from creation date, 
          // we might need to update it (backend might set it automatically)
          // For now, we'll let the backend handle issue_date
          
          // Update invoice with status and notes if needed
          if (status || invoiceData.notes) {
            await updateInvoice.mutateAsync({
              companyId: cid,
              invoiceId: invoice.id,
              ...(status && { status: status as InvoiceStatus }),
              ...(invoiceData.notes && { notes: invoiceData.notes }),
            })
          }
          
          toast.success(status === "draft" ? "Invoice saved as draft" : "Invoice created and sent successfully")
          setCreateInvoiceOpen(false)
        }}
        isLoading={createInvoice.isPending}
      />

      {/* Speech to Text Modal */}
      <SpeechToTextModal
        open={speechOpen}
        onOpenChange={setSpeechOpen}
        title="Create Forecast from Speech"
        description="Speak your financial assumptions (sales, expenses, timing) to generate a cash flow forecast. Edit the transcript before submitting."
        onSend={async ({ transcript, scenarioName }) => {
          const cid = String(companyId ?? "").trim()
          if (!cid) {
            toast.error("Please select a company first")
            return
          }
          await createFromSpeech.mutateAsync({ companyId: cid, transcript, scenarioName })
          toast.success("Forecast created from speech")
        }}
      />

    </div>
  )
}

interface CreateInvoiceModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  currency: string
  onCreate: (data: {
    customer_name: string
    customer_email?: string
    issue_date?: string
    due_date?: string
    tax_rate?: number
    line_items: InvoiceLineItem[]
    notes?: string
  }, status?: "draft" | "sent") => Promise<void>
  isLoading: boolean
}

function CreateInvoiceModal({ open, onOpenChange, currency, onCreate, isLoading }: CreateInvoiceModalProps) {
  const [customerName, setCustomerName] = useState("")
  const [customerEmail, setCustomerEmail] = useState("")
  const [issueDate, setIssueDate] = useState(() => {
    // Default to today's date in YYYY-MM-DD format
    const today = new Date()
    return today.toISOString().split('T')[0]
  })
  const [dueDate, setDueDate] = useState("")
  const [taxRate, setTaxRate] = useState("5")
  const [notes, setNotes] = useState("")
  const [lineItems, setLineItems] = useState<InvoiceLineItem[]>([
    { description: "", quantity: 1, rate: 0, amount: 0 }
  ])

  const resetForm = () => {
    setCustomerName("")
    setCustomerEmail("")
    const today = new Date()
    setIssueDate(today.toISOString().split('T')[0])
    setDueDate("")
    setTaxRate("5")
    setNotes("")
    setLineItems([{ description: "", quantity: 1, rate: 0, amount: 0 }])
  }

  const handleSubmit = async (status: "draft" | "sent" = "sent") => {
    if (!customerName.trim()) {
      toast.error("Customer name is required")
      return
    }

    if (lineItems.length === 0 || lineItems.some(item => !item.description.trim())) {
      toast.error("At least one line item with description is required")
      return
    }

    const validLineItems = lineItems.filter(item => item.description.trim())

    await onCreate({
      customer_name: customerName.trim(),
      customer_email: customerEmail.trim() || undefined,
      issue_date: issueDate || undefined,
      due_date: dueDate || undefined,
      tax_rate: taxRate ? parseFloat(taxRate) : undefined,
      line_items: validLineItems,
      notes: notes.trim() || undefined,
    }, status)

    resetForm()
  }

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, rate: 0, amount: 0 }])
  }

  const updateLineItem = (index: number, field: keyof InvoiceLineItem, value: string | number) => {
    const updated = [...lineItems]
    updated[index] = { ...updated[index], [field]: value }

    // Auto-calculate amount when quantity or rate changes
    if (field === 'quantity' || field === 'rate') {
      const qty = field === 'quantity' ? Number(value) : updated[index].quantity
      const rate = field === 'rate' ? Number(value) : updated[index].rate
      updated[index].amount = qty * rate
    }

    setLineItems(updated)
  }

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.amount || 0), 0)
  }

  const calculateTax = () => {
    const subtotal = calculateSubtotal()
    const rate = taxRate ? parseFloat(taxRate) / 100 : 0
    return subtotal * rate
  }

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] flex flex-col">
        <DialogHeader className="shrink-0">
          <DialogTitle>Create Invoice</DialogTitle>
          <DialogDescription>
            Create a new invoice for your customer.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col flex-1 min-h-0">
          <div className="flex-1 overflow-y-auto min-h-0 pr-1">
            <div className="grid gap-6 pb-4">
              {/* Customer Information */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <Input
                    id="customer-name"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value ?? "")}
                    placeholder="e.g., Acme Corp"
                    required
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="customer-email">Customer Email</Label>
                  <Input
                    id="customer-email"
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value ?? "")}
                    placeholder="billing@acme.com"
                  />
                </div>
              </div>

              {/* Date Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="issue-date">Issue Date</Label>
                  <div className="relative">
                    <Input
                      id="issue-date"
                      type="date"
                      value={issueDate}
                      onChange={(e) => setIssueDate(e.target.value ?? "")}
                      className="pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="due-date">Due Date</Label>
                  <div className="relative">
                    <Input
                      id="due-date"
                      type="date"
                      value={dueDate}
                      onChange={(e) => setDueDate(e.target.value ?? "")}
                      placeholder="mm/dd/yyyy"
                      className="pr-10"
                    />
                    <Calendar className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Line Items */}
              <div className="grid gap-4">
                <Label className="text-base font-medium">Line Items</Label>
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-end">
                      <div className="col-span-6 grid gap-2">
                        <Input
                          value={item.description}
                          onChange={(e) => updateLineItem(index, 'description', e.target.value ?? "")}
                          placeholder="Description"
                        />
                      </div>
                      <div className="col-span-2 grid gap-2">
                        <Input
                          type="number"
                          min="1"
                          step="1"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, 'quantity', parseFloat(e.target.value ?? "0") || 1)}
                          placeholder="1"
                        />
                      </div>
                      <div className="col-span-2 grid gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.rate}
                          onChange={(e) => updateLineItem(index, 'rate', parseFloat(e.target.value ?? "0") || 0)}
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-2 flex items-center justify-end">
                        <span className="text-sm font-medium">
                          {formatCurrencyAmount(item.amount, currency)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addLineItem}
                  className="w-fit"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Line
                </Button>
              </div>

              {/* Summary */}
              <div className="grid gap-2">
                <div className="flex justify-between">
                  <span className="text-sm">Subtotal</span>
                  <span className="text-sm">{formatCurrencyAmount(calculateSubtotal(), currency)}</span>
                </div>
                {taxRate && (
                  <div className="flex justify-between">
                    <span className="text-sm">VAT ({taxRate}%)</span>
                    <span className="text-sm">{formatCurrencyAmount(calculateTax(), currency)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t pt-2">
                  <span>Total</span>
                  <span>{formatCurrencyAmount(calculateTotal(), currency)}</span>
                </div>
              </div>

              {/* Notes */}
              <div className="grid gap-2">
                <Label>Notes</Label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value ?? "")}
                  placeholder="Payment terms, bank details, etc."
                  rows={4}
                  className="resize-y"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="shrink-0 border-t pt-4 mt-4 flex justify-end gap-3">
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => handleSubmit("sent")}
              disabled={isLoading || !customerName.trim()}
            >
              <Send className="h-4 w-4 mr-2" />
              Create & Send
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
