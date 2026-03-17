/**
 * booking.js — Systeme de reservation et disponibilite AURELYS
 *
 * Fonctionnalites :
 * - Calendrier interactif avec dates bloquees
 * - Selection check-in / check-out
 * - Calcul du sejour et du prix total
 * - Frais de menage configurables
 * - Enregistrement des reservations
 * - Blocage automatique des dates apres confirmation
 * - Logique de disponibilite en temps reel
 */

'use strict';

/* =============================================================
   CONSTANTES
   ============================================================= */

const WEEKDAYS_FR = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

const MONTHS_FR = [
  'janvier', 'fevrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'aout', 'septembre', 'octobre', 'novembre', 'decembre'
];

const MONTHS_FR_ACCENTED = [
  'janvier', 'f\u00e9vrier', 'mars', 'avril', 'mai', 'juin',
  'juillet', 'ao\u00fbt', 'septembre', 'octobre', 'novembre', 'd\u00e9cembre'
];

const DEFAULT_CLEANING_FEE = 80;
const DEFAULT_CURRENCY     = 'EUR';
const DEFAULT_MIN_STAY     = 1;


/* =============================================================
   CLASSE : BookingCalendar
   Calendrier interactif de selection check-in / check-out
   ============================================================= */

class BookingCalendar {
  /**
   * @param {HTMLElement} container - Element DOM qui recevra le calendrier
   * @param {Object} options
   * @param {string}   options.propertyId   - Identifiant du logement
   * @param {string[]} options.blockedDates - Tableau de dates bloquees (YYYY-MM-DD)
   * @param {number}   options.minStay      - Sejour minimum en nuits (defaut : 1)
   * @param {Function} options.onSelect     - Callback(checkIn, checkOut) appele a la selection
   */
  constructor(container, options = {}) {
    if (!(container instanceof HTMLElement)) {
      throw new Error('[BookingCalendar] container must be a valid DOM element.');
    }

    this.container    = container;
    this.propertyId   = options.propertyId   || null;
    this.blockedDates = new Set(options.blockedDates || []);
    this.minStay      = options.minStay      || DEFAULT_MIN_STAY;
    this.onSelect     = options.onSelect     || null;

    /* State */
    const today       = new Date();
    this.currentYear  = today.getFullYear();
    this.currentMonth = today.getMonth(); /* 0-based */
    this.checkIn      = null; /* YYYY-MM-DD string */
    this.checkOut     = null; /* YYYY-MM-DD string */
    this.step         = 'checkin'; /* 'checkin' | 'checkout' */

    this.render();
  }

  /* ── Public API ──────────────────────────────────────────── */

  /**
   * Reconstructs the full calendar DOM inside this.container.
   */
  render() {
    this.container.innerHTML = '';
    this.container.className = 'aure-calendar';

    const wrapper = document.createElement('div');
    wrapper.appendChild(this._buildMonthHeader());
    wrapper.appendChild(this._buildWeekdayRow());
    wrapper.appendChild(this._buildDayGrid());

    const hint = document.createElement('p');
    hint.className = 'aure-calendar-hint';
    hint.textContent = this.step === 'checkin'
      ? 'Selectionnez votre date d\'arrivee'
      : 'Selectionnez votre date de depart';
    wrapper.appendChild(hint);

    this.container.appendChild(wrapper);
  }

  /**
   * Re-renders only the day grid and hint (preserves header/weekdays).
   * Used for month navigation to reduce flicker.
   */
  renderMonth() {
    const oldGrid = this.container.querySelector('.aure-calendar-grid');
    const oldHint = this.container.querySelector('.aure-calendar-hint');
    const oldMonth = this.container.querySelector('.aure-calendar-month');

    if (oldGrid)  oldGrid.replaceWith(this._buildDayGrid());
    if (oldHint)  oldHint.textContent = this.step === 'checkin'
      ? 'Selectionnez votre date d\'arrivee'
      : 'Selectionnez votre date de depart';
    if (oldMonth) oldMonth.textContent = this._monthLabel();
  }

  /** Navigate to the next calendar month. */
  nextMonth() {
    this.currentMonth += 1;
    if (this.currentMonth > 11) {
      this.currentMonth = 0;
      this.currentYear += 1;
    }
    this.renderMonth();
  }

  /** Navigate to the previous calendar month (not before current month). */
  prevMonth() {
    const today = new Date();
    const minYear  = today.getFullYear();
    const minMonth = today.getMonth();

    if (
      this.currentYear > minYear ||
      (this.currentYear === minYear && this.currentMonth > minMonth)
    ) {
      this.currentMonth -= 1;
      if (this.currentMonth < 0) {
        this.currentMonth = 11;
        this.currentYear -= 1;
      }
      this.renderMonth();
    }
  }

