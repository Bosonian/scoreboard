import { useState, useRef, useEffect, useCallback } from 'react';
import bgImage from './assets/bg-rettungswagen.jpg';
import { db } from './firebase';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// ===================== SPLIT-FLAP COUNTER (departure board) =====================
const FlipDigit = ({ digit }) => {
  const prevRef = useRef(digit);
  const [anim, setAnim] = useState(null); // { from, to }

  useEffect(() => {
    if (prevRef.current !== digit) {
      setAnim({ from: prevRef.current, to: digit });
      prevRef.current = digit;
      const timer = setTimeout(() => setAnim(null), 500);
      return () => clearTimeout(timer);
    }
  }, [digit]);

  const w = 28, h = 38, fs = 22, rad = 4;
  const font = { fontFamily: "'Inter', sans-serif", fontWeight: 800, fontSize: fs, color: 'rgba(255,255,255,0.92)', textShadow: '0 1px 2px rgba(0,0,0,0.4)' };
  const topBg = 'linear-gradient(180deg, #3a3a3a 0%, #2d2d2d 100%)';
  const botBg = 'linear-gradient(180deg, #282828 0%, #1e1e1e 100%)';

  const Half = ({ d, half, extra = {} }) => (
    <div style={{
      position: 'absolute', left: 0, right: 0, height: '50%', overflow: 'hidden',
      background: half === 'top' ? topBg : botBg,
      ...(half === 'top'
        ? { top: 0, borderRadius: `${rad}px ${rad}px 0 0`, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.08)' }
        : { bottom: 0, borderRadius: `0 0 ${rad}px ${rad}px`, boxShadow: 'inset 0 -1px 0 rgba(0,0,0,0.2)' }),
      ...extra,
    }}>
      <div style={{
        position: 'absolute', left: 0, right: 0, height: h,
        display: 'flex', alignItems: 'center', justifyContent: 'center', ...font,
        ...(half === 'top' ? { top: 0 } : { bottom: 0 }),
      }}>{d}</div>
    </div>
  );

  const d = anim ? anim.to : digit;
  return (
    <div style={{ width: w, height: h, position: 'relative', perspective: '300px' }}>
      {/* Static halves — always show current digit */}
      <Half d={d} half="top" extra={{ zIndex: 1 }} />
      <Half d={anim ? anim.from : digit} half="bottom" extra={{ zIndex: 1 }} />

      {/* Animated top flap (old digit) — flips down to reveal new */}
      {anim && <Half d={anim.from} half="top" extra={{ zIndex: 15, transformOrigin: '50% 100%', animation: 'flipDown 0.3s ease-in forwards', backfaceVisibility: 'hidden' }} />}

      {/* Animated bottom flap (new digit) — flips up into place */}
      {anim && <Half d={anim.to} half="bottom" extra={{ zIndex: 15, transformOrigin: '50% 0%', transform: 'rotateX(90deg)', animation: 'flipUp 0.3s 0.15s ease-out forwards', backfaceVisibility: 'hidden' }} />}

      {/* Split line — the mechanical gap */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: '50%', height: '1.5px', background: 'rgba(0,0,0,0.55)', zIndex: 20, transform: 'translateY(-0.75px)' }} />

      {/* Hinge rivets */}
      {[-2.5, null].map((pos, i) => (
        <div key={i} style={{
          position: 'absolute', top: '50%', transform: 'translateY(-50%)',
          ...(i === 0 ? { left: pos } : { right: -2.5 }),
          width: 5, height: 5, borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #333 0%, #1a1a1a 100%)',
          boxShadow: 'inset 0 0.5px 0 rgba(255,255,255,0.12), 0 0 1px rgba(0,0,0,0.4)',
          zIndex: 25,
        }} />
      ))}

      {/* Outer shadow for 3D depth */}
      <div style={{ position: 'absolute', inset: 0, borderRadius: rad, boxShadow: '0 2px 8px rgba(0,0,0,0.25), 0 0 0 0.5px rgba(0,0,0,0.15)', pointerEvents: 'none', zIndex: 0 }} />
    </div>
  );
};

const FlipCounter = ({ value, minDigits = 2 }) => {
  const digits = String(value).padStart(minDigits, '0').split('');
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {digits.map((d, i) => <FlipDigit key={i} digit={d} />)}
    </div>
  );
};

// ===================== BUSINESS LOGIC =====================
const getPrediction = (prob, cutoff) => prob >= cutoff ? 'positive' : 'negative';

const calculateMatch = (prob, ctResult, cutoff) => {
  if (ctResult === null) return { status: 'pending' };
  if (ctResult === 'na') return { status: 'na' };
  const prediction = getPrediction(prob, cutoff);
  if (prediction === 'positive' && ctResult === 'confirmed') return { status: 'match' };
  if (prediction === 'negative' && ctResult === 'ruled_out') return { status: 'match' };
  return { status: 'mismatch' };
};

const formatDateDE = (dateStr) => {
  // Already in DD.MM.YYYY format
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(dateStr)) return dateStr;
  // Convert from YYYY-MM-DD (with optional time)
  const d = dateStr.split(' ')[0].split('-');
  if (d.length === 3) return `${d[2]}.${d[1]}.${d[0]}`;
  return dateStr;
};

// Auto-generate case ID from station name: "DRK Ludwigsburg" → "DRKLB", + next number
const generateCaseId = (station, existingCases) => {
  if (!station) return '';
  const words = station.split(/\s+/);
  let prefix = '';
  if (words.length >= 2) {
    prefix = words[0].substring(0, 3).toUpperCase() + words.slice(1).map(w => w[0]).join('').toUpperCase();
  } else {
    prefix = station.substring(0, 4).toUpperCase();
  }
  const existing = existingCases.filter(c => c.id.startsWith(prefix)).map(c => parseInt(c.id.replace(prefix, '')) || 0);
  const next = existing.length > 0 ? Math.max(...existing) + 1 : 1;
  return `${prefix}${String(next).padStart(3, '0')}`;
};

const todayDE = () => {
  const d = new Date();
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
};

const getConfidenceColor = (prob, cutoff) => {
  if (prob >= cutoff) return { bg: 'from-emerald-500 to-emerald-600' };
  return { bg: 'from-blue-500 to-blue-600' };
};

// ===================== BOKEH BACKGROUND =====================
// 22px blur preserves soft shapes from the ambulance — real bokeh, not a color wash
// GPU-composited: translateZ(0) + will-change prevent mobile scroll repaint bugs
const BokehBackground = () => (
  <div className="fixed z-0 overflow-hidden"
    style={{
      top: '-200px', left: '-20px', right: '-20px', bottom: '-200px',
      willChange: 'transform', transform: 'translateZ(0)',
      backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden',
      WebkitTransform: 'translateZ(0)',
    }}>
    <div
      style={{
        position: 'absolute',
        inset: '-30px',
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        filter: 'blur(22px) brightness(1.08) saturate(1.35)',
        transform: 'scale(1.06) translateZ(0)',
        willChange: 'transform',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
      }}
    />
    {/* Warm white veil */}
    <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, rgba(255,252,248,0.18) 0%, rgba(255,248,240,0.22) 100%)' }} />
  </div>
);

// ===================== STAR OF LIFE SVG =====================
const StarOfLife = ({ size = 48, color = 'currentColor', style = {} }) => (
  <svg viewBox="0 0 200 200" width={size} height={size} fill="none" style={style}>
    <g fill={color}>
      {[0, 60, 120, 180, 240, 300].map(a => (
        <rect key={a} x="88" y="6" width="24" height="88" rx="4" transform={`rotate(${a}, 100, 100)`} />
      ))}
    </g>
    <g stroke={color === '#ffffff' || color === 'white' ? '#1a2332' : '#1a2332'} strokeWidth="3.5" fill="none" strokeLinecap="round">
      <line x1="100" y1="62" x2="100" y2="142" />
      <path d="M100 72 C108 72, 112 80, 104 84 C96 88, 92 96, 100 100 C108 104, 112 112, 104 116 C96 120, 92 128, 100 132" />
    </g>
  </svg>
);

