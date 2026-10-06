export default function Logo({ className = 'h-9 w-9' }) {
  return (
    <svg className={className} viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill="url(#logo-gradient)" />
      <path
        d="M11 15.5a2.5 2.5 0 0 1 2.5-2.5h1.6l1.2-1.8c.2-.3.6-.5 1-.5h5.4c.4 0 .8.2 1 .5l1.2 1.8h1.6a2.5 2.5 0 0 1 2.5 2.5V26a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 11 26V15.5Z"
        stroke="white"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <circle cx="20" cy="20.5" r="3.6" stroke="white" strokeWidth="1.8" />
      <defs>
        <linearGradient id="logo-gradient" x1="0" y1="0" x2="40" y2="40">
          <stop stopColor="#2a6368" />
          <stop offset="1" stopColor="#388087" />
        </linearGradient>
      </defs>
    </svg>
  )
}