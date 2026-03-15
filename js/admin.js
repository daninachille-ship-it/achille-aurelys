/**
 * admin.js — Panel d'administration AURELYS
 * Gestion complète du contenu via localStorage (schéma v2)
 */

// ── État global ─────────────────────────────────────────────── //
let adminData = null;
let currentPanel = 'dashboard';
let editingPropId = null;
let editingUpcomingId = null;
let currentLegalTab = 'cgv';

// ── Initialisation ───────────────────────────────────────────── //
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('admin-login').style.display = 'flex';

  const loginForm = document.getElementById('login-form');
  if (loginForm) loginForm.addEventListener('submit', handleLogin);

  if (sessionStorage.getItem('admin_auth') === 'true') {
    showAdminApp();
  }
});

// ── Connexion ────────────────────────────────────────────────── //
function handleLogin(e) {
  e.preventDefault();
  const pwd = document.getElementById('admin-password')?.value?.trim();
  const data = Storage.getData();
  const error = document.getElementById('login-error');
  const stored = data.content && data.content.global && data.content.global.adminPassword;

  if (pwd === stored) {
    sessionStorage.setItem('admin_auth', 'true');
    if (error) error.classList.remove('show');
    showAdminApp();
  } else {
    if (error) error.classList.add('show');
    document.getElementById('admin-password').value = '';
    document.getElementById('admin-password').focus();
  }
}

function logout() {
  sessionStorage.removeItem('admin_auth');
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('admin-login').style.display = 'flex';
  document.getElementById('admin-password').value = '';
}

// ── Afficher l'interface admin ───────────────────────────────── //
function showAdminApp() {
  adminData = Storage.getData();
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';
  document.getElementById('admin-app').classList.add('visible');
  loadPanel('dashboard');
}

// ── Navigation ───────────────────────────────────────────────── //
function loadPanel(name) {
  currentPanel = name;

  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.panel === name);
    if (item.dataset.panel === name) item.setAttribute('aria-current', 'page');
    else item.removeAttribute('aria-current');
  });

  const titles = {
    dashboard:    'Tableau de bord',
    properties:   'Logements',
    upcoming:     'Logements à venir',
    texts:        'Textes du site',
    legal:        'Pages légales',
    payment:      'Liens de paiement',
    newsletter:   'Newsletter',
    reservations: 'Réservations',
    settings:     'Paramètres'
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[name] || name;

  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

  const panel = document.getElementById(`panel-${name}`);
  if (panel) {
    panel.classList.add('active');
    refreshPanel(name);
  }
}

function refreshPanel(name) {
  adminData = Storage.getData();
  switch (name) {
    case 'dashboard':    renderDashboard(); break;
    case 'properties':   renderPropertiesAdmin(); break;
    case 'upcoming':     renderUpcomingAdmin(); break;
    case 'texts':        renderTextsForm(); break;
    case 'legal':        renderLegalEditor(); break;
    case 'payment':      renderPaymentLinks(); break;
    case 'newsletter':   renderNewsletter(); break;
    case 'reservations': renderReservations(); break;
    case 'settings':     renderSettings(); break;
  }
}

// ── Dashboard ────────────────────────────────────────────────── //
function renderDashboard() {
  const d = adminData;
  setInner('stat-properties', d.properties.filter(p => p.available).length);
  setInner('stat-upcoming', d.upcomingProperties.length);
  setInner('stat-subscribers', d.subscribers.length);
  setInner('stat-reservations', d.reservations.length);
}

// ── Logements ────────────────────────────────────────────────── //
function renderPropertiesAdmin() {
  const list = document.getElementById('properties-list');
  if (!list) return;

  const props = adminData.properties;
  if (props.length === 0) {
    list.innerHTML = emptyState('Aucun logement. Cliquez sur "Ajouter" pour commencer.');
    return;
  }

  list.innerHTML = props
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(p => propItemHTML(p))
    .join('');
}

