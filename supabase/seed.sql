-- ================================================================
-- AURELYS — Données initiales (seed)
-- Exécuter APRÈS schema.sql
-- ================================================================


-- ================================================================
-- Logements
-- ================================================================

insert into public.properties (
  id, slug, title, subtitle, description, short_description,
  city, country, address, area, lat, lng,
  price_per_night, cleaning_fee, currency, minimum_stay,
  guests, bedrooms, beds, bathrooms,
  cover_image, gallery, amenities, rules,
  check_in, check_out, badges,
  featured, available,
  payment_link, contact_email, formspree_id,
  seo_title, seo_description, sort_order
) values

-- Appartement Canal Saint-Martin
(
  'prop_1',
  'appartement-canal-saint-martin',
  'Appartement Canal Saint-Martin',
  'Loft industriel avec vue sur le canal',
  'Un loft d''exception niché au bord du Canal Saint-Martin. Volumes généreux, verrières industrielles et mobilier soigneusement sélectionné créent une atmosphère unique à la croisée de l''élégance contemporaine et du charme parisien authentique.',
  'Loft industriel avec vue canal, au coeur du 10e arrondissement.',
  'Paris', 'France',
  'Canal Saint-Martin, 75010 Paris',
  '10e arrondissement',
  48.8698, 2.3635,
  320, 80, 'EUR', 2,
  4, 2, 2, 1,
  'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85',
  '["https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85","https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85","https://images.unsplash.com/photo-1595526114035-0d45ed16cfbf?w=1200&q=85","https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=1200&q=85"]',
  '["Wifi haut débit","Cuisine équipée","Machine à café","Vue canal","Parquet ancien","Verrières industrielles","Draps et serviettes","Chauffage","Smart TV"]',
  '["Non-fumeur","Animaux non admis","Pas de fêtes","Départ avant 11h"]',
  '15h00', '11h00',
  '["Coup de coeur"]',
  true, true,
  '', '', '',
  'Appartement Canal Saint-Martin — AURELYS',
  'Location d''un loft industriel avec vue sur le Canal Saint-Martin, Paris 10e.',
  0
),

-- Villa du Luberon
(
  'prop_2',
  'villa-luberon',
  'Villa du Luberon',
  'Mas provençal restauré au coeur du Luberon',
  'Un mas provençal du XVIIIe siècle entièrement restauré dans le respect des matières et des volumes d''origine. Pierre, bois, lin : chaque détail a été pensé pour offrir une retraite absolue au coeur du Luberon. Piscine à débordement, jardin de lavande et vue sur le massif.',
  'Mas du XVIIIe siècle, piscine et vue sur le Luberon.',
  'Lacoste', 'France',
  'Route des Crêtes, Lacoste, 84480',
  'Luberon, Provence',
  43.8297, 5.4011,
  580, 150, 'EUR', 3,
  8, 4, 5, 3,
  'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=85',
  '["https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=85","https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200&q=85","https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=85","https://images.unsplash.com/photo-1613977257363-707ba9348227?w=1200&q=85"]',
  '["Piscine à débordement","Jardin de lavande","Cuisine provençale","Terrasse panoramique","Barbecue","Wifi","Parking","Draps et serviettes","Climatisation"]',
  '["Non-fumeur (intérieur)","Animaux sur demande","Séjour minimum 3 nuits"]',
  '16h00', '10h00',
  '["Exclusivité","Vue panoramique"]',
  true, true,
  '', '', '',
  'Villa du Luberon — AURELYS',
  'Mas provençal du XVIIIe siècle avec piscine à débordement au coeur du Luberon.',
  1
),

