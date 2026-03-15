/**
 * storage.js — Couche de persistance des données
 * Utilise localStorage pour être compatible Netlify (sans backend)
 */

const STORAGE_KEY = 'achille_aurelys_v1';

const DEFAULT_DATA = {
  version: 1,
  properties: [
    {
      id: 'prop_1',
      name: 'Villa Lumière',
      location: "Côte d'Azur, France",
      price: 450,
      currency: '€',
      period: 'nuit',
      description: "Une villa d'exception avec vue mer panoramique. Nichée dans les hauteurs de la Côte d'Azur, cette résidence de prestige offre cinq chambres somptueuses, une piscine à débordement et une terrasse panoramique à couper le souffle.",
      shortDescription: "Villa prestige avec vue mer panoramique",
      image: 'https://images.unsplash.com/photo-1613977257363-707ba9348227?w=800&q=80',
      available: true,
      paymentLink: '',
      features: ['5 chambres', 'Piscine à débordement', 'Vue mer', 'Terrasse panoramique', 'Cuisine équipée', 'Parking privé'],
      maxGuests: 10,
      bedrooms: 5,
      bathrooms: 4,
      area: 350,
      order: 0
    },
    {
      id: 'prop_2',
      name: 'Appartement Haussmann',
      location: 'Paris 8ème, France',
      price: 850,
      currency: '€',
      period: 'nuit',
      description: "Un appartement haussmannien d'exception au cœur du Triangle d'Or parisien. Parquet en point de Hongrie, moulures d'époque et décoration contemporaine se mêlent pour créer un cadre unique.",
      shortDescription: "Appartement haussmannien au cœur de Paris",
      image: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=800&q=80',
      available: true,
      paymentLink: '',
      features: ['3 chambres', 'Vue privilégiée', "Parquet d'époque", 'Conciergerie 24h/24', 'Cave à vin', 'Balcon haussmannien'],
      maxGuests: 6,
      bedrooms: 3,
      bathrooms: 2,
      area: 220,
      order: 1
    },
    {
      id: 'prop_3',
      name: 'Mas Provençal',
      location: 'Luberon, France',
      price: 320,
      currency: '€',
      period: 'nuit',
      description: "Un mas provençal authentique au cœur du Luberon. Entre vignes et lavande, cette demeure restaurée avec soin offre un cadre enchanteur pour des vacances au cœur de la Provence.",
      shortDescription: "Mas authentique au cœur du Luberon",
      image: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=800&q=80',
      available: true,
      paymentLink: '',
      features: ['4 chambres', 'Piscine chauffée', 'Jardin paysager', 'Vue sur le Luberon', 'Cave à vins', 'Pétanque'],
      maxGuests: 8,
      bedrooms: 4,
      bathrooms: 3,
      area: 280,
      order: 2
    }
  ],
  upcomingProperties: [
    {
      id: 'upcoming_1',
      name: 'Chalet Mont-Blanc',
      location: 'Chamonix, France',
      expectedDate: '2026-12',
      description: "Un chalet d'exception au pied du Mont-Blanc. Vue imprenable sur les Alpes, spa privatif et accès direct aux pistes.",
      image: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80'
    },
    {
      id: 'upcoming_2',
      name: 'Villa Ibiza',
      location: 'Ibiza, Espagne',
      expectedDate: '2026-06',
      description: "Une villa contemporaine avec vue sur la Méditerranée. Architecture minimaliste, piscine infinity et couchers de soleil exceptionnels.",
      image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80'
    }
  ],
  settings: {
    siteName: 'Achille & Aurelys',
    tagline: 'Location de Prestige',
    heroTitle: "L'Art de Vivre en Luxe",
    heroSubtitle: "Des résidences d'exception soigneusement sélectionnées pour vos séjours les plus précieux.",
    aboutTitle: 'Notre Vision du Luxe',
    aboutText: "Achille & Aurelys est né de la passion pour les espaces d'exception. Nous sélectionnons rigoureusement chaque résidence pour vous offrir une expérience incomparable, alliant luxe, confort et authenticité.\n\nChaque propriété de notre collection a été choisie pour son caractère unique, son emplacement privilégié et la qualité de ses prestations.",
    contactEmail: 'contact@achille-aurelys.fr',
    phone: '+33 1 00 00 00 00',
    address: 'Paris, France',
    formspreeId: 'YOUR_FORMSPREE_ID',
    newsletterTitle: 'Soyez informés en avant-première',
    newsletterText: "Recevez nos nouvelles adresses et offres exclusives directement dans votre boîte mail.",
    instagramUrl: '#',
    linkedinUrl: '#',
    adminPassword: 'admin2024'
  },
  legalPages: {
    cgv: `# Conditions Générales de Vente

Dernière mise à jour : Mars 2026

## Article 1 – Objet

Les présentes conditions générales de vente régissent les relations contractuelles entre Achille & Aurelys et ses clients dans le cadre de la location de résidences de prestige.

## Article 2 – Réservation

Toute réservation est ferme et définitive après paiement de l'acompte de 30 %. Le solde est dû 30 jours avant l'arrivée. La réservation n'est confirmée qu'à réception du règlement et de l'envoi d'une confirmation écrite.

## Article 3 – Tarifs

Les tarifs indiqués sur le site sont en euros TTC par nuit. Ils peuvent être modifiés à tout moment sans préavis. Le tarif applicable est celui en vigueur au moment de la réservation.

## Article 4 – Annulation

En cas d'annulation par le locataire :
- Plus de 60 jours avant l'arrivée : remboursement intégral de l'acompte
- Entre 30 et 60 jours : remboursement de 50 % de l'acompte
- Moins de 30 jours : aucun remboursement

## Article 5 – Obligations du locataire

Le locataire s'engage à utiliser le bien loué en bon père de famille, à respecter le règlement intérieur de chaque propriété et à la restituer dans l'état dans lequel il l'a reçue.

## Article 6 – Responsabilité

Achille & Aurelys ne saurait être tenu responsable des dommages causés par des événements extérieurs ou des cas de force majeure (intempéries, catastrophes naturelles, grèves, etc.).

## Article 7 – Litige

En cas de litige, les parties s'engagent à rechercher une solution amiable avant tout recours judiciaire. À défaut, le tribunal compétent est celui du siège social d'Achille & Aurelys.`,

    privacy: `# Politique de Confidentialité

Dernière mise à jour : Mars 2026

## 1. Responsable du traitement

Achille & Aurelys, société dont le siège est à Paris, France, est responsable du traitement de vos données personnelles.

## 2. Données collectées

Nous collectons les données que vous nous fournissez directement :
- Nom, prénom, adresse email
- Numéro de téléphone (optionnel)
- Informations de réservation
- Données de navigation (cookies techniques uniquement)

## 3. Finalités du traitement

Vos données sont utilisées pour :
- Traiter et confirmer vos réservations
- Vous envoyer des confirmations et informations de séjour
- Vous adresser notre newsletter (avec votre consentement explicite)
- Améliorer nos services

## 4. Base légale

Le traitement est fondé sur l'exécution du contrat (réservation) ou votre consentement (newsletter).

## 5. Vos droits

Conformément au RGPD, vous disposez d'un droit d'accès, de rectification, d'effacement et de portabilité de vos données. Contactez-nous à : contact@achille-aurelys.fr

## 6. Durée de conservation

Vos données sont conservées pendant la durée de notre relation commerciale et 3 ans après la dernière interaction.

## 7. Cookies

Nous n'utilisons que les cookies strictement nécessaires au fonctionnement du site. Aucun cookie publicitaire ou de suivi tiers n'est utilisé.`,

    mentions: `# Mentions Légales

Dernière mise à jour : Mars 2026

## Éditeur du site

**Achille & Aurelys**
Société [forme juridique] au capital de [montant] €
RCS Paris : [numéro RCS]
Siège social : Paris, France
Email : contact@achille-aurelys.fr
Téléphone : +33 1 00 00 00 00

## Directeur de la publication

[Nom du directeur de publication]

## Hébergement

Ce site internet est hébergé par :

**Netlify, Inc.**
2325 3rd Street, Suite 215
San Francisco, California 94107
États-Unis
Site : https://www.netlify.com

## Propriété intellectuelle

L'ensemble du contenu de ce site (textes, images, graphismes, logo, icônes) est protégé par le droit d'auteur et appartient à Achille & Aurelys ou à ses partenaires. Toute reproduction, représentation ou exploitation, même partielle, est interdite sans autorisation écrite préalable.

## Limitation de responsabilité

Achille & Aurelys s'efforce d'assurer l'exactitude et la mise à jour des informations diffusées sur ce site, mais ne peut garantir leur exhaustivité ou leur actualité. L'utilisateur est seul responsable de l'utilisation qu'il fait des informations contenues sur ce site.

## Loi applicable

Les présentes mentions légales sont soumises au droit français. Tout litige relatif à leur interprétation et/ou leur exécution relève des tribunaux compétents.`
  },
  subscribers: [],
  reservations: []
};

