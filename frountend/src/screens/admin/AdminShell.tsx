import React from 'react';
import {
  ArrowLeft,
  RefreshCw,
  Moon,
  Sun,
  Crown,
  BarChart3,
  Newspaper,
  Users,
  Image as ImageIcon,
} from 'lucide-react';
import mastheadLogo from '../../assets/rti_express_logo.png';

interface AdminShellProps {
  adminEmail?: string;
  isSuperAdmin?: boolean;
  activeTab: 'overview' | 'clippings' | 'users' | 'daily_editions' | 'logos' | 'applications' | 'notifications' | 'local_ads' | 'redemptions';
  pendingClippingsCount: number;
  pendingApplicationsCount?: number;
  totalUsersCount: number;
  logosCount?: number;
  isDarkMode: boolean;
  refreshing: boolean;
  onNavigateApp: () => void;
  onRefresh: () => void;
  onToggleTheme: () => void;
  onLogout?: () => void;
  onSelectTab: (tab: any) => void;
  children: React.ReactNode;
}

export const AdminShell: React.FC<AdminShellProps> = ({
  adminEmail,
  isSuperAdmin,
  activeTab,
  pendingClippingsCount,
  pendingApplicationsCount = 0,
  totalUsersCount,
  logosCount,
  isDarkMode,
  refreshing,
  onNavigateApp,
  onRefresh,
  onToggleTheme,
  onSelectTab,
  children,
}) => {
  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });

  return (
    <div className={`adm-root ${isDarkMode ? 'adm-dark' : ''} transition-colors duration-200`}>
      {/* ── Hero Header ── */}
      <header className="w-full bg-[#015bb3] text-white shadow-md">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          {/* Logo & Brand */}
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 bg-white p-1 rounded-2xl flex items-center justify-center shrink-0 shadow-xs">
              <img src={mastheadLogo} alt=" RTI Express Spot News" className="h-full w-auto object-contain" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1
                  className="text-white text-lg font-black tracking-wide leading-tight"
                  style={{ fontFamily: "'Plus Jakarta Sans', Georgia, serif" }}
                >
                  RTI ExpressSpot News 24x7
                </h1>
                <span className="bg-[#ffb900] text-[#0a2540] text-[9.5px] font-black uppercase px-2 py-0.5 rounded-md shadow-xs">
                  {isSuperAdmin ? 'SUPERADMIN' : 'ADMIN'}
                </span>
              </div>
              <p className="text-white/80 text-[11px] font-medium">Control Center & Operations</p>
            </div>
          </div>

          {/* Controls: Refresh on left, App on right */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={onRefresh}
              disabled={refreshing}
              className="w-9 h-9 rounded-xl flex items-center justify-center bg-white/15 text-white hover:bg-white/25 active:scale-95 transition cursor-pointer"
              title="Refresh Data"
            >
              <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>

            <button
              onClick={onNavigateApp}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 bg-white/15 text-white hover:bg-white/25 active:scale-95 transition cursor-pointer"
              title="Return to App"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>App</span>
            </button>
          </div>
        </div>

        {/* ── Sub-strip with Admin Email & Today's Date + Theme Toggle ── */}
        <div className="bg-[#0e2c56]/60 border-t border-white/10 px-4 py-2">
          <div className="max-w-6xl mx-auto flex items-center justify-between text-xs text-white/90">
            <div className="flex items-center gap-2 truncate">
              <Crown className="w-3.5 h-3.5 text-[#ffb900] shrink-0" />
              <span className="truncate text-xs font-medium">
                Admin: <strong className="text-white font-bold">{adminEmail}</strong>
              </span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-[11px] font-semibold text-white/80 shrink-0">
                {todayFormatted}
              </span>
              <button
                onClick={onToggleTheme}
                className="w-7 h-7 rounded-xl flex items-center justify-center bg-white/15 text-white hover:bg-white/25 active:scale-95 transition cursor-pointer"
                title={isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              >
                {isDarkMode ? <Sun className="w-3.5 h-3.5 text-amber-300" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Segmented Navigation Tabs ── */}
      <div className="max-w-6xl mx-auto px-4 pt-4">
        <div className="bg-[#dee9f5] dark:bg-[#10243d] border border-[var(--adm-card-border)] rounded-2xl p-1.5 flex items-center gap-1.5 shadow-sm">
          {/* Overview Tab */}
          <button
            onClick={() => onSelectTab('overview')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all adm-ctrl cursor-pointer ${activeTab === 'overview'
              ? 'bg-[#015bb3] text-white adm-glow-blue shadow-sm'
              : 'text-[var(--adm-text-secondary)] hover:bg-white/40 dark:hover:bg-white/10'
              }`}
          >
            <BarChart3 className="w-4 h-4" />
            <span>Overview</span>
          </button>

          {/* Clippings Tab */}
          <button
            onClick={() => onSelectTab('clippings')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all adm-ctrl cursor-pointer relative ${activeTab === 'clippings'
              ? 'bg-[#015bb3] text-white adm-glow-blue shadow-sm'
              : 'text-[var(--adm-text-secondary)] hover:bg-white/40 dark:hover:bg-white/10'
              }`}
          >
            <Newspaper className="w-4 h-4" />
            <span>Clippings</span>
            {pendingClippingsCount > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-[var(--adm-orange)] text-white shadow-xs">
                {pendingClippingsCount}
              </span>
            )}
          </button>

          {/* Users Tab */}
          <button
            onClick={() => onSelectTab('users')}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-bold transition-all adm-ctrl cursor-pointer ${activeTab === 'users'
              ? 'bg-[#015bb3] text-white adm-glow-blue shadow-sm'
              : 'text-[var(--adm-text-secondary)] hover:bg-white/40 dark:hover:bg-white/10'
              }`}
          >
            <Users className="w-4 h-4" />
            <span>Users ({totalUsersCount})</span>
          </button>
        </div>

        {/* Superadmin secondary tab selector if present */}
        {isSuperAdmin && (
          <div className="flex items-center gap-1.5 mt-2 overflow-x-auto pb-1 scrollbar-none">
            <span className="text-[10px] font-extrabold text-[var(--adm-text-muted)] uppercase tracking-wider shrink-0 mr-1">
              Superadmin Tools:
            </span>
            <button
              onClick={() => onSelectTab('daily_editions')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${activeTab === 'daily_editions'
                ? 'bg-[var(--adm-blue)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
            >
              Daily Editions
            </button>
            <button
              onClick={() => onSelectTab('logos')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition flex items-center gap-1.5 ${activeTab === 'logos'
                ? 'bg-[var(--adm-blue)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
            >
              <ImageIcon className="w-3.5 h-3.5" />
              <span>Logos {logosCount !== undefined ? `(${logosCount})` : ''}</span>
            </button>
            <button
              onClick={() => onSelectTab('applications')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition flex items-center gap-1.5 ${activeTab === 'applications'
                ? 'bg-[var(--adm-blue)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
            >
              <span>Reporter Requests</span>
              {pendingApplicationsCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-black bg-[var(--adm-orange)] text-white shadow-xs">
                  {pendingApplicationsCount}
                </span>
              )}
            </button>
            <button
              onClick={() => onSelectTab('notifications')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${activeTab === 'notifications'
                ? 'bg-[var(--adm-blue)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
            >
              Push Broadcast
            </button>
            <button
              onClick={() => onSelectTab('local_ads')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition ${activeTab === 'local_ads'
                ? 'bg-[var(--adm-blue)] text-white'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
            >
              Local Ads
            </button>
            <button
              onClick={() => onSelectTab('redemptions')}
              className={`px-3 py-1 rounded-lg text-[11px] font-bold shrink-0 transition flex items-center gap-1 ${activeTab === 'redemptions'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] hover:bg-[#d5e4f5]'
                }`}
            >
              <span>💰 Redemptions</span>
            </button>
          </div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      <main className="max-w-6xl mx-auto px-4 pt-4 pb-20">
        {children}
      </main>
    </div>
  );
};
