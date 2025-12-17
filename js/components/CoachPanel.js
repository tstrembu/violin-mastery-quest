// js/components/CoachPanel.js
// =============================================================
// Coach Panel v3.1 – AI coaching recommendations and insights.
// Displays personalized practice advice, priorities, and SM‑2 stats.
// Refreshes automatically every 10 seconds.
// =============================================================

const ReactGlobal = (typeof React !== 'undefined') ? React : null;
if (!ReactGlobal) {
  throw new Error('CoachPanel requires React (UMD) before this module.');
}

const {
  createElement: h,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} = ReactGlobal;

import { getCoachInsights } from '../engines/coachEngine.js';
import { useAppState, useNotifications } from '../contexts/AppContext.js';
import { getStats as sm2Stats } from '../engines/spacedRepetition.js';

/* Tiny helpers */
function nowISO() {
  try { return new Date().toISOString(); } catch { return String(Date.now()); }
}
function safeJSONStringify(obj, space = 2) {
  try { return { ok: true, value: JSON.stringify(obj, null, space) }; }
  catch (e) { return { ok: false, error: e }; }
}
function downloadTextFile(filename, text) {
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function copyToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return true;
  }
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'absolute';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch { ok = false; }
  ta.remove();
  return ok;
}
function guessVMQVersion() {
  return window.VMQ?.version || window.VMQ?.VERSION || window.__VMQ_VERSION__ || 'unknown';
}

/* Programmatic helper class */
export class CoachPanel {
  constructor(opts = {}) {
    this.namespace = opts.namespace || 'vmq';
  }

  snapshot() {
    const metrics = window.vmqMetrics || window.__vmqMetrics__ || null;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k) keys.push(k);
    }
    return {
      meta: {
        app: 'VMQ',
        version: guessVMQVersion(),
        capturedAt: nowISO(),
        url: window.location.href
      },
      keys: keys.sort(),
      hasMetrics: !!metrics
    };
  }

  buildReportText({ recommendations = [], priorities = [], smStats = null } = {}) {
    const snap = this.snapshot();
    const lines = [];
    lines.push('VMQ Coach Report');
    lines.push('----------------');
    lines.push(`Captured: ${snap.meta.capturedAt}`);
    lines.push(`VMQ Version: ${snap.meta.version}`);
    lines.push('');
    if (recommendations.length) {
      lines.push('Recommendations:');
      recommendations.forEach((rec, idx) => {
        lines.push(` ${idx + 1}. ${rec.title || 'Recommendation'} – ${rec.message || rec.description || ''}`);
      });
      lines.push('');
    }
    if (priorities.length) {
      lines.push('Priorities:');
      priorities.forEach((p, idx) => {
        lines.push(` ${idx + 1}. ${p.title || 'Priority'} – ${p.description || ''}`);
      });
      lines.push('');
    }
    if (smStats) {
      lines.push('Spaced Repetition Stats:');
      lines.push(` Total cards: ${smStats.total ?? 0}`);
      lines.push(` Due today: ${smStats.dueToday ?? 0}`);
      lines.push(` Mature cards: ${smStats.mature ?? 0}`);
      lines.push(` Estimated retention: ${((smStats.retention || 0) * 100).toFixed(0)}%`);
      lines.push('');
    }
    lines.push('Data snapshot:');
    lines.push(` LocalStorage keys: ${snap.keys.length}`);
    lines.push(` Metrics present: ${snap.hasMetrics ? 'yes' : 'no'}`);
    lines.push('');
    lines.push('Keys (up to 50):');
    snap.keys.slice(0, 50).forEach((k) => lines.push(` - ${k}`));
    if (snap.keys.length > 50) lines.push(` … plus ${snap.keys.length - 50} more`);
    lines.push('');
    return lines.join('\n');
  }
}

