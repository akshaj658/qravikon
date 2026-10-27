import { useEffect, useState } from 'react';
import { AlertCircle, CheckCircle, KeyRound, UserRound } from 'lucide-react';
import AppShell from '../components/AppShell';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export default function SettingsPage() {
  const { user, resetPassword } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingEmail, setSavingEmail] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      if (!user || !supabase) {
        setError('Profile settings are unavailable because Supabase authentication is not configured.');
        setLoadingProfile(false);
        return;
      }
      setLoadingProfile(true);
      setError(null);
      try {
        const { data, error: profileError } = await supabase
          .from('profiles')
          .select('display_name')
          .eq('id', user.id)
          .maybeSingle();
        if (profileError) throw profileError;
        if (active) {
          setDisplayName(data?.display_name ?? user.user_metadata?.full_name ?? '');
          setEmail(user.email ?? '');
          if (!data) setError('Your profile record is missing. Profile changes cannot be saved until the account profile is restored.');
        }
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Failed to load your profile.');
      } finally {
        if (active) setLoadingProfile(false);
      }
    }
    void loadProfile();
    return () => { active = false; };
  }, [user]);

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    if (!user || !supabase || savingProfile) return;
    const name = displayName.trim();
    if (name.length > 100) {
      setError('Your name must be 100 characters or fewer.');
      return;
    }
    setSavingProfile(true);
    setError(null);
    setNotice(null);
    try {
      const { data, error: saveError } = await supabase
        .from('profiles')
        .update({ display_name: name || null, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select('id')
        .maybeSingle();
      if (saveError) throw saveError;
      if (!data) throw new Error('No profile was updated. Confirm that your profile exists and your session is valid.');
      setNotice('Profile saved.');
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Failed to save profile.');
    } finally {
      setSavingProfile(false);
    }
  }

  async function requestEmailChange(event: React.FormEvent) {
    event.preventDefault();
    if (!supabase || savingEmail) return;
    const nextEmail = email.trim();
    if (!nextEmail || nextEmail === user?.email) {
      setError('Enter a different valid email address.');
      return;
    }
    setSavingEmail(true);
    setError(null);
    setNotice(null);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ email: nextEmail });
      if (updateError) throw updateError;
      setNotice('A confirmation link was sent if email changes are enabled for your account. Your sign-in email will not change until you confirm it.');
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Could not request an email change.');
    } finally {
      setSavingEmail(false);
    }
  }

  async function sendPasswordReset() {
    if (!user?.email || sendingReset) return;
    setSendingReset(true);
    setError(null);
    setNotice(null);
    try {
      const result = await resetPassword(user.email);
      if (result.error) throw new Error(result.error);
      setNotice('Password reset instructions were requested for your current email address. Check your inbox if email delivery is configured.');
    } catch (resetError) {
      setError(resetError instanceof Error ? resetError.message : 'Could not request password reset.');
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <AppShell>
      <header className="border-b border-border-subtle px-5 py-4 sm:px-7">
        <h1 className="text-base font-semibold text-text-primary">Settings</h1>
        <p className="mt-0.5 text-xs text-text-muted">Manage your profile and account access.</p>
      </header>
      <div className="w-full max-w-3xl flex-1 space-y-5 overflow-auto p-5 sm:p-7">
        {error && <div className="flex items-start gap-2 rounded border border-danger/30 bg-danger-subtle p-3 text-xs text-danger" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{error}</div>}
        {notice && <div className="flex items-start gap-2 rounded border border-success/30 bg-success-subtle p-3 text-xs text-success" role="status"><CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />{notice}</div>}

        <section className="rounded border border-border-default bg-bg-surface p-5">
          <div className="mb-5 flex items-center gap-2">
            <UserRound className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Profile</h2>
              <p className="text-xs text-text-muted">Update the name shown with your account.</p>
            </div>
          </div>
          <form onSubmit={saveProfile} className="space-y-4">
            <div>
              <label className="label" htmlFor="settings-name">Full name</label>
              <input id="settings-name" className="input max-w-lg" value={displayName} onChange={event => setDisplayName(event.target.value)} maxLength={100} disabled={loadingProfile || savingProfile} autoComplete="name" />
            </div>
            <div>
              <label className="label" htmlFor="settings-account-email">Account email</label>
              <input id="settings-account-email" className="input max-w-lg opacity-70" value={user?.email ?? ''} readOnly aria-describedby="account-email-note" />
              <p id="account-email-note" className="mt-1 text-2xs text-text-muted">Email changes require confirmation from your inbox.</p>
            </div>
            <button type="submit" className="btn-primary btn-sm" disabled={loadingProfile || savingProfile || !user}>
              {savingProfile ? 'Saving…' : 'Save profile'}
            </button>
          </form>
        </section>

        <section className="rounded border border-border-default bg-bg-surface p-5">
          <div className="mb-4 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Account security</h2>
              <p className="text-xs text-text-muted">Email and password actions use Supabase Auth.</p>
            </div>
          </div>
          <form onSubmit={requestEmailChange} className="mb-5 flex max-w-xl flex-wrap items-end gap-2">
            <div className="min-w-[220px] flex-1">
              <label className="label" htmlFor="new-account-email">Request email change</label>
              <input id="new-account-email" className="input" type="email" value={email} onChange={event => setEmail(event.target.value)} autoComplete="email" disabled={savingEmail} />
            </div>
            <button type="submit" className="btn-secondary btn-sm" disabled={savingEmail || !user}>{savingEmail ? 'Requesting…' : 'Send confirmation'}</button>
          </form>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle pt-4">
            <div>
              <p className="text-xs font-medium text-text-primary">Password</p>
              <p className="mt-0.5 text-2xs text-text-muted">Request a reset link for your current account email.</p>
            </div>
            <button type="button" className="btn-secondary btn-sm" onClick={() => void sendPasswordReset()} disabled={sendingReset || !user?.email}>
              {sendingReset ? 'Sending…' : 'Send password reset link'}
            </button>
          </div>
        </section>

        <p className="text-2xs text-text-disabled">Settings are scoped to your signed-in account. No API keys or access tokens are stored here.</p>
      </div>
    </AppShell>
  );
}
