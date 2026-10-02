import { useState } from "react";
import { Menu, X } from "lucide-react";
import { C, LIENS } from "../theme.js";
import { Logo, BoutonDemo } from "./ui.jsx";

export default function Navbar() {
  const [ouvert, setOuvert] = useState(false);
  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur" style={{ background: "rgba(14,27,44,0.94)", borderColor: C.ink2 }}>
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-8">
        <Logo clair />
        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navigation principale">
          {LIENS.map(([href, lbl]) => (
            <a key={href} href={href} className="rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-white/5 hover:text-white" style={{ color: C.inkMuted }}>{lbl}</a>
          ))}
        </nav>
        <div className="flex items-center gap-2">
          <BoutonDemo className="hidden sm:inline-flex !px-4 !py-2" />
          <button onClick={() => setOuvert(!ouvert)} className="grid h-9 w-9 place-items-center rounded-md text-white lg:hidden" style={{ background: C.ink2 }} aria-expanded={ouvert} aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}>
            {ouvert ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>
      </div>
      {ouvert && (
        <nav className="border-t px-4 pb-4 pt-2 lg:hidden" style={{ borderColor: C.ink2 }} aria-label="Navigation mobile">
          {LIENS.map(([href, lbl]) => (
            <a key={href} href={href} onClick={() => setOuvert(false)} className="block rounded-md px-3 py-2.5 text-sm font-medium text-white hover:bg-white/5">{lbl}</a>
          ))}
          <BoutonDemo className="mt-2 w-full justify-center sm:hidden" />
        </nav>
      )}
    </header>
  );
}