function propItemHTML(p) {
  const city    = p.location?.city    || '';
  const country = p.location?.country || '';
  const price   = p.pricing?.perNight || 0;
  const currency = p.pricing?.currency || 'EUR';
  const cover   = p.media?.coverImage || '';
  const lat     = p.location?.lat;
  const lng     = p.location?.lng;
  const hasCoords = lat != null && lng != null;

  return `
    <div class="prop-item" id="prop-item-${p.id}">
      <img class="prop-item-img" src="${esc(cover)}" alt="${esc(p.title || '')}"
        onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=200&q=60'">
      <div class="prop-item-info">
        <p class="prop-item-name">${esc(p.title || 'Sans titre')}</p>
        <div class="prop-item-meta">
          <span>${esc(city)}${country ? ', ' + esc(country) : ''}</span>
          <span class="prop-item-price">${price} ${esc(currency)} / nuit</span>
          ${hasCoords
            ? `<span class="prop-item-coords">${lat.toFixed(4)}, ${lng.toFixed(4)}</span>`
            : '<span class="prop-item-coords" style="color:var(--danger-dim)">Pas de coordonnées GPS</span>'}
          <span class="badge ${p.available ? 'badge-available' : 'badge-unavailable'}">
            ${p.available ? 'Disponible' : 'Indisponible'}
          </span>
        </div>
      </div>
      <div class="prop-item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editProperty('${p.id}')">Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="deleteProperty('${p.id}')">Supprimer</button>
      </div>
    </div>`;
}

function openAddProperty() {
  editingPropId = null;
  resetPropertyForm();
  document.getElementById('prop-modal-title').textContent = 'Ajouter un logement';
  openModal('prop-modal');
}

function editProperty(id) {
  editingPropId = id;
  const p = adminData.properties.find(x => x.id === id);
  if (!p) return;

  // Infos de base
  setField('prop-title',       p.title || '');
  setField('prop-subtitle',    p.subtitle || '');
  setField('prop-description', p.description || '');

  // Localisation
  setField('prop-city',    p.location?.city    || '');
  setField('prop-country', p.location?.country || '');
  setField('prop-address', p.location?.address || '');
  setField('prop-area',    p.location?.area    || '');
  setField('prop-lat',     p.location?.lat     ?? '');
  setField('prop-lng',     p.location?.lng     ?? '');

  // Prix & capacité
  setField('prop-price',        p.pricing?.perNight     ?? '');
  setField('prop-cleaning-fee', p.pricing?.cleaningFee  ?? '');
  setField('prop-currency',     p.pricing?.currency     || 'EUR');
  setField('prop-min-stay',     p.pricing?.minimumStay  ?? '');
  setField('prop-guests',       p.capacity?.guests      ?? '');
  setField('prop-bedrooms',     p.capacity?.bedrooms    ?? '');
  setField('prop-beds',         p.capacity?.beds        ?? '');
  setField('prop-bathrooms',    p.capacity?.bathrooms   ?? '');
  setField('prop-checkin',      p.checkIn   || '');
  setField('prop-checkout',     p.checkOut  || '');

  // Médias
  setField('prop-cover',   p.media?.coverImage  || '');
  setField('prop-gallery', (p.media?.gallery || []).join('\n'));

  // Équipements & règles
  setField('prop-amenities', (p.amenities || []).join('\n'));
  setField('prop-rules',     (p.rules     || []).join('\n'));

  // Réservation
  setField('prop-payment-link',   p.paymentLink   || '');
  setField('prop-contact-email',  p.contactEmail  || '');
  setField('prop-formspree',      p.formspreeId   || '');

  // Options
  setCheckbox('prop-available', p.available !== false);
  setCheckbox('prop-featured',  !!p.featured);

  document.getElementById('prop-modal-title').textContent = 'Modifier le logement';
  openModal('prop-modal');
}

