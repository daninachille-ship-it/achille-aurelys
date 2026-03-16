/**
 * state.js — Gestionnaire d'état AURELYS v3
 *
 * Pattern pub/sub léger. En v3, la synchronisation principale
 * passe par les subscriptions Supabase Realtime dans app.js.
 * Ce module reste disponible pour la coordination inter-modules.
 */

'use strict';

const AureState = (() => {

  const _listeners = {};

  function on(event, handler) {
    if (!_listeners[event]) _listeners[event] = [];
    _listeners[event].push(handler);
    return () => off(event, handler);
  }

  function off(event, handler) {
    if (!_listeners[event]) return;
    _listeners[event] = _listeners[event].filter(h => h !== handler);
  }

  function emit(event, data) {
    (_listeners[event] || []).forEach(h => {
      try { h(data); } catch (e) { console.error('[AureState] Handler error (' + event + '):', e); }
    });
    document.dispatchEvent(new CustomEvent('aurelys:' + event, { detail: data }));
  }

  const ui = {
    activePropertyId: null,
    mapVisible:       false,
    filtersOpen:      false,
    currentFilters:   { city: '', minGuests: 1, maxPrice: null }
  };

  return { on, off, emit, ui };

})();

window.AureState = AureState;
