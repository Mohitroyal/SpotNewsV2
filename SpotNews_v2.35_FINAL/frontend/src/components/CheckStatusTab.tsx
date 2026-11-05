import React, { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { reporterApprovalService } from '@/services/reporterApproval.service';
import { routeByStatus } from '@/utils/statusRouting';

export const CheckStatusTab: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);

  const [identifierError, setIdentifierError] = useState('');
  const [notFoundError, setNotFoundError] = useState('');

  const navigate = useNavigate();

  const handleCheckStatus = async (e: React.FormEvent) => {
    e.preventDefault();

    setIdentifierError('');
    setNotFoundError('');

    if (!identifier.trim()) {
      setIdentifierError('Phone or Email is required');
      return;
    }

    setLoading(true);
    try {
      const appData = await reporterApprovalService.checkStatus(identifier.trim());
      if (appData && appData.status) {
        routeByStatus(appData.status, navigate, appData);
      } else {
        setNotFoundError('No application found. Check your details and try again.');
      }
    } catch (err: any) {
      setNotFoundError('Failed to check status. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleCheckStatus} className="space-y-4">
      {notFoundError && (
        <div className="p-3 bg-red-50 border border-[#CC1E1E] rounded-[10px] text-[#CC1E1E] text-xs font-semibold text-center shadow-sm">
          {notFoundError}
        </div>
      )}

      {/* Input: Phone or Email */}
      <div>
        <div className="relative">
          <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#0F487F]" />
          <input
            type="text"
            placeholder="Phone or Email"
            value={identifier}
            onChange={(e) => {
              setIdentifier(e.target.value);
              if (identifierError) setIdentifierError('');
              if (notFoundError) setNotFoundError('');
            }}
            className={`w-full bg-white border ${identifierError ? 'border-red-500' : 'border-[#D6E4F5]'} rounded-[10px] py-[11px] pl-[38px] pr-3 text-[#0F172A] text-sm placeholder:text-[#94A3B8] focus:outline-none focus:border-[#015BB3] focus:ring-2 focus:ring-[#015BB3]/15 transition-all shadow-sm font-medium`}
          />
        </div>
        {identifierError && (
          <span className="text-[11px] text-[#CC1E1E] font-semibold mt-1 block pl-1">
            {identifierError}
          </span>
        )}
      </div>

      {/* Red Button "Check Status" */}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-[12px] mt-2 bg-[#CC1E1E] hover:bg-[#b51919] active:bg-[#991515] text-white rounded-[10px] font-bold text-[15px] font-serif tracking-wide transition-all shadow-[0_2px_8px_rgba(204,30,30,0.25)] flex items-center justify-center disabled:opacity-70 cursor-pointer"
      >
        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Check Status'}
      </button>


    </form>
  );
};
