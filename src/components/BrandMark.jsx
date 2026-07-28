export default function BrandMark({
  className = "",
  compact = false,
}) {
  return (
    <span
      className={`breakveil-brand ${className}`.trim()}
      aria-label="BreakVeil AI"
    >
      <span
        className="breakveil-brand-mark"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 64 64"
          focusable="false"
        >
          <defs>
            <linearGradient
              id="breakveil-mark-gradient"
              x1="10"
              y1="10"
              x2="54"
              y2="54"
              gradientUnits="userSpaceOnUse"
            >
              <stop stopColor="#38bdf8" />
              <stop offset="1" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          <rect
            x="2"
            y="2"
            width="60"
            height="60"
            rx="16"
            fill="#10131b"
            stroke="url(#breakveil-mark-gradient)"
            strokeWidth="2"
          />

          <path
            d="M15 15v34h11c6.5 0 10.5-3.6 10.5-9 0-4.2-2.3-7.1-6-8.4 3.1-1.5 5-4.1 5-7.7C35.5 18.5 31.6 15 25 15H15Zm7 6h3c2.7 0 4.2 1.4 4.2 3.7 0 2.4-1.5 3.8-4.2 3.8h-3V21Zm0 13.3h3.8c2.9 0 4.5 1.6 4.5 4.2 0 2.7-1.6 4.3-4.5 4.3H22v-8.5Z"
            fill="#f8fafc"
          />

          <path
            d="m34 16 8.2 32h4.5L55 16h-7l-3.5 19.2L41 16h-7Z"
            fill="url(#breakveil-mark-gradient)"
          />

          <path
            d="M38.8 13.5 31 51"
            stroke="#10131b"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </svg>
      </span>

      {!compact && (
        <span
          className="breakveil-brand-word"
          aria-hidden="true"
        >
          BreakVeil
          <sup className="breakveil-brand-ai">
            AI
          </sup>
        </span>
      )}
    </span>
  )
}
