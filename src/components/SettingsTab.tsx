import React from 'react';

interface SettingsTabProps {
  staff: any;
}

export const SettingsTab: React.FC<SettingsTabProps> = ({ staff }) => {
  return (
    <div className="p-8 text-center text-slate-500 font-bold uppercase tracking-widest text-sm">
      Settings and Configuration have been moved to your Header Profile.
    </div>
  );
};
