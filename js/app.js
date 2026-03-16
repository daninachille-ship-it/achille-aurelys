/**
 * app.js — Logique du site public AURELYS v3
 * Données : AureDB (Supabase) | Carte : Leaflet | Booking : AureBooking
 * Toutes les données sont chargées depuis Supabase, avec realtime sync.
 */

'use strict';

document.addEventListener('DOMContentLoaded', async () => {

  _showPageLoader(true);

  try {
    const [properties, upcoming, settings, faqItems, blockedDatesMap] = await Promise.all([
      AureDB.getProperties(),
      AureDB.getUpcomingProperties(),
      AureDB.getSettings(),
      AureDB.getFaqItems(),
      _loadAllBlockedDates()
    ]);

    /* Alimenter les caches globaux pour booking.js (accès synchrone) */
    _hydrateCache(properties, blockedDatesMap);

    /* Contenu et rendu */
    applyContent(settings);
    renderProperties(properties);
    renderUpcoming(upcoming);
    renderStats(settings.home && settings.home.stats);
    renderFaq(faqItems);

    /* Carte Leaflet */
    AureMap.init(properties);

    /* UI */
    initNav();
    initNewsletter();
    initContactForm((settings.global || {}).globalFormspreeId);
    initFadeIn();
    initParallax();

    /* Realtime Supabase — synchronisation automatique cross-navigateur */
    if (AureDB.isConfigured()) {
      _setupRealtime();
    }

  } catch (err) {
    console.error('[AURELYS] Erreur de chargement:', err);
  } finally {
    _showPageLoader(false);
  }
});


/* ── Cache global pour booking.js (accès synchrone requis) ──── */

function _hydrateCache(properties, blockedDatesMap) {
  window._aureProps        = {};
  window._aureBlockedDates = blockedDatesMap || {};
  (properties || []).forEach(p => {
    window._aureProps[p.id] = p;
  });
}

async function _loadAllBlockedDates() {
  if (!AureDB.isConfigured()) return {};
  try {
    const cfg = window.AURELYS_CONFIG || {};
    const client = window.supabase
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;
    if (!client) return {};
    const { data } = await client
      .from('availability_blocks')
      .select('property_id, date');
    if (!data) return {};
    const map = {};
    data.forEach(row => {
      if (!map[row.property_id]) map[row.property_id] = [];
      map[row.property_id].push(row.date);
    });
    return map;
  } catch { return {}; }
}


/* ── Realtime ────────────────────────────────────────────────── */

function _setupRealtime() {
  AureDB.subscribeToChanges('properties', async () => {
    const props = await AureDB.getProperties();
    _hydrateCache(props, window._aureBlockedDates);
    renderProperties(props);
    AureMap.update(props);
  });

  AureDB.subscribeToChanges('site_settings', async () => {
    const settings = await AureDB.getSettings();
    applyContent(settings);
    renderStats(settings.home && settings.home.stats);
  });

  AureDB.subscribeToChanges('upcoming_properties', async () => {
    const upcoming = await AureDB.getUpcomingProperties();
    renderUpcoming(upcoming);
  });

  AureDB.subscribeToChanges('availability_blocks', async () => {
    const map = await _loadAllBlockedDates();
    window._aureBlockedDates = map;
  });
}


/* ── Loader ──────────────────────────────────────────────────── */

function _showPageLoader(show) {
  let loader = document.getElementById('page-loader');
  if (show && !loader) {
    loader = document.createElement('div');
    loader.id        = 'page-loader';
    loader.className = 'page-loader';
    loader.setAttribute('aria-hidden', 'true');
    document.body.appendChild(loader);
  }
  if (!show && loader) {
    loader.classList.add('fade-out');
    setTimeout(() => loader && loader.remove(), 400);
  }
}


/* ── Contenu éditorial ──────────────────────────────────────── */

