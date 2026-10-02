import { C, LIENS, APP_HREF } from "../theme.js";
import { Logo, Conteneur } from "./ui.jsx";

export default function Footer() {
  return (
    <footer style={{ background: C.ink }}>
      <Conteneur className="py-12">
        <div className="flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
          <div className="max-w-sm">
            <Logo clair sousTitre />
            <p className="mt-4 text-sm leading-relaxed" style={{ color: C.inkMuted }}>Plateforme de trésorerie PME et d'évaluation du risque de crédit.</p>
          </div>
          <nav className="grid grid-cols-2 gap-x-12 gap-y-2.5 text-sm sm:grid-cols-3" aria-label="Pied de page">
            {[...LIENS, ["#fonctionnement", "Fonctionnement"], ["#donnees", "Données & consentement"], [APP_HREF, "Démo de l'application"]].map(([href, lbl]) => (
              <a key={href} href={href} className="transition-colors hover:text-white" style={{ color: C.inkMuted }}>{lbl}</a>
            ))}
          </nav>
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t pt-6 text-xs sm:flex-row sm:justify-between" style={{ borderColor: C.ink2, color: "#6B7A8D" }}>
          <span>© {new Date().getFullYear()} VIGIE</span>
          <span>Montants exprimés en FCFA · Les données de la démo sont fournies à titre d'exemple.</span>
        </div>
      </Conteneur>
    </footer>
  );
}
