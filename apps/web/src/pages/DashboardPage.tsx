import { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  MoreHorizontal,
  Trash2,
  Edit2,
  ArrowUpRight,
  Clock,
  AlertCircle,
  FolderOpen,
  SlidersHorizontal,
  Check,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { api, type Project } from '../lib/api';
import AppShell from '../components/AppShell';
import { formatRelativeTime, getProgressPercent, STAGE_LABELS, STAGE_ORDER } from '../lib/utils';

function VerdictBadge({ verdict }: { verdict?: string | null }) {
  if (!verdict) return null;
  const styles = {
    GO: 'badge-success',
    PIVOT: 'badge-warning',
    DROP: 'badge-danger',
  };
  return (
    <span className={`badge ${styles[verdict as keyof typeof styles] ?? 'badge-default'}`}>
      {verdict}
    </span>
  );
}

function ProjectStatusBadge({ status }: { status: Project['overall_status'] }) {
  const styles: Record<Project['overall_status'], string> = {
    intake: 'badge-default',
    in_progress: 'badge-accent',
    complete: 'badge-success',
    archived: 'badge-warning',
  };
  const labels: Record<Project['overall_status'], string> = {
    intake: 'Not started',
    in_progress: 'In progress',
    complete: 'Completed',
    archived: 'Archived',
  };
  return <span className={`badge ${styles[status]}`}>{labels[status]}</span>;
}

function StageProgress({ project }: { project: Project }) {
  const stages = project.workflow_stages ?? [];
  const resolvedStages = stages.filter(stage =>
    stage.status === 'approved' || stage.status === 'skipped'
  ).length;
  const pct = stages.length > 0
    ? Math.round((resolvedStages / STAGE_ORDER.length) * 100)
    : getProgressPercent(project.current_stage);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-bg-overlay rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-2xs text-text-muted tabular-nums">{pct}%</span>
    </div>
  );
}