function applyContent(settings) {
  if (!settings) return;
  const global = settings.global  || {};
  const home   = settings.home    || {};
  const hero   = home.hero        || {};
  const nl     = home.newsletter  || {};
  const ed     = home.editorial   || {};

  document.querySelectorAll('[data-text="siteName"], [data-text="footerBrand"]').forEach(el => {
    el.textContent = 'AURELYS';
  });

  document.querySelectorAll('[data-text="tagline"]').forEach(el => {
    el.textContent = global.tagline || 'Intemporel par choix.';
  });

  document.title = 'AURELYS \u2014 Intemporel par choix.';

  const heroTitle = document.getElementById('hero-title');
  if (heroTitle) heroTitle.innerHTML = _formatTitle(hero.title || 'Intemporel<br><em>par choix.</em>');

  const heroSubtitle = document.getElementById('hero-subtitle');
  if (heroSubtitle) heroSubtitle.textContent = hero.subtitle || '';

  if (hero.heroImage) {
    const mainImg = document.getElementById('hero-main-img');
    if (mainImg) mainImg.src = hero.heroImage;
  }
  if (hero.heroImageSecondary) {
    const secImg = document.getElementById('hero-secondary-img');
    if (secImg) secImg.src = hero.heroImageSecondary;
  }

  _updateHeroCard();

  const aboutTitle = document.getElementById('about-title');
  if (aboutTitle) aboutTitle.textContent = ed.title || 'Une curation rigoureuse.';

  const aboutBody = document.getElementById('about-body');
  if (aboutBody) aboutBody.textContent = ed.body ? ed.body.split('\n\n')[0] : '';

  const nlTitle = document.getElementById('newsletter-title');
  if (nlTitle) nlTitle.textContent = nl.title || 'Avant-premi\u00e8re.';

  const nlText = document.getElementById('newsletter-text');
  if (nlText) nlText.textContent = nl.body || '';

  document.querySelectorAll('[data-text="contactEmail"]').forEach(el => {
    el.textContent = global.contactEmail || '';
  });
  document.querySelectorAll('[data-href="contactEmail"]').forEach(el => {
    if (global.contactEmail) el.href = `mailto:${global.contactEmail}`;
  });

  document.querySelectorAll('[data-href="instagram"]').forEach(el => {
    if (global.instagramUrl) el.href = global.instagramUrl;
  });
  document.querySelectorAll('[data-href="linkedin"]').forEach(el => {
    if (global.linkedinUrl) el.href = global.linkedinUrl;
  });

  const cf = document.getElementById('contact-form');
  if (cf && global.globalFormspreeId) {
    cf.action = `https://formspree.io/f/${global.globalFormspreeId}`;
  }

  _renderFooter(settings.footer || {});
}

function _renderFooter(footer) {
  document.querySelectorAll('[data-text="footerDescription"]').forEach(el => {
    if (footer.description) el.textContent = footer.description;
  });

  document.querySelectorAll('[data-text="footerCopyright"]').forEach(el => {
    const text = (footer.copyright || '\u00a9 {year} AURELYS. Tous droits r\u00e9serv\u00e9s.')
      .replace('{year}', new Date().getFullYear());
    el.textContent = text;
  });

  const colsContainer = document.getElementById('footer-cols');
  if (colsContainer && Array.isArray(footer.columns) && footer.columns.length > 0) {
    colsContainer.innerHTML = footer.columns.map(col => `
      <div class="footer-col">
        <p class="footer-col-title">${escHtml(col.title || '')}</p>
        <ul class="footer-links">
          ${(col.links || []).map(link =>
            `<li><a href="${escHtml(link.href || '#')}">${escHtml(link.label || '')}</a></li>`
          ).join('')}
        </ul>
      </div>`).join('');
  }
}

function _updateHeroCard() {
  const props    = Object.values(window._aureProps || {});
  const featured = props
    .filter(p => p.available !== false)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))[0];
  if (!featured) return;

  const label    = [featured.location?.city, featured.location?.area].filter(Boolean).join(' \u00b7 ');
  const price    = featured.pricing?.perNight || 0;
  const currency = featured.pricing?.currency || 'EUR';

  const labelEl = document.getElementById('hero-floating-label');
  const titleEl = document.getElementById('hero-floating-title');
  const priceEl = document.getElementById('hero-floating-price');

  if (labelEl && label) labelEl.textContent = label;
  if (titleEl && featured.title) titleEl.textContent = featured.title;
  if (priceEl && price) {
    const sym = currency === 'EUR' ? '\u20ac' : currency === 'USD' ? '$' : currency;
    priceEl.innerHTML = `${price} <span>${sym} / nuit</span>`;
  }
}

