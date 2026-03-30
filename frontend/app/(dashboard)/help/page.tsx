'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getCurrentUser, User } from '@/lib/auth';

// ── Types ──────────────────────────────────────────────────────────────────────

interface FaqItem {
  q: string;
  a: string;
}

interface ChecklistItem {
  label: string;
  detail: string;
  href?: string;
}

// ── Content ────────────────────────────────────────────────────────────────────

const ADMIN_CHECKLIST: ChecklistItem[] = [
  { label: 'Invite your team', detail: 'Add employees and managers from the Employees page. You can also bulk-import via CSV.', href: '/admin/employees' },
  { label: 'Set up departments', detail: 'Organise your team into departments so reviewers can be filtered by group.', href: '/admin/departments' },
  { label: 'Configure the rating scale', detail: 'Choose your max rating (1–10) and label each value under Settings → Rating Scale.', href: '/settings' },
  { label: 'Create a review cycle', detail: 'Define the cycle name, dates, and which review types are active (Self, Manager, Peer).', href: '/admin/review-cycles/new' },
  { label: 'Add review questions', detail: 'Write the questions employees and managers will answer. Questions can be rating, text, or task-list type.', href: '/admin/questions' },
  { label: 'Assign reviewers', detail: 'For each employee, assign their manager reviewer and peer reviewers before activating.', href: '/admin/review-cycles' },
  { label: 'Activate the cycle', detail: 'Once everything is set, activate the cycle. Employees will receive email notifications.', href: '/admin/review-cycles' },
];

const ADMIN_FAQ: FaqItem[] = [
  {
    q: 'When do scores become visible to employees and managers?',
    a: 'Scores are locked until the review cycle status is set to Completed. Until then, everyone — including managers — sees locked placeholders. Complete the cycle from the Review Cycles page once all reviews are submitted.',
  },
  {
    q: 'Can I edit questions after a cycle is active?',
    a: 'No. Questions are locked once a cycle is activated to ensure consistency across all reviews. Deactivate the cycle (revert to Draft) if you need to make changes.',
  },
  {
    q: 'How is the final score calculated?',
    a: 'Final score = (Self score + Average of all Manager scores + Average of all Peer scores) ÷ 3. Each of the three buckets carries equal weight regardless of how many reviewers are in each group.',
  },
  {
    q: 'What happens if a reviewer doesn\'t submit?',
    a: 'The cycle can still be completed, but the missing reviewer\'s score is excluded from the average. You can monitor submission status in the Cycle Insights panel.',
  },
  {
    q: 'Can I run more than one active cycle at a time?',
    a: 'Yes. Each cycle is independent. Employees and managers will see tasks for each active cycle separately.',
  },
  {
    q: 'How do I remove someone from a cycle mid-way?',
    a: 'Go to the cycle\'s reviewer assignments and remove the assignment. Reviews already submitted by that reviewer are retained.',
  },
];

const MANAGER_FAQ: FaqItem[] = [
  {
    q: 'Where do I review my team members?',
    a: 'Go to Team Reviews from your dashboard or the sidebar. You\'ll see the list of employees assigned to you for the active cycle. Click Start Review next to any employee.',
  },
  {
    q: 'Can I see my team\'s scores during the cycle?',
    a: 'Individual scores are locked until the cycle is marked Completed by your admin. You can track completion progress (who has submitted) at any time, but numerical scores are hidden until then.',
  },
  {
    q: 'Do I need to complete my own self-review too?',
    a: 'Yes, if the cycle includes a Self review type. Check My Reviews on your dashboard — any pending tasks (self-review, peer reviews) are listed there.',
  },
  {
    q: 'Can I save a draft and come back later?',
    a: 'Yes. Your answers auto-save every 30 seconds. You can also close the page and return — your draft will be waiting. Only clicking Submit finalises the review.',
  },
  {
    q: 'Can I edit a review after submitting?',
    a: 'No. Submitted reviews are locked. Contact your admin if a correction is needed.',
  },
];

