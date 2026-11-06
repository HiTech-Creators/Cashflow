import { Navigate, useLocation } from "react-router-dom"
import { canAccessRoute } from "@/lib/permissions"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { AlertCircle } from "lucide-react"

interface RequireRoleProps {
  children: React.ReactNode
  route: string
  fallback?: React.ReactNode
}

/**
 * Component to protect routes based on user role
 */
export default function RequireRole({ children, route, fallback }: RequireRoleProps) {
  const location = useLocation()
  
  if (!canAccessRoute(route)) {
    if (fallback) {
      return <>{fallback}</>
    }
    
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-destructive" />
                Access Denied
              </CardTitle>
              <CardDescription>
                You don't have permission to access this page.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Please contact your administrator if you believe this is an error.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return <>{children}</>
}