function _formatTitle(text) {
  if (!text) return '';
  if (text.includes('<br>') || text.includes('\n')) {
    return text.replace(/\n/g, '<br>').split('<br>')
      .map((line, i) => i === 0 ? line : (line.startsWith('<em>') ? line : `<em>${line}</em>`))
      .join('<br>');
  }
  return text;
}


/* ── Logements ───────────────────────────────────────────────── */

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

  grid.querySelectorAll('[data-reserve]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      AureBooking.initBookingModal(btn.dataset.reserve);
    });
  });

  /* Clic sur la carte → page logement avec toutes les photos */
  grid.querySelectorAll('.property-card').forEach(card => {
    card.style.cursor = 'pointer';
    card.addEventListener('click', () => {
      const id = card.dataset.propertyId;
      if (id) window.location.href = `residence.html?id=${encodeURIComponent(id)}`;
    });
  });

  initFadeIn();
}

function _propertyCardHTML(p, index = 0) {
  const cover     = escHtml((p.media && p.media.coverImage) || '');
  const title     = escHtml(p.title || '');
  const city      = p.location ? escHtml(p.location.city || '') : '';
  const area      = p.location ? escHtml(p.location.area || '') : '';
  const loc       = [city, area].filter(Boolean).join(' \u00b7 ');
  const desc      = escHtml(p.shortDescription || '');
  const price     = (p.pricing && p.pricing.perNight) || 0;
  const currency  = (p.pricing && p.pricing.currency) || 'EUR';
  const guests    = p.capacity && p.capacity.guests;
  const bedrooms  = p.capacity && p.capacity.bedrooms;
  const amenities = (p.amenities || []).slice(0, 3);
  const badges    = p.badges || [];
  const delay     = index % 3;

  const priceStr = new Intl.NumberFormat('fr-FR', {
    style: 'currency', currency, minimumFractionDigits: 0
  }).format(price);

  const badgesHtml = badges.length
    ? badges.map(b => `<span class="property-badge">${escHtml(b)}</span>`).join('')
    : '<span class="property-badge">Disponible</span>';

  const metaHtml = [];
  if (guests)   metaHtml.push(`<span>${guests} pers.</span><span class="property-meta-sep">\u00b7</span>`);
  if (bedrooms) metaHtml.push(`<span>${bedrooms} ch.</span><span class="property-meta-sep">\u00b7</span>`);

  const pillsHtml  = amenities.map(a => `<span class="property-amenity-pill">${escHtml(a)}</span>`).join('');
  const delayClass = delay > 0 ? ` fade-in-delay-${delay}` : '';

  return `
    <article class="property-card fade-in${delayClass}" role="article" data-property-id="${escHtml(p.id)}">
      <div class="property-media">
        <img class="property-img" src="${cover}" alt="${title}" loading="lazy"
          onerror="this.src='https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80'">
        <div class="property-info-overlay">
          <div class="property-tags">${badgesHtml}</div>
          <div class="property-bottom">
            <p class="property-location">${loc}</p>
            <h3 class="property-title">${title}</h3>
            <div class="property-meta-row">
              ${metaHtml.join('')}
              <span class="property-price-inline">${priceStr}<span class="property-price-unit"> / nuit</span></span>
            </div>
          </div>
        </div>
        <div class="property-hover-reveal">
          ${desc ? `<p class="property-desc-short">${desc}</p>` : ''}
          ${pillsHtml ? `<div class="property-amenity-pills">${pillsHtml}</div>` : ''}
          <button class="btn btn-primary btn-sm" data-reserve="${escHtml(p.id)}">
            R\u00e9server
            <svg width="12" height="12" viewBox="0 0 14 14" fill="none">
              <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </article>`;
}


