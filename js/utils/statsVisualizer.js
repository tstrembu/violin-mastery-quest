// ======================================
// STATS VISUALIZER v2.0 - VMQ 6-Engine Charts
// Analytics + SM-2 + Coach + 50+ modules
// ======================================

import { formatDuration, percentage, average, grade } from './helpers.js';

/**
 * 🎯 VMQ CHART CONFIG (Production themes)
 */
export const VMQ_CHARTS = {
  COLORS: {
    primary: 'var(--primary)',
    success: 'var(--success)', 
    warning: 'var(--warning)',
    error: 'var(--error)',
    gradient: 'linear-gradient(135deg, var(--primary), var(--success))'
  },
  GRADES: { S: '#22c55e', A: '#3b82f6', B: '#eab308', C: '#f59e0b', D: '#ef4444', F: '#6b7280' }
};

/**
 * 📊 BAR CHART (Module accuracy - Analytics)
 */
export function createBarChart(data, options = {}) {
  const {
    width = 360, height = 280, maxBars = 8,
    barColor = VMQ_CHARTS.COLORS.primary
  } = options;

  const chartData = data.slice(0, maxBars);
  const maxValue = Math.max(...chartData.map(d => d.value), 10);
  const barWidth = (width - 80) / chartData.length;
  const chartHeight = height - 80;

  const elements = chartData.map((item, i) => {
    const barHeight = Math.max((item.value / maxValue) * chartHeight, 8);
    const x = 50 + i * barWidth;
    const y = height - 50 - barHeight;
    
    return {
      bar: {
        x: x + 4, y, width: barWidth - 8, height: barHeight,
        fill: item.color || barColor,
        rx: 3, className: 'bar-hover'
      },
      label: { x: x + barWidth/2, y: height - 25, text: item.label, 
        textAnchor: 'middle', fontSize: 11, fill: 'var(--ink)' },
      value: { x: x + barWidth/2, y: y - 8, 
        text: `${item.value}%`, textAnchor: 'middle', 
        fontSize: 12, fontWeight: 'bold', fill: 'var(--ink)' },
      grade: grade(item.value)
    };
  });

  // 🎯 VMQ GRID (5 levels)
  const gridLevels = [0, 25, 50, 75, 100].map(val => ({
    y: height - 50 - (val / 100) * chartHeight,
    label: `${val}%`,
    stroke: 'var(--border)',
    strokeDasharray: '2,2'
  }));

  return { elements, gridLevels, width, height, maxValue };
}

/**
 * 📈 LINE CHART (Progress over time - Journal)
 */
