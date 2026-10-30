import React, { useState } from 'react';
import type { Expense, Member } from '../types/domain';
import { formatPaise } from '../features/settlement/balances';
import AeroShards from './AeroShards';
import GooeyNav from './GooeyNav';
import BounceCards from './BounceCards';
import DecayCard from './DecayCard';

interface LandingPageProps {
  onLaunchApp: (tab?: string) => void;
  onOpenScanModal: () => void;
  expenses: Expense[];
  members: Member[];
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onLaunchApp,
  onOpenScanModal,
  expenses,
  members,
}) => {
  const [activeNavIdx, setActiveNavIdx] = useState(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Overview' },
    { label: 'Features' },
    { label: 'Recent Spend' },
    { label: 'Analytics' },
  ];

  const handleNavChange = (index: number) => {
    setActiveNavIdx(index);
    setIsMobileMenuOpen(false);
    if (index === 0) {
      document.getElementById('hero-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (index === 1) {
      document.getElementById('features-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (index === 2) {
      document.getElementById('history-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (index === 3) {
      document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' });
    } else if (index === 4) {
      onLaunchApp('split-studio');
    }
  };

  // Real short expenses from active group (up to 4 clean entries)
  const shortExpenses = expenses.slice(0, 4);

  // Real category totals for Analytics preview
  const categoryTotals = expenses.reduce(
    (acc, exp) => {
      const cat = exp.category || 'General';
      acc[cat] = (acc[cat] || 0) + exp.amountPaise;
      return acc;
    },
    {} as Record<string, number>
  );

  const totalSpentPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  return (
    <div className="relative w-full max-w-full overflow-x-clip text-slate-100 flex flex-col font-body">
      {/* 75% VW Liquid Glass Floating Navbar on Desktop + Clean Menu Bar on Mobile */}
      <header className="fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-24px)] md:w-[75vw] max-w-[1100px] transition-all duration-300">
        <div className="liquid-glass rounded-full px-4 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between shadow-2xl">
          {/* Brand Logo & Name */}
          <div
            onClick={() => handleNavChange(0)}
            className="flex items-center gap-2.5 cursor-pointer select-none group"
          >
            <img
              src="/Images/SplitSmart Neon Receipt Logo.png"
              alt="SplitSmart Logo"
              className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-xl drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] group-hover:scale-105 transition-transform shrink-0"
            />
            <span className="font-heading font-black text-sm sm:text-base tracking-tight text-white drop-shadow">
              SplitSmart
            </span>
          </div>

          {/* Desktop Center Tabs with Fluid Gooey Animation */}
          <div className="hidden md:flex items-center">
            <GooeyNav
              items={navItems}
              initialActiveIndex={activeNavIdx}
              activeIndex={activeNavIdx}
              onChange={handleNavChange}
              theme="dark"
              size="sm"
              color="#896ABD"
              frame={false}
              particleCount={14}
              spread={45}
              animationTime={500}
              timeVariance={250}
              gooeyness={0.5}
              wobble={0.4}
              hoverEffect={true}
            />
          </div>

          {/* Desktop Right CTA with GitHub Link & Launch Button */}
          <div className="hidden md:flex items-center gap-2.5 pl-2">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/15 transition-all flex items-center justify-center cursor-pointer shadow-sm hover:scale-105"
              title="GitHub Repository"
              aria-label="GitHub Repository"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>

            <button
              type="button"
              onClick={() => onLaunchApp('split-studio')}
              className="px-5 py-2 rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 hover:opacity-95 text-white font-heading font-bold text-xs shadow-[0_0_20px_rgba(147,51,234,0.45)] hover:shadow-[0_0_28px_rgba(147,51,234,0.7)] transition-all cursor-pointer whitespace-nowrap"
            >
              Launch App →
            </button>
          </div>

          {/* Mobile Menu Button on Right */}
          <div className="flex md:hidden items-center gap-1.5">
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white border border-white/20 transition-colors"
              title="GitHub Repository"
              aria-label="GitHub Repository"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                />
              </svg>
            </a>

            <button
              type="button"
              onClick={() => onLaunchApp('split-studio')}
              className="px-3 py-1.5 rounded-full bg-purple-600 text-white font-heading font-bold text-xs shadow-md"
            >
              App →
            </button>
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              aria-label="Toggle Mobile Menu"
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
            >
              {isMobileMenuOpen ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Mobile Liquid Glass Slide-down Menu Sheet */}
        {isMobileMenuOpen && (
          <div className="md:hidden mt-2 p-4 rounded-3xl liquid-glass space-y-3 animate-in fade-in slide-in-from-top-3 duration-200 shadow-2xl">
            <div className="space-y-1">
              {navItems.map((item, idx) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => handleNavChange(idx)}
                  className={`w-full text-left px-4 py-2.5 rounded-2xl text-xs font-heading font-semibold transition-colors flex items-center justify-between ${
                    activeNavIdx === idx
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/40'
                      : 'text-slate-300 hover:bg-white/5'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className="text-[10px] text-slate-500 font-mono">0{idx + 1}</span>
                </button>
              ))}
            </div>
            <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-3">
              <a
                href="https://github.com"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"
                  />
                </svg>
                <span>GitHub</span>
              </a>
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onLaunchApp('split-studio');
                }}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-heading font-bold text-xs shadow-lg"
              >
                Launch SplitSmart →
              </button>
            </div>
          </div>
        )}
      </header>

      {/* 1. Full Viewport Hero Section (100vh) WITH AeroShards BG ONLY HERE */}
      <section
        id="hero-section"
        className="relative min-h-screen w-full flex flex-col justify-center bg-[#07090e]"
      >
        {/* Exact AeroShards Background Component - Only in Hero */}
        <div style={{ width: '100%', height: '100%', position: 'absolute', inset: 0, zIndex: 0 }}>
          <AeroShards
            shardColor="#896ABD"
            accentColor="#A855F7"
            placement="full"
            material="glass"
            markers="plus"
            count={1300}
            depthOfField={0.75}
            vignette={0.3}
            mouseInteraction={true}
            pulseOnClick={true}
            holdToGather={true}
            lightMode={false}
            shardSize={1}
            spread={1}
            twist={1}
            billow={1}
            speed={1}
            scale={1}
            glow={0.35}
            grain={0.06}
            intro={true}
            mouseStrength={0.6}
            parallax={0.5}
            paused={false}
          />
        </div>

        {/* Hero Content Grid: Shifted slightly to right + Enhanced Text Visibility with Indefinite Gradual Diffusion */}
        <div className="relative z-10 max-w-[1500px] mx-auto w-full max-w-full px-4 sm:px-8 lg:px-12 pt-28 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center my-auto">
          {/* Left: Text shifted right on desktop with an organic gradual diffusion (no hard borders or rigid box) */}
          <div className="lg:col-span-6 lg:pl-6 xl:pl-12">
            <div className="relative space-y-6 p-2 sm:p-5 max-w-xl">
              {/* Indefinite Gradual Diffusion Cloud - softens naturally into AeroShards with zero hard borders */}
              <div className="hero-diffuse-cloud" aria-hidden="true" />

              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-purple-500/15 border border-purple-500/30 text-purple-300 text-xs font-display font-semibold backdrop-blur-md shadow-lg">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
                <span>Local-First Group Ledger</span>
              </div>

              <h1 className="text-4xl sm:text-6xl font-heading font-black tracking-tight text-white leading-[1.08] drop-shadow-[0_4px_24px_rgba(0,0,0,0.95)]">
                Fair bill splitting. <br />
                <span className="bg-gradient-to-r from-purple-300 via-indigo-200 to-cyan-300 bg-clip-text text-transparent drop-shadow-[0_2px_18px_rgba(168,85,247,0.6)]">
                  Zero awkward math.
                </span>
              </h1>

              <p className="text-base sm:text-lg text-slate-200/95 leading-relaxed font-body drop-shadow-[0_2px_8px_rgba(0,0,0,0.9)]">
                Scan paper receipts, divide shared expenses with exact odd-paisa precision, and
                settle group debts directly with friends via 1-tap UPI QR codes.
              </p>

              <div className="flex flex-wrap items-center gap-3.5 pt-2">
                <button
                  type="button"
                  onClick={() => onLaunchApp('split-studio')}
                  className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-600 hover:opacity-95 text-white font-heading font-bold text-sm shadow-[0_0_30px_rgba(124,58,237,0.55)] hover:shadow-[0_0_40px_rgba(124,58,237,0.75)] transition-all cursor-pointer transform hover:-translate-y-0.5"
                >
                  Launch SplitSmart →
                </button>

                <button
                  type="button"
                  onClick={onOpenScanModal}
                  className="px-5 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-white/20 text-slate-100 font-heading font-semibold text-sm backdrop-blur-md transition-all cursor-pointer flex items-center gap-2 shadow-lg"
                >
                  <svg
                    className="w-4 h-4 text-emerald-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 13a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                  </svg>
                  <span>Scan Receipt</span>
                </button>
              </div>

              {/* Invariant stats with font-mono-numbers */}
              <div className="pt-6 border-t border-white/10 flex items-center gap-6 sm:gap-8 text-xs text-slate-300">
                <div>
                  <span className="block text-slate-100 font-mono-numbers font-bold text-sm">
                    ₹0.00
                  </span>
                  <span className="text-[11px] font-display uppercase tracking-wider text-slate-400">
                    Odd-Paisa Drift
                  </span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div>
                  <span className="block text-slate-100 font-mono-numbers font-bold text-sm">
                    {members.length}
                  </span>
                  <span className="text-[11px] font-display uppercase tracking-wider text-slate-400">
                    Active Members
                  </span>
                </div>
                <div className="w-px h-6 bg-white/10" />
                <div>
                  <span className="block text-emerald-400 font-heading font-bold text-sm">
                    Offline
                  </span>
                  <span className="text-[11px] font-display uppercase tracking-wider text-slate-400">
                    IndexedDB Storage
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Increased Size BounceCards (Hidden on mobile for clean responsiveness) */}
          <div className="hidden lg:flex lg:col-span-6 items-center justify-center pt-8 lg:pt-0">
            <BounceCards
              images={[
                '/Images/Herocard1.png',
                '/Images/Herocard2.png',
                '/Images/Herocard3.png',
                '/Images/Herocard4.png',
              ]}
              containerWidth={560}
              containerHeight={380}
              cardSize={275}
              spread={80}
              rotation={8}
              arc={0}
              pushDistance={160}
              hoverScale={1.08}
              bounciness={0.6}
              animationDelay={0.3}
              animationStagger={0.06}
              borderWidth={1}
              borderColor="rgba(255, 255, 255, 0.16)"
              radius={26}
              shadow={true}
              enableHover={true}
              onCardClick={(index) => {
                const tabs = ['split-studio', 'split-studio', 'settlement', 'settlement'];
                onLaunchApp(tabs[index] || 'split-studio');
              }}
            />
          </div>
        </div>
      </section>

      {/* 2. Features Section with MOVING GRADIENT BG & User's Uploaded DecayCard Backgrounds */}
      <section
        id="features-section"
        className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-20 border-t border-slate-800/80 w-full max-w-full overflow-x-clip"
      >
        <div className="max-w-[1500px] mx-auto">
          <div className="text-left mb-12">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-5xl font-heading font-black text-white tracking-tight mt-2 drop-shadow">
              Trips, Live Balances & Spending Insights
            </h2>
            <p className="text-sm sm:text-base font-body text-slate-300 max-w-2xl mt-2 leading-relaxed">
              Organize group expenses with smart categories, up-to-date local balances, and visual
              analytics.
            </p>
          </div>

          {/* Grid with DecayCard components (matching the new user uploaded card graphics) */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 justify-items-center">
            {/* Feature 1: Trip Mode */}
            <DecayCard
              width={340}
              height={450}
              intensity={0.35}
              sensitivity={0.5}
              hoverDecay={0.06}
              recovery={0.25}
              idle={0}
              radius={24}
              scope="card"
              image="/Images/Decaycard1.png"
            >
              <div className="space-y-1 select-none liquid-glass px-3.5 py-2 rounded-xl border border-white/15 w-fit shadow-xl">
                <span className="text-[11px] font-heading font-bold text-amber-400">Trip Mode</span>
              </div>
            </DecayCard>

            {/* Feature 2: Live Sync */}
            <DecayCard
              width={340}
              height={450}
              intensity={0.35}
              sensitivity={0.5}
              hoverDecay={0.06}
              recovery={0.25}
              idle={0}
              radius={24}
              scope="card"
              image="/Images/Decaycard2.png"
            >
              <div className="space-y-1 select-none liquid-glass px-3.5 py-2 rounded-xl border border-white/15 w-fit shadow-xl">
                <span className="text-[11px] font-heading font-bold text-cyan-400">Live Sync</span>
              </div>
            </DecayCard>

            {/* Feature 3: Spending Insights */}
            <DecayCard
              width={340}
              height={450}
              intensity={0.35}
              sensitivity={0.5}
              hoverDecay={0.06}
              recovery={0.25}
              idle={0}
              radius={24}
              scope="card"
              image="/Images/Decaycard3.png"
            >
              <div className="space-y-1 select-none liquid-glass px-3.5 py-2 rounded-xl border border-white/15 w-fit shadow-xl">
                <span className="text-[11px] font-heading font-bold text-emerald-400">
                  Spending Insights
                </span>
              </div>
            </DecayCard>
          </div>
        </div>
      </section>

      {/* 3. Real Recent Spend / History Section on Landing Page */}
      <section
        id="history-section"
        className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-16 border-t border-white/10 w-full max-w-full overflow-x-clip"
      >
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-display font-bold tracking-widest uppercase text-purple-400">
                Live Group Ledger
              </span>
              <h3 className="text-2xl sm:text-4xl font-heading font-black text-white tracking-tight mt-1 drop-shadow">
                Recent Group Expenses
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onLaunchApp('expenses')}
              className="self-start sm:self-auto text-xs font-heading font-bold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1.5 cursor-pointer bg-purple-500/10 hover:bg-purple-500/20 px-3.5 py-2 rounded-xl border border-purple-500/30"
            >
              <span>View all {expenses.length} expenses in studio</span>
              <span>→</span>
            </button>
          </div>

          {/* Short real expense list with Liquid Glass Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {shortExpenses.map((exp) => {
              const payer = members.find((m) => m.id === exp.payerId);
              return (
                <div
                  key={exp.id}
                  className="liquid-glass-card p-4 sm:p-5 rounded-2xl flex items-center justify-between gap-3 hover:border-purple-500/40 hover:scale-[1.01] transition-all"
                >
                  <div className="min-w-0">
                    <h5 className="font-heading font-bold text-sm sm:text-base text-slate-100 truncate">
                      {exp.description}
                    </h5>
                    <p className="text-xs font-body text-slate-400 mt-0.5">
                      {exp.date} · Paid by{' '}
                      <span className="text-purple-300 font-semibold">
                        {payer?.name || 'Member'}
                      </span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base sm:text-lg font-bold text-white font-mono-numbers">
                      {formatPaise(exp.amountPaise)}
                    </span>
                    <span className="block text-[11px] font-display text-slate-400">
                      {exp.memberShares.length} shares
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 4. Live Spending Analytics Breakdown on Landing Page */}
      <section
        id="analytics-section"
        className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-16 border-t border-white/10 w-full max-w-full overflow-x-clip"
      >
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-display font-bold tracking-widest uppercase text-emerald-400">
                Spending Breakdown
              </span>
              <h3 className="text-2xl sm:text-4xl font-heading font-black text-white tracking-tight mt-1 drop-shadow">
                Group Spend by Category
              </h3>
            </div>
            <div className="text-sm font-body text-slate-300">
              Total Recorded:{' '}
              <span className="font-bold text-white font-mono-numbers text-base">
                {formatPaise(totalSpentPaise)}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(categoryTotals)
              .slice(0, 4)
              .map(([category, amountPaise]) => {
                const pct =
                  totalSpentPaise > 0 ? Math.round((amountPaise / totalSpentPaise) * 100) : 0;
                return (
                  <div
                    key={category}
                    className="liquid-glass-card p-5 rounded-2xl space-y-2.5 hover:border-emerald-500/40 transition-colors"
                  >
                    <span className="text-xs font-display font-bold text-slate-400 uppercase tracking-wider block">
                      {category}
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-slate-100 font-mono-numbers">
                      {formatPaise(amountPaise)}
                    </div>
                    <div className="w-full bg-slate-800/80 h-2 rounded-full overflow-hidden p-0.5">
                      <div
                        className="bg-gradient-to-r from-purple-500 via-indigo-500 to-cyan-400 h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-slate-400 block">
                      {pct}% of group spend
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      </section>

      {/* 5. Minimalist Outro Call to Action */}
      <section className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-16 border-t border-white/10 w-full max-w-full overflow-x-clip">
        <div className="max-w-[1500px] mx-auto">
          <div className="rounded-3xl liquid-glass p-8 sm:p-12 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6 border border-purple-500/30">
            <div className="space-y-2 max-w-xl text-center sm:text-left">
              <h3 className="text-2xl sm:text-3xl font-heading font-black text-white">
                Ready to calculate and settle up?
              </h3>
              <p className="text-xs sm:text-sm font-body text-slate-300 leading-relaxed">
                Expenses and receipt images are processed in your browser. Group records are stored
                locally with IndexedDB.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0 flex-wrap justify-center">
              <button
                type="button"
                onClick={() => onLaunchApp('split-studio')}
                className="px-6 py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-heading font-bold text-xs sm:text-sm shadow-xl cursor-pointer"
              >
                Open Split Studio
              </button>
              <button
                type="button"
                onClick={() => onLaunchApp('settlement')}
                className="px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-750 text-slate-200 font-heading font-semibold text-xs sm:text-sm border border-white/10 cursor-pointer"
              >
                Settle Debts
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 sm:px-12 max-w-[1500px] mx-auto w-full max-w-full overflow-x-clip flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <img
            src="/Images/SplitSmart Neon Receipt Logo.png"
            alt="Logo"
            className="w-5 h-5 rounded"
          />
          <span className="font-semibold text-slate-300">SplitSmart</span>
          <span>·</span>
          <span>Client-Side Local Ledger</span>
        </div>
        <div className="flex items-center gap-5">
          <button
            type="button"
            onClick={() => onLaunchApp('split-studio')}
            className="hover:text-purple-300"
          >
            Split Studio
          </button>
          <button
            type="button"
            onClick={() => onLaunchApp('expenses')}
            className="hover:text-purple-300"
          >
            Expenses
          </button>
          <button
            type="button"
            onClick={() => onLaunchApp('settlement')}
            className="hover:text-purple-300"
          >
            Settlement
          </button>
        </div>
      </footer>
    </div>
  );
};
