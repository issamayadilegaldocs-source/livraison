// Illustrations vectorielles de l'accueil (maquette « Accueil par catégories + Colis »). Décoratives : aria-hidden.

export function IlluBurger({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 176 176">
        <defs>
          <radialGradient id="IlluBurger-h-pain" cx="40%" cy="30%" r="75%"><stop offset="0" stopColor="#ffcf7a" /><stop offset="0.55" stopColor="#eb9a35" /><stop offset="1" stopColor="#b8661b" /></radialGradient>
          <linearGradient id="IlluBurger-h-bas" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f0a648" /><stop offset="1" stopColor="#b8661b" /></linearGradient>
          <linearGradient id="IlluBurger-h-steak" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8a4520" /><stop offset="1" stopColor="#4a2210" /></linearGradient>
          <linearGradient id="IlluBurger-h-fromage" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ffe066" /><stop offset="1" stopColor="#f5b81f" /></linearGradient>
          <linearGradient id="IlluBurger-h-salade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#8be06b" /><stop offset="1" stopColor="#3f9e3a" /></linearGradient>
        </defs>
        <circle cx="88" cy="88" r="80" fill="#ffffff" opacity="0.14" />
        <ellipse cx="90" cy="150" rx="62" ry="9" fill="#0b2a5c" opacity="0.35" />
        <g transform="rotate(-7 88 92)">
          <path d="M36 122h104c0 14-20 24-52 24s-52-10-52-24z" fill="url(#IlluBurger-h-bas)" />
          <path d="M38 112h100v10H38z" fill="#e8483b" />
          <path d="M42 112c6 0 8 6 14 6s8-6 14-6 8 6 14 6 8-6 14-6 8 6 14 6 8-6 14-6" stroke="#ff8a7a" strokeWidth="3" fill="none" />
          <rect x="32" y="94" width="112" height="20" rx="10" fill="url(#IlluBurger-h-steak)" />
          <path d="M44 100h10M64 104h12M90 99h10M112 104h12" stroke="#a65a2c" strokeWidth="3" strokeLinecap="round" />
          <path d="M34 90h108l-6 10-10 12-6-12H62l-8 14-6-14H38z" fill="url(#IlluBurger-h-fromage)" />
          <path d="M28 86c8 7 14-2 22 5s14-2 22 5 14-2 22 5 14-2 22-5 14 2 22-5 8 0 10 4l-4 6H30z" fill="url(#IlluBurger-h-salade)" />
          <path d="M30 84c0-30 26-50 58-50s58 20 58 50z" fill="url(#IlluBurger-h-pain)" />
          <path d="M50 58c6-10 18-16 30-17" stroke="#ffe3ad" strokeWidth="6" strokeLinecap="round" fill="none" opacity="0.8" />
          <g fill="#fff6e0"><ellipse cx="64" cy="54" rx="3.5" ry="2" transform="rotate(-20 64 54)" /><ellipse cx="84" cy="46" rx="3.5" ry="2" /><ellipse cx="104" cy="50" rx="3.5" ry="2" transform="rotate(20 104 50)" /><ellipse cx="120" cy="62" rx="3.5" ry="2" transform="rotate(35 120 62)" /><ellipse cx="74" cy="66" rx="3.5" ry="2" /><ellipse cx="96" cy="64" rx="3.5" ry="2" transform="rotate(10 96 64)" /><ellipse cx="54" cy="70" rx="3.5" ry="2" transform="rotate(-30 54 70)" /></g>
        </g>
      </svg>
  );
}

