/* ============================================================
   VIGIE — routeur API unique (1 seule fonction serverless)
   ------------------------------------------------------------
   Le plan Vercel Hobby limite à 12 fonctions. On regroupe donc toutes les
   routes derrière CE catch-all : les handlers vivent sous api/_handlers/
   (préfixe « _ » → non comptés comme fonctions) et sont aiguillés ici selon
   le chemin. Les URL publiques sont INCHANGÉES (/api/imports, /api/banque/notify…).
   ============================================================ */
import authSession from "./_handlers/auth_session.js";
import imports from "./_handlers/imports.js";
import assessments from "./_handlers/assessments.js";
import recommendations from "./_handlers/recommendations.js";
import dataTransactions from "./_handlers/data_transactions.js";
import grants from "./_handlers/grants.js";
import institutions from "./_handlers/institutions.js";
import institutionPortfolio from "./_handlers/institution_portfolio.js";
import institutionPme from "./_handlers/institution_pme.js";
import integrations from "./_handlers/integrations.js";
import alerts from "./_handlers/alerts.js";
import settlements from "./_handlers/settlements.js";
import banqueNotify from "./_handlers/banque_notify.js";
import banqueSettlementNotify from "./_handlers/banque_settlement-notify.js";
import banqueConnexions from "./_handlers/banque_connexions.js";
import banqueLien from "./_handlers/banque_lien.js";
import banqueTransactions from "./_handlers/banque_transactions.js";
import banqueDiagnostic from "./_handlers/banque_diagnostic.js";
import adminRotateKeys from "./_handlers/admin_rotate-keys.js";

const ROUTES = {
  "auth/session": authSession,
  "imports": imports,
  "assessments": assessments,
  "recommendations": recommendations,
  "data/transactions": dataTransactions,
  "grants": grants,
  "institutions": institutions,
  "institution/portfolio": institutionPortfolio,
  "institution/pme": institutionPme,
  "integrations": integrations,
  "alerts": alerts,
  "settlements": settlements,
  "banque/notify": banqueNotify,
  "banque/settlement-notify": banqueSettlementNotify,
  "banque/connexions": banqueConnexions,
  "banque/lien": banqueLien,
  "banque/transactions": banqueTransactions,
  "banque/diagnostic": banqueDiagnostic,
  "admin/rotate-keys": adminRotateKeys,
};

export default function handler(req, res) {
  let key = "";
  try {
    const u = new URL(req.url, "http://x");
    // __path est fourni par la réécriture Vercel (/api/:path* → /api/route?__path=:path*).
    // Repli sur le pathname si l'appel arrive en direct.
    key = (u.searchParams.get("__path") || u.pathname.replace(/^\/+/, "").replace(/^api\//, ""))
      .replace(/^\/+/, "").replace(/\/+$/, "");
  } catch { key = ""; }
  const h = ROUTES[key];
  if (!h) {
    res.statusCode = 404;
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader("Cache-Control", "no-store");
    res.end(JSON.stringify({ erreur: "not_found", chemin: key }));
    return;
  }
  return h(req, res);
}