function saveProperty() {
  const title = getField('prop-title').trim();
  const city  = getField('prop-city').trim();
  if (!title) { showToast('Le titre est requis.', 'error'); return; }
  if (!city)  { showToast('La ville est requise.', 'error'); return; }

  const latRaw = getField('prop-lat');
  const lngRaw = getField('prop-lng');

  const prop = {
    id:          editingPropId || Storage.generateId('prop'),
    slug:        Storage.slugify(title),
    title,
    subtitle:    getField('prop-subtitle'),
    description: getField('prop-description'),
    shortDescription: '',
    location: {
      city,
      country:  getField('prop-country'),
      address:  getField('prop-address'),
      area:     getField('prop-area'),
      lat:      latRaw !== '' ? parseFloat(latRaw) : null,
      lng:      lngRaw !== '' ? parseFloat(lngRaw) : null
    },
    pricing: {
      perNight:    parseFloat(getField('prop-price'))        || 0,
      cleaningFee: parseFloat(getField('prop-cleaning-fee')) || 0,
      currency:    getField('prop-currency') || 'EUR',
      minimumStay: parseInt(getField('prop-min-stay'))       || 1
    },
    capacity: {
      guests:    parseInt(getField('prop-guests'))    || 0,
      bedrooms:  parseInt(getField('prop-bedrooms'))  || 0,
      beds:      parseInt(getField('prop-beds'))      || 0,
      bathrooms: parseInt(getField('prop-bathrooms')) || 0
    },
    media: {
      coverImage: getField('prop-cover'),
      gallery: getField('prop-gallery').split('\n').map(s => s.trim()).filter(Boolean)
    },
    amenities:  getField('prop-amenities').split('\n').map(s => s.trim()).filter(Boolean),
    rules:      getField('prop-rules').split('\n').map(s => s.trim()).filter(Boolean),
    checkIn:    getField('prop-checkin')  || '15h00',
    checkOut:   getField('prop-checkout') || '11h00',
    badges:     [],
    featured:   getCheckbox('prop-featured'),
    upcoming:   false,
    available:  getCheckbox('prop-available'),
    paymentLink:   getField('prop-payment-link'),
    contactEmail:  getField('prop-contact-email'),
    formspreeId:   getField('prop-formspree'),
    seo: { title: `${title} — AURELYS`, description: '' },
    blockedDates: [],
    order: 0
  };

  if (editingPropId) {
    const idx = adminData.properties.findIndex(x => x.id === editingPropId);
    if (idx !== -1) {
      prop.order = adminData.properties[idx].order;
      prop.blockedDates = adminData.properties[idx].blockedDates || [];
      prop.seo = adminData.properties[idx].seo || prop.seo;
      adminData.properties[idx] = prop;
    }
  } else {
    prop.order = adminData.properties.length;
    adminData.properties.push(prop);
  }

  Storage.saveData(adminData);
  closeModal('prop-modal');
  renderPropertiesAdmin();
  showToast(editingPropId ? 'Logement mis à jour.' : 'Logement ajouté.');
}

function deleteProperty(id) {
  if (!confirm('Supprimer ce logement définitivement ?')) return;
  adminData.properties = adminData.properties.filter(p => p.id !== id);
  Storage.saveData(adminData);
  renderPropertiesAdmin();
  showToast('Logement supprimé.');
}

function resetPropertyForm() {
  [
    'prop-title','prop-subtitle','prop-description',
    'prop-city','prop-country','prop-address','prop-area','prop-lat','prop-lng',
    'prop-price','prop-cleaning-fee','prop-min-stay',
    'prop-guests','prop-bedrooms','prop-beds','prop-bathrooms',
    'prop-checkin','prop-checkout',
    'prop-cover','prop-gallery',
    'prop-amenities','prop-rules',
    'prop-payment-link','prop-contact-email','prop-formspree'
  ].forEach(id => setField(id, ''));
  setField('prop-currency', 'EUR');
  setCheckbox('prop-available', true);
  setCheckbox('prop-featured', false);
}

// ── Logements à venir ────────────────────────────────────────── //
function renderUpcomingAdmin() {
  const list = document.getElementById('upcoming-list');
  if (!list) return;

  const items = adminData.upcomingProperties;
  if (items.length === 0) {
    list.innerHTML = emptyState('Aucun logement à venir programmé.');
    return;
  }

  list.innerHTML = items.map(u => {
    const city    = u.location?.city    || '';
    const country = u.location?.country || '';
    const cover   = u.media?.coverImage || '';
    return `
      <div class="prop-item">
        <img class="prop-item-img" src="${esc(cover)}" alt="${esc(u.title || '')}"
          onerror="this.src='https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=200&q=60'">
        <div class="prop-item-info">
          <p class="prop-item-name">${esc(u.title || 'Sans titre')}</p>
          <div class="prop-item-meta">
            <span>${esc(city)}${country ? ', ' + esc(country) : ''}</span>
            <span>${formatExpectedDate(u.expectedDate)}</span>
          </div>
        </div>
        <div class="prop-item-actions">
          <button class="btn btn-secondary btn-sm" onclick="editUpcoming('${u.id}')">Modifier</button>
          <button class="btn btn-danger btn-sm" onclick="deleteUpcoming('${u.id}')">Supprimer</button>
        </div>
      </div>`;
  }).join('');
}

function openAddUpcoming() {
  editingUpcomingId = null;
  ['upcoming-title','upcoming-subtitle','upcoming-city','upcoming-country',
   'upcoming-lat','upcoming-lng','upcoming-date','upcoming-description','upcoming-image']
    .forEach(id => setField(id, ''));
  document.getElementById('upcoming-modal-title').textContent = 'Ajouter un logement à venir';
  openModal('upcoming-modal');
}