export function createLineChart(data, options = {}) {
  const { width = 360, height = 240, smooth = true } = options;
  const chartHeight = height - 60;
  const chartWidth = width - 60;
  
  const values = data.map(d => d.value);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const points = data.map((d, i) => ({
    x: 40 + (i / (data.length - 1)) * chartWidth,
    y: height - 40 - ((d.value - minV) / range) * chartHeight,
    value: d.value,
    label: d.label
  }));

  // 🎯 SMOOTH PATH (cubic bezier)
  const pathD = smooth 
    ? `M ${points[0].x} ${points[0].y} ${points.map((p, i) => 
        i < points.length - 1 
          ? `C ${(p.x + points[i+1].x)/2} ${p.y}, ${(p.x + points[i+1].x)/2} ${points[i+1].y}, ${points[i+1].x} ${points[i+1].y}`
          : `L ${p.x} ${p.y}`
      ).slice(1).join(' ')}`
    : points.map((p, i) => i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`).join(' ');

  const trend = calculateTrend(data);
  const trendColor = trend.direction === 'improving' ? VMQ_CHARTS.COLORS.success : 
                    trend.direction === 'declining' ? VMQ_CHARTS.COLORS.error : 'var(--border)';

  return { points, pathD, trend, trendColor, width, height };
}

/**
 * 🎯 PROGRESS RING (Dashboard accuracy)
 */
export function createProgressRing(value, options = {}) {
  const { size = 80, stroke = 8, showGrade = true } = options;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - value / 100);

  const gradeColor = VMQ_CHARTS.GRADES[grade(value)] || VMQ_CHARTS.COLORS.primary;
  
  return {
    size, stroke, radius, circumference, offset,
    viewBox: `0 0 ${size} ${size}`,
    center: size / 2,
    grade,
    gradeColor,
    value: Math.round(value)
  };
}

/**
 * 🔥 HEATMAP (Practice consistency - 12 weeks)
 */
export function createHeatmap(sessions, weeks = 12) {
  const heatmap = [];
  const now = new Date();
  
  for (let week = weeks - 1; week >= 0; week--) {
    const weekData = [];
    for (let day = 0; day < 7; day++) {
      const date = new Date(now);
      date.setDate(date.getDate() - (week * 7 + day));
      const dateStr = date.toDateString();
      
      const daySessions = sessions.filter(s => 
        new Date(s.timestamp).toDateString() === dateStr
      );
      
      const totalTime = daySessions.reduce((sum, s) => sum + (s.engagedMs || 0), 0);
      const intensity = Math.min(4, Math.floor(totalTime / (15 * 60 * 1000))); // 0-4 scale
      
      weekData.unshift({
        date: dateStr,
        dayOfWeek: day,
        intensity,
        sessions: daySessions.length,
        totalTime: formatDuration(totalTime),
        accuracy: average(daySessions.map(s => s.accuracy || 0))
      });
    }
    heatmap.push(weekData);
  }
  
  return heatmap;
}

/**
 * 📊 STATS SUMMARY (Module stats)
 */
export function calculateModuleStats(modules) {
  return modules.map(mod => {
    const acc = percentage(mod.correct, mod.total);
    return {
      name: mod.module,
      accuracy: acc,
      attempts: mod.total,
      avgTime: formatDuration(mod.avgResponseTime || 0),
      grade: grade(acc),
      trend: mod.recentAccuracy - acc > 5 ? '↗️' : mod.recentAccuracy - acc < -5 ? '↘️' : '➡️'
    };
  }).sort((a, b) => b.accuracy - a.accuracy);
}

/**
 * 🎵 MUSIC VISUALIZATION (Interval accuracy radar)
 */
export function createIntervalRadar(intervals) {
  const positions = [
    'Unison', 'm2', 'M2', 'm3', 'M3', 'P4', 'Tritone', 
    'P5', 'm6', 'M6', 'm7', 'M7', 'P8'
  ];
  
  const radarData = positions.map((name, i) => {
    const interval = intervals.find(int => int.name === name);
    return {
      axis: name,
      value: interval ? percentage(interval.correct, interval.total) : 0,
      color: VMQ_CHARTS.COLORS.primary
    };
  });
  
  return { radarData, positions, size: 300 };
}

/**
 * ⚡ TREND ANALYSIS (Linear regression + confidence)
 */
export function calculateTrend(data) {
  if (data.length < 3) return { slope: 0, direction: 'stable', confidence: 0 };
  
  const n = data.length;
  const x = data.map((_, i) => i);
  const xMean = average(x);
  const yMean = average(data.map(d => d.value));
  
  const slope = data.reduce((sum, d, i) => sum + (x[i] - xMean) * (d.value - yMean), 0) /
                x.reduce((sum, xi) => sum + Math.pow(xi - xMean, 2), 0);
  
  const rSquared = 1 - (data.reduce((sum, d, i) => 
    sum + Math.pow(d.value - (yMean + slope * (x[i] - xMean)), 2), 0) /
    data.reduce((sum, d) => sum + Math.pow(d.value - yMean, 2), 0));
  
  const direction = slope > 0.5 ? 'improving' : slope < -0.5 ? 'declining' : 'stable';
  const confidence = Math.min(100, Math.round(rSquared * 100));
  
  return { slope: slope.toFixed(2), direction, confidence, rSquared };
}

/**
 * 📱 SPARKLINE (Dashboard mini-charts)
 */
export function generateSparkline(values, { width = 120, height = 32, fill = false } = {}) {
  if (values.length < 2) return '';
  
  const minV = Math.min(...values);
  const maxV = Math.max(...values);
  const range = maxV - minV || 1;
  const xStep = width / (values.length - 1);
  
  const points = values.map((v, i) => ({
    x: i * xStep,
    y: height - ((v - minV) / range) * (height - 4)
  }));
  
  const path = `M ${points.map(p => `${p.x},${p.y}`).join(' L ')}`;
  const area = fill ? `M ${points[0].x} ${height} L ${points.map(p => `${p.x},${p.y}`).join(' L ')} L ${points[points.length-1].x} ${height} Z` : path;
  
  return { path, area, width, height, minV, maxV };
}

/**
 * 🎯 COMPREHENSIVE STATS (Dashboard summary)
 */
export function calculateStatsSummary(sessions, modules) {
  const recentSessions = sessions.slice(-30);
  const accData = recentSessions.map(s => s.accuracy || 0);
  
  return {
    totalSessions: sessions.length,
    avgSession: formatDuration(average(recentSessions.map(s => s.engagedMs || 0))),
    consistency: Math.round(recentSessions.length / 30 * 100),
    trend: calculateTrend(accData),
    topModules: modules.slice(0, 3),
    gradeDistribution: calculateGradeDist(accData)
  };
}

function calculateGradeDist(data) {
  const grades = {};
  data.forEach(acc => {
    const g = grade(acc);
    grades[g] = (grades[g] || 0) + 1;
  });
  return grades;
}

/**
 * 🚀 VMQ HEATMAP INTENSITY (Practice patterns)
 */
export function getHeatmapIntensity(value) {
  return value === 0 ? '#f8fafc' :
         value === 1 ? '#e2e8f0' :
         value === 2 ? '#cbd5e1' :
         value === 3 ? '#3b82f6' :
         '#22c55e';
}
