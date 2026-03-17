/**
 * residence.js — Page détail d'un logement AURELYS
 * Galerie photos, lightbox, carte Leaflet, booking CTA
 */

(function () {

  let _property   = null;
  let _allImages  = [];
  let _lbIndex    = 0;
  let _lbOpen     = false;
  let _touchStartX = 0;
  let _resMap     = null;

  /* ── Init ──────────────────────────────────────────────── */
  document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    const id     = params.get('id');
    const slug   = params.get('slug');

    /* 1. Chercher dans le cache en mémoire (navigation depuis index) */
    const data = AureStorage.getData();
    const props = data.properties || [];

    if (id)   _property = props.find(p => p.id === id)   || null;
    if (slug) _property = props.find(p => p.slug === slug) || null;

    /* 2. Si pas en cache, charger depuis Supabase (accès direct à l'URL) */
    if (!_property && typeof AureDB !== 'undefined' && AureDB.isConfigured()) {
      try {
        if (id)            _property = await AureDB.getPropertyById(id);
        if (!_property && slug) _property = await AureDB.getPropertyBySlug(slug);
      } catch (e) { /* silent — redirection ci-dessous */ }
    }

    if (!_property) {
      window.location.replace('index.html');
      return;
    }

    /* Alimenter le cache global pour que booking.js puisse trouver la propriété */
    window._aureProps = window._aureProps || {};
    window._aureProps[_property.id] = _property;

    /* Charger les dates bloquées pour le calendrier de réservation */
    try {
      const cfg = window.AURELYS_CONFIG || {};
      const client = window.supabase
        ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
        : null;
      if (client) {
        const { data } = await client
          .from('availability_blocks')
          .select('date')
          .eq('property_id', _property.id);
        window._aureBlockedDates = window._aureBlockedDates || {};
        window._aureBlockedDates[_property.id] = (data || []).map(r => r.date);
      }
    } catch (e) { /* silent */ }

    /* Titre SEO */
    document.title = `${_property.title} — AURELYS`;

    _renderPage();
    _initNav();
  });

  /* ── Rendu complet ─────────────────────────────────────── */
  function _renderPage() {
    const p = _property;

    /* Images disponibles (cover + gallery) */
    const cover   = p.media?.coverImage || '';
    const gallery = (p.media?.gallery || []).filter(Boolean);
    _allImages    = [cover, ...gallery.filter(u => u !== cover)].filter(Boolean);
    if (!_allImages.length) _allImages = [cover];

    /* Galerie hero */
    _renderGallery();

    /* En-tête */
    const city    = p.location?.city    || '';
    const country = p.location?.country || '';
    const area    = p.location?.area    || '';

    setEl('res-breadcrumb',  p.title || '');
    setEl('res-location',    [city, country].filter(Boolean).join(', '));
    setEl('res-title',       p.title       || '');
    setEl('res-subtitle',    p.subtitle    || '');
    setEl('res-description', p.description || '');

    /* Capacité */
    const capItems = [
      { v: p.capacity?.guests,    l: 'voyageur'     },
      { v: p.capacity?.bedrooms,  l: 'chambre'      },
      { v: p.capacity?.beds,      l: 'lit'          },
      { v: p.capacity?.bathrooms, l: 'salle de bain'},
    ].filter(i => i.v);
    const capEl = document.getElementById('res-capacity');
    if (capEl) {
      capEl.innerHTML = capItems.map(i => `
        <div class="res-cap-item" role="listitem">
          <span class="res-cap-value">${i.v}</span>
          <span class="res-cap-label">${i.l}${i.v > 1 ? 's' : ''}</span>
        </div>`).join('');
    }

    /* Équipements */
    const amenities = p.amenities || [];
    const amenEl = document.getElementById('res-amenities');
    if (amenEl && amenities.length) {
      amenEl.innerHTML = amenities.map(a => `
        <li class="res-amenity-item">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M2 7l4 4 6-7"/></svg>
          ${escHtml(a)}
        </li>`).join('');
    } else {
      document.getElementById('res-amenities-section')?.remove();
    }

    /* Règles */
    const rules = p.rules || [];
    const rulesEl = document.getElementById('res-rules');
    if (rulesEl && rules.length) {
      rulesEl.innerHTML = rules.map(r => `
        <li class="res-rule-item">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="6" cy="6" r="5"/><path d="M6 4v3"/><circle cx="6" cy="9" r=".5" fill="currentColor"/></svg>
          ${escHtml(r)}
        </li>`).join('');
    } else {
      document.getElementById('res-rules-section')?.remove();
    }

    /* Arrivée / Départ */
    const cioEl = document.getElementById('res-checkinout');
    if (cioEl) {
      cioEl.innerHTML = `
        <div class="res-cio-item">
          <span class="res-cio-label">Arrivée</span>
          <span class="res-cio-value">${escHtml(p.checkIn || '15h00')}</span>
        </div>
        <div class="res-cio-sep" aria-hidden="true"></div>
        <div class="res-cio-item">
          <span class="res-cio-label">Départ</span>
          <span class="res-cio-value">${escHtml(p.checkOut || '11h00')}</span>
        </div>`;
    }

    /* Sidebar : prix */
    const price    = p.pricing?.perNight  || 0;
    const cleaning = p.pricing?.cleaningFee || 0;
    const currency = p.pricing?.currency  || 'EUR';
    const minStay  = p.pricing?.minimumStay || 1;

    const fmtPrice = (n) => new Intl.NumberFormat('fr-FR', {
      style: 'currency', currency, minimumFractionDigits: 0
    }).format(n);

    setEl('res-price', fmtPrice(price));

    const extraParts = [];
    if (cleaning)  extraParts.push(`+ ${fmtPrice(cleaning)} de ménage`);
    if (minStay > 1) extraParts.push(`Séjour min. ${minStay} nuits`);
    const extraEl = document.getElementById('res-price-extra');
    if (extraEl) extraEl.textContent = extraParts.join(' · ');

    /* Bouton réserver → ouvre la modale de réservation Stripe */
    const bookBtn = document.getElementById('res-book-btn');
    if (bookBtn) {
      bookBtn.addEventListener('click', (e) => {
        e.preventDefault();
        if (window.AureBooking && window.AureBooking.initBookingModal) {
          window.AureBooking.initBookingModal(p.id);
        }
      });
    }

    /* Note réservation */
    const noteEl = document.getElementById('res-booking-note');
    if (noteEl && (p.contactEmail || p.formspreeId)) {
      noteEl.innerHTML = `
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><circle cx="6" cy="6" r="5"/><path d="M6 5v4"/><circle cx="6" cy="3.5" r=".5" fill="currentColor"/></svg>
        Réponse sous 24h`;
    }

    /* Badges */
    const badges = p.badges || [];
    const badgesEl = document.getElementById('res-badges');
    if (badgesEl && badges.length) {
      badgesEl.innerHTML = badges.map(b => `<span class="res-badge">${escHtml(b)}</span>`).join('');
    } else if (badgesEl) {
      badgesEl.closest('hr')?.remove();
      badgesEl.remove();
    }

    /* Adresse carte */
    const addressEl = document.getElementById('res-map-address');
    if (addressEl) {
      const addr = p.location?.address || [area, city, country].filter(Boolean).join(', ');
      addressEl.textContent = addr;
    }

    /* Carte Leaflet */
    if (p.location?.lat != null && p.location?.lng != null) {
      _initMap(p);
    } else {
      document.getElementById('res-map-section')?.remove();
    }
  }

  /* ── Galerie ───────────────────────────────────────────── */
  function _renderGallery() {
    /* Image principale */
    const coverEl = document.getElementById('res-gallery-cover');
    if (coverEl && _allImages[0]) {
      coverEl.src = _allImages[0];
      coverEl.alt = _property.title || '';
      coverEl.addEventListener('click', () => openLightbox(0));
    }

    /* Bouton "Voir les photos" */
    const allBtn = document.getElementById('res-gallery-all-btn');
    if (allBtn) {
      allBtn.textContent = `Voir les ${_allImages.length} photo${_allImages.length > 1 ? 's' : ''}`;
      allBtn.addEventListener('click', () => openLightbox(0));
    }

    /* Grille desktop (max 4 vignettes, la 5e = bouton "voir tout") */
    const gridEl = document.getElementById('res-gallery-grid');
    if (gridEl) {
      const thumbs = _allImages.slice(1, 5);
      if (!thumbs.length) {
        gridEl.style.display = 'none';
        if (coverEl) coverEl.closest('.res-gallery-main')?.classList.add('res-gallery-main--full');
        return;
      }
      gridEl.innerHTML = thumbs.map((url, i) => `
        <button class="res-gallery-thumb" type="button" aria-label="Photo ${i + 2}" data-idx="${i + 1}">
          <img src="${escAttr(url)}" alt="" loading="lazy">
          ${i === 3 && _allImages.length > 5 ? `<div class="res-gallery-more">+${_allImages.length - 5}</div>` : ''}
        </button>`).join('');

      gridEl.querySelectorAll('.res-gallery-thumb').forEach(btn => {
        btn.addEventListener('click', () => openLightbox(parseInt(btn.dataset.idx)));
      });
    }

    /* Strip mobile */
    const stripEl = document.getElementById('res-gallery-strip');
    if (stripEl && _allImages.length > 1) {
      stripEl.innerHTML = _allImages.map((url, i) => `
        <button class="res-strip-thumb" type="button" role="listitem" aria-label="Photo ${i + 1}" data-idx="${i}">
          <img src="${escAttr(url)}" alt="" loading="lazy">
        </button>`).join('');

      stripEl.querySelectorAll('.res-strip-thumb').forEach(btn => {
        btn.addEventListener('click', () => openLightbox(parseInt(btn.dataset.idx)));
      });
    } else if (stripEl) {
      stripEl.remove();
    }
  }

  /* ── Lightbox ──────────────────────────────────────────── */
  function openLightbox(index) {
    _lbIndex = Math.max(0, Math.min(index, _allImages.length - 1));
    _lbOpen  = true;
    const lb = document.getElementById('res-lightbox');
    if (lb) {
      lb.hidden = false;
      lb.removeAttribute('hidden');
      lb.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
    _updateLightbox();

    document.getElementById('res-lb-close')?.addEventListener('click', closeLightbox, { once: false });
    document.getElementById('res-lb-backdrop')?.addEventListener('click', closeLightbox, { once: false });
    document.getElementById('res-lb-prev')?.addEventListener('click', () => _lbNav(-1));
    document.getElementById('res-lb-next')?.addEventListener('click', () => _lbNav(1));
  }

  function closeLightbox() {
    const lb = document.getElementById('res-lightbox');
    if (lb) { lb.hidden = true; lb.classList.remove('open'); }
    document.body.style.overflow = '';
    _lbOpen = false;
  }

  function _lbNav(dir) {
    _lbIndex = (_lbIndex + dir + _allImages.length) % _allImages.length;
    _updateLightbox();
  }

  function _updateLightbox() {
    const img = document.getElementById('res-lb-img');
    const ctr = document.getElementById('res-lb-counter');
    if (img) { img.src = _allImages[_lbIndex]; img.alt = `Photo ${_lbIndex + 1}`; }
    if (ctr) ctr.textContent = `${_lbIndex + 1} / ${_allImages.length}`;

    /* Cacher prev/next si une seule photo */
    const showNav = _allImages.length > 1;
    document.getElementById('res-lb-prev')?.style.setProperty('display', showNav ? '' : 'none');
    document.getElementById('res-lb-next')?.style.setProperty('display', showNav ? '' : 'none');
  }

  /* Clavier + swipe */
  document.addEventListener('keydown', (e) => {
    if (!_lbOpen) return;
    if (e.key === 'Escape')      closeLightbox();
    if (e.key === 'ArrowLeft')   _lbNav(-1);
    if (e.key === 'ArrowRight')  _lbNav(1);
  });

  document.addEventListener('touchstart', (e) => {
    _touchStartX = e.changedTouches[0].clientX;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!_lbOpen) return;
    const dx = e.changedTouches[0].clientX - _touchStartX;
    if (Math.abs(dx) > 50) _lbNav(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── Carte Leaflet (logement seul) ─────────────────────── */
  function _initMap(p) {
    if (typeof L === 'undefined') return;
    if (_resMap) return;

    const container = document.getElementById('res-map');
    if (!container) return;

    _resMap = L.map('res-map', {
      center: [p.location.lat, p.location.lng],
      zoom: 13,
      zoomControl: true,
      scrollWheelZoom: false,
      attributionControl: true
    });

    L.tileLayer(
      'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
      { subdomains: 'abcd', maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>' }
    ).addTo(_resMap);

    const icon = L.divIcon({
      html: `<div class="map-marker-outer"><div class="map-marker-pulse"></div><div class="map-marker-dot"></div></div>`,
      className: '',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });

    L.marker([p.location.lat, p.location.lng], { icon })
      .addTo(_resMap)
      .bindPopup(`<div style="font-family:var(--color-text-primary,#f0ede8);text-align:center;padding:4px 8px;"><strong>${escHtml(p.title)}</strong><br><small>${escHtml(p.location.city || '')}</small></div>`)
      .openPopup();

    setTimeout(() => _resMap && _resMap.invalidateSize({ animate: false }), 150);
  }

  /* ── Nav mobile ────────────────────────────────────────── */
  function _initNav() {
    const nav    = document.querySelector('.nav');
    const burger = document.querySelector('.nav-burger');
    const mobile = document.querySelector('.nav-mobile');

    if (nav) {
      window.addEventListener('scroll', () => {
        nav.classList.toggle('scrolled', window.scrollY > 40);
      }, { passive: true });
    }

    if (burger && mobile) {
      burger.addEventListener('click', () => {
        const open = mobile.classList.toggle('open');
        burger.classList.toggle('open', open);
        burger.setAttribute('aria-expanded', String(open));
      });
    }
  }

  /* ── Utilitaires ───────────────────────────────────────── */
  function setEl(id, text) {
    const el = document.getElementById(id);
    if (el) el.textContent = text;
  }

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function escAttr(str) { return escHtml(str); }

  /* Exposer openLightbox pour le bouton inline */
  window.openLightbox = openLightbox;

})();
