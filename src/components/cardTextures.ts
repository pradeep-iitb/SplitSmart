// High-contrast, vibrant SVG textures for WebGL DecayCard & Hero BounceCards
// 100% offline, zero network requests, sharp vector rendering

export const receiptCardTexture = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="880" viewBox="0 0 700 880">
  <defs>
    <radialGradient id="cardGlow" cx="50%" cy="30%" r="60%">
      <stop offset="0%" stop-color="#065f46" stop-opacity="0.8"/>
      <stop offset="60%" stop-color="#022c22" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#051410" stop-opacity="1"/>
    </radialGradient>
    <linearGradient id="laserBeam" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="rgba(16,185,129,0)"/>
      <stop offset="20%" stop-color="rgba(52,211,153,0.9)"/>
      <stop offset="50%" stop-color="#6ee7b7"/>
      <stop offset="80%" stop-color="rgba(52,211,153,0.9)"/>
      <stop offset="100%" stop-color="rgba(16,185,129,0)"/>
    </linearGradient>
    <pattern id="gridPattern" width="28" height="28" patternUnits="userSpaceOnUse">
      <path d="M 28 0 L 0 0 0 28" fill="none" stroke="rgba(52,211,153,0.12)" stroke-width="1"/>
    </pattern>
    <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="700" height="880" rx="36" fill="url(#cardGlow)"/>
  <rect width="700" height="880" rx="36" fill="url(#gridPattern)"/>

  <!-- High-Tech Receipt Illustration in Top Area -->
  <g transform="translate(140, 60)">
    <!-- Receipt Paper Background Shadow & Body -->
    <rect x="-10" y="8" width="440" height="360" rx="20" fill="rgba(0,0,0,0.5)" filter="blur(10px)"/>
    <rect x="0" y="0" width="420" height="350" rx="18" fill="#0f2b23" stroke="#10b981" stroke-width="2.5" opacity="0.95"/>

    <!-- Receipt Header -->
    <rect x="30" y="24" width="70" height="12" rx="4" fill="#34d399"/>
    <rect x="30" y="44" width="180" height="8" rx="3" fill="rgba(167,243,208,0.4)"/>
    <rect x="300" y="24" width="90" height="18" rx="6" fill="rgba(16,185,129,0.3)" stroke="#34d399" stroke-width="1"/>
    <text x="345" y="37" fill="#6ee7b7" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">OCR 99.4%</text>

    <!-- Divider Line -->
    <line x1="30" y1="70" x2="390" y2="70" stroke="rgba(52,211,153,0.3)" stroke-dasharray="6,4" stroke-width="1.5"/>

    <!-- Line Item 1: Paneer Butter Masala -->
    <g transform="translate(30, 85)">
      <rect x="0" y="0" width="16" height="16" rx="4" fill="#10b981"/>
      <rect x="26" y="2" width="160" height="10" rx="3" fill="#ecfdf5"/>
      <rect x="280" y="2" width="75" height="10" rx="3" fill="#a7f3d0"/>
      <!-- Bounding Box Annotation -->
      <rect x="-4" y="-3" width="365" height="22" rx="5" fill="none" stroke="#34d399" stroke-width="1.2" stroke-dasharray="4,3"/>
    </g>

    <!-- Line Item 2: Garlic Butter Naan (4x) -->
    <g transform="translate(30, 120)">
      <rect x="0" y="0" width="16" height="16" rx="4" fill="#10b981"/>
      <rect x="26" y="2" width="130" height="10" rx="3" fill="#ecfdf5"/>
      <rect x="280" y="2" width="75" height="10" rx="3" fill="#a7f3d0"/>
    </g>

    <!-- Line Item 3: Fresh Lime Soda -->
    <g transform="translate(30, 155)">
      <rect x="0" y="0" width="16" height="16" rx="4" fill="#10b981"/>
      <rect x="26" y="2" width="110" height="10" rx="3" fill="#ecfdf5"/>
      <rect x="280" y="2" width="75" height="10" rx="3" fill="#a7f3d0"/>
    </g>

    <!-- Tax Breakdown Box -->
    <g transform="translate(30, 195)">
      <rect x="0" y="0" width="360" height="60" rx="10" fill="rgba(6,78,59,0.7)" stroke="rgba(52,211,153,0.4)" stroke-width="1.5"/>
      <text x="20" y="24" fill="#a7f3d0" font-family="sans-serif" font-size="12" font-weight="600">CGST (2.5%) + SGST (2.5%)</text>
      <text x="340" y="24" fill="#ecfdf5" font-family="monospace" font-size="12" font-weight="bold" text-anchor="end">₹40.00</text>
      <text x="20" y="46" fill="#a7f3d0" font-family="sans-serif" font-size="12" font-weight="600">Service Charge</text>
      <text x="340" y="46" fill="#ecfdf5" font-family="monospace" font-size="12" font-weight="bold" text-anchor="end">₹60.00</text>
    </g>

    <!-- Total Extracted Pill -->
    <g transform="translate(30, 275)">
      <rect x="0" y="0" width="360" height="50" rx="12" fill="#047857" stroke="#34d399" stroke-width="2"/>
      <text x="20" y="32" fill="#ecfdf5" font-family="sans-serif" font-size="15" font-weight="800">Total Verified</text>
      <text x="340" y="32" fill="#34d399" font-family="monospace" font-size="18" font-weight="900" text-anchor="end">₹840.00</text>
    </g>

    <!-- Glowing Laser Scan Line sweeping across receipt -->
    <g transform="translate(-40, 140)">
      <rect x="0" y="0" width="500" height="5" fill="url(#laserBeam)" filter="url(#neonGlow)"/>
      <circle cx="250" cy="2.5" r="7" fill="#6ee7b7" filter="url(#neonGlow)"/>
    </g>
  </g>
