import { useAuth } from '../context/AuthContext.jsx'
import Logo from './Logo.jsx'

// Top bar for logged-in pages (shared by every page after login)
export default function Navbar() {
  const { user, logout } = useAuth()

  return (
    <header className="sticky top-0 z-10 bg-linear-to-r from-brand-dark to-brand shadow-lg shadow-brand-dark/20">
      <nav aria-label="Main" className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3 text-white">
        <div className="flex items-center gap-3">
          <Logo className="h-9 w-9 rounded-xl ring-2 ring-white/40" />
          <span className="font-semibold tracking-tight">Image Caption Generator</span>
        </div>

        <div className="flex items-center gap-4">
          <span className="hidden text-sm sm:inline">
            Signed in as <strong className="font-semibold">{user.username}</strong>
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-medium text-white ring-1 ring-white/40 transition hover:bg-white hover:text-brand-dark focus-visible:ring-2 focus-visible:ring-white focus-visible:outline-none"
          >
            Log out
          </button>
        </div>
      </nav>
    </header>
  )
}