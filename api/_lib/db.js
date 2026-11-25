/* ============================================================
   VIGIE — accès base de données (Supabase / PostgreSQL)
   ------------------------------------------------------------
   Deux clients, deux usages :
   • admin()        : clé service_role → CONTOURNE la RLS. Réservé aux
                      opérations système (création d'org transactionnelle,
                      webhook, audit). La clé ne vit QUE côté serveur.
   • asUser(token)  : porte le JWT de l'utilisateur → la RLS s'applique.
                      Utilisé pour lire/écrire « au nom de » l'utilisateur.

   Tant que SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY ne sont pas définis,
   configured() renvoie false et les routes répondent « non configuré »
   (l'application garde son mode démo, aucune fonctionnalité supprimée).
   ============================================================ */
import { createClient } from "@supabase/supabase-js";

const URL = process.env.SUPABASE_URL || "";
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const ANON = process.env.SUPABASE_ANON_KEY || "";
const SCHEMA = "app";

export const configured = () => !!(URL && SERVICE);

let _admin = null;
// Client système : contourne la RLS. Ne jamais exposer la clé au navigateur.
export function admin() {
  if (!configured()) return null;
  if (!_admin) _admin = createClient(URL, SERVICE, { auth: { persistSession: false, autoRefreshToken: false }, db: { schema: SCHEMA } });
  return _admin;
}

// Client « au nom de l'utilisateur » : la RLS s'applique au JWT fourni.
export function asUser(accessToken) {
  if (!URL || !ANON || !accessToken) return null;
  return createClient(URL, ANON, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: SCHEMA },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  });
}
