/**
 * app.js — Logique du site public Achille & Aurelys
 * Se base sur storage.js pour toutes les données
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = Storage.getData();

  // Injecter les textes dynamiques
  applySettings(data.settings);

  // Rendre les logements
  renderProperties(data.properties);

  // Rendre les logements à venir
  renderUpcoming(data.upcomingProperties);

  // Navbar comportement au scroll
  initNav();

  // Formulaire newsletter
  initNewsletter(data);

  // Formulaire contact (Formspree)
  initContactForm(data.settings.formspreeId);

  // Animations d'entrée
  initFadeIn();

  // Écouter les mises à jour depuis l'admin (même onglet ou localStorage)
  window.addEventListener('siteDataUpdated', () => {
    const fresh = Storage.getData();
    applySettings(fresh.settings);
    renderProperties(fresh.properties);
    renderUpcoming(fresh.upcomingProperties);
  });

  // Synchronisation entre onglets (storage event)
  window.addEventListener('storage', (e) => {
    if (e.key === 'achille_aurelys_v1') {
      const fresh = Storage.getData();
      applySettings(fresh.settings);
      renderProperties(fresh.properties);
      renderUpcoming(fresh.upcomingProperties);
    }
  });
});

/* ── Applique les paramètres textuels ──────────────────────── */
function applySettings(settings) {
  // Nom du site
  document.querySelectorAll('[data-text="siteName"]').forEach(el => {
    el.textContent = settings.siteName;
  });

  // Hero
  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) heroTitle.innerHTML = formatTitle(settings.heroTitle);

  const heroSubtitle = document.getElementById('hero-subtitle');
  if (heroSubtitle) heroSubtitle.textContent = settings.heroSubtitle;

  // About
  const aboutTitle = document.getElementById('about-title');
  if (aboutTitle) aboutTitle.textContent = settings.aboutTitle;

  const aboutBody = document.getElementById('about-body');
  if (aboutBody) aboutBody.textContent = settings.aboutText;

  // Newsletter
  const nlTitle = document.getElementById('newsletter-title');
  if (nlTitle) nlTitle.textContent = settings.newsletterTitle;

  const nlText = document.getElementById('newsletter-text');
  if (nlText) nlText.textContent = settings.newsletterText;

  // Footer
  document.querySelectorAll('[data-text="footerBrand"]').forEach(el => {
    el.textContent = settings.siteName;
  });

  // Social links
  document.querySelectorAll('[data-href="instagram"]').forEach(el => {
    el.href = settings.instagramUrl || '#';
  });
  document.querySelectorAll('[data-href="linkedin"]').forEach(el => {
    el.href = settings.linkedinUrl || '#';
  });

  // Page title
  document.title = `${settings.siteName} — ${settings.tagline}`;
}

/** Formate le titre avec sauts de ligne et italiques */
function formatTitle(text) {
  if (!text) return '';
  return text
    .split('\n')
    .map((line, i) => i === 0 ? line : `<em>${line}</em>`)
    .join('<br>');
}

/* ── Rendu des logements ────────────────────────────────────── */
function renderProperties(properties) {
  const grid = document.getElementById('properties-grid');
  if (!grid) return;

  const available = properties
    .filter(p => p.available)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (available.length === 0) {
    grid.innerHTML = '<p style="color:var(--text-muted);grid-column:1/-1">Aucun logement disponible pour le moment.</p>';
    return;
  }

  grid.innerHTML = available.map(p => propertyCardHTML(p)).join('');

  // Attacher les événements de réservation
  grid.querySelectorAll('[data-reserve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.reserve;
      const prop = properties.find(p => p.id === id);
      if (prop) openReservationModal(prop);
    });
  });
}

function propertyCardHTML(p) {
  const features = (p.features || []).slice(0, 4).map(f =>
    `<span class="property-feature">${escHtml(f)}</span>`
  ).join('');

  return `
    <article class="property-card fade-in">
      <div class="property-img-wrap">
        <img
          class="property-img"
          src="${escHtml(p.image)}"
          alt="${escHtml(p.name)}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80'"
        >
        <span class="property-badge">Disponible</span>
      </div>
      <div class="property-body">
        <p class="property-location">${escHtml(p.location)}</p>
        <h3 class="property-name">${escHtml(p.name)}</h3>
        <p class="property-desc">${escHtml(p.description)}</p>
        <div class="property-features">${features}</div>
        <div class="property-footer">
          <div class="property-price">
            <span class="property-price-amount">${p.price}${p.currency}</span>
            <span class="property-price-unit">/ ${p.period}</span>
          </div>
          <button class="btn btn-primary" data-reserve="${escHtml(p.id)}">
            Réserver
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </article>`;
}

