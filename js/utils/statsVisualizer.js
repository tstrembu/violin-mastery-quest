// js/utils/statsVisualizer.js
// ======================================
// STATS VISUALIZER v2.1.0 - VMQ Charts Toolkit
// Analytics + SM-2 + Coach + 50+ modules
//
// Drop-in replacement goals:
// - Keep all current/intended features from your draft.
// - Fix missing helper imports (percentage), name collisions,
//   and type/edge-case bugs.
// - Be resilient to empty/short data arrays.
// - Return consistent “chart model” objects (no DOM required).
// ======================================

import {
  formatDuration,
  average,
  grade,
  accuracy as percentage,      // <-- VMQ: "percentage(correct,total)" == helpers.accuracy
  calculateTrend as calcTrend, // <-- helpers trend (string)
} from './helpers.js';

/**
 * 🎯 VMQ CHART CONFIG (Production themes)
 */
export const VMQ_CHARTS = {
  COLORS: {
    primary: 'var(--primary)',
    success: 'var(--success)',
    warning: 'var(--warning)',
    error: 'var(--error)',
    gradient: 'linear-gradient(135deg, var(--primary), var(--success))',
  },
  // NOTE: grade() can return S+, S, A, B+, B, C+, C, D, F (in helpers.js).
  // We normalize those to base buckets for coloring.
  GRADES: {
    S: '#22c55e',
    A: '#3b82f6',
    B: '#eab308',
    C: '#f59e0b',
    D: '#ef4444',
    F: '#6b7280',
  },
};

function _num(n, fallback = 0) {
  const x = Number(n);
  return Number.isFinite(x) ? x : fallback;
}
function _clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}
function _safeArray(a) {
  return Array.isArray(a) ? a : [];
}
function _baseGradeLetter(letter) {
  const g = String(letter ?? '').toUpperCase();
  if (g.startsWith('S')) return 'S';
  if (g.startsWith('A')) return 'A';
  if (g.startsWith('B')) return 'B';
  if (g.startsWith('C')) return 'C';
  if (g.startsWith('D')) return 'D';
  return 'F';
}
function _asPercent(value) {
  const v = _num(value, 0);
  return _clamp(v, 0, 100);
}

/**
 * 📊 BAR CHART (Module accuracy - Analytics)
 * Expects: data = [{ label, value, color? }, ...] where value is 0..100
 */
export function createBarChart(data, options = {}) {
  const {
    width = 360,
    height = 280,
    maxBars = 8,
    barColor = VMQ_CHARTS.COLORS.primary,
  } = options;

  const src = _safeArray(data).slice(0, Math.max(0, Math.floor(_num(maxBars, 8))));
  const chartData = src.map(d => ({
    label: String(d?.label ?? ''),
    value: _asPercent(d?.value),
    color: d?.color,
  }));

  const safeLen = Math.max(1, chartData.length);
  const maxValue = Math.max(...chartData.map(d => d.value), 10);
  const chartHeight = Math.max(1, height - 80);
  const barWidth = (width - 80) / safeLen;

  const elements = chartData.map((item, i) => {
    const barHeight = Math.max((item.value / maxValue) * chartHeight, 8);
    const x = 50 + i * barWidth;
    const y = height - 50 - barHeight;

    const g = grade(item.value);

    return {
      bar: {
        x: x + 4,
        y,
        width: Math.max(1, barWidth - 8),
        height: barHeight,
        fill: item.color || barColor,
        rx: 3,
        className: 'bar-hover',
      },
      label: {
        x: x + barWidth / 2,
        y: height - 25,
        text: item.label,
        textAnchor: 'middle',
        fontSize: 11,
        fill: 'var(--ink)',
      },
      value: {
        x: x + barWidth / 2,
        y: y - 8,
        text: `${Math.round(item.value)}%`,
        textAnchor: 'middle',
        fontSize: 12,
        fontWeight: 'bold',
        fill: 'var(--ink)',
      },
      grade: g,
    };
  });

  // 🎯 VMQ GRID (5 levels)
  const gridLevels = [0, 25, 50, 75, 100].map(val => ({
    y: height - 50 - (val / 100) * chartHeight,
    label: `${val}%`,
    stroke: 'var(--border)',
    strokeDasharray: '2,2',
  }));

  return { elements, gridLevels, width, height, maxValue, count: chartData.length };
}

/**
 * 📈 LINE CHART (Progress over time - Journal)
 * Expects: data = [{ label, value }, ...] (value can be any numeric range)
 */
