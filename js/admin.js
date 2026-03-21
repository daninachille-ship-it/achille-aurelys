/**
 * admin.js — Panel d'administration AURELYS v3
 * Authentification et persistance via Supabase (AureDB)
 */

'use strict';

/* ── État global ────────────────────────────────────────────── */
let _settings     = null;
let _properties   = [];
let _upcoming     = [];
let _subscribers  = [];
let _reservations = [];
let _legalPages   = {};
let _faqItems     = [];

let _currentPanel    = 'dashboard';
let _editingPropId   = null;
let _editingUpcomId  = null;
let _editingFaqId    = null;
let _currentLegalTab = 'cgv';

/* ── Init ───────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-app').style.display   = 'none';
  document.getElementById('admin-login').style.display = 'flex';

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  _checkSession();
});

async function _checkSession() {
  try {
    const session = await AureDB.getSession();
    if (session) _showAdminApp();
  } catch { /* pas de session — afficher le formulaire */ }
}

/* ── Connexion ──────────────────────────────────────────────── */
async function handleLogin(e) {
  e.preventDefault();
  const emailEl = document.getElementById('admin-email');
  const pwdEl   = document.getElementById('admin-password');
  const errorEl = document.getElementById('login-error');
  const btnEl   = document.getElementById('login-btn');

  const email    = emailEl?.value?.trim();
  const password = pwdEl?.value?.trim();

  if (!email || !password) {
    if (errorEl) { errorEl.textContent = 'Email et mot de passe requis.'; errorEl.classList.add('show'); }
    return;
  }

  if (btnEl) { btnEl.disabled = true; btnEl.textContent = 'Connexion...'; }
  if (errorEl) errorEl.classList.remove('show');

  try {
    if (!AureDB.isConfigured()) {
      throw new Error('Supabase non configur\u00e9. Remplissez js/config.js avec vos identifiants.');
    }
    await AureDB.signIn(email, password);
    _showAdminApp();
  } catch (err) {
    const msg = err.message && err.message.includes('Invalid login')
      ? 'Email ou mot de passe incorrect.'
      : err.message || 'Erreur de connexion.';
    if (errorEl) { errorEl.textContent = msg; errorEl.classList.add('show'); }
    if (pwdEl) { pwdEl.value = ''; pwdEl.focus(); }
  } finally {
    if (btnEl) { btnEl.disabled = false; btnEl.textContent = 'Acc\u00e9der'; }
  }
}

async function logout() {
  await AureDB.signOut();
  document.getElementById('admin-app').style.display   = 'none';
  document.getElementById('admin-login').style.display = 'flex';
  const pwdEl = document.getElementById('admin-password');
  if (pwdEl) pwdEl.value = '';
}

/* ── Interface admin ────────────────────────────────────────── */
async function _showAdminApp() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-app').style.display   = 'flex';
  document.getElementById('admin-app').classList.add('visible');
  await _loadAllData();
  loadPanel('dashboard');
  _setupAdminRealtime();
}

function _setupAdminRealtime() {
  // Mise à jour en temps réel quand une réservation arrive
  AureDB.subscribeToChanges('reservations', async () => {
    const reservations = await AureDB.getReservations();
    _reservations = reservations;
    if (_currentPanel === 'reservations' || _currentPanel === 'dashboard') {
      _renderReservations();
      _renderDashboard();
    }
  });

  // Mise à jour des disponibilités en temps réel
  AureDB.subscribeToChanges('availability_blocks', async () => {
    if (_currentPanel === 'availability') {
      const propId = document.getElementById('avail-property-select')?.value;
      if (propId) loadAvailabilityForProperty(propId);
    }
  });
}

async function _loadAllData() {
  // Expirer les réservations pending non payées (> 2h)
  AureDB.expirePendingReservations(2).catch(() => {});

  // Avertissement progressif si la connexion est lente (mobile)
  const slowTimer = setTimeout(() => {
    if (!_settings) showToast('Connexion lente — chargement en cours…', 'error');
  }, 8000);

  // Promise.allSettled : chaque requête est indépendante — une erreur n'en bloque pas les autres
  const [propsR, upcomingR, settingsR, subsR, resR, legalR, faqR] = await Promise.allSettled([
    AureDB.getProperties(),
    AureDB.getUpcomingProperties(),
    AureDB.getSettings(),
    AureDB.getSubscribers(),
    AureDB.getReservations(),
    AureDB.getLegalPages(),
    AureDB.getFaqItems()
  ]);

  clearTimeout(slowTimer);

  if (propsR.status    === 'fulfilled') _properties   = propsR.value;
  if (upcomingR.status === 'fulfilled') _upcoming     = upcomingR.value;
  if (subsR.status     === 'fulfilled') _subscribers  = subsR.value;
  if (resR.status      === 'fulfilled') _reservations = resR.value;
  if (legalR.status    === 'fulfilled') _legalPages   = legalR.value;
  if (faqR.status      === 'fulfilled') _faqItems     = faqR.value;

  if (settingsR.status === 'fulfilled') {
    _settings = settingsR.value;
  } else {
    console.error('[Admin] Erreur chargement settings :', settingsR.reason);
    if (!_settings) showToast('Impossible de charger les paramètres. Vérifiez la connexion.', 'error');
  }
}

/* ── Navigation ─────────────────────────────────────────────── */
function loadPanel(name) {
  _currentPanel = name;

  document.querySelectorAll('.nav-item').forEach(item => {
    const active = item.dataset.panel === name;
    item.classList.toggle('active', active);
    active ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current');
  });

  const titles = {
    dashboard:    'Tableau de bord',
    properties:   'Logements',
    upcoming:     'Logements \u00e0 venir',
    texts:        'Contenu du site',
    footer:       'Footer & Liens',
    legal:        'Pages l\u00e9gales',
    faq:          'FAQ',
    payment:      'Liens de paiement',
    newsletter:   'Newsletter',
    reservations: 'R\u00e9servations',
    availability: 'Disponibilit\u00e9',
    settings:     'Param\u00e8tres'
  };

  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[name] || name;

  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('panel-' + name);
  if (panel) {
    panel.classList.add('active');
    _refreshPanel(name);
  }
}

