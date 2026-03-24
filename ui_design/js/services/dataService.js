/**
 * @file dataService.js
 * @description Centralized data service for the CoolKonyha UI.
 * This module provides mock data and retrieval functions for orders, 
 * historical updates, and other business entities.
 */

// RULE: Separation of Concerns - Data vs Presentation
// This service must know nothing about HTML tags or CSS classes.

const WHATS_NEW = [
  { 
    id: 1, 
    icon: 'fa-hotel', 
    title: 'Rendelés Frissítés: Hilton Budapest', 
    detail: 'Vámkezelés igazolva 2x Brema CB 249 egységre a HILT-00001 rendelésben.', 
    suggestion: 'Egyeztesd a logisztikát a technikai személyzettel.', 
    orderCode: 'HILT-00001', 
    name: 'Hilton Budapest Ltd.' 
  },
  { 
    id: 2, 
    icon: 'fa-envelope', 
    title: 'Új Email: Kovács Kft.', 
    detail: 'Aláírt szerződés csatolva a KOVA-00002 ajánlathoz.', 
    suggestion: 'Indítsd el a gyártási folyamatot.', 
    orderCode: 'KOVA-00002', 
    name: 'Kovács Kft.' 
  },
  { 
    id: 3, 
    icon: 'fa-box', 
    title: 'Korábbi Rendelés: Tóth Kft.', 
    detail: 'A TÓTH-00004 rendelés teljesen feldolgozva, a szerelő ütemezve.', 
    suggestion: '-', 
    orderCode: 'TOTH-00004', 
    name: 'Tóth Kft.', 
    processed: true 
  },
  { 
    id: 4, 
    icon: 'fa-building', 
    title: 'Beragadt Rendelés: Mező & Társa', 
    detail: '8 napja nem volt státuszváltozás (MEZO-00003). Sürgős beavatkozás javasolt.', 
    suggestion: 'Hívd fel az ügyfelet és tisztázd a státuszt.', 
    orderCode: 'MEZO-00003', 
    name: 'Mező & Társa' 
  },
];

const ORDERS = [
  { 
    id: 1, 
    orderCode: 'HILT-00001', 
    icon: 'fa-hotel', 
    name: 'Hilton Budapest Ltd.', 
    status: 'Szállítás folyamatban', 
    workflow: 'DELIVERY', 
    updated: '2026-03-22' 
  },
  { 
    id: 2, 
    orderCode: 'KOVA-00002', 
    icon: 'fa-industry', 
    name: 'Kovács Kft.', 
    status: 'Rendelés visszaigazolva', 
    workflow: 'ORDER_CONFIRMED', 
    updated: '2026-03-21' 
  },
  { 
    id: 3, 
    orderCode: 'MEZO-00003', 
    icon: 'fa-building', 
    name: 'Mező & Társa', 
    status: 'Ajánlat kiküldve', 
    workflow: 'OFFER_SENT', 
    updated: '2026-03-14', 
    aiInsight: true 
  },
  { 
    id: 4, 
    orderCode: 'PAPP-00004', 
    icon: 'fa-store', 
    name: 'Papp Bútor Kft.', 
    status: 'Számlázva', 
    workflow: 'INVOICED', 
    updated: '2026-03-20' 
  },
  { 
    id: 5, 
    orderCode: 'BUDA-00005', 
    icon: 'fa-landmark', 
    name: 'Budapest Szálló Zrt.', 
    status: 'Új megkeresés', 
    workflow: 'NEW', 
    updated: '2026-03-22' 
  },
];

const ORDER_FILES = {
  1: [ { name: 'Vam_Papírok.pdf', icon: 'fa-file-pdf' }, { name: 'Szallitasi_utvonal.docx', icon: 'fa-file-word' } ],
  2: [ { name: 'Alairt_Szerzodes.pdf', icon: 'fa-file-pdf' } ],
  4: [ { name: 'Szamla_20260320.pdf', icon: 'fa-file-pdf' } ]
};

const ORDER_HISTORY = {
  1: [ 
    { date: '2026-03-22 14:20', status: 'DELIVERY', note: 'Szállítmány úton van, vámkezelés befejezve.' }, 
    { date: '2026-03-20 09:10', status: 'READY_FOR_DELIVERY', note: 'Termékek becsomagolva, átadva a fuvarozónak.' }, 
    { date: '2026-03-15 11:30', status: 'ORDER_CONFIRMED', note: 'Ügyfél aláírta a megrendelőt.' } 
  ],
  2: [ 
    { date: '2026-03-21 10:00', status: 'ORDER_CONFIRMED', note: 'Aláírt szerződés beérkezett emailben.' }, 
    { date: '2026-03-18 14:00', status: 'OFFER_SENT', note: 'Ajánlat PDF kiküldve.' } 
  ],
  3: [ 
    { date: '2026-03-14 12:00', status: 'OFFER_SENT', note: 'Ajánlat elküldve, 8 napja nincs válasz.' }, 
    { date: '2026-03-12 10:30', status: 'NEW', note: 'Megkeresés rögzítve telefonon.' } 
  ],
  4: [ { date: '2026-03-20 16:00', status: 'INVOICED', note: 'Számla kiállítva és elküldve.' } ],
  5: [ { date: '2026-03-22 13:55', status: 'NEW', note: 'Első kapcsolatfelvétel emailen.' } ],
};

