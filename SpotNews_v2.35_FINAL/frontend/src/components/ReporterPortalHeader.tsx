import { useNavigate } from 'react-router-dom';
import { BrandHeader } from '@/components/BrandHeader';

/** Same masthead + double curve as the home screen (one design everywhere). */
export const ReporterPortalHeader = () => {
  const navigate = useNavigate();
  return <BrandHeader badge="Reporter Portal" onBack={() => navigate(-1)} waveFill="#EAF2FB" />;
};
