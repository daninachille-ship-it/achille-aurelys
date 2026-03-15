/**
 * storage.js — Couche de persistance AURELYS v2
 *
 * Architecture :
 * - Schéma de données complet et versionné
 * - Couche d'abstraction prête pour migration Supabase / Firebase
 * - Séparation claire : contenu | logements | réservations | paramètres
 * - Synchronisation multi-onglets via StorageEvent
 */

const STORAGE_KEY = 'aurelys_v2';
const STORAGE_VERSION = 2;

/* ================================================================
   SCHÉMA PAR DÉFAUT
   ================================================================ */

const DEFAULT_DATA = {
  _version: STORAGE_VERSION,
  _updatedAt: null,

  /* ── Logements ─────────────────────────────────────────── */
  properties: [
    {
      id: 'prop_1',
      slug: 'appartement-canal-saint-martin',
      title: 'Appartement Canal Saint-Martin',
      subtitle: 'Loft industriel avec vue sur le canal',
      description: "Un loft d'exception niché au bord du Canal Saint-Martin. Volumes généreux, verrières industrielles et mobilier soigneusement sélectionné créent une atmosphère unique à la croisée de l'élégance contemporaine et du charme parisien authentique.",
      shortDescription: "Loft industriel avec vue canal, au coeur du 10e arrondissement.",
      location: {
        city: 'Paris',
        country: 'France',
        address: 'Canal Saint-Martin, 75010 Paris',
        area: '10e arrondissement',
        lat: 48.8698,
        lng: 2.3635
      },
      pricing: {
        perNight: 320,
        cleaningFee: 80,
        currency: 'EUR',
        minimumStay: 2
      },
      capacity: {
        guests: 4,
        bedrooms: 2,
        beds: 2,
        bathrooms: 1
      },
      media: {
        coverImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
        gallery: [
          'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
          'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85',
          'https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200&q=85',
          'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=85'
        ]
      },
      amenities: ['Wifi haut débit', 'Cuisine équipée', 'Machine à café', 'Vue canal', 'Parquet ancien', 'Verrières industrielles', 'Draps et serviettes', 'Chauffage', 'Smart TV'],
      rules: ['Non-fumeur', 'Animaux non admis', 'Pas de fêtes', 'Départ avant 11h'],
      checkIn: '15h00',
      checkOut: '11h00',
      badges: ['Coup de coeur'],
      featured: true,
      upcoming: false,
      available: true,
      paymentLink: '',
      contactEmail: '',
      formspreeId: '',
      seo: {
        title: 'Appartement Canal Saint-Martin — AURELYS',
        description: "Location d'un loft industriel avec vue sur le Canal Saint-Martin, Paris 10e."
      },
      blockedDates: [],
      order: 0
    },
    {
      id: 'prop_2',
      slug: 'villa-luberon',
      title: 'Villa du Luberon',
      subtitle: 'Mas provençal restauré au coeur du Luberon',
      description: "Un mas provençal du XVIIIe siècle entièrement restauré dans le respect des matières et des volumes d'origine. Pierre, bois, lin : chaque détail a été pensé pour offrir une retraite absolue au coeur du Luberon. Piscine à débordement, jardin de lavande et vue sur le massif.",
      shortDescription: "Mas du XVIIIe siècle, piscine et vue sur le Luberon.",
      location: {
        city: 'Lacoste',
        country: 'France',
        address: 'Route des Crêtes, Lacoste, 84480',
        area: 'Luberon, Provence',
        lat: 43.8297,
        lng: 5.4011
      },
      pricing: {
        perNight: 580,
        cleaningFee: 150,
        currency: 'EUR',
        minimumStay: 3
      },
      capacity: {
        guests: 8,
        bedrooms: 4,
        beds: 5,
        bathrooms: 3
      },
      media: {
        coverImage: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=85',
        gallery: [
          'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=85',
          'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=85',
          'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=85',
          'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=85'
        ]
      },
      amenities: ['Piscine à débordement', 'Jardin de lavande', 'Cuisine provençale', 'Terrasse panoramique', 'Barbecue', 'Wifi', 'Parking', 'Draps et serviettes', 'Climatisation'],
      rules: ['Non-fumeur (intérieur)', 'Animaux sur demande', 'Séjour minimum 3 nuits'],
      checkIn: '16h00',
      checkOut: '10h00',
      badges: ['Exclusivité', 'Vue panoramique'],
      featured: true,
      upcoming: false,
      available: true,
      paymentLink: '',
      contactEmail: '',
      formspreeId: '',
      seo: {
        title: 'Villa du Luberon — AURELYS',
        description: "Mas provençal du XVIIIe siècle avec piscine à débordement au coeur du Luberon."
      },
      blockedDates: [],
      order: 1
    },
    {
      id: 'prop_3',
      slug: 'penthouse-bordeaux',
      title: 'Penthouse Bordeaux',
      subtitle: 'Terrasse de 80m2 sur les toits de Bordeaux',
      description: "Au sommet d'un immeuble haussmannien du centre de Bordeaux, ce penthouse d'exception offre une terrasse de 80m2 avec vue à 360° sur la ville et la Garonne. Intérieur contemporain, matériaux nobles, équipements haut de gamme.",
      shortDescription: "Penthouse avec terrasse panoramique sur les toits de Bordeaux.",
      location: {
        city: 'Bordeaux',
        country: 'France',
        address: 'Centre historique, Bordeaux, 33000',
        area: 'Centre historique',
        lat: 44.8378,
        lng: -0.5792
      },
      pricing: {
        perNight: 450,
        cleaningFee: 120,
        currency: 'EUR',
        minimumStay: 2
      },
      capacity: {
        guests: 6,
        bedrooms: 3,
        beds: 3,
        bathrooms: 2
      },
      media: {
        coverImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
        gallery: [
          'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
          'https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=85',
          'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&q=85'
        ]
      },
      amenities: ['Terrasse 80m2', 'Vue panoramique', 'Jacuzzi extérieur', 'Cuisine ouverte', 'Cave à vins', 'Wifi fibre', 'Parking privé', 'Climatisation', 'Draps et serviettes'],
      rules: ['Non-fumeur', 'Pas d\'animaux', 'Séjour minimum 2 nuits'],
      checkIn: '15h00',
      checkOut: '11h00',
      badges: ['Terrasse'],
      featured: false,
      upcoming: false,
      available: true,
      paymentLink: '',
      contactEmail: '',
      formspreeId: '',
      seo: {
        title: 'Penthouse Bordeaux — AURELYS',
        description: "Penthouse avec terrasse panoramique de 80m2 sur les toits de Bordeaux."
      },
      blockedDates: [],
      order: 2
    }
  ],

  /* ── Logements à venir ──────────────────────────────────── */
  upcomingProperties: [
    {
      id: 'upcoming_1',
      slug: 'chalet-megeve',
      title: 'Chalet Megève',
      subtitle: 'Chalet alpin avec accès piste direct',
      location: { city: 'Megève', country: 'France', lat: 45.8567, lng: 6.6167 },
      expectedDate: '2026-12',
      description: "Un chalet d'architecte au coeur des Alpes. Vue imprenable sur le Mont-Blanc, spa privatif, accès ski direct.",
      media: { coverImage: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80' }
    },
    {
      id: 'upcoming_2',
      slug: 'villa-cap-ferret',
      title: 'Villa Cap-Ferret',
      subtitle: 'Villa en bois sur pilotis face au Bassin',
      location: { city: 'Cap-Ferret', country: 'France', lat: 44.6942, lng: -1.2500 },
      expectedDate: '2026-07',
      description: "Une villa en bois sur pilotis face au Bassin d'Arcachon. Terrasse immergée dans la forêt de pins, accès direct à la plage.",
      media: { coverImage: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80' }
    }
  ],

  /* ── Réservations ───────────────────────────────────────── */
  reservations: [],

  /* ── Abonnés newsletter ─────────────────────────────────── */
  subscribers: [],

  /* ── Contenu éditable ───────────────────────────────────── */
  content: {

    /* Paramètres globaux */
    global: {
      siteName: 'AURELYS',
      tagline: 'Intemporel par choix.',
      description: 'Collection de résidences d\'exception. Hébergements courte durée.',
      contactEmail: 'contact@aurelys.fr',
      contactPhone: '+33 1 00 00 00 00',
      address: 'Paris, France',
      globalFormspreeId: 'YOUR_FORMSPREE_ID',
      instagramUrl: 'https://instagram.com/aurelys',
      linkedinUrl: '#',
      adminPassword: 'aurelys2024',
      logoText: 'AURELYS',
      faviconUrl: ''
    },

    /* Page d'accueil */
    home: {
      hero: {
        label: 'Collection AURELYS',
        title: 'Intemporel\npar choix.',
        subtitle: 'Des résidences d\'exception sélectionnées pour ceux qui refusent de choisir entre le confort et l\'élégance.',
        ctaPrimary: { label: 'Découvrir les résidences', href: '#logements' },
        ctaSecondary: { label: 'Notre approche', href: '#a-propos' }
      },
      editorial: {
        label: 'Notre approche',
        title: 'Une curation rigoureuse.',
        body: "Chaque résidence AURELYS est sélectionnée selon des critères d'exigence définis par notre équipe. Qualité architecturale, emplacement, confort des matières, qualité du service : nous ne référençons que ce que nous choisirions pour nous-mêmes.\n\nNous travaillons avec un nombre limité de propriétaires partageant la même vision de l'hospitalité haut de gamme.",
        image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=900&q=85',
        cta: { label: 'Notre sélection', href: '#logements' }
      },
      stats: [
        { value: '3+', label: 'Résidences' },
        { value: '5★', label: 'Expérience' },
        { value: '98%', label: 'Satisfaction' }
      ],
      newsletter: {
        label: 'Newsletter',
        title: 'Avant-première.',
        body: 'Recevez en priorité nos nouvelles résidences, nos ouvertures et nos offres exclusives.',
        placeholder: 'Votre adresse email',
        ctaLabel: 'S\'inscrire'
      }
    },

    /* Footer */
    footer: {
      description: 'Collection de résidences d\'exception. Hébergements courte durée sélectionnés pour leur qualité architecturale et leur emplacement.',
      columns: [
        {
          title: 'Résidences',
          links: [
            { label: 'Toutes les résidences', href: '#residences' },
            { label: 'Prochainement', href: '#prochainement' },
            { label: 'Carte des destinations', href: '#carte' }
          ]
        },
        {
          title: 'AURELYS',
          links: [
            { label: 'Notre approche', href: '#apropos' },
            { label: 'Proposer une résidence', href: '#contact' },
            { label: 'Contact', href: '#contact' }
          ]
        },
        {
          title: 'Informations',
          links: [
            { label: 'Conditions générales', href: 'legal.html?page=cgv' },
            { label: 'Politique de confidentialité', href: 'legal.html?page=privacy' },
            { label: 'Mentions légales', href: 'legal.html?page=mentions' },
            { label: 'Politique d\'annulation', href: 'legal.html?page=cancellation' }
          ]
        }
      ],
      copyright: '© {year} AURELYS. Tous droits réservés.'
    },

    /* FAQ */
    faq: [
      {
        id: 'faq_1',
        question: 'Comment fonctionne la réservation ?',
        answer: 'Sélectionnez votre résidence, choisissez vos dates et le nombre de voyageurs. Une fois votre demande soumise, vous êtes redirigé vers notre page de paiement sécurisé. Votre réservation est confirmée à réception du paiement.'
      },
      {
        id: 'faq_2',
        question: 'Quels sont les délais de confirmation ?',
        answer: 'La confirmation est immédiate après réception du paiement. Vous recevrez un email de confirmation avec tous les détails de votre séjour sous 24h.'
      },
      {
        id: 'faq_3',
        question: 'Quelle est la politique d\'annulation ?',
        answer: 'Annulation gratuite jusqu\'à 30 jours avant l\'arrivée. Entre 15 et 30 jours : 50% remboursé. Moins de 15 jours : aucun remboursement. Consultez nos conditions générales pour le détail complet.'
      },
      {
        id: 'faq_4',
        question: 'Les résidences sont-elles accessibles aux personnes à mobilité réduite ?',
        answer: 'L\'accessibilité varie selon les résidences. Chaque fiche de résidence indique les informations d\'accessibilité. N\'hésitez pas à nous contacter pour tout besoin spécifique.'
      }
    ],

    /* Pages légales */
    legalPages: {
      cgv: `# Conditions Générales de Vente

Dernière mise à jour : Mars 2026

## Article 1 — Objet et champ d'application

Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations contractuelles entre la société AURELYS (ci-après « AURELYS ») et toute personne physique ou morale souhaitant effectuer une réservation de résidence via le site aurelys.fr (ci-après le « Site »).

Toute réservation implique l'acceptation pleine et entière des présentes CGV.

## Article 2 — Description des services

AURELYS propose la location de résidences de prestige à titre de courte durée. Les résidences sont décrites de manière précise sur le Site, notamment leurs caractéristiques, leur capacité d'accueil et leurs tarifs.

## Article 3 — Réservation

**3.1** La réservation est ferme et définitive après réception du paiement intégral ou de l'acompte prévu.

**3.2** Toute réservation vaut acceptation des présentes CGV ainsi que des règles spécifiques de la résidence concernée.

**3.3** AURELYS se réserve le droit de refuser toute réservation sans avoir à justifier sa décision.

## Article 4 — Tarifs et paiement

**4.1** Les tarifs affichés sont en euros TTC. Ils comprennent la location de la résidence pour la durée sélectionnée. Les frais de ménage sont précisés lors de la réservation.

**4.2** Le paiement s'effectue intégralement en ligne via notre prestataire de paiement sécurisé.

## Article 5 — Politique d'annulation

| Délai avant arrivée | Remboursement |
|---|---|
| Plus de 30 jours | 100% |
| 15 à 30 jours | 50% |
| Moins de 15 jours | 0% |

En cas d'annulation par AURELYS, le remboursement intégral est effectué dans un délai de 14 jours ouvrés.

## Article 6 — Obligations du locataire

Le locataire s'engage à : utiliser la résidence en bon père de famille, respecter la capacité d'accueil maximale indiquée, respecter le règlement intérieur, restituer les lieux dans l'état dans lequel il les a trouvés.

## Article 7 — Responsabilité

AURELYS ne saurait être tenu responsable des dommages résultant d'un usage non conforme de la résidence, d'événements extérieurs ou de cas de force majeure.

## Article 8 — Droit applicable

Les présentes CGV sont soumises au droit français. Tout litige sera soumis aux tribunaux compétents du ressort de Paris.`,

      privacy: `# Politique de Confidentialité

Dernière mise à jour : Mars 2026

## 1. Responsable du traitement

AURELYS, dont le siège social est à Paris, France, est responsable du traitement de vos données personnelles au sens du Règlement Général sur la Protection des Données (RGPD).

Contact : contact@aurelys.fr

## 2. Données collectées

Dans le cadre de nos services, nous collectons les données suivantes :

**Données de réservation :** nom, prénom, adresse email, numéro de téléphone, informations de séjour.

**Données de navigation :** adresse IP, données de connexion, cookies techniques nécessaires au fonctionnement du site.

**Données de newsletter :** adresse email (avec votre consentement explicite).

## 3. Finalités et bases légales

| Finalité | Base légale |
|---|---|
| Traitement des réservations | Exécution du contrat |
| Envoi de confirmations | Exécution du contrat |
| Newsletter | Consentement |
| Amélioration du service | Intérêt légitime |

## 4. Vos droits

Conformément au RGPD, vous disposez des droits suivants : accès, rectification, effacement, limitation, portabilité, opposition.

Pour exercer vos droits : contact@aurelys.fr

## 5. Conservation des données

Données de réservation : durée de la relation commerciale + 5 ans (obligations légales).
Données newsletter : jusqu'à désinscription.

## 6. Cookies

Nous utilisons uniquement les cookies strictement nécessaires au fonctionnement du site. Aucun cookie publicitaire ou de traçage tiers n'est utilisé.

## 7. Transferts de données

Vos données ne sont pas transférées hors de l'Union Européenne.`,

      mentions: `# Mentions Légales

Dernière mise à jour : Mars 2026

## Éditeur du site

**AURELYS**
[Forme juridique] au capital de [montant] €
RCS Paris : [numéro RCS]
Siège social : Paris, France
Email : contact@aurelys.fr
Téléphone : +33 1 00 00 00 00

**Directeur de la publication :** [Nom du directeur]

## Hébergement

**Netlify, Inc.**
2325 3rd Street, Suite 215
San Francisco, California 94107 — États-Unis
www.netlify.com

## Propriété intellectuelle

L'ensemble des éléments constituant le site AURELYS (textes, photographies, graphismes, logo, architecture) est la propriété exclusive d'AURELYS et est protégé par les lois françaises et internationales relatives à la propriété intellectuelle.

Toute reproduction, représentation, modification, publication ou adaptation de tout ou partie des éléments du site, quel que soit le moyen ou le procédé utilisé, est interdite sans autorisation écrite préalable d'AURELYS.

## Liens hypertextes

Le site peut contenir des liens vers des sites tiers. AURELYS n'exerce aucun contrôle sur ces sites et décline toute responsabilité quant à leur contenu.

## Loi applicable

Le présent site et les présentes mentions légales sont soumis au droit français. Tout litige relatif à leur interprétation relève de la compétence exclusive des tribunaux français.`,

      cancellation: `# Politique d'Annulation

Dernière mise à jour : Mars 2026

## Annulation par le locataire

AURELYS applique la politique d'annulation suivante :

| Délai avant la date d'arrivée | Remboursement |
|---|---|
| Plus de 30 jours calendaires | Remboursement intégral |
| Entre 15 et 30 jours | 50% du montant total |
| Moins de 15 jours | Aucun remboursement |

## Modifications de réservation

Toute demande de modification (dates, nombre de voyageurs) doit être adressée par email à contact@aurelys.fr au moins 30 jours avant l'arrivée. Les modifications sont sous réserve de disponibilité.

## Annulation par AURELYS

En cas d'annulation par AURELYS pour raison de force majeure ou problème technique avec la résidence, le locataire sera remboursé intégralement dans un délai de 14 jours ouvrés.

## Procédure d'annulation

Pour annuler votre réservation, contactez-nous par email à contact@aurelys.fr en indiquant votre numéro de réservation. Une confirmation d'annulation vous sera envoyée sous 24h ouvrées.`
    }
  }
};

/* ================================================================
   COUCHE D'ABSTRACTION STORAGE
   (Prête pour migration vers Supabase / Firebase)
   ================================================================ */

/**
 * Adapter de stockage — interface unifiée
 * Remplacer l'implémentation ici pour migrer vers un backend
 */
const StorageAdapter = {
  read() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  write(data) {
    try {
      data._updatedAt = new Date().toISOString();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return true;
    } catch (e) {
      console.error('[AURELYS Storage] Write error:', e);
      return false;
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  }
};

/* ================================================================
   API PUBLIQUE
   ================================================================ */

function getData() {
  const stored = StorageAdapter.read();
  if (!stored) return deepClone(DEFAULT_DATA);
  // Migration si version plus ancienne
  if (!stored._version || stored._version < STORAGE_VERSION) {
    return migrateData(stored);
  }
  return deepMerge(deepClone(DEFAULT_DATA), stored);
}

function saveData(data) {
  const ok = StorageAdapter.write(data);
  if (ok) {
    // Synchronisation cross-onglets
    window.dispatchEvent(new CustomEvent('aurelys:dataChanged', { detail: data }));
  }
  return ok;
}

function resetData() {
  StorageAdapter.clear();
  return deepClone(DEFAULT_DATA);
}

function exportBackup() {
  const data = getData();
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `aurelys-backup-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importBackup(file, callback) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      saveData(data);
      callback(null, data);
    } catch (err) {
      callback(err);
    }
  };
  reader.readAsText(file);
}

/* ── Helpers ID ─────────────────────────────────────────────── */

function generateId(prefix = 'id') {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 6);
  return `${prefix}_${ts}${rand}`;
}

function slugify(str) {
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/* ── Helpers données ────────────────────────────────────────── */

function getPropertyBySlug(slug) {
  const data = getData();
  return data.properties.find(p => p.slug === slug) || null;
}

function getPropertyById(id) {
  const data = getData();
  return data.properties.find(p => p.id === id) || null;
}

function getReservationsByProperty(propertyId) {
  const data = getData();
  return (data.reservations || []).filter(r => r.propertyId === propertyId);
}

function getBlockedDates(propertyId) {
  const prop = getPropertyById(propertyId);
  if (!prop) return [];
  const reservationDates = getReservationsByProperty(propertyId)
    .filter(r => r.status === 'confirmed' || r.status === 'pending_payment')
    .flatMap(r => expandDateRange(r.dates.checkIn, r.dates.checkOut));
  return [...new Set([...(prop.blockedDates || []), ...reservationDates])];
}

function expandDateRange(checkIn, checkOut) {
  const dates = [];
  const current = new Date(checkIn);
  const end = new Date(checkOut);
  while (current < end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setDate(current.getDate() + 1);
  }
  return dates;
}

/* ── Migration ──────────────────────────────────────────────── */

function migrateData(old) {
  console.info('[AURELYS Storage] Migrating data from v1 to v2');
  // Fusionner l'ancien format avec les valeurs par défaut
  const fresh = deepClone(DEFAULT_DATA);
  // Conserver les propriétés existantes si elles existent
  if (Array.isArray(old.properties) && old.properties.length) {
    fresh.properties = old.properties;
  }
  if (Array.isArray(old.subscribers)) {
    fresh.subscribers = old.subscribers;
  }
  if (Array.isArray(old.reservations)) {
    fresh.reservations = old.reservations;
  }
  if (old.settings) {
    Object.assign(fresh.content.global, old.settings);
  }
  fresh._version = STORAGE_VERSION;
  saveData(fresh);
  return fresh;
}

/* ── Utilitaires ────────────────────────────────────────────── */

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

function deepMerge(base, override) {
  if (typeof override !== 'object' || override === null || Array.isArray(override)) return override;
  const result = { ...base };
  for (const key of Object.keys(override)) {
    if (key in base && typeof base[key] === 'object' && !Array.isArray(base[key]) && base[key] !== null) {
      result[key] = deepMerge(base[key], override[key]);
    } else {
      result[key] = override[key];
    }
  }
  return result;
}

/* ================================================================
   EXPORT GLOBAL
   ================================================================ */

window.AureStorage = {
  getData,
  saveData,
  resetData,
  exportBackup,
  importBackup,
  generateId,
  slugify,
  getPropertyBySlug,
  getPropertyById,
  getReservationsByProperty,
  getBlockedDates,
  expandDateRange,
  deepClone
};

// Compatibilité ascendante avec l'ancien nom
window.Storage = window.AureStorage;