function editUpcoming(id) {
  editingUpcomingId = id;
  const u = adminData.upcomingProperties.find(x => x.id === id);
  if (!u) return;

  setField('upcoming-title',       u.title || '');
  setField('upcoming-subtitle',    u.subtitle || '');
  setField('upcoming-city',        u.location?.city    || '');
  setField('upcoming-country',     u.location?.country || '');
  setField('upcoming-lat',         u.location?.lat     ?? '');
  setField('upcoming-lng',         u.location?.lng     ?? '');
  setField('upcoming-date',        u.expectedDate || '');
  setField('upcoming-description', u.description  || '');
  setField('upcoming-image',       u.media?.coverImage || '');

  document.getElementById('upcoming-modal-title').textContent = 'Modifier le logement à venir';
  openModal('upcoming-modal');
}

function saveUpcoming() {
  const title = getField('upcoming-title').trim();
  const city  = getField('upcoming-city').trim();
  if (!title) { showToast('Le titre est requis.', 'error'); return; }

  const latRaw = getField('upcoming-lat');
  const lngRaw = getField('upcoming-lng');

  const item = {
    id:          editingUpcomingId || Storage.generateId('upcoming'),
    slug:        Storage.slugify(title),
    title,
    subtitle:    getField('upcoming-subtitle'),
    location: {
      city,
      country: getField('upcoming-country'),
      lat: latRaw !== '' ? parseFloat(latRaw) : null,
      lng: lngRaw !== '' ? parseFloat(lngRaw) : null
    },
    expectedDate: getField('upcoming-date'),
    description:  getField('upcoming-description'),
    media: { coverImage: getField('upcoming-image') }
  };

  if (editingUpcomingId) {
    const idx = adminData.upcomingProperties.findIndex(x => x.id === editingUpcomingId);
    if (idx !== -1) adminData.upcomingProperties[idx] = item;
  } else {
    adminData.upcomingProperties.push(item);
  }

  Storage.saveData(adminData);
  closeModal('upcoming-modal');
  renderUpcomingAdmin();
  showToast(editingUpcomingId ? 'Logement à venir mis à jour.' : 'Logement à venir ajouté.');
}

function deleteUpcoming(id) {
  if (!confirm('Supprimer ce logement à venir ?')) return;
  adminData.upcomingProperties = adminData.upcomingProperties.filter(u => u.id !== id);
  Storage.saveData(adminData);
  renderUpcomingAdmin();
  showToast('Supprimé.');
}

// ── Textes du site ────────────────────────────────────────────── //
function renderTextsForm() {
  const g = adminData.content?.global || {};
  const h = adminData.content?.home?.hero || {};
  const e = adminData.content?.home?.editorial || {};
  const n = adminData.content?.home?.newsletter || {};

  setField('text-site-name',        g.siteName);
  setField('text-tagline',          g.tagline);
  setField('text-hero-title',       h.title);
  setField('text-hero-subtitle',    h.subtitle);
  setField('text-about-title',      e.title);
  setField('text-about-body',       e.body);
  setField('text-newsletter-title', n.title);
  setField('text-newsletter-text',  n.subtitle);
  setField('text-hero-image',           h.heroImage           || '');
  setField('text-hero-image-secondary', h.heroImageSecondary  || '');
  _updateHeroImgPreview(h.heroImage || '');

  // Aperçu live quand l'URL change
  const imgInput = document.getElementById('text-hero-image');
  if (imgInput && !imgInput._previewBound) {
    imgInput._previewBound = true;
    imgInput.addEventListener('input', () => _updateHeroImgPreview(imgInput.value));
  }
  setField('text-contact-email',    g.contactEmail);
  setField('text-phone',            g.contactPhone);
  setField('text-address',          g.address);
  setField('text-formspree',        g.globalFormspreeId);
  setField('text-instagram',        g.instagramUrl);
  setField('text-linkedin',         g.linkedinUrl);
}

