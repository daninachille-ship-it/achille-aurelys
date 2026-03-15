/**
 * state.js — Gestionnaire d'état centralisé AURELYS
 *
 * Pattern pub/sub léger pour coordonner les modules.
 * Prêt pour migration vers un state manager plus robuste (Zustand, etc.)
 */

const AureState = (() => {

  /* ── Bus d'événements ─────────────────────────────────── */
  const _listeners = {};

  function on(event, handler) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(handler);
    return () => off(event, handler); // retourne une fonction de désabonnement
  }

  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(h => h !== handler);
  }

  function emit(event, data) {
    (_listeners[event] || []).forEach(h => {
      try { h(data); } catch (e) { console.error(`[AureState] Handler error (${event}):`, e); }
    });
    // Propager aussi les événements nommés au document
    document.dispatchEvent(new CustomEvent(`aurelys:${event}`, { detail: data }));
  }

  /* ── État de l'interface publique ─────────────────────── */
  const ui = {
    activePropertyId: null,
    mapVisible: false,
    filtersOpen: false,
    currentFilters: {
      city: '',
      minGuests: 1,
      maxPrice: null
    }
  };

  /* ── Helpers de données réactifs ─────────────────────── */
  function refreshProperties() {
    const data = AureStorage.getData();
    emit('properties:updated', data.properties);
    emit('upcoming:updated', data.upcomingProperties);
  }

  function refreshContent() {
    const data = AureStorage.getData();
    emit('content:updated', data.content);
  }

  /* ── Synchronisation cross-onglets ───────────────────── */
  window.addEventListener('storage', (e) => {
    if (e.key === 'aurelys_v2') {
      emit('data:external-update', {});
      refreshProperties();
      refreshContent();
    }
  });

  window.addEventListener('aurelys:dataChanged', () => {
    refreshProperties();
    refreshContent();
  });

  return { on, off, emit, ui, refreshProperties, refreshContent };

})();

window.AureState = AureState;
