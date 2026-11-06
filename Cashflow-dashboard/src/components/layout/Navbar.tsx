import { useEffect, useRef } from "react"
import gsap from "gsap"
import { Button } from "@/components/ui/button"
import { Link } from "react-router-dom"
import novatechLogo from "@/assets/logo.png"

export default function Navbar() {
  const navRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    const ctx = gsap.context(() => {
      gsap.from(".nav-item", { y: -12, opacity: 0, duration: 0.6, stagger: 0.06, ease: "power3.out" })
    }, navRef)
    return () => ctx.revert()
  }, [])

  return (
    <header ref={navRef} className="sticky top-0 z-50 backdrop-blur supports-[backdrop-filter]:bg-background/70 border-b">
      <div className="container mx-auto px-4">
        <div className="flex h-16 items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={novatechLogo} alt="Novatech Logo" className="size-10" />
            <span className="font-semibold">Novatech</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm text-muted-foreground">
            <a href="/#features" className="nav-item hover:text-foreground">Features</a>
            <a href="/#pricing" className="nav-item hover:text-foreground">Pricing</a>
            <a href="/#testimonials" className="nav-item hover:text-foreground">Stories</a>
            <a href="/#faq" className="nav-item hover:text-foreground">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost"><Link to="/login">Sign in</Link></Button>
            <Button asChild><Link to="/signup">Get started</Link></Button>
          </div>
        </div>
      </div>
    </header>
  )
}