export function IlluColis({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 150 150">
        <defs>
          <linearGradient id="IlluColis-k-dessus" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f3c98a" /><stop offset="1" stopColor="#d9a35a" /></linearGradient>
          <linearGradient id="IlluColis-k-face" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#e2ad62" /><stop offset="1" stopColor="#b9823c" /></linearGradient>
          <linearGradient id="IlluColis-k-cote" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#c8904a" /><stop offset="1" stopColor="#94622a" /></linearGradient>
        </defs>
        <circle cx="78" cy="72" r="64" fill="#ffc83d" opacity="0.14" />
        <ellipse cx="76" cy="132" rx="52" ry="7" fill="#000000" opacity="0.35" />
        <path d="M24 56l54-24 50 22-54 26z" fill="url(#IlluColis-k-dessus)" />
        <path d="M24 56l50 24v50l-50-24z" fill="url(#IlluColis-k-face)" />
        <path d="M74 80l54-26v50l-54 26z" fill="url(#IlluColis-k-cote)" />
        <path d="M50 44l52 24v18" stroke="#ffc83d" strokeWidth="9" fill="none" strokeLinejoin="round" opacity="0.95" />
        <path d="M34 74l26 12v14l-26-12z" fill="#ffffff" opacity="0.9" />
        <path d="M38 80l16 7M38 86l12 5" stroke="#94a3c0" strokeWidth="2" strokeLinecap="round" />
        <path d="M112 30c6 0 10 4 10 10 0 8-10 16-10 16s-10-8-10-16c0-6 4-10 10-10z" fill="#e8483b" />
        <circle cx="112" cy="40" r="3.5" fill="#ffffff" />
      </svg>
  );
}

export function IlluEpicerie({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="96 0 200 150" preserveAspectRatio="xMidYMid meet"><defs>
<linearGradient id="IlluEpicerie-e-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f1faf4" /><stop offset="1" stopColor="#dff3e6" /></linearGradient>
<linearGradient id="IlluEpicerie-e-panier" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#d9a25f" /><stop offset="1" stopColor="#9c6630" /></linearGradient>
<radialGradient id="IlluEpicerie-e-pomme" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#ff8a7a" /><stop offset="0.6" stopColor="#e3342f" /><stop offset="1" stopColor="#a51d1d" /></radialGradient>
<radialGradient id="IlluEpicerie-e-orange" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#ffd27a" /><stop offset="0.6" stopColor="#f59a1f" /><stop offset="1" stopColor="#c46a0c" /></radialGradient>
<linearGradient id="IlluEpicerie-e-lait" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="0.7" stopColor="#eef3fb" /><stop offset="1" stopColor="#cfdaec" /></linearGradient>
<linearGradient id="IlluEpicerie-e-pain" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f7c675" /><stop offset="1" stopColor="#c47f2c" /></linearGradient>
</defs>
<rect width="340" height="150" fill="url(#IlluEpicerie-e-fond)" />
<ellipse cx="190" cy="138" rx="96" ry="8" fill="#16213f" opacity="0.12" />
<path d="M140 46l64 -36" stroke="url(#IlluEpicerie-e-pain)" strokeWidth="20" strokeLinecap="round" />
<path d="M150 40l6 4M166 31l6 4M182 22l6 4" stroke="#fbe2b0" strokeWidth="3" strokeLinecap="round" />
<rect x="210" y="14" width="30" height="50" rx="7" fill="url(#IlluEpicerie-e-lait)" stroke="#c4d1e6" strokeWidth="2" />
<rect x="216" y="6" width="18" height="12" rx="3" fill="#1a6be0" />
<rect x="210" y="32" width="30" height="16" fill="#1a6be0" /><path d="M216 40h18" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" />
<path d="M246 48c4-16 22-22 34-12l-10 22z" fill="#7cc35d" /><path d="M252 52c10-6 22-6 30 0" stroke="#4f9a3a" strokeWidth="4" fill="none" />
<circle cx="150" cy="58" r="17" fill="url(#IlluEpicerie-e-pomme)" /><path d="M150 41c1-6 5-9 10-9" stroke="#5a3a1a" strokeWidth="3" fill="none" strokeLinecap="round" /><ellipse cx="144" cy="52" rx="5" ry="3" fill="#ffffff" opacity="0.5" />
<circle cx="180" cy="62" r="15" fill="url(#IlluEpicerie-e-orange)" /><ellipse cx="175" cy="56" rx="4" ry="2.5" fill="#ffffff" opacity="0.5" />
<path d="M118 62h150l-14 66H132z" fill="url(#IlluEpicerie-e-panier)" />
<path d="M124 78h138M128 94h130M131 110h124" stroke="#7d4f22" strokeWidth="3" opacity="0.6" />
<path d="M150 62l-6 66M176 62l-3 66M202 62v66M228 62l3 66M254 62l6 66" stroke="#7d4f22" strokeWidth="3" opacity="0.45" />
<rect x="112" y="56" width="162" height="12" rx="6" fill="#b47a3c" />
<path d="M60 112h34M70 96h20M280 112h30" stroke="#a9dcb8" strokeWidth="6" strokeLinecap="round" /></svg>
  );
}

