import { Link, Outlet, useLocation } from "react-router-dom"
import { getCurrentUser, logout, getDefaultCompanyId } from "@/lib/auth"
import { ArrowLeftRight, Banknote, BarChart3, BadgeDollarSign, Brain, Building2, FileText, HandCoins, Home, Landmark, LogOut, PiggyBank, Receipt, Settings, Users, Wallet, Bug, Grid3x3, Calculator, DollarSign, ChevronDown, Package, FileCheck, FileX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, SidebarInput, SidebarSeparator, SidebarMenuSub, SidebarMenuSubItem, SidebarMenuSubButton } from "@/components/ui/sidebar"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { cn } from "@/lib/utils"
import * as React from "react"
import novatechLogo from "@/assets/logo.png"
import CompanySelector from "@/components/CompanySelector"
import CompanySelectionModal from "@/components/CompanySelectionModal"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { canAccessRoute } from "@/lib/permissions"
import { useEffect, useState } from "react"

function Breadcrumbs() {
  const { pathname } = useLocation()
  const path = pathname.replace(/^\/dashboard\/?/, "")
  const parts = path ? path.split("/") : []
  const crumbs = [{ label: "Dashboard", to: "/dashboard" },
    ...parts.map((p, i) => ({
      label: p.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      to: "/dashboard/" + parts.slice(0, i + 1).join("/"),
    })),
  ]
  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((c, i) => (
          <BreadcrumbItem key={c.to}>
            {i < crumbs.length - 1 ? (
              <BreadcrumbLink asChild>
                <Link to={c.to}>{c.label}</Link>
              </BreadcrumbLink>
            ) : (
              <BreadcrumbPage>{c.label}</BreadcrumbPage>
            )}
            {i < crumbs.length - 1 && <BreadcrumbSeparator />}
          </BreadcrumbItem>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}

function AppSidebar() {
  const user = getCurrentUser()
  const location = useLocation()
  const [workingCapitalOpen, setWorkingCapitalOpen] = React.useState(
    location.pathname.startsWith("/dashboard/working-capital") ||
    location.pathname.startsWith("/dashboard/receivables") ||
    location.pathname.startsWith("/dashboard/payables") ||
    location.pathname.startsWith("/dashboard/inventory")
  )
  
  // Overview section items
  const overviewItems = [
    { to: "/dashboard", label: "Dashboard", icon: Grid3x3 },
    { to: "/dashboard/transactions", label: "Transactions", icon: ArrowLeftRight },
    { to: "/dashboard/invoices", label: "Invoices", icon: FileText },
    { to: "/dashboard/forecasting", label: "Forecasts", icon: BarChart3 },
  ]
  
  // Finance section items
  const financeItems = [
    { to: "/dashboard/working-capital", label: "Working Capital", icon: Wallet, hasSubItems: true },
    { to: "/dashboard/budgets", label: "Budgets", icon: PiggyBank },
    { to: "/dashboard/salary-expenses", label: "Payroll", icon: Calculator },
    { to: "/dashboard/bank-reconciliation", label: "Reconciliation", icon: DollarSign },
    { to: "/dashboard/cashflow", label: "Cash Flow", icon: Wallet },
    { to: "/dashboard/drawings", label: "Drawings", icon: PiggyBank },
    { to: "/dashboard/analytics", label: "Analytics", icon: BarChart3 },
    { to: "/dashboard/assistant", label: "AI Assistant", icon: Brain },
    { to: "/dashboard/import-export", label: "Import / Export", icon: ArrowLeftRight },
    { to: "/dashboard/bug-reports", label: "Bug Reports", icon: Bug },
  ]
  
  // Working Capital sub-items
  const workingCapitalSubItems = [
    { to: "/dashboard/receivables", label: "Receivables", icon: FileCheck },
    { to: "/dashboard/payables", label: "Payables", icon: FileX },
    { to: "/dashboard/inventory", label: "Inventory", icon: Package },
  ]
  
  // Administration section items
  const administrationItems = [
    { to: "/dashboard/companies", label: "Company", icon: Building2, roles: ['superadmin'] },
    { to: "/dashboard/users", label: "Team", icon: Users, roles: ['superadmin', 'companyAdmin'] },
    { to: "/dashboard/settings", label: "Settings", icon: Settings },
  ]
  
  // Filter items based on role and permissions
  const overview = overviewItems.filter(item => canAccessRoute(item.to))
  
  const finance = financeItems.filter(item => canAccessRoute(item.to))
  
  const workingCapitalSub = workingCapitalSubItems.filter(item => canAccessRoute(item.to))
  
  const administration = administrationItems.filter(item => {
    if (item.roles) {
      if (!user) return false
      if (item.roles.includes(user.role)) {
        return canAccessRoute(item.to)
      }
      return false
    }
    return canAccessRoute(item.to)
  })
  
  // Check if any working capital sub-item is active
  const isWorkingCapitalActive = location.pathname.startsWith("/dashboard/working-capital") ||
    location.pathname.startsWith("/dashboard/receivables") ||
    location.pathname.startsWith("/dashboard/payables") ||
    location.pathname.startsWith("/dashboard/inventory")
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1.5">
          <img src={novatechLogo} alt="Novatech Logo" className="size-10" />
          <span className="font-semibold group-data-[collapsible=icon]:hidden">FlowBack</span>
        </div>
        <div className="px-2 group-data-[collapsible=icon]:hidden">
          <SidebarInput 
            placeholder="Search…" 
            aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const query = (e.target as HTMLInputElement).value.trim()
                if (query) {
                  // Navigate to transactions page with search query
                  window.location.href = `/dashboard/transactions?search=${encodeURIComponent(query)}`
                }
              }
            }}
          />
        </div>
      </SidebarHeader>
      <SidebarContent>
        {overview.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Overview</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {overview.map((i) => {
                  const active = location.pathname === i.to
                  return (
                    <SidebarMenuItem key={i.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={i.to}>
                          <i.icon />
                          <span>{i.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {finance.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Finance</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {finance.map((i) => {
                  if (i.hasSubItems && i.to === "/dashboard/working-capital") {
                    return (
                      <Collapsible
                        key={i.to}
                        open={workingCapitalOpen}
                        onOpenChange={setWorkingCapitalOpen}
                        asChild
                      >
                        <SidebarMenuItem>
                          <CollapsibleTrigger asChild>
                            <SidebarMenuButton isActive={isWorkingCapitalActive}>
                              <i.icon />
                              <span>{i.label}</span>
                              <ChevronDown className={cn(
                                "ml-auto transition-transform",
                                workingCapitalOpen && "rotate-180"
                              )} />
                            </SidebarMenuButton>
                          </CollapsibleTrigger>
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {workingCapitalSub.map((subItem) => {
                                const subActive = location.pathname === subItem.to
                                return (
                                  <SidebarMenuSubItem key={subItem.to}>
                                    <SidebarMenuSubButton asChild isActive={subActive}>
                                      <Link to={subItem.to}>
                                        <subItem.icon />
                                        <span>{subItem.label}</span>
                                      </Link>
                                    </SidebarMenuSubButton>
                                  </SidebarMenuSubItem>
                                )
                              })}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        </SidebarMenuItem>
                      </Collapsible>
                    )
                  }
                  const active = location.pathname === i.to
                  return (
                    <SidebarMenuItem key={i.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={i.to}>
                          <i.icon />
                          <span>{i.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
        {administration.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>Administration</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {administration.map((i) => {
                  const active = location.pathname === i.to
                  return (
                    <SidebarMenuItem key={i.to}>
                      <SidebarMenuButton asChild isActive={active}>
                        <Link to={i.to}>
                          <i.icon />
                          <span>{i.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>
        <SidebarSeparator className="my-2 group-data-[collapsible=icon]:hidden" />
        <div className="mt-auto p-2">
          <div className="flex items-center gap-2 mb-2 group-data-[collapsible=icon]:hidden">
            <Avatar className="h-7 w-7">
              <AvatarImage src="" alt={user?.username || "User"} />
              <AvatarFallback className="text-white bg-white/10">{(user?.username || "U").slice(0,1).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="text-xs leading-tight">
              <div className="font-medium">{user?.username || user?.name || "User"}</div>
              <div className="text-muted-foreground truncate max-w-[140px]">{user?.email || ""}</div>
            </div>
          </div>
          <Button
            variant="secondary"
            className="w-full group-data-[collapsible=icon]:w-8 group-data-[collapsible=icon]:h-8 group-data-[collapsible=icon]:p-0"
            onClick={() => { logout(); window.location.href = "/" }}
            title="Logout"
          >
            <LogOut className="mr-2 group-data-[collapsible=icon]:mr-0" />
            <span className="group-data-[collapsible=icon]:sr-only">Logout</span>
          </Button>
        </div>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

// (old Section/Item helpers no longer used)

export default function DashboardLayout() {
  const [showCompanyModal, setShowCompanyModal] = useState(false)
  const [hasCheckedCompany, setHasCheckedCompany] = useState(false)

  // Check if company is selected on mount and show modal if not
  useEffect(() => {
    const checkCompany = () => {
      try {
        const defaultCompanyId = getDefaultCompanyId()
        // Show modal if no company is selected (first time user)
        if (!defaultCompanyId || typeof defaultCompanyId !== 'string' || defaultCompanyId.trim() === '') {
          setShowCompanyModal(true)
        } else {
          // Company exists, don't show modal
          setShowCompanyModal(false)
        }
      } catch (error) {
        console.error('Error checking company:', error)
        // If there's an error accessing localStorage, show modal to let user select
        setShowCompanyModal(true)
      } finally {
        setHasCheckedCompany(true)
      }
    }

    // Small delay to ensure localStorage is accessible and components are mounted
    const timer = setTimeout(checkCompany, 150)
    return () => clearTimeout(timer)
  }, [])

  // Listen for company selection changes
  useEffect(() => {
    const handleCompanyChange = () => {
      try {
        const defaultCompanyId = getDefaultCompanyId()
        if (defaultCompanyId && typeof defaultCompanyId === 'string' && defaultCompanyId.trim() !== '') {
          setShowCompanyModal(false)
        }
      } catch (error) {
        console.error('Error handling company change:', error)
      }
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('company-id-changed', handleCompanyChange)
      return () => {
        window.removeEventListener('company-id-changed', handleCompanyChange)
      }
    }
  }, [])

  const handleModalClose = () => {
    // Only close if a company is actually selected
    try {
      const defaultCompanyId = getDefaultCompanyId()
      if (defaultCompanyId && typeof defaultCompanyId === 'string' && defaultCompanyId.trim() !== '') {
        setShowCompanyModal(false)
      }
    } catch (error) {
      console.error('Error closing modal:', error)
    }
  }

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <header className="h-16 border-b flex items-center gap-2 px-4 bg-background/60 backdrop-blur sticky top-0 z-40">
          <SidebarTrigger className="-ml-1" />
          <Separator orientation="vertical" className="mr-2 data-[orientation=vertical]:h-4" />
          <Breadcrumbs />
          <div className="ml-auto flex items-center gap-2">
            
            <CompanySelector />
          </div>
        </header>
        <main className="p-4 bg-gradient-to-br from-slate-50 to-blue-50/30 min-h-screen">
          <Outlet />
        </main>
      </SidebarInset>
      {hasCheckedCompany && showCompanyModal && (
        <CompanySelectionModal 
          open={showCompanyModal} 
          onClose={handleModalClose}
        />
      )}
    </SidebarProvider>
  )
}


