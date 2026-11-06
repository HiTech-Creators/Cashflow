import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Upload, Download, FileSpreadsheet, FileText } from "lucide-react"
import { useState, useRef } from "react"
import { fileApi } from "@/lib/api"
import { useCompanyId } from "@/hooks/useApi"
import toast from "react-hot-toast"

export default function ImportExport() {
  const companyId = useCompanyId()
  const [isImporting, setIsImporting] = useState(false)
  const [isValidating, setIsValidating] = useState(false)
  const [isExportingCSV, setIsExportingCSV] = useState(false)
  const [isExportingPDF, setIsExportingPDF] = useState(false)
  const [validateOnly, setValidateOnly] = useState(false)
  const [includeBalance, setIncludeBalance] = useState(false)
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [exportTitle, setExportTitle] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) {
      return
    }

    const cid = String(companyId ?? "").trim()
    if (!cid) {
      toast.error("Please select a company first")
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file name exists
    const fileName = String(file.name ?? "").trim()
    if (!fileName) {
      toast.error("Invalid file: file name is missing")
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file type - backend only accepts CSV
    const fileExtension = fileName.toLowerCase().split('.').pop() ?? ""
    if (fileExtension !== 'csv') {
      toast.error("Only CSV files are supported for import")
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Validate file size (10MB)
    const maxSize = 10 * 1024 * 1024
    const fileSize = Number(file.size ?? 0)
    if (fileSize <= 0) {
      toast.error("Invalid file: file appears to be empty")
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }
    if (fileSize > maxSize) {
      toast.error("File size exceeds 10MB limit")
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    if (validateOnly) {
      setIsValidating(true)
    } else {
      setIsImporting(true)
    }

    try {
      const response = await fileApi.importTransactionsCSV(cid, file, validateOnly ?? false)
      
      if (!response) {
        toast.error("No response received from server")
        return
      }

      if (validateOnly) {
        const count = Number(response.validated_count ?? 0)
        if (count > 0) {
          toast.success(`Validation successful. ${count} transaction${count === 1 ? '' : 's'} ready to import.`)
        } else {
          toast("Validation completed but no valid transactions found", { icon: "⚠️" })
        }
        const errors = Array.isArray(response.errors) ? response.errors : []
        if (errors.length > 0) {
          const errorMsg = errors.slice(0, 5).join(', ')
          const moreErrors = errors.length > 5 ? ` and ${errors.length - 5} more` : ''
          toast.error(`Validation errors: ${errorMsg}${moreErrors}`)
        }
      } else {
        const count = Number(response.imported_count ?? 0)
        if (count > 0) {
          toast.success(`Successfully imported ${count} transaction${count === 1 ? '' : 's'}`)
        } else {
          toast("Import completed but no transactions were imported", { icon: "⚠️" })
        }
        const errors = Array.isArray(response.errors) ? response.errors : []
        if (errors.length > 0) {
          const errorMsg = errors.slice(0, 5).join(', ')
          const moreErrors = errors.length > 5 ? ` and ${errors.length - 5} more` : ''
          toast.error(`Some errors occurred: ${errorMsg}${moreErrors}`)
        }
      }
      
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to import file"
      toast.error(errorMessage)
      // Reset file input on error
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    } finally {
      setIsImporting(false)
      setIsValidating(false)
    }
  }

  const handleExportCSV = async () => {
    const cid = String(companyId ?? "").trim()
    if (!cid) {
      toast.error("Please select a company first")
      return
    }

    // Validate date range if both dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        toast.error("Invalid date format. Please select valid dates.")
        return
      }
      if (start > end) {
        toast.error("Start date must be before or equal to end date")
        return
      }
    }

    setIsExportingCSV(true)
    try {
      const blob = await fileApi.exportTransactionsCSV(cid, {
        include_balance: includeBalance ?? false,
        start_date: startDate ? String(startDate).trim() : undefined,
        end_date: endDate ? String(endDate).trim() : undefined,
      })
      
      if (!blob || !(blob instanceof Blob)) {
        toast.error("Invalid response: expected file data")
        return
      }

      const url = window.URL.createObjectURL(blob)
      if (!url) {
        toast.error("Failed to create download link")
        return
      }

      const a = document.createElement('a')
      if (!a) {
        toast.error("Failed to create download element")
        window.URL.revokeObjectURL(url)
        return
      }

      a.href = url
      a.download = `transactions_${cid}_${new Date().toISOString().split('T')[0]}.csv`
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
      }, 100)
      
      toast.success("Transactions exported to CSV successfully")
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to export transactions"
      toast.error(errorMessage)
    } finally {
      setIsExportingCSV(false)
    }
  }

  const handleExportPDF = async () => {
    const cid = String(companyId ?? "").trim()
    if (!cid) {
      toast.error("Please select a company first")
      return
    }

    // Validate date range if both dates are provided
    if (startDate && endDate) {
      const start = new Date(startDate)
      const end = new Date(endDate)
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        toast.error("Invalid date format. Please select valid dates.")
        return
      }
      if (start > end) {
        toast.error("Start date must be before or equal to end date")
        return
      }
    }

    // Validate title length if provided
    const title = String(exportTitle ?? "").trim()
    if (title && title.length > 200) {
      toast.error("Report title must be 200 characters or less")
      return
    }

    setIsExportingPDF(true)
    try {
      const blob = await fileApi.exportTransactionsPDF(cid, {
        start_date: startDate ? String(startDate).trim() : undefined,
        end_date: endDate ? String(endDate).trim() : undefined,
        title: title || undefined,
      })
      
      if (!blob || !(blob instanceof Blob)) {
        toast.error("Invalid response: expected file data")
        return
      }

      const url = window.URL.createObjectURL(blob)
      if (!url) {
        toast.error("Failed to create download link")
        return
      }

      const a = document.createElement('a')
      if (!a) {
        toast.error("Failed to create download element")
        window.URL.revokeObjectURL(url)
        return
      }

      a.href = url
      a.download = `transactions_${cid}_${new Date().toISOString().split('T')[0]}.pdf`
      document.body.appendChild(a)
      a.click()
      
      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
      }, 100)
      
      toast.success("Transactions exported to PDF successfully")
    } catch (error: unknown) {
      const errorObj = error as { response?: { data?: { error?: string; message?: string } }; message?: string } | null
      const errorMessage = errorObj?.response?.data?.error || 
                          errorObj?.response?.data?.message || 
                          errorObj?.message || 
                          "Failed to export transactions"
      toast.error(errorMessage)
    } finally {
      setIsExportingPDF(false)
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Import / Export</h2>
        <p className="text-muted-foreground">Import CSV files and export to CSV or PDF formats</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Import Data
            </CardTitle>
            <CardDescription>Upload CSV files to import transactions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv"
              onChange={handleFileChange}
              className="hidden"
            />
            
            <div className="flex items-center space-x-2">
              <Checkbox
                id="validate-only"
                checked={validateOnly}
                onCheckedChange={(checked) => setValidateOnly(checked === true)}
              />
              <Label htmlFor="validate-only" className="text-sm font-normal cursor-pointer">
                Validate only (don't import)
              </Label>
            </div>

            <div className="h-48 rounded border-2 border-dashed border-muted flex items-center justify-center">
              <div className="text-center">
                <FileSpreadsheet className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-4">Drop CSV file here or click to browse</p>
                <Button 
                  variant="secondary" 
                  size="sm"
                  onClick={handleImportClick}
                  disabled={(isImporting || isValidating) || !companyId}
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {isValidating ? "Validating..." : isImporting ? "Importing..." : "Select CSV File"}
                </Button>
              </div>
            </div>
            
            <div className="text-xs text-muted-foreground space-y-1">
              <p><strong>Supported format:</strong> CSV only (Max 10MB)</p>
              <p><strong>Required columns:</strong> Date, Description, Type, Amount</p>
              <p><strong>Optional columns:</strong> Category, Currency</p>
            </div>
            
            {!companyId && (
              <div className="text-xs text-amber-600">
                Please select a company to import transactions
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Download className="h-5 w-5" />
              Export Data
            </CardTitle>
            <CardDescription>Download your financial data in various formats</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Date Range Filters */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="start-date">Start Date (optional)</Label>
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ?? ""
                      setStartDate(val)
                      // Auto-validate end date if it exists
                      if (endDate && val && new Date(val) > new Date(endDate)) {
                        toast.error("Start date cannot be after end date")
                      }
                    }}
                  />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="end-date">End Date (optional)</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate ?? ""}
                    onChange={(e) => {
                      const val = e.target.value ?? ""
                      setEndDate(val)
                      // Auto-validate start date if it exists
                      if (startDate && val && new Date(startDate) > new Date(val)) {
                        toast.error("End date cannot be before start date")
                      }
                    }}
                    min={startDate || undefined}
                  />
              </div>
            </div>

            {/* Export Options */}
            <div className="space-y-3">
              <div className="p-4 rounded border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">Export to CSV</p>
                    <p className="text-xs text-muted-foreground">Export transactions as CSV file</p>
                  </div>
                  <Button 
                    size="sm"
                    onClick={handleExportCSV}
                    disabled={isExportingCSV || isExportingPDF || !companyId}
                  >
                    <Download className="h-4 w-4 mr-2" />
                    {isExportingCSV ? "Exporting..." : "Export CSV"}
                  </Button>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="include-balance"
                    checked={includeBalance}
                    onCheckedChange={(checked) => setIncludeBalance(checked === true)}
                  />
                  <Label htmlFor="include-balance" className="text-sm font-normal cursor-pointer">
                    Include running balance column
                  </Label>
                </div>
              </div>
              
              <div className="p-4 rounded border">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-medium">Export to PDF</p>
                    <p className="text-xs text-muted-foreground">Generate PDF report of transactions</p>
                  </div>
                  <Button 
                    size="sm" 
                    variant="secondary"
                    onClick={handleExportPDF}
                    disabled={isExportingPDF || isExportingCSV || !companyId}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    {isExportingPDF ? "Exporting..." : "Export PDF"}
                  </Button>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="export-title">Report Title (optional)</Label>
                  <Input
                    id="export-title"
                    type="text"
                    value={exportTitle ?? ""}
                    onChange={(e) => {
                      const val = String(e.target.value ?? "").trim()
                      if (val.length <= 200) {
                        setExportTitle(val)
                      } else {
                        toast.error("Title must be 200 characters or less")
                      }
                    }}
                    placeholder="Transaction Report"
                    maxLength={200}
                  />
                </div>
              </div>
            </div>
            
            {!companyId && (
              <div className="text-xs text-amber-600">
                Please select a company to export transactions
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


