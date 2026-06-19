import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Check } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const PERKS = [
  { h: 'Sell in minutes', b: 'Set up your shop and ring up your first sale the same day.' },
  { h: 'Inventory that stays honest', b: 'Stock updates the moment a sale closes — no manual counts.' },
  { h: 'Receipts on your brand', b: 'Your logo, your footer, VAT-ready and ready to print.' },
]

function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await authClient.signUp.email({ name, email, password })
    setLoading(false)
    if (error) {
      setError(error.message ?? 'Registration failed')
      return
    }
    await router.navigate({ to: '/app/setup' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-lagoon/15 blur-[120px]" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-palm/12 blur-[100px]" />
      </div>

      <div className="w-full max-w-5xl flex flex-col md:flex-row gap-12 lg:gap-20 items-center rise-in">
        {/* Left: value props */}
        <div className="flex-1 hidden md:flex flex-col">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-sea-ink-soft hover:text-sea-ink mb-12 transition-colors no-underline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>

          <div className="flex items-center gap-2.5 mb-7">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-lagoon to-palm flex items-center justify-center text-white font-bold shadow-sm">
              S
            </div>
            <span className="font-semibold text-lg tracking-tight text-sea-ink">StoreFlow</span>
          </div>

          <h1 className="display-title text-4xl lg:text-5xl font-bold text-sea-ink leading-[1.08] tracking-tight">
            Start selling in
            <br />
            <span className="text-aurora">minutes, not days.</span>
          </h1>
          <p className="text-lg text-sea-ink-soft mt-4 max-w-md leading-relaxed">
            Join 2,000+ shops running checkout, inventory, and receipts on one calm, fast platform.
          </p>

          <div className="space-y-5 pt-9">
            {PERKS.map((p) => (
              <div key={p.h} className="flex items-start gap-3.5">
                <span className="mt-0.5 w-6 h-6 rounded-full bg-palm/12 flex items-center justify-center flex-shrink-0">
                  <Check className="w-3.5 h-3.5 text-palm" />
                </span>
                <div>
                  <h3 className="font-semibold text-sea-ink">{p.h}</h3>
                  <p className="text-sea-ink-soft text-sm mt-0.5">{p.b}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-10 flex items-center gap-3 border-t border-line pt-6 max-w-md">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-lagoon to-palm flex-shrink-0" />
            <p className="text-sm text-sea-ink-soft italic">
              “Set up three locations in a weekend. It just works.”
              <span className="block not-italic font-medium text-sea-ink mt-0.5">Amina Y. — Pearl &amp; Co</span>
            </p>
          </div>
        </div>

        {/* Right: form */}
        <div className="w-full max-w-md flex-shrink-0">
          <Link
            to="/"
            className="md:hidden inline-flex items-center text-sm font-medium text-sea-ink-soft hover:text-sea-ink mb-6 transition-colors no-underline"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to home
          </Link>

          <div className="island-shell rounded-3xl p-8 sm:p-10">
            <div className="mb-8">
              <h2 className="display-title text-2xl font-bold text-sea-ink tracking-tight">Create your account</h2>
              <p className="text-sea-ink-soft mt-2 text-sm">Free 14-day trial. No card required.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-sea-ink font-medium">Full name</Label>
                <Input
                  id="name"
                  type="text"
                  autoComplete="name"
                  placeholder="Jane Doe"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="h-11 bg-white/60 border-line focus-visible:ring-lagoon focus-visible:border-lagoon"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sea-ink font-medium">Email address</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="name@company.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 bg-white/60 border-line focus-visible:ring-lagoon focus-visible:border-lagoon"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sea-ink font-medium">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 bg-white/60 border-line focus-visible:ring-lagoon focus-visible:border-lagoon"
                />
                <p className="text-xs text-sea-ink-soft mt-1.5">Must be at least 8 characters long.</p>
              </div>

              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium">
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="btn-ink w-full h-11 text-base font-medium border-0 mt-2"
                disabled={loading}
              >
                {loading ? 'Creating account…' : 'Create account'}
              </Button>
            </form>

            <p className="text-xs text-center text-sea-ink-soft mt-5 leading-relaxed">
              By creating an account you agree to our{' '}
              <a href="#" className="text-lagoon-deep hover:text-lagoon no-underline">Terms</a> and{' '}
              <a href="#" className="text-lagoon-deep hover:text-lagoon no-underline">Privacy Policy</a>.
            </p>

            <p className="text-sm text-center text-sea-ink-soft mt-6 border-t border-line pt-6">
              Already have an account?{' '}
              <Link to="/login" className="font-medium text-lagoon-deep hover:text-lagoon transition-colors no-underline">
                Sign in instead
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
