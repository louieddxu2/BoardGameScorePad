import React from 'react';

/** The rules site's own mark (玩錯的桌遊規則), kept in its brand colors in every theme. */
const RulesSiteLogo: React.FC<{ size?: number; className?: string }> = ({ size = 16, className }) => (
  <svg viewBox="0 0 512 512" width={size} height={size} className={className} aria-hidden="true" focusable="false">
    <rect width="512" height="512" rx="112" fill="#16352f" />
    <path d="M132 126h248v260H132z" fill="#f6f3eb" />
    <path d="M177 194h158M177 256h116M177 318h137" stroke="#d05b3f" strokeWidth="28" strokeLinecap="round" />
    <circle cx="356" cy="326" r="56" fill="#e9b44c" />
    <path d="m329 326 19 19 36-43" fill="none" stroke="#16352f" strokeWidth="18" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default RulesSiteLogo;
