/* js/components/PracticePlanner.js */
/**
 * VMQ Practice Planner v3.0.5 (Drop-in replacement)
 * - React UMD (no JSX)
 * - Safe storage + safe gamification calls (works across engine naming variants)
 * - Prevents stale-state bugs via functional setState updates
 * - Debounced autosave, resilient task/category handling
 */

import * as storage from '../config/storage.js';
import * as gamification from '../engines/gamification.js';
import { TECHNIQUE_TASKS as TECHNIQUE_TASKS_RAW } from '../config/constants.js';

const { createElement: h, useEffect, useMemo, useRef, useState, useCallback } = React;

const TECHNIQUE_TASKS = Array.isArray(TECHNIQUE_TASKS_RAW) ? TECHNIQUE_TASKS_RAW : [];

function safeToast(showToast, message, type = 'info') {
  try {
    if (typeof showToast === 'function') showToast(message, type);
  } catch {
    /* no-op */
  }
}

function nowISO() {
  return new Date().toISOString();
}

function makeId(prefix = 'pp') {
  try {
    if (globalThis.crypto?.randomUUID) return `${prefix}_${globalThis.crypto.randomUUID()}`;
  } catch {
    /* ignore */
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

/**
 * Best-effort load/save that works whether storage.js provides
 * loadPracticePlan/savePracticePlan OR only generic JSON helpers.
 */
function loadPlanSafe() {
  try {
    if (typeof storage.loadPracticePlan === 'function') {
      const v = storage.loadPracticePlan();
      return Array.isArray(v) ? v : [];
    }
    // Fallback to generic storage helpers if present
    const key =
      storage.STORAGE_KEYS?.PRACTICE_PLAN ||
      storage.STORAGE_KEYS?.PRACTICEPLANNER ||
      'vmq_practice_plan';

    if (typeof storage.loadJSON === 'function') {
      const v = storage.loadJSON(key, []);
      return Array.isArray(v) ? v : [];
    }
  } catch {
    /* ignore */
  }
  return [];
}

function savePlanSafe(items) {
  try {
    if (typeof storage.savePracticePlan === 'function') {
      storage.savePracticePlan(items);
      return;
    }
    const key =
      storage.STORAGE_KEYS?.PRACTICE_PLAN ||
      storage.STORAGE_KEYS?.PRACTICEPLANNER ||
      'vmq_practice_plan';

    if (typeof storage.saveJSON === 'function') {
      storage.saveJSON(key, items);
      return;
    }
  } catch {
    /* ignore */
  }
}

function awardXPSafe(amount, reason) {
  // Support multiple engine naming variants without breaking imports.
  try {
    if (typeof gamification.awardXP === 'function') return gamification.awardXP(amount, reason);
    if (typeof gamification.addXP === 'function') return gamification.addXP(amount, reason);
    if (typeof gamification.recordAnswer === 'function') return gamification.recordAnswer({ xp: amount, reason });
  } catch {
    /* ignore */
  }
  return null;
}

function incrementDailyItemsSafe() {
  try {
    if (typeof gamification.incrementDailyItems === 'function') gamification.incrementDailyItems();
    if (typeof gamification.incrementDailyGoals === 'function') gamification.incrementDailyGoals('practice_items', 1);
  } catch {
    /* ignore */
  }
}

export default function PracticePlanner({ navigate, showToast }) {
  const [items, setItems] = useState([]);
  const [tab, setTab] = useState('custom'); // 'custom' | 'technique'
  const [newItemName, setNewItemName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState('');

  // ---- initial load ----
  useEffect(() => {
    setItems(loadPlanSafe());
  }, []);

  // ---- debounced autosave (prevents thrash) ----
  const saveTimerRef = useRef(null);
  useEffect(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      savePlanSafe(items);
    }, 250);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [items]);

  const categories = useMemo(() => {
    // Build from tasks present, but keep friendly labels.
    const map = {
      lefthand: 'Left Hand',
      righthand: 'Right Hand',
      bowstroke: 'Bow Strokes',
      posture: 'Posture',
      intonation: 'Intonation',
      rhythm: 'Rhythm',
      other: 'Other',
    };

    const seen = new Set();
    for (const t of TECHNIQUE_TASKS) {
      const k = String(t?.category || 'other');
      seen.add(k);
      if (!map[k]) map[k] = k.replace(/[_-]+/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    }

    // If there are no tasks, still show the classic three groups.
    if (seen.size === 0) {
      return { lefthand: map.lefthand, righthand: map.righthand, bowstroke: map.bowstroke };
    }

    const out = {};
    Array.from(seen).sort().forEach(k => { out[k] = map[k] || k; });
    return out;
  }, []);

  const pendingItems = useMemo(() => items.filter(i => !i?.completed), [items]);
  const completedItems = useMemo(() => items.filter(i => !!i?.completed), [items]);

  const selectedTask = useMemo(() => {
    if (!selectedTaskId) return null;
    return TECHNIQUE_TASKS.find(t => String(t?.id) === String(selectedTaskId)) || null;
  }, [selectedTaskId]);

  const addCustomItem = useCallback(() => {
    const name = String(newItemName || '').trim();
    if (!name) return;

    const newItem = {
      id: makeId('pp_custom'),
      name,
      type: 'custom',
      completed: false,
      addedDate: nowISO(),
    };

    setItems(prev => [...prev, newItem]);
    setNewItemName('');
    safeToast(showToast, 'Added to practice plan', 'success');
  }, [newItemName, showToast]);

  const addTechniqueTask = useCallback(() => {
    if (!selectedTaskId) return;
    const task = TECHNIQUE_TASKS.find(t => String(t?.id) === String(selectedTaskId));
    if (!task) return;

    const newItem = {
      id: makeId('pp_tech'),
      name: String(task.name || 'Technique Task'),
      description: task.description ? String(task.description) : undefined,
      bielerRef: task.bielerRef ? String(task.bielerRef) : undefined,
      type: 'technique',
      category: task.category ? String(task.category) : 'other',
      completed: false,
      addedDate: nowISO(),
    };

    setItems(prev => [...prev, newItem]);
    setSelectedTaskId('');
    safeToast(showToast, 'Added technique task', 'success');
  }, [selectedTaskId, showToast]);

  const toggleComplete = useCallback((id) => {
    setItems(prev => prev.map(item => {
      if (item?.id !== id) return item;
      const nextCompleted = !item.completed;

      // Only award on completion, not on uncheck
      if (nextCompleted) {
        awardXPSafe(5, `Completed: ${item.name || 'Practice Item'}`);
        incrementDailyItemsSafe();
        safeToast(showToast, `+5 XP • ${item.name || 'Item'} completed!`, 'success');
      }

      return { ...item, completed: nextCompleted, completedAt: nextCompleted ? nowISO() : null };
    }));
  }, [showToast]);

  const deleteItem = useCallback((id) => {
    const ok = window.confirm('Remove this item from your practice plan?');
    if (!ok) return;
    setItems(prev => prev.filter(item => item?.id !== id));
    safeToast(showToast, 'Item removed', 'info');
  }, [showToast]);

  const clearCompleted = useCallback(() => {
    const ok = window.confirm('Clear all completed items?');
    if (!ok) return;
    setItems(prev => prev.filter(item => !item?.completed));
    safeToast(showToast, 'Completed items cleared', 'info');
  }, [showToast]);

  const go = useCallback((route) => {
    try {
      if (typeof navigate === 'function') navigate(route);
      else window.location.hash = `#${route}`;
    } catch {
      window.location.hash = `#${route}`;
    }
  }, [navigate]);

  // ----- render helpers -----
  const renderTaskPreview = () => {
    const task = selectedTask;
    if (!task) return null;

    return h('div', {
      style: {
        padding: '12px',
        background: 'var(--surface-2, #f8f9fa)',
        borderRadius: '8px',
        marginBottom: '12px',
        border: '1px solid var(--border, #e5e7eb)',
      }
    },
      h('strong', null, String(task.name || 'Technique Task')),
      task.description
        ? h('p', { className: 'small', style: { margin: '8px 0 0' } }, String(task.description))
        : null,
      task.bielerRef
        ? h('p', { className: 'small', style: { margin: '4px 0 0', color: 'var(--primary, #2563eb)', fontStyle: 'italic' } },
            `Bieler: ${String(task.bielerRef)}`)
        : null
    );
  };

  const renderItemRow = (item, { completed = false } = {}) => {
    const bg = completed ? 'var(--success-bg, #d4edda)' : 'var(--surface-2, #f8f9fa)';
    const textColor = completed ? 'var(--success-ink, #155724)' : 'var(--ink, #111827)';

    return h('div', {
      key: item.id,
      style: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '12px',
        background: bg,
        borderRadius: '8px',
        marginBottom: '8px',
        border: '1px solid var(--border, #e5e7eb)',
        opacity: completed ? 0.85 : 1
      }
    },
      h('input', {
        type: 'checkbox',
        checked: !!item.completed,
        onChange: () => toggleComplete(item.id),
        style: { marginTop: '4px', cursor: 'pointer' },
        'aria-label': completed ? 'Mark as not completed' : 'Mark as completed'
      }),
      h('div', { style: { flex: 1, color: textColor } },
        h('div', {
          style: {
            fontWeight: 700,
            textDecoration: completed ? 'line-through' : 'none'
          }
        }, String(item.name || 'Untitled')),
        item.description ? h('div', { className: 'small', style: { color: 'var(--muted, #6c757d)', marginTop: '4px' } }, String(item.description)) : null,
        item.bielerRef ? h('div', { className: 'small', style: { color: 'var(--primary, #2563eb)', marginTop: '4px', fontStyle: 'italic' } }, `Bieler: ${String(item.bielerRef)}`) : null
      ),
      h('button', {
        className: 'btn-danger',
        style: { padding: '4px 8px', fontSize: '0.85rem' },
        onClick: () => deleteItem(item.id),
        title: 'Remove item',
        'aria-label': 'Remove item'
      }, '×')
    );
  };

  // ----- UI -----
  return h('div', { className: 'container' },
    h('h2', null, '📝 Practice Planner'),
    h('p', null, 'Build your personalized practice session with technique tasks and repertoire.'),

    // Add Items Section
    h('div', { className: 'card', style: { marginBottom: '20px' } },
      h('h3', null, 'Add to Practice Plan'),

      // Tabs
      h('div', {
        style: {
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '2px solid var(--border, #dee2e6)'
        }
      },
        h('button', {
          className: tab === 'custom' ? 'btn-primary' : 'btn-outline',
          style: { borderRadius: '4px 4px 0 0' },
          onClick: () => setTab('custom'),
          type: 'button'
        }, 'Custom Item'),
        h('button', {
          className: tab === 'technique' ? 'btn-primary' : 'btn-outline',
          style: { borderRadius: '4px 4px 0 0' },
          onClick: () => setTab('technique'),
          type: 'button'
        }, 'Technique Task')
      ),

      // Custom Item Form
      tab === 'custom'
        ? h('div', null,
            h('input', {
              type: 'text',
              value: newItemName,
              onChange: (e) => setNewItemName(e.target.value),
              onKeyDown: (e) => { if (e.key === 'Enter') addCustomItem(); },
              placeholder: 'e.g., Bach Concerto - 1st movement, Sevcik Op. 1 No. 1',
              style: { width: '100%', padding: '8px', marginBottom: '12px' },
              'aria-label': 'New custom practice item'
            }),
            h('button', {
              className: 'btn-primary',
              onClick: addCustomItem,
              disabled: !String(newItemName || '').trim(),
              type: 'button'
            }, '+ Add Custom Item')
          )
        : null,

      // Technique Task Form
      tab === 'technique'
        ? h('div', null,
            h('select', {
              value: selectedTaskId,
              onChange: (e) => setSelectedTaskId(e.target.value),
              style: { width: '100%', padding: '8px', marginBottom: '12px' },
              'aria-label': 'Select technique task'
            },
              h('option', { value: '' }, TECHNIQUE_TASKS.length ? '-- Select Technique Task --' : '-- No technique tasks configured --'),
              ...Object.entries(categories).flatMap(([catKey, catName]) => {
                const tasks = TECHNIQUE_TASKS.filter(t => String(t?.category || 'other') === String(catKey));
                if (!tasks.length) return [];
                return [
                  h('optgroup', { key: catKey, label: catName },
                    ...tasks.map(task =>
                      h('option', { key: String(task.id), value: String(task.id) }, String(task.name || 'Task'))
                    )
                  )
                ];
              })
            ),
            selectedTaskId ? renderTaskPreview() : null,
            h('button', {
              className: 'btn-primary',
              onClick: addTechniqueTask,
              disabled: !selectedTaskId,
              type: 'button'
            }, '+ Add Technique Task')
          )
        : null
    ),

    // Practice List
    h('div', { className: 'card' },
      h('div', {
        style: {
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px'
        }
      },
        h('h3', { style: { margin: 0 } }, "Today's Practice"),
        completedItems.length > 0
          ? h('button', {
              className: 'btn-outline',
              style: { fontSize: '0.85rem' },
              onClick: clearCompleted,
              type: 'button'
            }, 'Clear Completed')
          : null
      ),

      // Empty state
      (pendingItems.length === 0 && completedItems.length === 0)
        ? h('p', { style: { color: 'var(--muted, #6c757d)', textAlign: 'center', padding: '32px 0' } },
            'No practice items yet. Add some above to get started!')
        : null,

      // Pending Items
      pendingItems.length > 0
        ? h('div', { style: { marginBottom: '24px' } },
            h('h4', {
              style: { fontSize: '0.9rem', color: 'var(--muted, #6c757d)', marginBottom: '12px' }
            }, `TO PRACTICE (${pendingItems.length})`),
            ...pendingItems.map(item => renderItemRow(item, { completed: false }))
          )
        : null,

      // Completed Items
      completedItems.length > 0
        ? h('div', null,
            h('h4', {
              style: {
                fontSize: '0.9rem',
                color: 'var(--success, #22c55e)',
                marginBottom: '12px',
                marginTop: '24px'
              }
            }, `✓ COMPLETED (${completedItems.length})`),
            ...completedItems.map(item => renderItemRow(item, { completed: true }))
          )
        : null
    ),

    // Navigation
    h('div', { style: { marginTop: '24px', display: 'flex', gap: '12px' } },
      h('button', { className: 'btn-primary', onClick: () => go('dashboard'), type: 'button' }, '← Back to Dashboard'),
      h('button', { className: 'btn-secondary', onClick: () => go('menu'), type: 'button' }, 'Main Menu')
    )
  );
}