  /**
   * Handles a date-cell click.
   * First click: sets check-in.  Second click: sets check-out (if valid).
   * @param {string} dateStr - YYYY-MM-DD
   */
  selectDate(dateStr) {
    if (this.isBlocked(dateStr)) return;
    if (this._isPast(dateStr))   return;

    if (this.step === 'checkin') {
      this.checkIn  = dateStr;
      this.checkOut = null;
      this.step     = 'checkout';
      this.renderMonth();
      return;
    }

    /* step === 'checkout' */
    if (dateStr <= this.checkIn) {
      /* Clicked a date before or equal to check-in — restart */
      this.checkIn  = dateStr;
      this.checkOut = null;
      this.step     = 'checkout';
      this.renderMonth();
      return;
    }

    /* Validate minimum stay */
    const nights = this._calcNightsRaw(this.checkIn, dateStr);
    if (nights < this.minStay) {
      /* Show brief hint but do not advance */
      const hint = this.container.querySelector('.aure-calendar-hint');
      if (hint) {
        hint.textContent = `Sejour minimum : ${this.minStay} nuit${this.minStay > 1 ? 's' : ''}`;
        hint.style.color = 'var(--color-error)';
        setTimeout(() => {
          hint.textContent = 'Selectionnez votre date de depart';
          hint.style.color = '';
        }, 2000);
      }
      return;
    }

    /* Check for blocked dates inside the range */
    if (this._rangeContainsBlocked(this.checkIn, dateStr)) {
      const hint = this.container.querySelector('.aure-calendar-hint');
      if (hint) {
        hint.textContent = 'Cette periode contient des dates indisponibles';
        hint.style.color = 'var(--color-error)';
        setTimeout(() => {
          hint.textContent = 'Selectionnez votre date de depart';
          hint.style.color = '';
        }, 2500);
      }
      return;
    }

    this.checkOut = dateStr;
    this.step     = 'done';
    this.renderMonth();

    if (typeof this.onSelect === 'function') {
      this.onSelect(this.checkIn, this.checkOut);
    }
  }

  /**
   * Returns true if a date is in the blocked set.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {boolean}
   */
  isBlocked(dateStr) {
    return this.blockedDates.has(dateStr);
  }

  /**
   * Returns true if a date falls inside the currently selected range.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {boolean}
   */
  isInRange(dateStr) {
    if (!this.checkIn || !this.checkOut) return false;
    return dateStr > this.checkIn && dateStr < this.checkOut;
  }

  /**
   * Resets selection back to initial state.
   */
  reset() {
    this.checkIn  = null;
    this.checkOut = null;
    this.step     = 'checkin';
    this.renderMonth();
  }

  /**
   * Update the blocked dates list and re-render.
   * @param {string[]} dates
   */
  setBlockedDates(dates) {
    this.blockedDates = new Set(dates);
    this.renderMonth();
  }

  /* ── Private builders ────────────────────────────────────── */

  _buildMonthHeader() {
    const header = document.createElement('div');
    header.className = 'aure-calendar-header';

    const prevBtn = document.createElement('button');
    prevBtn.className     = 'aure-calendar-nav';
    prevBtn.type          = 'button';
    prevBtn.setAttribute('aria-label', 'Mois precedent');
    prevBtn.innerHTML     = '&#8249;'; /* single left angle quotation */
    prevBtn.addEventListener('click', () => this.prevMonth());

    const monthLabel = document.createElement('span');
    monthLabel.className  = 'aure-calendar-month';
    monthLabel.textContent = this._monthLabel();

    const nextBtn = document.createElement('button');
    nextBtn.className     = 'aure-calendar-nav';
    nextBtn.type          = 'button';
    nextBtn.setAttribute('aria-label', 'Mois suivant');
    nextBtn.innerHTML     = '&#8250;'; /* single right angle quotation */
    nextBtn.addEventListener('click', () => this.nextMonth());

    header.appendChild(prevBtn);
    header.appendChild(monthLabel);
    header.appendChild(nextBtn);
    return header;
  }

  _buildWeekdayRow() {
    const row = document.createElement('div');
    row.className = 'aure-calendar-weekdays';
    WEEKDAYS_FR.forEach(day => {
      const cell = document.createElement('div');
      cell.className   = 'aure-calendar-weekday';
      cell.textContent = day;
      row.appendChild(cell);
    });
    return row;
  }

