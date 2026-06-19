import { createFileRoute, useRouter, Link } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, ShieldCheck } from 'lucide-react'

import { authClient } from '#/lib/auth-client'
import { Button } from '#/components/ui/button'
import { Input } from '#/components/ui/input'
import { Label } from '#/components/ui/label'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error } = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (error) {
      setError(error.message ?? 'Sign in failed')
      return
    }
    await router.navigate({ to: '/app/dashboard' })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-[-12%] left-[-8%] w-[42%] h-[42%] rounded-full bg-lagoon/20 blur-[110px]" />
        <div className="absolute bottom-[-12%] right-[-8%] w-[42%] h-[42%] rounded-full bg-palm/12 blur-[120px]" />
      </div>

      <div className="w-full max-w-md rise-in">
        <Link
          to="/"
          className="inline-flex items-center text-sm font-medium text-sea-ink-soft hover:text-sea-ink mb-7 transition-colors no-underline"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Link>

        <div className="island-shell rounded-3xl p-8 sm:p-10">
          <div className="mb-8">
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-lagoon to-palm flex items-center justify-center text-white font-bold text-lg mb-6 shadow-sm">
              S
            </div>
            <h1 className="display-title text-3xl font-bold text-sea-ink tracking-tight">Welcome back</h1>
            <p className="text-sea-ink-soft mt-2 text-sm">Sign in to your StoreFlow account to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
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
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sea-ink font-medium">Password</Label>
                <a href="#" className="text-xs font-medium text-lagoon-deep hover:text-lagoon transition-colors no-underline">
                  Forgot password?
                </a>
              </div>
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-11 bg-white/60 border-line focus-visible:ring-lagoon focus-visible:border-lagoon"
              />
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive font-medium">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="btn-ink w-full h-11 text-base font-medium border-0"
              disabled={loading}
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          <p className="text-sm text-center text-sea-ink-soft mt-8">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="font-medium text-lagoon-deep hover:text-lagoon transition-colors no-underline">
              Create an account
            </Link>
          </p>
        </div>

        <p className="flex items-center justify-center gap-1.5 text-xs text-sea-ink-soft mt-6">
          <ShieldCheck className="w-3.5 h-3.5 text-palm" />
          Protected by bank-grade encryption
        </p>
      </div>
    </div>
  )
}
