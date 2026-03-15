/**
 * admin.js — Panel d'administration Achille & Aurelys
 * Gestion complète du contenu via localStorage
 */

// ── État global de l'admin ─────────────────────────────────── //
let adminData = null;
let currentPanel = 'dashboard';
let editingPropId = null;
let editingUpcomingId = null;
let currentLegalTab = 'cgv';

// ── Initialisation ─────────────────────────────────────────── //
document.addEventListener('DOMContentLoaded', () => {
  // L'admin est une page indépendante : on masque tout de suite #admin-app
  // et on montre l'écran de connexion
  document.getElementById('admin-app').style.display = 'none';
  document.getElementById('admin-login').style.display = 'flex';

  // Connexion
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', handleLogin);
  }

  // Si déjà connecté dans la session
  if (sessionStorage.getItem('admin_auth') === 'true') {
    showAdminApp();
  }
});

// ── Connexion ──────────────────────────────────────────────── //
function handleLogin(e) {
  e.preventDefault();
  const pwd = document.getElementById('admin-password')?.value?.trim();
  const data = Storage.getData();
  const error = document.getElementById('login-error');

  if (pwd === data.settings.adminPassword) {
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

// ── Afficher l'interface admin ─────────────────────────────── //
function showAdminApp() {
  adminData = Storage.getData();
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-app').style.display = 'flex';
  document.getElementById('admin-app').classList.add('visible');
  loadPanel('dashboard');
}

// ── Navigation entre panneaux ──────────────────────────────── //
function loadPanel(name) {
  currentPanel = name;

  // Mise à jour de la nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.panel === name);
  });

  // Titre de la topbar
  const titles = {
    dashboard: 'Tableau de bord',
    properties: 'Logements',
    upcoming: 'Logements à venir',
    texts: 'Textes du site',
    legal: 'Pages légales',
    payment: 'Liens de paiement',
    newsletter: 'Newsletter',
    reservations: 'Réservations',
    settings: 'Paramètres'
  };
  const topbarTitle = document.getElementById('topbar-title');
  if (topbarTitle) topbarTitle.textContent = titles[name] || name;

  // Masquer tous les panneaux
  document.querySelectorAll('.admin-panel').forEach(p => p.classList.remove('active'));

  // Afficher le bon panneau
  const panel = document.getElementById(`panel-${name}`);
  if (panel) {
    panel.classList.add('active');
    refreshPanel(name);
  }
}

function refreshPanel(name) {
  adminData = Storage.getData();
  switch (name) {
    case 'dashboard':   renderDashboard(); break;
    case 'properties':  renderPropertiesAdmin(); break;
    case 'upcoming':    renderUpcomingAdmin(); break;
    case 'texts':       renderTextsForm(); break;
    case 'legal':       renderLegalEditor(); break;
    case 'payment':     renderPaymentLinks(); break;
    case 'newsletter':  renderNewsletter(); break;
    case 'reservations':renderReservations(); break;
    case 'settings':    renderSettings(); break;
  }
}

// ── Dashboard ──────────────────────────────────────────────── //
function renderDashboard() {
  const d = adminData;
  setInner('stat-properties', d.properties.filter(p => p.available).length);
  setInner('stat-upcoming', d.upcomingProperties.length);
  setInner('stat-subscribers', d.subscribers.length);
  setInner('stat-reservations', d.reservations.length);
}

// ── Logements ─────────────────────────────────────────────── //
function renderPropertiesAdmin() {
  const list = document.getElementById('properties-list');
  if (!list) return;

  const props = adminData.properties;
  if (props.length === 0) {
    list.innerHTML = emptyState('🏠', 'Aucun logement. Cliquez sur "Ajouter" pour commencer.');
    return;
  }

  list.innerHTML = props
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(p => propItemHTML(p))
    .join('');
}

