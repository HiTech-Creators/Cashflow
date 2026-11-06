import { cn } from "@/lib/utils"
import { useEffect, useMemo, useRef, useState } from "react"
import gsap from "gsap"

type CarouselProps = {
  items: React.ReactNode[]
  chunkSize?: number
  className?: string
  pageClassName?: string
  autoplay?: boolean
  autoplayDelay?: number
  pauseOnHover?: boolean
}

export function Carousel({ items, chunkSize = 3, className, pageClassName, autoplay = true, autoplayDelay = 4000, pauseOnHover = true }: CarouselProps) {
  const pages = useMemo(() => {
    const chunks: React.ReactNode[][] = []
    for (let i = 0; i < items.length; i += chunkSize) {
      chunks.push(items.slice(i, i + chunkSize))
    }
    return chunks
  }, [items, chunkSize])

  const [page, setPage] = useState(0)
  const trackRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  const totalPages = pages.length || 1

  const goTo = (idx: number) => {
    const clamped = ((idx % totalPages) + totalPages) % totalPages
    setPage(clamped)
  }

  // navigation helpers (currently driven by dots & autoplay)

  useEffect(() => {
    if (!trackRef.current) return
    const amount = totalPages > 0 ? (100 / totalPages) : 100
    gsap.to(trackRef.current, {
      xPercent: -page * amount,
      duration: 0.6,
      ease: "power3.inOut",
    })
  }, [page, totalPages])

  const prefersReducedMotion = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches

  useEffect(() => {
    if (!autoplay || totalPages <= 1 || prefersReducedMotion) return

    const tick = () => {
      if (pausedRef.current) return
      setPage((p) => (p + 1) % totalPages)
    }
    const id = window.setInterval(tick, autoplayDelay)

    const onVis = () => {
      pausedRef.current = document.visibilityState !== "visible"
    }
    document.addEventListener("visibilitychange", onVis)

    return () => {
      window.clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
    }
  }, [autoplay, autoplayDelay, totalPages, prefersReducedMotion])

  return (
    <div
      ref={containerRef}
      className={cn("relative w-full overflow-hidden", className)}
      onMouseEnter={() => { if (pauseOnHover) pausedRef.current = true }}
      onMouseLeave={() => { if (pauseOnHover) pausedRef.current = false }}
    >
      <div
        ref={trackRef}
        className="flex w-full"
        style={{ width: `${totalPages * 100}%` }}
      >
        {pages.map((chunk, idx) => (
          <div key={idx} className={cn("w-full shrink-0", pageClassName)} style={{ width: `${100 / totalPages}%` }}>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 items-stretch">
              {chunk.map((node, i) => (
                <div key={i} className="h-full">{node}</div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-center gap-2">
          
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                aria-label={`Go to slide ${i + 1}`}
                onClick={() => goTo(i)}
                className={cn(
                  "h-1.5 w-6 rounded-full transition-colors",
                  i === page ? "bg-primary" : "bg-border"
                )}
              />
            ))}
          </div>
          
        </div>
      )}
    </div>
  )
}


