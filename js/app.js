/**
 * app.js — Logique du site public AURELYS
 * Données : AureStorage v2 | Carte : Leaflet | Booking : AureBooking
 */

document.addEventListener('DOMContentLoaded', () => {
  const data = AureStorage.getData();

  applyContent(data.content);
  renderProperties(data.properties);
  renderUpcoming(data.upcomingProperties);
  renderStats(data.content.home && data.content.home.stats);
  renderFaq(data.content && data.content.faq);
  AureMap.init(data.properties);

  initNav();
  initNewsletter();
  initContactForm(data.content.global.globalFormspreeId);
  initFadeIn();
  initParallax();

  /* Écoute des mises à jour locales */
  window.addEventListener('aurelys:dataChanged', () => {
    const fresh = AureStorage.getData();
    applyContent(fresh.content);
    renderProperties(fresh.properties);
    renderUpcoming(fresh.upcomingProperties);
    renderStats(fresh.content.home && fresh.content.home.stats);
    renderFaq(fresh.content && fresh.content.faq);
    AureMap.update(fresh.properties);
  });

  window.addEventListener('storage', (e) => {
    if (e.key === 'aurelys_v2') {
      const fresh = AureStorage.getData();
      applyContent(fresh.content);
      renderProperties(fresh.properties);
      renderUpcoming(fresh.upcomingProperties);
    }
  });
});


/* ── Contenu éditorial ──────────────────────────────────────── */

function applyContent(content) {
  if (!content) return;
  const global = content.global   || {};
  const home   = content.home     || {};
  const hero   = home.hero        || {};
  const nl     = home.newsletter  || {};
  const ed     = home.editorial   || {};

  /* Nom de la marque — toujours AURELYS */
  document.querySelectorAll('[data-text="siteName"]').forEach(el => {
    el.textContent = 'AURELYS';
  });
  document.querySelectorAll('[data-text="footerBrand"]').forEach(el => {
    el.textContent = 'AURELYS';
  });

  /* Tagline footer */
  document.querySelectorAll('[data-text="tagline"]').forEach(el => {
    el.textContent = global.tagline || 'Intemporel par choix.';
  });

  /* Titre page */
  document.title = 'AURELYS — Intemporel par choix.';

  /* Hero */
  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) heroTitle.innerHTML = _formatTitle(hero.title || 'Intemporel<br><em>par choix.</em>');

  const heroSubtitle = document.getElementById('hero-subtitle');
  if (heroSubtitle) heroSubtitle.textContent = hero.subtitle || '';

  /* À propos */
  const aboutTitle = document.getElementById('about-title');
  if (aboutTitle) aboutTitle.textContent = ed.title || 'Une curation rigoureuse.';

  const aboutBody = document.getElementById('about-body');
  if (aboutBody) aboutBody.textContent = ed.body
    ? ed.body.split('\n\n')[0]
    : '';

  /* Newsletter */
  const nlTitle = document.getElementById('newsletter-title');
  if (nlTitle) nlTitle.textContent = nl.title || 'Avant-première.';

  const nlText = document.getElementById('newsletter-text');
  if (nlText) nlText.textContent = nl.body || '';

  /* Liens sociaux */
  document.querySelectorAll('[data-href="instagram"]').forEach(el => {
    if (global.instagramUrl) el.href = global.instagramUrl;
  });
  document.querySelectorAll('[data-href="linkedin"]').forEach(el => {
    if (global.linkedinUrl) el.href = global.linkedinUrl;
  });

  /* Formspree contact */
  const cf = document.getElementById('contact-form');
  if (cf && global.globalFormspreeId && global.globalFormspreeId !== 'YOUR_FORMSPREE_ID') {
    cf.action = `https://formspree.io/f/${global.globalFormspreeId}`;
  }
}

function _formatTitle(text) {
  if (!text) return '';
  if (text.includes('<br>') || text.includes('\n')) {
    return text
      .replace(/\n/g, '<br>')
      .split('<br>')
      .map((line, i) => i === 0 ? line : (line.startsWith('<em>') ? line : `<em>${line}</em>`))
      .join('<br>');
  }
  return text;
}


/* ── Logements (cards overlay éditorial) ───────────────────── */

function renderProperties(properties) {
  const grid = document.getElementById('properties-grid');
  if (!grid) return;

  const available = (properties || [])
    .filter(p => p.available !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  if (available.length === 0) {
    grid.innerHTML = '<p style="color:var(--color-text-muted);grid-column:1/-1;padding:40px 0;">Aucun logement disponible pour le moment.</p>';
    return;
  }

  grid.innerHTML = available.map((p, i) => _propertyCardHTML(p, i)).join('');

  /* Attacher les listeners Réserver */
  grid.querySelectorAll('[data-reserve]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      AureBooking.initBookingModal(btn.dataset.reserve);
    });
  });

  /* Relancer les animations fade-in sur les nouvelles cartes */
  initFadeIn();
}

