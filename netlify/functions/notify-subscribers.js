/**
 * notify-subscribers.js — Netlify Function AURELYS
 *
 * Envoie un email HTML à tous les abonnés newsletter lors :
 *   - de la mise en ligne d'un logement  (type: "property_online")
 *   - de l'ajout d'un logement à venir   (type: "upcoming_added")
 *
 * Variables d'environnement requises (Netlify → Site settings → Environment variables) :
 *   RESEND_API_KEY      — clé API Resend (resend.com)
 *   SUPABASE_URL        — URL de votre projet Supabase
 *   SUPABASE_SERVICE_KEY — clé service_role Supabase (accès lecture abonnés)
 *   SITE_URL            — URL publique du site (ex: https://aurelys.netlify.app)
 *   FROM_EMAIL          — adresse expéditrice (ex: newsletter@aurelys.fr)
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
  const RESEND_KEY    = process.env.RESEND_API_KEY;
  const SUPA_URL      = process.env.SUPABASE_URL;
  const SUPA_KEY      = process.env.SUPABASE_SERVICE_KEY;
  const SITE_URL      = (process.env.SITE_URL || 'https://aurelys.netlify.app').replace(/\/$/, '');
  const FROM_EMAIL    = process.env.FROM_EMAIL || 'AURELYS <newsletter@aurelys.fr>';

  if (!RESEND_KEY || !SUPA_URL || !SUPA_KEY) {
    return {
      statusCode: 500,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: 'Variables d\'environnement manquantes (RESEND_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY).' })
    };
  }

  /* ── Lecture du payload ────────────────────────────────── */
  let payload;
  try {
    payload = JSON.parse(event.body || '{}');
  } catch {
    return { statusCode: 400, headers: _corsHeaders(), body: JSON.stringify({ error: 'JSON invalide.' }) };
  }

  const { type, property } = payload;
  if (!type || !property) {
    return { statusCode: 400, headers: _corsHeaders(), body: JSON.stringify({ error: 'Champs type et property requis.' }) };
  }

  /* ── Récupération des abonnés ──────────────────────────── */
  let subscribers = [];
  try {
    const res = await fetch(`${SUPA_URL}/rest/v1/newsletter_subscribers?select=email&confirmed=eq.true`, {
      headers: {
        apikey: SUPA_KEY,
        Authorization: `Bearer ${SUPA_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    const data = await res.json();
    subscribers = Array.isArray(data) ? data.map(r => r.email).filter(Boolean) : [];
  } catch (err) {
    return {
      statusCode: 500,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: 'Impossible de récupérer les abonnés : ' + err.message })
    };
  }

  if (subscribers.length === 0) {
    return { statusCode: 200, headers: _corsHeaders(), body: JSON.stringify({ sent: 0, message: 'Aucun abonné confirmé.' }) };
  }

  /* ── Construction de l'email ───────────────────────────── */
  const isProperty = type === 'property_online';
  const subject    = isProperty
    ? `Nouveau logement disponible — ${property.title}`
    : `Bientôt disponible — ${property.title}`;

  const ctaLabel = isProperty ? 'Découvrir ce logement' : 'Voir la fiche';
  const ctaUrl   = isProperty
    ? `${SITE_URL}/residence.html?id=${encodeURIComponent(property.id)}`
    : `${SITE_URL}/#a-venir`;

  const tagHtml = isProperty
    ? `<span style="display:inline-block;background:#c8b99a22;color:#c8b99a;border:1px solid #c8b99a44;border-radius:2px;padding:3px 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">Nouveau</span>`
    : `<span style="display:inline-block;background:#8ab0cc22;color:#8ab0cc;border:1px solid #8ab0cc44;border-radius:2px;padding:3px 10px;font-size:11px;letter-spacing:.12em;text-transform:uppercase;">Bientôt disponible</span>`;

  const priceHtml = isProperty && property.pricing?.perNight
    ? `<p style="margin:0 0 6px;font-size:13px;color:#9aa3af;font-family:'Helvetica Neue',Arial,sans-serif;">
        À partir de <strong style="color:#c8b99a;">${property.pricing.perNight} ${property.pricing.currency || '€'}</strong> / nuit
      </p>`
    : '';

  const locationHtml = property.location?.city
    ? `<p style="margin:0 0 20px;font-size:13px;color:#9aa3af;font-family:'Helvetica Neue',Arial,sans-serif;">
        ${[property.location.city, property.location.country].filter(Boolean).join(', ')}
      </p>`
    : '';

  const descHtml = (property.shortDescription || property.description || '').slice(0, 220);

  const coverImg = property.media?.coverImage || '';
  const imgHtml  = coverImg
    ? `<img src="${coverImg}" alt="${_esc(property.title)}" width="600" style="width:100%;max-width:600px;height:240px;object-fit:cover;display:block;border-radius:0;">`
    : '';

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${_esc(subject)}</title>
</head>
<body style="margin:0;padding:0;background:#0b0f1a;font-family:'Helvetica Neue',Arial,sans-serif;">

  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0b0f1a;padding:40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" style="max-width:600px;width:100%;background:#111827;border:1px solid #1e2a3a;border-radius:4px;overflow:hidden;">

          <!-- Header -->
          <tr>
            <td style="padding:32px 40px 24px;border-bottom:1px solid #1e2a3a;">
              <p style="margin:0;font-size:13px;letter-spacing:.25em;color:#c8b99a;text-transform:uppercase;font-weight:500;">AURELYS</p>
              <p style="margin:4px 0 0;font-size:11px;letter-spacing:.12em;color:#4a5568;text-transform:uppercase;">Intemporel par choix.</p>
            </td>
          </tr>

          <!-- Cover image -->
          ${imgHtml ? `<tr><td style="padding:0;">${imgHtml}</td></tr>` : ''}

          <!-- Content -->
          <tr>
            <td style="padding:32px 40px;">
              <div style="margin-bottom:20px;">${tagHtml}</div>

              <h1 style="margin:0 0 10px;font-size:26px;font-weight:300;color:#e8e4de;letter-spacing:.02em;line-height:1.3;font-family:Georgia,'Times New Roman',serif;">
                ${_esc(property.title)}
              </h1>
              ${locationHtml}
              ${priceHtml}

              ${descHtml ? `<p style="margin:0 0 28px;font-size:14px;color:#6b7280;line-height:1.7;">${_esc(descHtml)}${descHtml.length >= 220 ? '…' : ''}</p>` : ''}

              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="background:#c8b99a;border-radius:2px;">
                    <a href="${ctaUrl}" target="_blank"
                       style="display:inline-block;padding:14px 32px;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#0b0f1a;text-decoration:none;font-weight:600;">
                      ${ctaLabel} &rarr;
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #1e2a3a;margin:0;"></td></tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;">
              <p style="margin:0 0 6px;font-size:11px;color:#374151;line-height:1.6;">
                Vous recevez cet email car vous êtes inscrit à la newsletter AURELYS.
              </p>
              <p style="margin:0;font-size:11px;color:#374151;">
                <a href="${SITE_URL}" style="color:#c8b99a;text-decoration:none;">Visiter le site</a>
                &nbsp;·&nbsp;
                <a href="${SITE_URL}/#newsletter" style="color:#4a5568;text-decoration:none;">Se désinscrire</a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>

</body>
</html>`;

  /* ── Envoi via Resend ───────────────────────────────────── */
  let sent = 0;
  const errors = [];
  const BATCH = 50; /* Resend : max 50 destinataires par appel */

  for (let i = 0; i < subscribers.length; i += BATCH) {
    const batch = subscribers.slice(i, i + BATCH);
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${RESEND_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from:    FROM_EMAIL,
          to:      batch,
          subject: subject,
          html:    html
        })
      });
      if (res.ok) {
        sent += batch.length;
      } else {
        const err = await res.json();
        errors.push(err.message || 'Erreur Resend');
      }
    } catch (err) {
      errors.push(err.message);
    }
  }

  return {
    statusCode: 200,
    headers: _corsHeaders(),
    body: JSON.stringify({ sent, total: subscribers.length, errors })
  };
};

/* ── Helpers ────────────────────────────────────────────────── */

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
