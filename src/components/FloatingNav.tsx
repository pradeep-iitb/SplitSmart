import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Camera, PlusCircle, FolderOpen, ArrowLeft, Menu, X } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

export interface FloatingNavProps {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
  brandElement?: React.ReactNode;
  ctaElement?: React.ReactNode;
  onReturnHome?: () => void;
  onOpenScan?: () => void;
  onOpenManual?: () => void;
  onOpenGroups?: () => void;
  className?: string;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  items,
  activeId,
  onChange,
  brandElement,
  ctaElement,
  onReturnHome,
  onOpenScan,
  onOpenManual,
  onOpenGroups,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [pillStyle, setPillStyle] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
    opacity: number;
  }>({
    left: 0,
    top: 0,
    width: 0,
    height: 0,
    opacity: 0,
  });

  const updatePill = useCallback(() => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector(
      `[data-nav-id="${activeId}"]`
    ) as HTMLElement;
    if (activeEl) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setPillStyle({
        left: activeRect.left - containerRect.left,
        top: activeRect.top - containerRect.top,
        width: activeRect.width,
        height: activeRect.height,
        opacity: 1,
      });
    }
  }, [activeId]);

  useEffect(() => {
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [updatePill, items]);

  const activeItem = items.find((item) => item.id === activeId);

  return (
    <header
      className={`fixed top-3 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100vw-24px)] md:w-[75vw] max-w-6xl transition-all duration-300 ${className}`}
    >
      <div className="liquid-glass rounded-full px-3.5 sm:px-6 py-2 flex items-center justify-between shadow-2xl">
        {/* Desktop Left: Brand Logo & Landing return */}
        <div className="hidden md:flex items-center gap-3">
          {brandElement ? (
            brandElement
          ) : (
            <div
              onClick={onReturnHome}
              className="flex items-center gap-2.5 cursor-pointer select-none group"
              title="Return to Landing Page"
            >
              <img
                src="/Images/SplitSmart Neon Receipt Logo.png"
                alt="SplitSmart Logo"
                className="w-7 h-7 sm:w-8 sm:h-8 object-contain rounded-xl drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] group-hover:scale-105 transition-transform shrink-0"
              />
              <span className="font-heading font-black text-sm tracking-tight text-white drop-shadow hidden lg:inline">
                SplitSmart
              </span>
            </div>
          )}

          {onReturnHome && !brandElement && (
            <button
              type="button"
              onClick={onReturnHome}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-heading font-medium border border-white/10 transition-colors cursor-pointer"
              title="Return to Landing Page"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Landing</span>
            </button>
          )}
        </div>

        {/* Desktop Center: Sliding Active Pill */}
        <div
          ref={containerRef}
          className="relative hidden md:flex items-center gap-1 font-heading text-xs font-medium"
        >
          <span
            className="pointer-events-none absolute rounded-full bg-gradient-to-r from-purple-600 via-indigo-600 to-cyan-500 shadow-[0_0_24px_rgba(147,51,234,0.55)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
            style={{
              left: `${pillStyle.left}px`,
              top: `${pillStyle.top}px`,
              width: `${pillStyle.width}px`,
              height: `${pillStyle.height}px`,
              opacity: pillStyle.opacity,
            }}
          />
          <nav className="flex items-center gap-1">
            {items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  data-nav-id={item.id}
                  onClick={() => onChange(item.id)}
                  className={`relative z-10 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer select-none ${
                    isActive
                      ? 'text-white font-bold'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                  }`}
                >
                  {item.icon && <span className="shrink-0">{item.icon}</span>}
                  <span>{item.label}</span>
                  {item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                        isActive
                          ? 'bg-purple-950/60 text-purple-200 border border-purple-400/40'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Desktop Right CTA Actions */}
        <div className="hidden md:flex items-center gap-2">
          {ctaElement ? (
            ctaElement
          ) : (
            <>
              {onOpenScan && (
                <button
                  type="button"
                  onClick={onOpenScan}
                  className="px-3.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 hover:opacity-95 text-white text-xs font-heading font-bold flex items-center gap-1.5 shadow-md shadow-emerald-950/40 cursor-pointer transition-all"
                  title="Scan Receipt OCR"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Scan</span>
                </button>
              )}
              {onOpenManual && (
                <button
                  type="button"
                  onClick={onOpenManual}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Add Expense"
                >
                  <PlusCircle className="w-4 h-4 text-purple-400" />
                </button>
              )}
              {onOpenGroups && (
                <button
                  type="button"
                  onClick={onOpenGroups}
                  className="p-1.5 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-white/10 transition-colors cursor-pointer"
                  title="Switch Group"
                >
                  <FolderOpen className="w-4 h-4 text-blue-400" />
                </button>
              )}
            </>
          )}
        </div>

        {/* Mobile Bar: Active Tab indicator + Scan button + Hamburger toggle */}
        <div className="flex md:hidden items-center justify-between w-full">
          <div className="flex items-center gap-2.5">
            <img
              src="/Images/SplitSmart Neon Receipt Logo.png"
              alt="SplitSmart Logo"
              className="w-7 h-7 object-contain rounded-xl drop-shadow-[0_0_12px_rgba(168,85,247,0.6)] shrink-0 cursor-pointer"
              onClick={onReturnHome}
            />
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
              <span className="font-heading font-black text-xs text-white uppercase tracking-wider">
                {activeItem?.label || 'Engine'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {onOpenScan && (
              <button
                type="button"
                onClick={onOpenScan}
                className="px-2.5 py-1.5 rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white text-[11px] font-heading font-bold flex items-center gap-1 shadow-sm"
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Scan</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsMobileMenuOpen((prev) => !prev)}
              className="p-2 rounded-full bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-colors"
              aria-label="Toggle Menu"
            >
              {isMobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Dropdown Liquid Glass Sheet */}
      {isMobileMenuOpen && (
        <div className="md:hidden mt-2 p-4 rounded-3xl liquid-glass space-y-3 animate-in fade-in slide-in-from-top-3 duration-200 shadow-2xl">
          <div className="grid grid-cols-2 gap-2">
            {items.map((item) => {
              const isActive = item.id === activeId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    onChange(item.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`p-2.5 rounded-xl text-left text-xs font-heading font-semibold flex items-center justify-between transition-all ${
                    isActive
                      ? 'bg-purple-600/30 text-purple-200 border border-purple-500/50 shadow-md'
                      : 'text-slate-300 hover:bg-white/5 border border-white/5'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {item.icon && <span className="shrink-0">{item.icon}</span>}
                    <span className="truncate">{item.label}</span>
                  </div>
                  {item.badge !== undefined && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-800 text-slate-300 font-mono">
                      {item.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Quick Action buttons in Mobile Sheet */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {onOpenManual && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenManual();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-heading font-medium flex items-center gap-1 border border-white/10"
                >
                  <PlusCircle className="w-3.5 h-3.5 text-purple-400" />
                  <span>Add</span>
                </button>
              )}
              {onOpenGroups && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    onOpenGroups();
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-heading font-medium flex items-center gap-1 border border-white/10"
                >
                  <FolderOpen className="w-3.5 h-3.5 text-blue-400" />
                  <span>Groups</span>
                </button>
              )}
            </div>

            {onReturnHome && (
              <button
                type="button"
                onClick={() => {
                  setIsMobileMenuOpen(false);
                  onReturnHome();
                }}
                className="px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-200 text-xs font-heading font-semibold border border-purple-500/30 flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Landing</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