function _propertyCardHTML(p, index = 0) {
  const cover      = escHtml((p.media && p.media.coverImage) || '');
  const title      = escHtml(p.title || p.name || '');
  const city       = p.location ? escHtml(p.location.city || '') : '';
  const area       = p.location ? escHtml(p.location.area || '') : '';
  const loc        = [city, area].filter(Boolean).join(' · ');
  const desc       = escHtml(p.shortDescription || '');
  const price      = (p.pricing && p.pricing.perNight) || 0;
  const currency   = (p.pricing && p.pricing.currency) || 'EUR';
  const guests     = (p.capacity && p.capacity.guests);
  const bedrooms   = (p.capacity && p.capacity.bedrooms);
  const amenities  = (p.amenities || p.features || []).slice(0, 3);
  const badges     = (p.badges || []);
  const delay      = index % 3;

  const priceStr = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 0
  }).format(price);

  const badgesHtml = badges.length
    ? badges.map(b => `<span class="property-badge">${escHtml(b)}</span>`).join('')
    : '<span class="property-badge">Disponible</span>';

  const metaHtml = [];
  if (guests)   metaHtml.push(`<span>${guests} pers.</span><span class="property-meta-sep">·</span>`);
  if (bedrooms) metaHtml.push(`<span>${bedrooms} ch.</span><span class="property-meta-sep">·</span>`);

  const pillsHtml = amenities
    .map(a => `<span class="property-amenity-pill">${escHtml(a)}</span>`)
    .join('');

  const delayClass = delay > 0 ? ` fade-in-delay-${delay}` : '';

  return `
    <article class="property-card fade-in${delayClass}" role="article" data-property-id="${escHtml(p.id)}">
      <div class="property-media">
        <img
          class="property-img"
          src="${cover}"
          alt="${title}"
          loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80'"
        >

        <div class="property-info-overlay">
          <!-- Badges haut -->
          <div class="property-tags">${badgesHtml}</div>

          <!-- Infos bas (remonte au hover) -->
          <div class="property-bottom">
            <p class="property-location">${loc}</p>
            <h3 class="property-title">${title}</h3>
            <div class="property-meta-row">
              ${metaHtml.join('')}
              <span class="property-price-inline">${priceStr}<span class="property-price-unit"> / nuit</span></span>
            </div>
          </div>
        </div>

        <!-- Panel reveal au hover -->
        <div class="property-hover-reveal">
          ${desc ? `<p class="property-desc-short">${desc}</p>` : ''}
          ${pillsHtml ? `<div class="property-amenity-pills">${pillsHtml}</div>` : ''}
          <button class="btn btn-primary btn-sm" data-reserve="${escHtml(p.id)}">
            Réserver
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </article>`;
}


/* ── Logements à venir ──────────────────────────────────────── */