export function IlluPatisserie({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 170 118" preserveAspectRatio="xMidYMid meet"><defs>
<linearGradient id="IlluPatisserie-p-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff5f8" /><stop offset="1" stopColor="#fde3ec" /></linearGradient>
<linearGradient id="IlluPatisserie-p-genoise" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff0cf" /><stop offset="1" stopColor="#f1cf8c" /></linearGradient>
<linearGradient id="IlluPatisserie-p-dessus" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffd3e2" /><stop offset="1" stopColor="#f6a8c3" /></linearGradient>
<radialGradient id="IlluPatisserie-p-fraise" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#ff7b7b" /><stop offset="0.6" stopColor="#e3242b" /><stop offset="1" stopColor="#a3141a" /></radialGradient>
</defs>
<rect width="170" height="118" fill="url(#IlluPatisserie-p-fond)" />
<ellipse cx="86" cy="104" rx="64" ry="9" fill="#ffffff" stroke="#f3c6d6" strokeWidth="2" />
<ellipse cx="88" cy="104" rx="44" ry="4" fill="#b4235a" opacity="0.12" />
<path d="M30 66l84 -30 28 30v32H30z" fill="url(#IlluPatisserie-p-genoise)" />
<path d="M30 74h112v6H30zM30 86h112v6H30z" fill="#f08bb0" />
<path d="M114 36l28 30v32l-28-6z" fill="#e8b96a" opacity="0.55" />
<path d="M30 66l84 -30 28 30z" fill="url(#IlluPatisserie-p-dessus)" />
<path d="M36 66c6 6 12 0 18 6s12 0 18 6" stroke="#ffffff" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.9" />
<path d="M104 30c-2-10 6-16 14-12 8-4 16 2 14 12-2 10-14 16-14 16s-12-6-14-16z" fill="url(#IlluPatisserie-p-fraise)" />
<path d="M112 18l6 6 6-6" stroke="#3a8a2c" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round" />
<g fill="#ffe08a"><circle cx="112" cy="30" r="1.4" /><circle cx="120" cy="34" r="1.4" /><circle cx="124" cy="28" r="1.4" /><circle cx="116" cy="38" r="1.4" /></g>
<ellipse cx="110" cy="27" rx="3" ry="2" fill="#ffffff" opacity="0.6" /></svg>
  );
}