-- Penthouse Bordeaux
(
  'prop_3',
  'penthouse-bordeaux',
  'Penthouse Bordeaux',
  'Terrasse de 80m² sur les toits de Bordeaux',
  'Au sommet d''un immeuble haussmannien du centre de Bordeaux, ce penthouse d''exception offre une terrasse de 80m² avec vue à 360° sur la ville et la Garonne. Intérieur contemporain, matériaux nobles, équipements haut de gamme.',
  'Penthouse avec terrasse panoramique sur les toits de Bordeaux.',
  'Bordeaux', 'France',
  'Centre historique, Bordeaux, 33000',
  'Centre historique',
  44.8378, -0.5792,
  450, 120, 'EUR', 2,
  6, 3, 3, 2,
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85',
  '["https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85","https://images.unsplash.com/photo-1600566752355-35792bedcfea?w=1200&q=85","https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=1200&q=85"]',
  '["Terrasse 80m²","Vue panoramique","Jacuzzi extérieur","Cuisine ouverte","Cave à vins","Wifi fibre","Parking privé","Climatisation","Draps et serviettes"]',
  '["Non-fumeur","Pas d''animaux","Séjour minimum 2 nuits"]',
  '15h00', '11h00',
  '["Terrasse"]',
  false, true,
  '', '', '',
  'Penthouse Bordeaux — AURELYS',
  'Penthouse avec terrasse panoramique de 80m² sur les toits de Bordeaux.',
  2
),

-- Villa Rio de Janeiro
(
  'prop_4',
  'villa-rio-de-janeiro',
  'Villa Rio de Janeiro',
  'Vue sur la baie de Guanabara et le Pain de Sucre',
  'Au coeur de l''une des plus belles villes du monde, cette villa d''exception offre une vue imprenable sur la baie de Guanabara et le Pain de Sucre. Architecture contemporaine brésilienne, finitions luxueuses, piscine privée avec vue sur l''Atlantique et accès à l''ambiance unique de Santa Teresa.',
  'Villa contemporaine avec vue panoramique sur la baie de Guanabara, Rio de Janeiro.',
  'Rio de Janeiro', 'Brésil',
  'Santa Teresa, Rio de Janeiro, RJ',
  'Santa Teresa',
  -22.9132, -43.1794,
  680, 200, 'EUR', 3,
  6, 3, 4, 2,
  'https://images.unsplash.com/photo-1518639192441-8fce0a366e2e?w=1200&q=85',
  '["https://images.unsplash.com/photo-1518639192441-8fce0a366e2e?w=1200&q=85","https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=85","https://images.unsplash.com/photo-1544989164-31d5f7d67b6a?w=1200&q=85"]',
  '["Piscine privée","Vue baie de Guanabara","Cuisine équipée","Terrasse panoramique","Climatisation","Wifi haut débit","Service de conciergerie","Parking privé","Draps et serviettes"]',
  '["Non-fumeur","Animaux sur demande","Séjour minimum 3 nuits","Départ avant 11h"]',
  '15h00', '11h00',
  '["Exclusivité","Vue panoramique"]',
  true, true,
  '', '', '',
  'Villa Rio de Janeiro — AURELYS',
  'Villa contemporaine avec vue sur la baie de Guanabara à Rio de Janeiro, Brésil.',
  3
)

on conflict (id) do nothing;


-- ================================================================
-- Logements à venir
-- ================================================================

insert into public.upcoming_properties (
  id, slug, title, subtitle, description,
  city, country, lat, lng,
  expected_date, cover_image, sort_order
) values
(
  'upcoming_1',
  'chalet-megeve',
  'Chalet Megève',
  'Chalet alpin avec accès piste direct',
  'Un chalet d''architecte au coeur des Alpes. Vue imprenable sur le Mont-Blanc, spa privatif, accès ski direct.',
  'Megève', 'France', 45.8567, 6.6167,
  '2026-12',
  'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80',
  0
),
(
  'upcoming_2',
  'villa-cap-ferret',
  'Villa Cap-Ferret',
  'Villa en bois sur pilotis face au Bassin',
  'Une villa en bois sur pilotis face au Bassin d''Arcachon. Terrasse immergée dans la forêt de pins, accès direct à la plage.',
  'Cap-Ferret', 'France', 44.6942, -1.2500,
  '2026-07',
  'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80',
  1
)
on conflict (id) do nothing;


-- ================================================================
-- Pages légales
-- ================================================================

