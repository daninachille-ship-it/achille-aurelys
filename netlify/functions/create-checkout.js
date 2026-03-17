/**
 * create-checkout.js — Netlify Function AURELYS
 *
 * Crée une session Stripe Checkout avec le prix calculé dynamiquement.
 *
 * Variables d'environnement (Netlify → Site settings → Environment variables) :
 *
 *   STRIPE_SECRET_KEY  — clé secrète Stripe (sk_live_... ou sk_test_...)
 *   SITE_URL           — URL publique du site (ex: https://aurelyscollection.com)
 *
 * Payload attendu (POST JSON) :
 *   {
 *     reservationId:  string,
 *     propertyTitle:  string,
 *     pricing: {
 *       subtotal:     number,   // nuits × prix/nuit (en EUR entiers)
 *       cleaningFee:  number,   // frais de ménage
 *       total:        number,
 *       currency:     string,   // "EUR"
 *       perNight:     number,
 *       nights:       number,
 *     },
 *     guest: { name, email, phone },
 *     dates: { checkIn, checkOut, nights },
 *   }
 *
 * Réponse :
 *   { url: "https://checkout.stripe.com/..." }
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
  const STRIPE_KEY = process.env.STRIPE_SECRET_KEY;
  const SITE_URL   = (process.env.SITE_URL || 'https://aurelyscollection.com').replace(/\/$/, '');

  if (!STRIPE_KEY) {
    return {
      statusCode: 500,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: 'Variable STRIPE_SECRET_KEY manquante.' }),
    };
  }

  /* ── Lecture du payload ────────────────────────────────── */
  let payload;
  try { payload = JSON.parse(event.body || '{}'); }
  catch {
    return { statusCode: 400, headers: _corsHeaders(), body: JSON.stringify({ error: 'JSON invalide.' }) };
  }

  const { reservationId, propertyTitle, pricing, guest, dates } = payload;

  if (!reservationId || !pricing || !guest || !dates) {
    return {
      statusCode: 400,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: 'Champs requis manquants : reservationId, pricing, guest, dates.' }),
    };
  }

  const currency = (pricing.currency || 'EUR').toLowerCase();

  /* ── Construction des line_items ───────────────────────── */
  /*
   * Stripe Checkout attend un payload URL-encoded avec des champs imbriqués
   * sous la forme : line_items[0][price_data][currency]=eur ...
   */
  const params = new URLSearchParams();

  params.set('mode', 'payment');
  params.set('customer_email', guest.email);
  params.set('locale', 'fr');

  /* Ligne 1 : séjour (nuits × tarif) */
  params.set('line_items[0][price_data][currency]', currency);
  params.set('line_items[0][price_data][product_data][name]',
    `${propertyTitle} — ${dates.nights} nuit${dates.nights > 1 ? 's' : ''}`);
  params.set('line_items[0][price_data][product_data][description]',
    `Arrivée : ${dates.checkIn}  ·  Départ : ${dates.checkOut}`);
  params.set('line_items[0][price_data][unit_amount]', String(Math.round(pricing.subtotal * 100)));
  params.set('line_items[0][quantity]', '1');

  /* Ligne 2 : frais de ménage (si > 0) */
  if (pricing.cleaningFee > 0) {
    params.set('line_items[1][price_data][currency]', currency);
    params.set('line_items[1][price_data][product_data][name]', 'Frais de ménage');
    params.set('line_items[1][price_data][unit_amount]', String(Math.round(pricing.cleaningFee * 100)));
    params.set('line_items[1][quantity]', '1');
  }

  /* Métadonnées pour le suivi */
  params.set('metadata[reservation_id]', reservationId);
  params.set('metadata[property_title]', propertyTitle);
  params.set('metadata[check_in]',       dates.checkIn);
  params.set('metadata[check_out]',      dates.checkOut);
  params.set('metadata[guest_name]',     guest.name);
  if (guest.phone) params.set('metadata[guest_phone]', guest.phone);

  /* URLs de redirection */
  params.set('success_url',
    `${SITE_URL}/confirmation.html?ref=${encodeURIComponent(reservationId)}&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url',
    `${SITE_URL}/?paiement=annule&ref=${encodeURIComponent(reservationId)}`);

  /* ── Appel API Stripe ───────────────────────────────────── */
  try {
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        Authorization:  `Bearer ${STRIPE_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = data?.error?.message || JSON.stringify(data);
      console.error('[create-checkout] Stripe error:', msg);
      return {
        statusCode: res.status,
        headers: _corsHeaders(),
        body: JSON.stringify({ error: msg }),
      };
    }

    return {
      statusCode: 200,
      headers: _corsHeaders(),
      body: JSON.stringify({ url: data.url, sessionId: data.id }),
    };
  } catch (err) {
    console.error('[create-checkout] Fetch error:', err.message);
    return {
      statusCode: 500,
      headers: _corsHeaders(),
      body: JSON.stringify({ error: err.message }),
    };
  }
};

/* ── Helpers ──────────────────────────────────────────────── */

function _corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };
}