function propItemHTML(p) {
  return `
    <div class="prop-item" id="prop-item-${p.id}">
      <img class="prop-item-img" src="${esc(p.image)}" alt="${esc(p.name)}"
        onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=200&q=60'">
      <div class="prop-item-info">
        <p class="prop-item-name">${esc(p.name)}</p>
        <div class="prop-item-meta">
          <span>${esc(p.location)}</span>
          <span class="prop-item-price">${p.price}${p.currency}/${p.period}</span>
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
  const prop = adminData.properties.find(p => p.id === id);
  if (!prop) return;

  setField('prop-name', prop.name);
  setField('prop-location', prop.location);
  setField('prop-price', prop.price);
  setField('prop-currency', prop.currency);
  setField('prop-period', prop.period);
  setField('prop-description', prop.description);
  setField('prop-image', prop.image);
  setField('prop-features', (prop.features || []).join('\n'));
  setField('prop-max-guests', prop.maxGuests || '');
  setField('prop-bedrooms', prop.bedrooms || '');
  setField('prop-bathrooms', prop.bathrooms || '');
  setField('prop-area', prop.area || '');
  setField('prop-payment-link', prop.paymentLink || '');
  setCheckbox('prop-available', prop.available);

  document.getElementById('prop-modal-title').textContent = 'Modifier le logement';
  openModal('prop-modal');
}

function saveProperty() {
  const name = getField('prop-name');
  if (!name) { showToast('Le nom est requis.', 'error'); return; }

  const prop = {
    id: editingPropId || Storage.generateId('prop'),
    name,
    location: getField('prop-location'),
    price: parseFloat(getField('prop-price')) || 0,
    currency: getField('prop-currency') || '€',
    period: getField('prop-period') || 'nuit',
    description: getField('prop-description'),
    shortDescription: '',
    image: getField('prop-image'),
    available: getCheckbox('prop-available'),
    paymentLink: getField('prop-payment-link'),
    features: getField('prop-features').split('\n').map(s => s.trim()).filter(Boolean),
    maxGuests: parseInt(getField('prop-max-guests')) || 0,
    bedrooms: parseInt(getField('prop-bedrooms')) || 0,
    bathrooms: parseInt(getField('prop-bathrooms')) || 0,
    area: parseInt(getField('prop-area')) || 0,
    order: 0
  };

  if (editingPropId) {
    const idx = adminData.properties.findIndex(p => p.id === editingPropId);
    if (idx !== -1) {
      prop.order = adminData.properties[idx].order;
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
  ['prop-name','prop-location','prop-price','prop-description','prop-image',
   'prop-features','prop-max-guests','prop-bedrooms','prop-bathrooms','prop-area','prop-payment-link']
    .forEach(id => setField(id, ''));
  setField('prop-currency', '€');
  setField('prop-period', 'nuit');
  setCheckbox('prop-available', true);
}

// ── Logements à venir ──────────────────────────────────────── //
function renderUpcomingAdmin() {
  const list = document.getElementById('upcoming-list');
  if (!list) return;

  const items = adminData.upcomingProperties;
  if (items.length === 0) {
    list.innerHTML = emptyState('📅', 'Aucun logement à venir programmé.');
    return;
  }

  list.innerHTML = items.map(u => `
    <div class="prop-item">
      <img class="prop-item-img" src="${esc(u.image)}" alt="${esc(u.name)}"
        onerror="this.src='https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=200&q=60'">
      <div class="prop-item-info">
        <p class="prop-item-name">${esc(u.name)}</p>
        <div class="prop-item-meta">
          <span>${esc(u.location)}</span>
          <span>${formatExpectedDate(u.expectedDate)}</span>
        </div>
      </div>
      <div class="prop-item-actions">
        <button class="btn btn-secondary btn-sm" onclick="editUpcoming('${u.id}')">Modifier</button>
        <button class="btn btn-danger btn-sm" onclick="deleteUpcoming('${u.id}')">Supprimer</button>
      </div>
    </div>`).join('');
}

function openAddUpcoming() {
  editingUpcomingId = null;
  ['upcoming-name','upcoming-location','upcoming-date','upcoming-description','upcoming-image']
    .forEach(id => setField(id, ''));
  document.getElementById('upcoming-modal-title').textContent = 'Ajouter un logement à venir';
  openModal('upcoming-modal');
}

function editUpcoming(id) {
  editingUpcomingId = id;
  const u = adminData.upcomingProperties.find(x => x.id === id);
  if (!u) return;
  setField('upcoming-name', u.name);
  setField('upcoming-location', u.location);
  setField('upcoming-date', u.expectedDate || '');
  setField('upcoming-description', u.description);
  setField('upcoming-image', u.image);
  document.getElementById('upcoming-modal-title').textContent = 'Modifier le logement à venir';
  openModal('upcoming-modal');
}

function saveUpcoming() {
  const name = getField('upcoming-name');
  if (!name) { showToast('Le nom est requis.', 'error'); return; }

  const item = {
    id: editingUpcomingId || Storage.generateId('upcoming'),
    name,
    location: getField('upcoming-location'),
    expectedDate: getField('upcoming-date'),
    description: getField('upcoming-description'),
    image: getField('upcoming-image')
  };

  if (editingUpcomingId) {
    const idx = adminData.upcomingProperties.findIndex(u => u.id === editingUpcomingId);
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

// ── Textes du site ─────────────────────────────────────────── //
function renderTextsForm() {
  const s = adminData.settings;
  setField('text-site-name', s.siteName);
  setField('text-tagline', s.tagline);
  setField('text-hero-title', s.heroTitle);
  setField('text-hero-subtitle', s.heroSubtitle);
  setField('text-about-title', s.aboutTitle);
  setField('text-about-body', s.aboutText);
  setField('text-newsletter-title', s.newsletterTitle);
  setField('text-newsletter-text', s.newsletterText);
  setField('text-contact-email', s.contactEmail);
  setField('text-phone', s.phone);
  setField('text-address', s.address);
  setField('text-formspree', s.formspreeId);
  setField('text-instagram', s.instagramUrl);
  setField('text-linkedin', s.linkedinUrl);
}

function saveTexts() {
  adminData.settings.siteName       = getField('text-site-name');
  adminData.settings.tagline        = getField('text-tagline');
  adminData.settings.heroTitle      = getField('text-hero-title');
  adminData.settings.heroSubtitle   = getField('text-hero-subtitle');
  adminData.settings.aboutTitle     = getField('text-about-title');
  adminData.settings.aboutText      = getField('text-about-body');
  adminData.settings.newsletterTitle= getField('text-newsletter-title');
  adminData.settings.newsletterText = getField('text-newsletter-text');
  adminData.settings.contactEmail   = getField('text-contact-email');
  adminData.settings.phone          = getField('text-phone');
  adminData.settings.address        = getField('text-address');
  adminData.settings.formspreeId    = getField('text-formspree');
  adminData.settings.instagramUrl   = getField('text-instagram');
  adminData.settings.linkedinUrl    = getField('text-linkedin');
  Storage.saveData(adminData);
  showToast('Textes sauvegardés.');
}

// ── Pages légales ──────────────────────────────────────────── //
function renderLegalEditor() {
  switchLegalTab(currentLegalTab);
}

function switchLegalTab(tab) {
  currentLegalTab = tab;
  document.querySelectorAll('.legal-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });

  const editor = document.getElementById('legal-editor');
  if (editor) editor.value = adminData.legalPages[tab] || '';
}

function saveLegal() {
  adminData.legalPages[currentLegalTab] = document.getElementById('legal-editor')?.value || '';
  Storage.saveData(adminData);
  showToast('Page légale sauvegardée.');
}

// ── Liens de paiement ─────────────────────────────────────── //
function renderPaymentLinks() {
  const container = document.getElementById('payment-links-list');
  if (!container) return;

  const props = adminData.properties;
  if (props.length === 0) {
    container.innerHTML = '<p style="color:var(--text-dim)">Aucun logement créé. Ajoutez des logements d\'abord.</p>';
    return;
  }

  container.innerHTML = props.map(p => `
    <div class="field" style="margin-bottom:20px; padding:16px; background:rgba(255,255,255,0.02); border:1px solid var(--border); border-radius:var(--radius);">
      <div style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
        <img src="${esc(p.image)}" alt="" style="width:48px;height:36px;object-fit:cover;border-radius:6px;"
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=100&q=60'">
        <div>
          <p style="font-family:var(--font-serif);font-size:0.95rem;">${esc(p.name)}</p>
          <p style="font-size:11px;color:var(--text-muted);">${esc(p.location)}</p>
        </div>
      </div>
      <label class="field-label">Lien de paiement Stripe (ou autre)</label>
      <input
        class="field-input"
        type="url"
        placeholder="https://buy.stripe.com/..."
        value="${esc(p.paymentLink || '')}"
        id="payment-link-${p.id}"
      >
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

// ── Newsletter ─────────────────────────────────────────────── //
function renderNewsletter() {
  const tbody = document.getElementById('subscribers-body');
  if (!tbody) return;

  const subs = adminData.subscribers || [];
  if (subs.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; padding:32px; color:var(--text-dim);">Aucun abonné pour le moment.</td></tr>`;
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

// ── Réservations ───────────────────────────────────────────── //
function renderReservations() {
  const tbody = document.getElementById('reservations-body');
  if (!tbody) return;

  const reservations = adminData.reservations || [];
  if (reservations.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:32px; color:var(--text-dim);">Aucune réservation pour le moment.</td></tr>`;
    return;
  }

  tbody.innerHTML = [...reservations].reverse().map(r => `
    <tr>
      <td>${formatDate(r.createdAt)}</td>
      <td>${esc(r.propName)}</td>
      <td>${esc(r.name)}</td>
      <td>${esc(r.email)}</td>
      <td>${esc(r.checkin)} → ${esc(r.checkout)}</td>
      <td><span class="badge badge-available">${esc(r.status)}</span></td>
    </tr>`).join('');
}

// ── Paramètres ─────────────────────────────────────────────── //
function renderSettings() {
  setField('settings-password', adminData.settings.adminPassword || '');
}

function saveSettings() {
  const newPwd = getField('settings-password');
  if (newPwd.length < 6) { showToast('Le mot de passe doit contenir au moins 6 caractères.', 'error'); return; }
  adminData.settings.adminPassword = newPwd;
  Storage.saveData(adminData);
  showToast('Paramètres sauvegardés.');
}

function confirmResetData() {
  if (!confirm('Réinitialiser toutes les données ? Cette action est irréversible.')) return;
  Storage.resetData();
  adminData = Storage.getData();
  showToast('Données réinitialisées.');
  loadPanel('dashboard');
}

// ── Utilitaires DOM ────────────────────────────────────────── //
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

// ── Modals ─────────────────────────────────────────────────── //
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
  document.body.style.overflow = '';
}

// Fermer modal en cliquant sur l'overlay
document.addEventListener('click', (e) => {
  if (e.target.classList.contains('admin-modal-overlay')) {
    e.target.classList.remove('open');
    document.body.style.overflow = '';
  }
});

// ── Notifications toast ────────────────────────────────────── //
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `${type === 'success' ? '✓' : '✕'} ${esc(message)}`;
  container.appendChild(toast);

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3500);
}

