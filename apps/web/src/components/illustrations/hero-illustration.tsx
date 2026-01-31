export function HeroIllustration({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 800 600"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Background organic shapes */}
      <defs>
        <linearGradient id="warmGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(30 40% 96%)" />
          <stop offset="100%" stopColor="hsl(24 50% 94%)" />
        </linearGradient>
        <linearGradient id="primaryGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(24 85% 55%)" />
          <stop offset="100%" stopColor="hsl(24 85% 45%)" />
        </linearGradient>
        <linearGradient id="softOrange" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="hsl(24 85% 48% / 0.15)" />
          <stop offset="100%" stopColor="hsl(24 85% 48% / 0.05)" />
        </linearGradient>
      </defs>

      {/* Large organic blob - background */}
      <ellipse
        cx="400"
        cy="300"
        rx="350"
        ry="250"
        fill="url(#softOrange)"
        opacity="0.6"
      />

      {/* Connection lines - neural network feel */}
      <g stroke="hsl(24 85% 48% / 0.2)" strokeWidth="1">
        <line x1="200" y1="200" x2="350" y2="280" />
        <line x1="350" y1="280" x2="450" y2="320" />
        <line x1="450" y1="320" x2="600" y2="250" />
        <line x1="350" y1="280" x2="320" y2="400" />
        <line x1="450" y1="320" x2="500" y2="420" />
        <line x1="320" y1="400" x2="500" y2="420" />
      </g>

      {/* Human figure - left side (stylized, minimal) */}
      <g transform="translate(150, 180)">
        {/* Head */}
        <circle cx="50" cy="30" r="28" fill="hsl(30 30% 75%)" />
        {/* Body */}
        <path
          d="M50 60 L50 140 M20 90 L80 90 M50 140 L25 200 M50 140 L75 200"
          stroke="hsl(30 30% 65%)"
          strokeWidth="8"
          strokeLinecap="round"
          fill="none"
        />
        {/* Warm glow around human */}
        <circle
          cx="50"
          cy="100"
          r="80"
          fill="none"
          stroke="hsl(24 85% 48% / 0.15)"
          strokeWidth="2"
        />
        <circle
          cx="50"
          cy="100"
          r="100"
          fill="none"
          stroke="hsl(24 85% 48% / 0.08)"
          strokeWidth="1"
        />
      </g>

      {/* AI entity - right side (geometric, tech) */}
      <g transform="translate(500, 160)">
        {/* Core hexagon */}
        <polygon
          points="80,0 160,45 160,135 80,180 0,135 0,45"
          fill="url(#primaryGradient)"
          opacity="0.9"
        />
        {/* Inner pattern */}
        <polygon
          points="80,30 130,55 130,125 80,150 30,125 30,55"
          fill="none"
          stroke="hsl(0 0% 100% / 0.3)"
          strokeWidth="1"
        />
        <circle cx="80" cy="90" r="20" fill="hsl(0 0% 100% / 0.9)" />
        <circle cx="80" cy="90" r="8" fill="hsl(24 85% 48%)" />
        
        {/* Tech rings around AI */}
        <circle
          cx="80"
          cy="90"
          r="110"
          fill="none"
          stroke="hsl(24 85% 48% / 0.2)"
          strokeWidth="1"
          strokeDasharray="8 4"
        />
        <circle
          cx="80"
          cy="90"
          r="140"
          fill="none"
          stroke="hsl(24 85% 48% / 0.1)"
          strokeWidth="1"
          strokeDasharray="4 8"
        />
      </g>

      {/* Connection between human and AI - the bridge */}
      <g>
        {/* Main connection beam */}
        <path
          d="M250 280 Q400 250 500 280"
          stroke="url(#primaryGradient)"
          strokeWidth="3"
          fill="none"
          opacity="0.6"
        />
        {/* Energy particles */}
        <circle cx="300" cy="268" r="4" fill="hsl(24 85% 48%)" opacity="0.8">
          <animate
            attributeName="cx"
            values="280;480;280"
            dur="4s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.8;0.3;0.8"
            dur="4s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="380" cy="255" r="3" fill="hsl(24 85% 55%)" opacity="0.6">
          <animate
            attributeName="cx"
            values="480;280;480"
            dur="3.5s"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="0.6;0.2;0.6"
            dur="3.5s"
            repeatCount="indefinite"
          />
        </circle>
        <circle cx="420" cy="262" r="2" fill="hsl(24 85% 60%)" opacity="0.5">
          <animate
            attributeName="cx"
            values="300;460;300"
            dur="5s"
            repeatCount="indefinite"
          />
        </circle>
      </g>

      {/* Floating data nodes */}
      <g>
        <circle cx="320" cy="400" r="6" fill="hsl(24 85% 48% / 0.4)" />
        <circle cx="500" cy="420" r="8" fill="hsl(24 85% 48% / 0.3)" />
        <circle cx="180" cy="350" r="5" fill="hsl(24 85% 48% / 0.25)" />
        <circle cx="620" cy="380" r="7" fill="hsl(24 85% 48% / 0.35)" />
        <circle cx="400" cy="480" r="4" fill="hsl(24 85% 48% / 0.2)" />
      </g>

      {/* Small accent dots */}
      <g fill="hsl(24 85% 48%)">
        <circle cx="200" cy="200" r="3" />
        <circle cx="350" cy="280" r="4" />
        <circle cx="450" cy="320" r="4" />
        <circle cx="600" cy="250" r="3" />
      </g>
    </svg>
  );
}
