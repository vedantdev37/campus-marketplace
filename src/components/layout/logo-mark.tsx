/**
 * The Nitte Mart mark: a student in a hoodie, backpack on, crouched in a
 * shopping cart that is tipped forward at speed, back wheel off the ground,
 * three speed lines behind.
 *
 * Two colours only. The shapes take `currentColor`; the hood's face opening
 * and the basket's slats are "cut out" by drawing them in the page's canvas
 * colour, so the mark works on either theme without a second file.
 *
 * It is decorative here: the wordmark beside it carries the name.
 */
export function LogoMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 210 150" className={className}>
      <g fill="currentColor" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <g strokeWidth="7" fill="none">
          <line x1="6" y1="62" x2="44" y2="62" />
          <line x1="16" y1="82" x2="40" y2="82" />
          <line x1="2" y1="102" x2="36" y2="102" />
        </g>
        <g transform="rotate(9 150 128)">
          <rect x="74" y="26" width="24" height="34" rx="8" stroke="none" />
          <path d="M94 66 L98 38 Q112 18 132 34 L140 66 Z" stroke="none" />
          <circle cx="134" cy="24" r="17" stroke="none" />
          <line x1="120" y1="42" x2="164" y2="62" strokeWidth="9" fill="none" />
          <path d="M60 64 L176 64 L162 104 L74 104 Z" strokeWidth="4" />
          <path d="M62 64 L44 46 L30 46" fill="none" strokeWidth="8" />
          <path d="M80 104 L84 118 M156 104 L152 118 M80 118 L156 118" fill="none" strokeWidth="6" />
          <circle cx="86" cy="130" r="10" stroke="none" />
          <circle cx="150" cy="130" r="10" stroke="none" />
        </g>
      </g>
      <g transform="rotate(9 150 128)" fill="var(--ds-canvas)" stroke="var(--ds-canvas)" strokeLinecap="round">
        <circle cx="141" cy="27" r="7.5" stroke="none" />
        <g strokeWidth="4" fill="none">
          <line x1="88" y1="72" x2="92" y2="98" />
          <line x1="108" y1="72" x2="110" y2="98" />
          <line x1="128" y1="72" x2="128" y2="98" />
          <line x1="148" y1="72" x2="146" y2="98" />
        </g>
      </g>
    </svg>
  );
}
