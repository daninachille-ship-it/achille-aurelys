/**
 * confirm-booking.js — Netlify Function AURELYS
 *
 * Appelée depuis confirmation.html après redirection Stripe.
 * 1. Vérifie le paiement auprès de l'API Stripe (session_id)
 * 2. Met à jour le statut de la réservation dans Supabase (paid / confirmed)
 * 3. Envoie un email de confirmation au client via Brevo
 *
 * Variables d'environnement (Netlify → Site settings → Environment variables) :
 *
 *   STRIPE_SECRET_KEY    — clé secrète Stripe
 *   SUPABASE_URL         — URL projet Supabase
 *   SUPABASE_SERVICE_KEY — clé service_role Supabase
 *   BREVO_API_KEY        — clé API Brevo
 *   SITE_URL             — URL publique (ex: https://aurelyscollection.com)
 *   FROM_EMAIL           — adresse expéditrice
 *   FROM_NAME            — nom affiché (ex: AURELYS)
 *   FORMSPREE_ADMIN_ID   — ID Formspree pour notifier l'admin (ex: xpzgkqrd)
 */

'use strict';

exports.handler = async (event) => {
  /* ── CORS preflight ────────────────────────────────────── */
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: _corsHeaders() };
  }
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: _corsHeaders(), body: 'Method Not Allowed' };
  }

  /* ── Variables d'environnement ─────────────────────────── */
  const STRIPE_KEY      = process.env.STRIPE_SECRET_KEY;
  const SUPA_URL        = process.env.SUPABASE_URL;
  const SUPA_KEY        = process.env.SUPABASE_SERVICE_KEY;
  const BREVO_KEY       = process.env.BREVO_API_KEY;
  const FORMSPREE_ID    = process.env.FORMSPREE_ADMIN_ID;
  const SITE_URL        = (process.env.SITE_URL || 'https://aurelyscollection.com').replace(/\/$/, '');
  const FROM_EMAIL      = process.env.FROM_EMAIL || 'noreply@aurelyscollection.com';
  const FROM_NAME       = process.env.FROM_NAME  || 'AURELYS';

  if (!STRIPE_KEY) {
    return err(500, 'Variable STRIPE_SECRET_KEY manquante.');
  }

  /* ── Lecture du payload ────────────────────────────────── */
  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch { return err(400, 'JSON invalide.'); }

  const { sessionId, reservationId } = payload;
  if (!sessionId) return err(400, 'sessionId requis.');

  /* ── 1. Vérification du paiement Stripe ────────────────── */
  let session;
  try {
    const res = await fetch(`https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`, {
      headers: { Authorization: `Bearer ${STRIPE_KEY}` },
    });
    const data = await res.json();
    if (!res.ok) return err(res.status, data?.error?.message || 'Erreur Stripe.');
    session = data;
  } catch (e) {
    return err(500, 'Impossible de contacter Stripe : ' + e.message);
  }

  /* Vérifier que le paiement est bien complété */
  if (session.payment_status !== 'paid') {
    return err(402, `Paiement non complété (statut : ${session.payment_status}).`);
  }

  /* Extraire les métadonnées de la session */
  const meta   = session.metadata || {};
  const refId  = reservationId || meta.reservation_id || '';
  const booking = {
    guestEmail:    session.customer_email || '',
    guestName:     meta.guest_name        || '',
    guestPhone:    meta.guest_phone       || '',
    guestMessage:  meta.guest_message     || '',
    propertyTitle: meta.property_title    || '',
    propertyId:    meta.property_id       || '',
    checkIn:       meta.check_in          || '',
    checkOut:      meta.check_out         || '',
    total:         session.amount_total   || 0,    // en centimes
    currency:      session.currency       || 'eur',
  };

  /* ── 2. Mise à jour Supabase ────────────────────────────── */
  if (SUPA_URL && SUPA_KEY && refId) {
    try {
      await fetch(
        `${SUPA_URL}/rest/v1/reservations?id=eq.${encodeURIComponent(refId)}`,
        {
          method: 'PATCH',
          headers: {
            apikey:          SUPA_KEY,
            Authorization:   `Bearer ${SUPA_KEY}`,
            'Content-Type':  'application/json',
            Prefer:          'return=minimal',
          },
          body: JSON.stringify({
            status:         'confirmed',
            payment_status: 'paid',
          }),
        }
      );
    } catch (e) {
      console.error('[confirm-booking] Supabase update error:', e.message);
    }

    /* ── 2b. Bloquer les dates dans availability_blocks ───── */
    if (booking.propertyId && booking.checkIn && booking.checkOut) {
      try {
        const dates = _expandDateRange(booking.checkIn, booking.checkOut);
        const rows  = dates.map(date => ({
          property_id:    booking.propertyId,
          date,
          type:           'reservation',
          reservation_id: refId,
        }));

        if (rows.length > 0) {
          await fetch(`${SUPA_URL}/rest/v1/availability_blocks`, {
            method: 'POST',
            headers: {
              apikey:         SUPA_KEY,
              Authorization:  `Bearer ${SUPA_KEY}`,
              'Content-Type': 'application/json',
              Prefer:         'resolution=merge-duplicates',
            },
            body: JSON.stringify(rows),
          });
        }
      } catch (e) {
        console.error('[confirm-booking] Block dates error:', e.message);
      }
    }
  }

  /* ── 3. Email admin via Formspree ───────────────────────── */
  if (FORMSPREE_ID) {
    const fmtAdmin = (n, cur) => new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: (cur || 'EUR').toUpperCase(), minimumFractionDigits: 0
    }).format(n / 100);

    try {
      const fpRes = await fetch(`https://formspree.io/f/${FORMSPREE_ID}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
          email:          booking.guestEmail || '',   // champ requis par Formspree
          _replyto:       booking.guestEmail || '',
          _subject:       `[AURELYS] Reservation confirmee - ${booking.propertyTitle || 'Logement'}`,
          reference:      refId              || '',
          logement:       booking.propertyTitle || '',
          client_nom:     booking.guestName    || '',
          client_tel:     booking.guestPhone   || '',
          arrivee:        booking.checkIn      || '',
          depart:         booking.checkOut     || '',
          montant:        fmtAdmin(booking.total, booking.currency),
          paiement:       'Confirme Stripe',
          ...(booking.guestMessage ? { message_client: booking.guestMessage } : {}),
        }),
      });
      if (!fpRes.ok) {
        const fpData = await fpRes.json().catch(() => ({}));
        console.error('[confirm-booking] Formspree error:', fpRes.status, JSON.stringify(fpData));
      }
    } catch (e) {
      console.error('[confirm-booking] Formspree admin error:', e.message);
    }
  }

  /* ── 4. Email de confirmation client via Brevo ──────────── */
  if (BREVO_KEY && booking.guestEmail) {
    const fmt = (n, cur) => new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency: (cur || 'EUR').toUpperCase(), minimumFractionDigits: 0
    }).format(n / 100);

    const subject = `Votre réservation est confirmée — ${booking.propertyTitle || 'AURELYS'}`;
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

  <!-- Icône confirmation -->
  <tr><td style="padding:40px 40px 0;text-align:center;">
    <div style="width:56px;height:56px;border-radius:50%;background:rgba(200,185,154,.12);border:1px solid #c8b99a;display:inline-block;vertical-align:middle;margin-bottom:20px;line-height:56px;text-align:center;"><svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#c8b99a" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;display:inline-block;"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
    <h1 style="margin:0 0 12px;font-size:26px;font-weight:300;color:#e8e4de;letter-spacing:.02em;font-family:Georgia,serif;">Réservation confirmée</h1>
    <p style="margin:0;font-size:14px;color:#6b7280;line-height:1.7;">
      Bonjour ${_esc(booking.guestName || 'cher voyageur')},<br>
      votre paiement a bien été reçu. Voici le récapitulatif de votre séjour.
    </p>
  </td></tr>

  <!-- Récapitulatif -->
  <tr><td style="padding:32px 40px;">
    <table role="presentation" width="100%" style="border:1px solid #1e2a3a;border-radius:2px;">
      ${booking.propertyTitle ? `
      <tr>
        <td style="padding:14px 20px;font-size:13px;color:#9aa3af;border-bottom:1px solid #1e2a3a;">Logement</td>
        <td style="padding:14px 20px;font-size:13px;color:#e8e4de;font-weight:500;text-align:right;border-bottom:1px solid #1e2a3a;">${_esc(booking.propertyTitle)}</td>
      </tr>` : ''}
      ${booking.checkIn ? `
      <tr>
        <td style="padding:14px 20px;font-size:13px;color:#9aa3af;border-bottom:1px solid #1e2a3a;">Arrivée</td>
        <td style="padding:14px 20px;font-size:13px;color:#e8e4de;font-weight:500;text-align:right;border-bottom:1px solid #1e2a3a;">${_esc(booking.checkIn)}</td>
      </tr>` : ''}
      ${booking.checkOut ? `
      <tr>
        <td style="padding:14px 20px;font-size:13px;color:#9aa3af;border-bottom:1px solid #1e2a3a;">Départ</td>
        <td style="padding:14px 20px;font-size:13px;color:#e8e4de;font-weight:500;text-align:right;border-bottom:1px solid #1e2a3a;">${_esc(booking.checkOut)}</td>
      </tr>` : ''}
      ${booking.guestPhone ? `
      <tr>
        <td style="padding:14px 20px;font-size:13px;color:#9aa3af;border-bottom:1px solid #1e2a3a;">Téléphone</td>
        <td style="padding:14px 20px;font-size:13px;color:#e8e4de;font-weight:500;text-align:right;border-bottom:1px solid #1e2a3a;">${_esc(booking.guestPhone)}</td>
      </tr>` : ''}
      <tr>
        <td style="padding:16px 20px;font-size:14px;color:#c8b99a;font-weight:600;">Total payé</td>
        <td style="padding:16px 20px;font-size:14px;color:#c8b99a;font-weight:600;text-align:right;">${fmt(booking.total, booking.currency)}</td>
      </tr>
    </table>

    ${refId ? `<p style="margin:16px 0 0;font-size:11px;color:#374151;">Référence : ${_esc(refId)}</p>` : ''}
  </td></tr>

  <!-- Message -->
  <tr><td style="padding:0 40px 32px;">
    <p style="margin:0;font-size:13px;color:#6b7280;line-height:1.75;">
      Notre équipe vous contactera prochainement pour vous communiquer les instructions d'accès.
      N'hésitez pas à nous écrire pour toute question.
    </p>
  </td></tr>

  <!-- CTA -->
  <tr><td style="padding:0 40px 36px;text-align:center;">
    <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto;"><tr>
      <td style="background:#c8b99a;border-radius:2px;">
        <a href="${SITE_URL}" target="_blank"
           style="display:inline-block;padding:14px 34px;font-size:11px;letter-spacing:.2em;text-transform:uppercase;color:#0b0f1a;text-decoration:none;font-weight:700;">
          Visiter le site &rarr;
        </a>
      </td>
    </tr></table>
  </td></tr>

  <!-- Séparateur -->
  <tr><td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #1e2a3a;margin:0;"></td></tr>

  <!-- Pied de page -->
  <tr><td style="padding:24px 40px;">
    <p style="margin:0;font-size:11px;color:#374151;line-height:1.6;">
      AURELYS — Collection de résidences d'exception.<br>
      <a href="${SITE_URL}" style="color:#c8b99a;text-decoration:none;">${SITE_URL.replace(/https?:\/\//, '')}</a>
    </p>
  </td></tr>

</table></td></tr></table>
</body></html>`;

    try {
      await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key':      BREVO_KEY,
          'Content-Type': 'application/json',
          Accept:         'application/json',
        },
        body: JSON.stringify({
          sender:      { name: FROM_NAME, email: FROM_EMAIL },
          to:          [{ email: booking.guestEmail, name: booking.guestName || undefined }],
          subject,
          htmlContent: html,
        }),
      });
    } catch (e) {
      console.error('[confirm-booking] Brevo error:', e.message);
      /* Non bloquant */
    }
  }

  /* ── Réponse ────────────────────────────────────────────── */
  return {
    statusCode: 200,
    headers: _corsHeaders(),
    body: JSON.stringify({ ok: true, booking }),
  };
};

/* ── Helpers ──────────────────────────────────────────────── */

function err(code, message) {
  return {
    statusCode: code,
    headers: _corsHeaders(),
    body: JSON.stringify({ error: message }),
  };
}

function _corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}

function _esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function _expandDateRange(checkIn, checkOut) {
  const dates = [];
  const start = new Date(checkIn);
  const end   = new Date(checkOut);
  const cur   = new Date(start);
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}