  _buildDayGrid() {
    const grid = document.createElement('div');
    grid.className = 'aure-calendar-grid';

    const todayStr = this._todayStr();

    /* First day of the displayed month (0=Sunday…6=Saturday, rebase to Mon=0) */
    const firstDay  = new Date(this.currentYear, this.currentMonth, 1);
    const startWeekday = (firstDay.getDay() + 6) % 7; /* Monday = 0 */

    /* Total days in this month */
    const daysInMonth = new Date(this.currentYear, this.currentMonth + 1, 0).getDate();

    /* Total cells: 6 rows x 7 cols */
    const totalCells = 42;

    for (let i = 0; i < totalCells; i++) {
      const dayNum = i - startWeekday + 1;

      const cell = document.createElement('div');

      if (dayNum < 1 || dayNum > daysInMonth) {
        /* Outside current month — render empty placeholder */
        cell.className = 'aure-calendar-day other-month';
        cell.setAttribute('aria-hidden', 'true');
        grid.appendChild(cell);
        continue;
      }

      const dateStr = this._toDateStr(this.currentYear, this.currentMonth, dayNum);
      const isPast    = dateStr < todayStr;
      const isBlocked = this.isBlocked(dateStr);
      const isToday   = dateStr === todayStr;
      const isStart   = dateStr === this.checkIn;
      const isEnd     = dateStr === this.checkOut;
      const isRange   = this.isInRange(dateStr);

      /* Build class list */
      const classes = ['aure-calendar-day'];
      if (isPast || isBlocked) {
        classes.push(isPast ? 'past' : 'blocked');
      } else {
        classes.push('available');
      }
      if (isToday)  classes.push('today');
      if (isStart)  classes.push('selected-start');
      if (isEnd)    classes.push('selected-end');
      if (isRange)  classes.push('in-range');

      cell.className   = classes.join(' ');
      cell.textContent = String(dayNum);
      cell.setAttribute('data-date', dateStr);
      cell.setAttribute('aria-label', dateStr);
      cell.setAttribute('role', 'button');
      cell.setAttribute('tabindex', isPast || isBlocked ? '-1' : '0');

      if (!isPast && !isBlocked) {
        cell.addEventListener('click', () => this.selectDate(dateStr));
        cell.addEventListener('keydown', e => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            this.selectDate(dateStr);
          }
        });
      }

      grid.appendChild(cell);
    }

    return grid;
  }

  /* ── Private helpers ─────────────────────────────────────── */

  _monthLabel() {
    return `${MONTHS_FR_ACCENTED[this.currentMonth]} ${this.currentYear}`;
  }

  _todayStr() {
    return this._toDateStr(
      new Date().getFullYear(),
      new Date().getMonth(),
      new Date().getDate()
    );
  }

  /** Zero-padded YYYY-MM-DD string. */
  _toDateStr(year, month, day) {
    const m = String(month + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    return `${year}-${m}-${d}`;
  }

  _isPast(dateStr) {
    return dateStr < this._todayStr();
  }

  _calcNightsRaw(checkIn, checkOut) {
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    return Math.round((b - a) / 86400000);
  }

  /** Returns true if any date in [checkIn, checkOut) is blocked. */
  _rangeContainsBlocked(checkIn, checkOut) {
    const cur = new Date(checkIn);
    cur.setDate(cur.getDate() + 1); /* start checking day after check-in */
    const end = new Date(checkOut);
    while (cur < end) {
      const str = cur.toISOString().slice(0, 10);
      if (this.isBlocked(str)) return true;
      cur.setDate(cur.getDate() + 1);
    }
    return false;
  }
}


/* =============================================================
   CLASSE : BookingCalculator
   Calcul des tarifs et formatage
   ============================================================= */

class BookingCalculator {
  /**
   * @param {Object} property - Objet logement depuis AureStorage
   */
  constructor(property) {
    this.property = property || {};
  }

  /**
   * Calcule le nombre de nuits entre deux dates.
   * @param {string} checkIn  - YYYY-MM-DD
   * @param {string} checkOut - YYYY-MM-DD
   * @returns {number}
   */
  calcNights(checkIn, checkOut) {
    if (!checkIn || !checkOut) return 0;
    const a = new Date(checkIn);
    const b = new Date(checkOut);
    if (isNaN(a) || isNaN(b) || b <= a) return 0;
    return Math.round((b - a) / 86400000);
  }