async function _refreshPanel(name) {
  await _loadAllData();
  _renderDashboard(); // toujours mettre à jour les stats
  switch (name) {
    case 'dashboard':    _renderDashboard();    break;
    case 'properties':   _renderProperties();   break;
    case 'upcoming':     _renderUpcoming();     break;
    case 'texts':        _renderTextsForm();    break;
    case 'footer':       _renderFooterForm();   break;
    case 'legal':        _renderLegal();        break;
    case 'faq':          _renderFaq();          break;
    case 'payment':      _renderPaymentLinks(); break;
    case 'newsletter':   _renderNewsletter();   break;
    case 'reservations': _renderReservations(); break;
    case 'availability': _renderAvailability(); break;
    case 'settings':     _renderSettings();     break;
  }
}

/* ── Dashboard ──────────────────────────────────────────────── */
function _renderDashboard() {
  _setInner('stat-properties',   _properties.filter(p => p.available).length);
  _setInner('stat-upcoming',     _upcoming.length);
  _setInner('stat-subscribers',  _subscribers.length);
  _setInner('stat-reservations', _reservations.length);

  const cfgBanner = document.getElementById('supabase-config-banner');
  if (cfgBanner) cfgBanner.style.display = AureDB.isConfigured() ? 'none' : '';
}

/* ── Logements ──────────────────────────────────────────────── */
function _renderProperties() {
  const list = document.getElementById('properties-list');
  if (!list) return;
  if (_properties.length === 0) { list.innerHTML = _emptyState('Aucun logement. Cliquez sur "Ajouter" pour commencer.'); return; }
  list.innerHTML = [..._properties]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(p => _propItemHTML(p)).join('');
}

