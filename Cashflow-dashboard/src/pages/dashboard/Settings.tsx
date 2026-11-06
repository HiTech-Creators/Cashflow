import { useState, useEffect, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { getCurrentUser } from "@/lib/auth"
import { settingsApi } from "@/lib/api"
import { Loader2, User, Lock, Save } from "lucide-react"
import toast from "react-hot-toast"

export default function Settings() {
  // Memoize currentUser to prevent unnecessary re-renders
  const currentUser = useMemo(() => getCurrentUser(), [])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Profile state
  const [profileForm, setProfileForm] = useState({
    username: '',
    email: '',
  })

  // Password state
  const [passwordForm, setPasswordForm] = useState({
    current_password: '',
    new_password: '',
    confirm_password: '',
  })
  const [passwordErrors, setPasswordErrors] = useState<Record<string, string>>({})

  // Initialize profile form once on mount
  useEffect(() => {
    if (currentUser) {
      setProfileForm({
        username: currentUser.username || currentUser.name || '',
        email: currentUser.email || '',
      })
    }
    setLoading(false)
  }, []) // Empty dependency array - only run on mount

  const validatePassword = () => {
    const errors: Record<string, string> = {}

    if (!passwordForm.current_password) {
      errors.current_password = 'Current password is required'
    }

    if (!passwordForm.new_password) {
      errors.new_password = 'New password is required'
    } else if (passwordForm.new_password.length < 8) {
      errors.new_password = 'Password must be at least 8 characters'
    }

    if (!passwordForm.confirm_password) {
      errors.confirm_password = 'Please confirm your new password'
    } else if (passwordForm.new_password !== passwordForm.confirm_password) {
      errors.confirm_password = 'Passwords do not match'
    }

    setPasswordErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleUpdateProfile = async () => {
    if (!profileForm.username.trim()) {
      toast.error('Username is required')
      return
    }

    setSaving(true)
    try {
      await settingsApi.updateProfile({
        username: profileForm.username,
      })
      toast.success('Profile updated successfully!')
      
      // Update stored user without triggering re-render
      try {
        const storedUser = getCurrentUser()
        if (storedUser) {
          const updatedUser = { ...storedUser, username: profileForm.username }
          localStorage.setItem('novatech_auth_user', JSON.stringify(updatedUser))
        }
      } catch (err) {
        console.error('Failed to update stored user:', err)
      }
    } catch (err: any) {
      toast.error(err.message || 'Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!validatePassword()) {
      return
    }

    setSaving(true)
    try {
      await settingsApi.changePassword({
        current_password: passwordForm.current_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password,
      })
      toast.success('Password changed successfully!')
      
      // Reset form
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      })
      setPasswordErrors({})
    } catch (err: any) {
      toast.error(err.message || 'Failed to change password')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin mr-2" />
        <span>Loading settings...</span>
      </div>
    )
  }

  return (
    <div className="grid gap-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">
          Manage your profile and security settings
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList>
          <TabsTrigger value="profile">
            <User className="h-4 w-4 mr-2" />
            Profile
          </TabsTrigger>
          <TabsTrigger value="security">
            <Lock className="h-4 w-4 mr-2" />
            Security
          </TabsTrigger>
        </TabsList>

        {/* Profile Tab */}
        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Profile Information</CardTitle>
              <CardDescription>
                Update your personal information and account details
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={profileForm.username}
                    onChange={(e) => setProfileForm(prev => ({ ...prev, username: e.target.value }))}
                    placeholder="Enter your username"
                    disabled={saving}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={profileForm.email}
                    disabled
                    className="bg-muted"
                  />
                  <p className="text-xs text-muted-foreground">
                    Email cannot be changed. Contact support if you need to update your email.
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label>Role</Label>
                  <Input
                    value={currentUser?.role ? currentUser.role.charAt(0).toUpperCase() + currentUser.role.slice(1) : 'User'}
                    disabled
                    className="bg-muted"
                  />
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleUpdateProfile} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Change Password</CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="current-password">Current Password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={passwordForm.current_password}
                    onChange={(e) => {
                      setPasswordForm(prev => ({ ...prev, current_password: e.target.value }))
                      if (passwordErrors.current_password) {
                        setPasswordErrors(prev => ({ ...prev, current_password: '' }))
                      }
                    }}
                    placeholder="Enter your current password"
                    disabled={saving}
                  />
                  {passwordErrors.current_password && (
                    <p className="text-xs text-destructive">{passwordErrors.current_password}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="new-password">New Password</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={passwordForm.new_password}
                    onChange={(e) => {
                      setPasswordForm(prev => ({ ...prev, new_password: e.target.value }))
                      if (passwordErrors.new_password) {
                        setPasswordErrors(prev => ({ ...prev, new_password: '' }))
                      }
                    }}
                    placeholder="Enter your new password"
                    disabled={saving}
                  />
                  {passwordErrors.new_password && (
                    <p className="text-xs text-destructive">{passwordErrors.new_password}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="confirm-password">Confirm New Password</Label>
                  <Input
                    id="confirm-password"
                    type="password"
                    value={passwordForm.confirm_password}
                    onChange={(e) => {
                      setPasswordForm(prev => ({ ...prev, confirm_password: e.target.value }))
                      if (passwordErrors.confirm_password) {
                        setPasswordErrors(prev => ({ ...prev, confirm_password: '' }))
                      }
                    }}
                    placeholder="Confirm your new password"
                    disabled={saving}
                  />
                  {passwordErrors.confirm_password && (
                    <p className="text-xs text-destructive">{passwordErrors.confirm_password}</p>
                  )}
                </div>
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={handleChangePassword} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Changing...
                    </>
                  ) : (
                    <>
                      <Lock className="mr-2 h-4 w-4" />
                      Change Password
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}