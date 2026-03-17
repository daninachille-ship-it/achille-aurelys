/**
 * db.js — Couche de base de données AURELYS
 *
 * Architecture :
 * - Supabase JS v2 (via CDN)
 * - Toutes les opérations sont async
 * - Fallback sur données par défaut si Supabase non configuré
 * - Cache en mémoire pour les lectures fréquentes
 * - Réaltime subscriptions pour synchronisation cross-navigateur
 */

'use strict';

const AureDB = (() => {

  /* ================================================================
     CLIENT SUPABASE
     ================================================================ */

  let _client = null;

  function _getClient() {
    if (_client) return _client;

    const cfg = window.AURELYS_CONFIG || {};
    if (
      !cfg.supabaseUrl   || cfg.supabaseUrl.includes('YOUR_') ||
      !cfg.supabaseAnonKey || cfg.supabaseAnonKey.includes('YOUR_')
    ) {
      return null;
    }

    if (!window.supabase) {
      console.warn('[AureDB] Supabase JS client non chargé.');
      return null;
    }

    _client = window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey, {
      auth: {
        autoRefreshToken:    true,
        persistSession:      true,
        detectSessionInUrl:  true
      }
    });

    return _client;
  }

  function isConfigured() {
    const cfg = window.AURELYS_CONFIG || {};
    return !!(
      cfg.supabaseUrl      && !cfg.supabaseUrl.includes('YOUR_') &&
      cfg.supabaseAnonKey  && !cfg.supabaseAnonKey.includes('YOUR_') &&
      window.supabase
    );
  }


  /* ================================================================
     AUTHENTIFICATION
     ================================================================ */

  async function signIn(email, password) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré. Remplissez js/config.js');

    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  }

  async function signOut() {
    const client = _getClient();
    if (client) await client.auth.signOut();
  }

  async function getSession() {
    const client = _getClient();
    if (!client) return null;
    const { data: { session } } = await client.auth.getSession();
    return session;
  }

  function onAuthStateChange(callback) {
    const client = _getClient();
    if (!client) return () => {};
    const { data: { subscription } } = client.auth.onAuthStateChange(callback);
    return () => subscription.unsubscribe();
  }


  /* ================================================================
     LOGEMENTS
     ================================================================ */

  async function getProperties() {
    const client = _getClient();
    if (!client) return _defaults.properties();

    const { data, error } = await client
      .from('properties')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[AureDB] getProperties:', error.message);
      return _defaults.properties();
    }

    return (data || []).map(_fromRow.property);
  }

  async function getPropertyBySlug(slug) {
    const client = _getClient();
    if (!client) {
      return _defaults.properties().find(p => p.slug === slug) || null;
    }

    const { data, error } = await client
      .from('properties')
      .select('*')
      .eq('slug', slug)
      .single();

    if (error || !data) return null;
    return _fromRow.property(data);
  }

  async function getPropertyById(id) {
    const client = _getClient();
    if (!client) {
      return _defaults.properties().find(p => p.id === id) || null;
    }

    const { data, error } = await client
      .from('properties')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return _fromRow.property(data);
  }

  async function upsertProperty(prop) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const row = _toRow.property(prop);
    row.updated_at = new Date().toISOString();

    const { data, error } = await client
      .from('properties')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return _fromRow.property(data);
  }

  async function deleteProperty(id) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client.from('properties').delete().eq('id', id);
    if (error) throw error;
  }


  /* ================================================================
     LOGEMENTS A VENIR
     ================================================================ */

  async function getUpcomingProperties() {
    const client = _getClient();
    if (!client) return _defaults.upcoming();

    const { data, error } = await client
      .from('upcoming_properties')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[AureDB] getUpcomingProperties:', error.message);
      return _defaults.upcoming();
    }

    return (data || []).map(_fromRow.upcoming);
  }

  async function upsertUpcomingProperty(item) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const row = _toRow.upcoming(item);
    const { data, error } = await client
      .from('upcoming_properties')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();

    if (error) throw error;
    return _fromRow.upcoming(data);
  }

  async function deleteUpcomingProperty(id) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client.from('upcoming_properties').delete().eq('id', id);
    if (error) throw error;
  }


  /* ================================================================
     PARAMETRES DU SITE
     ================================================================ */

  async function getSettings() {
    const client = _getClient();
    if (!client) return _defaults.settings();

    const { data, error } = await client
      .from('site_settings')
      .select('settings')
      .eq('id', 'global')
      .single();

    if (error || !data) return _defaults.settings();
    return _deepMerge(_defaults.settings(), data.settings || {});
  }

  async function saveSettings(settings) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client
      .from('site_settings')
      .upsert({ id: 'global', settings, updated_at: new Date().toISOString() });

    if (error) throw error;
  }


  /* ================================================================
     PAGES LEGALES
     ================================================================ */

  async function getLegalPages() {
    const client = _getClient();
    if (!client) return _defaults.legalPages();

    const { data, error } = await client.from('legal_pages').select('*');

    if (error || !data || data.length === 0) return _defaults.legalPages();

    const pages = _defaults.legalPages();
    data.forEach(row => {
      if (row.slug) pages[row.slug] = row.content || '';
    });
    return pages;
  }

  async function saveLegalPage(slug, content) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client
      .from('legal_pages')
      .upsert({ slug, content, updated_at: new Date().toISOString() });

    if (error) throw error;
  }


  /* ================================================================
     FAQ
     ================================================================ */

  async function getFaqItems() {
    const client = _getClient();
    if (!client) return _defaults.faq();

    const { data, error } = await client
      .from('faq_items')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error || !data || data.length === 0) return _defaults.faq();

    return data.map(row => ({
      id:       row.id,
      question: row.question,
      answer:   row.answer,
      order:    row.sort_order || 0
    }));
  }

  async function upsertFaqItem(item) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client
      .from('faq_items')
      .upsert({ id: item.id, question: item.question, answer: item.answer, sort_order: item.order || 0 });

    if (error) throw error;
  }

  async function deleteFaqItem(id) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client.from('faq_items').delete().eq('id', id);
    if (error) throw error;
  }


  /* ================================================================
     RESERVATIONS
     ================================================================ */

  async function getReservations() {
    const client = _getClient();
    if (!client) return [];

    const { data, error } = await client
      .from('reservations')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) { console.error('[AureDB] getReservations:', error.message); return []; }
    return data || [];
  }

  async function createReservation(res) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { data, error } = await client
      .from('reservations')
      .insert({
        property_id:    res.propertyId,
        property_title: res.propertyTitle || '',
        guest_name:     res.guest?.name || res.guestName || '',
        guest_email:    res.guest?.email || res.guestEmail || '',
        guest_phone:    res.guest?.phone || res.guestPhone || '',
        check_in:       res.dates?.checkIn || res.checkIn,
        check_out:      res.dates?.checkOut || res.checkOut,
        guests:         res.guests || 1,
        nights:         res.dates?.nights || res.nights || 1,
        total_price:    res.pricing?.total || res.totalPrice || 0,
        cleaning_fee:   res.pricing?.cleaningFee || res.cleaningFee || 0,
        currency:       res.pricing?.currency || 'EUR',
        status:         'pending',
        payment_status: 'unpaid',
        payment_link:   res.paymentLink || '',
        message:        res.message || '',
        created_at:     new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    // Bloquer automatiquement les dates
    await _blockReservationDates(
      res.propertyId,
      res.dates?.checkIn || res.checkIn,
      res.dates?.checkOut || res.checkOut,
      data.id
    );

    return data;
  }

  async function updateReservationStatus(id, status) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client
      .from('reservations')
      .update({ status })
      .eq('id', id);

    if (error) throw error;
  }

  async function deleteReservation(id) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client.from('reservations').delete().eq('id', id);
    if (error) throw error;
  }


  /* ================================================================
     DISPONIBILITE
     ================================================================ */

  async function getAvailabilityBlocks(propertyId) {
    const client = _getClient();
    if (!client) return [];

    let query = client.from('availability_blocks').select('date, type');
    if (propertyId) query = query.eq('property_id', propertyId);

    const { data, error } = await query;
    if (error) { console.error('[AureDB] getAvailabilityBlocks:', error.message); return []; }
    return (data || []).map(r => r.date);
  }

  async function createAvailabilityBlock(propertyId, date, note = '') {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client
      .from('availability_blocks')
      .upsert(
        { property_id: propertyId, date, type: 'blocked', note },
        { onConflict: 'property_id,date' }
      );

    if (error) throw error;
  }

  async function deleteAvailabilityBlock(propertyId, date) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client
      .from('availability_blocks')
      .delete()
      .eq('property_id', propertyId)
      .eq('date', date);

    if (error) throw error;
  }

  async function _blockReservationDates(propertyId, checkIn, checkOut, reservationId) {
    if (!propertyId || !checkIn || !checkOut) return;
    const client = _getClient();
    if (!client) return;

    const dates = _expandDateRange(checkIn, checkOut);
    const rows = dates.map(date => ({
      property_id:    propertyId,
      date,
      type:           'reservation',
      reservation_id: reservationId
    }));

    if (rows.length === 0) return;
    await client
      .from('availability_blocks')
      .upsert(rows, { onConflict: 'property_id,date' });
  }


  /* ================================================================
     NEWSLETTER
     ================================================================ */

  async function getSubscribers() {
    const client = _getClient();
    if (!client) return [];

    const { data, error } = await client
      .from('newsletter_subscribers')
      .select('*')
      .order('subscribed_at', { ascending: false });

    if (error) { console.error('[AureDB] getSubscribers:', error.message); return []; }
    return data || [];
  }

  async function addSubscriber(email) {
    const client = _getClient();
    if (!client) {
      // Fallback localStorage si Supabase non configuré
      const key  = 'aurelys_subscribers_local';
      const subs = JSON.parse(localStorage.getItem(key) || '[]');
      if (subs.some(s => s.email === email)) throw new Error('Déjà inscrit');
      subs.push({ email, date: new Date().toISOString() });
      localStorage.setItem(key, JSON.stringify(subs));
      return;
    }

    const { error } = await client
      .from('newsletter_subscribers')
      .insert({ email, subscribed_at: new Date().toISOString() });

    if (error) {
      if (error.code === '23505') throw new Error('Déjà inscrit');
      throw error;
    }
  }

  async function deleteSubscriber(id) {
    const client = _getClient();
    if (!client) throw new Error('Supabase non configuré');

    const { error } = await client.from('newsletter_subscribers').delete().eq('id', id);
    if (error) throw error;
  }


  /* ================================================================
     REALTIME
     ================================================================ */

  function subscribeToChanges(table, callback) {
    const client = _getClient();
    if (!client) return () => {};

    const channel = client
      .channel(`aurelys-${table}`)
      .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
      .subscribe();

    return () => client.removeChannel(channel);
  }


  /* ================================================================
     MAPPERS DB <-> JS
     ================================================================ */

  const _fromRow = {
    property(row) {
      return {
        id:               row.id,
        slug:             row.slug,
        title:            row.title,
        subtitle:         row.subtitle         || '',
        description:      row.description      || '',
        shortDescription: row.short_description || '',
        location: {
          city:    row.city    || '',
          country: row.country || '',
          address: row.address || '',
          area:    row.area    || '',
          lat:     row.lat     ?? null,
          lng:     row.lng     ?? null
        },
        pricing: {
          perNight:    row.price_per_night || 0,
          cleaningFee: row.cleaning_fee    || 0,
          currency:    row.currency        || 'EUR',
          minimumStay: row.minimum_stay    || 1
        },
        capacity: {
          guests:    row.guests    || 0,
          bedrooms:  row.bedrooms  || 0,
          beds:      row.beds      || 0,
          bathrooms: row.bathrooms || 0
        },
        media: {
          coverImage: row.cover_image || '',
          gallery:    Array.isArray(row.gallery) ? row.gallery : []
        },
        amenities: Array.isArray(row.amenities) ? row.amenities : [],
        rules:     Array.isArray(row.rules)     ? row.rules     : [],
        checkIn:   row.check_in  || '15h00',
        checkOut:  row.check_out || '11h00',
        badges:    Array.isArray(row.badges) ? row.badges : [],
        featured:  !!row.featured,
        available: row.available !== false,
        paymentLink:  row.payment_link  || '',
        contactEmail: row.contact_email || '',
        formspreeId:  row.formspree_id  || '',
        seo: {
          title:       row.seo_title       || `${row.title} — AURELYS`,
          description: row.seo_description || ''
        },
        order:     row.sort_order || 0,
        createdAt: row.created_at,
        updatedAt: row.updated_at
      };
    },

    upcoming(row) {
      return {
        id:          row.id,
        slug:        row.slug        || '',
        title:       row.title,
        subtitle:    row.subtitle    || '',
        description: row.description || '',
        location: {
          city:    row.city    || '',
          country: row.country || '',
          lat:     row.lat     ?? null,
          lng:     row.lng     ?? null
        },
        expectedDate: row.expected_date || '',
        media: { coverImage: row.cover_image || '' },
        order: row.sort_order || 0
      };
    }
  };

  const _toRow = {
    property(prop) {
      return {
        id:               prop.id,
        slug:             prop.slug,
        title:            prop.title,
        subtitle:         prop.subtitle         || '',
        description:      prop.description      || '',
        short_description: prop.shortDescription || '',
        city:             prop.location?.city    || '',
        country:          prop.location?.country || '',
        address:          prop.location?.address || '',
        area:             prop.location?.area    || '',
        lat:              prop.location?.lat     ?? null,
        lng:              prop.location?.lng     ?? null,
        price_per_night:  prop.pricing?.perNight    || 0,
        cleaning_fee:     prop.pricing?.cleaningFee || 0,
        currency:         prop.pricing?.currency    || 'EUR',
        minimum_stay:     prop.pricing?.minimumStay || 1,
        guests:           prop.capacity?.guests    || 0,
        bedrooms:         prop.capacity?.bedrooms  || 0,
        beds:             prop.capacity?.beds      || 0,
        bathrooms:        prop.capacity?.bathrooms || 0,
        cover_image:      prop.media?.coverImage   || '',
        gallery:          prop.media?.gallery      || [],
        amenities:        prop.amenities           || [],
        rules:            prop.rules               || [],
        check_in:         prop.checkIn             || '15h00',
        check_out:        prop.checkOut            || '11h00',
        badges:           prop.badges              || [],
        featured:         !!prop.featured,
        available:        prop.available !== false,
        payment_link:     prop.paymentLink   || '',
        contact_email:    prop.contactEmail  || '',
        formspree_id:     prop.formspreeId   || '',
        seo_title:        prop.seo?.title         || `${prop.title} — AURELYS`,
        seo_description:  prop.seo?.description   || '',
        sort_order:       prop.order || 0
      };
    },

    upcoming(item) {
      return {
        id:            item.id,
        slug:          item.slug          || '',
        title:         item.title,
        subtitle:      item.subtitle      || '',
        description:   item.description   || '',
        city:          item.location?.city    || '',
        country:       item.location?.country || '',
        lat:           item.location?.lat     ?? null,
        lng:           item.location?.lng     ?? null,
        expected_date: item.expectedDate   || '',
        cover_image:   item.media?.coverImage || '',
        sort_order:    item.order || 0
      };
    }
  };


  /* ================================================================
     DONNEES PAR DEFAUT (fallback si Supabase non configuré)
     ================================================================ */

  const _defaults = {
    properties() {
      return [
        {
          id: 'prop_1', slug: 'appartement-canal-saint-martin',
          title: 'Appartement Canal Saint-Martin',
          subtitle: 'Loft industriel avec vue sur le canal',
          description: "Un loft d'exception niché au bord du Canal Saint-Martin. Volumes généreux, verrières industrielles et mobilier soigneusement sélectionné créent une atmosphère unique à la croisée de l'élégance contemporaine et du charme parisien authentique.",
          shortDescription: 'Loft industriel avec vue canal, au coeur du 10e arrondissement.',
          location: { city: 'Paris', country: 'France', address: 'Canal Saint-Martin, 75010 Paris', area: '10e arrondissement', lat: 48.8698, lng: 2.3635 },
          pricing: { perNight: 320, cleaningFee: 80, currency: 'EUR', minimumStay: 2 },
          capacity: { guests: 4, bedrooms: 2, beds: 2, bathrooms: 1 },
          media: { coverImage: 'https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85', gallery: ['https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=1200&q=85','https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=1200&q=85'] },
          amenities: ['Wifi haut débit','Cuisine équipée','Machine à café','Vue canal','Parquet ancien','Draps et serviettes','Chauffage','Smart TV'],
          rules: ['Non-fumeur','Animaux non admis','Pas de fêtes'],
          checkIn: '15h00', checkOut: '11h00',
          badges: ['Coup de coeur'], featured: true, available: true,
          paymentLink: '', contactEmail: '', formspreeId: '',
          seo: { title: 'Appartement Canal Saint-Martin — AURELYS', description: '' },
          order: 0
        },
        {
          id: 'prop_2', slug: 'villa-luberon',
          title: 'Villa du Luberon',
          subtitle: 'Mas provençal restauré au coeur du Luberon',
          description: "Un mas provençal du XVIIIe siècle entièrement restauré dans le respect des matières et des volumes d'origine.",
          shortDescription: 'Mas du XVIIIe siècle, piscine et vue sur le Luberon.',
          location: { city: 'Lacoste', country: 'France', address: 'Route des Crêtes, Lacoste, 84480', area: 'Luberon, Provence', lat: 43.8297, lng: 5.4011 },
          pricing: { perNight: 580, cleaningFee: 150, currency: 'EUR', minimumStay: 3 },
          capacity: { guests: 8, bedrooms: 4, beds: 5, bathrooms: 3 },
          media: { coverImage: 'https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=85', gallery: ['https://images.unsplash.com/photo-1596178065887-1198b6148b2b?w=1200&q=85'] },
          amenities: ['Piscine à débordement','Jardin de lavande','Cuisine provençale','Terrasse panoramique','Barbecue','Wifi','Parking'],
          rules: ['Non-fumeur (intérieur)','Animaux sur demande'],
          checkIn: '16h00', checkOut: '10h00',
          badges: ['Exclusivité','Vue panoramique'], featured: true, available: true,
          paymentLink: '', contactEmail: '', formspreeId: '',
          seo: { title: 'Villa du Luberon — AURELYS', description: '' },
          order: 1
        },
        {
          id: 'prop_3', slug: 'penthouse-bordeaux',
          title: 'Penthouse Bordeaux',
          subtitle: 'Terrasse de 80m² sur les toits de Bordeaux',
          description: "Au sommet d'un immeuble haussmannien du centre de Bordeaux, ce penthouse d'exception offre une terrasse de 80m² avec vue à 360°.",
          shortDescription: 'Penthouse avec terrasse panoramique sur les toits de Bordeaux.',
          location: { city: 'Bordeaux', country: 'France', address: 'Centre historique, Bordeaux, 33000', area: 'Centre historique', lat: 44.8378, lng: -0.5792 },
          pricing: { perNight: 450, cleaningFee: 120, currency: 'EUR', minimumStay: 2 },
          capacity: { guests: 6, bedrooms: 3, beds: 3, bathrooms: 2 },
          media: { coverImage: 'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85', gallery: ['https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1200&q=85'] },
          amenities: ['Terrasse 80m²','Vue panoramique','Jacuzzi extérieur','Cuisine ouverte','Cave à vins','Wifi fibre','Parking privé'],
          rules: ['Non-fumeur','Pas d\'animaux'],
          checkIn: '15h00', checkOut: '11h00',
          badges: ['Terrasse'], featured: false, available: true,
          paymentLink: '', contactEmail: '', formspreeId: '',
          seo: { title: 'Penthouse Bordeaux — AURELYS', description: '' },
          order: 2
        },
        {
          id: 'prop_4', slug: 'villa-rio-de-janeiro',
          title: 'Villa Rio de Janeiro',
          subtitle: 'Vue sur la baie de Guanabara et le Pain de Sucre',
          description: "Au coeur de l'une des plus belles villes du monde, cette villa d'exception offre une vue imprenable sur la baie de Guanabara et le Pain de Sucre.",
          shortDescription: 'Villa contemporaine avec vue panoramique sur la baie de Guanabara, Rio de Janeiro.',
          location: { city: 'Rio de Janeiro', country: 'Brésil', address: 'Santa Teresa, Rio de Janeiro, RJ', area: 'Santa Teresa', lat: -22.9132, lng: -43.1794 },
          pricing: { perNight: 680, cleaningFee: 200, currency: 'EUR', minimumStay: 3 },
          capacity: { guests: 6, bedrooms: 3, beds: 4, bathrooms: 2 },
          media: { coverImage: 'https://images.unsplash.com/photo-1518639192441-8fce0a366e2e?w=1200&q=85', gallery: ['https://images.unsplash.com/photo-1518639192441-8fce0a366e2e?w=1200&q=85'] },
          amenities: ['Piscine privée','Vue baie de Guanabara','Cuisine équipée','Terrasse panoramique','Climatisation','Wifi haut débit','Service de conciergerie','Parking privé'],
          rules: ['Non-fumeur','Animaux sur demande','Séjour minimum 3 nuits'],
          checkIn: '15h00', checkOut: '11h00',
          badges: ['Exclusivité','Vue panoramique'], featured: true, available: true,
          paymentLink: '', contactEmail: '', formspreeId: '',
          seo: { title: 'Villa Rio de Janeiro — AURELYS', description: '' },
          order: 3
        }
      ];
    },

    upcoming() {
      return [
        {
          id: 'upcoming_1', slug: 'chalet-megeve',
          title: 'Chalet Megève', subtitle: 'Chalet alpin avec accès piste direct',
          description: "Un chalet d'architecte au coeur des Alpes.",
          location: { city: 'Megève', country: 'France', lat: 45.8567, lng: 6.6167 },
          expectedDate: '2026-12',
          media: { coverImage: 'https://images.unsplash.com/photo-1580587771525-78b9dba3b914?w=800&q=80' },
          order: 0
        },
        {
          id: 'upcoming_2', slug: 'villa-cap-ferret',
          title: 'Villa Cap-Ferret', subtitle: 'Villa en bois sur pilotis face au Bassin',
          description: "Une villa en bois sur pilotis face au Bassin d'Arcachon.",
          location: { city: 'Cap-Ferret', country: 'France', lat: 44.6942, lng: -1.2500 },
          expectedDate: '2026-07',
          media: { coverImage: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?w=800&q=80' },
          order: 1
        }
      ];
    },

    settings() {
      return {
        global: {
          siteName:         'AURELYS',
          tagline:          'Intemporel par choix.',
          description:      "Collection de résidences d'exception. Hébergements courte durée.",
          contactEmail:     'contact@aurelyscollection.com',
          contactPhone:     '+33 1 00 00 00 00',
          address:          'Paris, France',
          globalFormspreeId: '',
          instagramUrl:     'https://instagram.com/aurelys',
          linkedinUrl:      '#',
          logoText:         'AURELYS',
          faviconUrl:       ''
        },
        home: {
          hero: {
            label:               'Collection AURELYS',
            title:               'Intemporel\npar choix.',
            subtitle:            "Des résidences d'exception sélectionnées pour ceux qui refusent de choisir entre le confort et l'élégance.",
            ctaPrimary:          { label: 'Découvrir les résidences', href: '#logements' },
            ctaSecondary:        { label: 'Notre approche', href: '#a-propos' },
            heroImage:           'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=1200&q=90',
            heroImageSecondary:  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=700&q=85'
          },
          editorial: {
            label: 'Notre approche',
            title: 'Une curation rigoureuse.',
            body:  "Chaque résidence AURELYS est sélectionnée selon des critères d'exigence définis par notre équipe. Qualité architecturale, emplacement, confort des matières, qualité du service : nous ne référençons que ce que nous choisirions pour nous-mêmes.\n\nNous travaillons avec un nombre limité de propriétaires partageant la même vision de l'hospitalité haut de gamme.",
            image: 'https://images.unsplash.com/photo-1600585154526-990dced4db0d?w=900&q=85',
            cta:   { label: 'Notre sélection', href: '#logements' }
          },
          stats: [
            { value: '4+',  label: 'Résidences' },
            { value: '5',   label: 'Expérience' },
            { value: '98%', label: 'Satisfaction' }
          ],
          newsletter: {
            label:       'Newsletter',
            title:       'Avant-première.',
            body:        'Recevez en priorité nos nouvelles résidences, nos ouvertures et nos offres exclusives.',
            placeholder: 'Votre adresse email',
            ctaLabel:    "S'inscrire"
          }
        },
        footer: {
          description: "Collection de résidences d'exception. Hébergements courte durée sélectionnés pour leur qualité architecturale et leur emplacement.",
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
                { label: "Politique d'annulation", href: 'legal.html?page=cancellation' }
              ]
            }
          ],
          copyright: '© {year} AURELYS. Tous droits réservés.'
        }
      };
    },

    legalPages() {
      return { cgv: '', privacy: '', mentions: '', cancellation: '' };
    },

    faq() {
      return [
        { id: 'faq_1', question: 'Comment fonctionne la réservation ?', answer: "Sélectionnez votre résidence, choisissez vos dates et le nombre de voyageurs. Une fois votre demande soumise, vous êtes redirigé vers notre page de paiement sécurisé. Votre réservation est confirmée à réception du paiement.", order: 0 },
        { id: 'faq_2', question: 'Quels sont les délais de confirmation ?', answer: 'La confirmation est immédiate après réception du paiement. Vous recevrez un email de confirmation avec tous les détails de votre séjour sous 24h.', order: 1 },
        { id: 'faq_3', question: "Quelle est la politique d'annulation ?", answer: "Annulation gratuite jusqu'à 30 jours avant l'arrivée. Entre 15 et 30 jours : 50% remboursé. Moins de 15 jours : aucun remboursement.", order: 2 },
        { id: 'faq_4', question: 'Les résidences sont-elles accessibles aux personnes à mobilité réduite ?', answer: "L'accessibilité varie selon les résidences. Chaque fiche de résidence indique les informations d'accessibilité. N'hésitez pas à nous contacter.", order: 3 }
      ];
    }
  };


  /* ================================================================
     UTILITAIRES
     ================================================================ */

  function generateId(prefix = 'id') {
    const ts   = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 6);
    return `${prefix}_${ts}${rand}`;
  }

  function slugify(str) {
    return String(str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }

  function _expandDateRange(checkIn, checkOut) {
    const dates   = [];
    const current = new Date(checkIn);
    const end     = new Date(checkOut);
    while (current < end) {
      dates.push(current.toISOString().slice(0, 10));
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  function _deepMerge(base, override) {
    if (typeof override !== 'object' || override === null || Array.isArray(override)) return override;
    const result = { ...base };
    for (const key of Object.keys(override)) {
      if (key in base && typeof base[key] === 'object' && !Array.isArray(base[key]) && base[key] !== null) {
        result[key] = _deepMerge(base[key], override[key]);
      } else {
        result[key] = override[key];
      }
    }
    return result;
  }


  /* ================================================================
     API PUBLIQUE
     ================================================================ */

  return {
    isConfigured,

    // Auth
    signIn, signOut, getSession, onAuthStateChange,

    // Logements
    getProperties, getPropertyBySlug, getPropertyById,
    upsertProperty, deleteProperty,

    // Logements à venir
    getUpcomingProperties, upsertUpcomingProperty, deleteUpcomingProperty,

    // Paramètres
    getSettings, saveSettings,

    // Pages légales
    getLegalPages, saveLegalPage,

    // FAQ
    getFaqItems, upsertFaqItem, deleteFaqItem,

    // Réservations
    getReservations, createReservation, updateReservationStatus, deleteReservation,

    // Disponibilité
    getAvailabilityBlocks, createAvailabilityBlock, deleteAvailabilityBlock,

    // Newsletter
    getSubscribers, addSubscriber, deleteSubscriber,

    // Realtime
    subscribeToChanges,

    // Utilitaires
    generateId, slugify
  };

})();

window.AureDB = AureDB;

// Compatibilité avec l'ancien code qui utilise Storage.generateId / Storage.slugify
window.Storage = {
  generateId: AureDB.generateId,
  slugify:    AureDB.slugify
};