function ProjectCard({
  project,
  onDelete,
  onRename,
}: {
  project: Project;
  onDelete?: (id: string) => void;
  onRename?: (id: string, name: string) => Promise<boolean>;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [newName, setNewName] = useState(project.name);
  const [savingRename, setSavingRename] = useState(false);
  const navigate = useNavigate();
  const projectPath = `/project/${project.id}`;

  const stageLabel = project.current_stage >= STAGE_ORDER.length
    ? 'Workflow complete'
    : STAGE_LABELS[STAGE_ORDER[project.current_stage]] ?? 'Starting…';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      role="link"
      tabIndex={renaming ? -1 : 0}
      onClick={() => !renaming && navigate(projectPath)}
      onKeyDown={event => {
        if (!renaming && event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          navigate(projectPath);
        }
      }}
      className="group relative cursor-pointer rounded-md border border-border-default bg-bg-surface p-4 transition-all duration-150 hover:border-border-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0 pr-4">
          {renaming ? (
            <form
              className="flex gap-1"
              onClick={event => event.stopPropagation()}
              onSubmit={async event => {
                event.preventDefault();
                if (!newName.trim() || savingRename) return;
                setSavingRename(true);
                try {
                  const saved = await onRename?.(project.id, newName.trim());
                  if (saved !== false) setRenaming(false);
                } finally {
                  setSavingRename(false);
                }
              }}
            >
              <input
                className="input h-auto min-w-0 px-1 py-0.5 text-sm font-medium"
                value={newName}
                onChange={event => setNewName(event.target.value)}
                maxLength={100}
                autoFocus
                aria-label={`Rename ${project.name}`}
                disabled={savingRename}
              />
              <button type="submit" className="btn-ghost btn-sm px-1.5" aria-label="Save project name" disabled={savingRename || !newName.trim()}><Check className="h-3.5 w-3.5" /></button>
              <button type="button" className="btn-ghost btn-sm px-1.5" onClick={() => { setNewName(project.name); setRenaming(false); }} aria-label="Cancel rename" disabled={savingRename}><X className="h-3.5 w-3.5" /></button>
            </form>
          ) : (
            <h3 className="text-sm font-semibold text-text-primary truncate">{project.name}</h3>
          )}
          <p className="text-xs text-text-muted mt-0.5 line-clamp-2 leading-relaxed">
            {project.idea_summary || project.original_idea}
          </p>
        </div>

        <div className="relative">
            <button
              id={`project-menu-${project.id}`}
              onClick={event => { event.stopPropagation(); setMenuOpen(!menuOpen); }}
              className="btn-ghost btn-sm p-1 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.1 }}
                  className="absolute right-0 top-8 z-10 bg-bg-elevated border border-border-default rounded-md shadow-md min-w-[140px] py-1"
                  onClick={event => event.stopPropagation()}
                  onMouseLeave={() => setMenuOpen(false)}
                >
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary hover:bg-bg-overlay transition-colors"
                    onClick={() => { setNewName(project.name); setRenaming(true); setMenuOpen(false); }}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Rename
                  </button>
                  <div className="my-1 border-t border-border-subtle" />
                  <button
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-danger hover:bg-danger-subtle transition-colors"
                    onClick={() => { onDelete?.(project.id); setMenuOpen(false); }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
        </div>
      </div>

      <div className="space-y-2.5 mb-4">
        <StageProgress project={project} />
        <div className="flex items-center justify-between">
          <span className="text-2xs text-text-muted">{stageLabel}</span>
          <div className="flex items-center gap-1.5">
            <ProjectStatusBadge status={project.overall_status} />
            <VerdictBadge verdict={project.verdict} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-2xs text-text-disabled">
          <Clock className="w-3 h-3" />
          {formatRelativeTime(project.updated_at)}
        </div>
        <Link
          to={projectPath}
          onClick={event => event.stopPropagation()}
          className="flex items-center gap-1 text-2xs text-accent transition-colors hover:text-accent-hover"
        >
          Open
          <ArrowUpRight className="w-3 h-3" />
        </Link>
      </div>
    </motion.div>
  );
}

function NewProjectModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}) {
  const [name, setName] = useState('');
  const [idea, setIdea] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (!name.trim() || !idea.trim()) return;
    setError(null);
    setLoading(true);
    try {
      const { project } = await api.projects.create({ name: name.trim(), originalIdea: idea.trim() });
      onCreated(project);
      setName('');
      setIdea('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project.');
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 8 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 8 }}
        transition={{ duration: 0.15 }}
        className="relative bg-bg-surface border border-border-default rounded-md shadow-lg w-full max-w-md p-6"
      >
        <h2 className="text-base font-semibold mb-1">New project</h2>
        <p className="text-xs text-text-muted mb-5">Describe your startup idea to get started.</p>

        {error && (
          <div className="mb-4 p-3 rounded border border-danger/30 bg-danger-subtle flex gap-2">
            <AlertCircle className="w-4 h-4 text-danger flex-shrink-0 mt-0.5" />
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        <div className="space-y-4 mb-6">
          <div>
            <label className="label" htmlFor="project-name">Project name</label>
            <input
              id="project-name"
              className="input"
              placeholder="e.g. SmartStock AI"
              value={name}
              onChange={e => setName(e.target.value)}
              disabled={loading}
              maxLength={100}
            />
          </div>
          <div>
            <label className="label" htmlFor="project-idea">Startup idea</label>
            <textarea
              id="project-idea"
              className="textarea h-24"
              placeholder="Describe your idea in 1–3 sentences. What does it do, and for whom?"
              value={idea}
              onChange={e => setIdea(e.target.value)}
              disabled={loading}
              maxLength={5000}
            />
            <p className="text-2xs text-text-disabled mt-1">{idea.length}/5000 characters</p>
          </div>
        </div>

        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onClose} disabled={loading}>
            Cancel
          </button>
          <button
            className="btn-primary"
            onClick={handleCreate}
            disabled={!name.trim() || idea.trim().length < 10 || loading}
            id="create-project-btn"
          >
            {loading ? (
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : null}
            Create project
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function DeleteConfirmModal({
  projectName,
  onConfirm,
  onCancel,
  deleting,
}: {
  projectName: string;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => !deleting && onCancel()} />
      <motion.div
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative bg-bg-surface border border-border-default rounded-md shadow-lg w-full max-w-sm p-6"
      >
        <h2 className="text-base font-semibold mb-1">Delete project?</h2>
        <p className="text-sm text-text-secondary mb-6">
          This will permanently delete <strong>{projectName}</strong>, its findings, sources, and Copilot conversations.
          This cannot be undone.
        </p>
        <div className="flex gap-2 justify-end">
          <button className="btn-secondary" onClick={onCancel} disabled={deleting}>Cancel</button>
          <button className="btn-danger" onClick={onConfirm} id="confirm-delete-btn" disabled={deleting}>{deleting ? 'Deleting…' : 'Delete'}</button>
        </div>
      </motion.div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, configured } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  const [showNewModal, setShowNewModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const isDemo = !configured || !user;

  const loadProjects = useCallback(async () => {
    if (isDemo) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const { projects } = await api.projects.list();
      setProjects(projects);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects.');
    } finally {
      setLoading(false);
    }
  }, [isDemo]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  useEffect(() => {
    if (searchParams.get('create') === '1' && !isDemo) {
      setShowNewModal(true);
      setSearchParams(current => {
        const next = new URLSearchParams(current);
        next.delete('create');
        return next;
      }, { replace: true });
    }
  }, [isDemo, searchParams, setSearchParams]);

  const normalizedSearch = search.trim().toLocaleLowerCase();
  const filtered = projects
    .filter(project => {
      const matchesSearch = project.name.toLocaleLowerCase().includes(normalizedSearch)
        || (project.idea_summary || project.original_idea).toLocaleLowerCase().includes(normalizedSearch);
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'active' && project.overall_status === 'in_progress')
        || project.overall_status === statusFilter;
      return matchesSearch && matchesStatus;
    })
    .sort((left, right) => {
      if (sortBy === 'newest') return Date.parse(right.created_at) - Date.parse(left.created_at);
      if (sortBy === 'name') return left.name.localeCompare(right.name);
      return Date.parse(right.updated_at) - Date.parse(left.updated_at);
    });

  async function handleDelete(id: string) {
    if (deletingId) return;
    setDeletingId(id);
    setError(null);
    try {
      await api.projects.delete(id);
      setProjects(prev => prev.filter(p => p.id !== id));
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete project.');
      setDeleteTarget(null);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRename(id: string, name: string): Promise<boolean> {
    setError(null);
    try {
      const { project } = await api.projects.update(id, { name });
      setProjects(prev => prev.map(p => p.id === id ? project : p));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename project.');
      return false;
    }
  }

  return (
    <AppShell>
        {/* Header */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-subtle px-5 py-4 sm:px-7">
          <div>
            <h1 className="text-base font-semibold text-text-primary">Projects</h1>
            <p className="mt-0.5 text-xs text-text-muted">Manage and continue your startup validation projects.</p>
            {isDemo && (
              <p className="text-xs text-warning mt-0.5">
                Demo mode — sign in to save your work
              </p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-text-muted" />
              <input
                className="input h-8 w-full pl-8 text-xs sm:w-52"
                placeholder="Search projects…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                aria-label="Search projects by name or idea"
              />
            </div>
            {!isDemo && <>
              <label className="flex items-center gap-1.5 text-2xs text-text-muted">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span className="sr-only">Filter projects</span>
                <select className="input h-8 py-1 text-xs" value={statusFilter} onChange={event => setStatusFilter(event.target.value)} aria-label="Filter by project status">
                  <option value="all">All statuses</option>
                  <option value="active">In progress</option>
                  <option value="complete">Completed</option>
                  <option value="archived">Archived</option>
                  <option value="intake">Not started</option>
                </select>
              </label>
              <label className="sr-only" htmlFor="project-sort">Sort projects</label>
              <select id="project-sort" className="input h-8 py-1 text-xs" value={sortBy} onChange={event => setSortBy(event.target.value)}>
                <option value="updated">Recently updated</option>
                <option value="newest">Newest</option>
                <option value="name">Name A–Z</option>
              </select>
            </>}
            <button
              className="btn-primary btn-sm"
              onClick={() => isDemo ? navigate('/auth/login') : setShowNewModal(true)}
              id="new-project-btn"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-5 sm:p-7">
          {!isDemo && (
            <section aria-label="Project statistics" className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {[
                { label: 'Total projects', value: projects.length },
                { label: 'In progress', value: projects.filter(project => project.overall_status === 'in_progress').length },
                { label: 'Completed', value: projects.filter(project => project.overall_status === 'complete').length },
              ].map(stat => (
                <div key={stat.label} className="rounded border border-border-default bg-bg-surface p-4">
                  <p className="text-xs text-text-muted">{stat.label}</p>
                  <p className="mt-2 text-2xl font-semibold tabular-nums text-text-primary">{loading || error ? '—' : stat.value}</p>
                </div>
              ))}
            </section>
          )}
          {error && (
            <div className="mb-4 flex items-center justify-between gap-3 rounded border border-danger/30 bg-danger-subtle p-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-danger" />
                <p className="text-sm text-danger">{error}</p>
              </div>
              <button type="button" className="btn-secondary btn-sm" onClick={() => void loadProjects()}>Retry</button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center h-48">
              <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : error ? (
            <div className="flex h-48 items-center justify-center text-center text-xs text-text-muted">
              Your project list is unavailable until it loads successfully.
            </div>
          ) : (
            <AnimatePresence>
              {/* Real projects */}
              {isDemo ? (
                <div className="flex min-h-64 flex-col items-center justify-center rounded border border-dashed border-border-default bg-bg-surface px-5 text-center">
                  <FolderOpen className="mb-3 h-8 w-8 text-text-disabled" />
                  <p className="text-sm font-medium text-text-primary">Sign in to manage your projects.</p>
                  <p className="mt-1 max-w-md text-xs text-text-muted">Your saved projects, research, and workflow progress will appear here.</p>
                  <Link to="/auth/login" className="btn-primary btn-sm mt-4">Sign in</Link>
                </div>
              ) : (
                filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-64 text-center">
                    <FolderOpen className="w-8 h-8 text-text-disabled mb-3" />
                    <p className="text-sm font-medium text-text-secondary mb-1">
                      {normalizedSearch || statusFilter !== 'all' ? 'No projects match these filters.' : 'No projects yet.'}
                    </p>
                    <p className="text-xs text-text-muted mb-4">
                      {normalizedSearch || statusFilter !== 'all' ? 'Change your search or status filter and try again.' : 'Create a project to start validating your idea.'}
                    </p>
                    {!normalizedSearch && statusFilter === 'all' && (
                      <button className="btn-primary btn-sm" onClick={() => setShowNewModal(true)}>
                        <Plus className="w-4 h-4" />
                        Create Your First Project
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {filtered.map(p => (
                      <ProjectCard
                        key={p.id}
                        project={p}
                        onDelete={(id) => setDeleteTarget({ id, name: p.name })}
                        onRename={handleRename}
                      />
                    ))}
                  </div>
                )
              )}
            </AnimatePresence>
          )}
        </div>
      {/* Modals */}
      <AnimatePresence>
        {showNewModal && (
          <NewProjectModal
            open={showNewModal}
            onClose={() => setShowNewModal(false)}
            onCreated={(p) => {
              setProjects(prev => [p, ...prev]);
              navigate(`/project/${p.id}`);
            }}
          />
        )}
        {deleteTarget && (
          <DeleteConfirmModal
            projectName={deleteTarget.name}
            onConfirm={() => handleDelete(deleteTarget.id)}
            onCancel={() => setDeleteTarget(null)}
            deleting={deletingId === deleteTarget.id}
          />
        )}
      </AnimatePresence>
    </AppShell>
  );
}
