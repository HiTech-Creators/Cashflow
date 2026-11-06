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
import { getCurrentUser } from "@/lib/auth"
import { userApi, companyApi } from "@/lib/api"
import type { User, Company } from "@/lib/api"
import { Users as UsersIcon, UserPlus, Loader2, AlertCircle, UserCog, Building2, ChevronDown } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import toast from "react-hot-toast"

export default function Users() {
  const currentUser = getCurrentUser()
  const [users, setUsers] = useState<User[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isInviteDialogOpen, setIsInviteDialogOpen] = useState(false)
  const [isCreateAdminDialogOpen, setIsCreateAdminDialogOpen] = useState(false)
  const [inviteForm, setInviteForm] = useState({ email: '', role: 'user' as 'user' | 'companyAdmin' })
  const [adminForm, setAdminForm] = useState({ username: '', email: '', password: '', companyId: '' })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [expandedUser, setExpandedUser] = useState<string | null>(null)

  const fetchUsers = async () => {
    console.log("🔍 Fetching users...", { user: currentUser ? { role: currentUser.role, companyId: currentUser.companyId } : null })

    if (!currentUser) {
      console.log("❌ No user found, stopping fetch")
      setLoading(false)
      return
    }

    if (currentUser.role === "user") {
      console.log("❌ User role is 'user', no permission to view users")
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      setError(null)

      let userData: User[]
      if (currentUser.role === "superadmin") {
        console.log("👑 SuperAdmin: fetching all users")
        userData = await userApi.getAllUsers()
        // Also fetch all companies for admin creation
        const companyData = await companyApi.getAllCompanies()
        setCompanies(companyData)
      } else if (currentUser.role === "companyAdmin") {
        console.log("🏢 CompanyAdmin: fetching company users")
        const companyId = currentUser.companyId
        if (!companyId) {
          throw new Error("No company ID found for user")
        }
        userData = await userApi.getCompanyUsers(companyId)
        // Also fetch user's companies for context
        const companyData = await companyApi.getUserCompanies()
        setCompanies(companyData)
      } else {
        console.log("⚠️ Unknown role:", currentUser.role)
        userData = []
      }

      console.log("✅ Fetched users:", userData.length)
      setUsers(userData)
    } catch (err: any) {
      console.error("❌ Error fetching users:", err)
      const errorMessage = err.message || "Failed to load users"
      setError(errorMessage)
      toast.error(errorMessage)
      setUsers([]) // Clear users on error
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleInviteUser = async () => {
    if (!inviteForm.email.trim()) {
      toast.error('Email is required')
      return
    }

    if (!currentUser?.companyId && inviteForm.role === 'user') {
      toast.error('Company ID is required for inviting users')
      return
    }

    setIsSubmitting(true)
    try {
      if (inviteForm.role === 'companyAdmin') {
        // For company admins, we need to use a different endpoint
        toast('Company admin invitations are handled through the create admin feature', { duration: 3000 })
        setIsInviteDialogOpen(false)
        setIsCreateAdminDialogOpen(true)
        return
      } else {
        // Invite regular user
        if (!currentUser?.companyId) {
          toast.error('Company ID is required for inviting users')
          return
        }
        await userApi.inviteUser(currentUser.companyId, inviteForm)
        toast.success('User invitation sent successfully!')
        setIsInviteDialogOpen(false)
        setInviteForm({ email: '', role: 'user' })
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to invite user')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCreateCompanyAdmin = async () => {
    if (!adminForm.username.trim() || !adminForm.email.trim() || !adminForm.password.trim()) {
      toast.error('All fields are required')
      return
    }

    if (!adminForm.companyId) {
      toast.error('Please select a company')
      return
    }

    setIsSubmitting(true)
    try {
      await userApi.createCompanyAdmin(adminForm.companyId, adminForm)
      toast.success('Company admin created successfully!')
      setIsCreateAdminDialogOpen(false)
      setAdminForm({ username: '', email: '', password: '', companyId: '' })
      fetchUsers() // Refresh the user list
    } catch (error: any) {
      toast.error(error.message || 'Failed to create company admin')
    } finally {
      setIsSubmitting(false)
    }
  }

  const getRoleBadgeVariant = (role: string) => {
    switch (role.toLowerCase()) {
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
    return role.charAt(0).toUpperCase() + role.slice(1).toLowerCase()
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Users</h2>
          <p className="text-muted-foreground">
            {currentUser?.role === "superadmin"
              ? "Manage all users in the system"
              : "Manage users in your company"
            }
          </p>
        </div>
        {currentUser?.role !== "user" && (
          <div className="flex gap-2">
            <Dialog open={isInviteDialogOpen} onOpenChange={setIsInviteDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Invite User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Invite New User</DialogTitle>
                  <DialogDescription>
                    Send an invitation to join {currentUser?.role === "superadmin" ? "the system" : "your company"}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="invite-email">Email Address</Label>
                    <Input
                      id="invite-email"
                      type="email"
                      value={inviteForm.email}
                      onChange={(e) => setInviteForm(prev => ({ ...prev, email: e.target.value }))}
                      placeholder="user@example.com"
                      disabled={isSubmitting}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="invite-role">Role</Label>
                    <Select
                      value={inviteForm.role}
                      onValueChange={(value: 'user' | 'companyAdmin') => setInviteForm(prev => ({ ...prev, role: value }))}
                      disabled={isSubmitting}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="user">User</SelectItem>
                        {currentUser?.role === "superadmin" && (
                          <SelectItem value="companyAdmin">Company Admin</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setIsInviteDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleInviteUser} disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Inviting...
                      </>
                    ) : (
                      "Send Invitation"
                    )}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            {currentUser?.role === "superadmin" && (
              <Dialog open={isCreateAdminDialogOpen} onOpenChange={setIsCreateAdminDialogOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline">
                    <UserCog className="h-4 w-4 mr-2" />
                    Create Admin
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Create Company Admin</DialogTitle>
                    <DialogDescription>
                      Create a new company administrator with full access to a specific company.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="admin-username">Username</Label>
                      <Input
                        id="admin-username"
                        value={adminForm.username}
                        onChange={(e) => setAdminForm(prev => ({ ...prev, username: e.target.value }))}
                        placeholder="admin_username"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-email">Email</Label>
                      <Input
                        id="admin-email"
                        type="email"
                        value={adminForm.email}
                        onChange={(e) => setAdminForm(prev => ({ ...prev, email: e.target.value }))}
                        placeholder="admin@example.com"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-password">Password</Label>
                      <Input
                        id="admin-password"
                        type="password"
                        value={adminForm.password}
                        onChange={(e) => setAdminForm(prev => ({ ...prev, password: e.target.value }))}
                        placeholder="••••••••"
                        disabled={isSubmitting}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="admin-company">Company</Label>
                      <Select
                        value={adminForm.companyId}
                        onValueChange={(value) => setAdminForm(prev => ({ ...prev, companyId: value }))}
                        disabled={isSubmitting}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select company" />
                        </SelectTrigger>
                        <SelectContent>
                          {companies.map((company) => (
                            <SelectItem key={company.id} value={company.id}>
                              {company.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateAdminDialogOpen(false)}
                      disabled={isSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button onClick={handleCreateCompanyAdmin} disabled={isSubmitting}>
                      {isSubmitting ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        "Create Admin"
                      )}
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5" />
            User Management
          </CardTitle>
          <CardDescription>
            {currentUser?.role === "superadmin"
              ? "View and manage all users across the system"
              : "View and manage users in your company"
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {currentUser?.role === "user" ? (
            <div className="text-center py-12">
              <div className="text-muted-foreground">Insufficient permissions to manage users</div>
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
                  <span>Loading users...</span>
                </div>
              ) : users.length === 0 ? (
                <div className="text-center py-12">
                  <UsersIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">No users found</p>
                </div>
              ) : (
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]"></TableHead>
                        <TableHead>Username</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Companies</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => {
                        const isExpanded = expandedUser === user.id
                        return (
                          <React.Fragment key={user.id}>
                            <TableRow className="border-b hover:bg-muted/50">
                              <TableCell className="w-[50px]">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="h-8 w-8 p-0"
                                  onClick={() => {
                                    setExpandedUser(isExpanded ? null : user.id)
                                  }}
                                >
                                  {isExpanded ? (
                                    <ChevronDown className="h-4 w-4 rotate-180 transition-transform" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 transition-transform" />
                                  )}
                                </Button>
                              </TableCell>
                              <TableCell className="font-medium">{user.username}</TableCell>
                              <TableCell>{user.email}</TableCell>
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
                              <TableCell>
                                {user.companies && user.companies.length > 0 ? (
                                  <div className="flex items-center gap-1">
                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                    <span className="font-medium">{user.companies.length}</span>
                                    <span className="text-muted-foreground text-sm">
                                      {user.companies.length === 1 ? 'company' : 'companies'}
                                    </span>
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground">-</span>
                                )}
                              </TableCell>
                              <TableCell>
                                {user.created_at ? new Date(user.created_at).toLocaleDateString() : '-'}
                              </TableCell>
                            </TableRow>
                            {isExpanded && (
                              <TableRow>
                                <TableCell colSpan={7} className="p-0 bg-muted/30">
                                  <div className="px-4 pb-4 pt-2">
                                    {user.companies && user.companies.length > 0 ? (
                                      <div className="border rounded-lg overflow-hidden bg-background">
                                        <Table>
                                          <TableHeader>
                                            <TableRow>
                                              <TableHead>Company Name</TableHead>
                                              <TableHead>Role in Company</TableHead>
                                            </TableRow>
                                          </TableHeader>
                                          <TableBody>
                                            {user.companies.map((company, index) => (
                                              <TableRow key={index}>
                                                <TableCell className="font-medium">
                                                  <div className="flex items-center gap-2">
                                                    <Building2 className="h-4 w-4 text-muted-foreground" />
                                                    {company.name}
                                                  </div>
                                                </TableCell>
                                                <TableCell>
                                                  <Badge variant="outline">
                                                    {company.role || 'User'}
                                                  </Badge>
                                                </TableCell>
                                              </TableRow>
                                            ))}
                                          </TableBody>
                                        </Table>
                                      </div>
                                    ) : (
                                      <div className="text-center py-8 text-sm text-muted-foreground">
                                        No companies associated with this user
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
    </div>
  )
}