/* ── Rendu des logements à venir ────────────────────────────── */
function renderUpcoming(upcoming) {
  const grid = document.getElementById('upcoming-grid');
  if (!grid) return;

  const section = document.getElementById('upcoming-section');

  if (!upcoming || upcoming.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';

  grid.innerHTML = upcoming.map(u => upcomingCardHTML(u)).join('');
}

function upcomingCardHTML(u) {
  const dateLabel = u.expectedDate
    ? formatExpectedDate(u.expectedDate)
    : 'Bientôt';

  return `
    <div class="upcoming-card fade-in">
      <img
        class="upcoming-card-img"
        src="${escHtml(u.image)}"
        alt="${escHtml(u.name)}"
        loading="lazy"
        onerror="this.src='https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80'"
      >
      <div class="upcoming-overlay">
        <span class="upcoming-tag">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <circle cx="5" cy="5" r="4" stroke="currentColor" stroke-width="1.5"/>
            <path d="M5 3v2l1.5 1.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
          ${dateLabel}
        </span>
        <h3 class="upcoming-name">${escHtml(u.name)}</h3>
        <p class="upcoming-location">${escHtml(u.location)}</p>
      </div>
    </div>`;
}

function formatExpectedDate(dateStr) {
  try {
    const [year, month] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ── Modal de réservation ───────────────────────────────────── */
function openReservationModal(prop) {
  const overlay = document.getElementById('reservation-modal');
  if (!overlay) return;

  // Remplir les infos de la propriété
  const img = overlay.querySelector('.modal-prop-img');
  const name = overlay.querySelector('.modal-prop-name');
  const price = overlay.querySelector('.modal-prop-price');

  if (img) { img.src = prop.image; img.alt = prop.name; }
  if (name) name.textContent = prop.name;
  if (price) price.textContent = `${prop.price}${prop.currency} / ${prop.period}`;

  // Stocker l'ID du logement sélectionné
  overlay.dataset.propId = prop.id;

  // Remplir le select des logements dans le formulaire
  const select = overlay.querySelector('#modal-property-select');
  if (select) {
    select.value = prop.id;
  }

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeReservationModal() {
  const overlay = document.getElementById('reservation-modal');
  if (!overlay) return;
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

// Formulaire de réservation dans la modal
document.addEventListener('DOMContentLoaded', () => {
  const overlay = document.getElementById('reservation-modal');
  if (!overlay) return;

  // Fermer la modal
  overlay.querySelector('.modal-close')?.addEventListener('click', closeReservationModal);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) closeReservationModal();
  });

  // Soumettre la réservation
  const form = overlay.querySelector('#reservation-form');
  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      handleReservation(overlay, form);
    });
  }
});

function handleReservation(overlay, form) {
  const data = Storage.getData();
  const propId = overlay.dataset.propId;
  const prop = data.properties.find(p => p.id === propId);
  if (!prop) return;

  // Récupérer les données du formulaire
  const formData = new FormData(form);
  const reservation = {
    id: Storage.generateId('res'),
    propId,
    propName: prop.name,
    name: formData.get('name') || '',
    email: formData.get('email') || '',
    phone: formData.get('phone') || '',
    checkin: formData.get('checkin') || '',
    checkout: formData.get('checkout') || '',
    guests: formData.get('guests') || '',
    message: formData.get('message') || '',
    createdAt: new Date().toISOString(),
    status: 'pending'
  };

  // Sauvegarder la réservation
  data.reservations = data.reservations || [];
  data.reservations.push(reservation);
  Storage.saveData(data);

  // Rediriger vers le lien de paiement si configuré
  const paymentLink = prop.paymentLink?.trim();
  if (paymentLink && paymentLink.startsWith('http')) {
    closeReservationModal();
    showToast('Redirection vers le paiement…', 'success');
    setTimeout(() => { window.location.href = paymentLink; }, 1200);
  } else {
    closeReservationModal();
    showToast('Demande de réservation envoyée ! Nous vous contacterons rapidement.', 'success');
  }

  form.reset();
}

/* ── Navigation ─────────────────────────────────────────────── */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  const onScroll = () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  };

  window.addEventListener('scroll', onScroll, { passive: true });

  // Menu mobile
  const burger = document.querySelector('.nav-burger');
  const mobileMenu = document.querySelector('.nav-mobile');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', mobileMenu.classList.contains('open'));
    });

    // Fermer sur clic d'un lien
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }
}

/* ── Newsletter ─────────────────────────────────────────────── */
function initNewsletter(data) {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value?.trim();
    if (!email) return;

    const current = Storage.getData();
    current.subscribers = current.subscribers || [];

    if (current.subscribers.some(s => s.email === email)) {
      showToast('Cette adresse est déjà inscrite.', 'error');
      return;
    }

    current.subscribers.push({ email, date: new Date().toISOString() });
    Storage.saveData(current);

    form.reset();
    showToast('Merci ! Vous serez informé(e) en avant-première.', 'success');
  });
}

/* ── Formulaire contact (Formspree) ─────────────────────────── */
function initContactForm(formspreeId) {
  const form = document.getElementById('contact-form');
  if (!form) return;

  // Mettre à jour l'action avec le bon ID Formspree
  if (formspreeId && formspreeId !== 'YOUR_FORMSPREE_ID') {
    form.action = `https://formspree.io/f/${formspreeId}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const submitBtn = form.querySelector('[type="submit"]');
    const successMsg = document.getElementById('contact-success');

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Envoi en cours…';
    }

    try {
      const response = await fetch(form.action, {
        method: 'POST',
        body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        form.reset();
        if (successMsg) successMsg.classList.add('show');
        showToast('Message envoyé avec succès !', 'success');
        setTimeout(() => {
          if (successMsg) successMsg.classList.remove('show');
        }, 6000);
      } else {
        throw new Error('Erreur serveur');
      }
    } catch {
      showToast("Une erreur est survenue. Veuillez réessayer ou nous contacter directement.", 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Envoyer le message';
      }
    }
  });
}

/* ── Animations d'entrée ────────────────────────────────────── */
function initFadeIn() {
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -40px 0px' }
  );

  document.querySelectorAll('.fade-in').forEach(el => observer.observe(el));

  // Observer les éléments ajoutés dynamiquement
  const mutObs = new MutationObserver(() => {
    document.querySelectorAll('.fade-in:not(.visible)').forEach(el => observer.observe(el));
  });
  mutObs.observe(document.body, { childList: true, subtree: true });
}

/* ── Toast notifications ────────────────────────────────────── */
function showToast(message, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    requestAnimationFrame(() => toast.classList.add('show'));
  });

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

/* ── Utilitaire : échapper le HTML ──────────────────────────── */
function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Exposer pour les boutons inline
window.closeReservationModal = closeReservationModal;
window.showToast = showToast;
