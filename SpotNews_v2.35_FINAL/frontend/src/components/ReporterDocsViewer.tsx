import React, { useState } from 'react';
import { Eye, Loader2 } from 'lucide-react';
import { reporterAccountService } from '@/services/reporterAccount.service';

/** Super admin: photo + "View Aadhaar" / "View old press ID" (private, 10-minute links). */
export const ReporterDocsViewer: React.FC<{ app: any }> = ({ app }) => {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState('');
  const open = async (path: string, key: string) => {
    setBusy(key); setErr('');
    try {
      const url = await reporterAccountService.docViewUrl(path);
      window.open(url, '_blank');
    } catch (e: any) {
      setErr(e?.message || 'Could not open');
    } finally {
      setBusy(null);
    }
  };
  if (!app?.photo_url && !app?.aadhaar_doc_path && !app?.press_id_doc_path && !app?.terms_accepted_at) return null;
  return (
    <div className="flex items-center gap-3 mt-2">
      {app.photo_url && <img src={app.photo_url} alt="Reporter" className="w-16 h-16 rounded-xl object-cover border border-[var(--adm-card-border)]" />}
      <div className="flex flex-col gap-1.5">
        {app.aadhaar_doc_path && (
          <button type="button" onClick={() => open(app.aadhaar_doc_path, 'a')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--adm-blue)] text-white text-[13px] font-bold border-0 cursor-pointer">
            {busy === 'a' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} View Aadhaar
          </button>
        )}
        {app.press_id_doc_path && (
          <button type="button" onClick={() => open(app.press_id_doc_path, 'p')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white text-[var(--adm-blue)] text-[13px] font-bold border border-[var(--adm-blue)] cursor-pointer">
            {busy === 'p' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />} View old press ID
          </button>
        )}
        <span className={`text-[12.5px] font-bold ${app.terms_accepted_at ? 'text-green-700' : 'text-amber-700'}`}>
          {app.terms_accepted_at
            ? `✓ Accepted publishing rules & fake-news responsibility (${new Date(app.terms_accepted_at).toLocaleDateString('en-IN')})`
            : '⚠ Publishing rules not accepted (old application)'}
        </span>
        {err && <span className="text-[12px] text-red-600 font-semibold">{err}</span>}
      </div>
    </div>
  );
};
