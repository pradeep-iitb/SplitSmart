import React, { useRef, useState } from 'react';

interface DecayCardFeatureProps {
  title: string;
  tagline: string;
  badge: string;
  image?: string;
  children?: React.ReactNode;
  gradient?: string;
}

export const DecayCardFeature: React.FC<DecayCardFeatureProps> = ({
  title,
  tagline,
  badge,
  children,
  gradient = 'from-purple-900/40 via-slate-900/90 to-slate-950',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  const [glint, setGlint] = useState({ x: 50, y: 50, opacity: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    const rotX = ((y - centerY) / centerY) * -10;
    const rotY = ((x - centerX) / centerX) * 10;

    setTransform(`perspective(1000px) rotateX(${rotX.toFixed(2)}deg) rotateY(${rotY.toFixed(2)}deg) scale3d(1.02, 1.02, 1.02)`);
    setGlint({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.15,
    });
  };

  const handleMouseLeave = () => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)');
    setGlint({ x: 50, y: 50, opacity: 0 });
  };

  return (
    <div
      ref={cardRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ transform }}
      className={`relative overflow-hidden rounded-3xl p-7 bg-gradient-to-br ${gradient} border border-slate-800/80 hover:border-purple-500/50 shadow-2xl transition-all duration-200 ease-out`}
    >
      {/* Glint light overlay */}
      <div
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          background: `radial-gradient(circle at ${glint.x}% ${glint.y}%, rgba(255,255,255,${glint.opacity}), transparent 60%)`,
        }}
      />

      {/* Top Header Tag */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-[11px] font-bold font-mono tracking-wider uppercase px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-300">
          {badge}
        </span>
      </div>

      {/* Content */}
      <h3 className="text-xl font-extrabold text-slate-100 tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5">
        {tagline}
      </p>

      {/* Embedded interactive graphic or slot */}
      {children}
    </div>
  );
};