// ===================== SIGNAL LAMP =====================
// Photorealistic glass indicator: 7-stop lens gradient, bloom filter,
// edge refraction, dual specular highlights, bezel bevel arcs,
// multi-layer CSS glow with natural falloff
let _lampId = 0;
const SignalLamp = ({ color = 'off', size = 'lg' }) => {
  const [uid] = useState(() => `sl${++_lampId}`);
  const sizes = {
    sm: { w: 30 },
    md: { w: 38 },
    lg: { w: 46 },
    xl: { w: 58 },
  };
  const s = sizes[size] || sizes.lg;
  const w = s.w;
  const r = w / 2;
  const br = r - 0.5;
  const lr = r * 0.56;
  const isLit = color !== 'off';

  // 7-stop lens gradients — creates depth + hot center
  const lens = {
    green: [
      ['0%', '#f0ffe8'], ['10%', '#b0f068'], ['28%', '#5cb85c'],
      ['50%', '#2e8b32'], ['75%', '#1a5e20'], ['92%', '#0d3310'], ['100%', '#071a08'],
    ],
    red: [
      ['0%', '#fff0e8'], ['10%', '#ff9478'], ['28%', '#e74c3c'],
      ['50%', '#c0392b'], ['75%', '#8e2218'], ['92%', '#4a1208'], ['100%', '#280804'],
    ],
    amber: [
      ['0%', '#fffde8'], ['10%', '#ffe070'], ['28%', '#f1c40f'],
      ['50%', '#d4a00a'], ['75%', '#8a6d08'], ['92%', '#4a3a04'], ['100%', '#282002'],
    ],
    off: [
      ['0%', '#8898a8'], ['20%', '#6a7a8a'], ['50%', '#4a5a68'],
      ['80%', '#384858'], ['100%', '#283848'],
    ],
  };

  const glow = {
    green: 'rgba(92,184,92,',
    red: 'rgba(231,76,60,',
    amber: 'rgba(241,196,15,',
    off: null,
  };
  const gc = glow[color];
  const stops = lens[color] || lens.off;

  return (
    <div style={{
      width: w, height: w, position: 'relative', flexShrink: 0,
      // Triple-layer CSS glow for natural light falloff
      filter: isLit ? [
        `drop-shadow(0 0 ${Math.round(w * 0.06)}px ${gc}0.45))`,
        `drop-shadow(0 0 ${Math.round(w * 0.18)}px ${gc}0.18))`,
        `drop-shadow(0 0 ${Math.round(w * 0.35)}px ${gc}0.06))`,
      ].join(' ') : undefined,
    }}>
      <svg width={w} height={w} viewBox={`0 0 ${w} ${w}`}>
        <defs>
          {/* 7-stop brushed aluminum bezel */}
          <radialGradient id={`bz-${uid}`} cx="36%" cy="28%">
            <stop offset="0%" stopColor="#f2f5f8" />
            <stop offset="12%" stopColor="#dce4ec" />
            <stop offset="30%" stopColor="#b0c0d0" />
            <stop offset="50%" stopColor="#8098ac" />
            <stop offset="70%" stopColor="#5c7488" />
            <stop offset="90%" stopColor="#3c5060" />
            <stop offset="100%" stopColor="#2a3c4c" />
          </radialGradient>

          {/* Multi-stop lens */}
          <radialGradient id={`ln-${uid}`} cx={isLit ? '42%' : '48%'} cy={isLit ? '36%' : '44%'}>
            {stops.map(([o, c], i) => <stop key={i} offset={o} stopColor={c} />)}
          </radialGradient>

          {/* Edge refraction — glass catches light at the rim */}
          <radialGradient id={`rf-${uid}`} cx="50%" cy="50%">
            <stop offset="76%" stopColor="transparent" />
            <stop offset="87%" stopColor={isLit ? 'rgba(255,255,255,0.16)' : 'rgba(255,255,255,0.06)'} />
            <stop offset="94%" stopColor={isLit ? 'rgba(255,255,255,0.09)' : 'rgba(255,255,255,0.03)'} />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>

          {/* Diagonal glass sheen */}
          <linearGradient id={`gs-${uid}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="white" stopOpacity={isLit ? 0.07 : 0.03} />
            <stop offset="50%" stopColor="white" stopOpacity="0" />
            <stop offset="100%" stopColor="white" stopOpacity={isLit ? 0.04 : 0.015} />
          </linearGradient>

          {/* Bloom: two Gaussian blur layers merged for natural light emission */}
          {isLit && (
            <filter id={`bl-${uid}`} x="-35%" y="-35%" width="170%" height="170%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="3.5" result="wide" />
              <feGaussianBlur in="SourceGraphic" stdDeviation="1.2" result="tight" />
              <feMerge>
                <feMergeNode in="wide" />
                <feMergeNode in="tight" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          )}

          {/* Off: concave inset shadow — lens looks recessed */}
          {!isLit && (
            <filter id={`cv-${uid}`} x="-10%" y="-10%" width="120%" height="120%">
              <feGaussianBlur in="SourceAlpha" stdDeviation="1.8" result="sh" />
              <feOffset dy="1" in="sh" result="os" />
              <feComposite in="os" in2="SourceGraphic" operator="arithmetic" k1="0" k2="0.65" k3="0.35" k4="0" />
            </filter>
          )}
        </defs>

        {/* 1. Bezel — brushed aluminum base */}
        <circle cx={r} cy={r} r={br} fill={`url(#bz-${uid})`} />

        {/* 2. Bezel highlight arc (top edge catches light) */}
        <path d={`M ${r - br * 0.85} ${r - br * 0.5} A ${br} ${br} 0 0 1 ${r + br * 0.85} ${r - br * 0.5}`}
          fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.7" strokeLinecap="round" />

        {/* 3. Bezel shadow arc (bottom edge in shadow) */}
        <path d={`M ${r - br * 0.75} ${r + br * 0.6} A ${br} ${br} 0 0 0 ${r + br * 0.75} ${r + br * 0.6}`}
          fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth="0.5" strokeLinecap="round" />

        {/* 4. Inner lip shadow — bezel overhangs the lens recess */}
        <circle cx={r} cy={r + 0.4} r={lr + 1.8} fill="none" stroke="rgba(0,0,0,0.18)" strokeWidth="1.2" />
        <circle cx={r} cy={r - 0.2} r={lr + 1.4} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />

        {/* 5. Lens — the main light surface with bloom or concave filter */}
        <circle cx={r} cy={r} r={lr} fill={`url(#ln-${uid})`}
          filter={isLit ? `url(#bl-${uid})` : `url(#cv-${uid})`} />

        {/* 6. Edge refraction ring */}
        <circle cx={r} cy={r} r={lr} fill={`url(#rf-${uid})`} />

        {/* 7. Glass sheen overlay */}
        <circle cx={r} cy={r} r={lr - 0.5} fill={`url(#gs-${uid})`} />

        {/* 8. Primary specular — bright, top-left */}
        <ellipse cx={r - lr * 0.1} cy={r - lr * 0.18}
          rx={lr * 0.28} ry={lr * 0.16}
          fill="white" opacity={isLit ? 0.55 : 0.1} />

        {/* 9. Secondary specular — small, bottom-right */}
        <ellipse cx={r + lr * 0.22} cy={r + lr * 0.2}
          rx={lr * 0.09} ry={lr * 0.05}
          fill="white" opacity={isLit ? 0.18 : 0.04} />

        {/* 10. Tiny catchlight — pinpoint reflection */}
        <circle cx={r - lr * 0.2} cy={r - lr * 0.28} r={lr * 0.06}
          fill="white" opacity={isLit ? 0.7 : 0.08} />
      </svg>
    </div>
  );
};

// Aluminum signal pair housing with inner recess
const SignalPair = ({ appColor, ctColor, size = 'lg' }) => (
  <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl"
    style={{
      background: 'linear-gradient(180deg, #cdd5dd 0%, #aab4c0 30%, #8a98a8 70%, #788898 100%)',
      border: '1px solid rgba(190,200,210,0.5)',
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.5), inset 0 -1px 3px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.1), 0 0 0 0.5px rgba(0,0,0,0.04)',
    }}>
    <SignalLamp color={appColor} size={size} />
    <div className="w-0.5 h-5 rounded-full" style={{ background: 'rgba(255,255,255,0.25)' }}></div>
    <SignalLamp color={ctColor} size={size} />
  </div>
);

// ===================== FROSTED GLASS CARD =====================
// Three depth levels: elevated (hero), standard, recessed (legend)
const GlassCard = ({ children, className = '', depth = 'standard' }) => {
  const levels = {
    hero: {
      bg: 'linear-gradient(135deg, rgba(255,254,252,0.84) 0%, rgba(255,251,247,0.76) 50%, rgba(255,249,244,0.72) 100%)',
      border: 'rgba(255,255,255,0.7)',
      shadow: '0 12px 48px rgba(60,30,10,0.1), 0 2px 0 rgba(255,255,255,0.95) inset, 0 -1px 4px rgba(0,0,0,0.02) inset',
      blur: 'blur(24px) saturate(190%)',
    },
    standard: {
      bg: 'linear-gradient(145deg, rgba(255,253,250,0.68) 0%, rgba(255,250,245,0.58) 100%)',
      border: 'rgba(255,255,255,0.5)',
      shadow: '0 4px 24px rgba(60,30,10,0.06), 0 1px 0 rgba(255,255,255,0.85) inset',
      blur: 'blur(20px) saturate(175%)',
    },
    subtle: {
      bg: 'linear-gradient(145deg, rgba(255,252,248,0.52) 0%, rgba(255,249,243,0.44) 100%)',
      border: 'rgba(255,255,255,0.4)',
      shadow: '0 2px 16px rgba(60,30,10,0.04), 0 1px 0 rgba(255,255,255,0.7) inset',
      blur: 'blur(16px) saturate(160%)',
    },
  };
  const l = levels[depth] || levels.standard;
  return (
    <div className={className}
      style={{
        background: l.bg,
        backdropFilter: l.blur,
        WebkitBackdropFilter: l.blur,
        border: `1px solid ${l.border}`,
        boxShadow: l.shadow,
      }}>
      {children}
    </div>
  );
};

// ===================== STATION BADGE =====================
const StationBadge = ({ name }) => {
  const org = name.startsWith('DRK') ? 'DRK' : name.startsWith('BRK') ? 'BRK' : name.startsWith('ASB') ? 'ASB' : 'RD';
  const styles = {
    DRK: { bg: 'rgba(185,28,28,0.1)', border: 'rgba(185,28,28,0.25)', text: '#991b1b' },
    BRK: { bg: 'rgba(185,28,28,0.1)', border: 'rgba(185,28,28,0.25)', text: '#991b1b' },
    ASB: { bg: 'rgba(194,65,12,0.1)', border: 'rgba(194,65,12,0.3)', text: '#9a3412' },
    RD: { bg: 'rgba(29,78,216,0.1)', border: 'rgba(29,78,216,0.25)', text: '#1e40af' },
  };
  const c = styles[org];
  return (
    <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase"
      style={{ background: c.bg, border: `1px solid ${c.border}`, color: c.text }}>
      <span style={{ opacity: 0.5 }}>&#10010;</span>
      {org}
    </div>
  );
};

