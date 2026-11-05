import React from 'react';
import { useNavigate } from 'react-router-dom';
import { BrandHeader } from '@/components/BrandHeader';

interface FigmaScreenHeaderProps {
  showStatusBar?: boolean; // kept for compatibility (ignored)
  title?: string;
}

/** Reporter screens use the same masthead + double curve as the home screen. */
export const FigmaScreenHeader: React.FC<FigmaScreenHeaderProps> = ({ title }) => {
  const navigate = useNavigate();
  return <BrandHeader badge="Reporter Portal" title={title} onBack={() => navigate(-1)} waveFill="#F8FAFC" />;
};
