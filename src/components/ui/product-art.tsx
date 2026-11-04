import * as React from "react";
import { cn } from "@/lib/utils";

/** Deterministic generated cover art for products — no stock photos, no empty gaps. */
export function ProductArt({
  from,
  to,
  ink,
  kind,
  label,
  className,
  dense,
  src,
  alt,
}: {
  from: string;
  to: string;
  ink: string;
  kind: "window" | "grid" | "terminal" | "waves";
  label?: string;
  className?: string;
  dense?: boolean;
  /** real cover art; falls back to the generated gradient if absent or broken */
  src?: string;
  alt?: string;
}) {
  const [failed, setFailed] = React.useState(false);
  const showImage = Boolean(src) && !failed;

  return (
    <div
      className={cn("relative isolate overflow-hidden", className)}
      style={{ background: `linear-gradient(135deg, ${from} 0%, ${to} 100%)` }}
    >
      {showImage ? (
        <img
          src={src}
          alt={alt ?? ""}
          loading="lazy"
          decoding="async"
          onError={() => setFailed(true)}
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <ArtLayer kind={kind} ink={ink} dense={dense} />
      )}
      {label && (
        <div
          className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 px-3 pb-2.5 pt-8"
          style={{ background: `linear-gradient(to top, ${from}dd, transparent)` }}
        >
          <span
            className="label-mono truncate text-[0.5625rem] opacity-80"
            style={{ color: ink }}
          >
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

function ArtLayer({ kind, ink, dense }: { kind: string; ink: string; dense?: boolean }) {
  const line = { stroke: ink, opacity: 0.32 } as const;
  const soft = { fill: ink, opacity: 0.1 } as const;

  if (kind === "window") {
    return (
      <svg viewBox="0 0 400 260" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <rect x="34" y="26" width="332" height="212" rx="10" fill={ink} opacity="0.08" />
        <rect x="34" y="26" width="332" height="212" rx="10" fill="none" {...line} />
        <rect x="34" y="26" width="332" height="26" rx="10" fill={ink} opacity="0.1" />
        <rect x="34" y="42" width="332" height="10" fill={ink} opacity="0.1" />
        <circle cx="50" cy="39" r="3.2" fill={ink} opacity="0.45" />
        <circle cx="61" cy="39" r="3.2" fill={ink} opacity="0.28" />
        <circle cx="72" cy="39" r="3.2" fill={ink} opacity="0.18" />
        <rect x="46" y="66" width="62" height="158" rx="6" fill={ink} opacity="0.07" />
        {[0, 1, 2, 3].map((i) => (
          <rect key={i} x="54" y={78 + i * 18} width={i === 0 ? 36 : 44} height="5" rx="2.5" fill={ink} opacity={i === 0 ? 0.45 : 0.2} />
        ))}
        <rect x="122" y="66" width="230" height="42" rx="6" fill={ink} opacity="0.07" />
        <rect x="134" y="76" width="70" height="6" rx="3" fill={ink} opacity="0.4" />
        <rect x="134" y="89" width="120" height="5" rx="2.5" fill={ink} opacity="0.18" />
        <rect x="122" y="118" width="110" height="106" rx="6" fill={ink} opacity="0.07" />
        <rect x="242" y="118" width="110" height="106" rx="6" fill={ink} opacity="0.07" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={252} y={150 + i * 12} width={90 - i * 11} height="5" rx="2.5" fill={ink} opacity="0.22" />
        ))}
        <path d="M134 214 L156 190 L176 200 L198 172 L220 184" fill="none" stroke={ink} strokeWidth="2.2" opacity="0.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }

  if (kind === "grid") {
    return (
      <svg viewBox="0 0 400 260" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        {Array.from({ length: 40 }).map((_, i) => {
          const x = 30 + (i % 8) * 43;
          const y = 34 + Math.floor(i / 8) * 46;
          const h = [26, 34, 20, 40, 28][i % 5];
          return (
            <rect
              key={i}
              x={x}
              y={y}
              width={34}
              height={h}
              rx={5}
              fill={ink}
              opacity={i % 7 === 0 ? 0.34 : i % 3 === 0 ? 0.16 : 0.09}
            />
          );
        })}
        <rect x="30" y="34" width="376" height="196" rx="12" fill="none" {...line} />
      </svg>
    );
  }

  if (kind === "terminal") {
    return (
      <svg viewBox="0 0 400 260" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMid slice">
        <rect x="46" y="42" width="308" height="176" rx="9" fill="#000" opacity="0.3" />
        <rect x="46" y="42" width="308" height="24" rx="9" fill={ink} opacity="0.12" />
        {[0, 1, 2].map((i) => (
          <circle key={i} cx={60 + i * 11} cy={54} r="2.8" fill={ink} opacity="0.4" />
        ))}
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <g key={i}>
            <rect x="62" y={82 + i * 16} width={9} height="5" rx="2.5" fill={ink} opacity="0.5" />
            <rect
              x="78"
              y={82 + i * 16}
              width={[130, 96, 160, 74, 140, 112, 88, 120][i]}
              height="5"
              rx="2.5"
              fill={ink}
              opacity={0.18 + (i % 3) * 0.06}
            />
          </g>
        ))}
        <rect x="62" y="210" width="8" height="9" fill={ink} opacity="0.6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 400 260" className="absolute inset-0 size-full" aria-hidden preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="kiln-wave" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={ink} stopOpacity="0.30" />
          <stop offset="100%" stopColor={ink} stopOpacity="0.02" />
        </linearGradient>
      </defs>
      {[0, 1, 2, 3].map((i) => (
        <path
          key={i}
          d={`M-20 ${170 + i * 22} C 70 ${120 + i * 24}, 150 ${215 + i * 12}, 240 ${160 + i * 20} S 380 ${120 + i * 26}, 420 ${150 + i * 18} L 420 280 L -20 280 Z`}
          fill="url(#kiln-wave)"
          opacity={1 - i * 0.16}
        />
      ))}
      <rect x="30" y="30" width="120" height="1" fill={ink} opacity="0.3" />
      <circle cx="330" cy="58" r="26" fill="none" stroke={ink} strokeWidth="1" opacity="0.3" />
      <circle cx="330" cy="58" r="14" fill={ink} opacity="0.12" />
      <rect x="30" y="220" width="64" height="4" rx="2" {...soft} />
    </svg>
  );
}
