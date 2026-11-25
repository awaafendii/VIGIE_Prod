/* ============================================================
   VIGIE — vérifications de LOGIQUE PURE (sans Supabase)
   ------------------------------------------------------------
   Couvre les tests qui ne dépendent pas d'un projet Supabase :
     • D1  chiffrement au repos (round-trip + détection d'altération)
     • E1–E4 construction des alertes précoces
     • F1  rapprochement des versements (agrégation)
   Les tests nécessitant la base (A/B/C/D2+/E5–E6/G3–G4/H*) sont dans
   acceptance.sh. La rotation de clé (G1–G2) y est aussi, car elle requiert
   plusieurs jeux d'environnement.

   Lancer :  node supabase/tests/local-logic.mjs
   Sortie   :  code 0 si tout passe, 1 sinon.
   ============================================================ */
import { randomBytes } from "node:crypto";

if (!process.env.VIGIE_ENC_KEY) process.env.VIGIE_ENC_KEY = randomBytes(32).toString("base64");

let ok = 0, ko = 0;
const check = (nom, cond) => { (cond ? ok++ : ko++); console.log(`${cond ? "PASS" : "FAIL"}  ${nom}`); };

// ---- D1 : chiffrement au repos ----
{
  const { sceller, ouvrir, chiffrementDispo } = await import("../../api/_lib/crypto.js");
  check("D1a chiffrement disponible", chiffrementDispo() === true);
  const scelle = sceller({ apikey: "K_SECRET", siteId: "42" });
  const clair = ouvrir(scelle);
  check("D1b round-trip sceller/ouvrir", clair.apikey === "K_SECRET" && clair.siteId === "42");
  let detecte = false;
  try { ouvrir(scelle.slice(0, -4) + "AAAA"); } catch { detecte = true; }
  check("D1c altération détectée (AES-GCM)", detecte);
}

// ---- E1–E4 : alertes précoces ----
{
  const { construireAlerte } = await import("../../api/_lib/finance.js");
  check("E1 première évaluation → aucune alerte", construireAlerte(null, { score: 70, etat: "Sain" }) === null);
  const a2 = construireAlerte({ score: 72, etat: "Vigilance" }, { score: 55, etat: "Alerte précoce" });
  check("E2 état qui empire → severity haute", a2 && a2.severity === "haute" && a2.kind === "etat");
  const a3 = construireAlerte({ score: 80, etat: "Sain" }, { score: 66, etat: "Sain" });
  check("E3 chute de score (−14) → kind score", a3 && a3.kind === "score");
  const a4a = construireAlerte({ score: 60, etat: "Vigilance" }, { score: 85, etat: "Sain" });
  const a4b = construireAlerte({ score: 70, etat: "Sain" }, { score: 66, etat: "Sain" });
  check("E4 amélioration / variation < 10 pts → aucune alerte", a4a === null && a4b === null);
}

// ---- F1 : rapprochement des versements ----
{
  const { rapprocher } = await import("../../api/_lib/settlements.js");
  // client factice imitant le query-builder supabase-js (then-able)
  const faux = (rows) => { const q = { select: () => q, eq: () => q, gte: () => q, lt: () => q, order: () => q, then: (r) => Promise.resolve({ data: rows, error: null }).then(r) }; return q; };
  const cli = { from: (t) => t === "transactions"
    ? faux([{ amount: 500000, occurred_on: "2026-11-03" }, { amount: 750000, occurred_on: "2026-11-20" }])
    : faux([{ net_amount: 1237500, fees: 12500, settled_on: "2026-11-22", provider_ref: "STL-1" }]) };
  const r = await rapprocher(cli, "org", "2026-11");
  check("F1 brut 1 250 000 = net 1 237 500 + frais 12 500 → écart 0", r.brut === 1250000 && r.net === 1237500 && r.frais === 12500 && r.ecart === 0);
}

console.log(`\n${ok} PASS / ${ko} FAIL`);
process.exit(ko ? 1 : 0);