/* ── Logements à venir ───────────────────────────────────────── */

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
  const cover = escHtml((u.media && u.media.coverImage) || '');
  const title = escHtml(u.title || '');
  const city  = u.location ? escHtml(u.location.city || '') : '';
  const date  = u.expectedDate ? _formatExpectedDate(u.expectedDate) : 'Bient\u00f4t';
  const delay = index > 0 ? ` fade-in-delay-${Math.min(index, 4)}` : '';

  return `
    <div class="upcoming-card fade-in${delay}">
      <img class="upcoming-card-img" src="${cover}" alt="${title}" loading="lazy"
        onerror="this.src='https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80'">
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
    const [y, m] = str.split('-');
    return new Date(parseInt(y), parseInt(m || 1) - 1)
      .toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  } catch { return str; }
}


/* ── Stats ───────────────────────────────────────────────────── */

function renderStats(stats) {
  const band = document.getElementById('stats-row');
  if (!band) return;

  const list = Array.isArray(stats) && stats.length > 0 ? stats : [
    { value: '4+',  label: 'R\u00e9sidences' },
    { value: '5',   label: 'Exp\u00e9rience' },
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


/* ── FAQ ─────────────────────────────────────────────────────── */

function renderFaq(items) {
  const list    = document.getElementById('faq-list');
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

  list.querySelectorAll('.faq-question').forEach(btn => {
    btn.addEventListener('click', () => {
      const item   = btn.closest('.faq-item');
      const isOpen = item.classList.contains('open');
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


/* ── Navigation ──────────────────────────────────────────────── */

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


/* ── Newsletter ──────────────────────────────────────────────── */

function initNewsletter() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const emailInput = form.querySelector('input[type="email"]');
    const email      = emailInput?.value?.trim();
    if (!email) return;

    const btn = form.querySelector('button[type="submit"]');
    if (btn) btn.disabled = true;

    try {
      await AureDB.addSubscriber(email);
      form.reset();
      showToast('Merci\u00a0! Vous serez inform\u00e9(e) en avant-premi\u00e8re.', 'success');
    } catch (err) {
      showToast(err.message === 'D\u00e9j\u00e0 inscrit'
        ? 'Cette adresse est d\u00e9j\u00e0 inscrite.'
        : 'Une erreur est survenue. Veuillez r\u00e9essayer.', 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  });
}


/* ── Formulaire contact ──────────────────────────────────────── */

function initContactForm(formspreeId) {
  const form = document.getElementById('contact-form');
  if (!form) return;

  if (formspreeId) form.action = `https://formspree.io/f/${formspreeId}`;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const submitBtn  = form.querySelector('[type="submit"]');
    const btnLabel   = submitBtn && submitBtn.querySelector('.btn-label');
    const successMsg = document.getElementById('contact-success');

    if (submitBtn) submitBtn.classList.add('loading');
    if (btnLabel)  btnLabel.textContent = 'Envoi en cours\u2026';

    try {
      const response = await fetch(form.action, {
        method: 'POST', body: new FormData(form),
        headers: { Accept: 'application/json' }
      });

      if (response.ok) {
        form.reset();
        if (successMsg) successMsg.classList.add('show');
        showToast('Message envoy\u00e9 avec succ\u00e8s\u00a0!', 'success');
        setTimeout(() => { if (successMsg) successMsg.classList.remove('show'); }, 7000);
      } else {
        throw new Error('Erreur serveur');
      }
    } catch {
      showToast('Erreur. Contactez-nous directement \u00e0 contact@aurelys.fr', 'error');
    } finally {
      if (submitBtn) submitBtn.classList.remove('loading');
      if (btnLabel)  btnLabel.textContent = 'Envoyer le message';
    }
  });
}


/* ── Animations fade-in ──────────────────────────────────────── */

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
  document.querySelectorAll('.fade-in:not(.visible)').forEach(el => _fadeObserver.observe(el));
}


/* ── Parallaxe hero ──────────────────────────────────────────── */

function initParallax() {
  const heroContent   = document.querySelector('.hero-content');
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


/* ── Toast notifications ─────────────────────────────────────── */

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

  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('show')));

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 450);
  }, 4500);
}


/* ── Sécurité HTML ───────────────────────────────────────────── */

function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.showToast = showToast;
window.escHtml   = escHtml;