// ===================== STATION SELECT (tag-style dropdown) =====================
const StationSelect = ({ value, onChange, stations, onAddStation }) => {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setAddingNew(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = stations.filter(s => s.toLowerCase().includes(search.toLowerCase()));

  const select = (s) => { onChange(s); setOpen(false); setSearch(''); };
  const addNew = () => {
    if (!newName.trim()) return;
    onAddStation(newName.trim());
    onChange(newName.trim());
    setNewName(''); setAddingNew(false); setOpen(false); setSearch('');
  };

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-left text-sm transition-all"
        style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: value ? '#2a2018' : '#a09080' }}>
        <span className="flex items-center gap-2 min-w-0 truncate">
          {value ? <><StationBadge name={value} /><span className="truncate">{value}</span></> : 'Rettungswache w\u00e4hlen\u2026'}
        </span>
        <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#a09080', transform: open ? 'rotate(180deg)' : '' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-xl overflow-hidden"
          style={{ background: 'rgba(255,253,250,0.97)', border: '1px solid rgba(180,160,140,0.3)', boxShadow: '0 8px 32px rgba(60,30,10,0.12)', backdropFilter: 'blur(20px)' }}>
          <div className="p-2">
            <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Suchen\u2026" autoFocus
              className="w-full px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.2)', color: '#2a2018' }} />
          </div>
          <div className="max-h-40 overflow-y-auto">
            {filtered.map(s => (
              <button key={s} type="button" onClick={() => select(s)}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left transition-colors hover:bg-blue-50"
                style={{ color: '#2a2018', background: s === value ? 'rgba(29,78,216,0.06)' : undefined }}>
                <StationBadge name={s} />
                <span className="truncate">{s}</span>
              </button>
            ))}
            {filtered.length === 0 && !addingNew && (
              <div className="px-3 py-2 text-sm" style={{ color: '#a09080' }}>Keine Treffer</div>
            )}
          </div>
          <div style={{ borderTop: '1px solid rgba(180,160,140,0.15)' }}>
            {addingNew ? (
              <div className="p-2 flex gap-2">
                <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && addNew()}
                  placeholder="z.B. ASB Stuttgart" autoFocus
                  className="flex-1 px-3 py-2 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.2)', color: '#2a2018' }} />
                <button type="button" onClick={addNew}
                  className="px-3 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700">+</button>
              </div>
            ) : (
              <button type="button" onClick={() => setAddingNew(true)}
                className="w-full px-3 py-2.5 text-sm font-medium text-left transition-colors hover:bg-blue-50"
                style={{ color: '#1d4ed8' }}>
                + Neue Rettungswache
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

// ===================== SETTINGS PANEL =====================
const SettingsPanel = ({ settings, setSettings, onClose }) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
    style={{ background: 'rgba(40,20,10,0.2)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
    <GlassCard depth="hero" className="rounded-3xl w-full max-w-lg overflow-hidden">
      <div className="p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,160,140,0.18)' }}>
        <h2 className="text-xl font-bold" style={{ color: '#2a2018' }}>Einstellungen</h2>
        <button onClick={onClose} className="text-2xl leading-none transition-colors hover:opacity-70" style={{ color: '#a09080' }}>&times;</button>
      </div>
      <div className="p-6 space-y-6">
        <div>
          <label className="block font-semibold text-sm mb-3" style={{ color: '#3a2a1a' }}>Vorhersage-Schwellenwert</label>
          <div className="flex items-center gap-3">
            <input type="number" min="1" max="99" value={settings.cutoff}
              onChange={(e) => { const v = parseInt(e.target.value) || 65; setSettings({ ...settings, cutoff: Math.min(99, Math.max(1, v)) }); }}
              className="w-20 px-3 py-2 rounded-xl text-center font-bold focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} />
            <span style={{ color: '#8a7a6a' }}>%</span>
          </div>
        </div>
        <div>
          <label className="block font-semibold text-sm mb-3" style={{ color: '#3a2a1a' }}>Anzeige</label>
          <div className="space-y-3">
            {[['showTimestamp', 'Datum anzeigen'], ['showRettungswache', 'Rettungswache anzeigen']].map(([key, label]) => (
              <label key={key} className="flex items-center gap-3 cursor-pointer group">
                <input type="checkbox" checked={settings[key]}
                  onChange={(e) => setSettings({ ...settings, [key]: e.target.checked })}
                  className="w-5 h-5 rounded bg-white border-slate-300 text-blue-600 focus:ring-blue-500/50" />
                <span className="text-sm group-hover:opacity-100 transition-opacity" style={{ color: '#5a4a3a', opacity: 0.85 }}>{label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="pt-4" style={{ borderTop: '1px solid rgba(180,160,140,0.12)' }}>
          <button onClick={() => { if (confirm('Alle CT-Ergebnisse zur\u00fccksetzen?')) { setSettings({ ...settings, resetResults: true }); onClose(); } }}
            className="px-4 py-2 rounded-xl text-sm font-medium transition-colors"
            style={{ background: 'rgba(185,28,28,0.06)', border: '1px solid rgba(185,28,28,0.15)', color: '#b91c1c' }}>
            Alle Ergebnisse l&ouml;schen
          </button>
        </div>
      </div>
      <div className="p-5" style={{ borderTop: '1px solid rgba(180,160,140,0.12)' }}>
        <button onClick={onClose} className="w-full py-3 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-colors"
          style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>Speichern</button>
      </div>
    </GlassCard>
  </div>
);

// ===================== ANALYTICS HELPERS =====================
const computeConfusion = (cases, results, cutoff, type) => {
  // type = 'ich' or 'lvo', probField = 'ichProb' or 'lvoProb'
  const probField = type === 'ich' ? 'ichProb' : 'lvoProb';
  let tp = 0, fp = 0, fn = 0, tn = 0;
  cases.forEach(c => {
    const r = results[c.id]?.[type];
    if (!r || r === 'na') return;
    const pred = c[probField] >= cutoff ? 'positive' : 'negative';
    if (pred === 'positive' && r === 'confirmed') tp++;
    else if (pred === 'positive' && r === 'ruled_out') fp++;
    else if (pred === 'negative' && r === 'confirmed') fn++;
    else if (pred === 'negative' && r === 'ruled_out') tn++;
  });
  const n = tp + fp + fn + tn;
  const sens = (tp + fn) > 0 ? tp / (tp + fn) : null;
  const spec = (tn + fp) > 0 ? tn / (tn + fp) : null;
  const ppv = (tp + fp) > 0 ? tp / (tp + fp) : null;
  const npv = (tn + fn) > 0 ? tn / (tn + fn) : null;
  return { tp, fp, fn, tn, n, sens, spec, ppv, npv };
};

const computeCalibration = (cases, results, type) => {
  const probField = type === 'ich' ? 'ichProb' : 'lvoProb';
  const bins = [{ lo: 0, hi: 20 }, { lo: 20, hi: 40 }, { lo: 40, hi: 60 }, { lo: 60, hi: 80 }, { lo: 80, hi: 100 }];
  return bins.map(b => {
    let total = 0, events = 0;
    cases.forEach(c => {
      const r = results[c.id]?.[type];
      if (!r || r === 'na') return;
      const p = c[probField];
      if (p >= b.lo && p < (b.hi === 100 ? 101 : b.hi)) {
        total++;
        if (r === 'confirmed') events++;
      }
    });
    return { label: `${b.lo}-${b.hi}`, mid: (b.lo + b.hi) / 2, total, events, rate: total > 0 ? events / total * 100 : null };
  });
};

const findOptimalCutoff = (cases, results, type) => {
  const probField = type === 'ich' ? 'ichProb' : 'lvoProb';
  let bestJ = -1, bestCut = 50;
  for (let cut = 5; cut <= 95; cut += 5) {
    const { sens, spec } = computeConfusion(cases, results, cut, type);
    if (sens !== null && spec !== null) {
      const j = sens + spec - 1;
      if (j > bestJ) { bestJ = j; bestCut = cut; }
    }
  }
  return { cutoff: bestCut, youdenJ: bestJ };
};

const exportCSV = (cases, results, cutoff) => {
  const header = 'Fall-ID,Datum,Rettungswache,ICH_Prob,LVO_Prob,ICH_CT,LVO_CT,ICH_Korrekt,LVO_Korrekt';
  const rows = cases.map(c => {
    const r = results[c.id] || {};
    const ichCT = r.ich === 'confirmed' ? 'Ja' : r.ich === 'ruled_out' ? 'Nein' : r.ich === 'na' ? 'N/A' : '';
    const lvoCT = r.lvo === 'confirmed' ? 'Ja' : r.lvo === 'ruled_out' ? 'Nein' : r.lvo === 'na' ? 'N/A' : '';
    const ichOk = r.ich && r.ich !== 'na' ? (calculateMatch(c.ichProb, r.ich, cutoff).status === 'match' ? 'Ja' : 'Nein') : '';
    const lvoOk = r.lvo && r.lvo !== 'na' ? (calculateMatch(c.lvoProb, r.lvo, cutoff).status === 'match' ? 'Ja' : 'Nein') : '';
    return `${c.id},${c.timestamp},"${c.rettungswache}",${c.ichProb},${c.lvoProb},${ichCT},${lvoCT},${ichOk},${lvoOk}`;
  });
  const csv = [header, ...rows].join('\n');
  const blob = new Blob(['\ufeff' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `igfap-export-${todayDE().replace(/\./g, '-')}.csv`;
  a.click(); URL.revokeObjectURL(url);
};

// ===================== ANALYTICS PANEL (Research Portal) =====================
const AnalyticsPanel = ({ cases, results, cutoff }) => {
  const ichCM = computeConfusion(cases, results, cutoff, 'ich');
  const lvoCM = computeConfusion(cases, results, cutoff, 'lvo');
  const ichCal = computeCalibration(cases, results, 'ich');
  const lvoCal = computeCalibration(cases, results, 'lvo');
  const ichOpt = findOptimalCutoff(cases, results, 'ich');
  const lvoOpt = findOptimalCutoff(cases, results, 'lvo');

  const pct = (v) => v !== null ? `${Math.round(v * 100)}%` : '\u2014';

  const ConfusionMatrix = ({ cm, label }) => (
    <div>
      <div className="text-sm font-bold mb-2" style={{ color: '#2a2018' }}>{label}</div>
      {cm.n === 0 ? (
        <div className="text-xs" style={{ color: '#a09080' }}>Noch keine Daten</div>
      ) : (
        <div>
          <div className="grid grid-cols-3 gap-0.5 text-center text-[10px] font-bold mb-0.5">
            <div></div>
            <div style={{ color: '#047857' }}>CT+</div>
            <div style={{ color: '#b91c1c' }}>CT\u2212</div>
          </div>
          <div className="grid grid-cols-3 gap-0.5 text-center">
            <div className="text-[10px] font-bold flex items-center justify-end pr-1" style={{ color: '#1d4ed8' }}>App+</div>
            <div className="py-1.5 rounded text-sm font-bold" style={{ background: 'rgba(5,150,105,0.12)', color: '#047857' }}>{cm.tp}</div>
            <div className="py-1.5 rounded text-sm font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>{cm.fp}</div>
            <div className="text-[10px] font-bold flex items-center justify-end pr-1" style={{ color: '#6b7280' }}>App\u2212</div>
            <div className="py-1.5 rounded text-sm font-bold" style={{ background: 'rgba(220,38,38,0.08)', color: '#b91c1c' }}>{cm.fn}</div>
            <div className="py-1.5 rounded text-sm font-bold" style={{ background: 'rgba(5,150,105,0.12)', color: '#047857' }}>{cm.tn}</div>
          </div>
          <div className="grid grid-cols-2 gap-2 mt-3">
            {[['Sens', cm.sens], ['Spez', cm.spec], ['PPV', cm.ppv], ['NPV', cm.npv]].map(([k, v]) => (
              <div key={k} className="text-center py-1 rounded" style={{ background: 'rgba(0,0,0,0.03)' }}>
                <div className="text-[10px] font-bold uppercase" style={{ color: '#8a7a6a' }}>{k}</div>
                <div className="text-sm font-bold" style={{ color: '#2a2018' }}>{pct(v)}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const CalibrationPlot = ({ data, label }) => {
    const w = 160, h = 100;
    const hasData = data.some(d => d.rate !== null);
    return (
      <div>
        <div className="text-xs font-bold mb-1" style={{ color: '#5a4a3a' }}>{label} Kalibrierung</div>
        {!hasData ? <div className="text-[10px]" style={{ color: '#a09080' }}>Noch keine Daten</div> : (
          <svg width={w} height={h + 20} viewBox={`0 0 ${w} ${h + 20}`}>
            {/* Diagonal reference */}
            <line x1="20" y1={h} x2={w - 5} y2="0" stroke="#c0b8b0" strokeWidth="0.5" strokeDasharray="3,3" />
            {/* Bars showing observed rate */}
            {data.map((d, i) => {
              if (d.rate === null) return null;
              const x = 20 + i * 28;
              const barH = Math.max(1, (d.rate / 100) * h);
              return (
                <g key={i}>
                  <rect x={x} y={h - barH} width={20} height={barH} rx={2} fill="#2563eb" opacity={0.6} />
                  <text x={x + 10} y={h + 12} textAnchor="middle" fontSize="7" fill="#8a7a6a">{d.label}</text>
                  {d.total > 0 && <text x={x + 10} y={h - barH - 3} textAnchor="middle" fontSize="7" fill="#2563eb" fontWeight="bold">{Math.round(d.rate)}%</text>}
                </g>
              );
            })}
            {/* Y-axis labels */}
            <text x="16" y="5" textAnchor="end" fontSize="7" fill="#a09080">100</text>
            <text x="16" y={h / 2 + 3} textAnchor="end" fontSize="7" fill="#a09080">50</text>
            <text x="16" y={h + 3} textAnchor="end" fontSize="7" fill="#a09080">0</text>
          </svg>
        )}
      </div>
    );
  };

  return (
    <GlassCard className="mt-6 rounded-2xl overflow-hidden">
      <div className="p-3 sm:p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,160,140,0.15)' }}>
        <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2" style={{ color: '#2a2018' }}>
          <svg className="w-5 h-5" style={{ color: '#1e3a8a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          Analytik
        </h2>
        <button onClick={() => exportCSV(cases, results, cutoff)}
          className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
          style={{ background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.2)', color: '#047857' }}>
          CSV Export
        </button>
      </div>
      <div className="p-3 sm:p-5">
        {/* Confusion Matrices side by side */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
          <ConfusionMatrix cm={ichCM} label="ICH" />
          <ConfusionMatrix cm={lvoCM} label="LVO" />
        </div>

        {/* Calibration plots */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6" style={{ borderTop: '1px solid rgba(180,160,140,0.1)', paddingTop: '16px' }}>
          <CalibrationPlot data={ichCal} label="ICH" />
          <CalibrationPlot data={lvoCal} label="LVO" />
        </div>

        {/* Optimal cutoff suggestions */}
        {(ichCM.n >= 5 || lvoCM.n >= 5) && (
          <div style={{ borderTop: '1px solid rgba(180,160,140,0.1)', paddingTop: '12px' }}>
            <div className="text-xs font-bold uppercase mb-2" style={{ color: '#8a7a6a', letterSpacing: '0.1em' }}>Optimaler Schwellenwert (Youden-J)</div>
            <div className="flex gap-4">
              {ichCM.n >= 5 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}>
                  <span className="text-xs font-bold" style={{ color: '#5a4a3a' }}>ICH:</span>
                  <span className="text-sm font-bold" style={{ color: '#1d4ed8' }}>{ichOpt.cutoff}%</span>
                  <span className="text-[10px]" style={{ color: '#8a7a6a' }}>J={ichOpt.youdenJ.toFixed(2)}</span>
                </div>
              )}
              {lvoCM.n >= 5 && (
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}>
                  <span className="text-xs font-bold" style={{ color: '#5a4a3a' }}>LVO:</span>
                  <span className="text-sm font-bold" style={{ color: '#1d4ed8' }}>{lvoOpt.cutoff}%</span>
                  <span className="text-[10px]" style={{ color: '#8a7a6a' }}>J={lvoOpt.youdenJ.toFixed(2)}</span>
                </div>
              )}
            </div>
            {cutoff !== ichOpt.cutoff && ichCM.n >= 5 && (
              <div className="text-[10px] mt-2" style={{ color: '#8a7a6a' }}>
                Aktuell: {cutoff}% &middot; Daten deuten auf {ichOpt.cutoff}% als optimalen ICH-Schwellenwert
              </div>
            )}
          </div>
        )}
      </div>
    </GlassCard>
  );
};

// ===================== RESEARCH PORTAL =====================
const ResearchPortal = ({ cases, setCases, results, setResults, selectedCase, setSelectedCase, settings, setSettings, stations, onAddStation, onLogout }) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showAddCase, setShowAddCase] = useState(false);
  const [editingCaseId, setEditingCaseId] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [editingField, setEditingField] = useState(null); // 'timestamp' | 'rettungswache'
  const [editFieldValue, setEditFieldValue] = useState('');
  const lastStation = cases.length > 0 ? cases[cases.length - 1].rettungswache : '';
  const [newCase, setNewCase] = useState({ id: '', ichProb: '', lvoProb: '', rettungswache: lastStation });
  const selectedCaseData = cases.find(c => c.id === selectedCase);
  const cutoff = settings.cutoff;

  const handleResultChange = (caseId, type, value) => setResults(prev => {
    const cur = prev[caseId]?.[type];
    // Toggle off if clicking the same value (use null, not undefined — Firestore compat)
    if (cur === value) {
      const updated = { ...prev[caseId] };
      delete updated[type];
      return { ...prev, [caseId]: updated };
    }
    return { ...prev, [caseId]: { ...prev[caseId], [type]: value } };
  });
  const clearResult = (caseId) => setResults(prev => { const n = { ...prev }; delete n[caseId]; return n; });
  const handleAddCase = () => {
    if (!newCase.id.trim()) return;
    const ts = todayDE();
    const rw = newCase.rettungswache || 'Unbekannt';
    setCases(prev => [...prev, { id: newCase.id.trim().toUpperCase(), timestamp: ts, rettungswache: rw, ichProb: parseInt(newCase.ichProb) || 0, lvoProb: parseInt(newCase.lvoProb) || 0 }]);
    // Remember station for next case, reset rest
    setNewCase({ id: generateCaseId(rw, [...cases, { id: newCase.id.trim().toUpperCase() }]), ichProb: '', lvoProb: '', rettungswache: rw });
    setShowAddCase(false);
  };
  // Auto-generate ID when station changes in the new case form
  const handleNewCaseStation = (s) => {
    const autoId = generateCaseId(s, cases);
    setNewCase(prev => ({ ...prev, rettungswache: s, id: autoId }));
  };
  const handleEditCaseId = (oldId, newId) => {
    if (!newId.trim() || oldId === newId.trim().toUpperCase()) { setEditingCaseId(null); return; }
    const fid = newId.trim().toUpperCase();
    setCases(prev => prev.map(c => c.id === oldId ? { ...c, id: fid } : c));
    if (results[oldId]) { setResults(prev => { const n = { ...prev }; n[fid] = n[oldId]; delete n[oldId]; return n; }); }
    if (selectedCase === oldId) setSelectedCase(fid); setEditingCaseId(null);
  };
  const handleDeleteCase = (caseId) => {
    if (!confirm(`Fall ${caseId} l\u00f6schen?`)) return;
    setCases(prev => prev.filter(c => c.id !== caseId));
    setResults(prev => { const n = { ...prev }; delete n[caseId]; return n; });
    if (selectedCase === caseId) setSelectedCase(null);
  };
  const handleUpdateProbs = (caseId, field, value) => setCases(prev => prev.map(c => c.id === caseId ? { ...c, [field]: parseInt(value) || 0 } : c));
  const handleUpdateField = (caseId, field, value) => {
    setCases(prev => prev.map(c => c.id === caseId ? { ...c, [field]: value } : c));
    setEditingField(null);
  };
  const startEditField = (field, value) => { setEditingField(field); setEditFieldValue(value); };

  const stats = cases.reduce((acc, c) => {
    const r = results[c.id] || {};
    if (r.ich && r.ich !== 'na') { acc.total++; if (calculateMatch(c.ichProb, r.ich, cutoff).status === 'match') acc.correct++; }
    if (r.lvo && r.lvo !== 'na') { acc.total++; if (calculateMatch(c.lvoProb, r.lvo, cutoff).status === 'match') acc.correct++; }
    return acc;
  }, { total: 0, correct: 0 });

  return (
    <div className="min-h-screen relative">
      <BokehBackground />

      {showSettings && <SettingsPanel settings={settings} setSettings={(ns) => { if (ns.resetResults) { setResults({}); setSettings({ ...settings, resetResults: false }); } else setSettings(ns); }} onClose={() => setShowSettings(false)} />}

      {showAddCase && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
          style={{ background: 'rgba(40,20,10,0.2)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
          <GlassCard depth="hero" className="rounded-3xl w-full max-w-md overflow-hidden">
            <div className="p-5" style={{ borderBottom: '1px solid rgba(180,160,140,0.18)' }}>
              <h2 className="text-xl font-bold" style={{ color: '#2a2018' }}>Neuer Fall</h2>
            </div>
            <div className="p-6 space-y-5">
              <div><label className="block text-sm font-medium mb-2" style={{ color: '#5a4a3a' }}>Fall-ID *</label>
                <input type="text" value={newCase.id} onChange={(e) => setNewCase({ ...newCase, id: e.target.value })} placeholder="z.B. DRKLB018"
                  className="w-full px-4 py-3 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} /></div>
              <div><label className="block text-sm font-medium mb-2" style={{ color: '#5a4a3a' }}>Rettungswache</label>
                <StationSelect value={newCase.rettungswache}
                  onChange={handleNewCaseStation}
                  stations={stations} onAddStation={onAddStation} /></div>
              <div><label className="block text-sm font-medium mb-2" style={{ color: '#5a4a3a' }}>ICH-Wahrscheinlichkeit (%)</label>
                <input type="number" min="0" max="100" value={newCase.ichProb} onChange={(e) => setNewCase({ ...newCase, ichProb: parseInt(e.target.value) || 0 })}
                  className="w-24 px-3 py-2.5 rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} /></div>
              <div><label className="block text-sm font-medium mb-2" style={{ color: '#5a4a3a' }}>LVO-Wahrscheinlichkeit (%)</label>
                <input type="number" min="0" max="100" value={newCase.lvoProb} onChange={(e) => setNewCase({ ...newCase, lvoProb: parseInt(e.target.value) || 0 })}
                  className="w-24 px-3 py-2.5 rounded-xl text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} /></div>
            </div>
            <div className="p-5 flex gap-3" style={{ borderTop: '1px solid rgba(180,160,140,0.12)' }}>
              <button onClick={() => setShowAddCase(false)} className="flex-1 py-3 rounded-xl font-medium transition-colors"
                style={{ background: 'rgba(255,252,248,0.6)', border: '1px solid rgba(180,160,140,0.25)', color: '#6a5a4a' }}>Abbrechen</button>
              <button onClick={handleAddCase} disabled={!newCase.id.trim()} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 disabled:opacity-50"
                style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>Hinzuf&uuml;gen</button>
            </div>
          </GlassCard>
        </div>
      )}

      <div className="relative z-10 p-3 sm:p-6 pt-6 sm:pt-8 max-w-7xl mx-auto">
        {/* Header — responsive: stacks on small screens */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
              style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)', boxShadow: '0 4px 16px rgba(29,78,216,0.35)' }}>
              <StarOfLife size={22} color="white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg sm:text-2xl font-bold text-white truncate" style={{ textShadow: '0 1px 8px rgba(0,0,0,0.4), 0 4px 24px rgba(0,0,0,0.15)', letterSpacing: '-0.01em' }}>iGFAP Research</h1>
              <p className="text-xs sm:text-sm font-medium" style={{ color: 'rgba(255,255,255,0.85)', textShadow: '0 1px 6px rgba(0,0,0,0.3)', letterSpacing: '0.01em' }}>CT-Befund Eingabesystem</p>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <GlassCard depth="subtle" className="px-3 py-1.5 rounded-full text-sm font-bold" style={{ color: '#1e3a8a' }}>{cutoff}%</GlassCard>
            <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl transition-all hover:scale-105"
              style={{ background: 'rgba(255,251,247,0.5)', backdropFilter: 'blur(16px)', border: '1px solid rgba(255,255,255,0.4)' }}>
              <svg className="w-5 h-5" style={{ color: '#5a4a3a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            <button onClick={onLogout} className="px-3 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all hover:scale-105 whitespace-nowrap"
              style={{ background: 'rgba(255,251,247,0.5)', backdropFilter: 'blur(16px)', color: '#5a4a3a', border: '1px solid rgba(255,255,255,0.4)' }}>
              Abmelden
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
          <GlassCard className="xl:col-span-3 rounded-2xl overflow-hidden">
            <div className="p-3 sm:p-5 flex items-center justify-between gap-3" style={{ borderBottom: '1px solid rgba(180,160,140,0.15)' }}>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-semibold" style={{ color: '#2a2018', letterSpacing: '-0.01em' }}>F&auml;lle</h2>
                <p className="text-xs sm:text-sm" style={{ color: '#8a7a6a' }}>{cases.filter(c => !results[c.id]?.ich || !results[c.id]?.lvo).length} ausstehend</p>
              </div>
              <button onClick={() => {
                const rw = lastStation;
                const autoId = rw ? generateCaseId(rw, cases) : '';
                setNewCase({ id: autoId, ichProb: '', lvoProb: '', rettungswache: rw });
                setShowAddCase(true);
              }} className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 text-xs sm:text-sm font-semibold whitespace-nowrap flex-shrink-0"
                style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>+ Neuer Fall</button>
            </div>
            <div className="max-h-[600px] overflow-y-auto">
              {cases.map((c, i) => {
                const r = results[c.id] || {};
                const ichMatch = calculateMatch(c.ichProb, r.ich || null, cutoff);
                const lvoMatch = calculateMatch(c.lvoProb, r.lvo || null, cutoff);
                const isSelected = selectedCase === c.id;
                const isEditing = editingCaseId === c.id;
                return (
                  <div key={c.id} onClick={() => !isEditing && setSelectedCase(c.id)}
                    className="p-3 sm:p-4 cursor-pointer transition-all"
                    style={{
                      borderTop: i > 0 ? '1px solid rgba(180,160,140,0.1)' : undefined,
                      borderLeft: isSelected ? '3px solid #1d4ed8' : '3px solid transparent',
                      background: isSelected ? 'rgba(29,78,216,0.05)' : undefined,
                    }}>
                    {/* Top row: case ID + status + delete */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        {isEditing ? (
                          <input type="text" value={editValue} onChange={(e) => setEditValue(e.target.value)} onBlur={() => handleEditCaseId(c.id, editValue)} onKeyDown={(e) => e.key === 'Enter' && handleEditCaseId(c.id, editValue)} onClick={(e) => e.stopPropagation()} autoFocus
                            className="font-mono font-bold rounded px-2 py-1 w-32 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            style={{ color: '#2a2018', background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(29,78,216,0.4)' }} />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm sm:text-base truncate" style={{ color: '#2a2018', letterSpacing: '0.02em' }}>{c.id}</span>
                            <button onClick={(e) => { e.stopPropagation(); setEditingCaseId(c.id); setEditValue(c.id); }} className="p-1 rounded opacity-30 hover:opacity-70 transition-opacity flex-shrink-0">
                              <svg className="w-3.5 h-3.5" style={{ color: '#8a7a6a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                            </button>
                          </div>
                        )}
                        <div className="text-[10px] sm:text-xs mt-0.5" style={{ color: '#a09080' }}>{formatDateDE(c.timestamp)}</div>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <div className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                          style={r.ich && r.lvo
                            ? { background: 'rgba(5,150,105,0.1)', color: '#047857', border: '1px solid rgba(5,150,105,0.2)' }
                            : { background: 'rgba(0,0,0,0.03)', color: '#a09080', border: '1px solid rgba(180,160,140,0.12)' }}>
                          {r.ich && r.lvo ? 'Fertig' : 'Offen'}
                        </div>
                        <button onClick={(e) => { e.stopPropagation(); handleDeleteCase(c.id); }} className="p-1 rounded opacity-25 hover:opacity-70 transition-opacity">
                          <svg className="w-4 h-4" style={{ color: '#8a7a6a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                      </div>
                    </div>
                    {/* Bottom row: ICH + LVO indicators */}
                    <div className="flex items-center gap-3 sm:gap-5 mt-2">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[10px] sm:text-xs font-medium" style={{ color: '#a09080' }}>ICH</span>
                        <div className={`w-10 sm:w-12 h-5 sm:h-6 rounded-md bg-gradient-to-r ${getConfidenceColor(c.ichProb, cutoff).bg} flex items-center justify-center`}>
                          <span className="text-white font-bold text-[9px] sm:text-[10px]">{c.ichProb}%</span>
                        </div>
                        <SignalLamp color={ichMatch.status === 'match' ? 'green' : ichMatch.status === 'mismatch' ? 'red' : 'off'} size="sm" />
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-[10px] sm:text-xs font-medium" style={{ color: '#a09080' }}>LVO</span>
                        <div className={`w-10 sm:w-12 h-5 sm:h-6 rounded-md bg-gradient-to-r ${getConfidenceColor(c.lvoProb, cutoff).bg} flex items-center justify-center`}>
                          <span className="text-white font-bold text-[9px] sm:text-[10px]">{c.lvoProb}%</span>
                        </div>
                        <SignalLamp color={lvoMatch.status === 'mismatch' ? 'red' : (lvoMatch.status === 'match' || lvoMatch.status === 'na') ? 'green' : 'off'} size="sm" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          <GlassCard className="rounded-2xl p-5 h-fit sticky top-8">
            <h2 className="text-lg font-semibold mb-4" style={{ color: '#2a2018' }}>CT-Befund</h2>
            {selectedCaseData ? (
              <div className="space-y-5">
                <div className="p-4 rounded-xl" style={{ background: 'rgba(29,78,216,0.06)', border: '1px solid rgba(29,78,216,0.12)' }}>
                  <div className="font-mono text-xl font-bold" style={{ color: '#2a2018', letterSpacing: '0.02em' }}>{selectedCaseData.id}</div>

                  {/* Editable date */}
                  <div className="flex items-center gap-1.5 mt-1.5">
                    {editingField === 'timestamp' ? (
                      <input type="text" value={editFieldValue}
                        onChange={(e) => setEditFieldValue(e.target.value)}
                        onBlur={() => handleUpdateField(selectedCaseData.id, 'timestamp', editFieldValue)}
                        onKeyDown={(e) => e.key === 'Enter' && handleUpdateField(selectedCaseData.id, 'timestamp', editFieldValue)}
                        autoFocus placeholder="DD.MM.YYYY"
                        className="text-sm font-mono rounded px-2 py-1 w-full focus:outline-none focus:ring-2 focus:ring-blue-500"
                        style={{ color: '#2a2018', background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(29,78,216,0.4)' }} />
                    ) : (
                      <>
                        <span className="text-sm" style={{ color: '#8a7a6a' }}>{formatDateDE(selectedCaseData.timestamp)}</span>
                        <button onClick={() => startEditField('timestamp', formatDateDE(selectedCaseData.timestamp))} className="p-0.5 rounded opacity-30 hover:opacity-70 transition-opacity">
                          <svg className="w-3 h-3" style={{ color: '#8a7a6a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </>
                    )}
                  </div>

                  {/* Editable Rettungswache */}
                  <div className="mt-2">
                    {editingField === 'rettungswache' ? (
                      <StationSelect value={editFieldValue}
                        onChange={(s) => { handleUpdateField(selectedCaseData.id, 'rettungswache', s); }}
                        stations={stations} onAddStation={onAddStation} />
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <StationBadge name={selectedCaseData.rettungswache} />
                        <button onClick={() => startEditField('rettungswache', selectedCaseData.rettungswache)} className="p-0.5 rounded opacity-30 hover:opacity-70 transition-opacity">
                          <svg className="w-3 h-3" style={{ color: '#8a7a6a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
                {/* ICH Section */}
                <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(180,160,140,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: '#3a2a1a', letterSpacing: '0.04em' }}>ICH</span>
                    <span className="text-xs" style={{ color: '#a09080' }}>App-Wahrscheinlichkeit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100" value={selectedCaseData.ichProb}
                      onChange={(e) => handleUpdateProbs(selectedCaseData.id, 'ichProb', e.target.value)}
                      className="w-20 px-3 py-2 rounded-lg text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} />
                    <span className="text-sm font-medium" style={{ color: '#8a7a6a' }}>%</span>
                  </div>
                  <div className="text-xs font-medium mt-1" style={{ color: '#8a7a6a' }}>CT-Ergebnis:</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'ich', 'confirmed')}
                      className="py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer"
                      style={results[selectedCaseData.id]?.ich === 'confirmed'
                        ? { background: '#059669', color: 'white', boxShadow: '0 4px 16px rgba(5,150,105,0.3)', border: '1px solid rgba(5,150,105,0.5)' }
                        : { background: 'rgba(255,252,248,0.6)', color: '#5a4a3a', border: '1px solid rgba(180,160,140,0.2)' }}>
                      Ja</button>
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'ich', 'ruled_out')}
                      className="py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer"
                      style={results[selectedCaseData.id]?.ich === 'ruled_out'
                        ? { background: '#dc2626', color: 'white', boxShadow: '0 4px 16px rgba(220,38,38,0.3)', border: '1px solid rgba(220,38,38,0.5)' }
                        : { background: 'rgba(255,252,248,0.6)', color: '#5a4a3a', border: '1px solid rgba(180,160,140,0.2)' }}>
                      Nein</button>
                  </div>
                </div>

                {/* LVO Section */}
                <div className="space-y-3 p-4 rounded-xl" style={{ background: 'rgba(0,0,0,0.02)', border: '1px solid rgba(180,160,140,0.1)' }}>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold" style={{ color: '#3a2a1a', letterSpacing: '0.04em' }}>LVO</span>
                    <span className="text-xs" style={{ color: '#a09080' }}>App-Wahrscheinlichkeit</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="number" min="0" max="100" value={selectedCaseData.lvoProb}
                      onChange={(e) => handleUpdateProbs(selectedCaseData.id, 'lvoProb', e.target.value)}
                      className="w-20 px-3 py-2 rounded-lg text-center font-bold font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                      style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} />
                    <span className="text-sm font-medium" style={{ color: '#8a7a6a' }}>%</span>
                  </div>
                  <div className="text-xs font-medium mt-1" style={{ color: '#8a7a6a' }}>CT-Ergebnis:</div>
                  <div className="grid grid-cols-3 gap-2">
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'lvo', 'confirmed')}
                      className="py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer"
                      style={results[selectedCaseData.id]?.lvo === 'confirmed'
                        ? { background: '#059669', color: 'white', boxShadow: '0 4px 16px rgba(5,150,105,0.3)', border: '1px solid rgba(5,150,105,0.5)' }
                        : { background: 'rgba(255,252,248,0.6)', color: '#5a4a3a', border: '1px solid rgba(180,160,140,0.2)' }}>
                      Ja</button>
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'lvo', 'ruled_out')}
                      className="py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer"
                      style={results[selectedCaseData.id]?.lvo === 'ruled_out'
                        ? { background: '#dc2626', color: 'white', boxShadow: '0 4px 16px rgba(220,38,38,0.3)', border: '1px solid rgba(220,38,38,0.5)' }
                        : { background: 'rgba(255,252,248,0.6)', color: '#5a4a3a', border: '1px solid rgba(180,160,140,0.2)' }}>
                      Nein</button>
                    <button type="button" onClick={() => handleResultChange(selectedCaseData.id, 'lvo', 'na')}
                      className="py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer"
                      style={results[selectedCaseData.id]?.lvo === 'na'
                        ? { background: '#6b7280', color: 'white', boxShadow: '0 4px 16px rgba(107,114,128,0.3)', border: '1px solid rgba(107,114,128,0.5)' }
                        : { background: 'rgba(255,252,248,0.6)', color: '#5a4a3a', border: '1px solid rgba(180,160,140,0.2)' }}>
                      N/A</button>
                  </div>
                </div>

                {(results[selectedCaseData.id]?.ich || results[selectedCaseData.id]?.lvo) && (
                  <button type="button" onClick={() => clearResult(selectedCaseData.id)} className="w-full py-2 text-sm transition-colors hover:opacity-70" style={{ color: '#b0a090' }}>Zur&uuml;cksetzen</button>
                )}
                <div className="pt-4 text-center" style={{ borderTop: '1px solid rgba(180,160,140,0.1)' }}>
                  <div className="text-3xl font-bold" style={{ color: '#2a2018' }}>{stats.total > 0 ? `${Math.round(stats.correct / stats.total * 100)}%` : '\u2014'}</div>
                  <div className="text-sm font-medium" style={{ color: '#8a7a6a' }}>Genauigkeit</div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center py-12" style={{ color: '#c0b8b0' }}>
                <StarOfLife size={40} color="#c0b8b0" />
                <p className="mt-4 font-medium">Fall ausw&auml;hlen</p>
              </div>
            )}
          </GlassCard>
        </div>

        {/* Station Leaderboard — competitiveness */}
        {(() => {
          const stationStats = {};
          cases.forEach(c => {
            const s = c.rettungswache;
            if (!stationStats[s]) stationStats[s] = { name: s, total: 0, evaluated: 0, correct: 0 };
            stationStats[s].total++;
            const r = results[c.id] || {};
            const ichDone = r.ich && r.ich !== 'na';
            const lvoDone = r.lvo && r.lvo !== 'na';
            const lvoNA = r.lvo === 'na';
            if (ichDone && (lvoDone || lvoNA)) {
              stationStats[s].evaluated++;
              const ichM = calculateMatch(c.ichProb, r.ich, cutoff);
              const lvoM = lvoDone ? calculateMatch(c.lvoProb, r.lvo, cutoff) : { status: 'na' };
              if ((ichM.status === 'match') && (lvoM.status === 'match' || lvoM.status === 'na')) stationStats[s].correct++;
            }
          });
          const ranked = Object.values(stationStats).sort((a, b) => b.total - a.total);
          const maxCount = ranked.length > 0 ? ranked[0].total : 1;

          return ranked.length > 0 && (
            <GlassCard className="mt-6 rounded-2xl overflow-hidden">
              <div className="p-3 sm:p-5" style={{ borderBottom: '1px solid rgba(180,160,140,0.15)' }}>
                <h2 className="text-base sm:text-lg font-semibold flex items-center gap-2" style={{ color: '#2a2018' }}>
                  <svg className="w-5 h-5" style={{ color: '#1e3a8a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                  Rettungswachen-Ranking
                </h2>
              </div>
              <div className="p-3 sm:p-5 space-y-3">
                {ranked.map((s, i) => {
                  const acc = s.evaluated > 0 ? Math.round(s.correct / s.evaluated * 100) : null;
                  const barWidth = Math.max(8, Math.round((s.total / maxCount) * 100));
                  return (
                    <div key={s.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg font-bold" style={{ color: i === 0 ? '#1d4ed8' : '#5a4a3a', minWidth: '1.5rem' }}>{i + 1}</span>
                          <StationBadge name={s.name} />
                          <span className="text-sm font-medium truncate" style={{ color: '#3a2a1a' }}>{s.name}</span>
                        </div>
                        <div className="flex items-center gap-3 flex-shrink-0">
                          {acc !== null && (
                            <span className="text-xs font-bold px-2 py-0.5 rounded-full"
                              style={{ background: 'rgba(5,150,105,0.1)', color: '#047857', border: '1px solid rgba(5,150,105,0.2)' }}>
                              {acc}%
                            </span>
                          )}
                          <FlipCounter value={s.total} />
                        </div>
                      </div>
                      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(180,160,140,0.1)' }}>
                        <div className="h-full rounded-full transition-all" style={{
                          width: `${barWidth}%`,
                          background: i === 0 ? 'linear-gradient(90deg, #1e3a8a, #2563eb)' : 'linear-gradient(90deg, #8a98a8, #aab4c0)',
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          );
        })()}

        {/* Analytics Panel — confusion matrix, calibration, export */}
        <AnalyticsPanel cases={cases} results={results} cutoff={cutoff} />
      </div>
    </div>
  );
};

// ===================== SCOREBOARD =====================
const RettungsdienstScoreboard = ({ cases, results, settings, stations }) => {
  const cutoff = settings.cutoff;

  const getCaseStatus = (c) => {
    const r = results[c.id] || {};
    const ichMatch = calculateMatch(c.ichProb, r.ich || null, cutoff);
    const lvoMatch = calculateMatch(c.lvoProb, r.lvo || null, cutoff);
    if (ichMatch.status === 'pending' || lvoMatch.status === 'pending') return 'pending';
    if (ichMatch.status === 'mismatch' || lvoMatch.status === 'mismatch') return 'mismatch';
    return 'match';
  };

  const stats = cases.reduce((acc, c) => {
    const r = results[c.id] || {};
    const ichDone = r.ich && r.ich !== 'na';
    const lvoDone = r.lvo && r.lvo !== 'na';
    const lvoNA = r.lvo === 'na';
    // Case counts if ICH is done AND LVO is either done or N/A
    if (ichDone && (lvoDone || lvoNA)) {
      acc.totalCases++;
      const ichM = calculateMatch(c.ichProb, r.ich, cutoff);
      const lvoM = lvoDone ? calculateMatch(c.lvoProb, r.lvo, cutoff) : { status: 'na' };
      const ichOk = ichM.status === 'match';
      const lvoOk = lvoM.status === 'match' || lvoM.status === 'na';
      if (ichOk && lvoOk) acc.correctCases++;
    }
    return acc;
  }, { totalCases: 0, correctCases: 0 });

  const accuracy = stats.totalCases > 0 ? Math.round(stats.correctCases / stats.totalCases * 100) : 0;

  return (
    <div className="min-h-screen relative overflow-hidden">
      <BokehBackground />

      <div className="max-w-xl mx-auto relative z-10 p-4 sm:p-6 pt-8 pb-12">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{
              background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)',
              boxShadow: '0 6px 24px rgba(29,78,216,0.4)',
              border: '2px solid rgba(255,255,255,0.25)',
            }}>
            <StarOfLife size={38} color="#ffffff" />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white"
              style={{ textShadow: '0 2px 12px rgba(0,0,0,0.45), 0 4px 30px rgba(0,0,0,0.15)', letterSpacing: '-0.025em' }}>
              iGFAP Scoreboard
            </h1>
            <p className="text-sm font-medium"
              style={{ color: 'rgba(255,255,255,0.9)', textShadow: '0 1px 8px rgba(0,0,0,0.35)', letterSpacing: '0.03em' }}>
              Vorhersage-Feedback &middot; Rettungsdienst
            </p>
          </div>
        </div>

        {/* Hero + Leaderboard — combined card, gamified */}
        <GlassCard depth="hero" className="rounded-3xl overflow-hidden mb-6">
          {/* Compact accuracy strip */}
          <div className="px-5 sm:px-6 pt-5 sm:pt-6 pb-4 flex items-center gap-5 sm:gap-6 relative">
            <div className="relative">
              <div className="text-5xl sm:text-6xl font-black"
                style={{
                  background: 'linear-gradient(140deg, #1e3a8a 0%, #1d4ed8 35%, #2563eb 60%, #3b82f6 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  letterSpacing: '-0.04em',
                  lineHeight: 1,
                  filter: 'drop-shadow(0 1px 3px rgba(30,58,138,0.1))',
                }}>
                {accuracy}<span className="text-3xl sm:text-4xl">%</span>
              </div>
              <div className="text-[10px] mt-1 uppercase font-bold" style={{ color: '#8a7a6a', letterSpacing: '0.1em' }}>Genauigkeit</div>
            </div>
            <div className="flex gap-5 sm:gap-6">
              {[
                { n: stats.correctCases, label: 'Korrekt', color: '#047857' },
                { n: stats.totalCases, label: 'Gepr\u00fcft', color: '#5a4a3a' },
                { n: cases.length, label: 'Gesamt', color: '#1e40af' },
              ].map(({ n, label, color }) => (
                <div key={label} className="text-center">
                  <div className="text-xl sm:text-2xl font-bold" style={{ color, letterSpacing: '-0.02em' }}>{n}</div>
                  <div className="text-[9px] mt-0.5 uppercase font-bold" style={{ color: '#a09080', letterSpacing: '0.1em' }}>{label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Station leaderboard — the competitive heart */}
          {(() => {
            const stMap = {};
            cases.forEach(c => {
              if (!stMap[c.rettungswache]) stMap[c.rettungswache] = { name: c.rettungswache, count: 0, streak: 0, streakBroken: false };
              stMap[c.rettungswache].count++;
            });
            // Compute streaks: consecutive correct from most recent, per station
            const stationCases = {};
            cases.forEach(c => {
              if (!stationCases[c.rettungswache]) stationCases[c.rettungswache] = [];
              stationCases[c.rettungswache].push(c);
            });
            Object.entries(stationCases).forEach(([name, sCases]) => {
              let streak = 0;
              // Walk backwards from newest
              for (let j = sCases.length - 1; j >= 0; j--) {
                const c = sCases[j];
                const r = results[c.id] || {};
                const ichDone = r.ich && r.ich !== 'na';
                const lvoDone = r.lvo && r.lvo !== 'na';
                const lvoNA = r.lvo === 'na';
                if (!ichDone || (!lvoDone && !lvoNA)) break; // not evaluated yet
                const ichOk = calculateMatch(c.ichProb, r.ich, cutoff).status === 'match';
                const lvoOk = lvoDone ? calculateMatch(c.lvoProb, r.lvo, cutoff).status === 'match' : true;
                if (ichOk && lvoOk) streak++;
                else break;
              }
              if (stMap[name]) stMap[name].streak = streak;
            });
            // Badges: milestones
            const badgeThresholds = [100, 50, 25, 10, 1];
            const getBadge = (count) => {
              for (const t of badgeThresholds) { if (count >= t) return t; }
              return null;
            };
            const ranked = Object.values(stMap).sort((a, b) => b.count - a.count);
            const max = ranked.length > 0 ? ranked[0].count : 1;
            return ranked.length > 0 && (
              <div style={{ borderTop: '1px solid rgba(180,160,140,0.12)' }}>
                <div className="px-5 sm:px-6 pt-3 pb-1">
                  <div className="text-[10px] uppercase font-bold flex items-center gap-1.5" style={{ color: '#8a7a6a', letterSpacing: '0.1em' }}>
                    <svg className="w-3.5 h-3.5" style={{ color: '#1e3a8a' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                    Rettungswachen-Ranking
                  </div>
                </div>
                <div className="px-5 sm:px-6 pb-5 sm:pb-6 space-y-2.5">
                  {ranked.map((s, i) => {
                    const barWidth = Math.max(8, Math.round((s.count / max) * 100));
                    const badge = getBadge(s.count);
                    return (
                      <div key={s.name} className="flex items-center gap-2.5">
                        <span className="text-base font-extrabold w-5 text-right tabular-nums"
                          style={{ color: i === 0 ? '#1d4ed8' : i === 1 ? '#6b7280' : '#a09080' }}>{i + 1}</span>
                        <StationBadge name={s.name} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-0.5">
                            <span className="text-xs sm:text-sm font-semibold truncate" style={{ color: '#2a2018' }}>{s.name}</span>
                            <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                              {/* Streak indicator */}
                              {s.streak >= 2 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: 'rgba(234,88,12,0.1)', color: '#c2410c', border: '1px solid rgba(234,88,12,0.2)' }}>
                                  {s.streak}x
                                </span>
                              )}
                              {/* Badge */}
                              {badge && badge >= 10 && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full"
                                  style={{ background: badge >= 100 ? 'rgba(234,179,8,0.15)' : badge >= 50 ? 'rgba(168,162,158,0.15)' : 'rgba(180,83,9,0.1)',
                                    color: badge >= 100 ? '#a16207' : badge >= 50 ? '#57534e' : '#92400e',
                                    border: `1px solid ${badge >= 100 ? 'rgba(234,179,8,0.3)' : badge >= 50 ? 'rgba(168,162,158,0.3)' : 'rgba(180,83,9,0.2)'}` }}>
                                  {badge}+
                                </span>
                              )}
                              <FlipCounter value={s.count} />
                            </div>
                          </div>
                          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(180,160,140,0.1)' }}>
                            <div className="h-full rounded-full transition-all" style={{
                              width: `${barWidth}%`,
                              background: i === 0
                                ? 'linear-gradient(90deg, #1e3a8a, #2563eb)'
                                : i === 1
                                  ? 'linear-gradient(90deg, #6b7280, #9ca3af)'
                                  : 'linear-gradient(90deg, #c0c8d0, #d4dce4)',
                            }} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </GlassCard>

        {/* Case list — standard depth */}
        <GlassCard className="rounded-2xl overflow-hidden">
          <div className="p-4 sm:p-5 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(180,160,140,0.15)' }}>
            <h2 className="text-base sm:text-lg font-bold" style={{ color: '#2a2018', letterSpacing: '-0.01em' }}>Ihre Eins&auml;tze</h2>
            <div className="flex items-center text-[10px] font-bold uppercase gap-1" style={{ color: '#a09080', letterSpacing: '0.14em' }}>
              <span className="w-[42px] text-center">App</span>
              <span className="w-2" />
              <span className="w-[42px] text-center">CT</span>
            </div>
          </div>

          <div>
            {cases.map((c, i) => {
              const status = getCaseStatus(c);
              const ctColor = status === 'match' ? 'green' : status === 'mismatch' ? 'red' : 'off';
              const rowBg = status === 'match' ? 'rgba(5,150,105,0.035)'
                : status === 'mismatch' ? 'rgba(220,38,38,0.035)'
                : 'transparent';
              return (
                <div key={c.id} className="px-4 sm:px-5 py-4 transition-colors"
                  style={{ background: rowBg, borderTop: i > 0 ? '1px solid rgba(180,160,140,0.08)' : undefined }}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="font-mono font-bold text-base sm:text-lg" style={{ color: '#2a2018', letterSpacing: '0.02em' }}>{c.id}</div>
                      <div className="flex items-center gap-2 mt-1">
                        {settings.showTimestamp && <span className="text-xs font-medium" style={{ color: '#a09080' }}>{formatDateDE(c.timestamp)}</span>}
                        {settings.showRettungswache && <StationBadge name={c.rettungswache} />}
                      </div>
                    </div>
                    <SignalPair appColor="green" ctColor={ctColor} size="lg" />
                  </div>
                </div>
              );
            })}
          </div>
        </GlassCard>

        {/* Legend — subtle (most recessed) */}
        <GlassCard depth="subtle" className="mt-5 rounded-2xl p-5">
          <h3 className="font-bold mb-4 flex items-center gap-2 text-sm" style={{ color: '#2a2018' }}>
            <StarOfLife size={14} color="#1e3a8a" />
            Legende
          </h3>
          <div className="space-y-3.5">
            {[
              { app: 'green', ct: 'green', label: 'App-Vorhersage korrekt' },
              { app: 'green', ct: 'red', label: 'App-Vorhersage inkorrekt' },
              { app: 'green', ct: 'off', label: 'CT-Ergebnis ausstehend' },
            ].map(({ app, ct, label }) => (
              <div key={ct} className="flex items-center gap-4">
                <SignalPair appColor={app} ctColor={ct} size="md" />
                <span className="text-sm font-medium" style={{ color: '#5a4a3a' }}>{label}</span>
              </div>
            ))}
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

// ===================== APP ROOT =====================
const FIRESTORE_DOC = doc(db, 'scoreboard', 'data');

export default function App() {
  const [view, setView] = useState(() => localStorage.getItem('igfap_remembered') === 'true' ? 'research' : 'scoreboard');
  const [isLoggedIn, setIsLoggedIn] = useState(() => localStorage.getItem('igfap_remembered') === 'true');
  const [showLogin, setShowLogin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [cases, setCases] = useState([]);
  const [results, setResults] = useState({});
  const [selectedCase, setSelectedCase] = useState(null);
  const [settings, setSettings] = useState({ cutoff: 65, showTimestamp: true, showRettungswache: true });
  const [stations, setStations] = useState([]);
  const addStation = (name) => { if (name && !stations.includes(name)) setStations(prev => [...prev, name].sort()); };

  // Sync flags: prevent feedback loop (Firestore update → state → save → Firestore update...)
  const firestoreReady = useRef(false);
  const skipNextSave = useRef(false);
  const saveTimer = useRef(null);

  // Real-time listener — loads data on mount and syncs across devices
  useEffect(() => {
    const unsub = onSnapshot(FIRESTORE_DOC, (snap) => {
      skipNextSave.current = true; // Mark: this state change is FROM Firestore, don't save back
      if (snap.exists()) {
        const d = snap.data();
        if (d.cases) setCases(d.cases);
        if (d.results) setResults(d.results);
        if (d.stations) setStations(d.stations);
        if (d.settings) setSettings(d.settings);
      }
      firestoreReady.current = true;
      setLoading(false);
    }, (err) => {
      console.error('Firestore listen error:', err);
      firestoreReady.current = true;
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Debounced save — writes to Firestore 500ms after last LOCAL state change
  const saveToFirestore = useCallback(() => {
    if (!firestoreReady.current) return;
    if (skipNextSave.current) { skipNextSave.current = false; return; }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      setDoc(FIRESTORE_DOC, { cases, results, stations, settings }).catch(err =>
        console.error('Firestore save error:', err)
      );
    }, 500);
  }, [cases, results, stations, settings]);

  useEffect(() => { saveToFirestore(); }, [saveToFirestore]);

  const LoginModal = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'rgba(40,20,10,0.2)', backdropFilter: 'blur(12px)', WebkitBackdropFilter: 'blur(12px)' }}>
      <GlassCard depth="hero" className="rounded-3xl p-8 w-full max-w-md">
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
            style={{ background: 'linear-gradient(135deg, #1e3a8a 0%, #1d4ed8 100%)', boxShadow: '0 4px 20px rgba(29,78,216,0.4)' }}>
            <StarOfLife size={28} color="white" />
          </div>
          <h2 className="text-xl font-bold" style={{ color: '#2a2018' }}>Research Login</h2>
        </div>
        <LoginContent />
      </GlassCard>
    </div>
  );

  const LoginContent = () => {
    const [u, setU] = useState(''); const [p, setP] = useState(''); const [rem, setRem] = useState(false); const [err, setErr] = useState('');
    const go = () => {
      if (u === 'research' && p === 'igfap2025') { if (rem) localStorage.setItem('igfap_remembered', 'true'); setIsLoggedIn(true); setShowLogin(false); setView('research'); }
      else setErr('Ung\u00fcltige Anmeldedaten');
    };
    return (
      <div className="space-y-5">
        <div><label className="block text-sm font-medium mb-2" style={{ color: '#5a4a3a' }}>Benutzername</label>
          <input type="text" value={u} onChange={(e) => setU(e.target.value)} placeholder="Benutzername"
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} /></div>
        <div><label className="block text-sm font-medium mb-2" style={{ color: '#5a4a3a' }}>Passwort</label>
          <input type="password" value={p} onChange={(e) => setP(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && go()} placeholder="Passwort"
            className="w-full px-4 py-3 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
            style={{ background: 'rgba(255,252,248,0.8)', border: '1px solid rgba(180,160,140,0.3)', color: '#2a2018' }} /></div>
        <label className="flex items-center gap-3 cursor-pointer"><input type="checkbox" checked={rem} onChange={(e) => setRem(e.target.checked)} className="w-4 h-4 rounded bg-white border-slate-300 text-blue-600" />
          <span className="text-sm" style={{ color: '#8a7a6a' }}>Angemeldet bleiben</span></label>
        {err && <div className="p-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(220,38,38,0.06)', border: '1px solid rgba(220,38,38,0.15)', color: '#b91c1c' }}>{err}</div>}
        <button type="button" onClick={go} className="w-full py-3.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 cursor-pointer"
          style={{ boxShadow: '0 4px 20px rgba(37,99,235,0.3)' }}>Anmelden</button>
      </div>
    );
  };

  // Show loading screen while Firestore data is being fetched
  if (loading) {
    return (
      <div>
        <BokehBackground />
        <div className="relative z-10 min-h-screen flex items-center justify-center">
          <GlassCard depth="hero" className="rounded-3xl p-10 text-center">
            <StarOfLife size={48} color="#1e3a8a" style={{ margin: '0 auto 16px' }} />
            <div className="text-lg font-bold" style={{ color: '#2a2018' }}>Daten werden geladen...</div>
          </GlassCard>
        </div>
      </div>
    );
  }

  if (isLoggedIn && view === 'research') {
    return <ResearchPortal cases={cases} setCases={setCases} results={results} setResults={setResults} selectedCase={selectedCase} setSelectedCase={setSelectedCase} settings={settings} setSettings={setSettings}
      stations={stations} onAddStation={addStation}
      onLogout={() => { localStorage.removeItem('igfap_remembered'); setIsLoggedIn(false); setView('scoreboard'); }} />;
  }

  return (
    <div>
      {showLogin && <LoginModal />}
      <button onClick={() => setShowLogin(true)} className="fixed bottom-4 right-4 z-40 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:scale-105"
        style={{ background: 'rgba(255,251,247,0.5)', backdropFilter: 'blur(16px)', color: '#8a7a6a', border: '1px solid rgba(255,255,255,0.4)' }}>
        Research Login
      </button>
      <RettungsdienstScoreboard cases={cases} results={results} settings={settings} stations={stations} />
    </div>
  );
}