const ORDER_ITEMS = {
  1: [ { name: 'Brema CB 249', qty: 2, price: 450000 }, { name: 'Ipari Vízlágyító (10L)', qty: 2, price: 55000 } ],
  2: [ { name: 'Lincat OE8113 Olajsütő', qty: 1, price: 890000 } ],
  3: [ { name: 'Unox Anna XF023', qty: 1, price: 295000 } ],
  4: [ { name: 'Rozsdamentes asztal', qty: 3, price: 85000 } ],
  5: [],
};

const STATUS_LABELS = { 
  NEW: 'Új', 
  OFFER_SENT: 'Ajánlat', 
  ORDER_CONFIRMED: 'Megrendelő', 
  PURCHASE: 'Vásárlás', 
  READY_FOR_DELIVERY: 'Kész', 
  DELIVERY: 'Szállítás', 
  DELIVERED: 'Kiszállítva', 
  INVOICED: 'Számlázva', 
  CLOSED: 'Lezárva', 
  CANCELLED: 'Törölt' 
};

const API_BASE = 'http://localhost:3001/api';
// RULE: Logo images are served as static files from the Express server.
// DB paths are relative (e.g. /logos/foo.png) — prefix with the server origin.
const STATIC_BASE = 'http://localhost:3001';

/** @param {string|null|undefined} path - DB logo_path value */
const resolveLogoUrl = (path) => (path ? `${STATIC_BASE}${path}` : null);

/**
 * Data Service API - Now fetching from real API with fallback to Mocks
 */
const dataService = {
  _useMock: false,

  async getUpdates() {
    if (this._useMock) return [...WHATS_NEW];
    try {
      const [ordResp, custResp] = await Promise.all([
        fetch(`${API_BASE}/orders`),
        fetch(`${API_BASE}/customers`)
      ]);
      const orders = await ordResp.json();
      const customers = await custResp.json();
      
      return orders.slice(0, 5).map(o => {
        const cust = customers.find(c => c.cust_id === o.cust_id);
        return {
          id: o.order_id,
          icon: cust?.logo_path ? 'fa-building' : 'fa-hotel',
          logo: resolveLogoUrl(cust?.logo_path),
          title: `Rendelés Frissítés: ${o.order_code}`,
          detail: o.update_event,
          suggestion: 'Folyamatban lévő rendelés.',
          orderCode: o.order_code,
          name: cust?.cust_name || `Ügyfél #${o.cust_id}`,
          processed: o.current_status === 'CLOSED'
        };
      });
    } catch (e) {
      console.warn('API unavailable, falling back to mock data');
      return [...WHATS_NEW];
    }
  },
  
  async getOrders() {
    if (this._useMock) return [...ORDERS];
    try {
      const [ordResp, custResp] = await Promise.all([
        fetch(`${API_BASE}/orders`),
        fetch(`${API_BASE}/customers`)
      ]);
      const orders = await ordResp.json();
      const customers = await custResp.json();
      
      return orders.map(o => {
        const cust = customers.find(c => c.cust_id === o.cust_id);
        return {
          id: o.order_id,
          orderCode: o.order_code,
          icon: cust?.logo_path ? 'fa-building' : 'fa-box',
          logo: resolveLogoUrl(cust?.logo_path),
          name: cust?.cust_name || `Ügyfél #${o.cust_id}`,
          status: o.update_event || o.current_status,
          workflow: o.current_status,
          updated: o.order_date.split(' ')[0]
        };
      });
    } catch (e) {
      console.warn('API unavailable, falling back to mock data');
      return [...ORDERS];
    }
  },
  
  async getOrderDetails(id) {
    if (this._useMock) {
      return {
        order: ORDERS.find(o => o.id === id),
        history: ORDER_HISTORY[id] || [],
        items: ORDER_ITEMS[id] || [],
        files: ORDER_FILES[id] || []
      };
    }
    try {
      const resp = await fetch(`${API_BASE}/orders/${id}`);
      const data = await resp.json();
      // Data from API is { order, items, history }
      // Map to UI format
      return {
        order: {
          id: data.order.order_id,
          orderCode: data.order.order_code,
          name: data.order.cust_name || `Ügyfél #${data.order.cust_id}`,
          icon: data.order.logo_path ? 'fa-building' : 'fa-box',
          logo: resolveLogoUrl(data.order.logo_path),
          orderDate: data.order.order_date
        },
        items: data.items.map(i => ({
          name: i.prod_name || `Termék #${i.prod_id}`,
          qty: i.quantity,
          price: i.unit_price
        })),
        history: data.history.map(h => ({
          date: h.update_date,
          status: h.status,
          note: h.update_event
        })),
        files: [] 
      };
    } catch (e) {
      return { order: null, history: [], items: [], files: [] };
    }
  },
  
  getStatusLabel: (wf) => STATUS_LABELS[wf] || wf,
  
  getWorkflowStep: (wf) => {
    if (['NEW', 'OFFER_SENT', 'ORDER_CONFIRMED'].includes(wf)) return 1;
    if (['PURCHASE', 'READY_FOR_DELIVERY'].includes(wf)) return 2;
    if (wf === 'DELIVERY') return 3;
    return 4; 
  }
};

window.dataService = dataService;