export function createLineChart(data, options = {}) {
  const { width = 360, height = 240, smooth = true } = options;

  const src = _safeArray(data).map(d => ({
    label: String(d?.label ?? ''),
    value: _num(d?.value, 0),
  }));

  if (src.length === 0) {
    return {
      points: [],
      pathD: '',
      trend: { slope: '0.00', direction: 'stable', confidence: 0, rSquared: 0 },
      trendColor: 'var(--border)',
      width,
      height,
    };
  }

  const chartHeight = Math.max(1, height - 60);
  const chartWidth = Math.max(1, width - 60);

  const values = src.map(d => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = (maxV - minV) || 1;

  const denom = Math.max(1, src.length - 1);
  const points = src.map((d, i) => ({
    x: 40 + (i / denom) * chartWidth,
    y: height - 40 - ((d.value - minV) / range) * chartHeight,
    value: d.value,
    label: d.label,
  }));

  // 🎯 SMOOTH PATH (cubic bezier) — safe for 1-point lines
  let pathD = '';
  if (points.length === 1) {
    pathD = `M ${points[0].x} ${points[0].y}`;
  } else if (smooth) {
    const segs = [];
    segs.push(`M ${points[0].x} ${points[0].y}`);
    for (let i = 0; i < points.length - 1; i++) {
      const p = points[i];
      const n = points[i + 1];
      const cx = (p.x + n.x) / 2;
      segs.push(`C ${cx} ${p.y}, ${cx} ${n.y}, ${n.x} ${n.y}`);
    }
    pathD = segs.join(' ');
  } else {
    pathD = points.map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`)).join(' ');
  }

  const trend = calculateTrend(src); // regression-based for this file
  const trendColor =
    trend.direction === 'improving' ? VMQ_CHARTS.COLORS.success :
    trend.direction === 'declining' ? VMQ_CHARTS.COLORS.error :
    'var(--border)';

  return { points, pathD, trend, trendColor, width, height, minV, maxV };
}

/**
 * 🎯 PROGRESS RING (Dashboard accuracy)
 */
export function createProgressRing(value, options = {}) {
  const { size = 80, stroke = 8, showGrade = true } = options;
  const v = _asPercent(value);

  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - v / 100);

  const g = grade(v);
  const bucket = _baseGradeLetter(g);
  const gradeColor = VMQ_CHARTS.GRADES[bucket] || VMQ_CHARTS.COLORS.primary;

  return {
    size,
    stroke,
    radius,
    circumference,
    offset,
    viewBox: `0 0 ${size} ${size}`,
    center: size / 2,
    showGrade: !!showGrade,
    grade: g,
    gradeColor,
    value: Math.round(v),
  };
}

/**
 * 🔥 HEATMAP (Practice consistency - N weeks)
 * sessions: [{ timestamp, engagedMs, accuracy }, ...]
 * Returns: Array<week> where week is Array<dayCell> (7)
 */
export function createHeatmap(sessions, weeks = 12) {
  const s = _safeArray(sessions).map(x => ({
    timestamp: _num(x?.timestamp, 0),
    engagedMs: _num(x?.engagedMs, 0),
    accuracy: _num(x?.accuracy, 0),
  }));

  const w = Math.max(1, Math.floor(_num(weeks, 12)));
  const heatmap = [];
  const now = new Date();

  // Build a quick lookup by date string to avoid O(n^2)
  const byDay = new Map();
  for (const sess of s) {
    const d = new Date(sess.timestamp);
    const key = d.toDateString();
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key).push(sess);
  }

  for (let week = w - 1; week >= 0; week--) {
    const weekData = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (week * 7 + day));
      const dateStr = date.toDateString();

      const daySessions = byDay.get(dateStr) || [];
      const totalTime = daySessions.reduce((sum, ss) => sum + (ss.engagedMs || 0), 0);

      // 0–4 scale: 15min blocks
      const intensity = Math.min(4, Math.floor(totalTime / (15 * 60 * 1000)));

      weekData.unshift({
        date: dateStr,
        dayOfWeek: day,
        intensity,
        sessions: daySessions.length,
        totalTime: formatDuration(totalTime),
        accuracy: average(daySessions.map(ss => ss.accuracy || 0)),
      });
    }
    heatmap.push(weekData);
  }

  return heatmap;
}

/**
 * 📊 STATS SUMMARY (Module stats)
 * modules: [{ module, correct, total, avgResponseTime, recentAccuracy }, ...]
 */
export function calculateModuleStats(modules) {
  const m = _safeArray(modules);

  return m.map(mod => {
    const acc = percentage(_num(mod?.correct, 0), _num(mod?.total, 0));
    const recent = _asPercent(mod?.recentAccuracy);

    const diff = recent - acc;
    const trendIcon = diff > 5 ? '↗️' : diff < -5 ? '↘️' : '➡️';

    return {
      name: String(mod?.module ?? mod?.name ?? ''),
      accuracy: acc,
      attempts: _num(mod?.total, 0),
      avgTime: formatDuration(_num(mod?.avgResponseTime, 0)),
      grade: grade(acc),
      trend: trendIcon,
    };
  }).sort((a, b) => b.accuracy - a.accuracy);
}

/**
 * 🎵 MUSIC VISUALIZATION (Interval accuracy radar)
 * intervals: [{ name, correct, total }, ...]
 */
export function createIntervalRadar(intervals) {
  const positions = [
    'Unison', 'm2', 'M2', 'm3', 'M3', 'P4', 'Tritone',
    'P5', 'm6', 'M6', 'm7', 'M7', 'P8',
  ];

  const ints = _safeArray(intervals).map(x => ({
    name: String(x?.name ?? ''),
    correct: _num(x?.correct, 0),
    total: _num(x?.total, 0),
  }));

  const radarData = positions.map(name => {
    const interval = ints.find(int => int.name === name);
    return {
      axis: name,
      value: interval ? percentage(interval.correct, interval.total) : 0,
      color: VMQ_CHARTS.COLORS.primary,
    };
  });

  return { radarData, positions, size: 300 };
}

/**
 * ⚡ TREND ANALYSIS (Linear regression + confidence)
 * Accepts either:
 * - [{ value }, ...]   (recommended), or
 * - [number, number...] (also supported)
 *
 * Returns: { slope, direction, confidence, rSquared }
 */
export function calculateTrend(data) {
  const arr = _safeArray(data);

  const points = arr
    .map((d, i) => ({
      x: i,
      y: (typeof d === 'number') ? _num(d, 0) : _num(d?.value, 0),
    }));

  if (points.length < 3) return { slope: '0.00', direction: 'stable', confidence: 0, rSquared: 0 };

  const n = points.length;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);

  const xMean = average(xs);
  const yMean = average(ys);

  const denom = xs.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0) || 1;
  const slope = points.reduce((sum, p) => sum + (p.x - xMean) * (p.y - yMean), 0) / denom;

  const ssRes = points.reduce((sum, p) => sum + Math.pow(p.y - (yMean + slope * (p.x - xMean)), 2), 0);
  const ssTot = ys.reduce((sum, y) => sum + Math.pow(y - yMean, 2), 0) || 1;
  const rSquared = _clamp(1 - (ssRes / ssTot), 0, 1);

  const direction = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
  const confidence = Math.min(100, Math.round(rSquared * 100));

  return { slope: slope.toFixed(2), direction, confidence, rSquared: Math.round(rSquared * 1000) / 1000 };
}

/**
 * 📱 SPARKLINE (Dashboard mini-charts)
 * values: number[]
 */
export function generateSparkline(values, { width = 120, height = 32, fill = false } = {}) {
  const v = _safeArray(values).map(x => _num(x, NaN)).filter(Number.isFinite);
  if (v.length < 2) return { path: '', area: '', width, height, minV: 0, maxV: 0, points: [] };

  const minV = Math.min(...v);
  const maxV = Math.max(...v);
  const range = (maxV - minV) || 1;
  const xStep = width / (v.length - 1);

  const points = v.map((val, i) => ({
    x: i * xStep,
    y: height - ((val - minV) / range) * (height - 4),
  }));

  const path = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const area = fill
    ? `M ${points[0].x} ${height} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L ${points[points.length - 1].x} ${height} Z`
    : path;

  return { path, area, width, height, minV, maxV, points };
}

/**
 * 🎯 COMPREHENSIVE STATS (Dashboard summary)
 * sessions: [{ engagedMs, accuracy, timestamp }, ...]
 * modules: array (already computed or raw)
 */
export function calculateStatsSummary(sessions, modules) {
  const s = _safeArray(sessions);
  const recentSessions = s.slice(-30);

  const accValues = recentSessions.map(x => _num(x?.accuracy, 0));
  const engagedValues = recentSessions.map(x => _num(x?.engagedMs, 0));

  // NOTE: your draft mistakenly passed a *number array* into calculateTrend(data)
  // which expects [{value}] — we support both, but keep it consistent here:
  const trend = calculateTrend(accValues);

  return {
    totalSessions: s.length,
    avgSession: formatDuration(average(engagedValues)),
    consistency: Math.round((recentSessions.length / 30) * 100),
    trend,
    // preserve behavior: “modules.slice(0,3)” assumes modules already sorted
    topModules: _safeArray(modules).slice(0, 3),
    gradeDistribution: calculateGradeDist(accValues),
  };
}

function calculateGradeDist(values) {
  const out = {};
  _safeArray(values).forEach(acc => {
    const g = grade(_num(acc, 0));
    out[g] = (out[g] || 0) + 1;
  });
  return out;
}

/**
 * 🚀 VMQ HEATMAP INTENSITY (Practice patterns)
 */
export function getHeatmapIntensity(value) {
  const v = Math.floor(_num(value, 0));
  return v === 0 ? '#f8fafc' :
         v === 1 ? '#e2e8f0' :
         v === 2 ? '#cbd5e1' :
         v === 3 ? '#3b82f6' :
         '#22c55e';
}

/**
 * Optional helper export: if any parts of VMQ want helpers.js trend strings
 * (“improving/declining/plateau/neutral”), keep a bridge here.
 */
export function calculateTrendLabel(values, windowSize = 5) {
  return calcTrend(values, windowSize);
}