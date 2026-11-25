/* ============================================================
   VIGIE — rapprochement des versements (serveur, Phase 4)
   ------------------------------------------------------------
   Un agrégateur (CinetPay) encaisse des paiements pour le compte de la PME,
   puis la REVERSE par « versements » (settlements) sur son compte bancaire,
   déduction faite de ses frais. Le rapprochement confronte, sur une période :
     • le BRUT encaissé   = somme des transactions source='cinetpay' (ENTREE) ;
     • le NET reversé      = somme des settlements.net_amount ;
     • les FRAIS           = somme des settlements.fees ;
     • l'ÉCART (indicatif) = brut − (net + frais) = encaissé non encore reversé.
   Les versements sont idempotents (UNIQUE(org_id, provider_ref)).

   NB : les dates de versement « retardent » les encaissements : un écart
   positif en fin de mois reflète surtout ce décalage, pas une anomalie.
   ============================================================ */

const moisSuivant = (mois) => { const [y, m] = mois.split("-").map(Number); const t = y * 12 + (m - 1) + 1; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}-01`; };
const somme = (rows, champ) => (rows || []).reduce((a, r) => a + (Number(r[champ]) || 0), 0);

// Enregistre (ou met à jour) un versement reçu de l'agrégateur. `cli` = admin().
export async function persistSettlement(cli, { orgId, integrationId, providerRef, netAmount, fees, settledOn, raw }) {
  const champs = {
    org_id: orgId, integration_id: integrationId || null, provider_ref: String(providerRef),
    net_amount: Number(netAmount), fees: fees != null ? Number(fees) : null,
    settled_on: settledOn || null, raw: raw || null,
  };
  const up = await cli.from("settlements")
    .upsert(champs, { onConflict: "org_id,provider_ref" })
    .select("id, provider_ref, net_amount, fees, settled_on")
    .single();
  if (up.error) throw new Error(up.error.message);
  return up.data;
}

// Rapprochement d'un mois (YYYY-MM) ou de toute la période si `mois` absent. `cli` = RLS user ou admin.
export async function rapprocher(cli, orgId, mois) {
  let qTx = cli.from("transactions").select("amount, occurred_on").eq("org_id", orgId).eq("source", "cinetpay").eq("dir", "ENTREE");
  let qSe = cli.from("settlements").select("net_amount, fees, settled_on, provider_ref").eq("org_id", orgId);
  if (mois && /^\d{4}-\d{2}$/.test(mois)) {
    const debut = `${mois}-01`, fin = moisSuivant(mois);
    qTx = qTx.gte("occurred_on", debut).lt("occurred_on", fin);
    qSe = qSe.gte("settled_on", debut).lt("settled_on", fin);
  }
  const [tx, se] = await Promise.all([qTx, qSe.order("settled_on", { ascending: false })]);
  if (tx.error) throw new Error(tx.error.message);
  if (se.error) throw new Error(se.error.message);

  const brut = Math.round(somme(tx.data, "amount"));
  const net = Math.round(somme(se.data, "net_amount"));
  const frais = Math.round(somme(se.data, "fees"));
  return {
    mois: mois || null,
    brut, net, frais,
    ecart: brut - (net + frais),           // encaissé non encore reversé (indicatif)
    nbEncaissements: tx.data?.length || 0,
    nbVersements: se.data?.length || 0,
    versements: (se.data || []).map((s) => ({ ref: s.provider_ref, net: Math.round(Number(s.net_amount) || 0), frais: Math.round(Number(s.fees) || 0), le: s.settled_on })),
  };
}