  /**
   * Calcule le prix total d'un sejour.
   * @param {string} checkIn  - YYYY-MM-DD
   * @param {string} checkOut - YYYY-MM-DD
   * @returns {{ nights, pricePerNight, subtotal, cleaningFee, total, currency }}
   */
  calcTotal(checkIn, checkOut) {
    const nights       = this.calcNights(checkIn, checkOut);
    const pricePerNight = (this.property.pricing && this.property.pricing.perNight) || 0;
    const cleaningFee  = (this.property.pricing && this.property.pricing.cleaningFee) || DEFAULT_CLEANING_FEE;
    const currency     = (this.property.pricing && this.property.pricing.currency)   || DEFAULT_CURRENCY;

    const subtotal = nights * pricePerNight;
    const total    = subtotal + cleaningFee;

    return { nights, pricePerNight, subtotal, cleaningFee, total, currency };
  }

  /**
   * Formats a price amount as a localized string.
   * @param {number} amount
   * @param {string} currency - ISO 4217 (ex: 'EUR')
   * @returns {string} e.g. "320 \u20ac"
   */
  formatPrice(amount, currency) {
    if (typeof amount !== 'number' || isNaN(amount)) return '—';
    const cur = currency || DEFAULT_CURRENCY;
    try {
      return new Intl.NumberFormat('fr-FR', {
        style:    'currency',
        currency: cur,
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(amount);
    } catch {
      /* Fallback for environments without Intl */
      return `${amount} ${cur}`;
    }
  }

  /**
   * Formats a date string in French long form.
   * @param {string} dateStr - YYYY-MM-DD
   * @returns {string} e.g. "15 mars 2026"
   */
  formatDateFr(dateStr) {
    if (!dateStr) return '';
    /* Avoid timezone drift: parse as local date */
    const parts = dateStr.split('-');
    if (parts.length < 3) return dateStr;
    const year  = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; /* 0-based */
    const day   = parseInt(parts[2], 10);
    return `${day} ${MONTHS_FR_ACCENTED[month]} ${year}`;
  }
}


/* =============================================================
   FONCTION : initBookingModal
   Ouvre et pilote la modale de reservation pour un logement
   ============================================================= */

/**
 * Initialise et ouvre la modale de reservation pour un logement donne.
 * Cree le DOM de la modale si absent, injecte le contenu, branche les evenements.
 *
 * @param {string} propertyId - ID du logement (ex: 'prop_1')
 */
function initBookingModal(propertyId) {
  /* ── 1. Recuperer les donnees du logement ──────────────── */
  if (!window.AureStorage) {
    console.error('[AureBooking] AureStorage not found. Ensure storage.js is loaded first.');
    return;
  }

  const property = window.AureStorage.getPropertyById(propertyId);
  if (!property) {
    console.error(`[AureBooking] Property not found: ${propertyId}`);
    return;
  }

  const blockedDates = window.AureStorage.getBlockedDates(propertyId);
  const calculator   = new BookingCalculator(property);
  const minStay      = (property.pricing && property.pricing.minimumStay) || DEFAULT_MIN_STAY;

  /* ── 2. Obtenir ou creer l'overlay modal ───────────────── */
  let overlay = document.getElementById('booking-modal-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id        = 'booking-modal-overlay';
    overlay.className = 'modal-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.setAttribute('aria-labelledby', 'booking-modal-title');
    document.body.appendChild(overlay);

    /* Close on backdrop click */
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) _closeModal(overlay);
    });

