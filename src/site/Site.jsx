import { C } from "./theme.js";
import Navbar from "./components/Navbar.jsx";
import Footer from "./components/Footer.jsx";
import Hero from "./sections/Hero.jsx";
import Constat from "./sections/Constat.jsx";
import Espaces from "./sections/Espaces.jsx";
import Fonctionnement from "./sections/Fonctionnement.jsx";
import EspacePME from "./sections/EspacePME.jsx";
import EspaceInstitution from "./sections/EspaceInstitution.jsx";
import Methode from "./sections/Methode.jsx";
import Donnees from "./sections/Donnees.jsx";
import FAQ from "./sections/FAQ.jsx";
import AppelAction from "./sections/AppelAction.jsx";

/* ============================================================
   SITE VITRINE VIGIE
   Présente la plateforme et mène à l'application (#/app).
   ============================================================ */
export default function Site() {
  return (
    <div id="top" style={{ background: C.canvas, color: C.ink }} className="min-h-full font-sans antialiased">
      <Navbar />
      <main>
        <Hero />
        <Constat />
        <Espaces />
        <Fonctionnement />
        <EspacePME />
        <EspaceInstitution />
        <Methode />
        <Donnees />
        <FAQ />
        <AppelAction />
      </main>
      <Footer />
    </div>
  );
}