/* UI Route Component */
export default function CoachPanelRoute({ navigate }) {
  const { state } = useAppState() || {};
  const { addNotification } = useNotifications() || {};
  const [insights, setInsights] = useState({ recommendations: [], priorities: [] });
  const [smStatsState, setSmStatsState] = useState(null);

  const refreshData = useCallback(async () => {
    try {
      const profile = state?.profile || {};
      const coach = await getCoachInsights(profile);
      setInsights(coach || { recommendations: [], priorities: [] });
      const stats = await sm2Stats?.();
      setSmStatsState(stats || null);
    } catch (e) {
      addNotification?.(`Coach refresh error: ${e.message}`, 'error');
    }
  }, [state]);

  useEffect(() => {
    refreshData();
    const interval = setInterval(refreshData, 10000);
    return () => clearInterval(interval);
  }, [refreshData]);

  // export text / copy helpers
  const exportText = async () => {
    const cp = new CoachPanel({ namespace: 'vmq' });
    const txt = cp.buildReportText({
      recommendations: insights.recommendations,
      priorities: insights.priorities,
      smStats: smStatsState
    });
    try {
      await copyToClipboard(txt);
      addNotification?.('Coach report copied to clipboard.', 'success');
    } catch {
      addNotification?.('Failed to copy coach report.', 'error');
    }
  };
  const downloadText = () => {
    const cp = new CoachPanel({ namespace: 'vmq' });
    const txt = cp.buildReportText({
      recommendations: insights.recommendations,
      priorities: insights.priorities,
      smStats: smStatsState
    });
    const ts = nowISO().replace(/[:.]/g, '-');
    downloadTextFile(`vmq-coach-report-${ts}.txt`, txt);
    addNotification?.('Coach report downloaded.', 'success');
  };

  return h('div', { className: 'module-container' },
    h('h2', null, '🎯 Coach Panel'),
    h('p', null, 'Your AI coach analyzes your progress across all modules and suggests where to focus next.'),
    h('div', { className: 'card' },
      h('h3', null, 'Recommendations'),
      insights.recommendations && insights.recommendations.length
        ? insights.recommendations.map((rec, i) =>
            h('div', {
              key: i,
              className: 'insight',
              'data-priority': rec.priority || 'medium'
            },
              h('div', { className: 'insight-header' },
                h('span', { className: 'insight-icon' }, '💡'),
                h('strong', null, rec.title || 'Recommendation')
              ),
              h('p', null, rec.message || rec.description || '')
            )
          )
        : h('p', { className: 'text-muted' }, 'No recommendations at this time.')
    ),
    h('div', { className: 'card' },
      h('h3', null, 'Priorities'),
      insights.priorities && insights.priorities.length
        ? insights.priorities.map((p, i) =>
            h('div', {
              key: i,
              className: 'insight',
              'data-priority': p.priority || 'medium'
            },
              h('div', { className: 'insight-header' },
                h('span', { className: 'insight-icon' }, '🔎'),
                h('strong', null, p.title || 'Priority')
              ),
              h('p', null, p.description || '')
            )
          )
        : h('p', { className: 'text-muted' }, 'No high‑priority items.')
    ),
    h('div', { className: 'card' },
      h('h3', null, 'Spaced‑Repetition Stats'),
      smStatsState
        ? h('ul', null,
            h('li', null, `Total cards: ${smStatsState.total ?? 0}`),
            h('li', null, `Due today: ${smStatsState.dueToday ?? 0}`),
            h('li', null, `Mature cards: ${smStatsState.mature ?? 0}`),
            h('li', null, `Retention: ${((smStatsState.retention || 0) * 100).toFixed(0)}%`)
          )
        : h('p', { className: 'text-muted' }, 'Loading stats…')
    ),
    h('div', { style: { marginTop: '1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' } },
      h('button', {
        className: 'btn btn-secondary',
        onClick: exportText
      }, 'Copy Report'),
      h('button', {
        className: 'btn btn-secondary',
        onClick: downloadText
      }, 'Download Report')
    ),
    h('button', {
      className: 'btn btn-secondary',
      style: { marginTop: '1.5rem' },
      onClick: () => navigate('dashboard')
    }, '← Back')
  );
}