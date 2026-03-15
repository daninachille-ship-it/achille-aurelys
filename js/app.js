/**
 * app.js — Logique du site public Achille & Aurelys
 * Se base sur AureStorage (storage.js v2) pour toutes les données
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = AureStorage.getData();

  applyContent(data.content);
  renderProperties(data.properties);
  renderUpcoming(data.upcomingProperties);

  initNav();
  initNewsletter();
  initContactForm(data.content.global.globalFormspreeId);
  initFadeIn();

  // Écouter les mises à jour locales
  window.addEventListener('aurelys:dataChanged', () => {
    const fresh = AureStorage.getData();
    applyContent(fresh.content);
    renderProperties(fresh.properties);
    renderUpcoming(fresh.upcomingProperties);
  });

  // Synchronisation cross-onglets
  window.addEventListener('storage', (e) => {
    if (e.key === 'aurelys_v2') {
      const fresh = AureStorage.getData();
      applyContent(fresh.content);
      renderProperties(fresh.properties);
      renderUpcoming(fresh.upcomingProperties);
    }
  });
});

/* ── Applique le contenu éditable ──────────────────────────── */
function applyContent(content) {
  if (!content) return;
  const global = content.global || {};
  const home   = content.home   || {};
  const hero   = home.hero      || {};
  const nl     = home.newsletter || {};
  const editorial = home.editorial || {};

  // Nom du site
  document.querySelectorAll('[data-text="siteName"]').forEach(el => {
    el.textContent = global.siteName || 'AURELYS';
  });

  // Titre de la page
  const tagline = global.tagline || '';
  document.title = tagline
    ? `${global.siteName || 'AURELYS'} — ${tagline}`
    : (global.siteName || 'AURELYS');

  // Hero
  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) heroTitle.innerHTML = _formatTitle(hero.title || '');

  const heroSubtitle = document.getElementById('hero-subtitle');
  if (heroSubtitle) heroSubtitle.textContent = hero.subtitle || '';

  // Section À propos — utilise le contenu éditorial
  const aboutTitle = document.getElementById('about-title');
  if (aboutTitle) aboutTitle.textContent = editorial.title || '';

  const aboutBody = document.getElementById('about-body');
  if (aboutBody) aboutBody.textContent = editorial.body
    ? editorial.body.split('\n\n')[0]   // premier paragraphe
    : '';

  // Newsletter
  const nlTitle = document.getElementById('newsletter-title');
  if (nlTitle) nlTitle.textContent = nl.title || '';

  const nlText = document.getElementById('newsletter-text');
  if (nlText) nlText.textContent = nl.body || '';

  // Footer
  document.querySelectorAll('[data-text="footerBrand"]').forEach(el => {
    el.textContent = global.siteName || 'AURELYS';
  });

  // Liens sociaux
  document.querySelectorAll('[data-href="instagram"]').forEach(el => {
    el.href = global.instagramUrl || '#';
  });
  document.querySelectorAll('[data-href="linkedin"]').forEach(el => {
    el.href = global.linkedinUrl || '#';
  });
}

/** Formate le titre (sauts de ligne → <br> + <em> sur les lignes suivantes) */
function _formatTitle(text) {
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

  const available = (properties || [])
    .filter(p => p.available !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (available.length === 0) {
    grid.innerHTML = '<p style="color:var(--color-text-muted);grid-column:1/-1">Aucun logement disponible pour le moment.</p>';
    return;
  }

  grid.innerHTML = available.map(p => _propertyCardHTML(p)).join('');

  grid.querySelectorAll('[data-reserve]').forEach(btn => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.reserve;
      AureBooking.initBookingModal(id);
    });
  });
}

