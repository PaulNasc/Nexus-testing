import React from 'react';

type IconProps = React.SVGProps<SVGSVGElement> & {
  size?: number | string;
  className?: string;
};

/**
 * 🎨 Nexus TCMS Custom Icon Suite
 * Identidade visual própria, minimalista, geométrica com cantos arredondados (rounded joints)
 */

export const NexusDashboardIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <rect x="3" y="3" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <rect x="13.5" y="3" width="7.5" height="4.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <rect x="13.5" y="10.5" width="7.5" height="10.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <rect x="3" y="13.5" width="7.5" height="7.5" rx="2" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="6.75" cy="6.75" r="1" fill="currentColor" />
  </svg>
);

export const NexusTestPlanIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <rect x="3.5" y="3.5" width="17" height="17" rx="3" stroke="currentColor" strokeWidth="1.75" />
    <path d="M8 8H16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M8 12H16" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M8 16H12.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <circle cx="15.5" cy="16" r="1.25" fill="currentColor" />
  </svg>
);

export const NexusTestCaseIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <path d="M8.5 2.5H15.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M10 2.5V7.5L5 17.5C4.2 19 5.3 21 7 21H17C18.7 21 19.8 19 19 17.5L14 7.5V2.5" stroke="currentColor" strokeWidth="1.75" strokeLinejoin="round" />
    <path d="M7.5 15.5C9.5 14.5 14.5 14.5 16.5 15.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <circle cx="12" cy="11" r="1" fill="currentColor" />
  </svg>
);

export const NexusExecutionIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
    <path d="M10 8.5L16 12L10 15.5V8.5Z" fill="currentColor" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
  </svg>
);

export const NexusCyclesIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <path d="M4 12C4 7.58172 7.58172 4 12 4C15.1484 4 17.8687 5.81434 19.167 8.44444" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M20 12C20 16.4183 16.4183 20 12 20C8.85164 20 6.13127 18.1857 4.83298 15.5556" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <polyline points="19.5 4 19.5 8.5 15 8.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
    <polyline points="4.5 20 4.5 15.5 9 15.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const NexusManagementIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <rect x="3" y="4" width="18" height="16" rx="2.5" stroke="currentColor" strokeWidth="1.75" />
    <line x1="9" y1="4" x2="9" y2="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    <line x1="15" y1="4" x2="15" y2="20" stroke="currentColor" strokeWidth="1.5" strokeDasharray="2 2" />
    <rect x="5" y="7" width="2" height="4" rx="0.5" fill="currentColor" />
    <rect x="11" y="7" width="2" height="6" rx="0.5" fill="currentColor" />
    <rect x="17" y="7" width="2" height="3" rx="0.5" fill="currentColor" />
  </svg>
);

export const NexusReportsIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <path d="M4 19.5H20" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <rect x="6" y="11" width="3" height="6" rx="1" fill="currentColor" fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" />
    <rect x="11" y="7" width="3" height="10" rx="1" fill="currentColor" stroke="currentColor" strokeWidth="1.5" />
    <rect x="16" y="4" width="3" height="13" rx="1" fill="currentColor" fillOpacity="0.8" stroke="currentColor" strokeWidth="1.5" />
  </svg>
);

export const NexusProjectsAdminIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <path d="M3.5 6.5C3.5 5.39543 4.39543 4.5 5.5 4.5H9.2C9.8 4.5 10.3 4.8 10.7 5.2L11.8 6.8C12.2 7.2 12.7 7.5 13.3 7.5H18.5C19.6046 7.5 20.5 8.39543 20.5 9.5V17.5C20.5 18.6046 19.6046 19.5 18.5 19.5H5.5C4.39543 19.5 3.5 18.6046 3.5 17.5V6.5Z" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="12" cy="13.5" r="2" fill="currentColor" />
  </svg>
);

export const NexusUsersIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <circle cx="9" cy="8" r="3.5" stroke="currentColor" strokeWidth="1.75" />
    <path d="M3 18.5C3 15.5 5.5 14 9 14C12.5 14 15 15.5 15 18.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <path d="M16 8C17.6569 8 19 9.34315 19 11C19 12.6569 17.6569 14 16 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    <path d="M18 18C19.5 18 21 17 21 15C21 13.8 20.2 12.8 19 12.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
  </svg>
);

export const NexusAIIcon: React.FC<IconProps> = ({ size = 20, className = '', ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} {...props}>
    <rect x="5" y="5" width="14" height="14" rx="3.5" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="12" cy="12" r="2.5" fill="currentColor" />
    <line x1="12" y1="1.5" x2="12" y2="4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <line x1="12" y1="20" x2="12" y2="22.5" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <line x1="1.5" y1="12" x2="4" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    <line x1="20" y1="12" x2="22.5" y2="12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
  </svg>
);
