import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  CheckCircle,
  Search,
  BarChart3,
  Users,
  Target,
  FileText,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import BrandLogo from '../components/BrandLogo';

const FEATURES = [
  {
    icon: Search,
    title: 'Live competitor research',
    description: 'Real web search surfaces actual competitors, pricing, and customer reviews — not invented information.',
  },
  {
    icon: BarChart3,
    title: 'Interactive market calculator',
    description: 'TAM, SAM, SOM with editable assumptions, instant recalculation, and scenario planning.',
  },
  {
    icon: Users,
    title: 'Customer segment analysis',
    description: 'Identify who actually buys, where to reach them, and how much they\'ll pay.',
  },
  {
    icon: Target,
    title: 'Differentiation strategy',
    description: 'Competitive positioning matrix with 2–3 distinct strategies to choose from.',
  },
  {
    icon: FileText,
    title: 'Exportable final report',
    description: 'GO / PIVOT / DROP verdict with full rationale, risk list, and landing page copy.',
  },
  {
    icon: Sparkles,
    title: 'Project-aware AI copilot',
    description: 'Ask follow-up questions in context. The assistant knows your idea, findings, and sources.',
  },
];

const STAGES = [
  { n: '01', label: 'Idea Clarification' },
  { n: '02', label: 'Problem & Viability' },
  { n: '03', label: 'Target Customer' },
  { n: '04', label: 'Market Sizing' },
  { n: '05', label: 'Competitor Research' },
  { n: '06', label: 'Differentiation' },
  { n: '07', label: 'Go-to-Market' },
  { n: '08', label: 'Final Report' },
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const projectCreationPath = '/projects?create=1';
  const startValidatingState = user ? undefined : { from: projectCreationPath };

  return (
    <div className="min-h-screen bg-bg-base">
      {/* Nav */}
      <header className="sticky top-0 z-50 border-b border-border-subtle bg-bg-base/95 backdrop-blur-sm">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/" aria-label="Qravikon home">
            <BrandLogo />
          </Link>
          <nav className="flex flex-shrink-0 items-center gap-3 sm:gap-6" aria-label="Account navigation">
            {loading ? null : user ? (
              <Link to="/projects" className="btn-primary btn-sm whitespace-nowrap">Open Workspace</Link>
            ) : (
              <>
                <Link to="/auth/login" className="inline-flex min-h-11 items-center px-1 text-sm text-text-secondary transition-colors hover:text-text-primary">
                  Sign in
                </Link>
                <Link to="/auth/signup" className="btn-primary btn-sm whitespace-nowrap">
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-4 pb-14 pt-16 sm:px-6 sm:pb-20 sm:pt-24">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          <div className="mb-6 inline-flex items-center gap-2 rounded border border-accent/30 bg-accent-subtle px-2.5 py-1 text-xs font-medium text-accent sm:mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-slow" />
            Eight-stage validation workflow
          </div>

          <h1 className="mb-5 text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-text-primary sm:mb-6 sm:text-5xl">
            Ideas deserve
            <br />
            evidence.
          </h1>

          <p className="mb-7 max-w-2xl text-lg leading-relaxed text-text-secondary sm:mb-10 sm:text-xl">
            Qravikon turns a startup idea into a structured, evidence-backed business assessment.
            Real research. Honest AI analysis. A verdict you can trust.
          </p>

          <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
            {loading ? (
              <button type="button" className="btn-primary btn-lg" disabled>Loading…</button>
            ) : (
              <Link
                to={user ? projectCreationPath : '/auth/signup'}
                state={startValidatingState}
                className="btn-primary btn-lg justify-center sm:justify-start"
              >
                Start validating
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link to="/project/demo" className="btn-secondary btn-lg justify-center sm:justify-start">
              Explore demo
            </Link>
          </div>
        </motion.div>
      </section>

      {/* App preview */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.15, ease: 'easeOut' }}
          className="relative rounded-lg border border-border-default overflow-hidden shadow-lg"
        >
          {/* Browser chrome */}
          <div className="bg-bg-elevated border-b border-border-default px-4 py-3 flex items-center gap-2">
            <div className="flex gap-1.5">
              <span className="w-3 h-3 rounded-full bg-border-muted" />
              <span className="w-3 h-3 rounded-full bg-border-muted" />
              <span className="w-3 h-3 rounded-full bg-border-muted" />
            </div>
            <div className="flex-1 mx-4">
              <div className="bg-bg-base rounded px-3 py-1 text-xs text-text-muted max-w-64 mx-auto text-center">
                qravikon.app/project/smartstock-ai
              </div>
            </div>
          </div>
          {/* Workspace preview */}
          <div className="flex min-h-[300px] bg-bg-base sm:h-[480px] sm:min-h-0">
            {/* Left rail */}
            <div className="hidden w-56 flex-shrink-0 border-r border-border-subtle bg-bg-surface p-4 lg:block">
              <div className="text-xs font-semibold text-text-muted mb-1">SmartStock AI</div>
              <div className="text-2xs text-text-muted mb-4 truncate">Inventory forecasting for SMB retailers</div>
              <div className="space-y-0.5">
                {STAGES.map((s, i) => (
                  <div
                    key={s.n}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs ${
                      i < 5
                        ? 'text-text-secondary'
                        : i === 5
                        ? 'text-text-primary bg-bg-elevated font-medium'
                        : 'text-text-disabled'
                    }`}
                  >
                    {i < 5 ? (
                      <CheckCircle className="w-3 h-3 text-success flex-shrink-0" />
                    ) : i === 5 ? (
                      <div className="w-3 h-3 rounded-full border-2 border-accent flex-shrink-0" />
                    ) : (
                      <div className="w-3 h-3 rounded-full border border-border-muted flex-shrink-0" />
                    )}
                    <span className="truncate">{s.label}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Main area */}
            <div className="min-w-0 flex-1 overflow-hidden p-3 sm:p-6">
              <div className="mb-6">
                <div className="text-2xs text-text-muted mb-1">Stage 06 / 08 — Differentiation</div>
                <h2 className="text-lg font-semibold text-text-primary mb-1">Positioning Strategy</h2>
                <p className="text-sm text-text-secondary">Choose how SmartStock AI differentiates from competitors.</p>
              </div>

              <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { name: 'POS Integration Specialist', tag: 'Recommended', active: true },
                  { name: 'Category Specialist — Grocery', tag: null, active: false },
                ].map((s) => (
                  <div key={s.name} className={`p-3 rounded border ${s.active ? 'border-accent bg-accent-subtle' : 'border-border-default bg-bg-surface'}`}>
                    {s.tag && <div className="badge badge-accent mb-2">{s.tag}</div>}
                    <div className="text-sm font-medium text-text-primary mb-1">{s.name}</div>
                    <div className="flex gap-1">
                      {['low setup', 'marketplace', 'POS-native'].map(t => (
                        <span key={t} className="badge badge-default">{t}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="btn-primary btn-sm">Approve strategy</button>
                <button className="btn-secondary btn-sm">Request revision</button>
                <button className="btn-ghost btn-sm">Skip</button>
              </div>
            </div>

            {/* Right copilot */}
            <div className="hidden w-64 flex-shrink-0 flex-col border-l border-border-subtle bg-bg-surface lg:flex">
              <div className="px-4 py-3 border-b border-border-subtle">
                <div className="text-xs font-medium text-text-primary">Copilot</div>
                <div className="text-2xs text-text-muted">SmartStock AI context</div>
              </div>
              <div className="flex-1 p-3 space-y-3 overflow-hidden">
                <div className="bg-bg-elevated rounded p-2.5">
                  <div className="text-2xs text-text-muted mb-1">You</div>
                  <p className="text-xs text-text-secondary">What's the risk of strategy 1?</p>
                </div>
                <div className="bg-bg-base rounded p-2.5">
                  <div className="mb-1"><BrandLogo size="small" wordmarkClassName="text-2xs font-medium text-accent" /></div>
                  <p className="text-xs text-text-secondary leading-relaxed">
                    The main risk is platform dependency — Square could add inventory forecasting to its core plan…
                  </p>
                </div>
              </div>
              <div className="p-3 border-t border-border-subtle">
                <div className="bg-bg-base rounded border border-border-default px-3 py-2 text-xs text-text-muted">
                  Ask anything about this project…
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mb-8 sm:mb-12">
          <div className="section-label mb-3">What Qravikon does</div>
          <h2 className="text-2xl font-semibold tracking-tight text-text-primary sm:text-3xl">
            Built for honest validation, not hype.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-border-subtle">
          {FEATURES.map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="bg-bg-base p-4 sm:p-6"
            >
              <f.icon className="w-5 h-5 text-accent mb-4" />
              <h3 className="text-sm font-semibold text-text-primary mb-2">{f.title}</h3>
              <p className="text-sm text-text-secondary leading-relaxed">{f.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Workflow strip */}
      <section className="mb-16 border-y border-border-subtle py-10 sm:mb-24 sm:py-12">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="section-label mb-6 text-center sm:mb-8">Eight-stage validation workflow</div>
          <div className="flex flex-wrap justify-center gap-x-3 gap-y-2 sm:gap-3">
            {STAGES.map((s, i) => (
              <div key={s.n} className="flex items-center gap-2">
                <span className="text-2xs font-mono text-text-muted">{s.n}</span>
                <span className="text-sm text-text-secondary">{s.label}</span>
                {i < STAGES.length - 1 && <span className="text-border-muted ml-2">→</span>}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-16 text-center sm:px-6 sm:pb-24">
        <h2 className="mb-4 text-3xl font-semibold tracking-tight text-text-primary sm:text-4xl">
          Stop guessing. Start validating.
        </h2>
        <p className="mx-auto mb-8 max-w-xl text-base text-text-secondary sm:text-lg">
          Your next startup idea deserves more than a napkin sketch.
          Give it structured evidence.
        </p>
        {loading ? (
          <button type="button" className="btn-primary btn-lg" disabled>Loading…</button>
        ) : (
          <Link
            to={user ? projectCreationPath : '/auth/signup'}
            state={startValidatingState}
            className="btn-primary btn-lg"
          >
            Start validating for free
            <ArrowRight className="w-4 h-4" />
          </Link>
        )}
      </section>

      {/* Footer */}
      <footer className="border-t border-border-subtle py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-start gap-4 px-4 text-xs text-text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <BrandLogo size="small" wordmarkClassName="text-xs font-medium text-text-secondary" />
          <span>Ideas deserve evidence.</span>
          <div className="flex flex-wrap gap-x-4 gap-y-2">
            {!loading && (user ? (
              <Link to="/projects" className="hover:text-text-secondary transition-colors">Open Workspace</Link>
            ) : (
              <>
                <Link to="/auth/login" className="hover:text-text-secondary transition-colors">Sign in</Link>
                <Link to="/auth/signup" state={{ from: projectCreationPath }} className="hover:text-text-secondary transition-colors">Get started</Link>
              </>
            ))}
          </div>
        </div>
      </footer>
    </div>
  );
}