/** Lit toutes les données depuis localStorage, initialise avec DEFAULT_DATA si absent */
function getData() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_DATA));
    const data = JSON.parse(raw);
    // Merge pour garantir la présence des nouvelles clés après mise à jour
    return deepMerge(JSON.parse(JSON.stringify(DEFAULT_DATA)), data);
  } catch (e) {
    console.error('Storage read error:', e);
    return JSON.parse(JSON.stringify(DEFAULT_DATA));
  }
}

/** Sauvegarde les données dans localStorage */
function saveData(data) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    // Émet un événement custom pour que les autres onglets se synchronisent
    window.dispatchEvent(new CustomEvent('siteDataUpdated', { detail: data }));
    return true;
  } catch (e) {
    console.error('Storage write error:', e);
    return false;
  }
}

/** Réinitialise toutes les données aux valeurs par défaut */
function resetData() {
  localStorage.removeItem(STORAGE_KEY);
  return JSON.parse(JSON.stringify(DEFAULT_DATA));
}

/** Exporte les données en JSON */
function exportData() {
  const data = getData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'achille-aurelys-backup.json';
  a.click();
  URL.revokeObjectURL(url);
}

/** Importe des données depuis un fichier JSON */
function importData(file, callback) {
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

/**
 * Merge profond : les valeurs de `override` écrasent celles de `base`
 * mais les clés présentes dans `base` et absentes de `override` sont conservées
 */
function deepMerge(base, override) {
  if (typeof override !== 'object' || override === null) return override;
  if (Array.isArray(override)) return override;
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

/** Génère un ID unique */
function generateId(prefix = 'item') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

window.Storage = { getData, saveData, resetData, exportData, importData, generateId };