export function IlluCafe({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 170 118" preserveAspectRatio="xMidYMid meet"><defs>
<linearGradient id="IlluCafe-c-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff8f0" /><stop offset="1" stopColor="#fbe9d6" /></linearGradient>
<linearGradient id="IlluCafe-c-tasse" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="0.75" stopColor="#f2eee9" /><stop offset="1" stopColor="#d8cfc4" /></linearGradient>
<radialGradient id="IlluCafe-c-mousse" cx="50%" cy="50%" r="60%"><stop offset="0" stopColor="#f3dcc0" /><stop offset="1" stopColor="#a8683a" /></radialGradient>
<linearGradient id="IlluCafe-c-jus" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ff9a5c" /><stop offset="1" stopColor="#e2531f" /></linearGradient>
<linearGradient id="IlluCafe-c-verre" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" stopOpacity="0.7" /><stop offset="0.3" stopColor="#ffffff" stopOpacity="0" /></linearGradient>
</defs>
<rect width="170" height="118" fill="url(#IlluCafe-c-fond)" />
<ellipse cx="54" cy="102" rx="40" ry="7" fill="#ffffff" stroke="#e4d6c6" strokeWidth="2" />
<path d="M22 56h62l-6 38c-1 6-6 8-11 8H39c-5 0-10-2-11-8z" fill="url(#IlluCafe-c-tasse)" stroke="#d8cfc4" strokeWidth="1.5" />
<path d="M84 64h5a11 11 0 0 1 0 22h-8" fill="none" stroke="#e6ddd2" strokeWidth="6" />
<ellipse cx="53" cy="56" rx="31" ry="8" fill="url(#IlluCafe-c-mousse)" />
<path d="M46 55c4-5 10-5 14 0-4 3-10 3-14 0z" fill="#fff4e6" />
<path d="M40 44c-4-6 4-10 0-17M54 42c-4-6 4-10 0-17M68 44c-4-6 4-10 0-17" stroke="#d9b48f" strokeWidth="3.5" fill="none" strokeLinecap="round" opacity="0.8" />
<ellipse cx="126" cy="104" rx="26" ry="5" fill="#a14d0c" opacity="0.15" />
<path d="M104 40h44l-6 62h-32z" fill="url(#IlluCafe-c-jus)" />
<rect x="112" y="56" width="10" height="10" rx="2" fill="#ffffff" opacity="0.55" transform="rotate(12 117 61)" /><rect x="128" y="68" width="10" height="10" rx="2" fill="#ffffff" opacity="0.5" transform="rotate(-10 133 73)" />
<path d="M104 40h44l-6 62h-32z" fill="url(#IlluCafe-c-verre)" />
<path d="M104 40h44" stroke="#ffffff" strokeWidth="3" opacity="0.8" />
<path d="M136 40l10 -28" stroke="#16213f" strokeWidth="4" strokeLinecap="round" />
<circle cx="146" cy="42" r="12" fill="#ffb44d" /><circle cx="146" cy="42" r="8.5" fill="#ffe08a" /><path d="M146 34v16M138 42h16M140 36l12 12M152 36l-12 12" stroke="#ffb44d" strokeWidth="1.5" /></svg>
  );
}

export function IlluFleurs({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 170 118" preserveAspectRatio="xMidYMid meet"><defs>
<linearGradient id="IlluFleurs-f-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f7f4ff" /><stop offset="1" stopColor="#e9e3fd" /></linearGradient>
<linearGradient id="IlluFleurs-f-papier" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#d9ccfa" /><stop offset="1" stopColor="#8f74e8" /></linearGradient>
<radialGradient id="IlluFleurs-f-rose" cx="45%" cy="40%" r="65%"><stop offset="0" stopColor="#ff7a8a" /><stop offset="0.7" stopColor="#d81f3d" /><stop offset="1" stopColor="#9e0f27" /></radialGradient>
<radialGradient id="IlluFleurs-f-rose2" cx="45%" cy="40%" r="65%"><stop offset="0" stopColor="#ffd0e0" /><stop offset="0.7" stopColor="#f48fb1" /><stop offset="1" stopColor="#c95b86" /></radialGradient>
<linearGradient id="IlluFleurs-f-feuille" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#8fd46e" /><stop offset="1" stopColor="#3a8a2c" /></linearGradient>
</defs>
<rect width="170" height="118" fill="url(#IlluFleurs-f-fond)" />
<ellipse cx="85" cy="110" rx="28" ry="4" fill="#5b3fc4" opacity="0.15" />
<path d="M52 30c-8 10-6 22 4 26-2-12 2-20-4-26zM118 30c8 10 6 22-4 26 2-12-2-20 4-26zM60 18c4 12 14 16 22 12-8-6-12-12-22-12z" fill="url(#IlluFleurs-f-feuille)" />
<path d="M58 58l27 52 27-52z" fill="url(#IlluFleurs-f-papier)" />
<path d="M85 110l-27-52h10z" fill="#ffffff" opacity="0.25" />
<path d="M72 78c8 4 18 4 26 0" stroke="#ffc83d" strokeWidth="5" fill="none" strokeLinecap="round" />
<path d="M85 80l-8 10M85 80l8 10" stroke="#ffc83d" strokeWidth="4" strokeLinecap="round" />
<circle cx="70" cy="46" r="13" fill="url(#IlluFleurs-f-rose2)" /><path d="M64 46c2-5 10-6 12 0-3 4-9 4-12 0z" fill="#ffffff" opacity="0.4" />
<circle cx="100" cy="46" r="13" fill="url(#IlluFleurs-f-rose2)" /><path d="M94 46c2-5 10-6 12 0-3 4-9 4-12 0z" fill="#ffffff" opacity="0.4" />
<circle cx="85" cy="34" r="16" fill="url(#IlluFleurs-f-rose)" />
<path d="M85 26c6 0 9 5 7 9-2 5-9 6-12 2-3-4 0-9 5-11z" fill="none" stroke="#ff9eab" strokeWidth="2.5" />
<path d="M85 30c3 0 4 3 3 5" fill="none" stroke="#ff9eab" strokeWidth="2" />
<circle cx="85" cy="54" r="11" fill="url(#IlluFleurs-f-rose)" /><path d="M81 52c2-3 7-3 8 1" fill="none" stroke="#ff9eab" strokeWidth="2" />
<g fill="#ffffff"><circle cx="62" cy="30" r="3" /><circle cx="110" cy="28" r="3" /><circle cx="56" cy="40" r="2.5" /><circle cx="114" cy="38" r="2.5" /></g></svg>
  );
}