    /* Close on Escape key */
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && overlay.classList.contains('open')) {
        _closeModal(overlay);
      }
    });
  }

  /* ── 3. Construire le contenu de la modale ─────────────── */
  const coverImg = (property.media && property.media.coverImage) || '';
  const priceStr = calculator.formatPrice(
    property.pricing ? property.pricing.perNight : 0,
    property.pricing ? property.pricing.currency : DEFAULT_CURRENCY
  );

  overlay.innerHTML = `
    <div class="modal" id="booking-modal-card">
      <!-- En-tete -->
      <div class="modal-header">
        <h2 class="modal-title" id="booking-modal-title">Reserver ce logement</h2>
        <button class="modal-close" id="booking-modal-close" type="button" aria-label="Fermer">&times;</button>
      </div>

      <!-- Apercu du logement (cliquable → fiche produit) -->
      <a class="modal-property-preview" href="residence.html?id=${_escapeAttr(propertyId)}" title="Voir la fiche du logement" style="text-decoration:none;display:flex;align-items:center;gap:14px;cursor:pointer;">
        ${coverImg ? `<img class="modal-prop-img" src="${_escapeAttr(coverImg)}" alt="${_escapeAttr(property.title)}" loading="lazy">` : ''}
        <div class="modal-prop-info">
          <div class="modal-prop-name">${_escapeHtml(property.title)}</div>
          <div class="modal-prop-price">${priceStr} / nuit</div>
        </div>
      </a>

      <!-- Etape 1 : Calendrier -->
      <div class="form-group" id="booking-calendar-section">
        <label class="form-label">Vos dates</label>
        <div id="booking-calendar-container"></div>
      </div>

      <!-- Recap des dates selectionnees -->
      <div id="booking-dates-summary" style="display:none;">
        <div class="modal-summary" id="booking-price-summary">
          <!-- Rempli dynamiquement -->
        </div>
      </div>

      <!-- Nombre de voyageurs -->
      <div class="form-group" style="margin-top:16px;">
        <label class="form-label">Voyageurs</label>
        <div class="guest-stepper">
          <button type="button" id="guest-dec" aria-label="Diminuer">&#8722;</button>
          <span class="guest-stepper-value" id="guest-count">2</span>
          <button type="button" id="guest-inc" aria-label="Augmenter">&#43;</button>
        </div>
      </div>

      <!-- Formulaire d'informations personnelles -->
      <form class="form" id="booking-form" novalidate style="margin-top:20px;">
        <div class="form-row">
          <div class="form-group">
            <label class="form-label" for="booking-name">Nom complet <span style="color:var(--color-error)">*</span></label>
            <input class="form-input" type="text" id="booking-name" name="name" placeholder="Jean Dupont" autocomplete="name" required>
          </div>
          <div class="form-group">
            <label class="form-label" for="booking-email">Email <span style="color:var(--color-error)">*</span></label>
            <input class="form-input" type="email" id="booking-email" name="email" placeholder="jean@example.com" autocomplete="email" required>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label" for="booking-phone">Telephone</label>
          <input class="form-input" type="tel" id="booking-phone" name="phone" placeholder="+33 6 00 00 00 00" autocomplete="tel">
        </div>
        <div class="form-group">
          <label class="form-label" for="booking-message">Message (optionnel)</label>
          <textarea class="form-textarea" id="booking-message" name="message" rows="3" placeholder="Informations complementaires, demandes speciales..."></textarea>
        </div>

        <!-- Message d'erreur global -->
        <div id="booking-error" class="form-success" style="border-color:var(--color-error);background:var(--color-error-dim);color:var(--color-error);display:none;"></div>

        <button type="submit" class="btn btn-primary" id="booking-submit" style="width:100%;justify-content:center;" disabled>
          Confirmer la demande
        </button>
      </form>
    </div>
  `;

  /* ── 4. Monter le calendrier ───────────────────────────── */
  const calContainer = document.getElementById('booking-calendar-container');
  const calendar = new BookingCalendar(calContainer, {
    propertyId:   propertyId,
    blockedDates: blockedDates,
    minStay:      minStay,
    onSelect:     (checkIn, checkOut) => {
      _onDatesSelected(checkIn, checkOut, calculator, property);
    },
  });

  /* ── 5. Voyageurs stepper ──────────────────────────────── */
  let guestCount = 2;
  const maxGuests = (property.capacity && property.capacity.guests) || 10;

  const guestDisplay = document.getElementById('guest-count');
  const guestDec     = document.getElementById('guest-dec');
  const guestInc     = document.getElementById('guest-inc');

  guestDec.addEventListener('click', () => {
    if (guestCount > 1) {
      guestCount -= 1;
      guestDisplay.textContent = String(guestCount);
    }
  });

  guestInc.addEventListener('click', () => {
    if (guestCount < maxGuests) {
      guestCount += 1;
      guestDisplay.textContent = String(guestCount);
    }
  });

  /* ── 6. Fermer la modale ───────────────────────────────── */
  document.getElementById('booking-modal-close').addEventListener('click', () => {
    _closeModal(overlay);
  });

  /* ── 7. Soumission du formulaire ───────────────────────── */
  document.getElementById('booking-form').addEventListener('submit', (e) => {
    e.preventDefault();

    const name    = document.getElementById('booking-name').value.trim();
    const email   = document.getElementById('booking-email').value.trim();
    const phone   = document.getElementById('booking-phone').value.trim();
    const message = document.getElementById('booking-message').value.trim();
    const errorEl = document.getElementById('booking-error');

    /* Validation basique */
    const errors = [];
    if (!name)                              errors.push('Veuillez indiquer votre nom.');
    if (!email || !_isValidEmail(email))    errors.push('Veuillez indiquer un email valide.');
    if (!calendar.checkIn || !calendar.checkOut) errors.push('Veuillez selectionner vos dates de sejour.');

    if (errors.length) {
      errorEl.textContent = errors.join(' ');
      errorEl.style.display = 'block';
      return;
    }

    errorEl.style.display = 'none';

    /* Verifier la disponibilite une derniere fois */
    if (!isRangeAvailable(propertyId, calendar.checkIn, calendar.checkOut)) {
      errorEl.textContent = 'Ces dates ne sont plus disponibles. Veuillez en choisir d\'autres.';
      errorEl.style.display = 'block';
      calendar.reset();
      return;
    }

    const totals = calculator.calcTotal(calendar.checkIn, calendar.checkOut);

    /* Construire l'objet reservation */
    const reservationId = window.AureStorage.generateId('rsv');
    const reservation = {
      id:            reservationId,
      propertyId:    propertyId,
      propertyTitle: property.title,
      status:        'pending_payment',
      guest: {
        name:  name,
        email: email,
        phone: phone,
      },
      dates: {
        checkIn:  calendar.checkIn,
        checkOut: calendar.checkOut,
        nights:   totals.nights,
      },
      pricing: {
        perNight:    totals.pricePerNight,
        nights:      totals.nights,
        cleaningFee: totals.cleaningFee,
        total:       totals.total,
        currency:    totals.currency,
      },
      guests:     guestCount,
      message:    message,
      createdAt:  new Date().toISOString(),
      paymentLink: property.paymentLink || '',
    };

    /* Sauvegarder la reservation */
    _saveReservation(reservation);

    /* Bloquer les dates immediatement */
    blockDatesAfterPayment(propertyId, calendar.checkIn, calendar.checkOut);

    /* Paiement dynamique via Stripe Checkout */
    _redirectToStripeCheckout(overlay, reservation, calculator, totals);
  });

  /* ── 8. Ouvrir la modale ───────────────────────────────── */
  requestAnimationFrame(() => {
    overlay.classList.add('open');
    /* Trap focus inside modal */
    const firstFocusable = overlay.querySelector('button, input, textarea, select, [tabindex="0"]');
    if (firstFocusable) firstFocusable.focus();
  });
}