function _propertyCardHTML(p) {
  const coverImage = (p.media && p.media.coverImage) || '';
  const title      = escHtml(p.title || p.name || '');
  const location   = p.location
    ? escHtml(p.location.city || p.location.area || '')
    : '';
  const desc       = escHtml(p.shortDescription || p.description || '');
  const price      = (p.pricing && p.pricing.perNight) || 0;
  const currency   = (p.pricing && p.pricing.currency) || 'EUR';
  const amenities  = (p.amenities || p.features || []).slice(0, 4)
    .map(f => `<span class="property-feature">${escHtml(f)}</span>`)
    .join('');

  const priceStr = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 0
  }).format(price);

  const badges = (p.badges || [])
    .map(b => `<span class="property-badge">${escHtml(b)}</span>`)
    .join('');

  return `
    <article class="property-card fade-in">
      <div class="property-img-wrap">
        <img
          class="property-img"
          src="${escHtml(coverImage)}"
          alt="${title}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80'"
        >
        ${badges || '<span class="property-badge">Disponible</span>'}
      </div>
      <div class="property-body">
        <p class="property-location">${location}</p>
        <h3 class="property-name">${title}</h3>
        <p class="property-desc">${desc}</p>
        <div class="property-features">${amenities}</div>
        <div class="property-footer">
          <div class="property-price">
            <span class="property-price-amount">${priceStr}</span>
            <span class="property-price-unit">/ nuit</span>
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
  const grid    = document.getElementById('upcoming-grid');
  const section = document.getElementById('a-venir');
  if (!grid) return;

  if (!upcoming || upcoming.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';
  grid.innerHTML = upcoming.map(u => _upcomingCardHTML(u)).join('');
}

function _upcomingCardHTML(u) {
  const coverImage = (u.media && u.media.coverImage) || '';
  const title      = escHtml(u.title || u.name || '');
  const location   = u.location
    ? escHtml(u.location.city || u.location.area || '')
    : '';
  const dateLabel  = u.expectedDate
    ? _formatExpectedDate(u.expectedDate)
    : 'Bientôt';

  return `
    <div class="upcoming-card fade-in">
      <img
        class="upcoming-card-img"
        src="${escHtml(coverImage)}"
        alt="${title}"
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
        <h3 class="upcoming-name">${title}</h3>
        <p class="upcoming-location">${location}</p>
      </div>
    </div>`;
}

function _formatExpectedDate(dateStr) {
  try {
    const [year, month] = dateStr.split('-');
    const d = new Date(parseInt(year), parseInt(month) - 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return dateStr;
  }
}

/* ── Navigation ─────────────────────────────────────────────── */
function initNav() {
  const nav = document.querySelector('.nav');
  if (!nav) return;

  window.addEventListener('scroll', () => {
    nav.classList.toggle('scrolled', window.scrollY > 40);
  }, { passive: true });

  const burger     = document.querySelector('.nav-burger');
  const mobileMenu = document.querySelector('.nav-mobile');
  if (burger && mobileMenu) {
    burger.addEventListener('click', () => {
      mobileMenu.classList.toggle('open');
      burger.setAttribute('aria-expanded', mobileMenu.classList.contains('open'));
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => mobileMenu.classList.remove('open'));
    });
  }
}

/* ── Newsletter ─────────────────────────────────────────────── */
function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = form.querySelector('input[type="email"]')?.value?.trim();
    if (!email) return;

    const current = AureStorage.getData();
    current.subscribers = current.subscribers || [];

    if (current.subscribers.some(s => s.email === email)) {
      showToast('Cette adresse est déjà inscrite.', 'error');
      return;
    }

    current.subscribers.push({ email, date: new Date().toISOString() });
    AureStorage.saveData(current);
    form.reset();
    showToast('Merci\u00a0! Vous serez informé(e) en avant-première.', 'success');
  });
}

/* ── Formulaire contact (Formspree) ─────────────────────────── */
function initContactForm(formspreeId) {
  const form = document.getElementById('contact-form');
  if (!form) return;

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
        showToast('Message envoyé avec succès\u00a0!', 'success');
        setTimeout(() => {
          if (successMsg) successMsg.classList.remove('show');
        }, 6000);
      } else {
        throw new Error('Erreur serveur');
      }
    } catch {
      showToast('Une erreur est survenue. Veuillez réessayer ou nous contacter directement.', 'error');
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

window.showToast = showToast;
