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

  const navItems = [
    { label: 'Overview' },
    { label: 'Features' },
    { label: 'Recent Spend' },
    { label: 'Analytics' },
  ];

  const handleNavChange = (index: number) => {
    setActiveNavIdx(index);
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

  // 5 distinct avatar card images for BounceCards
  const bounceImages = [
    '/Images/Avatar1.png',
    '/Images/Avatar2.png',
    '/Images/SplitSmart Neon Receipt Logo.png',
    '/Images/Avatar3.png',
    '/Images/Avatar4.png',
  ];

  // Real short expenses from active group (up to 4 clean entries)
  const shortExpenses = expenses.slice(0, 4);

  // Real category totals for Analytics preview
  const categoryTotals = expenses.reduce((acc, exp) => {
    const cat = exp.category || 'General';
    acc[cat] = (acc[cat] || 0) + exp.amountPaise;
    return acc;
  }, {} as Record<string, number>);

  const totalSpentPaise = expenses.reduce((sum, e) => sum + e.amountPaise, 0);

  return (
    <div className="relative w-full text-slate-100 flex flex-col font-['Outfit',sans-serif]">
      {/* Floating Unified Navbar: Previous UI Structure + Fluid Gooey Animation */}
      <header className="fixed top-3.5 sm:top-5 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 sm:gap-2 p-1.5 rounded-full bg-slate-900/90 backdrop-blur-2xl border border-slate-700/70 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.12)]">
        {/* Brand / Logo on Left (from previous navbar) */}
        <div
          onClick={() => handleNavChange(0)}
          className="flex items-center gap-2 pl-2 pr-3 py-1 border-r border-slate-800 cursor-pointer select-none"
        >
          <img
            src="/Images/SplitSmart Neon Receipt Logo.png"
            alt="SplitSmart Logo"
            className="w-7 h-7 object-contain rounded-lg drop-shadow-[0_0_10px_rgba(147,51,234,0.5)] shrink-0"
          />
          <span className="font-extrabold text-sm tracking-tight text-white hidden sm:inline">
            SplitSmart
          </span>
        </div>

        {/* Center GooeyNav Tabs with Fluid Gooey Animation */}
        <div className="flex items-center">
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

        {/* Action Button on Right (from previous navbar) */}
        <div className="flex items-center pl-2 pr-1 border-l border-slate-800">
          <button
            type="button"
            onClick={() => onLaunchApp('split-studio')}
            className="px-4 py-1.5 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:opacity-95 text-white font-bold text-xs shadow-[0_0_15px_rgba(147,51,234,0.4)] transition-all cursor-pointer whitespace-nowrap"
          >
            Launch App →
          </button>
        </div>
      </header>

      {/* 1. Full Viewport Hero Section (100vh) WITH AeroShards BG ONLY HERE */}
      <section
        id="hero-section"
        className="relative min-h-screen w-full flex flex-col justify-center overflow-hidden bg-[#07090e]"
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

        {/* Hero Content Grid */}
        <div className="relative z-10 max-w-[1500px] mx-auto w-full px-4 sm:px-8 lg:px-12 pt-24 pb-12 grid grid-cols-1 lg:grid-cols-12 gap-10 items-center my-auto">
          {/* Left: Text & Actions */}
          <div className="lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-semibold backdrop-blur-md">
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-ping" />
              <span>Local-First Group Ledger</span>
            </div>

            <h1 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white leading-[1.08]">
              Fair bill splitting. <br />
              <span className="bg-gradient-to-r from-purple-400 via-indigo-300 to-cyan-400 bg-clip-text text-transparent">
                Zero awkward math.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-slate-300/85 leading-relaxed max-w-xl">
              Scan paper receipts, divide shared expenses with exact odd-paisa precision, and settle group debts directly with friends via 1-tap UPI QR codes.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => onLaunchApp('split-studio')}
                className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:opacity-95 text-white font-bold text-sm shadow-[0_0_25px_rgba(124,58,237,0.45)] hover:shadow-[0_0_35px_rgba(124,58,237,0.65)] transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                Launch SplitSmart →
              </button>

              <button
                type="button"
                onClick={onOpenScanModal}
                className="px-5 py-3.5 rounded-2xl bg-slate-900/90 hover:bg-slate-800 border border-slate-700/80 text-slate-200 font-semibold text-sm backdrop-blur-md transition-all cursor-pointer flex items-center gap-2"
              >
                <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span>Scan Receipt</span>
              </button>
            </div>

            {/* Invariant guarantee stats */}
            <div className="pt-6 border-t border-slate-800/80 flex items-center gap-6 sm:gap-8 text-xs font-mono text-slate-400">
              <div>
                <span className="block text-slate-100 font-bold text-sm">₹0.00</span>
                <span>Odd-Paisa Drift</span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="block text-slate-100 font-bold text-sm">{members.length}</span>
                <span>Active Members</span>
              </div>
              <div className="w-px h-6 bg-slate-800" />
              <div>
                <span className="block text-emerald-400 font-bold text-sm">Offline</span>
                <span>IndexedDB Storage</span>
              </div>
            </div>
          </div>

          {/* Right: Smooth Spring-Physics BounceCards with User's Uploaded Hero Cards */}
          <div className="lg:col-span-6 flex items-center justify-center pt-8 lg:pt-0">
            <BounceCards
              images={[
                '/Images/Herocard1.png',
                '/Images/Herocard2.png',
                '/Images/Herocard3.png',
                '/Images/Herocard4.png',
              ]}
              containerWidth={480}
              containerHeight={340}
              cardSize={220}
              spread={65}
              rotation={8}
              arc={0}
              pushDistance={140}
              hoverScale={1.08}
              bounciness={0.6}
              animationDelay={0.3}
              animationStagger={0.06}
              borderWidth={1}
              borderColor="rgba(255, 255, 255, 0.14)"
              radius={24}
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
        className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-20 border-t border-slate-800/80 w-full"
      >
        <div className="max-w-[1500px] mx-auto">
          <div className="text-left mb-12">
            <span className="text-xs font-mono font-bold tracking-widest uppercase text-cyan-400">
              Core Capabilities
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-100 tracking-tight mt-2">
              Structured for group trips, housemates & events
            </h2>
            <p className="text-sm sm:text-base text-slate-400 max-w-2xl mt-1">
              Zero floating-point rounding errors, real-time balance reconciliation, and instant UPI settlement.
            </p>
          </div>

          {/* Grid with DecayCard components (using user uploaded photos as bg with reduced content) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 justify-items-center">
            {/* Feature 1: DecayCard Receipt OCR */}
            <DecayCard
              width={340}
              height={450}
              intensity={0.5}
              sensitivity={0.6}
              hoverDecay={0.08}
              recovery={0.6}
              idle={0.15}
              radius={24}
              scope="card"
              image="/Images/Decaycard1.png"
            >
              <div className="space-y-1 select-none bg-slate-950/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 w-fit">
                <span className="text-[10px] font-mono font-bold text-emerald-400">Smart OCR Engine</span>
              </div>
            </DecayCard>

            {/* Feature 2: DecayCard Hamilton-Hare Rounding */}
            <DecayCard
              width={340}
              height={450}
              intensity={0.5}
              sensitivity={0.6}
              hoverDecay={0.08}
              recovery={0.6}
              idle={0.15}
              radius={24}
              scope="card"
              image="/Images/Decaycard2.png"
            >
              <div className="space-y-1 select-none bg-slate-950/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 w-fit">
                <span className="text-[10px] font-mono font-bold text-purple-400">Odd-Paisa Precision</span>
              </div>
            </DecayCard>

            {/* Feature 3: DecayCard UPI Settlement */}
            <DecayCard
              width={340}
              height={450}
              intensity={0.5}
              sensitivity={0.6}
              hoverDecay={0.08}
              recovery={0.6}
              idle={0.15}
              radius={24}
              scope="card"
              image="/Images/Decaycard3.png"
            >
              <div className="space-y-1 select-none bg-slate-950/70 backdrop-blur-md px-3.5 py-2 rounded-xl border border-white/10 w-fit">
                <span className="text-[10px] font-mono font-bold text-cyan-400">Dynamic UPI QR</span>
              </div>
            </DecayCard>
          </div>
        </div>
      </section>

      {/* 3. Real Recent Spend / History Section on Landing Page */}
      <section
        id="history-section"
        className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-16 border-t border-slate-800/80 w-full"
      >
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-purple-400">
                Live Group Ledger
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight mt-1">
                Recent Group Expenses
              </h3>
            </div>

            <button
              type="button"
              onClick={() => onLaunchApp('expenses')}
              className="self-start sm:self-auto text-xs font-semibold text-purple-400 hover:text-purple-300 transition-colors flex items-center gap-1 cursor-pointer"
            >
              <span>View all {expenses.length} expenses in studio</span>
              <span>→</span>
            </button>
          </div>

          {/* Short real expense list */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {shortExpenses.map((exp) => {
              const payer = members.find((m) => m.id === exp.payerId);
              return (
                <div
                  key={exp.id}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-4 rounded-2xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
                >
                  <div className="min-w-0">
                    <h5 className="font-semibold text-sm text-slate-100 truncate">
                      {exp.description}
                    </h5>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {exp.date} · Paid by <span className="text-slate-200 font-medium">{payer?.name || 'Member'}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-base font-bold text-slate-100 font-mono">
                      {formatPaise(exp.amountPaise)}
                    </span>
                    <span className="block text-[11px] text-slate-400">
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
        className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-16 border-t border-slate-800/80 w-full"
      >
        <div className="max-w-[1500px] mx-auto">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
            <div>
              <span className="text-xs font-mono font-bold tracking-widest uppercase text-emerald-400">
                Spending Breakdown
              </span>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-slate-100 tracking-tight mt-1">
                Group Spend by Category
              </h3>
            </div>
            <div className="text-sm font-mono text-slate-300">
              Total Recorded: <span className="font-bold text-white">{formatPaise(totalSpentPaise)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Object.entries(categoryTotals).slice(0, 4).map(([category, amountPaise]) => {
              const pct = totalSpentPaise > 0 ? Math.round((amountPaise / totalSpentPaise) * 100) : 0;
              return (
                <div
                  key={category}
                  className="bg-slate-900/80 backdrop-blur-xl border border-slate-800 p-5 rounded-2xl space-y-2"
                >
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    {category}
                  </span>
                  <div className="text-xl font-extrabold text-slate-100 font-mono">
                    {formatPaise(amountPaise)}
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                    <div
                      className="bg-gradient-to-r from-purple-500 to-indigo-500 h-full rounded-full"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="text-[11px] text-slate-400 block">{pct}% of group spend</span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 5. Minimalist Outro Call to Action */}
      <section className="relative moving-gradient-bg px-4 sm:px-8 lg:px-12 py-16 border-t border-slate-800/80 w-full">
        <div className="max-w-[1500px] mx-auto">
          <div className="rounded-3xl bg-slate-900/90 border border-purple-500/30 p-8 sm:p-12 shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="space-y-2 max-w-xl">
              <h3 className="text-2xl sm:text-3xl font-bold text-white">
                Ready to calculate and settle up?
              </h3>
              <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                Everything runs directly in your browser. Encrypted locally with Dexie IndexedDB.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={() => onLaunchApp('split-studio')}
                className="px-6 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs sm:text-sm shadow-lg cursor-pointer"
              >
                Open Split Studio
              </button>
              <button
                type="button"
                onClick={() => onLaunchApp('settlement')}
                className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm border border-slate-700 cursor-pointer"
              >
                Settle Debts
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Footer */}
      <footer className="border-t border-slate-800/80 py-6 px-6 sm:px-12 max-w-[1500px] mx-auto w-full flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <img src="/Images/SplitSmart Neon Receipt Logo.png" alt="Logo" className="w-5 h-5 rounded" />
          <span className="font-semibold text-slate-300">SplitSmart</span>
          <span>·</span>
          <span>Client-Side Local Ledger</span>
        </div>
        <div className="flex items-center gap-5">
          <button type="button" onClick={() => onLaunchApp('split-studio')} className="hover:text-purple-300">
            Split Studio
          </button>
          <button type="button" onClick={() => onLaunchApp('expenses')} className="hover:text-purple-300">
            Expenses
          </button>
          <button type="button" onClick={() => onLaunchApp('settlement')} className="hover:text-purple-300">
            Settlement
          </button>
        </div>
      </footer>
    </div>
  );
};