/* =============================================================
   HELPERS PRIVES — initBookingModal
   ============================================================= */

/**
 * Met a jour le recapitulatif de prix apres selection des dates.
 */
function _onDatesSelected(checkIn, checkOut, calculator, property) {
  const summaryWrapper = document.getElementById('booking-dates-summary');
  const summaryEl      = document.getElementById('booking-price-summary');
  const submitBtn      = document.getElementById('booking-submit');

  if (!summaryWrapper || !summaryEl) return;

  const totals = calculator.calcTotal(checkIn, checkOut);

  summaryEl.innerHTML = `
    <div class="modal-summary-row">
      <span>Arrivee</span>
      <span>${calculator.formatDateFr(checkIn)}</span>
    </div>
    <div class="modal-summary-row">
      <span>Depart</span>
      <span>${calculator.formatDateFr(checkOut)}</span>
    </div>
    <div class="modal-summary-row">
      <span>${calculator.formatPrice(totals.pricePerNight, totals.currency)} x ${totals.nights} nuit${totals.nights > 1 ? 's' : ''}</span>
      <span>${calculator.formatPrice(totals.subtotal, totals.currency)}</span>
    </div>
    <div class="modal-summary-row">
      <span>Frais de menage</span>
      <span>${calculator.formatPrice(totals.cleaningFee, totals.currency)}</span>
    </div>
    <div class="modal-summary-row modal-summary-total">
      <span>Total</span>
      <span>${calculator.formatPrice(totals.total, totals.currency)}</span>
    </div>
  `;

  summaryWrapper.style.display = 'block';
  if (submitBtn) submitBtn.removeAttribute('disabled');
}

/**
 * Sauvegarde la reservation dans Supabase via AureDB.
 * Fallback localStorage si Supabase non configure.
 */