export function IlluPara({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="0 0 170 118" preserveAspectRatio="xMidYMid meet"><defs>
<linearGradient id="IlluPara-a-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#f3f8fe" /><stop offset="1" stopColor="#deebfb" /></linearGradient>
<linearGradient id="IlluPara-a-flacon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ffffff" /><stop offset="0.65" stopColor="#eef4fc" /><stop offset="1" stopColor="#c3d5ee" /></linearGradient>
<linearGradient id="IlluPara-a-pompe" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#3d86e8" /><stop offset="1" stopColor="#1550a8" /></linearGradient>
<linearGradient id="IlluPara-a-pot" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#bcd9fa" /><stop offset="0.6" stopColor="#8ab9ef" /><stop offset="1" stopColor="#5f93d6" /></linearGradient>
<linearGradient id="IlluPara-a-gelule" x1="0" y1="0" x2="1" y2="0"><stop offset="0.5" stopColor="#e3342f" /><stop offset="0.5" stopColor="#ffffff" /></linearGradient>
</defs>
<rect width="170" height="118" fill="url(#IlluPara-a-fond)" />
<ellipse cx="88" cy="106" rx="56" ry="6" fill="#1556b8" opacity="0.13" />
<rect x="48" y="38" width="38" height="66" rx="12" fill="url(#IlluPara-a-flacon)" stroke="#c3d5ee" strokeWidth="1.5" />
<rect x="60" y="24" width="14" height="16" rx="3" fill="url(#IlluPara-a-pompe)" />
<path d="M60 26h-10a4 4 0 0 0-4 4" stroke="#1550a8" strokeWidth="5" fill="none" strokeLinecap="round" />
<rect x="54" y="56" width="26" height="28" rx="5" fill="#ffffff" stroke="#d6e3f4" strokeWidth="1.5" />
<path d="M61 70h12M67 64v12" stroke="#e3342f" strokeWidth="4" strokeLinecap="round" />
<rect x="52" y="42" width="6" height="56" rx="3" fill="#ffffff" opacity="0.8" />
<rect x="96" y="70" width="40" height="34" rx="9" fill="url(#IlluPara-a-pot)" />
<rect x="93" y="60" width="46" height="14" rx="6" fill="url(#IlluPara-a-pompe)" />
<rect x="100" y="78" width="6" height="20" rx="3" fill="#ffffff" opacity="0.55" />
<path d="M108 88c6 4 12 4 18 0" stroke="#ffffff" strokeWidth="3" fill="none" strokeLinecap="round" />
<rect x="118" y="30" width="30" height="13" rx="6.5" fill="url(#IlluPara-a-gelule)" stroke="#e8c4c4" strokeWidth="1" transform="rotate(-25 133 36)" />
<circle cx="36" cy="90" r="4" fill="#9cc7f5" /><circle cx="146" cy="60" r="3" fill="#9cc7f5" /></svg>
  );
}

