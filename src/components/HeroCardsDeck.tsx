import React, { useState } from 'react';
import { Camera, Calculator, QrCode, Sparkles, ArrowRight } from 'lucide-react';

interface HeroCardsDeckProps {
  onCardClick?: (tab: string) => void;
}

export const HeroCardsDeck: React.FC<HeroCardsDeckProps> = ({ onCardClick }) => {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const cards = [
    {
      id: 'ocr',
      tab: 'split-studio',
      badge: 'OCR ENGINE',
      badgeColor: 'text-emerald-400 bg-emerald-500/20 border-emerald-500/30',
      title: 'Smart Receipt Scan',
      desc: 'Extracts line items, dishes, drinks, CGST, SGST & service charges in seconds.',
      tag: 'Offline OCR · Zero Typing',
      icon: <Camera className="w-5 h-5 text-emerald-400" />,
      rotation: -8,
      offsetX: -35,
      offsetY: 24,
      glow: 'rgba(16, 185, 129, 0.25)',
    },
    {
      id: 'split',
      tab: 'split-studio',
      badge: 'PRECISION',
      badgeColor: 'text-purple-400 bg-purple-500/20 border-purple-500/30',
      title: 'Multi-Way Split',
      desc: 'Even split, percentage shares, custom items & exact odd-paisa precision.',
      tag: '0.00 Paisa Drift Invariant',
      icon: <Calculator className="w-5 h-5 text-purple-400" />,
      rotation: -3,
      offsetX: -12,
      offsetY: 12,
      glow: 'rgba(147, 51, 234, 0.3)',
    },
    {
      id: 'settlement',
      tab: 'settlement',
      badge: 'INSTANT SETTLE',
      badgeColor: 'text-cyan-400 bg-cyan-500/20 border-cyan-500/30',
      title: 'Dynamic UPI QR',
      desc: 'Direct peer-to-peer settlement without middleman fees. GPay · PhonePe · Paytm.',
      tag: 'Instant Bank Transfer',
      icon: <QrCode className="w-5 h-5 text-cyan-400" />,
      rotation: 3,
      offsetX: 12,
      offsetY: 0,
      glow: 'rgba(6, 182, 212, 0.3)',
    },
    {
      id: 'simplify',
      tab: 'settlement',
      badge: 'GRAPH OPTIMIZER',
      badgeColor: 'text-amber-400 bg-amber-500/20 border-amber-500/30',
      title: 'Debt Simplification',
      desc: 'Turns messy multi-person web of debts into minimal payments with zero awkward math.',
      tag: 'Minimal Transactions',
      icon: <Sparkles className="w-5 h-5 text-amber-400" />,
      rotation: 9,
      offsetX: 36,
      offsetY: -12,
      glow: 'rgba(245, 158, 11, 0.3)',
      featured: true,
    },
  ];

  return (
    <div className="relative w-full max-w-[480px] h-[370px] flex items-center justify-center select-none">
      {cards.map((c, idx) => {
        const isHovered = hoveredIdx === idx;
        const currentRot = isHovered ? 0 : c.rotation;
        const scale = isHovered ? 1.06 : 1;
        const zIndex = isHovered ? 40 : idx + 10;
        const translateY = isHovered ? -16 : c.offsetY;
        const translateX = c.offsetX;

        return (
          <div
            key={c.id}
            onMouseEnter={() => setHoveredIdx(idx)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => onCardClick?.(c.tab)}
            style={{
              transform: `translate3d(${translateX}px, ${translateY}px, 0) rotate(${currentRot}deg) scale(${scale})`,
              zIndex,
              boxShadow: isHovered
                ? `0 25px 50px -12px ${c.glow}, 0 0 35px ${c.glow}`
                : '0 20px 40px -15px rgba(0,0,0,0.7)',
            }}
            className="absolute w-[290px] sm:w-[320px] p-6 rounded-3xl bg-slate-900/95 border border-slate-700/80 backdrop-blur-2xl transition-all duration-300 ease-out cursor-pointer group hover:border-slate-400"
          >
            {/* Top row */}
            <div className="flex items-center justify-between mb-4">
              <span className={`text-[10px] font-mono font-bold px-2.5 py-1 rounded-full border ${c.badgeColor} flex items-center gap-1.5`}>
                {c.featured && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />}
                <span>{c.badge}</span>
              </span>
              <span className="p-2 rounded-xl bg-slate-800/80 border border-slate-700/50 group-hover:scale-110 transition-transform">
                {c.icon}
              </span>
            </div>

            {/* Title & Desc */}
            <h4 className="text-lg font-bold text-white tracking-tight group-hover:text-purple-300 transition-colors">
              {c.title}
            </h4>
            <p className="text-xs text-slate-300/80 leading-relaxed mt-1.5 line-clamp-3">
              {c.desc}
            </p>

            {/* Footer */}
            <div className="mt-5 pt-3.5 border-t border-slate-800/80 flex items-center justify-between text-xs">
              <span className="font-mono text-[11px] text-slate-400">{c.tag}</span>
              <span className="text-purple-400 group-hover:translate-x-1 transition-transform inline-flex items-center gap-1 font-semibold">
                <span>Explore</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
};