function _saveReservation(reservation) {
  if (window.AureDB && window.AureDB.isConfigured()) {
    window.AureDB.createReservation(reservation).catch(e => {
      console.error('[AureBooking] Erreur sauvegarde Supabase:', e);
    });
  } else {
    try {
      const key  = 'aurelys_reservations_local';
      const list = JSON.parse(localStorage.getItem(key) || '[]');
      list.push(reservation);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (e) {
      console.error('[AureBooking] Erreur sauvegarde locale:', e);
    }
  }
}

/**
 * Appelle la Netlify Function create-checkout pour obtenir l'URL Stripe,
 * puis redirige le visiteur. Affiche un écran de chargement pendant l'appel,
 * et la confirmation classique si la function est indisponible.
 */
async function _redirectToStripeCheckout(overlay, reservation, calculator, totals) {
  const card = document.getElementById('booking-modal-card');
  if (!card) return;

  /* Écran de chargement */
  card.innerHTML = `
    <div style="text-align:center;padding:40px 20px;">
      <div class="booking-spinner" aria-label="Chargement..." style="
        width:40px;height:40px;border-radius:50%;
        border:2px solid var(--color-border);
        border-top-color:var(--color-accent);
        animation:aure-spin .8s linear infinite;
        margin:0 auto 20px;
      "></div>
      <p style="color:var(--color-text-secondary);font-size:var(--text-sm);">
        Préparation du paiement…
      </p>
    </div>
  `;

  /* S'assurer que le style d'animation existe */
  if (!document.getElementById('aure-spin-style')) {
    const style = document.createElement('style');
    style.id = 'aure-spin-style';
    style.textContent = '@keyframes aure-spin{to{transform:rotate(360deg)}}';
    document.head.appendChild(style);
  }

  try {
    const res = await fetch('/.netlify/functions/create-checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        reservationId: reservation.id,
        propertyTitle: reservation.propertyTitle,
        pricing: {
          subtotal:    totals.subtotal,
          cleaningFee: totals.cleaningFee,
          total:       totals.total,
          currency:    totals.currency,
          perNight:    totals.pricePerNight,
          nights:      totals.nights,
        },
        guest: reservation.guest,
        dates: reservation.dates,
      }),
    });

    const data = await res.json();

    if (res.ok && data.url) {
      window.location.href = data.url;
      return;
    }

    /* Erreur Stripe → fallback confirmation classique */
    console.error('[AureBooking] Stripe checkout error:', data.error);
    _showConfirmation(overlay, reservation, calculator);

  } catch (err) {
    /* Réseau indisponible ou function absente → fallback */
    console.error('[AureBooking] create-checkout unreachable:', err.message);
    _showConfirmation(overlay, reservation, calculator);
  }
}

/**
 * Affiche l'ecran de confirmation dans la modale.
 * Si la propriete a un paymentLink, declenche un compte a rebours de redirection.
 */
function _showConfirmation(overlay, reservation, calculator) {
  const card = document.getElementById('booking-modal-card');
  if (!card) return;

  const hasPaymentLink = Boolean(reservation.paymentLink);
  const dateStr = `${calculator.formatDateFr(reservation.dates.checkIn)} - ${calculator.formatDateFr(reservation.dates.checkOut)}`;
  const totalStr = calculator.formatPrice(reservation.pricing.total, reservation.pricing.currency);

  card.innerHTML = `
    <div style="text-align:center;padding:20px 0;">
      <div style="width:56px;height:56px;border-radius:50%;background:var(--color-accent-dim);border:1px solid var(--color-accent);display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:22px;color:var(--color-accent);">
        &#10003;
      </div>
      <h2 class="modal-title" style="margin-bottom:10px;font-size:var(--text-xl);">Demande envoyee</h2>
      <p style="color:var(--color-text-secondary);font-size:var(--text-sm);line-height:1.7;max-width:380px;margin:0 auto 24px;">
        Votre demande de reservation a bien ete enregistree. Vous allez recevoir une confirmation.
      </p>

      <div class="modal-summary" style="text-align:left;margin-bottom:24px;">
        <div class="modal-summary-row">
          <span>Logement</span>
          <span>${_escapeHtml(reservation.propertyTitle)}</span>
        </div>
        <div class="modal-summary-row">
          <span>Sejour</span>
          <span>${dateStr}</span>
        </div>
        <div class="modal-summary-row">
          <span>Voyageurs</span>
          <span>${reservation.guests}</span>
        </div>
        <div class="modal-summary-row modal-summary-total">
          <span>Total</span>
          <span>${totalStr}</span>
        </div>
      </div>

      <p style="font-size:var(--text-xs);color:var(--color-text-dim);margin-bottom:20px;">
        Ref. : ${_escapeHtml(reservation.id)}
      </p>

      ${hasPaymentLink ? `
        <div class="modal-redirect-info" style="text-align:left;margin-bottom:20px;">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
            <circle cx="8" cy="8" r="7" stroke="currentColor" stroke-width="1.4"/>
            <path d="M8 5v3.5l2 1.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
          <span>Vous allez etre redirige vers la page de paiement dans <strong id="redirect-countdown">5</strong> secondes.</span>
        </div>
      ` : ''}

      <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap;">
        ${hasPaymentLink ? `<a href="${_escapeAttr(reservation.paymentLink)}" class="btn btn-primary" id="pay-now-btn">Payer maintenant</a>` : ''}
        <button type="button" class="btn btn-outline" id="confirmation-close-btn">Fermer</button>
      </div>
    </div>
  `;

  /* Close button */
  const closeBtn = document.getElementById('confirmation-close-btn');
  if (closeBtn) closeBtn.addEventListener('click', () => _closeModal(overlay));

  /* Countdown redirect */
  if (hasPaymentLink) {
    let seconds = 5;
    const countdownEl = document.getElementById('redirect-countdown');
    const timer = setInterval(() => {
      seconds -= 1;
      if (countdownEl) countdownEl.textContent = String(seconds);
      if (seconds <= 0) {
        clearInterval(timer);
        window.location.href = reservation.paymentLink;
      }
    }, 1000);

    /* Cancel redirect if user clicks the manual link */
    const payBtn = document.getElementById('pay-now-btn');
    if (payBtn) {
      payBtn.addEventListener('click', () => clearInterval(timer));
    }
  }
}

