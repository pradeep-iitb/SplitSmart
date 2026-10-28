import React, { useRef, useState, useEffect } from 'react';

export interface NavItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  badge?: number | string;
}

interface FloatingNavProps {
  items: NavItem[];
  activeId: string;
  onChange: (id: string) => void;
  brandElement?: React.ReactNode;
  ctaElement?: React.ReactNode;
  className?: string;
}

export const FloatingNav: React.FC<FloatingNavProps> = ({
  items,
  activeId,
  onChange,
  brandElement,
  ctaElement,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pillStyle, setPillStyle] = useState<{ left: number; width: number; opacity: number }>({
    left: 0,
    width: 0,
    opacity: 0,
  });

  const updatePill = () => {
    if (!containerRef.current) return;
    const activeEl = containerRef.current.querySelector(`[data-nav-id="${activeId}"]`) as HTMLElement;
    if (activeEl) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const activeRect = activeEl.getBoundingClientRect();
      setPillStyle({
        left: activeRect.left - containerRect.left,
        width: activeRect.width,
        opacity: 1,
      });
    }
  };

  useEffect(() => {
    updatePill();
    window.addEventListener('resize', updatePill);
    return () => window.removeEventListener('resize', updatePill);
  }, [activeId, items]);

  return (
    <header className={`fixed top-3.5 sm:top-5 left-1/2 -translate-x-1/2 z-50 w-auto max-w-[95vw] sm:max-w-max transition-all ${className}`}>
      <div
        ref={containerRef}
        className="relative flex items-center gap-1 sm:gap-2 p-1.5 sm:p-2 rounded-full bg-slate-900/85 backdrop-blur-2xl border border-slate-700/60 shadow-[0_12px_40px_-10px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.12)] text-xs sm:text-sm font-medium"
      >
        {/* Brand / Logo prefix if present */}
        {brandElement && (
          <div className="flex items-center pl-1.5 pr-2 border-r border-slate-800">
            {brandElement}
          </div>
        )}

        {/* Sliding Active Pill (Gooey-inspired fluid indicator) */}
        <span
          className="pointer-events-none absolute h-[calc(100%-12px)] top-[6px] rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 shadow-[0_0_20px_rgba(147,51,234,0.45)] transition-all duration-300 ease-[cubic-bezier(0.25,1,0.5,1)]"
          style={{
            left: `${pillStyle.left}px`,
            width: `${pillStyle.width}px`,
            opacity: pillStyle.opacity,
          }}
        />

        {/* Navigation Item Buttons */}
        <nav className="flex items-center gap-0.5 sm:gap-1 overflow-x-auto no-scrollbar">
          {items.map((item) => {
            const isActive = item.id === activeId;
            return (
              <button
                key={item.id}
                type="button"
                data-nav-id={item.id}
                onClick={() => onChange(item.id)}
                className={`relative z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-colors whitespace-nowrap cursor-pointer select-none ${
                  isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/40'
                }`}
              >
                {item.icon && <span className="shrink-0">{item.icon}</span>}
                <span>{item.label}</span>
                {item.badge !== undefined && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      isActive
                        ? 'bg-purple-950/60 text-purple-200 border border-purple-400/30'
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

        {/* CTA element if present */}
        {ctaElement && (
          <div className="flex items-center pl-1 pr-1 border-l border-slate-800 ml-1">
            {ctaElement}
          </div>
        )}
      </div>
    </header>
  );
};

