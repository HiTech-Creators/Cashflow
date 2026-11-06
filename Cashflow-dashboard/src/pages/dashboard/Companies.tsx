import { useState, useEffect } from "react"
import React from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { getCurrentUser } from "@/lib/auth"
import { companyApi, userApi } from "@/lib/api"
import { Building2, Plus, Loader2, AlertCircle, Users, Calendar, Pencil, Trash2, ChevronDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Company, User } from "@/lib/api"
import toast from "react-hot-toast"

export default function Companies() {
  const currentUser = getCurrentUser()
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null)
  const [createForm, setCreateForm] = useState({ name: '', currency: 'USD' })
  const [editForm, setEditForm] = useState({ name: '', currency: 'USD' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [companyUsers, setCompanyUsers] = useState<Record<string, { users: User[]; loading: boolean }>>({})
  const [expandedCompany, setExpandedCompany] = useState<string | null>(null)

  const fetchCompanies = async () => {
    if (!currentUser) {
      setLoading(false)
      return
    }

    if (currentUser.role === "user") {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let companyData: Company[]
      if (currentUser.role === "superadmin") {
        // SuperAdmin can see all companies
        companyData = await companyApi.getAllCompanies()
      } else {
        // CompanyAdmin and others see their accessible companies
        companyData = await companyApi.getUserCompanies()
      }

      setCompanies(companyData)
    } catch (err: any) {
      const errorMessage = err.message || "Failed to load companies"
      setError(errorMessage)
      toast.error(errorMessage)
      setCompanies([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCompanies()
  }, [])

  const handleCreateCompany = async () => {
    if (!createForm.name.trim()) {
      toast.error('Company name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await companyApi.createCompany(createForm)
      toast.success('Company created successfully!')
      setIsCreateDialogOpen(false)
      setCreateForm({ name: '', currency: 'USD' })
      fetchCompanies()
    } catch (error: any) {
      toast.error(error.message || 'Failed to create company')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleEditCompany = async () => {
    if (!selectedCompany || !editForm.name.trim()) {
      toast.error('Company name is required')
      return
    }

    setIsSubmitting(true)
    try {
      await companyApi.updateCompany(selectedCompany.id, editForm)
      toast.success('Company updated successfully!')
      setIsEditDialogOpen(false)
      setSelectedCompany(null)
      setEditForm({ name: '', currency: 'USD' })
      fetchCompanies()
    } catch (error: any) {
      toast.error(error.message || 'Failed to update company')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDeleteCompany = async (companyId: string) => {
    try {
      await companyApi.deleteCompany(companyId)
      toast.success('Company deleted successfully!')
      fetchCompanies()
    } catch (error: any) {
      toast.error(error.message || 'Failed to delete company')
    }
  }

  const openEditDialog = (company: Company) => {
    setSelectedCompany(company)
    setEditForm({ name: company.name, currency: company.currency })
    setIsEditDialogOpen(true)
  }

  const fetchCompanyUsers = async (companyId: string) => {
    // If already loaded or loading, don't fetch again
    if (companyUsers[companyId]?.users || companyUsers[companyId]?.loading) {
      return
    }

    setCompanyUsers(prev => ({ ...prev, [companyId]: { users: [], loading: true } }))

    try {
      const users = await userApi.getCompanyUsers(companyId)
      setCompanyUsers(prev => ({ ...prev, [companyId]: { users, loading: false } }))
    } catch (error: any) {
      console.error('Failed to fetch company users:', error)
      setCompanyUsers(prev => ({ ...prev, [companyId]: { users: [], loading: false } }))
    }
  }

  const formatCurrency = (currency: string) => {
    const currencyMap: Record<string, string> = {
      'USD': '$',
      'EUR': '€',
      'GBP': '£',
      'JPY': '¥',
    }
    return currencyMap[currency] || currency
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role?.toLowerCase()) {
      case "superadmin":
        return "destructive"
      case "companyadmin":
        return "default"
      case "user":
        return "secondary"
      default:
        return "outline"
    }
  }

  const formatRole = (role: string) => {
    return role?.charAt(0).toUpperCase() + role?.slice(1).toLowerCase() || 'User'
  }

  const currencies = [
    { value: 'USD', label: 'USD ($)' },
    { value: 'EUR', label: 'EUR (€)' },
    { value: 'GBP', label: 'GBP (£)' },
    { value: 'JPY', label: 'JPY (¥)' },
    { value: 'CAD', label: 'CAD (C$)' },
    { value: 'AUD', label: 'AUD (A$)' },
  ]

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Companies</h2>
          <p className="text-muted-foreground">
            {currentUser?.role === "superadmin"
              ? "Manage all companies in the system"
              : "View companies you have access to"
            }
          </p>
        </div>
        {currentUser?.role === "superadmin" && (
          <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Company
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create New Company</DialogTitle>
                <DialogDescription>
                  Add a new company to the system. Company admins can be assigned later.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="create-name">Company Name</Label>
                  <Input
                    id="create-name"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter company name"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-currency">Currency</Label>
                  <Select
                    value={createForm.currency}
                    onValueChange={(value) => setCreateForm(prev => ({ ...prev, currency: value }))}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select currency" />
                    </SelectTrigger>
                    <SelectContent>
                      {currencies.map((currency) => (
                        <SelectItem key={currency.value} value={currency.value}>
                          {currency.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsCreateDialogOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </Button>
                <Button onClick={handleCreateCompany} disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    "Create Company"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Company Management
          </CardTitle>
          <CardDescription>
            {currentUser?.role === "superadmin"
              ? "View and manage all registered companies"
              : "View companies you have access to"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentUser?.role === "user" ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">Insufficient permissions to view companies</div>
            </div>
          ) : (
            <>
              {error && (
                <Alert className="mb-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading companies...</span>
                </div>
              ) : companies.length === 0 ? (
                <div className="text-center py-12">
                  <Building2 className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No companies found</p>
                  {currentUser?.role === "superadmin" && (
                    <p className="text-sm text-muted-foreground mt-2">
                      Click "Add Company" to create your first company.
                    </p>
                  )}
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Company Name</TableHead>
                        <TableHead>Currency</TableHead>
                        <TableHead>Users</TableHead>
                        <TableHead>Created By</TableHead>
                        <TableHead>Created</TableHead>
                        {currentUser?.role === "superadmin" && <TableHead className="w-[100px]">Actions</TableHead>}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {companies.map((company) => {
                        const isExpanded = expandedCompany === company.id
                        return (
                          <React.Fragment key={company.id}>
                            <TableRow className="border-b hover:bg-muted/50">
                              <TableCell className="w-[50px]">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    const newExpanded = isExpanded ? null : company.id
                                    setExpandedCompany(newExpanded)
                                    if (newExpanded) {
                                      fetchCompanyUsers(company.id)
                                    }
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 transition-transform" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <Building2 className="h-4 w-4 text-muted-foreground" />
                                  {company.name}
                                </div>
                              </TableCell>
                              <TableCell>
                                <Badge variant="outline" className="font-mono">
                                  {formatCurrency(company.currency)}
                                </Badge>
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  <Users className="h-4 w-4 text-muted-foreground" />
                                  <span className="font-medium">{company.user_count ?? 0}</span>
                                  <span className="text-muted-foreground text-sm">
                                    {(company.user_count ?? 0) === 1 ? 'user' : 'users'}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {company.created_by || 'N/A'}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1 text-muted-foreground">
                                  <Calendar className="h-4 w-4" />
                                  {company.created_at ? new Date(company.created_at).toLocaleDateString() : 'N/A'}
                                </div>
                              </TableCell>
                              {currentUser?.role === "superadmin" && (
                                <TableCell>
                                  <div className="flex items-center gap-2">
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => openEditDialog(company)}
                                    >
                                      <Pencil className="h-4 w-4" />
                                    </Button>
                                    <AlertDialog>
                                      <AlertDialogTrigger asChild>
                                        <Button variant="ghost" size="sm">
                                          <Trash2 className="h-4 w-4 text-destructive" />
                                        </Button>
                                      </AlertDialogTrigger>
                                      <AlertDialogContent>
                                        <AlertDialogHeader>
                                          <AlertDialogTitle>Delete Company</AlertDialogTitle>
                                          <AlertDialogDescription>
                                            Are you sure you want to delete "{company.name}"? This action cannot be undone and will remove all associated data.
                                          </AlertDialogDescription>
                                        </AlertDialogHeader>
                                        <AlertDialogFooter>
                                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                                          <AlertDialogAction
                                            onClick={() => handleDeleteCompany(company.id)}
                                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                          >
                                            Delete Company
                                          </AlertDialogAction>
                                        </AlertDialogFooter>
                                      </AlertDialogContent>
                                    </AlertDialog>
                                  </div>
                                </TableCell>
                              )}
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={currentUser?.role === "superadmin" ? 7 : 6} className="p-0 bg-muted/30">
                                  <div className="px-4 pb-4 pt-2">
                                    {companyUsers[company.id]?.loading ? (
                                      <div className="flex items-center justify-center py-8">
                                        <Loader2 className="h-5 w-5 animate-spin mr-2" />
                                        <span className="text-sm text-muted-foreground">Loading users...</span>
                                      </div>
                                    ) : companyUsers[company.id]?.users && companyUsers[company.id].users.length > 0 ? (
                                      <div className="border rounded-lg overflow-hidden bg-background">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Username</TableHead>
                                              <TableHead>Email</TableHead>
                                              <TableHead>Role</TableHead>
                                              <TableHead>Status</TableHead>
                                              <TableHead>Joined</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {companyUsers[company.id].users.map((user) => (
                                              <TableRow key={user.id}>
                                                <TableCell className="font-medium">{user.username}</TableCell>
                                                <TableCell>{user.email || '-'}</TableCell>
                                                <TableCell>
                                                  <Badge variant={getRoleBadgeVariant(user.role)}>
                                                    {formatRole(user.role)}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell>
                                                  <Badge variant={user.is_active ? "default" : "secondary"}>
                                                    {user.is_active ? "Active" : "Inactive"}
                                                  </Badge>
                                                </TableCell>
                                                <TableCell className="text-muted-foreground">
                                                  {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    ) : (
                                      <div className="text-center py-8 text-sm text-muted-foreground">
                                        No users found for this company
                                      </div>
                                    )}
                                  </div>
                                </TableCell>
                              </TableRow>
                            )}
                          </React.Fragment>
                        )
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Edit Company Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Company</DialogTitle>
            <DialogDescription>
              Update company information.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Company Name</Label>
              <Input
                id="edit-name"
                value={editForm.name}
                onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Enter company name"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="edit-currency">Currency</Label>
              <Select
                value={editForm.currency}
                onValueChange={(value) => setEditForm(prev => ({ ...prev, currency: value }))}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select currency" />
                </SelectTrigger>
                <SelectContent>
                  {currencies.map((currency) => (
                    <SelectItem key={currency.value} value={currency.value}>
                      {currency.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsEditDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleEditCompany} disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Updating...
                </>
              ) : (
                "Update Company"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}