function saveTexts() {
  if (!adminData.content)                adminData.content = {};
  if (!adminData.content.global)         adminData.content.global = {};
  if (!adminData.content.home)           adminData.content.home = {};
  if (!adminData.content.home.hero)      adminData.content.home.hero = {};
  if (!adminData.content.home.editorial) adminData.content.home.editorial = {};
  if (!adminData.content.home.newsletter)adminData.content.home.newsletter = {};

  const g = adminData.content.global;
  const h = adminData.content.home.hero;
  const e = adminData.content.home.editorial;
  const n = adminData.content.home.newsletter;

  g.siteName          = getField('text-site-name');
  g.tagline           = getField('text-tagline');
  h.title                = getField('text-hero-title');
  h.subtitle             = getField('text-hero-subtitle');
  h.heroImage            = getField('text-hero-image');
  h.heroImageSecondary   = getField('text-hero-image-secondary');
  e.title             = getField('text-about-title');
  e.body              = getField('text-about-body');
  n.title             = getField('text-newsletter-title');
  n.subtitle          = getField('text-newsletter-text');
  g.contactEmail      = getField('text-contact-email');
  g.contactPhone      = getField('text-phone');
  g.address           = getField('text-address');
  g.globalFormspreeId = getField('text-formspree');
  g.instagramUrl      = getField('text-instagram');
  g.linkedinUrl       = getField('text-linkedin');

  Storage.saveData(adminData);
  showToast('Textes sauvegardés.');
}

// ── Pages légales ──────────────────────────────────────────────── //
function renderLegalEditor() {
  switchLegalTab(currentLegalTab);
}

function switchLegalTab(tab) {
  currentLegalTab = tab;
  document.querySelectorAll('.legal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
    t.setAttribute('aria-selected', t.dataset.tab === tab ? 'true' : 'false');
  });
  const editor = document.getElementById('legal-editor');
  if (editor) editor.value = adminData.content?.legalPages?.[tab] || '';
}

function saveLegal() {
  if (!adminData.content)             adminData.content = {};
  if (!adminData.content.legalPages)  adminData.content.legalPages = {};
  adminData.content.legalPages[currentLegalTab] = document.getElementById('legal-editor')?.value || '';
  Storage.saveData(adminData);
  showToast('Page légale sauvegardée.');
}

// ── Liens de paiement ─────────────────────────────────────────── //
function renderPaymentLinks() {
  const container = document.getElementById('payment-links-list');
  if (!container) return;

  const props = adminData.properties;
  if (props.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted); font-size:13px;">Aucun logement créé. Ajoutez des logements d'abord.</p>`;
    return;
  }

  container.innerHTML = props.map(p => `
    <div class="payment-item">
      <div class="payment-item-header">
        <img class="payment-item-img" src="${esc(p.media?.coverImage || '')}" alt=""
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=100&q=60'">
        <div>
          <p class="payment-item-name">${esc(p.title || 'Sans titre')}</p>
          <p class="payment-item-location">${esc(p.location?.city || '')}${p.location?.country ? ', ' + esc(p.location.country) : ''}</p>
        </div>
      </div>
      <div class="field" style="margin-bottom:0;">
        <label class="field-label">Lien de paiement Stripe (ou autre)</label>
        <input
          class="field-input"
          type="url"
          placeholder="https://buy.stripe.com/..."
          value="${esc(p.paymentLink || '')}"
          id="payment-link-${p.id}"
        >
      </div>
    </div>`).join('');
}

function savePaymentLinks() {
  adminData.properties.forEach(p => {
    const input = document.getElementById(`payment-link-${p.id}`);
    if (input) p.paymentLink = input.value.trim();
  });
  Storage.saveData(adminData);
  showToast('Liens de paiement sauvegardés.');
}

// ── Newsletter ────────────────────────────────────────────────── //
function renderNewsletter() {
  const tbody = document.getElementById('subscribers-body');
  if (!tbody) return;

  const subs = adminData.subscribers || [];
  if (subs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:40px; color:var(--text-muted);">Aucun abonné pour le moment.</td></tr>`;
    setInner('subscribers-count', '0 abonné');
    return;
  }

  setInner('subscribers-count', `${subs.length} abonné${subs.length > 1 ? 's' : ''}`);
  tbody.innerHTML = subs.map((s, i) => `
    <tr>
      <td>${i + 1}</td>
      <td>${esc(s.email)}</td>
      <td>${formatDate(s.date)}</td>
    </tr>`).join('');
}

function exportSubscribers() {
  const subs = adminData.subscribers || [];
  if (subs.length === 0) { showToast('Aucun abonné à exporter.', 'error'); return; }

  const csv = 'Email,Date\n' + subs.map(s => `"${s.email}","${s.date}"`).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'abonnes-newsletter.csv';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Export CSV téléchargé.');
}