const EMPLOYEE_FAQ: FaqItem[] = [
  {
    q: 'How do I complete my self-review?',
    a: 'From your dashboard, click the Self Assessment task card, or go to My Reviews → Self Assessment. Answer all questions and click Submit when done.',
  },
  {
    q: 'When will I see my scores?',
    a: 'Scores are released when your admin marks the review cycle as Completed. Until then, the My Scores page shows a locked state. You\'ll receive an email notification when scores are available.',
  },
  {
    q: 'Who can see my self-review answers?',
    a: 'Your self-review answers are visible to your admin. Your manager does not see your self-review before or during their own review — this is to keep assessments independent.',
  },
  {
    q: 'How are peer reviewers chosen?',
    a: 'Your admin assigns peer reviewers. You cannot see who is reviewing you as a peer, and peer feedback is kept anonymous in your final score breakdown.',
  },
  {
    q: 'Can I change my answers after submitting?',
    a: 'No. Once you submit, your review is locked. Use the Save Draft feature (answers auto-save every 30 seconds) to review before finalising.',
  },
  {
    q: 'What if I see "No active review cycle"?',
    a: 'This means your admin has not yet activated a cycle, or the current cycle has ended. Check back later or contact your admin.',
  },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="divide-y divide-outline-variant dark:divide-white/[0.08] border border-outline-variant dark:border-white/[0.12] rounded-xl overflow-hidden">
      {items.map((item, idx) => (
        <div key={idx}>
          <button
            onClick={() => setOpen(open === idx ? null : idx)}
            className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-surface-container-low transition-colors"
          >
            <span className="text-sm font-semibold text-on-surface pr-4">{item.q}</span>
            <svg
              className={`shrink-0 h-4 w-4 text-on-surface-variant transition-transform ${open === idx ? 'rotate-180' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>
          {open === idx && (
            <div className="px-5 pb-5 pt-1 bg-surface-container-low/40">
              <p className="text-sm text-on-surface-variant leading-relaxed">{item.a}</p>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function ChecklistCard({ items }: { items: ChecklistItem[] }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());
  const toggle = (i: number) => {
    const next = new Set(checked);
    next.has(i) ? next.delete(i) : next.add(i);
    setChecked(next);
  };
  const done = checked.size;
  const total = items.length;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant dark:border-white/[0.12] rounded-xl overflow-hidden">
      {/* Progress header */}
      <div className="px-5 py-4 border-b border-outline-variant dark:border-white/[0.08] flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-on-surface">Getting Started</p>
          <p className="text-xs text-on-surface-variant mt-0.5">{done} of {total} steps completed</p>
        </div>
        <div className="shrink-0 w-32">
          <div className="w-full bg-surface-container-high rounded-full h-2">
            <div
              className="bg-primary h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.round((done / total) * 100)}%` }}
            />
          </div>
        </div>
      </div>

      {/* Steps */}
      <div className="divide-y divide-outline-variant dark:divide-white/[0.08]">
        {items.map((item, idx) => (
          <div
            key={idx}
            className={`flex items-start gap-4 px-5 py-4 transition-colors ${checked.has(idx) ? 'bg-surface-container-low/50' : 'hover:bg-surface-container-low/30'}`}
          >
            <button
              onClick={() => toggle(idx)}
              className={`mt-0.5 shrink-0 h-5 w-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                checked.has(idx)
                  ? 'bg-primary border-primary'
                  : 'border-outline-variant hover:border-primary'
              }`}
            >
              {checked.has(idx) && (
                <svg className="h-3 w-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              )}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${checked.has(idx) ? 'line-through text-on-surface-variant' : 'text-on-surface'}`}>
                {item.label}
              </p>
              <p className="text-xs text-on-surface-variant mt-0.5 leading-relaxed">{item.detail}</p>
            </div>
            {item.href && (
              <a
                href={item.href}
                className="shrink-0 text-xs font-semibold text-primary hover:underline mt-0.5 whitespace-nowrap"
              >
                Go →
              </a>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Role tab content ───────────────────────────────────────────────────────────

function AdminContent() {
  return (
    <div className="space-y-8">
      <ChecklistCard items={ADMIN_CHECKLIST} />
      <div>
        <h3 className="text-base font-bold text-on-surface mb-4">Frequently Asked Questions</h3>
        <FaqAccordion items={ADMIN_FAQ} />
      </div>
    </div>
  );
}

function ManagerContent() {
  return (
    <div>
      <h3 className="text-base font-bold text-on-surface mb-4">Frequently Asked Questions</h3>
      <FaqAccordion items={MANAGER_FAQ} />
    </div>
  );
}

function EmployeeContent() {
  return (
    <div>
      <h3 className="text-base font-bold text-on-surface mb-4">Frequently Asked Questions</h3>
      <FaqAccordion items={EMPLOYEE_FAQ} />
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function HelpPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    getCurrentUser().then((u) => {
      if (!u) { router.push('/login'); return; }
      setUser(u);
    });
  }, []);

  if (!user) return null;

  const dashboardHref = user.role === 'ADMIN' ? '/admin' : user.role === 'MANAGER' ? '/manager' : '/employee';

  return (
    <div className="max-w-3xl mx-auto py-10 px-4 sm:px-0">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.push(dashboardHref)}
          className="flex items-center gap-1.5 text-sm font-semibold text-primary bg-primary/8 hover:bg-primary/15 dark:bg-primary/10 dark:hover:bg-primary/20 px-3 py-1.5 rounded-lg transition-colors mb-3"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Back to Dashboard
        </button>
        <h1 className="text-3xl font-bold tracking-tight text-on-surface">Help & Guide</h1>
        <p className="mt-2 text-sm text-on-surface-variant">
          {user.role === 'ADMIN' && 'Everything you need to set up and manage Reviewly.'}
          {user.role === 'MANAGER' && 'Everything you need to review your team and track performance.'}
          {user.role === 'EMPLOYEE' && 'Everything you need to complete your reviews and view your scores.'}
        </p>
      </div>

      {/* Role-specific content — no tabs, only what's relevant */}
      {user.role === 'ADMIN' && <AdminContent />}
      {user.role === 'MANAGER' && <ManagerContent />}
      {user.role === 'EMPLOYEE' && <EmployeeContent />}

      {/* Footer */}
      <div className="mt-16 pt-8 border-t border-outline-variant dark:border-white/[0.08] text-center">
        <p className="text-xs text-on-surface-variant">
          Still stuck?{' '}
          <a href="/settings" className="text-primary hover:underline font-medium">Go to Settings</a>
          {user.role !== 'ADMIN' && ' or contact your admin.'}
          {user.role === 'ADMIN' && '.'}
        </p>
      </div>
    </div>
  );
}
