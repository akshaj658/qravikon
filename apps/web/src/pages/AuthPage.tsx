import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

interface AuthPageProps {
  mode: 'login' | 'signup' | 'reset';
}

export default function AuthPage({ mode }: AuthPageProps) {
  const { signIn, signUp, resetPassword, configured, authError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const title = mode === 'login' ? 'Sign in to Qravikon' : mode === 'signup' ? 'Create your account' : 'Reset password';
  const subtitle = mode === 'login'
    ? "Don't have an account?"
    : mode === 'signup'
    ? 'Already have an account?'
    : 'Remember your password?';
  const altLink = mode === 'login' ? '/auth/signup' : '/auth/login';
  const altLabel = mode === 'login' ? 'Sign up' : 'Sign in';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setLoading(true);

    try {
      if (mode === 'reset') {
        const { error } = await resetPassword(email);
        if (error) { setError(error); }
        else { setSuccess('Check your email for a password reset link.'); }
      } else if (mode === 'signup') {
        const { error } = await signUp(email, password);
        if (error) { setError(error); }
        else { setSuccess('Account created! Check your email to confirm, then sign in.'); }
      } else {
        const { error } = await signIn(email, password);
        if (error) { setError(error); }
        else { navigate(returnTo, { replace: true }); }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication request failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg-base flex flex-col">
      {/* Nav */}
      <header className="border-b border-border-subtle">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center">
          <Link to="/" className="text-base font-semibold tracking-tight text-text-primary">
            Qravikon
          </Link>
        </div>
      </header>

      <div className="flex-1 flex items-center justify-center px-6 py-16">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
          className="w-full max-w-sm"
        >
          <h1 className="text-2xl font-semibold tracking-tight mb-1">{title}</h1>
          <p className="text-sm text-text-muted mb-8">
            {subtitle}{' '}
            <Link to={altLink} state={{ from: returnTo }} className="text-accent hover:text-accent-hover transition-colors">
              {altLabel}
            </Link>
          </p>

          {!configured && (
            <div className="mb-6 p-3 rounded border border-warning/30 bg-warning-subtle flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-warning flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-warning mb-0.5">Authentication not configured</p>
                <p className="text-xs text-text-secondary">
                  Set <code className="font-mono bg-bg-elevated px-1 rounded">VITE_SUPABASE_URL</code> and{' '}
                  <code className="font-mono bg-bg-elevated px-1 rounded">VITE_SUPABASE_ANON_KEY</code> to enable sign in.{' '}
                  <Link to="/project/demo" className="text-accent underline">Explore the demo instead.</Link>
                </p>
              </div>
            </div>
          )}

          {authError && (
            <div className="mb-4 p-3 rounded border border-danger/30 bg-danger-subtle flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger">Could not restore your sign-in session: {authError}</p>
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 rounded border border-danger/30 bg-danger-subtle flex gap-2.5">
              <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 rounded border border-success/30 bg-success-subtle flex gap-2.5">
              <CheckCircle className="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
              <p className="text-sm text-success">{success}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="input"
                placeholder="you@example.com"
                required
                disabled={loading}
                autoComplete="email"
              />
            </div>

            {mode !== 'reset' && (
              <div>
                <label htmlFor="password" className="label">Password</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="input pr-10"
                    placeholder={mode === 'signup' ? 'Min 6 characters' : '••••••••'}
                    required
                    disabled={loading}
                    minLength={mode === 'signup' ? 6 : undefined}
                    autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary transition-colors"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {mode === 'login' && (
                  <div className="mt-1.5 text-right">
                    <Link to="/auth/reset-password" className="text-xs text-text-muted hover:text-text-secondary transition-colors">
                      Forgot password?
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              className="btn-primary w-full justify-center"
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : null}
              {mode === 'login' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
            </button>
          </form>

          {!configured && (
            <div className="mt-6 pt-6 border-t border-border-subtle text-center">
              <Link to="/project/demo" className="btn-secondary w-full justify-center">
                Explore demo without account
              </Link>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
