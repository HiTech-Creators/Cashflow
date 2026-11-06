import { useState, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Bug, Plus, Edit, Trash2, MessageSquare, X, Upload, FileText } from "lucide-react"
import toast from "react-hot-toast"
import { useCompanyId } from "@/hooks/useApi"
import {
  useBugReports,
  useBugReport,
  useSubmitBugReport,
  useUpdateBugReport,
  useDeleteBugReport,
  useAddBugReportComment,
  useBugReportComments,
  type BugReport,
} from "@/hooks/useApi"

const STATUS_ALL = "__all__"
const SEVERITY_ALL = "__all__"
const CATEGORY_ALL = "__all__"

export default function BugReports() {
  const companyId = useCompanyId()
  const [createOpen, setCreateOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [viewOpen, setViewOpen] = useState(false)
  const [deleteOpen, setDeleteOpen] = useState(false)
  const [selectedBugId, setSelectedBugId] = useState<string>("")
  const [statusFilter, setStatusFilter] = useState<string>(STATUS_ALL)
  const [severityFilter, setSeverityFilter] = useState<string>(SEVERITY_ALL)
  const [categoryFilter, setCategoryFilter] = useState<string>(CATEGORY_ALL)
  const [search, setSearch] = useState("")
  const [page, setPage] = useState(1)
  const perPage = 20

  const bugReportsQuery = useBugReports({
    status: statusFilter === STATUS_ALL ? undefined : statusFilter,
    severity: severityFilter === SEVERITY_ALL ? undefined : severityFilter,
    category: categoryFilter === CATEGORY_ALL ? undefined : categoryFilter,
    search: search.trim() || undefined,
    page,
    per_page: perPage,
  })

  const bugReports = bugReportsQuery.data?.bug_reports ?? []
  const totalPages = Number(bugReportsQuery.data?.pages ?? 1)

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return bugReports
    return bugReports.filter((bug) => {
      const hay = [
        bug.title ?? "",
        bug.description ?? "",
        bug.category ?? "",
        bug.severity ?? "",
        bug.status ?? "",
      ]
        .join(" ")
        .toLowerCase()
      return hay.includes(q)
    })
  }, [bugReports, search])

  const openView = (bugId: string) => {
    const bid = String(bugId ?? "").trim()
    if (!bid) return
    setSelectedBugId(bid)
    setViewOpen(true)
  }

  const openEdit = (bugId: string) => {
    const bid = String(bugId ?? "").trim()
    if (!bid) return
    setSelectedBugId(bid)
    setEditOpen(true)
  }

  const openDelete = (bugId: string) => {
    const bid = String(bugId ?? "").trim()
    if (!bid) return
    setSelectedBugId(bid)
    setDeleteOpen(true)
  }

  return (
    <div className="grid gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Bug Reports</h2>
          <p className="text-muted-foreground">Report and track bugs, issues, and feature requests</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Report Bug
        </Button>
      </div>

      <CreateBugReportModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        companyId={companyId}
      />

      <EditBugReportModal
        open={editOpen}
        onOpenChange={setEditOpen}
        bugId={selectedBugId}
      />

      <ViewBugReportModal
        open={viewOpen}
        onOpenChange={setViewOpen}
        bugId={selectedBugId}
      />

      <DeleteBugReportModal
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        bugId={selectedBugId}
      />

      <Card>
        <CardHeader className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bug className="h-5 w-5" />
                Bug Reports
              </CardTitle>
              <CardDescription>
                Filter by status, severity, or category. Search by title or description.
                <span className="ml-2 text-muted-foreground">
                  Total: {Number(bugReportsQuery.data?.total ?? 0)}
                </span>
              </CardDescription>
            </div>
            <Button
              variant="outline"
              onClick={() => bugReportsQuery.refetch()}
              disabled={bugReportsQuery.isFetching}
            >
              {bugReportsQuery.isFetching ? "Refreshing..." : "Refresh"}
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="md:col-span-2">
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value ?? "")
                  setPage(1)
                }}
                placeholder="Search bug reports…"
              />
            </div>
            <div>
              <Select
                value={statusFilter}
                onValueChange={(v) => {
                  setStatusFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={STATUS_ALL}>All statuses</SelectItem>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                  <SelectItem value="wont_fix">Won't Fix</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Select
                value={severityFilter}
                onValueChange={(v) => {
                  setSeverityFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Severity" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={SEVERITY_ALL}>All severities</SelectItem>
                  <SelectItem value="low">Low</SelectItem>
                  <SelectItem value="medium">Medium</SelectItem>
                  <SelectItem value="high">High</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Select
                value={categoryFilter}
                onValueChange={(v) => {
                  setCategoryFilter(v)
                  setPage(1)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={CATEGORY_ALL}>All categories</SelectItem>
                  <SelectItem value="ui">UI</SelectItem>
                  <SelectItem value="api">API</SelectItem>
                  <SelectItem value="performance">Performance</SelectItem>
                  <SelectItem value="data">Data</SelectItem>
                  <SelectItem value="security">Security</SelectItem>
                  <SelectItem value="feature_request">Feature Request</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[200px]">Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead className="w-[120px]">Severity</TableHead>
                  <TableHead className="w-[120px]">Status</TableHead>
                  <TableHead className="w-[160px]">Reported</TableHead>
                  <TableHead className="w-[240px] text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bugReportsQuery.isLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      Loading bug reports…
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-10 text-center text-muted-foreground">
                      No bug reports found.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((bug) => (
                    <TableRow key={bug.id}>
                      <TableCell className="font-medium">
                        <div className="max-w-[200px] truncate" title={bug.title ?? ""}>
                          {bug.title || "Untitled"}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {bug.category || "other"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            bug.severity === "critical"
                              ? "destructive"
                              : bug.severity === "high"
                              ? "default"
                              : "secondary"
                          }
                          className="capitalize"
                        >
                          {bug.severity || "medium"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {bug.status?.replace("_", " ") || "open"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {bug.created_at
                          ? new Date(bug.created_at).toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openView(bug.id)}
                            title="View details"
                          >
                            <FileText className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEdit(bug.id)}
                            title="Edit"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => openDelete(bug.id)}
                            title="Delete"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="mt-4 flex items-center justify-between gap-2">
            <div className="text-sm text-muted-foreground">
              Page {page} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Prev
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// Create Bug Report Modal
interface CreateBugReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  companyId: string | undefined
}

function CreateBugReportModal({ open, onOpenChange, companyId }: CreateBugReportModalProps) {
  const submitBugReport = useSubmitBugReport()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium")
  const [category, setCategory] = useState<"ui" | "api" | "performance" | "data" | "security" | "feature_request" | "other">("other")
  const [priority, setPriority] = useState("3")
  const [browser, setBrowser] = useState("")
  const [device, setDevice] = useState("")
  const [urlPath, setUrlPath] = useState("")
  const [attachments, setAttachments] = useState<File[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetForm = () => {
    setTitle("")
    setDescription("")
    setSeverity("medium")
    setCategory("other")
    setPriority("3")
    setBrowser("")
    setDevice("")
    setUrlPath("")
    setAttachments([])
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const titleTrimmed = String(title ?? "").trim()
    if (!titleTrimmed) {
      toast.error("Title is required")
      return
    }
    if (titleTrimmed.length > 200) {
      toast.error("Title must be 200 characters or less")
      return
    }

    const descTrimmed = String(description ?? "").trim()
    if (!descTrimmed) {
      toast.error("Description is required")
      return
    }

    const priorityNum = Number(priority ?? 3)
    if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 5) {
      toast.error("Priority must be between 1 and 5")
      return
    }

    // Validate attachments
    if (attachments.length > 5) {
      toast.error("Maximum 5 attachments allowed")
      return
    }

    for (const file of attachments) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 10MB limit`)
        return
      }
    }

    try {
      await submitBugReport.mutateAsync({
        title: titleTrimmed,
        description: descTrimmed,
        company_id: companyId ? String(companyId).trim() : undefined,
        severity,
        category,
        priority: priorityNum,
        browser: browser.trim() || undefined,
        device: device.trim() || undefined,
        url_path: urlPath.trim() || undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      })
      toast.success("Bug report submitted successfully")
      resetForm()
      onOpenChange(false)
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to submit bug report"
      toast.error(errorMessage)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    if (files.length === 0) return

    if (attachments.length + files.length > 5) {
      toast.error("Maximum 5 attachments allowed")
      return
    }

    const validFiles: File[] = []
    for (const file of files) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error(`File ${file.name} exceeds 10MB limit`)
        continue
      }
      validFiles.push(file)
    }

    setAttachments([...attachments, ...validFiles])
  }

  const removeAttachment = (index: number) => {
    setAttachments(attachments.filter((_, i) => i !== index))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Report Bug</DialogTitle>
          <DialogDescription>
            Submit a bug report, issue, or feature request. Provide as much detail as possible.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-6">
          <div className="grid gap-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title ?? ""}
                onChange={(e) => {
                  const val = String(e.target.value ?? "").trim()
                  if (val.length <= 200) {
                    setTitle(val)
                  } else {
                    toast.error("Title must be 200 characters or less")
                  }
                }}
                placeholder="Brief description of the issue"
                required
                maxLength={200}
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="description">Description *</Label>
              <Textarea
                id="description"
                value={description ?? ""}
                onChange={(e) => setDescription(e.target.value ?? "")}
                placeholder="Detailed description of the bug, steps to reproduce, expected vs actual behavior..."
                rows={6}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="severity">Severity</Label>
                <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="medium">Medium</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ui">UI</SelectItem>
                    <SelectItem value="api">API</SelectItem>
                    <SelectItem value="performance">Performance</SelectItem>
                    <SelectItem value="data">Data</SelectItem>
                    <SelectItem value="security">Security</SelectItem>
                    <SelectItem value="feature_request">Feature Request</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="priority">Priority (1-5, 1=highest)</Label>
                <Input
                  id="priority"
                  type="number"
                  min="1"
                  max="5"
                  value={priority ?? "3"}
                  onChange={(e) => {
                    const val = String(e.target.value ?? "3")
                    const num = Number(val)
                    if (val === "" || (!isNaN(num) && num >= 1 && num <= 5)) {
                      setPriority(val)
                    }
                  }}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="browser">Browser (optional)</Label>
                <Input
                  id="browser"
                  value={browser ?? ""}
                  onChange={(e) => setBrowser(e.target.value ?? "")}
                  placeholder="e.g., Chrome 120"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="device">Device (optional)</Label>
                <Input
                  id="device"
                  value={device ?? ""}
                  onChange={(e) => setDevice(e.target.value ?? "")}
                  placeholder="e.g., Windows 11, macOS"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="url-path">URL Path (optional)</Label>
              <Input
                id="url-path"
                value={urlPath ?? ""}
                onChange={(e) => setUrlPath(e.target.value ?? "")}
                placeholder="e.g., /dashboard/invoices"
              />
            </div>

            <div className="grid gap-2">
              <Label>Attachments (optional, max 5 files, 10MB each)</Label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.gif,.pdf,.txt,.log,.json,.csv"
                onChange={handleFileChange}
                className="hidden"
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={attachments.length >= 5}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  Add File
                </Button>
                <span className="text-sm text-muted-foreground">
                  {attachments.length} / 5 files
                </span>
              </div>
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 border rounded">
                      <span className="text-sm truncate">{file.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttachment(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                resetForm()
                onOpenChange(false)
              }}
              disabled={submitBugReport.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={submitBugReport.isPending || !title.trim() || !description.trim()}>
              {submitBugReport.isPending ? "Submitting..." : "Submit Report"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// Edit Bug Report Modal
interface EditBugReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bugId: string
}

function EditBugReportModal({ open, onOpenChange, bugId }: EditBugReportModalProps) {
  const bugQuery = useBugReport(bugId)
  const updateBugReport = useUpdateBugReport()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium")
  const [category, setCategory] = useState<"ui" | "api" | "performance" | "data" | "security" | "feature_request" | "other">("other")
  const [status, setStatus] = useState<"open" | "in_progress" | "resolved" | "closed" | "wont_fix">("open")
  const [priority, setPriority] = useState("3")
  const [resolutionNotes, setResolutionNotes] = useState("")

  const bug = bugQuery.data

  // Update form when bug data loads
  useEffect(() => {
    if (bug && open) {
      setTitle(bug.title ?? "")
      setDescription(bug.description ?? "")
      setSeverity(bug.severity ?? "medium")
      setCategory(bug.category ?? "other")
      setStatus(bug.status ?? "open")
      setPriority(String(bug.priority ?? 3))
      setResolutionNotes(bug.resolution_notes ?? "")
    }
  }, [bug, open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const bid = String(bugId ?? "").trim()
    if (!bid) {
      toast.error("Invalid bug report ID")
      return
    }

    const titleTrimmed = String(title ?? "").trim()
    if (!titleTrimmed) {
      toast.error("Title is required")
      return
    }
    if (titleTrimmed.length > 200) {
      toast.error("Title must be 200 characters or less")
      return
    }

    const descTrimmed = String(description ?? "").trim()
    if (!descTrimmed) {
      toast.error("Description is required")
      return
    }

    const priorityNum = Number(priority ?? 3)
    if (isNaN(priorityNum) || priorityNum < 1 || priorityNum > 5) {
      toast.error("Priority must be between 1 and 5")
      return
    }

    try {
      await updateBugReport.mutateAsync({
        bugId: bid,
        data: {
          title: titleTrimmed,
          description: descTrimmed,
          severity,
          category,
          status,
          priority: priorityNum,
          resolution_notes: resolutionNotes.trim() || undefined,
        },
      })
      toast.success("Bug report updated successfully")
      onOpenChange(false)
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to update bug report"
      toast.error(errorMessage)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Bug Report</DialogTitle>
          <DialogDescription>Update bug report details and status</DialogDescription>
        </DialogHeader>

        {bugQuery.isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : (
          <form onSubmit={handleSubmit} className="grid gap-6">
            <div className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-title">Title *</Label>
                <Input
                  id="edit-title"
                  value={title ?? ""}
                  onChange={(e) => {
                    const val = String(e.target.value ?? "").trim()
                    if (val.length <= 200) {
                      setTitle(val)
                    }
                  }}
                  maxLength={200}
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-description">Description *</Label>
                <Textarea
                  id="edit-description"
                  value={description ?? ""}
                  onChange={(e) => setDescription(e.target.value ?? "")}
                  rows={6}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-severity">Severity</Label>
                  <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Select value={category} onValueChange={(v) => setCategory(v as typeof category)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ui">UI</SelectItem>
                      <SelectItem value="api">API</SelectItem>
                      <SelectItem value="performance">Performance</SelectItem>
                      <SelectItem value="data">Data</SelectItem>
                      <SelectItem value="security">Security</SelectItem>
                      <SelectItem value="feature_request">Feature Request</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="edit-status">Status</Label>
                  <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">Open</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="resolved">Resolved</SelectItem>
                      <SelectItem value="closed">Closed</SelectItem>
                      <SelectItem value="wont_fix">Won't Fix</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="edit-priority">Priority (1-5)</Label>
                <Input
                  id="edit-priority"
                  type="number"
                  min="1"
                  max="5"
                  value={priority ?? "3"}
                  onChange={(e) => {
                    const val = String(e.target.value ?? "3")
                    const num = Number(val)
                    if (val === "" || (!isNaN(num) && num >= 1 && num <= 5)) {
                      setPriority(val)
                    }
                  }}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="resolution-notes">Resolution Notes (optional)</Label>
                <Textarea
                  id="resolution-notes"
                  value={resolutionNotes ?? ""}
                  onChange={(e) => setResolutionNotes(e.target.value ?? "")}
                  placeholder="Notes about how this was resolved..."
                  rows={3}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={updateBugReport.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={updateBugReport.isPending || !title.trim() || !description.trim()}>
                {updateBugReport.isPending ? "Updating..." : "Update Report"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// View Bug Report Modal
interface ViewBugReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bugId: string
}

function ViewBugReportModal({ open, onOpenChange, bugId }: ViewBugReportModalProps) {
  const bugQuery = useBugReport(bugId)
  const commentsQuery = useBugReportComments(bugId)
  const addComment = useAddBugReportComment()
  const [commentText, setCommentText] = useState("")

  const bug = bugQuery.data
  const comments = commentsQuery.data?.comments ?? []

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault()

    const bid = String(bugId ?? "").trim()
    if (!bid) {
      toast.error("Invalid bug report ID")
      return
    }

    const commentTrimmed = String(commentText ?? "").trim()
    if (!commentTrimmed) {
      toast.error("Comment cannot be empty")
      return
    }

    try {
      await addComment.mutateAsync({
        bugId: bid,
        comment: commentTrimmed,
      })
      setCommentText("")
      toast.success("Comment added")
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to add comment"
      toast.error(errorMessage)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Bug Report Details</DialogTitle>
          <DialogDescription>View bug report information and comments</DialogDescription>
        </DialogHeader>

        {bugQuery.isLoading ? (
          <div className="py-10 text-center text-muted-foreground">Loading...</div>
        ) : bug ? (
          <div className="grid gap-6">
            <div className="grid gap-4">
              <div>
                <h3 className="font-semibold text-lg mb-2">{bug.title || "Untitled"}</h3>
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="capitalize">{bug.category || "other"}</Badge>
                  <Badge
                    variant={
                      bug.severity === "critical"
                        ? "destructive"
                        : bug.severity === "high"
                        ? "default"
                        : "secondary"
                    }
                    className="capitalize"
                  >
                    {bug.severity || "medium"}
                  </Badge>
                  <Badge variant="outline" className="capitalize">
                    {bug.status?.replace("_", " ") || "open"}
                  </Badge>
                </div>
              </div>

              <div className="grid gap-2">
                <Label>Description</Label>
                <div className="p-3 border rounded-md whitespace-pre-wrap text-sm">
                  {bug.description || "No description"}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Reported by:</span>{" "}
                  {bug.reported_by?.username || "Unknown"}
                </div>
                <div>
                  <span className="text-muted-foreground">Created:</span>{" "}
                  {bug.created_at ? new Date(bug.created_at).toLocaleString() : "—"}
                </div>
                {bug.browser && (
                  <div>
                    <span className="text-muted-foreground">Browser:</span> {bug.browser}
                  </div>
                )}
                {bug.device && (
                  <div>
                    <span className="text-muted-foreground">Device:</span> {bug.device}
                  </div>
                )}
                {bug.url_path && (
                  <div>
                    <span className="text-muted-foreground">URL:</span> {bug.url_path}
                  </div>
                )}
                {bug.priority != null && (
                  <div>
                    <span className="text-muted-foreground">Priority:</span> {bug.priority}
                  </div>
                )}
              </div>

              {bug.resolution_notes && (
                <div className="grid gap-2">
                  <Label>Resolution Notes</Label>
                  <div className="p-3 border rounded-md whitespace-pre-wrap text-sm">
                    {bug.resolution_notes}
                  </div>
                </div>
              )}
            </div>

            <div className="border-t pt-4">
              <h4 className="font-semibold mb-4 flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Comments ({comments.length})
              </h4>

              <div className="space-y-3 mb-4 max-h-[300px] overflow-y-auto">
                {commentsQuery.isLoading ? (
                  <div className="text-sm text-muted-foreground">Loading comments...</div>
                ) : comments.length === 0 ? (
                  <div className="text-sm text-muted-foreground">No comments yet</div>
                ) : (
                  comments.map((comment, index) => (
                    <div key={index} className="p-3 border rounded-md">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {comment.username || "Unknown"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {comment.timestamp
                            ? new Date(comment.timestamp).toLocaleString()
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm whitespace-pre-wrap">{comment.comment || ""}</p>
                    </div>
                  ))
                )}
              </div>

              <form onSubmit={handleAddComment} className="space-y-2">
                <Textarea
                  value={commentText ?? ""}
                  onChange={(e) => setCommentText(e.target.value ?? "")}
                  placeholder="Add a comment..."
                  rows={3}
                />
                <Button type="submit" size="sm" disabled={addComment.isPending || !commentText.trim()}>
                  {addComment.isPending ? "Adding..." : "Add Comment"}
                </Button>
              </form>
            </div>
          </div>
        ) : (
          <div className="py-10 text-center text-muted-foreground">Bug report not found</div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// Delete Bug Report Modal
interface DeleteBugReportModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  bugId: string
}

function DeleteBugReportModal({ open, onOpenChange, bugId }: DeleteBugReportModalProps) {
  const deleteBugReport = useDeleteBugReport()
  const bugQuery = useBugReport(bugId)
  const bug = bugQuery.data

  const handleDelete = async () => {
    const bid = String(bugId ?? "").trim()
    if (!bid) {
      toast.error("Invalid bug report ID")
      return
    }

    try {
      await deleteBugReport.mutateAsync({ bugId: bid })
      toast.success("Bug report deleted successfully")
      onOpenChange(false)
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to delete bug report"
      toast.error(errorMessage)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Bug Report</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete this bug report? This action cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {bug && (
          <div className="py-4">
            <p className="font-medium">{bug.title || "Untitled"}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {bug.description ? bug.description.substring(0, 100) + "..." : "No description"}
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={deleteBugReport.isPending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={deleteBugReport.isPending}
          >
            {deleteBugReport.isPending ? "Deleting..." : "Delete"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