export function IlluAnimaux({ className = '' }: { className?: string }) {
  return (
    <svg aria-hidden="true" className={className} viewBox="50 0 290 150" preserveAspectRatio="xMidYMid meet"><defs>
<linearGradient id="IlluAnimaux-n-fond" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fffbea" /><stop offset="1" stopColor="#fbf0c4" /></linearGradient>
<linearGradient id="IlluAnimaux-n-sac" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#f5b335" /><stop offset="0.7" stopColor="#e2911a" /><stop offset="1" stopColor="#b86e0c" /></linearGradient>
<linearGradient id="IlluAnimaux-n-gamelle" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#5a8cf0" /><stop offset="1" stopColor="#1f4fb8" /></linearGradient>
<radialGradient id="IlluAnimaux-n-croq" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#d99a5a" /><stop offset="1" stopColor="#8a5226" /></radialGradient>
<radialGradient id="IlluAnimaux-n-balle" cx="35%" cy="30%" r="70%"><stop offset="0" stopColor="#d6ff6b" /><stop offset="1" stopColor="#8fbf12" /></radialGradient>
</defs>
<rect width="340" height="150" fill="url(#IlluAnimaux-n-fond)" />
<ellipse cx="180" cy="138" rx="130" ry="8" fill="#8a5a00" opacity="0.13" />
<path d="M70 26h70l8 108H62z" fill="url(#IlluAnimaux-n-sac)" />
<path d="M70 26c10 8 60 8 70 0" stroke="#b86e0c" strokeWidth="4" fill="none" />
<rect x="76" y="58" width="58" height="46" rx="10" fill="#ffffff" />
<g fill="#8a5a00"><ellipse cx="94" cy="72" rx="4" ry="5.5" /><ellipse cx="103" cy="67" rx="4" ry="5.5" /><ellipse cx="113" cy="69" rx="4" ry="5.5" /><ellipse cx="120" cy="77" rx="4" ry="5.5" />
<path d="M107 78c-8 0-15 9-15 15 0 4 3 6 6.5 6 3 0 5.5-2 8.5-2s5.5 2 8.5 2c3.5 0 6.5-2 6.5-6 0-6-7-15-15-15z" /></g>
<rect x="72" y="32" width="6" height="96" rx="3" fill="#ffffff" opacity="0.3" />
<path d="M176 96h120l-10 32c-2 5-6 8-12 8h-76c-6 0-10-3-12-8z" fill="url(#IlluAnimaux-n-gamelle)" />
<ellipse cx="236" cy="96" rx="60" ry="11" fill="#163d8f" />
<g fill="url(#IlluAnimaux-n-croq)"><circle cx="212" cy="92" r="7" /><circle cx="228" cy="88" r="7" /><circle cx="244" cy="91" r="7" /><circle cx="260" cy="88" r="7" /><circle cx="236" cy="82" r="7" /><circle cx="220" cy="80" r="6" /><circle cx="252" cy="80" r="6" /></g>
<path d="M186 104h104" stroke="#ffffff" strokeWidth="3" opacity="0.35" strokeLinecap="round" />
<g transform="rotate(-18 300 64)"><rect x="276" y="56" width="48" height="16" rx="8" fill="#fff6e0" /><circle cx="276" cy="56" r="9" fill="#fff6e0" /><circle cx="276" cy="72" r="9" fill="#fff6e0" /><circle cx="324" cy="56" r="9" fill="#fff6e0" /><circle cx="324" cy="72" r="9" fill="#fff6e0" /></g>
<circle cx="168" cy="122" r="13" fill="url(#IlluAnimaux-n-balle)" /><path d="M158 114c6 6 6 14 0 18M178 112c-6 6-6 14 0 18" stroke="#ffffff" strokeWidth="2.5" fill="none" /></svg>
  );
}
