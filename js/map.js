/**
 * map.js — Carte Leaflet interactive AURELYS
 *
 * Module autonome. Expose window.AureMap = { init, update, flyTo }
 * Dépendances : Leaflet ≥ 1.9, AureStorage, AureBooking (optionnel)
 */

const AureMap = (() => {

  /* ── État interne ─────────────────────────────────────── */
  let _map       = null;   // instance Leaflet
  let _markers   = {};     // { [propertyId]: L.Marker }
  let _group     = null;   // L.featureGroup pour fitBounds
  let _properties = [];    // snapshot courant

  /* ── Initialisation ───────────────────────────────────── */
  function init(properties) {
    const container = document.getElementById('map-container');
    if (!container) return;

    /* Leaflet non chargé */
    if (typeof L === 'undefined') {
      console.warn('[AureMap] Leaflet non disponible.');
      return;
    }

    /* Éviter double-init */
    if (_map) {
      update(properties);
      return;
    }

    const available = _withCoords(properties);

    /* Cacher la section si aucune propriété géolocalisée */
    if (available.length === 0) {
      const section = document.getElementById('carte');
      if (section) section.style.display = 'none';
      return;
    }

    _properties = available;

    /* ── Carte ────────────────────────────────────────── */
    _map = L.map('map-container', {
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true,
      // Vue monde par défaut — fitBounds s'en chargera ensuite
      center: [20, 10],
      zoom: 2,
    });

    /* Tuiles CartoDB Dark Matter */
    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>' +
          ' &copy; <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      }
    ).addTo(_map);

    /* ── Marqueurs + ajustement de vue ───────────────── */
    _group = L.featureGroup().addTo(_map);
    _buildMarkers(available);
    _fitAll();

    /* ── Panel latéral + stats ────────────────────────── */
    _renderStats(available);
    _renderPanel(available);
  }

  /* ── Mise à jour (après changement de données) ────────── */
  function update(properties) {
    const available = _withCoords(properties);
    _properties = available;

    if (_map) {
      _buildMarkers(available);
      _fitAll();
    }

    _renderStats(available);
    _renderPanel(available);
  }

  /* ── Centrer sur un logement (API publique) ───────────── */
  function flyTo(propertyId) {
    const prop = _properties.find(p => p.id === propertyId);
    if (!prop || !_map) return;

    _map.flyTo([prop.location.lat, prop.location.lng], 13, { duration: 1.1 });
    _setActivePanel(propertyId);

    const marker = _markers[propertyId];
    if (marker) {
      setTimeout(() => marker.openPopup(), 500);
    }
  }

  /* ── Privé : filtrer les propriétés avec coordonnées ─── */
  function _withCoords(properties) {
    return (properties || []).filter(
      p => p.available !== false &&
           p.location &&
           typeof p.location.lat === 'number' &&
           typeof p.location.lng === 'number'
    );
  }

  /* ── Privé : ajuster la vue sur tous les marqueurs ────── */
  function _fitAll() {
    if (!_group || _group.getLayers().length === 0) return;

    const bounds = _group.getBounds();

    /* Une seule propriété → zoom fixe ; plusieurs → fitBounds */
    if (_properties.length === 1) {
      _map.setView(bounds.getCenter(), 12, { animate: false });
    } else {
      _map.fitBounds(bounds, { padding: [60, 60], maxZoom: 10, animate: false });
    }
  }

  /* ── Privé : (re)construire tous les marqueurs ─────────── */
  function _buildMarkers(properties) {
    /* Vider le groupe */
    if (_group) _group.clearLayers();
    _markers = {};

    properties.forEach(p => {
      const marker = _createMarker(p);
      if (marker) {
        marker.addTo(_group);
        _markers[p.id] = marker;
      }
    });
  }

  /* ── Privé : créer un marqueur Leaflet branded ─────────── */
  function _createMarker(p) {
    if (!p.location || typeof p.location.lat !== 'number') return null;

    /* Icône SVG avec anneau pulsant */
    const icon = L.divIcon({
      html: `
        <div class="map-marker-outer" data-id="${_esc(p.id)}">
          <div class="map-marker-pulse"></div>
          <div class="map-marker-dot"></div>
        </div>`,
      className: '',
      iconSize:    [40, 40],
      iconAnchor:  [20, 20],
      popupAnchor: [0, -22],
    });

    /* Contenu du popup */
    const cover    = _esc((p.media && p.media.coverImage) || '');
    const title    = _esc(p.title || '');
    const city     = _esc((p.location.city || p.location.area) || '');
    const price    = (p.pricing && p.pricing.perNight) || 0;
    const currency = (p.pricing && p.pricing.currency) || 'EUR';
    const priceStr = new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, minimumFractionDigits: 0,
    }).format(price);

    const popupContent = `
      <div class="map-popup">
        ${cover
          ? `<img class="map-popup-img" src="${cover}" alt="${title}" loading="lazy"
               onerror="this.style.display='none'">`
          : ''}
        <div class="map-popup-body">
          ${city ? `<p class="map-popup-location">${city}</p>` : ''}
          <h3 class="map-popup-title">${title}</h3>
          <p class="map-popup-price"><strong>${priceStr}</strong> <span>/ nuit</span></p>
          <button
            class="map-popup-btn"
            onclick="(typeof AureBooking !== 'undefined') && AureBooking.initBookingModal('${_esc(p.id)}')"
            type="button"
          >
            Voir le logement
          </button>
        </div>
      </div>`;

    const marker = L.marker([p.location.lat, p.location.lng], { icon })
      .bindPopup(popupContent, {
        maxWidth: 240,
        minWidth: 200,
        className: '',
      });

    marker.on('click', () => {
      _setActivePanel(p.id);
      if (typeof AureState !== 'undefined') {
        AureState.ui.activePropertyId = p.id;
        AureState.emit('map:propertySelected', p);
      }
    });

    return marker;
  }

  /* ── Privé : stats destination ─────────────────────────── */
  function _renderStats(properties) {
    const el = document.getElementById('map-dest-stats');
    if (!el) return;

    const cities    = new Set(properties.map(p => p.location && p.location.city).filter(Boolean));
    const countries = new Set(properties.map(p => p.location && p.location.country).filter(Boolean));

    el.innerHTML = `
      <div class="map-dest-stat">
        <span class="map-dest-stat-value">${properties.length}</span>
        <span class="map-dest-stat-label">Résidence${properties.length > 1 ? 's' : ''}</span>
      </div>
      <div class="map-dest-stat">
        <span class="map-dest-stat-value">${cities.size || properties.length}</span>
        <span class="map-dest-stat-label">Ville${cities.size > 1 ? 's' : ''}</span>
      </div>
      <div class="map-dest-stat">
        <span class="map-dest-stat-value">${countries.size || 1}</span>
        <span class="map-dest-stat-label">Pays</span>
      </div>`;
  }

  /* ── Privé : panel latéral ─────────────────────────────── */
  function _renderPanel(properties) {
    const panel = document.getElementById('map-panel-list');
    if (!panel) return;

    panel.innerHTML = properties.map(p => {
      const cover    = _esc((p.media && p.media.coverImage) || '');
      const title    = _esc(p.title || '');
      const city     = _esc((p.location && (p.location.city || p.location.area)) || '');
      const price    = (p.pricing && p.pricing.perNight) || 0;
      const currency = (p.pricing && p.pricing.currency) || 'EUR';
      const priceStr = new Intl.NumberFormat('fr-FR', {
        style: 'currency', currency, minimumFractionDigits: 0,
      }).format(price);

      return `
        <button class="map-property-item" data-map-prop="${_esc(p.id)}" type="button">
          ${cover
            ? `<img class="map-property-item-img" src="${cover}" alt="${title}" loading="lazy">`
            : `<div class="map-property-item-img map-property-item-img--placeholder"></div>`}
          <div class="map-property-item-info">
            <span class="map-property-item-city">${city}</span>
            <span class="map-property-item-name">${title}</span>
            <span class="map-property-item-price">${priceStr} / nuit</span>
          </div>
        </button>`;
    }).join('');

    /* Clic → flyTo + ouvrir popup */
    panel.querySelectorAll('[data-map-prop]').forEach(btn => {
      btn.addEventListener('click', () => flyTo(btn.dataset.mapProp));
    });
  }

  /* ── Privé : surligner item actif dans le panel ─────────── */
  function _setActivePanel(propertyId) {
    const panel = document.getElementById('map-panel-list');
    if (!panel) return;
    panel.querySelectorAll('.map-property-item').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.mapProp === propertyId);
    });
  }

  /* ── Privé : échappement HTML minimal ─────────────────── */
  function _esc(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ── API publique ─────────────────────────────────────── */
  return { init, update, flyTo };

})();

window.AureMap = AureMap;