function renderUpcoming(upcoming) {
  const grid    = document.getElementById('upcoming-grid');
  const section = document.getElementById('a-venir');
  if (!grid) return;

  if (!upcoming || upcoming.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';
  grid.innerHTML = upcoming.map((u, i) => _upcomingCardHTML(u, i)).join('');
  initFadeIn();
}

function _upcomingCardHTML(u, index = 0) {
  const cover  = escHtml((u.media && u.media.coverImage) || '');
  const title  = escHtml(u.title || u.name || '');
  const city   = u.location ? escHtml(u.location.city || '') : '';
  const date   = u.expectedDate ? _formatExpectedDate(u.expectedDate) : 'Bientôt';
  const delay  = index > 0 ? ` fade-in-delay-${Math.min(index, 4)}` : '';

  return `
    <div class="upcoming-card fade-in${delay}">
      <img
        class="upcoming-card-img"
        src="${cover}"
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
          ${date}
        </span>
        <h3 class="upcoming-name">${title}</h3>
        ${city ? `<p class="upcoming-location">${city}</p>` : ''}
      </div>
    </div>`;
}

function _formatExpectedDate(str) {
  try {
    const parts = str.split('-');
    const d = new Date(parseInt(parts[0]), parseInt(parts[1] || 1) - 1);
    return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch {
    return str;
  }
}


/* ── Stats ──────────────────────────────────────────────────── */

function renderStats(stats) {
  const band = document.getElementById('stats-row');
  if (!band) return;

  const list = Array.isArray(stats) && stats.length > 0
    ? stats
    : [
        { value: '3+',  label: 'Résidences' },
        { value: '5★',  label: 'Expérience' },
        { value: '98%', label: 'Satisfaction' }
      ];

  band.innerHTML = `
    <div class="container">
      <div class="stats-row">
        ${list.map(s => `
          <div class="stat fade-in">
            <div class="stat-value">${escHtml(String(s.value))}</div>
            <div class="stat-label">${escHtml(s.label)}</div>
          </div>`).join('')}
      </div>
    </div>`;

  initFadeIn();
}


/* ── FAQ ────────────────────────────────────────────────────── */

function renderFaq(items) {
  const list = document.getElementById('faq-list');
  const section = document.getElementById('faq');
  if (!list) return;

  if (!items || items.length === 0) {
    if (section) section.style.display = 'none';
    return;
  }

  if (section) section.style.display = '';

  list.innerHTML = items.map(item => `
    <div class="faq-item fade-in" id="faq-${escHtml(item.id)}">
      <button class="faq-question" aria-expanded="false" aria-controls="faq-answer-${escHtml(item.id)}">
        <span>${escHtml(item.question)}</span>
        <span class="faq-icon" aria-hidden="true">+</span>
      </button>
      <div class="faq-answer" id="faq-answer-${escHtml(item.id)}" role="region">
        ${escHtml(item.answer)}
      </div>
    </div>`).join('');

  /* Accordion */
  list.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item    = btn.closest('.faq-item');
      const isOpen  = item.classList.contains('open');

      /* Fermer tous les autres */
      list.querySelectorAll('.faq-item.open').forEach(el => {
        if (el !== item) {
          el.classList.remove('open');
          el.querySelector('.faq-question').setAttribute('aria-expanded', 'false');
        }
      });

      item.classList.toggle('open', !isOpen);
      btn.setAttribute('aria-expanded', String(!isOpen));
    });
  });

  initFadeIn();
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
      burger.classList.toggle('open');
      burger.setAttribute('aria-expanded', mobileMenu.classList.contains('open'));
    });
    mobileMenu.querySelectorAll('a').forEach(a => {
      a.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        burger.classList.remove('open');
        burger.setAttribute('aria-expanded', 'false');
      });
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

    const data = AureStorage.getData();
    data.subscribers = data.subscribers || [];

    if (data.subscribers.some(s => s.email === email)) {
      showToast('Cette adresse est déjà inscrite.', 'error');
      return;
    }

    data.subscribers.push({ email, date: new Date().toISOString() });
    AureStorage.saveData(data);
    form.reset();
    showToast('Merci\u00a0! Vous serez informé(e) en avant-première.', 'success');
  });
}


/* ── Formulaire contact ─────────────────────────────────────── */

function initContactForm(formspreeId) {
  const form = document.getElementById('contact-form');
  if (!form) return;

  if (formspreeId && formspreeId !== 'YOUR_FORMSPREE_ID') {
    form.action = `https://formspree.io/f/${formspreeId}`;
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn  = form.querySelector('[type="submit"]');
    const btnLabel   = submitBtn && submitBtn.querySelector('.btn-label');
    const successMsg = document.getElementById('contact-success');

    if (submitBtn) submitBtn.classList.add('loading');
    if (btnLabel)  btnLabel.textContent = 'Envoi en cours…';

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
        }, 7000);
      } else {
        throw new Error('Erreur serveur');
      }
    } catch {
      showToast('Erreur. Contactez-nous directement à contact@aurelys.fr', 'error');
    } finally {
      if (submitBtn) submitBtn.classList.remove('loading');
      if (btnLabel)  btnLabel.textContent = 'Envoyer le message';
    }
  });
}


/* ── Animations fade-in ─────────────────────────────────────── */

let _fadeObserver = null;

function initFadeIn() {
  if (!_fadeObserver) {
    _fadeObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            _fadeObserver.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );
  }

  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => {
    _fadeObserver.observe(el);
  });
}


/* ── Parallaxe légère sur le hero ───────────────────────────── */

function initParallax() {
  const heroContent = document.querySelector('.hero-content');
  const heroWatermark = document.querySelector('.hero-watermark');
  if (!heroContent) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      requestAnimationFrame(() => {
        const y = window.scrollY;
        if (y < window.innerHeight) {
          heroContent.style.transform = `translateY(${y * 0.18}px)`;
          heroContent.style.opacity   = String(1 - y / (window.innerHeight * 0.75));
          if (heroWatermark) {
            heroWatermark.style.transform = `translateY(calc(-50% + ${y * 0.08}px)) rotate(90deg)`;
          }
        }
        ticking = false;
      });
      ticking = true;
    }
  }, { passive: true });
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
    setTimeout(() => toast.remove(), 450);
  }, 4500);
}


/* ── Échappement HTML ───────────────────────────────────────── */

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.showToast = showToast;
