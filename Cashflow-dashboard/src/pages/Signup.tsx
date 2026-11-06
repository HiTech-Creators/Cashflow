import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Link, useNavigate, useSearchParams } from "react-router-dom"
import { registerWithApi } from "@/lib/auth"
import { Loader2 } from "lucide-react"
import toast from "react-hot-toast"

export default function Signup() {
  const [searchParams] = useSearchParams()
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [invitationToken, setInvitationToken] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const navigate = useNavigate()

  // Extract token from URL and auto-fill (with null safety)
  useEffect(() => {
    const token = searchParams.get('token')
    if (token && token.trim().length > 0) {
      setInvitationToken(token.trim())
      toast.success('Invitation token loaded from email link')
    }
  }, [searchParams])

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()

    // Trim all inputs
    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()
    const trimmedConfirmPassword = confirmPassword.trim()
    const trimmedToken = invitationToken.trim()

    // Comprehensive validation with user-friendly messages
    if (!trimmedUsername) {
      toast.error('Please enter a username')
      return
    }

    if (trimmedUsername.length < 2) {
      toast.error('Username must be at least 2 characters long')
      return
    }

    if (trimmedUsername.length > 20) {
      toast.error('Username must be less than 20 characters')
      return
    }

    if (!trimmedPassword) {
      toast.error('Please enter a password')
      return
    }

    if (trimmedPassword.length < 8) {
      toast.error('Password must be at least 8 characters long')
      return
    }

    if (!trimmedConfirmPassword) {
      toast.error('Please confirm your password')
      return
    }

    if (trimmedPassword !== trimmedConfirmPassword) {
      toast.error('Passwords do not match. Please check and try again.')
      return
    }

    if (!trimmedToken) {
      toast.error('Please enter your invitation token')
      return
    }

    setIsLoading(true)

    try {
      const success = await registerWithApi({
        username: trimmedUsername,
        password: trimmedPassword,
        invitation_token: trimmedToken,
      })

      if (success) {
        // Redirect to login page after successful registration
        navigate('/login', {
          state: { message: 'Registration successful! Please log in with your credentials.' }
        })
      }
    } catch (error) {
      // Error handling is done in the auth function via toast
      console.error('Registration error:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <section className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>Get started with a free account</CardDescription>
          </CardHeader>
          <CardContent>
            
            <form onSubmit={handleSubmit} className="grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="Choose a username (2-20 characters)"
                  autoComplete="username"
                  required
                  disabled={isLoading}
                  minLength={2}
                  maxLength={20}
                />
                <p className="text-xs text-muted-foreground">
                  Username must be between 2 and 20 characters
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="confirm">Confirm password</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="new-password"
                  required
                  disabled={isLoading}
                  minLength={8}
                />
                {confirmPassword && password !== confirmPassword && (
                  <p className="text-xs text-red-600 dark:text-red-400">
                    Passwords do not match
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="invitationToken">Invitation Token</Label>
                <Input
                  id="invitationToken"
                  value={invitationToken}
                  onChange={(e) => setInvitationToken(e.target.value)}
                  placeholder="Enter your invitation token"
                  required
                  disabled={isLoading}
                />
                <p className="text-xs text-muted-foreground">
                  {(() => {
                    const token = searchParams.get('token')
                    return token && token.trim().length > 0
                      ? 'Token loaded from email link' 
                      : 'You need an invitation token to create an account'
                  })()}
                </p>
              </div>
              <Button 
                type="submit" 
                className="w-full" 
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating account...
                  </>
                ) : (
                  "Create account"
                )}
              </Button>
              <p className="text-sm text-muted-foreground text-center">
                Already have an account?{" "}
                <Link
                  className="underline"
                  to="/login"
                  onClick={(e) => isLoading && e.preventDefault()}
                >
                  Sign in
                </Link>
              </p>
            </form>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}