</svg>
`)}`;

export const mathCardTexture = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="880" viewBox="0 0 700 880">
  <defs>
    <radialGradient id="mathGlow" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#4c1d95" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="#1e1035" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#0a0515" stop-opacity="1"/>
    </radialGradient>
    <pattern id="hexGrid" width="40" height="40" patternUnits="userSpaceOnUse">
      <path d="M20 0 L40 10 L40 30 L20 40 L0 30 L0 10 Z" fill="none" stroke="rgba(192,132,252,0.12)" stroke-width="1"/>
    </pattern>
    <filter id="purpleGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="700" height="880" rx="36" fill="url(#mathGlow)"/>
  <rect width="700" height="880" rx="36" fill="url(#hexGrid)"/>

  <!-- High-Precision Odd-Paisa Conservation Graphic in Top Area -->
  <g transform="translate(350, 220)">
    <!-- Glowing Outer Constellation Orbit -->
    <circle r="160" fill="none" stroke="rgba(168,85,247,0.25)" stroke-width="2" stroke-dasharray="8,6"/>
    <circle r="120" fill="rgba(88,28,135,0.4)" stroke="#a855f7" stroke-width="2.5" filter="url(#purpleGlow)"/>

    <!-- Central Integer Core -->
    <circle r="60" fill="#2e1065" stroke="#c084fc" stroke-width="3"/>
    <text x="0" y="-8" fill="#e9d5ff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">TOTAL INPUT</text>
    <text x="0" y="18" fill="#ffffff" font-family="monospace" font-size="22" font-weight="900" text-anchor="middle">₹100</text>

    <!-- 3 Triangular Split Vectors (Hamilton-Hare Rule) -->
    <!-- Node 1: Top (₹33.34 - tie broken) -->
    <g transform="translate(0, -145)">
      <circle r="36" fill="#581c87" stroke="#e879f9" stroke-width="2.5" filter="url(#purpleGlow)"/>
      <text x="0" y="-3" fill="#f5d0fe" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Arjun</text>
      <text x="0" y="14" fill="#ffffff" font-family="monospace" font-size="13" font-weight="900" text-anchor="middle">₹33.34</text>
    </g>

    <!-- Node 2: Bottom-Right (₹33.33) -->
    <g transform="translate(125, 75)">
      <circle r="34" fill="#3b0764" stroke="#c084fc" stroke-width="2"/>
      <text x="0" y="-3" fill="#e9d5ff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Meera</text>
      <text x="0" y="14" fill="#ffffff" font-family="monospace" font-size="13" font-weight="900" text-anchor="middle">₹33.33</text>
    </g>

    <!-- Node 3: Bottom-Left (₹33.33) -->
    <g transform="translate(-125, 75)">
      <circle r="34" fill="#3b0764" stroke="#c084fc" stroke-width="2"/>
      <text x="0" y="-3" fill="#e9d5ff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Riya</text>
      <text x="0" y="14" fill="#ffffff" font-family="monospace" font-size="13" font-weight="900" text-anchor="middle">₹33.33</text>
    </g>

    <!-- Connecting Rays with Glow -->
    <line x1="0" y1="-60" x2="0" y2="-109" stroke="#d8b4fe" stroke-width="3" stroke-linecap="round"/>
    <line x1="52" y1="30" x2="95" y2="55" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round"/>
    <line x1="-52" y1="30" x2="-95" y2="55" stroke="#c084fc" stroke-width="2.5" stroke-linecap="round"/>
  </g>

  <!-- Invariant Proof Banner -->
  <g transform="translate(150, 410)">
    <rect x="0" y="0" width="400" height="42" rx="12" fill="rgba(88,28,135,0.6)" stroke="#a855f7" stroke-width="1.5"/>
    <text x="200" y="26" fill="#f5d0fe" font-family="monospace" font-size="13" font-weight="bold" text-anchor="middle">
      Σ shares = 10000 paise (0.00 Drift)
    </text>
  </g>
</svg>
`)}`;

export const upiCardTexture = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="700" height="880" viewBox="0 0 700 880">
  <defs>
    <radialGradient id="upiGlow" cx="50%" cy="30%" r="65%">
      <stop offset="0%" stop-color="#0e7490" stop-opacity="0.85"/>
      <stop offset="60%" stop-color="#082f49" stop-opacity="0.95"/>
      <stop offset="100%" stop-color="#021724" stop-opacity="1"/>
    </radialGradient>
    <pattern id="cyanRings" width="35" height="35" patternUnits="userSpaceOnUse">
      <circle cx="17.5" cy="17.5" r="1.5" fill="rgba(34,211,238,0.2)"/>
    </pattern>
    <filter id="cyanGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="8" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>

  <!-- Background Base -->
  <rect width="700" height="880" rx="36" fill="url(#upiGlow)"/>
  <rect width="700" height="880" rx="36" fill="url(#cyanRings)"/>

  <!-- High-Tech Dynamic UPI QR Hologram in Top Area -->
  <g transform="translate(200, 75)">
    <!-- Outer Floating Glass Frame -->
    <rect x="-15" y="-15" width="330" height="330" rx="26" fill="rgba(12,74,96,0.6)" stroke="#22d3ee" stroke-width="2" filter="url(#cyanGlow)"/>
    <rect x="0" y="0" width="300" height="300" rx="18" fill="#042738" stroke="rgba(34,211,238,0.5)" stroke-width="1.5"/>

    <!-- Target Reticle Corners -->
    <path d="M 20 50 L 20 20 L 50 20" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M 280 50 L 280 20 L 250 20" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M 20 250 L 20 280 L 50 280" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/>
    <path d="M 280 250 L 280 280 L 250 280" stroke="#38bdf8" stroke-width="5" fill="none" stroke-linecap="round"/>

    <!-- Stylized QR Blocks -->
    <!-- Corner Block 1: Top-Left -->
    <rect x="36" y="36" width="64" height="64" rx="10" fill="none" stroke="#22d3ee" stroke-width="5"/>
    <rect x="50" y="50" width="36" height="36" rx="6" fill="#38bdf8"/>

    <!-- Corner Block 2: Top-Right -->
    <rect x="200" y="36" width="64" height="64" rx="10" fill="none" stroke="#22d3ee" stroke-width="5"/>
    <rect x="214" y="50" width="36" height="36" rx="6" fill="#38bdf8"/>

    <!-- Corner Block 3: Bottom-Left -->
    <rect x="36" y="200" width="64" height="64" rx="10" fill="none" stroke="#22d3ee" stroke-width="5"/>
    <rect x="50" y="214" width="36" height="36" rx="6" fill="#38bdf8"/>

    <!-- Data Pattern Elements -->
    <rect x="130" y="44" width="40" height="16" rx="4" fill="#0284c7"/>
    <rect x="130" y="70" width="20" height="30" rx="4" fill="#38bdf8"/>
    <rect x="44" y="130" width="30" height="20" rx="4" fill="#0284c7"/>
    <rect x="44" y="160" width="40" height="16" rx="4" fill="#38bdf8"/>
    <rect x="210" y="130" width="40" height="20" rx="4" fill="#38bdf8"/>
    <rect x="220" y="160" width="30" height="20" rx="4" fill="#0284c7"/>
    <rect x="130" y="220" width="40" height="20" rx="4" fill="#38bdf8"/>
    <rect x="180" y="220" width="30" height="30" rx="4" fill="#0284c7"/>

    <!-- Center UPI Brand Icon Badge -->
    <circle cx="150" cy="150" r="34" fill="#021c2e" stroke="#22d3ee" stroke-width="3"/>
    <text x="150" y="159" fill="#38bdf8" font-family="sans-serif" font-size="24" font-weight="900" text-anchor="middle">₹</text>
  </g>

  <!-- Network Badges -->
  <g transform="translate(150, 420)">
    <rect x="0" y="0" width="400" height="40" rx="12" fill="rgba(8,47,73,0.7)" stroke="#0ea5e9" stroke-width="1.5"/>
    <text x="200" y="25" fill="#bae6fd" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle">
      GPay · PhonePe · Paytm · BHIM Direct
    </text>
  </g>
</svg>
`)}`;

// 4 Crisp SVG Cards for Hero BounceCards
export const featureDebtSimplificationSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="cardBgAmber" cx="50%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#2d1b06"/>
      <stop offset="50%" stop-color="#180f04"/>
      <stop offset="100%" stop-color="#0a0601"/>
    </radialGradient>
    <filter id="amberGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feMerge>
        <feMergeNode in="blur"/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect width="400" height="400" rx="28" fill="url(#cardBgAmber)" stroke="#f59e0b" stroke-width="2"/>
  <rect x="24" y="28" width="130" height="26" rx="13" fill="rgba(245,158,11,0.2)" stroke="#f59e0b" stroke-width="1.2"/>
  <text x="89" y="45" fill="#fbbf24" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">GRAPH OPTIMIZER</text>
  <circle cx="360" cy="40" r="5" fill="#10b981"/>
  
  <text x="26" y="98" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="800">Debt Simplification</text>
  <text x="26" y="128" fill="#d1d5db" font-family="sans-serif" font-size="13" font-weight="400">
    <tspan x="26" dy="0">Turns messy 20-person web of debts</tspan>
    <tspan x="26" dy="18">into provably minimal payments.</tspan>
  </text>

  <!-- Network Diagram -->
  <g transform="translate(200, 230)">
    <circle cx="-90" cy="20" r="22" fill="#78350f" stroke="#fbbf24" stroke-width="2"/>
    <text x="-90" y="25" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Arjun</text>
    <circle cx="90" cy="20" r="22" fill="#78350f" stroke="#fbbf24" stroke-width="2"/>
    <text x="90" y="25" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Riya</text>
    <circle cx="0" cy="-45" r="22" fill="#78350f" stroke="#fbbf24" stroke-width="2"/>
    <text x="0" y="-40" fill="#ffffff" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">Kabir</text>
    <line x1="-70" y1="10" x2="-20" y2="-30" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,3"/>
    <line x1="20" y1="-30" x2="70" y2="10" stroke="#f59e0b" stroke-width="2" stroke-dasharray="4,3"/>
    <line x1="-68" y1="20" x2="68" y2="20" stroke="#10b981" stroke-width="3" filter="url(#amberGlow)"/>
  </g>

  <!-- Bottom Metric -->
  <text x="26" y="365" fill="#34d399" font-family="monospace" font-size="14" font-weight="bold">68% Fewer Transfers</text>
  <text x="374" y="365" fill="#fbbf24" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">Explore →</text>
</svg>
`)}`;

export const featureUpiSettlementSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="cardBgCyan" cx="50%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#083344"/>
      <stop offset="50%" stop-color="#051f2b"/>
      <stop offset="100%" stop-color="#020e14"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" rx="28" fill="url(#cardBgCyan)" stroke="#06b6d4" stroke-width="2"/>
  <rect x="24" y="28" width="130" height="26" rx="13" fill="rgba(6,182,212,0.2)" stroke="#06b6d4" stroke-width="1.2"/>
  <text x="89" y="45" fill="#22d3ee" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">INSTANT SETTLE</text>
  <circle cx="360" cy="40" r="5" fill="#06b6d4"/>

  <text x="26" y="98" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="800">Dynamic UPI QR</text>
  <text x="26" y="128" fill="#d1d5db" font-family="sans-serif" font-size="13" font-weight="400">
    <tspan x="26" dy="0">Direct peer-to-peer settlement</tspan>
    <tspan x="26" dy="18">without intermediary fees.</tspan>
  </text>

  <!-- Stylized QR Box in Center -->
  <g transform="translate(145, 175)">
    <rect width="110" height="110" rx="14" fill="#082f49" stroke="#38bdf8" stroke-width="2"/>
    <rect x="14" y="14" width="28" height="28" rx="4" fill="none" stroke="#22d3ee" stroke-width="3"/>
    <rect x="20" y="20" width="16" height="16" rx="2" fill="#22d3ee"/>
    <rect x="68" y="14" width="28" height="28" rx="4" fill="none" stroke="#22d3ee" stroke-width="3"/>
    <rect x="74" y="20" width="16" height="16" rx="2" fill="#22d3ee"/>
    <rect x="14" y="68" width="28" height="28" rx="4" fill="none" stroke="#22d3ee" stroke-width="3"/>
    <rect x="20" y="74" width="16" height="16" rx="2" fill="#22d3ee"/>
    <circle cx="55" cy="55" r="14" fill="#0369a1"/>
    <text x="55" y="60" fill="#ffffff" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">₹</text>
  </g>

  <!-- Bottom Metric -->
  <text x="26" y="365" fill="#38bdf8" font-family="monospace" font-size="13" font-weight="bold">GPay · PhonePe · Paytm</text>
  <text x="374" y="365" fill="#22d3ee" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">Explore →</text>
</svg>
`)}`;

export const featurePrecisionSplitSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="cardBgPurple" cx="50%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#3b0764"/>
      <stop offset="50%" stop-color="#24043d"/>
      <stop offset="100%" stop-color="#10011c"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" rx="28" fill="url(#cardBgPurple)" stroke="#a855f7" stroke-width="2"/>
  <rect x="24" y="28" width="130" height="26" rx="13" fill="rgba(168,85,247,0.2)" stroke="#a855f7" stroke-width="1.2"/>
  <text x="89" y="45" fill="#c084fc" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">PRECISION</text>
  <circle cx="360" cy="40" r="5" fill="#a855f7"/>

  <text x="26" y="98" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="800">Multi-Way Split</text>
  <text x="26" y="128" fill="#d1d5db" font-family="sans-serif" font-size="13" font-weight="400">
    <tspan x="26" dy="0">Even split, percentage shares,</tspan>
    <tspan x="26" dy="18">and exact odd-paisa precision.</tspan>
  </text>

  <!-- Math Coins Illustration -->
  <g transform="translate(140, 180)">
    <rect x="0" y="0" width="120" height="90" rx="12" fill="#581c87" stroke="#c084fc" stroke-width="1.5"/>
    <text x="60" y="32" fill="#e9d5ff" font-family="monospace" font-size="14" font-weight="bold" text-anchor="middle">₹100 / 3</text>
    <text x="60" y="65" fill="#34d399" font-family="monospace" font-size="15" font-weight="900" text-anchor="middle">₹33.34</text>
  </g>

  <!-- Bottom Metric -->
  <text x="26" y="365" fill="#c084fc" font-family="monospace" font-size="13" font-weight="bold">0.00 Paisa Drift</text>
  <text x="374" y="365" fill="#e9d5ff" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">Explore →</text>
</svg>
`)}`;

export const featureSmartOcrSvg = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
  <defs>
    <radialGradient id="cardBgGreen" cx="50%" cy="20%" r="80%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="50%" stop-color="#022c22"/>
      <stop offset="100%" stop-color="#01140e"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" rx="28" fill="url(#cardBgGreen)" stroke="#10b981" stroke-width="2"/>
  <rect x="24" y="28" width="130" height="26" rx="13" fill="rgba(16,185,129,0.2)" stroke="#10b981" stroke-width="1.2"/>
  <text x="89" y="45" fill="#34d399" font-family="monospace" font-size="11" font-weight="bold" text-anchor="middle">OCR ENGINE</text>
  <circle cx="360" cy="40" r="5" fill="#10b981"/>

  <text x="26" y="98" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="800">Smart Receipt Scan</text>
  <text x="26" y="128" fill="#d1d5db" font-family="sans-serif" font-size="13" font-weight="400">
    <tspan x="26" dy="0">Extracts dishes, drinks, CGST,</tspan>
    <tspan x="26" dy="18">SGST and service charge in ms.</tspan>
  </text>

  <!-- Receipt Outline -->
  <g transform="translate(130, 175)">
    <rect width="140" height="100" rx="10" fill="#065f46" stroke="#34d399" stroke-width="1.5"/>
    <line x1="20" y1="25" x2="120" y2="25" stroke="#a7f3d0" stroke-width="4" stroke-linecap="round"/>
    <line x1="20" y1="45" x2="90" y2="45" stroke="rgba(255,255,255,0.6)" stroke-width="3" stroke-linecap="round"/>
    <line x1="20" y1="65" x2="110" y2="65" stroke="rgba(255,255,255,0.6)" stroke-width="3" stroke-linecap="round"/>
    <line x1="0" y1="50" x2="140" y2="50" stroke="#6ee7b7" stroke-width="2"/>
  </g>

  <!-- Bottom Metric -->
  <text x="26" y="365" fill="#34d399" font-family="monospace" font-size="13" font-weight="bold">99.4% Parsing Acc</text>
  <text x="374" y="365" fill="#a7f3d0" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="end">Explore →</text>
</svg>
`)}`;
