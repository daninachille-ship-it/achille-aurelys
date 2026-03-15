/**
 * mouse-tracker.js — Traqueur de souris fluide
 * Curseur personnalisé + effet spotlight sur le hero
 */

class MouseTracker {
  constructor() {
    this.mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.dot = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.ring = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    this.dotEl = null;
    this.ringEl = null;
    this.spotlightEl = null;
    this.raf = null;
    this.visible = false;
    this.ringScale = 1;
    this.ringTargetScale = 1;
    this.active = false;
  }

  init() {
    // Ne pas activer sur les appareils tactiles
    if (window.matchMedia('(hover: none)').matches) return;

    this._createElements();
    this._bindEvents();
    this._loop();
    this.active = true;
  }

  _createElements() {
    // Curseur central (point)
    this.dotEl = document.createElement('div');
    this.dotEl.className = 'cursor-dot';
    document.body.appendChild(this.dotEl);

    // Anneau suiveur (avec délai)
    this.ringEl = document.createElement('div');
    this.ringEl.className = 'cursor-ring';
    document.body.appendChild(this.ringEl);

    // Spotlight sur le hero
    this.spotlightEl = document.getElementById('hero-spotlight');
    if (!this.spotlightEl) {
      this.spotlightEl = document.createElement('div');
      this.spotlightEl.id = 'hero-spotlight';
      const hero = document.querySelector('.hero');
      if (hero) hero.appendChild(this.spotlightEl);
    }
  }

  _bindEvents() {
    // Suivi de la souris
    document.addEventListener('mousemove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      if (!this.visible) {
        this.visible = true;
        this.dotEl.classList.add('cursor-visible');
        this.ringEl.classList.add('cursor-visible');
        // Position initiale sans animation
        this.dot.x = e.clientX;
        this.dot.y = e.clientY;
        this.ring.x = e.clientX;
        this.ring.y = e.clientY;
      }

      // Spotlight sur le hero
      this._updateSpotlight(e);
    });

    // Masquer quand la souris quitte la fenêtre
    document.addEventListener('mouseleave', () => {
      this.visible = false;
      this.dotEl.classList.remove('cursor-visible');
      this.ringEl.classList.remove('cursor-visible');
    });

    document.addEventListener('mouseenter', () => {
      this.visible = true;
      this.dotEl.classList.add('cursor-visible');
      this.ringEl.classList.add('cursor-visible');
    });

    // Agrandir l'anneau sur les éléments interactifs
    const interactiveSelectors = 'a, button, [role="button"], input, textarea, select, label, .property-card, .btn';

    document.addEventListener('mouseover', (e) => {
      if (e.target.closest(interactiveSelectors)) {
        this.ringTargetScale = 1.8;
        this.ringEl.classList.add('cursor-hover');
        this.dotEl.classList.add('cursor-hover');
      }
    });

    document.addEventListener('mouseout', (e) => {
      if (e.target.closest(interactiveSelectors)) {
        this.ringTargetScale = 1;
        this.ringEl.classList.remove('cursor-hover');
        this.dotEl.classList.remove('cursor-hover');
      }
    });

    // Effet de clic
    document.addEventListener('mousedown', () => {
      this.dotEl.classList.add('cursor-click');
      this.ringEl.classList.add('cursor-click');
    });

    document.addEventListener('mouseup', () => {
      this.dotEl.classList.remove('cursor-click');
      this.ringEl.classList.remove('cursor-click');
    });
  }

  _updateSpotlight(e) {
    if (!this.spotlightEl) return;
    const hero = document.querySelector('.hero');
    if (!hero) return;

    const rect = hero.getBoundingClientRect();
    // N'afficher le spotlight que dans le hero
    if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      this.spotlightEl.style.background =
        `radial-gradient(circle 400px at ${x}px ${y}px, rgba(201,169,110,0.08) 0%, transparent 70%)`;
      this.spotlightEl.style.opacity = '1';
    } else {
      this.spotlightEl.style.opacity = '0';
    }
  }

  _lerp(a, b, t) {
    return a + (b - a) * t;
  }

  _loop() {
    if (!this.visible) {
      this.raf = requestAnimationFrame(() => this._loop());
      return;
    }

    // Le point suit exactement la souris
    this.dot.x = this._lerp(this.dot.x, this.mouse.x, 0.35);
    this.dot.y = this._lerp(this.dot.y, this.mouse.y, 0.35);

    // L'anneau suit avec inertie
    this.ring.x = this._lerp(this.ring.x, this.mouse.x, 0.1);
    this.ring.y = this._lerp(this.ring.y, this.mouse.y, 0.1);

    // Interpolation de l'échelle de l'anneau
    this.ringScale = this._lerp(this.ringScale, this.ringTargetScale, 0.12);

    // Appliquer les positions via transform (GPU accelerated)
    this.dotEl.style.transform = `translate(${this.dot.x}px, ${this.dot.y}px) translate(-50%, -50%)`;
    this.ringEl.style.transform = `translate(${this.ring.x}px, ${this.ring.y}px) translate(-50%, -50%) scale(${this.ringScale})`;

    this.raf = requestAnimationFrame(() => this._loop());
  }

  destroy() {
    if (this.raf) cancelAnimationFrame(this.raf);
    if (this.dotEl) this.dotEl.remove();
    if (this.ringEl) this.ringEl.remove();
    document.body.style.cursor = '';
    this.active = false;
  }
}

// Initialisation automatique
document.addEventListener('DOMContentLoaded', () => {
  const tracker = new MouseTracker();
  tracker.init();
  window._mouseTracker = tracker;
});