function _propItemHTML(p) {
  const city     = p.location?.city    || '';
  const country  = p.location?.country || '';
  const price    = p.pricing?.perNight || 0;
  const currency = p.pricing?.currency || 'EUR';
  const cover    = p.media?.coverImage || '';
  const lat      = p.location?.lat;
  const lng      = p.location?.lng;
  const hasCoords = lat != null && lng != null;

  return `<div class="prop-item" id="prop-item-${p.id}">
      <img class="prop-item-img" src="${_esc(cover)}" alt="${_esc(p.title || '')}"
        onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=200&q=60'">
      <div class="prop-item-info">
        <p class="prop-item-name">${_esc(p.title || 'Sans titre')}</p>
        <div class="prop-item-meta">
          <span>${_esc(city)}${country ? ', ' + _esc(country) : ''}</span>
          <span class="prop-item-price">${price} ${_esc(currency)} / nuit</span>
          ${hasCoords
            ? `<span class="prop-item-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`
            : '<span class="prop-item-coords" style="color:var(--danger-dim)">GPS manquant</span>'}
          <span class="badge ${p.available ? 'badge-available' : 'badge-unavailable'}">
            ${p.available ? 'Disponible' : 'Indisponible'}</span>
        </div>
      </div>
      <div class="prop-item-actions">
        <button class="btn btn-sm ${p.available ? 'btn-success' : 'btn-warning'}" onclick="togglePropertyAvailable('${p.id}')" title="${p.available ? 'Désactiver' : 'Activer'}">
          ${p.available ? '✓ En ligne' : '○ Hors ligne'}
        </button>
        <button class="btn btn-sm ${p.featured ? 'btn-accent' : 'btn-outline'}" onclick="setFeaturedProperty('${p.id}')" title="${p.featured ? 'En-tête actuel' : 'Mettre en en-tête'}">
          ${p.featured ? '★ En-tête' : '☆ En-tête'}
        </button>
        <button class="btn btn-outline btn-sm" onclick="demoteToUpcoming('${p.id}')" title="Passer en logement à venir">→ À venir</button>
        <button class="btn btn-secondary btn-sm" onclick="editProperty('${p.id}')">Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProperty('${p.id}')">Supprimer</button>
      </div>
    </div>`;
}

function openAddProperty() {
  _editingPropId = null;
  _resetPropertyForm();
  document.getElementById('prop-modal-title').textContent = 'Ajouter un logement';
  _openModal('prop-modal');
}

function editProperty(id) {
  _editingPropId = id;
  const p = _properties.find(x => x.id === id);
  if (!p) return;
  _setField('prop-title',          p.title || '');
  _setField('prop-subtitle',       p.subtitle || '');
  _setField('prop-short-desc',     p.shortDescription || '');
  _setField('prop-description',    p.description || '');
  _setField('prop-city',           p.location?.city    || '');
  _setField('prop-country',        p.location?.country || '');
  _setField('prop-address',        p.location?.address || '');
  _setField('prop-area',           p.location?.area    || '');
  _setField('prop-lat',            p.location?.lat     ?? '');
  _setField('prop-lng',            p.location?.lng     ?? '');
  _setField('prop-price',          p.pricing?.perNight    ?? '');
  _setField('prop-cleaning-fee',   p.pricing?.cleaningFee ?? '');
  _setField('prop-currency',       p.pricing?.currency    || 'EUR');
  _setField('prop-min-stay',       p.pricing?.minimumStay ?? '');
  _setField('prop-guests',         p.capacity?.guests    ?? '');
  _setField('prop-bedrooms',       p.capacity?.bedrooms  ?? '');
  _setField('prop-beds',           p.capacity?.beds      ?? '');
  _setField('prop-bathrooms',      p.capacity?.bathrooms ?? '');
  _setField('prop-checkin',        p.checkIn  || '');
  _setField('prop-checkout',       p.checkOut || '');
  _setField('prop-cover',          p.media?.coverImage  || '');
  _setField('prop-gallery',        (p.media?.gallery || []).join('\n'));
  _setField('prop-amenities',      (p.amenities || []).join('\n'));
  _setField('prop-rules',          (p.rules     || []).join('\n'));
  _setField('prop-badges',         (p.badges    || []).join('\n'));
  _setField('prop-payment-link',   p.paymentLink   || '');
  _setField('prop-contact-email',  p.contactEmail  || '');
  _setField('prop-formspree',      p.formspreeId   || '');
  _setField('prop-seo-title',      p.seo?.title       || '');
  _setField('prop-seo-desc',       p.seo?.description || '');
  _setCheckbox('prop-available',   p.available !== false);
  _setCheckbox('prop-featured',    !!p.featured);
  document.getElementById('prop-modal-title').textContent = 'Modifier le logement';
  _openModal('prop-modal');
}

async function saveProperty() {
  const title = _getField('prop-title').trim();
  const city  = _getField('prop-city').trim();
  if (!title) { showToast('Le titre est requis.', 'error'); return; }
  if (!city)  { showToast('La ville est requise.', 'error'); return; }

  const latRaw = _getField('prop-lat');
  const lngRaw = _getField('prop-lng');
  const existingProp = _editingPropId ? _properties.find(x => x.id === _editingPropId) : null;

  const prop = {
    id:               _editingPropId || AureDB.generateId('prop'),
    slug:             AureDB.slugify(title),
    title,
    subtitle:         _getField('prop-subtitle'),
    shortDescription: _getField('prop-short-desc'),
    description:      _getField('prop-description'),
    location: {
      city, country: _getField('prop-country'),
      address: _getField('prop-address'), area: _getField('prop-area'),
      lat: latRaw !== '' ? parseFloat(latRaw) : null,
      lng: lngRaw !== '' ? parseFloat(lngRaw) : null
    },
    pricing: {
      perNight:    parseFloat(_getField('prop-price'))        || 0,
      cleaningFee: parseFloat(_getField('prop-cleaning-fee')) || 0,
      currency:    _getField('prop-currency') || 'EUR',
      minimumStay: parseInt(_getField('prop-min-stay'))       || 1
    },
    capacity: {
      guests:    parseInt(_getField('prop-guests'))    || 0,
      bedrooms:  parseInt(_getField('prop-bedrooms'))  || 0,
      beds:      parseInt(_getField('prop-beds'))      || 0,
      bathrooms: parseInt(_getField('prop-bathrooms')) || 0
    },
    media: {
      coverImage: _getField('prop-cover'),
      gallery:    _getField('prop-gallery').split('\n').map(s => s.trim()).filter(Boolean)
    },
    amenities: _getField('prop-amenities').split('\n').map(s => s.trim()).filter(Boolean),
    rules:     _getField('prop-rules').split('\n').map(s => s.trim()).filter(Boolean),
    badges:    _getField('prop-badges').split('\n').map(s => s.trim()).filter(Boolean),
    checkIn:   _getField('prop-checkin')  || '15h00',
    checkOut:  _getField('prop-checkout') || '11h00',
    featured:  _getCheckbox('prop-featured'),
    available: _getCheckbox('prop-available'),
    paymentLink:  _getField('prop-payment-link'),
    contactEmail: _getField('prop-contact-email'),
    formspreeId:  _getField('prop-formspree'),
    seo: {
      title:       _getField('prop-seo-title') || title + ' \u2014 AURELYS',
      description: _getField('prop-seo-desc')
    },
    order: existingProp ? existingProp.order : _properties.length
  };

  try {
    await AureDB.upsertProperty(prop);
    _closeModal('prop-modal');
    await _refreshPanel('properties');
    showToast(_editingPropId ? 'Logement mis \u00e0 jour.' : 'Logement ajout\u00e9.');

    // Notifier les abonnés si le logement vient d'être mis en ligne
    const wasOffline = existingProp && existingProp.available === false;
    const isNewOnline = !existingProp && prop.available;
    if ((wasOffline || isNewOnline) && prop.available) {
      _notifySubscribers('property_online', prop);
    }
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── Notifications newsletter ───────────────────────────────── */
async function _notifySubscribers(type, property) {
  try {
    const res = await fetch('/.netlify/functions/notify-subscribers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, property })
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('Newsletter : ' + (data.error || 'Erreur serveur (vérifier BREVO_API_KEY, FROM_EMAIL dans Netlify).'), 'error');
      console.error('[AURELYS] notify-subscribers:', data);
      return;
    }
    if (data.sent > 0) {
      showToast(`Newsletter : ${data.sent} email${data.sent > 1 ? 's' : ''} envoyé${data.sent > 1 ? 's' : ''}.`, 'success');
    } else if (data.message) {
      showToast('Newsletter : ' + data.message);
    }
    if (data.errors && data.errors.length > 0) {
      console.warn('[AURELYS] notify-subscribers errors:', data.errors);
      showToast('Newsletter : certains emails ont échoué. Vérifiez la console.', 'error');
    }
  } catch (e) {
    console.warn('[AURELYS] Notification email échouée :', e.message);
    showToast('Newsletter : impossible de contacter le serveur.', 'error');
  }
}

/* Test d'envoi newsletter — vérifie la configuration Brevo */
async function testNewsletterSend() {
  const testProperty = {
    id: 'test',
    title: 'Résidence Test AURELYS',
    shortDescription: 'Ceci est un email de test pour vérifier que votre configuration Brevo fonctionne correctement.',
    location: { city: 'Paris', country: 'France' },
    pricing: { perNight: 350, currency: 'EUR' },
    media: { coverImage: '' }
  };
  showToast('Envoi du test newsletter en cours…');
  await _notifySubscribers('property_online', testProperty);
}

/* Définit le logement mis en avant dans l'en-tête du site */
async function setFeaturedProperty(id) {
  const p = _properties.find(x => x.id === id);
  if (!p) return;
  if (p.featured) { showToast('Ce logement est d\u00e9j\u00e0 en en-t\u00eate.'); return; }
  try {
    await AureDB.setFeaturedProperty(id);
    await _refreshPanel('properties');
    showToast(`"${p.title}" d\u00e9fini comme logement en en-t\u00eate.`, 'success');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* Bascule rapide disponible ↔ indisponible sans ouvrir la modale */
async function togglePropertyAvailable(id) {
  const p = _properties.find(x => x.id === id);
  if (!p) return;
  const goingOnline = !p.available;
  try {
    await AureDB.upsertProperty({ ...p, available: goingOnline });
    await _refreshPanel('properties');
    showToast(goingOnline ? 'Logement mis en ligne.' : 'Logement mis hors ligne.');
    if (goingOnline) _notifySubscribers('property_online', { ...p, available: true });
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* Convertit un logement disponible en logement "à venir" */
async function demoteToUpcoming(id) {
  const p = _properties.find(x => x.id === id);
  if (!p) return;
  if (!confirm(`Passer "${p.title}" en logement à venir ? Il sera retiré des logements disponibles.`)) return;
  try {
    const upcomingItem = {
      id:          AureDB.generateId('upcoming'),
      slug:        AureDB.slugify(p.title),
      title:       p.title,
      subtitle:    p.subtitle || '',
      description: p.description || '',
      location:    p.location || {},
      media:       p.media || {},
      expectedDate: '',
      order:       _upcoming.length
    };
    await AureDB.upsertUpcomingProperty(upcomingItem);
    await AureDB.deleteProperty(id);
    await _loadAllData();
    if (_currentPanel === 'properties') await _refreshPanel('properties');
    if (_currentPanel === 'upcoming')   await _refreshPanel('upcoming');
    showToast(`"${p.title}" déplacé en logements à venir.`);
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* Convertit un logement "à venir" en logement disponible */
async function promoteToProperty(upcomingId) {
  const u = _upcoming.find(x => x.id === upcomingId);
  if (!u) return;
  if (!confirm(`Mettre en ligne "${u.title}" comme logement disponible ?`)) return;
  try {
    const prop = {
      id:               AureDB.generateId('prop'),
      slug:             AureDB.slugify(u.title),
      title:            u.title,
      subtitle:         u.subtitle || '',
      shortDescription: u.description || '',
      description:      u.description || '',
      location:         u.location || {},
      media:            u.media || {},
      pricing:          { perNight: 0, cleaningFee: 0, currency: 'EUR', minimumStay: 1 },
      capacity:         { guests: 0, bedrooms: 0, beds: 0, bathrooms: 0 },
      amenities: [], rules: [], badges: [],
      checkIn: '15h00', checkOut: '11h00',
      available: true, featured: false,
      paymentLink: '', contactEmail: '', formspreeId: '',
      seo: { title: u.title + ' \u2014 AURELYS', description: '' },
      order: _properties.length
    };
    await AureDB.upsertProperty(prop);
    await AureDB.deleteUpcomingProperty(upcomingId);
    await _loadAllData();
    if (_currentPanel === 'upcoming')   await _refreshPanel('upcoming');
    if (_currentPanel === 'properties') await _refreshPanel('properties');
    showToast(`"${u.title}" mis en ligne ! Pensez à compléter le prix et les détails.`);
    _notifySubscribers('property_online', prop);
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

async function deleteProperty(id) {
  if (!confirm('Supprimer ce logement d\u00e9finitivement\u00a0? Cette action est irr\u00e9versible.')) return;
  try {
    await AureDB.deleteProperty(id);
    await _refreshPanel('properties');
    showToast('Logement supprim\u00e9.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

function _resetPropertyForm() {
  ['prop-title','prop-subtitle','prop-short-desc','prop-description',
   'prop-city','prop-country','prop-address','prop-area','prop-lat','prop-lng',
   'prop-price','prop-cleaning-fee','prop-min-stay',
   'prop-guests','prop-bedrooms','prop-beds','prop-bathrooms',
   'prop-checkin','prop-checkout','prop-cover','prop-gallery',
   'prop-amenities','prop-rules','prop-badges',
   'prop-payment-link','prop-contact-email','prop-formspree',
   'prop-seo-title','prop-seo-desc'].forEach(id => _setField(id, ''));
  _setField('prop-currency', 'EUR');
  _setCheckbox('prop-available', true);
  _setCheckbox('prop-featured', false);
}

/* ── Logements à venir ──────────────────────────────────────── */
function _renderUpcoming() {
  const list = document.getElementById('upcoming-list');
  if (!list) return;
  if (_upcoming.length === 0) { list.innerHTML = _emptyState('Aucun logement \u00e0 venir programm\u00e9.'); return; }
  list.innerHTML = _upcoming.map(u => `
    <div class="prop-item">
      <img class="prop-item-img" src="${_esc(u.media?.coverImage || '')}" alt="${_esc(u.title || '')}"
        onerror="this.src='https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=200&q=60'">
      <div class="prop-item-info">
        <p class="prop-item-name">${_esc(u.title || 'Sans titre')}</p>
        <div class="prop-item-meta">
          <span>${_esc(u.location?.city || '')}${u.location?.country ? ', ' + _esc(u.location.country) : ''}</span>
          <span>${_formatExpDate(u.expectedDate)}</span>
        </div>
      </div>
      <div class="prop-item-actions">
        <button class="btn btn-success btn-sm" onclick="promoteToProperty('${u.id}')" title="Publier comme logement disponible">↑ Mettre en ligne</button>
        <button class="btn btn-secondary btn-sm" onclick="editUpcoming('${u.id}')">Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUpcoming('${u.id}')">Supprimer</button>
      </div>
    </div>`).join('');
}

function openAddUpcoming() {
  _editingUpcomId = null;
  ['upcoming-title','upcoming-subtitle','upcoming-city','upcoming-country',
   'upcoming-lat','upcoming-lng','upcoming-date','upcoming-description','upcoming-image']
    .forEach(id => _setField(id, ''));
  document.getElementById('upcoming-modal-title').textContent = 'Ajouter un logement \u00e0 venir';
  _openModal('upcoming-modal');
}

function editUpcoming(id) {
  _editingUpcomId = id;
  const u = _upcoming.find(x => x.id === id);
  if (!u) return;
  _setField('upcoming-title',       u.title || '');
  _setField('upcoming-subtitle',    u.subtitle || '');
  _setField('upcoming-city',        u.location?.city    || '');
  _setField('upcoming-country',     u.location?.country || '');
  _setField('upcoming-lat',         u.location?.lat     ?? '');
  _setField('upcoming-lng',         u.location?.lng     ?? '');
  _setField('upcoming-date',        u.expectedDate || '');
  _setField('upcoming-description', u.description  || '');
  _setField('upcoming-image',       u.media?.coverImage || '');
  document.getElementById('upcoming-modal-title').textContent = 'Modifier le logement \u00e0 venir';
  _openModal('upcoming-modal');
}

async function saveUpcoming() {
  const title = _getField('upcoming-title').trim();
  if (!title) { showToast('Le titre est requis.', 'error'); return; }
  const latRaw = _getField('upcoming-lat');
  const lngRaw = _getField('upcoming-lng');
  const item = {
    id:          _editingUpcomId || AureDB.generateId('upcoming'),
    slug:        AureDB.slugify(title),
    title,
    subtitle:    _getField('upcoming-subtitle'),
    description: _getField('upcoming-description'),
    location: {
      city:    _getField('upcoming-city'), country: _getField('upcoming-country'),
      lat: latRaw !== '' ? parseFloat(latRaw) : null,
      lng: lngRaw !== '' ? parseFloat(lngRaw) : null
    },
    expectedDate: _getField('upcoming-date'),
    media: { coverImage: _getField('upcoming-image') },
    order: _editingUpcomId
      ? (_upcoming.find(x => x.id === _editingUpcomId)?.order ?? _upcoming.length)
      : _upcoming.length
  };
  try {
    await AureDB.upsertUpcomingProperty(item);
    _closeModal('upcoming-modal');
    await _refreshPanel('upcoming');
    const isNew = !_editingUpcomId;
    showToast(isNew ? 'Logement \u00e0 venir ajout\u00e9.' : 'Logement \u00e0 venir mis \u00e0 jour.');
    if (isNew) _notifySubscribers('upcoming_added', item);
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

async function deleteUpcoming(id) {
  if (!confirm('Supprimer ce logement \u00e0 venir\u00a0?')) return;
  try {
    await AureDB.deleteUpcomingProperty(id);
    await _refreshPanel('upcoming');
    showToast('Supprim\u00e9.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── Textes du site ─────────────────────────────────────────── */
function _renderTextsForm() {
  if (!_settings) {
    // Données pas encore chargées — réessayer dans 1.5 s
    setTimeout(() => { if (_currentPanel === 'texts') _renderTextsForm(); }, 1500);
    return;
  }
  const g = _settings.global || {};
  const h = (_settings.home || {}).hero || {};
  const e = (_settings.home || {}).editorial || {};
  const n = (_settings.home || {}).newsletter || {};
  _setField('text-tagline',               g.tagline);
  _setField('text-hero-title',            h.title);
  _setField('text-hero-subtitle',         h.subtitle);
  _setField('text-hero-image',            h.heroImage || '');
  _setField('text-hero-image-secondary',  h.heroImageSecondary || '');
  _setField('text-about-title',           e.title);
  _setField('text-about-body',            e.body);
  _setField('text-about-image',           e.image || '');
  _setField('text-newsletter-title',      n.title);
  _setField('text-newsletter-text',       n.body);
  _setField('text-contact-email',         g.contactEmail);
  _setField('text-phone',                 g.contactPhone);
  _setField('text-address',               g.address);
  _setField('text-formspree',             g.globalFormspreeId);
  _setField('text-instagram',             g.instagramUrl);
  _setField('text-linkedin',              g.linkedinUrl);
  _updateHeroImgPreview(h.heroImage || '');
  const imgInput = document.getElementById('text-hero-image');
  if (imgInput && !imgInput._previewBound) {
    imgInput._previewBound = true;
    imgInput.addEventListener('input', () => _updateHeroImgPreview(imgInput.value));
  }
}

async function saveTexts() {
  if (!_settings) {
    showToast('Données non chargées — rechargez la page avant de sauvegarder.', 'error');
    return;
  }
  if (!_settings.global)           _settings.global = {};
  if (!_settings.home)             _settings.home = {};
  if (!_settings.home.hero)        _settings.home.hero = {};
  if (!_settings.home.editorial)   _settings.home.editorial = {};
  if (!_settings.home.newsletter)  _settings.home.newsletter = {};
  const g = _settings.global;
  const h = _settings.home.hero;
  const e = _settings.home.editorial;
  const n = _settings.home.newsletter;
  g.tagline             = _getField('text-tagline');
  h.title               = _getField('text-hero-title');
  h.subtitle            = _getField('text-hero-subtitle');
  h.heroImage           = _getField('text-hero-image');
  h.heroImageSecondary  = _getField('text-hero-image-secondary');
  e.title               = _getField('text-about-title');
  e.body                = _getField('text-about-body');
  e.image               = _getField('text-about-image');
  n.title               = _getField('text-newsletter-title');
  n.body                = _getField('text-newsletter-text');
  g.contactEmail        = _getField('text-contact-email');
  g.contactPhone        = _getField('text-phone');
  g.address             = _getField('text-address');
  g.globalFormspreeId   = _getField('text-formspree');
  g.instagramUrl        = _getField('text-instagram');
  g.linkedinUrl         = _getField('text-linkedin');
  g.siteName            = 'AURELYS';
  g.logoText            = 'AURELYS';
  try {
    await AureDB.saveSettings(_settings);
    showToast('Textes sauvegrad\u00e9s. Visible sur le site public imm\u00e9diatement.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── Footer ─────────────────────────────────────────────────── */
function _renderFooterForm() {
  const f = _settings?.footer || {};
  _setField('footer-description', f.description || '');
  _setField('footer-copyright',   f.copyright   || '');
  const colsEl = document.getElementById('footer-cols-editor');
  if (colsEl) colsEl.value = JSON.stringify(f.columns || [], null, 2);
}

async function saveFooter() {
  if (!_settings)         _settings = {};
  if (!_settings.footer)  _settings.footer = {};
  _settings.footer.description = _getField('footer-description');
  _settings.footer.copyright   = _getField('footer-copyright');
  try {
    const raw = document.getElementById('footer-cols-editor')?.value || '[]';
    _settings.footer.columns = JSON.parse(raw);
  } catch {
    showToast('Format JSON des colonnes invalide.', 'error');
    return;
  }
  try {
    await AureDB.saveSettings(_settings);
    showToast('Footer sauvegrad\u00e9.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── Pages légales ──────────────────────────────────────────── */
function _renderLegal() { _switchLegalTab(_currentLegalTab); }

function _switchLegalTab(tab) {
  _currentLegalTab = tab;
  document.querySelectorAll('.legal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
    t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
  });
  const editor = document.getElementById('legal-editor');
  if (editor) editor.value = _legalPages[tab] || '';
}

async function saveLegal() {
  const content = document.getElementById('legal-editor')?.value || '';
  try {
    await AureDB.saveLegalPage(_currentLegalTab, content);
    _legalPages[_currentLegalTab] = content;
    showToast('Page l\u00e9gale sauvegrad\u00e9e.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── FAQ ────────────────────────────────────────────────────── */
function _renderFaq() {
  const list = document.getElementById('faq-list-admin');
  if (!list) return;
  if (_faqItems.length === 0) { list.innerHTML = _emptyState('Aucune question pour le moment.'); return; }
  list.innerHTML = [..._faqItems]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(item => `
      <div class="prop-item">
        <div class="prop-item-info" style="flex:1;">
          <p class="prop-item-name">${_esc(item.question)}</p>
          <p class="prop-item-meta" style="margin-top:4px;white-space:normal;">
            ${_esc(item.answer.slice(0, 120))}${item.answer.length > 120 ? '\u2026' : ''}</p>
        </div>
        <div class="prop-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="editFaq('${item.id}')">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteFaq('${item.id}')">Supprimer</button>
        </div>
      </div>`).join('');
}

function openAddFaq() {
  _editingFaqId = null;
  _setField('faq-question', '');
  _setField('faq-answer',   '');
  document.getElementById('faq-modal-title').textContent = 'Ajouter une question';
  _openModal('faq-modal');
}

function editFaq(id) {
  _editingFaqId = id;
  const item = _faqItems.find(x => x.id === id);
  if (!item) return;
  _setField('faq-question', item.question);
  _setField('faq-answer',   item.answer);
  document.getElementById('faq-modal-title').textContent = 'Modifier la question';
  _openModal('faq-modal');
}

async function saveFaq() {
  const question = _getField('faq-question').trim();
  const answer   = _getField('faq-answer').trim();
  if (!question || !answer) { showToast('Question et r\u00e9ponse requises.', 'error'); return; }
  const item = {
    id:       _editingFaqId || AureDB.generateId('faq'),
    question, answer,
    order: _editingFaqId
      ? (_faqItems.find(x => x.id === _editingFaqId)?.order ?? _faqItems.length)
      : _faqItems.length
  };
  try {
    await AureDB.upsertFaqItem(item);
    _closeModal('faq-modal');
    await _refreshPanel('faq');
    showToast(_editingFaqId ? 'Question mise \u00e0 jour.' : 'Question ajout\u00e9e.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

async function deleteFaq(id) {
  if (!confirm('Supprimer cette question\u00a0?')) return;
  try {
    await AureDB.deleteFaqItem(id);
    await _refreshPanel('faq');
    showToast('Question supprim\u00e9e.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── Liens de paiement ──────────────────────────────────────── */
function _renderPaymentLinks() {
  const container = document.getElementById('payment-links-list');
  if (!container) return;
  if (_properties.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Aucun logement cr\u00e9\u00e9.</p>';
    return;
  }
  container.innerHTML = _properties.map(p => `
    <div class="payment-item">
      <div class="payment-item-header">
        <img class="payment-item-img" src="${_esc(p.media?.coverImage || '')}" alt=""
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=100&q=60'">
        <div>
          <p class="payment-item-name">${_esc(p.title || 'Sans titre')}</p>
          <p class="payment-item-location">${_esc(p.location?.city || '')}${p.location?.country ? ', ' + _esc(p.location.country) : ''}</p>
        </div>
      </div>
      <div class="field" style="margin-bottom:8px;">
        <label class="field-label">Lien de paiement Stripe (ou autre)</label>
        <input class="field-input" type="url" placeholder="https://buy.stripe.com/..."
          value="${_esc(p.paymentLink || '')}" id="pay-link-${p.id}">
      </div>
      <div class="field" style="margin-bottom:0;">
        <label class="field-label">Email de contact pour ce logement</label>
        <input class="field-input" type="email" placeholder="contact@aurelyscollection.com"
          value="${_esc(p.contactEmail || '')}" id="pay-email-${p.id}">
      </div>
    </div>`).join('');
}

async function savePaymentLinks() {
  const updates = _properties.map(p => {
    const linkEl  = document.getElementById('pay-link-' + p.id);
    const emailEl = document.getElementById('pay-email-' + p.id);
    return { ...p,
      paymentLink:  linkEl  ? linkEl.value.trim()  : p.paymentLink,
      contactEmail: emailEl ? emailEl.value.trim() : p.contactEmail
    };
  });
  try {
    await Promise.all(updates.map(p => AureDB.upsertProperty(p)));
    await _refreshPanel('payment');
    showToast('Liens de paiement sauvegrad\u00e9s.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

/* ── Newsletter ─────────────────────────────────────────────── */
function _renderNewsletter() {
  const tbody = document.getElementById('subscribers-body');
  if (!tbody) return;
  if (_subscribers.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;padding:40px;color:var(--text-muted);">Aucun abonn\u00e9 pour le moment.</td></tr>';
    _setInner('subscribers-count', '0 abonn\u00e9');
    return;
  }
  _setInner('subscribers-count', _subscribers.length + ' abonn\u00e9' + (_subscribers.length > 1 ? 's' : ''));
  tbody.innerHTML = _subscribers.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${_esc(s.email)}</td>
      <td>${_formatDate(s.subscribed_at || s.date)}</td>
      <td><button class="btn btn-danger btn-xs" onclick="deleteSubscriber('${_esc(s.id)}')">Retirer</button></td>
    </tr>`).join('');
}