insert into public.legal_pages (slug, title, content) values
('cgv', 'Conditions Générales de Vente',
'# Conditions Générales de Vente

Dernière mise à jour : Mars 2026

## Article 1 — Objet et champ d''application

Les présentes Conditions Générales de Vente (ci-après « CGV ») régissent les relations contractuelles entre la société AURELYS et toute personne physique ou morale souhaitant effectuer une réservation de résidence via le site aurelys.fr.

Toute réservation implique l''acceptation pleine et entière des présentes CGV.

## Article 2 — Description des services

AURELYS propose la location de résidences de prestige à titre de courte durée. Les résidences sont décrites de manière précise sur le site, notamment leurs caractéristiques, leur capacité d''accueil et leurs tarifs.

## Article 3 — Réservation

**3.1** La réservation est ferme et définitive après réception du paiement intégral ou de l''acompte prévu.

**3.2** Toute réservation vaut acceptation des présentes CGV ainsi que des règles spécifiques de la résidence concernée.

## Article 4 — Tarifs et paiement

**4.1** Les tarifs affichés sont en euros TTC. Ils comprennent la location de la résidence pour la durée sélectionnée. Les frais de ménage sont précisés lors de la réservation.

**4.2** Le paiement s''effectue intégralement en ligne via notre prestataire de paiement sécurisé.

## Article 5 — Politique d''annulation

| Délai avant arrivée | Remboursement |
|---|---|
| Plus de 30 jours | 100% |
| 15 à 30 jours | 50% |
| Moins de 15 jours | 0% |

## Article 6 — Droit applicable

Les présentes CGV sont soumises au droit français. Tout litige sera soumis aux tribunaux compétents du ressort de Paris.'
),
('privacy', 'Politique de Confidentialité',
'# Politique de Confidentialité

Dernière mise à jour : Mars 2026

## 1. Responsable du traitement

AURELYS, dont le siège social est à Paris, France, est responsable du traitement de vos données personnelles au sens du RGPD.

Contact : contact@aurelys.fr

## 2. Données collectées

- **Données de réservation :** nom, prénom, adresse email, numéro de téléphone, informations de séjour.
- **Données de navigation :** adresse IP, données de connexion, cookies techniques.
- **Données de newsletter :** adresse email (avec votre consentement explicite).

## 3. Vos droits

Conformément au RGPD, vous disposez des droits d''accès, rectification, effacement, limitation, portabilité et opposition.

Pour exercer vos droits : contact@aurelys.fr

## 4. Conservation des données

Données de réservation : durée de la relation commerciale + 5 ans.
Données newsletter : jusqu''à désinscription.'
),
('mentions', 'Mentions Légales',
'# Mentions Légales

Dernière mise à jour : Mars 2026

## Éditeur du site

**AURELYS**
Paris, France
Email : contact@aurelys.fr

## Hébergement

**Netlify, Inc.**
2325 3rd Street, Suite 215
San Francisco, California 94107 — États-Unis

## Propriété intellectuelle

L''ensemble des éléments constituant le site AURELYS est protégé par les lois françaises et internationales relatives à la propriété intellectuelle. Toute reproduction sans autorisation est interdite.'
),
('cancellation', 'Politique d''Annulation',
'# Politique d''Annulation

Dernière mise à jour : Mars 2026

## Annulation par le locataire

| Délai avant la date d''arrivée | Remboursement |
|---|---|
| Plus de 30 jours calendaires | Remboursement intégral |
| Entre 15 et 30 jours | 50% du montant total |
| Moins de 15 jours | Aucun remboursement |

## Procédure d''annulation

Pour annuler votre réservation, contactez-nous par email à contact@aurelys.fr en indiquant votre numéro de réservation.'
)
on conflict (slug) do nothing;


-- ================================================================
-- FAQ
-- ================================================================

