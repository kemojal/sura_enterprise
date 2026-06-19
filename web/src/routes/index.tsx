import { createFileRoute, Link } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { gsap } from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import {
  ArrowRight,
  BarChart3,
  Check,
  CreditCard,
  LayoutGrid,
  LineChart,
  Package,
  Receipt,
  ScanLine,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Tags,
  TrendingUp,
  Users,
} from 'lucide-react'
import { getSession } from '#/lib/session'

export const Route = createFileRoute('/')({
  loader: async () => {
    const session = await getSession()
    return { session }
  },
  component: LandingPage,
})

const FEATURES = [
  {
    icon: CreditCard,
    title: 'Point of sale',
    body: 'A checkout your team learns in minutes. Scan, search, split tender, and hold a cart mid-sale to pick up later.',
    tint: 'bg-lagoon/12 text-lagoon-deep',
  },
  {
    icon: Package,
    title: 'Live inventory',
    body: 'Stock counts that move the moment a sale closes. Low-stock alerts before the shelf goes empty, not after.',
    tint: 'bg-palm/12 text-palm',
  },
  {
    icon: Receipt,
    title: 'Receipts, your way',
    body: 'Your logo, your footer, your terms. Print or send a clean receipt that looks like your brand — not ours.',
    tint: 'bg-lagoon/12 text-lagoon-deep',
  },
  {
    icon: Tags,
    title: 'Discounts & VAT',
    body: 'Line or cart-level discounts and tax that computes itself. Compliant totals every time, no spreadsheet math.',
    tint: 'bg-palm/12 text-palm',
  },
  {
    icon: BarChart3,
    title: 'Analytics',
    body: 'Know your best hours, top sellers, and slow stock at a glance. Decisions backed by what actually sold.',
    tint: 'bg-lagoon/12 text-lagoon-deep',
  },
  {
    icon: ShieldCheck,
    title: 'Roles & security',
    body: 'Granular roles for cashiers, managers, and owners. Bank-grade encryption keeps every transaction safe.',
    tint: 'bg-palm/12 text-palm',
  },
]

const STEPS = [
  {
    icon: ScanLine,
    title: 'Scan',
    body: 'Ring items in with a scanner or quick search. Hold a cart mid-sale and pick it back up any time.',
    caption: 'Checkout in seconds',
    tint: 'bg-lagoon/12 text-lagoon-deep',
  },
  {
    icon: ShoppingCart,
    title: 'Sell',
    body: 'Take any tender, apply line or cart discounts and VAT, then print or send a receipt on your brand.',
    caption: 'Tender, tax & receipt',
    tint: 'bg-palm/12 text-palm',
  },
  {
    icon: LineChart,
    title: 'See',
    body: 'Every sale flows into live inventory and analytics — you know what moved the moment it does.',
    caption: 'Live numbers, instantly',
    tint: 'bg-lagoon/12 text-lagoon-deep',
  },
]

const STATS = [
  { num: '2,000+', label: 'shops running daily' },
  { num: '12M+', label: 'sales processed' },
  { num: '99.98%', label: 'uptime, last 12 mo' },
  { num: '< 4 min', label: 'to first sale' },
]

const LOGOS = ['NORTHWIND', 'Maison', 'BAOBAB', 'Greenline', 'Atlas Goods', 'Pearl & Co', 'Vela', 'KIOSK']

