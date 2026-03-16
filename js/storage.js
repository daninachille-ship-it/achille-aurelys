/**
 * storage.js — Couche de compatibilité AURELYS v3
 *
 * Ce fichier est désormais un wrapper de compatibilité.
 * Toute la logique de persistance réelle est dans db.js (Supabase).
 *
 * window.AureStorage expose une API compatible avec l'ancienne v2
 * pour ne pas casser les modules qui l'utilisent encore (booking.js, etc.).
 * Les données sont désormais lues depuis le cache global _aureProps
 * alimenté par app.js au chargement de la page.
 */

'use strict';

/* Cache global alimenté par app.js après chargement Supabase */
window._aureProps        = window._aureProps        || {};  // { [id]: property }
window._aureBlockedDates = window._aureBlockedDates || {};  // { [propId]: string[] }

window.AureStorage = {

  /* ── Compatibilité lecture synchrone (depuis cache) ─────── */

  getData() {
    // Retourne une structure compatible v2 depuis le cache
    // Utilisé uniquement par booking.js pour accès synchrone
    const props = Object.values(window._aureProps || {});
    return {
      properties:         props,
      upcomingProperties: [],
      reservations:       [],
      subscribers:        [],
      content:            { global: { globalFormspreeId: '' } }
    };
  },

  getPropertyById(id) {
    return (window._aureProps || {})[id] || null;
  },

  getPropertyBySlug(slug) {
    return Object.values(window._aureProps || {}).find(p => p.slug === slug) || null;
  },

  getBlockedDates(propertyId) {
    return (window._aureBlockedDates || {})[propertyId] || [];
  },

  /* ── Sauvegarde (désormais async via Supabase) ───────────── */

  async saveData(data) {
    // Intercepte la sauvegarde de réservation de booking.js
    if (Array.isArray(data.reservations) && data.reservations.length > 0) {
      const res = data.reservations[data.reservations.length - 1];
      if (res && window.AureDB && window.AureDB.isConfigured()) {
        try {
          await window.AureDB.createReservation(res);
        } catch (e) {
          console.error('[AureStorage] Erreur sauvegarde réservation:', e);
        }
      }
    }
  },

  /* ── Utilitaires (délégués à AureDB) ─────────────────────── */

  generateId(prefix = 'id') {
    return window.AureDB ? window.AureDB.generateId(prefix) : `${prefix}_${Date.now()}`;
  },

  slugify(str) {
    return window.AureDB ? window.AureDB.slugify(str) : str.toLowerCase().replace(/\s+/g, '-');
  },

  expandDateRange(checkIn, checkOut) {
    const dates   = [];
    const current = new Date(checkIn);
    const end     = new Date(checkOut);
    while (current < end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  },

  deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
  },

  /* ── Non utilisés en v3 ─────────────────────────────────── */
  resetData()    { console.warn('[AureStorage] resetData() non supporté en v3.'); },
  exportBackup() { console.info('[AureStorage] Utilisez Export dans le panel Paramètres admin.'); },
  importBackup() { console.warn('[AureStorage] importBackup() non supporté en v3.'); }
};

// Alias global Storage (compatibilité booking.js)
if (!window.Storage || typeof window.Storage.generateId !== 'function') {
  window.Storage = {
    generateId: window.AureStorage.generateId,
    slugify:    window.AureStorage.slugify
  };
}
