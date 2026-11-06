import { ArrowRight, CheckCircle2, Star, TrendingUp, BarChart3, Zap, Shield, Layers, Rocket } from "lucide-react"
import { useEffect, useRef } from "react"
import gsap from "gsap"
import { ScrollTrigger } from "gsap/ScrollTrigger"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
// import { Separator } from "@/components/ui/separator"
import homev2Banner from "@/assets/homev2-banner.webp"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Carousel } from "@/components/Carousel"

function App() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return

    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: "power3.out", duration: 0.8 } })
      tl.from(".nav-item", { y: -12, opacity: 0, stagger: 0.06 })
        .from(".hero-badge", { y: 10, opacity: 0 }, "-=0.4")
        .from(".hero-title", { y: 14, opacity: 0 }, "-=0.5")
        .from(".hero-sub", { y: 12, opacity: 0 }, "-=0.5")
        .from(".hero-ctas > *", { y: 10, opacity: 0, stagger: 0.08 }, "-=0.4")
        .from(".hero-trust", { opacity: 0 }, "-=0.5")
        .from(".hero-image", { y: 16, opacity: 0, scale: 0.98 }, "-=0.6")

      gsap.from("#features .feature-card", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        scrollTrigger: { trigger: "#features", start: "top 80%" },
      })

      gsap.from("#pricing .pricing-card", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        scrollTrigger: { trigger: "#pricing", start: "top 80%" },
      })

      gsap.from("#testimonials .testimonial-card", {
        y: 24,
        opacity: 0,
        duration: 0.6,
        stagger: 0.12,
        scrollTrigger: { trigger: "#testimonials", start: "top 85%" },
      })

      gsap.from("#faq .faq-item", {
        y: 20,
        opacity: 0,
        duration: 0.5,
        stagger: 0.1,
        scrollTrigger: { trigger: "#faq", start: "top 85%" },
      })

      gsap.from(".contact-card, .contact-card input, .contact-card textarea, .contact-card button", {
        y: 16,
        opacity: 0,
        duration: 0.6,
        stagger: 0.08,
        scrollTrigger: { trigger: ".contact-card", start: "top 85%" },
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  return (
    <div ref={rootRef}>
        {/* Hero */}
        <section className="container mx-auto px-4 py-20">
          <div className="grid lg:grid-cols-2 gap-10 items-center">
            <div>
              <Badge className="hero-badge">Introducing Novatech</Badge>
              <h1 className="hero-title mt-4 text-4xl sm:text-5xl font-bold tracking-tight font-display">
                Run your business with clarity and confidence
              </h1>
              <p className="hero-sub mt-4 text-muted-foreground text-lg">
                A unique and powerful software suite to transform the way you work. Designed for businesses of all sizes, built by a company that values your privacy.
              </p>
              <div className="hero-ctas mt-8 flex flex-col sm:flex-row gap-3">
                <Button className="gap-2">
                  Start free trial
                  <ArrowRight className="size-4" />
                </Button>
                <Button variant="outline">Book a demo</Button>
              </div>
              <div className="hero-trust mt-6 flex items-center gap-2 text-sm text-muted-foreground">
                <Star className="size-4 text-yellow-500" />
                <span>Trusted by 2,500+ teams</span>
              </div>
            </div>
            {/* <Card className="p-0">
              <CardHeader>
                <CardTitle>Live Metrics</CardTitle>
                <CardDescription>Today at a glance</CardDescription>
              </CardHeader>
              <Separator />
              <CardContent className="grid sm:grid-cols-3 gap-6 py-6">
                {[
                  { label: "MRR", value: "$84,210", delta: "+4.3%" },
                  { label: "Runway", value: "18.4 mo", delta: "+0.6 mo" },
                  { label: "Churn", value: "1.2%", delta: "-0.2%" },
                ].map((m) => (
                  <div key={m.label}>
                    <div className="text-sm text-muted-foreground">{m.label}</div>
                    <div className="text-2xl font-semibold">{m.value}</div>
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">{m.delta}</div>
                  </div>
                ))}
              </CardContent>
              <Separator />
              <CardFooter className="justify-between">
                <div className="text-sm text-muted-foreground">Forecast updated 3m ago</div>
                <Button size="sm" variant="secondary">Open dashboard</Button>
              </CardFooter>
            </Card> */}
            <div>
              <img src={homev2Banner} alt="Novatech Dashboard" className="hero-image w-full h-full object-cover" />
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="max-w-2xl">
              <h2 className="text-3xl font-bold tracking-tight">Everything you need to scale</h2>
              <p className="mt-2 text-muted-foreground">
                Replace spreadsheets with real-time insights, automated workflows, and accurate projections.
              </p>
            </div>
            <div className="mt-10">
              <Carousel
                items={[
                  { title: "Cashflow Insights", desc: "Understand inflows and outflows with daily breakdowns and alerts." },
                  { title: "Smart Forecasting", desc: "Scenario planning with ML-assisted predictions you can trust." },
                  { title: "Automations", desc: "Trigger tasks, invoices, and reminders from live cash events." },
                  { title: "Integrations", desc: "Connect banking, billing, and data warehouses in minutes." },
                  { title: "Alerts", desc: "Proactive notifications for risks and opportunities." },
                  { title: "Collaboration", desc: "Comments, sharing, and roles for your whole team." },
                ].map((f) => (
                  <Card key={f.title} className="feature-card hover:translate-y-[-4px] transition-transform duration-300">
                    <CardHeader>
                      <CardTitle>{f.title}</CardTitle>
                      <CardDescription>{f.desc}</CardDescription>
                    </CardHeader>
                    <CardContent className="text-sm text-muted-foreground">
                      <div className="feature-icons mb-4 flex flex-wrap gap-2 text-primary/70">
                        <TrendingUp className="size-5" />
                        <BarChart3 className="size-5" />
                        <Zap className="size-5" />
                        <Shield className="size-5" />
                        <Layers className="size-5" />
                        <Rocket className="size-5" />
                      </div>
                      <ul className="space-y-2">
                        {["Fast setup", "Role based access", "Audit ready"].map((i) => (
                          <li key={i} className="flex items-center gap-2">
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            <span>{i}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                ))}
              />
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="container mx-auto px-4 py-20">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-3xl font-bold tracking-tight">Simple pricing</h2>
            <p className="mt-2 text-muted-foreground">Start free, upgrade when you’re ready.</p>
          </div>
          <Tabs defaultValue="starter" className="mt-8 flex flex-col gap-6 items-center justify-center w-full">
            <TabsList>
              <TabsTrigger value="starter">Starter</TabsTrigger>
              <TabsTrigger value="growth">Growth</TabsTrigger>
              <TabsTrigger value="scale">Scale</TabsTrigger>
            </TabsList>
            <div className="mt-6 grid lg:grid-cols-1 gap-6 w-full max-w-2xl mx-auto">
              {[
                { value: "starter", price: "$0", cta: "Get started" },
                { value: "growth", price: "$49", cta: "Start 14-day trial" },
                { value: "scale", price: "$199", cta: "Contact sales" },
              ].map((tier) => (
                <TabsContent key={tier.value} value={tier.value} className="m-0">
                  <Card className="pricing-card">
                    <CardHeader>
                      <CardTitle className="flex items-baseline gap-2">
                        {tier.value.charAt(0).toUpperCase() + tier.value.slice(1)}
                        <Badge variant="secondary">{tier.price}/mo</Badge>
                      </CardTitle>
                      <CardDescription>
                        {tier.value === "starter" && "For individuals and experiments."}
                        {tier.value === "growth" && "For startups finding product-market fit."}
                        {tier.value === "scale" && "For teams with advanced needs."}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {["Unlimited dashboards", "API access", "Email support"].map((b) => (
                          <li key={b} className="flex items-center gap-2">
                            <CheckCircle2 className="size-4 text-emerald-500" />
                            <span>{b}</span>
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                    <CardFooter>
                      <Button className="w-full">{tier.cta}</Button>
                    </CardFooter>
                  </Card>
                </TabsContent>
              ))}
            </div>
          </Tabs>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-bold tracking-tight">Loved by modern teams</h2>
            <div className="mt-8">
              <Carousel
                items={[
                  { quote: "Novatech gives us a live, accurate view of our runway. We ship faster.", name: "Alex Kim", role: "COO, Vertex" },
                  { quote: "Forecasting went from weekly pain to a daily superpower.", name: "Priya Patel", role: "Head of Finance, Blixo" },
                  { quote: "We caught risks earlier and unlocked a whole quarter of runway.", name: "Marcus Lee", role: "CEO, Alto" },
                  { quote: "Setup took 30 minutes and the insights were instant.", name: "Sara Gomez", role: "CFO, Carda" },
                  { quote: "The automations saved our ops hours every week.", name: "Daniel Chen", role: "Ops Lead, Numo" },
                  { quote: "A beautifully designed product that our team actually loves to use.", name: "Emma Davis", role: "PM, Nova" },
                ].map((t, i) => (
                  <Card key={i} className="testimonial-card">
                    <CardContent className="pt-6">
                      <p className="text-sm">“{t.quote}”</p>
                    </CardContent>
                    <CardFooter className="gap-3">
                      <Avatar>
                        <AvatarFallback>{t.name.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="text-sm font-medium">{t.name}</div>
                        <div className="text-xs text-muted-foreground">{t.role}</div>
                      </div>
                    </CardFooter>
                  </Card>
                ))}
              />
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="container mx-auto px-4 py-20">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-bold tracking-tight">Frequently asked questions</h2>
            <p className="mt-2 text-muted-foreground">Quick answers about pricing, security, and setup.</p>
          </div>
          <div className="mt-6 max-w-3xl">
            <Accordion type="single" collapsible className="w-full ">
              <AccordionItem value="item-1" className="faq-item">
                <AccordionTrigger>Is there a free trial?</AccordionTrigger>
                <AccordionContent>Yes, 14 days. No credit card required.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-2" className="faq-item">
                <AccordionTrigger>How secure is Novatech?</AccordionTrigger>
                <AccordionContent>We use industry best practices and regular audits.</AccordionContent>
              </AccordionItem>
              <AccordionItem value="item-3" className="faq-item">
                <AccordionTrigger>Do you offer discounts?</AccordionTrigger>
                <AccordionContent>Annual plans receive two months free.</AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-muted/30 py-20">
          <div className="container mx-auto px-4">
            <div className="grid md:grid-cols-2 gap-8">
              <div>
                <h2 className="text-3xl font-bold tracking-tight">Talk to our team</h2>
                <p className="mt-2 text-muted-foreground">We’ll help you find the best path forward.</p>
              </div>
              <Card className="contact-card">
                <CardContent className="pt-6 grid gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" placeholder="Your full name" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="email">Email</Label>
                    <Input id="email" type="email" placeholder="you@company.com" />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="message">Message</Label>
                    <Textarea id="message" placeholder="Tell us about your needs" rows={4} />
                  </div>
                  <Button className="justify-between">
                    Send message
                    <ArrowRight className="size-4" />
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </section>
    </div>
  )
}

export default App