async function deleteSubscriber(id) {
  if (!confirm('Retirer cet abonn\u00e9\u00a0?')) return;
  try {
    await AureDB.deleteSubscriber(id);
    await _refreshPanel('newsletter');
    showToast('Abonn\u00e9 retir\u00e9.');
  } catch (err) {
    showToast('Erreur : ' + err.message, 'error');
  }
}

function exportSubscribers() {
  if (_subscribers.length === 0) { showToast('Aucun abonn\u00e9 \u00e0 exporter.', 'error'); return; }
  const csv  = 'Email,Date\n' + _subscribers.map(s => `"${s.email}","${s.subscribed_at || s.date}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'abonnes-newsletter-' + new Date().toISOString().slice(0, 10) + '.csv'; a.click();
  URL.revokeObjectURL(url);
  showToast('Export CSV t\u00e9l\u00e9charg\u00e9.');
}

/* ── Réservations ───────────────────────────────────────────── */
let _showAllReservations = false;

function toggleCancelledReservations() {
  _showAllReservations = !_showAllReservations;
  const btn = document.getElementById('toggle-cancelled-btn');
  if (btn) btn.textContent = _showAllReservations ? 'Masquer les annulées' : 'Voir les annulées';
  _renderReservations();
}

function _renderReservations() {
  const tbody = document.getElementById('reservations-body');
  if (!tbody) return;

  const visible = _showAllReservations
    ? _reservations
    : _reservations.filter(r => r.status !== 'cancelled');

  const cancelledCount = _reservations.filter(r => r.status === 'cancelled').length;
  const btn = document.getElementById('toggle-cancelled-btn');
  if (btn) {
    btn.textContent = _showAllReservations
      ? 'Masquer les annulées'
      : `Voir les annulées (${cancelledCount})`;
    btn.style.display = cancelledCount > 0 ? '' : 'none';
  }

  if (visible.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:40px;color:var(--text-muted);">${_reservations.length === 0 ? 'Aucune r\u00e9servation pour le moment.' : 'Aucune r\u00e9servation active. Cliquez sur "Voir les annul\u00e9es" pour les afficher.'}</td></tr>`;
    return;
  }
  tbody.innerHTML = visible.map(r => {
    const labels        = { pending: 'En attente', confirmed: 'Confirm\u00e9e', cancelled: 'Annul\u00e9e' };
    const classes       = { pending: 'badge-pending', confirmed: 'badge-available', cancelled: 'badge-unavailable' };
    const payLabels     = { unpaid: 'Non pay\u00e9', paid: 'Pay\u00e9', refunded: 'Rembours\u00e9' };
    const payClasses    = { unpaid: 'badge-pending', paid: 'badge-available', refunded: 'badge-unavailable' };
    const currency      = r.currency || 'EUR';
    const totalFmt      = r.total_price
      ? new Intl.NumberFormat('fr-FR', { style: 'currency', currency, minimumFractionDigits: 0 }).format(r.total_price)
      : '—';
    return `<tr>
      <td>${_formatDate(r.created_at)}</td>
      <td>${_esc(r.property_title || '')}</td>
      <td>${_esc(r.guest_name || '')}<br><small style="color:var(--text-muted)">${_esc(r.guest_email || '')}</small>${r.guest_phone ? `<br><small style="color:var(--text-muted)">${_esc(r.guest_phone)}</small>` : ''}</td>
      <td>${_esc(r.check_in || '')} \u2192 ${_esc(r.check_out || '')}<br><small style="color:var(--text-muted)">${r.nights || ''} nuit${r.nights > 1 ? 's' : ''} \u00b7 ${r.guests || 1} voyageur${(r.guests || 1) > 1 ? 's' : ''}</small></td>
      <td style="font-weight:600">${totalFmt}</td>
      <td><span class="badge ${payClasses[r.payment_status] || ''}">${payLabels[r.payment_status] || r.payment_status || '—'}</span></td>
      <td><span class="badge ${classes[r.status] || ''}">${labels[r.status] || r.status}</span></td>
      <td>
        ${r.status !== 'confirmed' ? `<button class="btn btn-secondary btn-xs" onclick="confirmReservation('${r.id}')">Confirmer</button> ` : ''}
        ${r.status !== 'cancelled' ? `<button class="btn btn-danger btn-xs" onclick="cancelReservation('${r.id}')">Annuler</button>` : ''}
      </td>
    </tr>`;
  }).join('');
}