function _closeModal(overlay) {
  overlay.classList.remove('open');
}

function _isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function _escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function _escapeAttr(str) {
  return _escapeHtml(str);
}


/* =============================================================
   FONCTION : blockDatesAfterPayment
   Marque les dates comme bloquees apres confirmation du paiement
   ============================================================= */

/**
 * Ajoute toutes les dates du sejour a property.blockedDates et sauvegarde.
 *
 * @param {string} propertyId
 * @param {string} checkIn  - YYYY-MM-DD
 * @param {string} checkOut - YYYY-MM-DD
 */
function blockDatesAfterPayment(propertyId, checkIn, checkOut) {
  if (!propertyId || !checkIn || !checkOut) return;

  if (window.AureDB && window.AureDB.isConfigured()) {
    // Les dates sont bloquees automatiquement par AureDB.createReservation
    return;
  }

  // Fallback : mettre a jour le cache local
  try {
    if (!window._aureBlockedDates) window._aureBlockedDates = {};
    if (!window._aureBlockedDates[propertyId]) window._aureBlockedDates[propertyId] = [];
    const newDates = _expandDateRange(checkIn, checkOut);
    const existing = new Set(window._aureBlockedDates[propertyId]);
    newDates.forEach(d => existing.add(d));
    window._aureBlockedDates[propertyId] = Array.from(existing).sort();
  } catch (e) {
    console.error('[AureBooking] blockDatesAfterPayment error:', e);
  }
}


/* =============================================================
   FONCTION : isRangeAvailable
   Verifie qu'aucune date d'une plage n'est bloquee
   ============================================================= */

/**
 * Retourne true si la plage de dates est entierement disponible.
 * Prend en compte les blockedDates du logement ET les reservations existantes.
 *
 * @param {string} propertyId
 * @param {string} checkIn  - YYYY-MM-DD
 * @param {string} checkOut - YYYY-MM-DD
 * @returns {boolean}
 */
function isRangeAvailable(propertyId, checkIn, checkOut) {
  if (!window.AureStorage) return false;
  if (!propertyId || !checkIn || !checkOut) return false;
  if (checkOut <= checkIn) return false;

  try {
    /* Get all blocked dates (includes existing confirmed reservations) */
    const blocked = new Set(window.AureStorage.getBlockedDates(propertyId));
    const rangeDates = _expandDateRange(checkIn, checkOut);

    for (const date of rangeDates) {
      if (blocked.has(date)) return false;
    }
    return true;
  } catch (e) {
    console.error('[AureBooking] isRangeAvailable error:', e);
    return false;
  }
}


/* =============================================================
   UTILITAIRE PRIVE : _expandDateRange
   ============================================================= */

/**
 * Returns an array of YYYY-MM-DD strings for every night of a stay.
 * The checkout date itself is not included (standard rental convention).
 *
 * @param {string} checkIn
 * @param {string} checkOut
 * @returns {string[]}
 */
function _expandDateRange(checkIn, checkOut) {
  const dates = [];
  const cur   = new Date(checkIn);
  const end   = new Date(checkOut);
  while (cur < end) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dates;
}


/* =============================================================
   EXPORT GLOBAL
   ============================================================= */

window.AureBooking = {
  BookingCalendar,
  BookingCalculator,
  initBookingModal,
  blockDatesAfterPayment,
  isRangeAvailable,
};
