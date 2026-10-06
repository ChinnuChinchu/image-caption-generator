import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import Logo from '../components/Logo.jsx'
import Spinner from '../components/Spinner.jsx'
import { useAuth } from '../context/AuthContext.jsx'

const FEATURES = [
  {
    title: 'AI captions in seconds',
    text: 'Upload a photo and a vision-language model describes it for you.',
  },
  {
    title: 'Make it yours',
    text: 'Edit any caption, or go back to the original with one click.',
  },
  {
    title: 'Hear it read aloud',
    text: 'Built-in text-to-speech makes images accessible to everyone.',
  },
]

const inputClass =
  'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-900 placeholder-slate-400 outline-none transition focus:border-brand focus:ring-4 focus:ring-powder'

function validate(mode, { username, email, password }) {
  if (mode === 'register') {
    const name = username.trim()
    if (name.length < 3) return 'Username must be at least 3 characters.'
    if (name.length > 50) return 'Username must be 50 characters or fewer.'
  }
  if (!/^\S+@\S+\.\S+$/.test(email.trim())) return 'Enter a valid email address.'
  if (mode === 'register') {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (new TextEncoder().encode(password).length > 72) return 'Password is too long (72 bytes maximum).'
  } else if (!password) {
    return 'Enter your password.'
  }
  return ''
}

export default function AuthPage() {
  const { user, login, register } = useAuth()
  const [mode, setMode] = useState('login')
  const [form, setForm] = useState({ username: '', email: '', password: '' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  if (user) return <Navigate to="/" replace />

  const isRegister = mode === 'register'

  const update = (field) => (event) => setForm((f) => ({ ...f, [field]: event.target.value }))

  const switchMode = (next) => {
    setMode(next)
    setError('')
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    const problem = validate(mode, form)
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setSubmitting(true)
    try {
      if (isRegister) {
        await register(form.username.trim(), form.email.trim(), form.password)
      } else {
        await login(form.email.trim(), form.password)
      }
      // on success the user is set and this page redirects to the dashboard
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel (hidden on small screens) */}
      <aside className="relative hidden overflow-hidden bg-linear-to-br from-brand-dark from-45% to-brand p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="pointer-events-none absolute -top-24 -left-24 h-96 w-96 rounded-full bg-moonstone/30 blur-3xl motion-safe:animate-float" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-20 bottom-10 h-80 w-80 rounded-full bg-mint/20 blur-3xl motion-safe:animate-float" aria-hidden="true" />

        <div className="relative flex items-center gap-3">
          <Logo className="h-11 w-11" />
          <span className="text-xl font-semibold tracking-tight">Image Caption Generator</span>
        </div>

        <div className="relative">
          <h1 className="text-4xl leading-tight font-bold xl:text-5xl">
            Every image has a story.
            <br />
            Let AI tell it.
          </h1>
          <ul className="mt-10 space-y-6">
            {FEATURES.map((f) => (
              <li key={f.title} className="flex gap-4">
                <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/20 text-sm" aria-hidden="true">
                  ✓
                </span>
                <div>
                  <p className="font-semibold">{f.title}</p>
                  <p className="text-sm text-powder">{f.text}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-sm text-powder">Built with FastAPI, BLIP and React.</p>
      </aside>

      {/* Form panel */}
      <main className="flex items-center justify-center p-6 sm:p-12">
        <div className="w-full max-w-md motion-safe:animate-fade-up">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <Logo />
            <span className="text-lg font-semibold tracking-tight">Image Caption Generator</span>
          </div>

          <h2 className="text-3xl font-bold tracking-tight">
            {isRegister ? 'Create your account' : 'Welcome back'}
          </h2>
          <p className="mt-2 text-slate-600">
            {isRegister ? 'Start captioning your images in a minute.' : 'Sign in to see your images and captions.'}
          </p>

          <div className="mt-8 grid grid-cols-2 rounded-xl bg-powder/50 p-1" role="tablist" aria-label="Sign in or register">
            {[
              ['login', 'Sign in'],
              ['register', 'Register'],
            ].map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="tab"
                aria-selected={mode === value}
                onClick={() => switchMode(value)}
                className={`rounded-lg py-2 text-sm font-medium transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none ${
                  mode === value ? 'bg-white text-brand-dark shadow' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} noValidate className="mt-6 space-y-5">
            {isRegister && (
              <div>
                <label htmlFor="username" className="mb-1.5 block text-sm font-medium text-slate-700">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  value={form.username}
                  onChange={update('username')}
                  placeholder="username"
                  className={inputClass}
                />
              </div>
            )}

            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-slate-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={update('email')}
                placeholder="you@example.com"
                className={inputClass}
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  value={form.password}
                  onChange={update('password')}
                  placeholder={isRegister ? 'At least 8 characters' : 'Your password'}
                  className={`${inputClass} pr-16`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute inset-y-0 right-0 rounded-r-xl px-4 text-sm font-medium text-brand-dark hover:text-slate-900 focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none"
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            {/* role="alert" makes screen readers announce the error */}
            <div role="alert" className="min-h-6 text-sm text-rose-600">
              {error}
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-linear-to-r from-brand-dark to-brand py-3 font-semibold text-white shadow-lg shadow-brand/30 transition hover:-translate-y-0.5 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:translate-y-0"
            >
              {submitting && <Spinner />}
              {submitting ? 'Please wait…' : isRegister ? 'Create account' : 'Sign in'}
            </button>
          </form>
        </div>
      </main>
    </div>
  )
}