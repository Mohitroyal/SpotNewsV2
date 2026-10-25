import React from 'react';

interface AdminStatusBarProps {
  apiLatency?: number;
  dbStatus?: string;
  uptime?: string;
}

export const AdminStatusBar: React.FC<AdminStatusBarProps> = ({
  apiLatency = 142,
  dbStatus = 'DB healthy',
  uptime = '99.98% uptime',
}) => {
  return (
    <footer className="mt-8 border-t border-[var(--adm-card-border)] pt-4 pb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-[var(--adm-text-secondary)]">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[var(--adm-green)] adm-live-dot" />
          <span className="font-bold text-[var(--adm-text-primary)]">Production engine active</span>
          <span className="hidden sm:inline text-[var(--adm-text-muted)]">·</span>
          <span className="hidden sm:inline text-[var(--adm-text-muted)]">Backend v1.0 · Supabase secure RLS</span>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--adm-chip-bg)] text-[var(--adm-navy)] border border-[var(--adm-card-border)]">
            API {apiLatency} ms
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#ecfdf5] text-[var(--adm-green)] border border-[#a7f3d0]">
            {dbStatus}
          </span>
          <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-[var(--adm-chip-bg)] text-[var(--adm-text-secondary)] border border-[var(--adm-card-border)]">
            {uptime}
          </span>
        </div>
      </div>
    </footer>
  );
};
