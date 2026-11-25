/* ============================================================
   VIGIE — identité & autorisation métier (serveur)
   ------------------------------------------------------------
   Règle d'or : AUCUN changement d'« espace » côté React n'autorise quoi
   que ce soit. Toute opération sensible passe ici, côté serveur :
     1. identité     → le JWT Supabase est vérifié (utilisateur réel) ;
     2. appartenance → l'utilisateur est membre actif de l'organisation ;
     3. rôle         → son rôle couvre l'action demandée.
   La RLS (migrations 0002) est la seconde ligne de défense, pas un
   remplacement de ces contrôles.

   Distinct de _lib/securite.js, qui ne traite que le transport CinetPay
   (origine, cookie signé) et n'a aucune notion d'utilisateur.
   ============================================================ */
import { admin, asUser, configured } from "./db.js";

// Jeton d'accès porté par l'en-tête Authorization: Bearer <jwt>.
export function jeton(req) {
  const h = req.headers.authorization || req.headers.Authorization || "";
  const m = /^Bearer\s+(.+)$/i.exec(String(h).trim());
  return m ? m[1] : "";
}

// Utilisateur authentifié, ou null (non configuré / pas de jeton / jeton invalide).
export async function utilisateur(req) {
  if (!configured()) return null;
  const token = jeton(req);
  if (!token) return null;
  const { data, error } = await admin().auth.getUser(token);
  if (error || !data?.user) return null;
  return { id: data.user.id, email: data.user.email || "", token };
}

// Organisations (actives) de l'utilisateur, avec son rôle dans chacune.
export async function appartenances(userId) {
  const { data, error } = await admin()
    .from("organization_members")
    .select("org_id, role, status, organizations(id, type, name, is_demo)")
    .eq("user_id", userId)
    .eq("status", "active");
  if (error || !data) return [];
  return data.map((m) => ({
    orgId: m.org_id,
    role: m.role,
    type: m.organizations?.type,
    nom: m.organizations?.name,
    demo: !!m.organizations?.is_demo,
  }));
}

// Membre actif de l'organisation ? (option : le rôle doit figurer dans roles[])
// Renvoie l'appartenance, ou null si l'accès doit être refusé.
export async function membre(userId, orgId, roles = []) {
  const { data, error } = await admin()
    .from("organization_members")
    .select("org_id, role, status")
    .eq("user_id", userId)
    .eq("org_id", orgId)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  if (roles.length && !roles.includes(data.role)) return null;
  return { orgId: data.org_id, role: data.role };
}

const adresseIP = (req) => (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null;

// Trace d'audit — best effort : ne fait jamais échouer l'opération appelante.
export async function journaliser(req, entry) {
  try {
    const cli = admin();
    if (!cli) return;
    await cli.from("audit_logs").insert({
      actor_user: entry.actorUser || null,
      actor_org: entry.actorOrg || null,
      action: entry.action,
      target_org: entry.targetOrg || null,
      target_type: entry.targetType || null,
      target_id: entry.targetId != null ? String(entry.targetId) : null,
      scope: entry.scope || null,
      ip: adresseIP(req),
      user_agent: (req.headers["user-agent"] || "").slice(0, 300),
      payload: entry.payload || null,
    });
  } catch { /* l'audit ne doit pas bloquer la requête */ }
}

// Petit utilitaire pour les handlers : client RLS au nom de l'utilisateur.
export const clientUtilisateur = (u) => asUser(u?.token);