// ── Réservations ──────────────────────────────────────────────── //
function renderReservations() {
  const tbody = document.getElementById('reservations-body');
  if (!tbody) return;

  const reservations = adminData.reservations || [];
  if (reservations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:40px; color:var(--text-muted);">Aucune réservation pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...reservations].reverse().map(r => `
    <tr>
      <td>${formatDate(r.createdAt)}</td>
      <td>${esc(r.propName || r.propertyTitle || '')}</td>
      <td>${esc(r.name || '')}</td>
      <td>${esc(r.email || '')}</td>
      <td>${esc(r.checkin || r.dates?.checkIn || '')} → ${esc(r.checkout || r.dates?.checkOut || '')}</td>
      <td><span class="badge badge-available">${esc(r.status || '')}</span></td>
    </tr>`).join('');
}

// ── Paramètres ────────────────────────────────────────────────── //
function renderSettings() {
  setField('settings-password', adminData.content?.global?.adminPassword || '');
}

function saveSettings() {
  const newPwd = getField('settings-password');
  if (newPwd.length < 6) { showToast('Le mot de passe doit contenir au moins 6 caractères.', 'error'); return; }
  if (!adminData.content)        adminData.content = {};
  if (!adminData.content.global) adminData.content.global = {};
  adminData.content.global.adminPassword = newPwd;
  Storage.saveData(adminData);
  showToast('Mot de passe sauvegardé.');
}

function confirmResetData() {
  if (!confirm('Réinitialiser toutes les données aux valeurs par défaut ? Cette action est irréversible.')) return;
  Storage.resetData();
  adminData = Storage.getData();
  showToast('Données réinitialisées.');
  loadPanel('dashboard');
}

// ── Aperçu image hero ─────────────────────────────────────────── //
function _updateHeroImgPreview(url) {
  const wrap = document.getElementById('hero-img-preview-wrap');
  const img  = document.getElementById('hero-img-preview');
  if (!wrap || !img) return;
  if (url && url.startsWith('http')) {
    img.src = url;
    wrap.style.display = '';
  } else {
    wrap.style.display = 'none';
  }
}

// ── Utilitaires DOM ───────────────────────────────────────────── //
function setInner(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
}

function setField(id, val) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT' || el.tagName === 'SELECT') {
    el.value = val ?? '';
  }
}

function getField(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setCheckbox(id, val) {
  const el = document.getElementById(id);
  if (el) el.checked = !!val;
}

function getCheckbox(id) {
  const el = document.getElementById(id);
  return el ? el.checked : false;
}

// ── Modals ────────────────────────────────────────────────────── //
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('admin-modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Toasts ────────────────────────────────────────────────────── //
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  const mark = type === 'success' ? '✓' : '✕';
  toast.innerHTML = `<span>${mark}</span> ${esc(message)}`;
  container.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Utilitaires ───────────────────────────────────────────────── //
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emptyState(text) {
  return `<div class="empty-state">
    <p class="empty-state-mark">—</p>
    <p class="empty-state-text">${text}</p>
  </div>`;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    return new Date(dateStr).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric'
    });
  } catch { return dateStr; }
}

function formatExpectedDate(dateStr) {
  if (!dateStr) return 'Bientôt';
  try {
    const [year, month] = dateStr.split('-');
    return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('fr-FR', {
      month: 'long', year: 'numeric'
    });
  } catch { return dateStr; }
}

// ── Export / Import ───────────────────────────────────────────── //
function exportBackup() { Storage.exportBackup(); }

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Storage.importBackup(file, (err) => {
      if (err) { showToast('Fichier invalide.', 'error'); return; }
      adminData = Storage.getData();
      showToast('Données importées avec succès.');
      loadPanel(currentPanel);
    });
  };
  input.click();
}

// ── Exposition globale ────────────────────────────────────────── //
window.loadPanel         = loadPanel;
window.openAddProperty   = openAddProperty;
window.editProperty      = editProperty;
window.saveProperty      = saveProperty;
window.deleteProperty    = deleteProperty;
window.openAddUpcoming   = openAddUpcoming;
window.editUpcoming      = editUpcoming;
window.saveUpcoming      = saveUpcoming;
window.deleteUpcoming    = deleteUpcoming;
window.saveTexts         = saveTexts;
window.switchLegalTab    = switchLegalTab;
window.saveLegal         = saveLegal;
window.savePaymentLinks  = savePaymentLinks;
window.exportSubscribers = exportSubscribers;
window.saveSettings      = saveSettings;
window.confirmResetData  = confirmResetData;
window.exportBackup      = exportBackup;
window.importBackup      = importBackup;
window.closeModal        = closeModal;
window.logout            = logout;