// ── Utilitaires ─────────────────────────────────────────────── //
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function emptyState(icon, text) {
  return `<div class="empty-state">
    <div class="empty-state-icon">${icon}</div>
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

// Export/Import global
function exportBackup() { Storage.exportData(); }

function importBackup() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    Storage.importData(file, (err) => {
      if (err) { showToast('Fichier invalide.', 'error'); return; }
      adminData = Storage.getData();
      showToast('Données importées avec succès.');
      loadPanel(currentPanel);
    });
  };
  input.click();
}

// Exposer les fonctions au HTML
window.loadPanel = loadPanel;
window.openAddProperty = openAddProperty;
window.editProperty = editProperty;
window.saveProperty = saveProperty;
window.deleteProperty = deleteProperty;
window.openAddUpcoming = openAddUpcoming;
window.editUpcoming = editUpcoming;
window.saveUpcoming = saveUpcoming;
window.deleteUpcoming = deleteUpcoming;
window.saveTexts = saveTexts;
window.switchLegalTab = switchLegalTab;
window.saveLegal = saveLegal;
window.savePaymentLinks = savePaymentLinks;
window.exportSubscribers = exportSubscribers;
window.saveSettings = saveSettings;
window.confirmResetData = confirmResetData;
window.exportBackup = exportBackup;
window.importBackup = importBackup;
window.closeModal = closeModal;
window.logout = logout;
