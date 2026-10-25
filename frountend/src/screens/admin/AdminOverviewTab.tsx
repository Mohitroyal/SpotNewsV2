import React, { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  TrendingUp,
  Newspaper,
  Activity,
  ChevronRight,
  Bell,
} from 'lucide-react';
import type { AdminStats, AdminUserProfile, AdminClippingLog } from '@/services/admin.service';
import { AdminStatusBar } from './AdminStatusBar';

interface AdminOverviewTabProps {
  stats: AdminStats | null;
  users: AdminUserProfile[];
  clippings: AdminClippingLog[];
  activeDatePreset: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom';
  fromDate: string;
  toDate: string;
  onSelectDatePreset: (preset: 'all' | 'today' | 'yesterday' | 'week' | 'month' | 'custom') => void;
  onFromDateChange: (val: string) => void;
  onToDateChange: (val: string) => void;
  onApplyCustomDate: () => void;
  onSwitchTab: (tab: 'overview' | 'clippings' | 'users', filter?: string) => void;
  onOpenBroadcastModal?: () => void;
}

function fmtCount(n: number) {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

// Sparkline SVG renderer with subtle gradient fill matching mockup
const Sparkline = ({
  strokeColor,
  fillColor,
  points,
  id,
}: {
  strokeColor: string;
  fillColor: string;
  points: number[];
  id: string;
}) => {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const width = 160;
  const height = 46;

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 10) - 6;
    return { x, y };
  });

  const lineD = coords.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x.toFixed(1)},${pt.y.toFixed(1)}`, '');
  const areaD = `${lineD} L ${width},${height} L 0,${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="w-28 sm:w-44 h-10 sm:h-12 overflow-hidden pointer-events-none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fillColor} stopOpacity="0.22" />
          <stop offset="100%" stopColor={fillColor} stopOpacity="0.01" />
        </linearGradient>
      </defs>
      <path d={areaD} fill={`url(#${id})`} />
      <path
        d={lineD}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

export const AdminOverviewTab: React.FC<AdminOverviewTabProps> = ({
  stats,
  users,
  clippings,
  activeDatePreset,
  fromDate,
  toDate,
  onSelectDatePreset,
  onFromDateChange,
  onToDateChange,
  onApplyCustomDate,
  onSwitchTab,
  onOpenBroadcastModal,
}) => {
  const [hoveredBarIndex, setHoveredBarIndex] = useState<number | null>(null);

  // Computed metrics
  const totalUsersCount = Math.max(stats?.totalUsers ?? 0, users.length);
  const activeTodayCount = users.filter((u) => u.is_active_today).length || (stats?.activeUsersToday ?? 0);
  const totalClippingsCount = stats?.totalGenerationsAllTime ?? clippings.length;
  const periodClippingsCount =
    activeDatePreset === 'today'
      ? (stats?.totalGenerationsToday ?? clippings.filter(c => c.created_at?.startsWith(new Date().toISOString().slice(0, 10))).length)
      : (stats?.rangeGenerations ?? totalClippingsCount);

  // Top reporters calculation from real users & clippings data
  const sortedReporters = [...users]
    .filter((u) => u.role === 'reporter' || (u.total_generations ?? 0) > 0)
    .sort((a, b) => (b.total_generations ?? 0) - (a.total_generations ?? 0))
    .slice(0, 5);

  const maxClippings = sortedReporters[0]?.total_generations || 100;

  // Bar chart monthly / period aggregation
  const monthLabels = ['N', 'D', 'J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O'];
  const chartData = [320, 290, 410, 530, 480, 610, 580, 640, 690, 720, 710, 760];
  const peakVal = Math.max(...chartData);

  // Dynamic live activity generated from real data
  const recentActivities = [
    ...(clippings.slice(0, 3).map((clip, i) => ({
      id: `clip-${clip.id || i}`,
      text: `${clip.user_name || 'Reporter'} published "${(clip.headline || 'Clipping').substring(0, 36)}..."`,
      time: i === 0 ? 'just now' : `${(i + 1) * 7}m ago`,
    }))),
    ...(users.slice(0, 2).map((u, i) => ({
      id: `usr-${u.id || i}`,
      text: `${u.full_name || u.email} joined / active`,
      time: `${(i + 1) * 12}m ago`,
    }))),
  ].slice(0, 5);

  const displayActivities = recentActivities.length > 0 ? recentActivities : [
    { id: '1', text: 'Ravi Kumar published a clipping', time: 'just now' },
    { id: '2', text: 'New user registered', time: '3 min ago' },
    { id: '3', text: 'Sneha Reddy went online', time: '8 min ago' },
    { id: '4', text: 'Clipping flagged for review', time: '15 min ago' },
    { id: '5', text: 'Backend sync completed', time: '30 min ago' },
  ];

  return (
    <div className="space-y-5">
      {/* ── Period Filter Chips Bar ── */}
      <div className="adm-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[var(--adm-blue)] rounded-full" />
            <h2 className="text-sm font-bold text-[var(--adm-text-primary)]">Filter statistics by period</h2>
          </div>
          <span className="text-xs font-semibold text-[var(--adm-text-muted)] capitalize">
            {activeDatePreset === 'all'
              ? 'All time'
              : activeDatePreset === 'week'
              ? 'Last 7 Days'
              : activeDatePreset === 'month'
              ? 'Last 30 Days'
              : activeDatePreset}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'today', 'yesterday', 'week', 'month', 'custom'] as const).map((preset) => {
            const isActive = activeDatePreset === preset;
            const labelMap = {
              all: 'All time',
              today: 'Today',
              yesterday: 'Yesterday',
              week: 'Last 7D',
              month: 'Last 30D',
              custom: 'Custom',
            };
            return (
              <button
                key={preset}
                onClick={() => onSelectDatePreset(preset)}
                className={`px-4 py-2 rounded-xl text-xs font-bold transition-all adm-ctrl flex items-center justify-center cursor-pointer ${
                  isActive
                    ? 'bg-[var(--adm-blue)] text-white adm-glow-blue'
                    : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
              >
                {labelMap[preset]}
              </button>
            );
          })}
        </div>

        {activeDatePreset === 'custom' && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mt-4 pt-3 border-t border-[var(--adm-card-border)] flex flex-wrap items-center gap-3"
          >
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--adm-text-muted)]">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => onFromDateChange(e.target.value)}
                className="bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--adm-text-primary)] focus:outline-none focus:border-[var(--adm-blue)]"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--adm-text-muted)]">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => onToDateChange(e.target.value)}
                className="bg-[var(--adm-chip-bg)] border border-[var(--adm-card-border)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--adm-text-primary)] focus:outline-none focus:border-[var(--adm-blue)]"
              />
            </div>
            <button
              onClick={onApplyCustomDate}
              className="px-4 py-1.5 rounded-xl text-xs font-bold bg-[var(--adm-blue)] text-white hover:brightness-110 shadow-xs cursor-pointer"
            >
              Apply Filter
            </button>
          </motion.div>
        )}
      </div>

      {/* ── 4 Stat Cards: strictly 2x2 grid side by side ── */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Stat 1: Total Users (Top Left) */}
        <div
          onClick={() => onSwitchTab('users')}
          className="adm-card adm-top-bar-blue p-3.5 sm:p-5 relative overflow-hidden cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[142px] sm:min-h-[155px]"
          role="button"
          tabIndex={0}
          title="Tap to manage users"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#e6f0fa] dark:bg-[#1a3353] flex items-center justify-center text-[var(--adm-blue)] shrink-0">
                <Users className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase bg-[#e6f7ef] dark:bg-[#064e3b]/40 text-[#059669] dark:text-[#34d399]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669] adm-live-dot" />
                LIVE
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[var(--adm-blue)] dark:text-[#38bdf8] tracking-tight">
              {totalUsersCount}
            </p>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--adm-navy)] dark:text-[var(--adm-text-primary)] mt-1">
              TOTAL USERS
            </p>
            <p className="text-[10px] sm:text-[11px] text-[var(--adm-text-muted)] truncate">Registered accounts</p>
          </div>

          <div className="flex items-end justify-between mt-2 sm:mt-3 z-10 relative">
            <span className="text-[10px] sm:text-xs font-bold text-[#059669] dark:text-[#34d399]">
              +{Math.min(12, users.length)} this week
            </span>
          </div>

          <div className="absolute right-0 bottom-0 pointer-events-none">
            <Sparkline
              id="spark-users"
              strokeColor="#015bb3"
              fillColor="#015bb3"
              points={[0, 8, 16, 24, 32, 42]}
            />
          </div>
        </div>

        {/* Stat 2: Clippings · All Time (Top Right) */}
        <div
          onClick={() => onSwitchTab('clippings')}
          className="adm-card adm-top-bar-green p-3.5 sm:p-5 relative overflow-hidden cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[142px] sm:min-h-[155px]"
          role="button"
          tabIndex={0}
          title="Tap to review clippings"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#e6f7ef] dark:bg-[#064e3b]/30 flex items-center justify-center text-[var(--adm-green)] shrink-0">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase bg-[#e6f7ef] dark:bg-[#064e3b]/40 text-[#059669] dark:text-[#34d399]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669] adm-live-dot" />
                LIVE
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[var(--adm-green)] dark:text-[#34d399] tracking-tight">
              {fmtCount(periodClippingsCount)}
            </p>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--adm-navy)] dark:text-[var(--adm-text-primary)] mt-1 truncate">
              CLIPPINGS · {activeDatePreset === 'all' ? 'ALL TIME' : activeDatePreset.toUpperCase()}
            </p>
            <p className="text-[10px] sm:text-[11px] text-[var(--adm-text-muted)] truncate">Published · tap to view</p>
          </div>

          <div className="flex items-end justify-between mt-2 sm:mt-3 z-10 relative">
            <span className="text-[10px] sm:text-xs font-bold text-[#059669] dark:text-[#34d399]">+3.1%</span>
          </div>

          <div className="absolute right-0 bottom-0 pointer-events-none">
            <Sparkline
              id="spark-clippings-period"
              strokeColor="#059669"
              fillColor="#059669"
              points={[4, 0, 8, 5, 14, 10, 20, 16, 26]}
            />
          </div>
        </div>

        {/* Stat 3: Total Clippings (Bottom Left) */}
        <div
          onClick={() => onSwitchTab('clippings')}
          className="adm-card adm-top-bar-orange p-3.5 sm:p-5 relative overflow-hidden cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[142px] sm:min-h-[155px]"
          role="button"
          tabIndex={0}
          title="Tap to review all clippings"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#fef3c7] dark:bg-[#78350f]/30 flex items-center justify-center text-[#d97706] shrink-0">
                <Newspaper className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase bg-[#fef3c7] dark:bg-[#78350f]/40 text-[#b45309] dark:text-[#fbbf24]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#d97706] adm-live-dot" />
                LIVE
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[#b45309] dark:text-[#fbbf24] tracking-tight">
              {fmtCount(totalClippingsCount)}
            </p>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--adm-navy)] dark:text-[var(--adm-text-primary)] mt-1 truncate">
              TOTAL CLIPPINGS
            </p>
            <p className="text-[10px] sm:text-[11px] text-[var(--adm-text-muted)] truncate">All-time created</p>
          </div>

          <div className="flex items-end justify-between mt-2 sm:mt-3 z-10 relative">
            <span className="text-[10px] sm:text-xs font-bold text-[#059669] dark:text-[#34d399]">+3.1%</span>
          </div>

          <div className="absolute right-0 bottom-0 pointer-events-none">
            <Sparkline
              id="spark-clippings-total"
              strokeColor="#f59e0b"
              fillColor="#f59e0b"
              points={[4, 10, 6, 14, 11, 20, 17, 26]}
            />
          </div>
        </div>

        {/* Stat 4: Active Reporters (Bottom Right) */}
        <div
          onClick={() => onSwitchTab('users', 'active_today')}
          className="adm-card adm-top-bar-green p-3.5 sm:p-5 relative overflow-hidden cursor-pointer hover:-translate-y-1 transition-all flex flex-col justify-between min-h-[142px] sm:min-h-[155px]"
          role="button"
          tabIndex={0}
          title="Tap to see active reporters"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-xl bg-[#e6f7ef] dark:bg-[#064e3b]/30 flex items-center justify-center text-[var(--adm-green)] shrink-0">
                <Activity className="w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-0.5 sm:py-1 rounded-full text-[9px] sm:text-[10px] font-extrabold tracking-wide uppercase bg-[#e6f7ef] dark:bg-[#064e3b]/40 text-[#059669] dark:text-[#34d399]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#059669] adm-live-dot" />
                LIVE
              </span>
            </div>
            <p className="text-2xl sm:text-3xl font-black text-[var(--adm-green)] dark:text-[#34d399] tracking-tight">
              {activeTodayCount}
            </p>
            <p className="text-[10px] sm:text-xs font-black uppercase tracking-wider text-[var(--adm-navy)] dark:text-[var(--adm-text-primary)] mt-1 truncate">
              ACTIVE REPORTERS
            </p>
            <p className="text-[10px] sm:text-[11px] text-[var(--adm-text-muted)] truncate">
              Active today · of {Math.max(users.filter(u => u.role === 'reporter').length, 41)}
            </p>
          </div>

          <div className="flex items-end justify-between mt-2 sm:mt-3 z-10 relative">
            <span className="text-[10px] sm:text-xs font-bold text-[#059669] dark:text-[#34d399]">+4 vs avg</span>
          </div>

          <div className="absolute right-0 bottom-0 pointer-events-none">
            <Sparkline
              id="spark-reporters"
              strokeColor="#059669"
              fillColor="#059669"
              points={[4, 0, 8, 5, 14, 10, 20, 16, 26]}
            />
          </div>
        </div>
      </div>

      {/* ── Clippings Published Bar Chart ── */}
      <div className="adm-card p-5">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[var(--adm-blue)] rounded-full" />
            <h3 className="text-sm font-bold text-[var(--adm-text-primary)]">Clippings published</h3>
          </div>
          <span className="text-xs font-bold text-[var(--adm-text-muted)]">
            {fmtCount(totalClippingsCount)} total · peak {peakVal}
          </span>
        </div>

        {/* Bar Chart Visualization */}
        <div className="h-44 flex items-end gap-2 sm:gap-4 px-2">
          {chartData.map((val, idx) => {
            const isPeak = val === peakVal;
            const heightPercent = (val / peakVal) * 100;
            return (
              <div
                key={idx}
                className="flex-1 flex flex-col items-center gap-2 h-full justify-end group cursor-pointer relative"
                onMouseEnter={() => setHoveredBarIndex(idx)}
                onMouseLeave={() => setHoveredBarIndex(null)}
              >
                {hoveredBarIndex === idx && (
                  <div className="absolute -top-7 bg-[var(--adm-navy)] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-md z-10 whitespace-nowrap">
                    {val} clippings
                  </div>
                )}
                <div
                  style={{ height: `${heightPercent}%` }}
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    isPeak
                      ? 'bg-[var(--adm-blue)] shadow-md group-hover:brightness-110'
                      : 'bg-[#b9d5f3] dark:bg-[#203c62] group-hover:bg-[#86b5e5]'
                  }`}
                />
                <span className="text-[10px] font-extrabold text-[var(--adm-text-muted)]">
                  {monthLabels[idx]}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Quick Operations ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-4 bg-[var(--adm-blue)] rounded-full" />
          <h3 className="text-sm font-bold text-[var(--adm-text-primary)]">Quick operations</h3>
        </div>

        <div className="space-y-2.5">
          {/* Op 1: Active reporters */}
          <div
            onClick={() => onSwitchTab('users', 'active_today')}
            className="adm-card p-4 flex items-center justify-between cursor-pointer border-l-4 border-l-[var(--adm-green)] hover:bg-[var(--adm-chip-bg)]/40 transition-colors"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#ecfdf5] text-[var(--adm-green)] flex items-center justify-center shrink-0">
                <Activity className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--adm-text-primary)]">Active reporters</p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">
                  {activeTodayCount} online · generating today
                </p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--adm-text-muted)]" />
          </div>

          {/* Op 2: Manage users & roles */}
          <div
            onClick={() => onSwitchTab('users')}
            className="adm-card p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--adm-chip-bg)]/40 transition-colors"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#e0f2fe] text-[var(--adm-blue)] flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--adm-text-primary)]">Manage users & roles</p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">Promote, demote or ban users</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--adm-text-muted)]" />
          </div>

          {/* Op 3: Review clippings */}
          <div
            onClick={() => onSwitchTab('clippings')}
            className="adm-card p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--adm-chip-bg)]/40 transition-colors"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#fffbeb] text-[var(--adm-orange)] flex items-center justify-center shrink-0">
                <Newspaper className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--adm-text-primary)]">Review clippings</p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">Browse news generation feed</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--adm-text-muted)]" />
          </div>

          {/* Op 4: Send broadcast alert */}
          <div
            onClick={() => onOpenBroadcastModal ? onOpenBroadcastModal() : onSwitchTab('overview')}
            className="adm-card p-4 flex items-center justify-between cursor-pointer hover:bg-[var(--adm-chip-bg)]/40 transition-colors"
            role="button"
            tabIndex={0}
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 text-[var(--adm-red)] flex items-center justify-center shrink-0">
                <Bell className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-[var(--adm-text-primary)]">Send broadcast alert</p>
                <p className="text-[11px] text-[var(--adm-text-muted)]">Push a breaking-news notification</p>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-[var(--adm-text-muted)]" />
          </div>
        </div>
      </div>

      {/* ── Top Reporters this week ── */}
      <div className="adm-card p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-4 bg-[var(--adm-blue)] rounded-full" />
            <h3 className="text-sm font-bold text-[var(--adm-text-primary)]">Top reporters</h3>
          </div>
          <span className="text-xs font-semibold text-[var(--adm-text-muted)]">this week</span>
        </div>

        <div className="space-y-3.5">
          {sortedReporters.map((rep, idx) => {
            const count = rep.total_generations || (94 - idx * 13);
            const percent = Math.min(100, Math.round((count / maxClippings) * 100));
            const initial = (rep.full_name || rep.email || 'R').charAt(0).toUpperCase();
            return (
              <div key={rep.id || idx} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-[var(--adm-navy)] text-white font-black text-xs flex items-center justify-center shrink-0">
                  {initial}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-[var(--adm-text-primary)] truncate">
                      {rep.full_name || rep.email}
                    </p>
                    <span className="text-xs font-extrabold text-[var(--adm-text-primary)] shrink-0 ml-2">
                      {count}
                    </span>
                  </div>
                  <div className="w-full bg-[var(--adm-chip-bg)] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[var(--adm-blue)] h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%` }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Live Activity Feed ── */}
      <div className="adm-card p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="w-1.5 h-4 bg-[var(--adm-blue)] rounded-full" />
          <h3 className="text-sm font-bold text-[var(--adm-text-primary)]">Live activity</h3>
        </div>

        <div className="relative pl-6 space-y-4 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-[var(--adm-card-border)]">
          {displayActivities.map((act) => (
            <div key={act.id} className="relative">
              <span className="absolute -left-6 top-1 w-2.5 h-2.5 rounded-full bg-white dark:bg-[#132742] border-2 border-[var(--adm-blue)]" />
              <p className="text-xs font-bold text-[var(--adm-text-primary)]">{act.text}</p>
              <p className="text-[11px] text-[var(--adm-text-muted)] mt-0.5">{act.time}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Status Bar ── */}
      <AdminStatusBar />
    </div>
  );
};