insert into public.faq_items (id, question, answer, sort_order) values
('faq_1', 'Comment fonctionne la réservation ?', 'Sélectionnez votre résidence, choisissez vos dates et le nombre de voyageurs. Une fois votre demande soumise, vous êtes redirigé vers notre page de paiement sécurisé. Votre réservation est confirmée à réception du paiement.', 0),
('faq_2', 'Quels sont les délais de confirmation ?', 'La confirmation est immédiate après réception du paiement. Vous recevrez un email de confirmation avec tous les détails de votre séjour sous 24h.', 1),
('faq_3', 'Quelle est la politique d''annulation ?', 'Annulation gratuite jusqu''à 30 jours avant l''arrivée. Entre 15 et 30 jours : 50% remboursé. Moins de 15 jours : aucun remboursement. Consultez nos conditions générales pour le détail complet.', 2),
('faq_4', 'Les résidences sont-elles accessibles aux personnes à mobilité réduite ?', 'L''accessibilité varie selon les résidences. Chaque fiche de résidence indique les informations d''accessibilité. N''hésitez pas à nous contacter pour tout besoin spécifique.', 3)
on conflict (id) do nothing;


-- ================================================================
-- Paramètres du site (settings)
-- ================================================================

insert into public.site_settings (id, settings) values (
  'global',
  '{
    "global": {
      "siteName": "AURELYS",
      "tagline": "Intemporel par choix.",
      "description": "Collection de résidences d''exception. Hébergements courte durée.",
      "contactEmail": "contact@aurelys.fr",
      "contactPhone": "+33 1 00 00 00 00",
      "address": "Paris, France",
      "globalFormspreeId": "",
      "instagramUrl": "https://instagram.com/aurelys",
      "linkedinUrl": "#",
      "logoText": "AURELYS",
      "faviconUrl": ""
    },
    "home": {
      "hero": {
        "label": "Collection AURELYS",
        "title": "Intemporel\npar choix.",
        "subtitle": "Des résidences d''exception sélectionnées pour ceux qui refusent de choisir entre le confort et l''élégance.",
        "ctaPrimary": { "label": "Découvrir les résidences", "href": "#logements" },
        "ctaSecondary": { "label": "Notre approche", "href": "#a-propos" },
        "heroImage": "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=90",
        "heroImageSecondary": "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85"
      },
      "editorial": {
        "label": "Notre approche",
        "title": "Une curation rigoureuse.",
        "body": "Chaque résidence AURELYS est sélectionnée selon des critères d''exigence définis par notre équipe. Qualité architecturale, emplacement, confort des matières, qualité du service : nous ne référençons que ce que nous choisirions pour nous-mêmes.\n\nNous travaillons avec un nombre limité de propriétaires partageant la même vision de l''hospitalité haut de gamme.",
        "image": "https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=900&q=85",
        "cta": { "label": "Notre sélection", "href": "#logements" }
      },
      "stats": [
        { "value": "4+", "label": "Résidences" },
        { "value": "5", "label": "Expérience" },
        { "value": "98%", "label": "Satisfaction" }
      ],
      "newsletter": {
        "label": "Newsletter",
        "title": "Avant-première.",
        "body": "Recevez en priorité nos nouvelles résidences, nos ouvertures et nos offres exclusives.",
        "placeholder": "Votre adresse email",
        "ctaLabel": "S''inscrire"
      }
    },
    "footer": {
      "description": "Collection de résidences d''exception. Hébergements courte durée sélectionnés pour leur qualité architecturale et leur emplacement.",
      "columns": [
        {
          "title": "Résidences",
          "links": [
            { "label": "Toutes les résidences", "href": "#residences" },
            { "label": "Prochainement", "href": "#prochainement" },
            { "label": "Carte des destinations", "href": "#carte" }
          ]
        },
        {
          "title": "AURELYS",
          "links": [
            { "label": "Notre approche", "href": "#apropos" },
            { "label": "Proposer une résidence", "href": "#contact" },
            { "label": "Contact", "href": "#contact" }
          ]
        },
        {
          "title": "Informations",
          "links": [
            { "label": "Conditions générales", "href": "legal.html?page=cgv" },
            { "label": "Politique de confidentialité", "href": "legal.html?page=privacy" },
            { "label": "Mentions légales", "href": "legal.html?page=mentions" },
            { "label": "Politique d''annulation", "href": "legal.html?page=cancellation" }
          ]
        }
      ],
      "copyright": "© {year} AURELYS. Tous droits réservés."
    }
  }'::jsonb
)
on conflict (id) do nothing;
