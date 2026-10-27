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
      <aside className="hidden flex-shrink-0 flex-col border-r border-border-subtle bg-bg-surface md:flex md:w-14 lg:w-52">
        <Link to="/dashboard" aria-label="Qravikon home" className="flex items-center justify-center border-b border-border-subtle px-3 py-4 md:justify-center md:px-2 lg:justify-start lg:px-4">
          <BrandLogo symbolOnly size="small" />
          <span className="ml-2 hidden text-sm font-semibold tracking-tight text-text-primary lg:inline">Qravikon</span>
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
              className={({ isActive }) => cn('nav-item min-h-11 w-full justify-center md:justify-center lg:justify-start', isActive && 'nav-item-active')}
              aria-label={label}
              title={label}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="hidden lg:inline">{label}</span>
            </NavLink>
          ))}
          <Link
            to="/"
            className="nav-item mt-3 min-h-11 w-full justify-center border-t border-border-subtle pt-3 md:justify-center lg:justify-start"
            aria-label="Public site"
            title="Public site"
          >
            <ExternalLink className="h-4 w-4 flex-shrink-0" />
            <span className="hidden lg:inline">Public site</span>
          </Link>
        </nav>

        <div className="border-t border-border-subtle p-2">
          {user ? (
            <div className="px-1 py-1.5 lg:px-2">
              <div className="mb-1 hidden truncate text-xs text-text-secondary lg:block" title={user.email}>
                {user.email}
              </div>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-center gap-2 text-xs text-text-muted transition-colors hover:text-text-secondary lg:justify-start"
                onClick={() => void handleSignOut()}
                aria-label="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden lg:inline">Sign out</span>
              </button>
              {signOutError && <p className="mt-2 text-2xs text-danger" role="alert">{signOutError}</p>}
            </div>
          ) : (
            <Link to="/auth/login" className="nav-item min-h-11 w-full justify-center lg:justify-start" aria-label="Sign in">
              <span className="hidden lg:inline">Sign in</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          )}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col pb-16 md:pb-0">{children}</main>
      <nav
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-border-subtle bg-bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
        aria-label="Main navigation"
      >
        {signOutError && (
          <p className="absolute inset-x-0 bottom-full border-t border-danger/30 bg-bg-surface px-4 py-2 text-center text-xs text-danger" role="alert">
            {signOutError}
          </p>
        )}
        {[
          { to: '/dashboard', label: 'Home', icon: Home },
          { to: '/projects', label: 'Projects', icon: FolderOpen },
          { to: '/settings', label: 'Settings', icon: Settings },
        ].map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            aria-label={label}
            className={({ isActive }) => cn(
              'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[0.65rem] text-text-muted transition-colors hover:text-text-primary',
              isActive && 'text-accent'
            )}
          >
            <Icon className="h-4 w-4" />
            <span>{label}</span>
          </NavLink>
        ))}
        {user ? (
          <button
            type="button"
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[0.65rem] text-text-muted transition-colors hover:text-text-primary"
            onClick={() => void handleSignOut()}
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
            <span>Sign out</span>
          </button>
        ) : (
          <Link
            to="/auth/login"
            aria-label="Sign in"
            className="flex min-h-14 flex-1 flex-col items-center justify-center gap-1 px-1 text-[0.65rem] text-text-muted transition-colors hover:text-text-primary"
          >
            <ChevronRight className="h-4 w-4" />
            <span>Sign in</span>
          </Link>
        )}
      </nav>
    </div>
  );
}
