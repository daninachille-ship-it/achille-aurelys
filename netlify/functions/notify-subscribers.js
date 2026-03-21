/**
 * notify-subscribers.js — Netlify Function AURELYS
 *
 * Envoie un email HTML à tous les abonnés newsletter lors :
 *   - de la mise en ligne d'un logement  (type: "property_online")
 *   - de l'ajout d'un logement à venir   (type: "upcoming_added")
 *
 * Variables d'environnement (Netlify → Site settings → Environment variables) :
 *
 *   BREVO_API_KEY        — clé API Brevo, gratuit sur brevo.com (300 emails/jour)
 *   SUPABASE_URL         — URL de votre projet Supabase
 *   SUPABASE_SERVICE_KEY — clé service_role Supabase (Supabase → Settings → API)
 *   SITE_URL             — URL publique du site (ex: https://aurelyscollection.com)
 *   FROM_EMAIL           — adresse expéditrice (votre Gmail ou toute adresse)
 *   FROM_NAME            — nom affiché (ex: AURELYS)
 */

exports.handler = async (event) => {
  /* ── CORS preflight ────────────────────────────────────── */
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: _corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: _corsHeaders(), body: 'Method Not Allowed' };
  }

  /* ── Variables d'environnement ─────────────────────────── */
  const BREVO_KEY  = process.env.BREVO_API_KEY;
  const SUPA_URL   = process.env.SUPABASE_URL;
  const SUPA_KEY   = process.env.SUPABASE_SERVICE_KEY;
  const SITE_URL   = (process.env.SITE_URL || 'https://aurelyscollection.com').replace(/\/$/, '');
  const FROM_EMAIL = process.env.FROM_EMAIL || 'votre@gmail.com';
  const FROM_NAME  = process.env.FROM_NAME  || 'AURELYS';

  if (!BREVO_KEY || !SUPA_URL || !SUPA_KEY) {
    const missing = [
      !BREVO_KEY  && 'BREVO_API_KEY',
      !SUPA_URL   && 'SUPABASE_URL',
      !SUPA_KEY   && 'SUPABASE_SERVICE_KEY',
    ].filter(Boolean).join(', ');
    console.error('[notify-subscribers] Variables manquantes :', missing);
    return {
      statusCode: 500,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: `Variables Netlify manquantes : ${missing}` })
    };
  }

  if (!FROM_EMAIL || FROM_EMAIL === 'votre@gmail.com') {
    console.error('[notify-subscribers] FROM_EMAIL non configuré ou invalide :', FROM_EMAIL);
    return {
      statusCode: 500,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: 'FROM_EMAIL non configuré dans Netlify. Ajoutez une adresse vérifiée dans Brevo → Senders.' })
    };
  }

  /* ── Lecture du payload ────────────────────────────────── */
  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return { statusCode: 400, headers: _corsHeaders(), body: JSON.stringify({ error: 'JSON invalide.' }) }; }

  const { type, property } = payload;
  if (!type || !property) {
    return { statusCode: 400, headers: _corsHeaders(), body: JSON.stringify({ error: 'Champs type et property requis.' }) };
  }

  /* ── Récupération des abonnés depuis Supabase ──────────── */
  let subscribers = [];
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/newsletter_subscribers?select=email`, {
      headers: {
        apikey:        SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    subscribers = Array.isArray(data) ? data.map(r => r.email).filter(Boolean) : [];
  } catch (err) {
    return { statusCode: 500, headers: _corsHeaders(), body: JSON.stringify({ error: 'Erreur Supabase : ' + err.message }) };
  }

  if (subscribers.length === 0) {
    return { statusCode: 200, headers: _corsHeaders(), body: JSON.stringify({ sent: 0, message: 'Aucun abonné.' }) };
  }

  /* ── Construction de l'email ───────────────────────────── */
  const isProperty = type === 'property_online';

  const subject  = isProperty
    ? `Nouveau logement disponible — ${property.title}`
    : `Bientôt chez AURELYS — ${property.title}`;

  const ctaLabel = isProperty ? 'Découvrir ce logement' : 'Voir la fiche';
  const ctaUrl   = isProperty
    ? `${SITE_URL}/residence.html?id=${encodeURIComponent(property.id || '')}`
    : `${SITE_URL}/#a-venir`;

  const tag = isProperty
    ? `<span style="display:inline-block;background:#c8b99a22;color:#c8b99a;border:1px solid #c8b99a55;border-radius:2px;padding:3px 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;">Nouveau logement</span>`
    : `<span style="display:inline-block;background:#8ab0cc22;color:#8ab0cc;border:1px solid #8ab0cc55;border-radius:2px;padding:3px 12px;font-size:11px;letter-spacing:.14em;text-transform:uppercase;">Bientôt disponible</span>`;

  const price = isProperty && property.pricing?.perNight
    ? `<p style="margin:0 0 8px;font-size:13px;color:#9aa3af;">À partir de <strong style="color:#c8b99a;">${property.pricing.perNight} ${property.pricing.currency || '€'}</strong> / nuit</p>`
    : '';

  const location = property.location?.city
    ? `<p style="margin:0 0 20px;font-size:13px;color:#6b7280;">${[property.location.city, property.location.country].filter(Boolean).join(', ')}</p>`
    : '';

  const desc = ((property.shortDescription || property.description || '').slice(0, 220)).trim();
  const cover = property.media?.coverImage || '';

  const html = `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${_esc(subject)}</title></head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:'Helvetica Neue',Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f1a;padding:40px 16px;">
<tr><td align="center">
<table role="presentation" width="600" style="max-width:600px;width:100%;background:#111827;border:1px solid #1e2a3a;border-radius:4px;overflow:hidden;">

  <!-- En-tête -->
  <tr><td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a3a;">
    <p style="margin:0;font-size:13px;letter-spacing:.25em;color:#c8b99a;text-transform:uppercase;font-weight:500;">AURELYS</p>
    <p style="margin:4px 0 0;font-size:11px;letter-spacing:.12em;color:#374151;text-transform:uppercase;">Intemporel par choix.</p>
  </td></tr>

  <!-- Image de couverture -->
  ${cover ? `<tr><td style="padding:0;"><img src="${_esc(cover)}" alt="${_esc(property.title || '')}" width="600" style="width:100%;max-width:600px;height:240px;object-fit:cover;display:block;"></td></tr>` : ''}

  <!-- Contenu -->
  <tr><td style="padding:36px 40px;">
    <div style="margin-bottom:20px;">${tag}</div>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:300;color:#e8e4de;letter-spacing:.02em;line-height:1.3;font-family:Georgia,serif;">${_esc(property.title || '')}</h1>
    ${location}
    ${price}
    ${desc ? `<p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.75;">${_esc(desc)}${desc.length >= 220 ? '…' : ''}</p>` : ''}

    <!-- Bouton CTA -->
    <table role="presentation" cellpadding="0" cellspacing="0"><tr>
      <td style="background:#c8b99a;border-radius:2px;">
        <a href="${ctaUrl}" target="_blank"
           style="display:inline-block;padding:14px 34px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#0b0f1a;text-decoration:none;font-weight:700;">
          ${ctaLabel} &rarr;
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Séparateur -->
  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #1e2a3a;margin:0;"></td></tr>

  <!-- Pied de page -->
  <tr><td style="padding:24px 40px;">
    <p style="margin:0 0 6px;font-size:11px;color:#374151;line-height:1.6;">
      Vous recevez cet email car vous êtes inscrit à la newsletter AURELYS.
    </p>
    <p style="margin:0;font-size:11px;">
      <a href="${SITE_URL}" style="color:#c8b99a;text-decoration:none;">Visiter le site</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

  /* ── Envoi via Brevo ────────────────────────────────────── */
  /* Brevo : on envoie un email par abonné (batchs de 50 via messageVersions) */
  let sent = 0;
  const errors = [];
  const BATCH = 50;

  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);
    const toList = batch.map(email => ({ email }));
    try {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key':      BREVO_KEY,
          'Content-Type': 'application/json',
          Accept:         'application/json'
        },
        body: JSON.stringify({
          sender:      { name: FROM_NAME, email: FROM_EMAIL },
          to:          toList,
          subject:     subject,
          htmlContent: html
        })
      });
      if (res.ok) {
        sent += batch.length;
        console.log(`[notify-subscribers] Batch envoyé : ${batch.length} emails`);
      } else {
        const brevoErr = await res.json().catch(() => ({}));
        const msg = brevoErr.message || JSON.stringify(brevoErr);
        console.error('[notify-subscribers] Brevo erreur :', res.status, msg);
        errors.push(`Brevo ${res.status}: ${msg}`);
      }
    } catch (err) {
      console.error('[notify-subscribers] Fetch erreur :', err.message);
      errors.push(err.message);
    }
  }

  return {
    statusCode: 200,
    headers: _corsHeaders(),
    body: JSON.stringify({ sent, total: subscribers.length, errors })
  };
};

/* ── Helpers ─────────────────────────────────────────────────── */

function _corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