function LandingPage() {
  const { session } = Route.useLoaderData()
  const [scrolled, setScrolled] = useState(false)
  const [active, setActive] = useState('')
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Subtle, scroll-driven reveals & micro-interactions (client only)
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    gsap.registerPlugin(ScrollTrigger)

    const ctx = gsap.context(() => {
      // Hero intro — staggered settle on first paint
      gsap.from('[data-hero] > *', {
        y: 18,
        opacity: 0,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.08,
      })

      // Hero scroll-out — fades & drifts up as you leave it behind
      gsap.to('[data-hero]', {
        yPercent: -6,
        opacity: 0.12,
        ease: 'none',
        scrollTrigger: { trigger: '[data-hero]', start: 'top 64', end: '+=460', scrub: true },
      })

      // Top scroll-progress bar — width tracks page progress
      gsap.set('[data-progress]', { scaleX: 0, transformOrigin: 'left center' })
      gsap.to('[data-progress]', {
        scaleX: 1,
        ease: 'none',
        scrollTrigger: { start: 0, end: 'max', scrub: 0.3 },
      })

      // Scrub-tied reveals — progress follows the scrollbar, reverses on the way up
      gsap.utils.toArray<HTMLElement>('[data-reveal]').forEach((el) => {
        gsap.from(el, {
          opacity: 0,
          y: 28,
          ease: 'none',
          scrollTrigger: { trigger: el, start: 'top 90%', end: 'top 64%', scrub: true },
        })
      })

      // Depth parallax — decorative layers drift at their own pace
      gsap.utils.toArray<HTMLElement>('[data-depth]').forEach((el) => {
        const depth = parseFloat(el.getAttribute('data-depth') ?? '1')
        gsap.to(el, {
          yPercent: -14 * depth,
          ease: 'none',
          scrollTrigger: {
            trigger: el.closest('section') ?? el,
            start: 'top bottom',
            end: 'bottom top',
            scrub: true,
          },
        })
      })

      // Pinned story — Scan → Sell → See (desktop only; mobile stays static)
      const mm = gsap.matchMedia()
      mm.add('(min-width: 768px)', () => {
        const steps = gsap.utils.toArray<HTMLElement>('[data-step]')
        const visuals = gsap.utils.toArray<HTMLElement>('[data-step-visual]')
        if (steps.length < 2) return
        gsap.set(steps, { autoAlpha: 0.3 })
        gsap.set(steps[0], { autoAlpha: 1 })
        gsap.set(visuals, { autoAlpha: 0, scale: 0.96, yPercent: 2 })
        gsap.set(visuals[0], { autoAlpha: 1, scale: 1, yPercent: 0 })
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: '[data-pin-wrap]',
            start: 'top top',
            end: '+=' + steps.length * 60 + '%',
            pin: '[data-pin]',
            scrub: 0.5,
            snap: { snapTo: 1 / (steps.length - 1), duration: 0.25, ease: 'power1.inOut' },
          },
        })
        for (let i = 1; i < steps.length; i++) {
          tl.to(steps[i - 1], { autoAlpha: 0.3, duration: 0.5 }, i)
            .to(steps[i], { autoAlpha: 1, duration: 0.5 }, i)
            .to(visuals[i - 1], { autoAlpha: 0, scale: 0.96, yPercent: 2, duration: 0.5 }, i)
            .to(visuals[i], { autoAlpha: 1, scale: 1, yPercent: 0, duration: 0.5 }, i)
        }
      })

      // Preview chart bars grow from the baseline once the mock is in view
      gsap.set('[data-bar]', { scaleY: 0, transformOrigin: 'bottom' })
      gsap.to('[data-bar]', {
        scaleY: 1,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.04,
        scrollTrigger: { trigger: '[data-parallax]', start: 'top 80%', once: true },
      })

      // Whisper-soft parallax on the product preview
      gsap.to('[data-parallax]', {
        yPercent: -5,
        ease: 'none',
        scrollTrigger: {
          trigger: '[data-parallax]',
          start: 'top bottom',
          end: 'bottom top',
          scrub: 0.6,
        },
      })

      // Count-up on the stats band
      const fmt = (n: number, decimals: number, comma: boolean) => {
        const s = decimals ? n.toFixed(decimals) : Math.round(n).toString()
        return comma
          ? Number(s).toLocaleString('en-US', {
              minimumFractionDigits: decimals,
              maximumFractionDigits: decimals,
            })
          : s
      }
      gsap.utils.toArray<HTMLElement>('[data-count]').forEach((el) => {
        const raw = el.getAttribute('data-count') || el.textContent || ''
        const match = raw.match(/[\d.,]+/)
        if (!match) return
        const numStr = match[0]
        const prefix = raw.slice(0, match.index)
        const suffix = raw.slice((match.index ?? 0) + numStr.length)
        const comma = numStr.includes(',')
        const decimals = numStr.includes('.') ? numStr.split('.')[1].length : 0
        const target = parseFloat(numStr.replace(/,/g, ''))
        const obj = { v: 0 }
        el.textContent = prefix + fmt(0, decimals, comma) + suffix
        gsap.to(obj, {
          v: target,
          duration: 1.5,
          ease: 'power2.out',
          scrollTrigger: { trigger: el, start: 'top 92%', once: true },
          onUpdate: () => {
            el.textContent = prefix + fmt(obj.v, decimals, comma) + suffix
          },
        })
      })
    }, rootRef)

    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const ids = ['features', 'customers', 'pricing']
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) if (e.isIntersecting) setActive(e.target.id)
      },
      { rootMargin: '-45% 0px -50% 0px' },
    )
    for (const id of ids) {
      const el = document.getElementById(id)
      if (el) obs.observe(el)
    }
    return () => obs.disconnect()
  }, [])

  const navLinks = [
    { href: '#features', id: 'features', label: 'Features', icon: LayoutGrid },
    { href: '#customers', id: 'customers', label: 'Customers', icon: Users },
    { href: '#pricing', id: 'pricing', label: 'Pricing', icon: Tag },
  ]

  return (
    <div ref={rootRef} className="min-h-screen flex flex-col">
      <div
        data-progress
        className="fixed top-0 left-0 right-0 h-[2px] z-[60] bg-gradient-to-r from-lagoon to-palm origin-left"
        style={{ transform: 'scaleX(0)' }}
        aria-hidden
      />
      <header className="fixed top-3 sm:top-4 inset-x-0 z-50 px-4">
        <div
          className={`mx-auto max-w-5xl h-14 pl-4 pr-3 flex items-center justify-between rounded-2xl border transition-all duration-300 ${
            scrolled
              ? 'border-line bg-surface-strong/85 backdrop-blur-xl shadow-[0_8px_24px_-16px_rgba(23,58,64,0.16)]'
              : 'border-transparent bg-surface-strong/55 backdrop-blur-md shadow-[0_4px_16px_-16px_rgba(23,58,64,0.12)]'
          }`}
        >
          <Link to="/" className="flex items-center gap-2.5 no-underline group">
            <div className="w-8 h-8 rounded-[10px] bg-gradient-to-br from-lagoon to-palm flex items-center justify-center text-white font-bold shadow-sm transition-transform group-hover:scale-105">
              S
            </div>
            <span className="font-semibold text-[17px] tracking-tight text-sea-ink">StoreFlow</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1 absolute left-1/2 -translate-x-1/2">
            {navLinks.map((l) => (
              <a
                key={l.href}
                href={l.href}
                className="rounded-lg px-3.5 py-2 text-sm font-medium text-sea-ink-soft no-underline transition-colors hover:text-sea-ink hover:bg-sea-ink/[0.05]"
              >
                {l.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-1.5">
            {session ? (
              <Link
                to="/app/dashboard"
                className="btn-ink inline-flex h-9 items-center justify-center rounded-lg px-4 text-sm font-medium no-underline"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  className="hidden sm:inline-flex h-9 items-center rounded-lg px-3.5 text-sm font-medium text-sea-ink no-underline transition-colors hover:bg-sea-ink/[0.05]"
                >
                  Sign in
                </Link>
                <Link
                  to="/register"
                  className="btn-ink group inline-flex h-9 items-center justify-center rounded-lg pl-4 pr-3.5 text-sm font-medium no-underline"
                >
                  Get started
                  <ArrowRight className="ml-1 h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 pt-32 pb-16">
        <div className="page-wrap">
          {/* Hero */}
          <div data-hero className="max-w-3xl mx-auto text-center space-y-7">
            <div className="flex justify-center">
              <span className="eyebrow-pill">
                <Sparkles className="w-3.5 h-3.5 text-lagoon-deep" />
                Held sales &amp; VAT-ready receipts are here
              </span>
            </div>
            <h1 className="display-title text-[2.75rem] sm:text-6xl md:text-7xl font-bold tracking-tight text-sea-ink leading-[1.04]">
              Run your shop,<br className="hidden sm:block" />
              <span className="text-aurora">not your software.</span>
            </h1>
            <p className="text-lg md:text-xl text-sea-ink-soft max-w-2xl mx-auto leading-relaxed">
              StoreFlow is the all-in-one point of sale for modern retail — checkout, inventory,
              receipts, and analytics in one calm, fast place. Open today, sell in minutes.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Link
                to={session ? '/app/dashboard' : '/register'}
                className="btn-ink group inline-flex h-12 items-center justify-center rounded-xl px-7 text-base font-medium no-underline"
              >
                {session ? 'Enter dashboard' : 'Start for free'}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
              <a
                href="#demo"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-7 text-base font-medium text-sea-ink no-underline shadow-sm transition-all hover:bg-surface-strong"
              >
                Book a demo
              </a>
            </div>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-x-5 gap-y-2 pt-3 text-sm text-sea-ink-soft">
              <div className="flex items-center gap-1 text-amber-500">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-4 h-4 fill-current" />
                ))}
              </div>
              <span>
                Rated <span className="font-semibold text-sea-ink">4.9/5</span> by 2,000+ shop owners
              </span>
            </div>
          </div>

          {/* Product preview */}
          <div className="mt-20 max-w-5xl mx-auto rise-in" style={{ animationDelay: '160ms' }}>
            <div className="preview-frame" data-parallax>
              <div className="rounded-2xl overflow-hidden border border-line bg-white">
                {/* window chrome */}
                <div className="h-10 border-b border-line bg-foam/70 flex items-center px-4 gap-2">
                  <span className="w-3 h-3 rounded-full bg-red-400/80" />
                  <span className="w-3 h-3 rounded-full bg-amber-400/80" />
                  <span className="w-3 h-3 rounded-full bg-green-400/80" />
                  <div className="ml-4 h-5 w-64 rounded-md bg-sea-ink/5" />
                </div>
                <div className="flex">
                  {/* sidebar */}
                  <aside className="hidden sm:flex w-44 flex-col gap-1.5 p-3 border-r border-line bg-foam/40">
                    {['Dashboard', 'Sell', 'Inventory', 'Sales', 'Customers', 'Settings'].map((item, i) => (
                      <div
                        key={item}
                        className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm ${
                          i === 0 ? 'bg-sea-ink text-white font-medium' : 'text-sea-ink-soft'
                        }`}
                      >
                        <span className={`w-3.5 h-3.5 rounded ${i === 0 ? 'bg-white/80' : 'bg-sea-ink/15'}`} />
                        {item}
                      </div>
                    ))}
                  </aside>
                  {/* main panel */}
                  <div className="flex-1 p-5 bg-gradient-to-br from-foam/40 to-white">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <p className="text-xs text-sea-ink-soft">Good morning, Kemo</p>
                        <p className="display-title text-lg font-bold text-sea-ink">Today at a glance</p>
                      </div>
                      <div className="h-8 w-24 rounded-lg bg-gradient-to-br from-lagoon to-palm" />
                    </div>
                    {/* stat cards */}
                    <div className="grid grid-cols-3 gap-3 mb-4">
                      {[
                        { k: 'Revenue', v: '$4,820', d: '+12%' },
                        { k: 'Sales', v: '186', d: '+8%' },
                        { k: 'Avg. cart', v: '$25.91', d: '+3%' },
                      ].map((c) => (
                        <div key={c.k} className="rounded-xl border border-line bg-white p-3 shadow-sm">
                          <p className="text-[11px] text-sea-ink-soft">{c.k}</p>
                          <p className="display-title text-xl font-bold text-sea-ink mt-0.5">{c.v}</p>
                          <p className="inline-flex items-center gap-0.5 text-[11px] font-medium text-palm mt-1">
                            <TrendingUp className="w-3 h-3" /> {c.d}
                          </p>
                        </div>
                      ))}
                    </div>
                    {/* chart */}
                    <div className="rounded-xl border border-line bg-white p-4 shadow-sm">
                      <div className="flex items-end gap-2 h-28">
                        {[42, 58, 35, 70, 52, 88, 64, 95, 76, 60, 82, 48].map((h, i) => (
                          <div
                            key={i}
                            data-bar
                            className="flex-1 rounded-t-md bg-gradient-to-t from-lagoon/30 to-lagoon"
                            style={{ height: `${h}%` }}
                          />
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Logo marquee */}
          <div className="mt-20" id="customers">
            <p className="text-center island-kicker mb-7">Powering modern retail everywhere</p>
            <div className="marquee overflow-hidden">
              <div className="marquee-track gap-14 pr-14">
                {[...LOGOS, ...LOGOS].map((name, i) => (
                  <span
                    key={i}
                    className="display-title text-xl font-bold text-sea-ink/35 whitespace-nowrap tracking-tight"
                  >
                    {name}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Stats band */}
          <div className="mt-24 max-w-5xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-px rounded-2xl overflow-hidden border border-line island-shell">
            {STATS.map((s) => (
              <div key={s.label} data-reveal className="p-7 text-center">
                <p className="stat-num text-3xl md:text-4xl text-sea-ink" data-count={s.num}>
                  {s.num}
                </p>
                <p className="text-sm text-sea-ink-soft mt-1.5">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Features */}
          <section id="features" className="mt-32 max-w-6xl mx-auto">
            <div data-reveal className="max-w-2xl mx-auto text-center mb-14">
              <p className="island-kicker mb-3">Everything behind the counter</p>
              <h2 className="display-title text-3xl md:text-5xl font-bold text-sea-ink tracking-tight">
                One platform for the whole shop
              </h2>
              <p className="text-lg text-sea-ink-soft mt-4">
                From the first scan to the month-end report, StoreFlow handles the busywork so you
                can stay with your customers.
              </p>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((f) => (
                <div
                  key={f.title}
                  data-reveal
                  className="feature-card rounded-2xl p-7 border border-line"
                >
                  <div className={`w-11 h-11 rounded-xl flex items-center justify-center mb-5 ${f.tint}`}>
                    <f.icon className="w-5 h-5" />
                  </div>
                  <h3 className="text-lg font-bold text-sea-ink mb-2">{f.title}</h3>
                  <p className="text-sea-ink-soft leading-relaxed text-[15px]">{f.body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Pinned story — Scan / Sell / See */}
          <section data-pin-wrap id="how" className="relative mt-32">
            <div data-pin className="flex items-center min-h-[78vh] md:min-h-screen">
              <div className="page-wrap w-full grid md:grid-cols-2 gap-10 lg:gap-16 items-center">
                <div>
                  <p className="island-kicker mb-3">How it works</p>
                  <h2 className="display-title text-3xl md:text-5xl font-bold text-sea-ink tracking-tight mb-9">
                    Three taps from <span className="text-aurora">open to insight</span>
                  </h2>
                  <div className="space-y-7">
                    {STEPS.map((s, i) => (
                      <div data-step key={s.title} className="flex gap-4 items-start">
                        <span className="stat-num text-2xl text-lagoon-deep w-9 flex-shrink-0 pt-0.5">
                          0{i + 1}
                        </span>
                        <div>
                          <h3 className="text-xl font-bold text-sea-ink">{s.title}</h3>
                          <p className="text-sea-ink-soft mt-1 max-w-sm leading-relaxed">{s.body}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="relative aspect-[4/3] hidden md:block">
                  {STEPS.map((s) => (
                    <div
                      data-step-visual
                      key={s.title}
                      className="absolute inset-0 island-shell rounded-3xl flex flex-col items-center justify-center gap-5 text-center px-8"
                    >
                      <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${s.tint}`}>
                        <s.icon className="w-9 h-9" />
                      </div>
                      <p className="display-title text-2xl font-bold text-sea-ink">{s.title}</p>
                      <p className="text-sea-ink-soft text-sm">{s.caption}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>

          {/* Testimonial */}
          <section className="mt-32 max-w-3xl mx-auto text-center">
            <div data-reveal className="flex justify-center gap-1 text-amber-500 mb-6">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-5 h-5 fill-current" />
              ))}
            </div>
            <blockquote data-reveal className="display-title text-2xl md:text-3xl font-medium text-sea-ink leading-snug">
              “We switched three locations to StoreFlow in a weekend. Checkout is faster, stock
              finally matches the shelf, and my receipts look like a real brand. It just works.”
            </blockquote>
            <div data-reveal className="mt-7 flex items-center justify-center gap-3">
              <div className="w-11 h-11 rounded-full bg-gradient-to-br from-lagoon to-palm" />
              <div className="text-left">
                <p className="font-semibold text-sea-ink">Amina Yusuf</p>
                <p className="text-sm text-sea-ink-soft">Owner, Pearl &amp; Co — 3 stores</p>
              </div>
            </div>
          </section>

          {/* CTA */}
          <section id="pricing" className="mt-32 max-w-5xl mx-auto">
            <div className="island-shell rounded-3xl px-8 py-14 sm:px-16 text-center relative overflow-hidden">
              <div data-depth="1.4" className="absolute -top-24 -right-24 w-72 h-72 rounded-full bg-lagoon/15 blur-3xl pointer-events-none" />
              <div data-depth="-1" className="absolute -bottom-24 -left-24 w-72 h-72 rounded-full bg-palm/12 blur-3xl pointer-events-none" />
              <div data-reveal className="relative">
                <h2 className="display-title text-3xl md:text-5xl font-bold text-sea-ink tracking-tight">
                  Open your shop on StoreFlow today
                </h2>
                <p className="text-lg text-sea-ink-soft mt-4 max-w-xl mx-auto">
                  Free for 14 days. No card required. Keep your data if you leave — it&apos;s always yours.
                </p>
                <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
                  <Link
                    to={session ? '/app/dashboard' : '/register'}
                    className="btn-ink group inline-flex h-12 items-center justify-center rounded-xl px-7 text-base font-medium no-underline"
                  >
                    {session ? 'Enter dashboard' : 'Start for free'}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </Link>
                  <a
                    href="#demo"
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-line bg-surface px-7 text-base font-medium text-sea-ink no-underline shadow-sm transition-all hover:bg-surface-strong"
                  >
                    Talk to sales
                  </a>
                </div>
                <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-sea-ink-soft">
                  {['No setup fees', 'Cancel anytime', '24/7 support'].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5">
                      <Check className="w-4 h-4 text-palm" /> {t}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {/* iOS-style liquid-glass bottom tabs (mobile only) */}
      <nav className="md:hidden tabbar-fixed fixed inset-x-0 z-50 flex justify-center px-4 pointer-events-none">
        <div className="liquid-glass pointer-events-auto flex items-center gap-1 rounded-[26px] p-1.5">
          {navLinks.map((l) => {
            const isActive = active === l.id
            return (
              <a
                key={l.id}
                href={l.href}
                aria-current={isActive ? 'page' : undefined}
                className="relative flex flex-col items-center gap-0.5 rounded-[20px] px-5 py-1.5 no-underline"
              >
                {isActive && (
                  <span className="absolute inset-0 rounded-[20px] bg-sea-ink/[0.06]" aria-hidden />
                )}
                <l.icon
                  className={`relative w-[22px] h-[22px] transition-colors ${
                    isActive ? 'text-lagoon-deep' : 'text-sea-ink-soft'
                  }`}
                  strokeWidth={isActive ? 2.4 : 2}
                />
                <span
                  className={`relative text-[10.5px] font-semibold tracking-tight transition-colors ${
                    isActive ? 'text-sea-ink' : 'text-sea-ink-soft'
                  }`}
                >
                  {l.label}
                </span>
              </a>
            )
          })}
        </div>
      </nav>

      <footer className="site-footer pt-14 pb-28 md:pb-10 mt-28">
        <div className="page-wrap">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 pb-10">
            <div className="col-span-2 md:col-span-2">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-lagoon to-palm flex items-center justify-center text-white font-bold text-sm">
                  S
                </div>
                <span className="font-semibold text-sea-ink">StoreFlow</span>
              </div>
              <p className="text-sm text-sea-ink-soft max-w-xs leading-relaxed">
                The point of sale built for modern, independent retail. Sell anywhere, see everything.
              </p>
            </div>
            {[
              { h: 'Product', items: ['Features', 'Pricing', 'Changelog', 'Roadmap'] },
              { h: 'Company', items: ['About', 'Customers', 'Careers', 'Contact'] },
              { h: 'Resources', items: ['Docs', 'Support', 'Status', 'Privacy'] },
            ].map((col) => (
              <div key={col.h}>
                <p className="text-sm font-semibold text-sea-ink mb-3">{col.h}</p>
                <ul className="space-y-2">
                  {col.items.map((it) => (
                    <li key={it}>
                      <a href="#" className="text-sm text-sea-ink-soft hover:text-sea-ink no-underline transition-colors">
                        {it}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="border-t border-line pt-6 flex flex-col sm:flex-row items-center justify-between gap-3">
            <p className="text-sm text-sea-ink-soft">© 2026 StoreFlow Inc. All rights reserved.</p>
            <div className="flex items-center gap-5 text-sm text-sea-ink-soft">
              <a href="#" className="hover:text-sea-ink no-underline transition-colors">Terms</a>
              <a href="#" className="hover:text-sea-ink no-underline transition-colors">Privacy</a>
              <a href="#" className="hover:text-sea-ink no-underline transition-colors">Security</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
