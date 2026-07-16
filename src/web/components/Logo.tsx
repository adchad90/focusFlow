export default function Logo({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="url(#logo-grad)" stroke="#333340" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 17L12 22L22 17" stroke="#5a5a65" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M2 12L12 17L22 12" stroke="#444450" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <defs>
        <linearGradient id="logo-grad" x1="2" y1="2" x2="22" y2="12" gradientUnits="userSpaceOnUse">
          <stop stopColor="#6366f1"/>
          <stop offset="1" stopColor="#4f46e5"/>
        </linearGradient>
      </defs>
    </svg>
  );
}
