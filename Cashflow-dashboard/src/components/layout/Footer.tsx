import novatechLogo from "@/assets/logo.png"

export default function Footer() {
  return (
    <footer className="border-t">
      <div className="container mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <img src={novatechLogo} alt="Novatech Logo" className="size-10" />
          <span>© {new Date().getFullYear()} Novatech</span>
        </div>
        <div className="text-sm text-muted-foreground">
          Built with shadcn/ui + Tailwind · <a className="hover:text-foreground underline-offset-4 hover:underline" href="/privacy">Privacy</a>
        </div>
      </div>
    </footer>
  )
}


