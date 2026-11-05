import type { ReporterApplicationStatus, ReporterApplicationDetails } from '@/types/reporterApproval';

export const routeByStatus = (
  status: ReporterApplicationStatus,
  navigate: (path: string, options?: { state?: { appData?: ReporterApplicationDetails } }) => void,
  appData?: ReporterApplicationDetails
) => {
  const options = appData ? { state: { appData } } : undefined;

  switch (status) {
    case 'PENDING':
      navigate('/reporter/waiting', options);
      break;
    case 'APPROVED_PAYMENT_PENDING':
      navigate('/reporter/payment', options);
      break;
    case 'PAYMENT_PENDING':
      navigate('/reporter/payment-pending', options);
      break;
    case 'PAYMENT_FAILED':
      navigate('/reporter/payment-failed', options);
      break;
    case 'PAID_GENERATING':
      navigate('/reporter/generating', options);
      break;
    case 'ACTIVE':
      navigate('/reporter/activated', options);
      break;
    case 'REJECTED':
      navigate('/reporter/rejected', options);
      break;
    default:
      navigate('/reporter/waiting', options);
      break;
  }
};
