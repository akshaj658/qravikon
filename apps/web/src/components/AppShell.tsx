import { useState, type ReactNode } from 'react';
import { ExternalLink, FolderOpen, Home, LogOut, Settings, ChevronRight } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { cn } from '../lib/utils';
import BrandLogo from './BrandLogo';

export default function AppShell({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);

  async function handleSignOut() {
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(error instanceof Error ? error.message : 'Failed to sign out.');
    }
  }

  return (
    <div className="flex min-h-screen bg-bg-base">
      <aside className="flex w-14 flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface sm:w-52">
        <Link to="/dashboard" aria-label="Qravikon home" className="flex items-center justify-center border-b border-border-subtle px-3 py-4 sm:justify-start sm:px-4">
          <BrandLogo
            compact
            size="small"
            wordmarkClassName="text-sm font-semibold tracking-tight text-text-primary"
          />
        </Link>

        <nav className="flex-1 space-y-0.5 p-2" aria-label="Main navigation">
          {[
            { to: '/dashboard', label: 'Home', icon: Home },
            { to: '/projects', label: 'Projects', icon: FolderOpen },
            { to: '/settings', label: 'Settings', icon: Settings },
          ].map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end
              className={({ isActive }) => cn('nav-item w-full justify-center sm:justify-start', isActive && 'nav-item-active')}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </NavLink>
          ))}
          <Link
            to="/"
            className="nav-item mt-3 w-full justify-center border-t border-border-subtle pt-3 sm:justify-start"
            aria-label="Public site"
            title="Public site"
          >
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            <span className="hidden sm:inline">Public site</span>
          </Link>
        </nav>

        <div className="border-t border-border-subtle p-2">
          {user ? (
            <div className="px-1 py-1.5 sm:px-2">
              <div className="mb-1 hidden truncate text-xs text-text-secondary sm:block" title={user.email}>
                {user.email}
              </div>
              <button
                type="button"
                className="flex w-full items-center justify-center gap-2 text-xs text-text-muted transition-colors hover:text-text-secondary sm:justify-start"
                onClick={() => void handleSignOut()}
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
              {signOutError && <p className="mt-2 text-2xs text-danger" role="alert">{signOutError}</p>}
            </div>
          ) : (
            <Link to="/auth/login" className="nav-item w-full justify-center sm:justify-start" aria-label="Sign in">
              <span className="hidden sm:inline">Sign in</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col">{children}</main>
    </div>
  );
}
