import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { XCircle, RefreshCw } from 'lucide-react';
import { ReporterPortalHeader } from '@/components/ReporterPortalHeader';
import type { ReporterApplicationDetails } from '@/types/reporterApproval';

export const ApplicationRejectedScreen: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const appData: ReporterApplicationDetails = location.state?.appData || {
    refNo: 'SNP-REF-889021',
    name: 'Reporter Candidate',
    email: 'reporter@example.com',
    phone: '9876543210',
    submittedDate: new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
    status: 'REJECTED',
    rejectionReason: 'Document verification failed. The provided Press ID or Aadhar card details could not be authenticated.',
  };

  const handleReapply = () => {
    // Navigate back to LoginScreen with active tab set to apply
    navigate('/login', { state: { defaultTab: 'apply' } });
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#EAF2FB] relative font-sans text-[#0F172A] overflow-x-hidden">
      <ReporterPortalHeader />

      <div className="flex-1 flex flex-col items-center justify-center px-4 py-6 relative z-10">
        <div className="w-full max-w-md bg-white border border-[#D6E4F5] rounded-[16px] p-6 sm:p-8 shadow-[0_4px_20px_rgba(18,84,168,0.08)]">
          
          {/* Header section */}
          <div className="mb-5 flex flex-col items-start">
            <div className="bg-[#EAF2FB] border border-[#D6E4F5] text-[#0F487F] text-[9.5px] uppercase tracking-wider font-extrabold py-1 px-2.5 rounded-full mb-2.5 shadow-sm">
              SPOT NEWS PORTAL
            </div>
            <h1 className="text-[#163E6C] text-2xl font-bold font-serif mb-1.5" style={{ fontFamily: "'Georgia', serif" }}>
              Application rejected
            </h1>
            <div className="w-12 h-[3px] bg-[#CC1E1E] rounded-full"></div>
          </div>

          {/* Red-tint Box with Reason */}
          <div className="bg-red-50/90 border border-red-200 rounded-[14px] p-5 mb-6 flex flex-col items-center text-center shadow-sm">
            <div className="w-14 h-14 rounded-full bg-red-100 border border-red-300 text-[#CC1E1E] flex items-center justify-center mb-3 shadow-inner">
              <XCircle className="w-8 h-8" />
            </div>

            <h2 className="text-[#CC1E1E] font-bold text-lg mb-2 font-serif">
              Application Not Approved
            </h2>

            <div className="bg-white border border-red-200 rounded-[10px] p-3.5 w-full text-left mb-2">
              <span className="text-[10.5px] uppercase font-bold text-gray-500 tracking-wider block mb-1">
                Reason for Rejection
              </span>
              <p className="text-gray-800 text-xs leading-relaxed font-medium">
                {appData.rejectionReason || 'Document verification failed. Please ensure all details and documents submitted are valid.'}
              </p>
            </div>

            <span className="text-[11px] text-gray-500 font-medium">
              Ref No: <strong className="font-mono text-gray-700">{appData.refNo}</strong>
            </span>
          </div>

          {/* Red Button "Reapply" */}
          <button
            type="button"
            onClick={handleReapply}
            className="w-full py-[12px] bg-[#CC1E1E] hover:bg-[#b51919] active:bg-[#991515] text-white rounded-[10px] font-bold text-[15px] font-serif tracking-wide transition-all shadow-[0_2px_8px_rgba(204,30,30,0.25)] flex items-center justify-center gap-2 cursor-pointer"
          >
            <RefreshCw className="w-4 h-4 text-white" />
            Reapply
          </button>

        </div>
      </div>
    </div>
  );
};