async function confirmReservation(id) {
  try {
    const reservation = _reservations.find(r => r.id === id);
    await AureDB.updateReservationStatus(id, 'confirmed');

    // Bloquer les dates dès la confirmation manuelle
    if (reservation && reservation.property_id && reservation.check_in && reservation.check_out) {
      await AureDB.blockReservationDates(
        reservation.property_id,
        reservation.check_in,
        reservation.check_out,
        id
      );
    }

    await _refreshPanel('reservations');
    showToast('R\u00e9servation confirm\u00e9e. Dates bloqu\u00e9es.');
  } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

async function cancelReservation(id) {
  if (!confirm('Annuler cette r\u00e9servation\u00a0?')) return;
  try {
    await AureDB.updateReservationStatus(id, 'cancelled');
    await _refreshPanel('reservations');
    showToast('R\u00e9servation annul\u00e9e.');
  } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

/* ── Disponibilité ──────────────────────────────────────────── */
function _renderAvailability() {
  const propSel = document.getElementById('avail-property-select');
  if (!propSel) return;
  propSel.innerHTML = '<option value="">S\u00e9lectionner un logement</option>' +
    _properties.map(p => `<option value="${_esc(p.id)}">${_esc(p.title)}</option>`).join('');
}

async function loadAvailabilityForProperty(propId) {
  if (!propId) return;
  try {
    const blocked = await AureDB.getAvailabilityBlocks(propId);
    const list    = document.getElementById('blocked-dates-list');
    if (!list) return;
    if (blocked.length === 0) {
      list.innerHTML = '<p style="color:var(--text-muted);font-size:13px;">Aucune date bloqu\u00e9e.</p>';
      return;
    }
    list.innerHTML = blocked.sort().map(date => `
      <div class="blocked-date-item">
        <span>${date}</span>
        <button class="btn btn-danger btn-xs" onclick="unblockDate('${_esc(propId)}','${date}')">D\u00e9bloquer</button>
      </div>`).join('');
  } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

async function blockDate() {
  const propId = _getField('avail-property-select');
  const date   = _getField('avail-date-input');
  const note   = _getField('avail-note-input');
  if (!propId) { showToast('S\u00e9lectionnez un logement.', 'error'); return; }
  if (!date)   { showToast('Saisissez une date.', 'error'); return; }
  try {
    await AureDB.createAvailabilityBlock(propId, date, note);
    await loadAvailabilityForProperty(propId);
    _setField('avail-date-input', ''); _setField('avail-note-input', '');
    showToast('Date bloqu\u00e9e.');
  } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

async function unblockDate(propId, date) {
  try {
    await AureDB.deleteAvailabilityBlock(propId, date);
    await loadAvailabilityForProperty(propId);
    showToast('Date d\u00e9bloqu\u00e9e.');
  } catch (err) { showToast('Erreur : ' + err.message, 'error'); }
}

/* ── Paramètres ─────────────────────────────────────────────── */
function _renderSettings() {
  const configured = AureDB.isConfigured();
  _setInner('settings-supabase-status',
    configured ? 'Supabase configur\u00e9 et connect\u00e9.' : 'Supabase non configur\u00e9. Remplissez js/config.js.');
  const statusEl = document.getElementById('settings-supabase-status');
  if (statusEl) statusEl.style.color = configured ? 'var(--success)' : 'var(--danger)';
}

async function exportBackup() {
  const backup = {
    exportedAt: new Date().toISOString(),
    properties: _properties, upcoming: _upcoming,
    settings:   _settings,  legalPages: _legalPages, faqItems: _faqItems
  };
  const json = JSON.stringify(backup, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'aurelys-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click();
  URL.revokeObjectURL(url);
  showToast('Backup export\u00e9.');
}

/* ── Aperçu image hero ──────────────────────────────────────── */
function _updateHeroImgPreview(url) {
  const wrap = document.getElementById('hero-img-preview-wrap');
  const img  = document.getElementById('hero-img-preview');
  if (!wrap || !img) return;
  if (url && url.startsWith('http')) { img.src = url; wrap.style.display = ''; }
  else { wrap.style.display = 'none'; }
}

/* ── Modals ─────────────────────────────────────────────────── */
function _openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function _closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('admin-modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

/* ── Toasts ─────────────────────────────────────────────────── */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = 'toast toast-' + type;
  toast.innerHTML = '<span>' + (type === 'success' ? '\u2713' : '\u2715') + '</span> ' + _esc(message);
  container.appendChild(toast);
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));
  setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 4000);
}

/* ── Utilitaires DOM ────────────────────────────────────────── */
function _setInner(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
function _setField(id, val) {
  const el = document.getElementById(id); if (!el) return;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') el.value = val ?? '';
}
function _getField(id) { const el = document.getElementById(id); return el ? el.value : ''; }
function _setCheckbox(id, val) { const el = document.getElementById(id); if (el) el.checked = !!val; }
function _getCheckbox(id) { const el = document.getElementById(id); return el ? el.checked : false; }
function _emptyState(text) {
  return `<div class="empty-state"><p class="empty-state-mark">\u2014</p><p class="empty-state-text">${text}</p></div>`;
}
function _formatDate(dateStr) {
  if (!dateStr) return '\u2014';
  try { return new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); }
  catch { return dateStr; }
}
function _formatExpDate(dateStr) {
  if (!dateStr) return 'Bient\u00f4t';
  try {
    const [y, m] = dateStr.split('-');
    return new Date(parseInt(y), parseInt(m || 1) - 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch { return dateStr; }
}
function _esc(str) {
  return String(str ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ── Exposition globale ─────────────────────────────────────── */
window.loadPanel                    = loadPanel;
window.logout                       = logout;
window.openAddProperty              = openAddProperty;
window.editProperty                 = editProperty;
window.saveProperty                 = saveProperty;
window.deleteProperty               = deleteProperty;
window.openAddUpcoming              = openAddUpcoming;
window.editUpcoming                 = editUpcoming;
window.saveUpcoming                 = saveUpcoming;
window.deleteUpcoming               = deleteUpcoming;
window.saveTexts                    = saveTexts;
window.saveFooter                   = saveFooter;
window.switchLegalTab               = _switchLegalTab;
window.saveLegal                    = saveLegal;
window.openAddFaq                   = openAddFaq;
window.editFaq                      = editFaq;
window.saveFaq                      = saveFaq;
window.deleteFaq                    = deleteFaq;
window.savePaymentLinks             = savePaymentLinks;
window.exportSubscribers            = exportSubscribers;
window.deleteSubscriber             = deleteSubscriber;
window.testNewsletterSend           = testNewsletterSend;
window.confirmReservation           = confirmReservation;
window.cancelReservation            = cancelReservation;
window.toggleCancelledReservations  = toggleCancelledReservations;
window.setFeaturedProperty          = setFeaturedProperty;
window.loadAvailabilityForProperty  = loadAvailabilityForProperty;
window.blockDate                    = blockDate;
window.unblockDate                  = unblockDate;
window.exportBackup                 = exportBackup;
window.closeModal                   = _closeModal;
