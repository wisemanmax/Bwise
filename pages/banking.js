/* ============================================================
   CLOCK + DATE HELPERS
   Every date in the sample data is generated relative to "today" so the
   app never shows a stale feed. Saved state is re-anchored on load (see
   rebaseDates) in whole weeks, which keeps paydays on Fridays.
   ============================================================ */
const DAY_MS = 86400000;
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const MONTH_LONG = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const WEEKDAY = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const startOfDay = d => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const TODAY = startOfDay(new Date());
const fmtMD  = d => MON[d.getMonth()] + ' ' + d.getDate();
const fmtMDY = d => fmtMD(d) + ', ' + d.getFullYear();
const fmtClock = d => d.toLocaleTimeString('en-US', { hour:'numeric', minute:'2-digit' });
const daysBetween = (a, b) => Math.round((startOfDay(b) - startOfDay(a)) / DAY_MS);

/* Stamp fields shared by every transaction. */
function txStamp(when){
  const d = when ? new Date(when) : new Date();
  return { ts:+d, day:fmtMD(d), date:fmtMDY(d), time:fmtClock(d) };
}
/* "Today", "Yesterday", "Thursday", "Oct 12", "Oct 12, 2025" */
function relDay(ts){
  const d = new Date(ts);
  const diff = daysBetween(d, TODAY);
  if(diff === 0) return 'Today';
  if(diff === 1) return 'Yesterday';
  if(diff > 1 && diff < 7) return ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][d.getDay()];
  return d.getFullYear() === TODAY.getFullYear() ? WEEKDAY[d.getDay()] + ', ' + fmtMD(d) : fmtMDY(d);
}
/* "Just now", "12m ago", "3h ago", "Yesterday", "4 days ago", "2 weeks ago" */
function relAgo(ts){
  const ms = Date.now() - ts;
  if(ms < 60000) return 'Just now';
  if(ms < 3600000) return Math.floor(ms / 60000) + 'm ago';
  const days = daysBetween(new Date(ts), TODAY);
  if(days === 0) return Math.floor(ms / 3600000) + 'h ago';
  if(days === 1) return 'Yesterday';
  if(days < 7) return days + ' days ago';
  if(days < 30) return Math.floor(days / 7) + ' week' + (days < 14 ? '' : 's') + ' ago';
  return fmtMD(new Date(ts));
}
/* Next calendar date (today or later) that falls on day-of-month `dom`. */
function nextOn(dom, from){
  const base = startOfDay(from || TODAY);
  const last = d => new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let d = new Date(base.getFullYear(), base.getMonth(), Math.min(dom, last(base)));
  if(d < base){ const n = new Date(base.getFullYear(), base.getMonth() + 1, 1); d = new Date(n.getFullYear(), n.getMonth(), Math.min(dom, last(n))); }
  return d;
}

/* Small deterministic PRNG so the generated history is identical for everyone. */
function mulberry32(a){
  return function(){
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

/* ============================================================
   CATEGORIES + MERCHANTS
   ============================================================ */
const CATEGORIES = {
  Income:        { color:'#16a34a', icon:'<path d="M12 4 V20 M5 13 L12 20 L19 13"/>' },
  Housing:       { color:'#0891b2', icon:'<path d="M3 11 L12 4 L21 11"/><path d="M5 10 V20 H19 V10"/><path d="M10 20 V14 H14 V20"/>' },
  Groceries:     { color:'#65a30d', icon:'<circle cx="9" cy="20" r="1.4"/><circle cx="18" cy="20" r="1.4"/><path d="M2 3 H5 L7.6 15 H19 L21 7 H6"/>' },
  Dining:        { color:'#ea580c', icon:'<path d="M7 3 V21 M4 3 V8 a3 3 0 0 0 6 0 V3"/><path d="M17 21 V3 c-2.2 0 -4 2.5 -4 6.5 c0 2.5 1.8 3.5 4 3.5"/>' },
  Shopping:      { color:'#db2777', icon:'<path d="M5 8 H19 L18 21 H6 Z"/><path d="M9 8 V6 a3 3 0 0 1 6 0 V8"/>' },
  Bills:         { color:'#7c3aed', icon:'<path d="M13 2 L4 14 H12 L11 22 L20 10 H12 Z"/>' },
  Transport:     { color:'#2563eb', icon:'<path d="M5 17 H19 V11 L17 6 H7 L5 11 Z"/><circle cx="8" cy="17.5" r="1.6"/><circle cx="16" cy="17.5" r="1.6"/><path d="M5 11 H19"/>' },
  Entertainment: { color:'#e11d48', icon:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M10 9 L15 12 L10 15 Z"/>' },
  Health:        { color:'#0d9488', icon:'<path d="M12 21 C5 15 3 12 3 8.5 A4.5 4.5 0 0 1 12 6 A4.5 4.5 0 0 1 21 8.5 C21 12 19 15 12 21 Z"/>' },
  Travel:        { color:'#0284c7', icon:'<path d="M10.5 13.5 L3 11 L4.5 9.5 L13 10 L17.5 5.5 a2 2 0 0 1 3 3 L16 13 L16.5 21.5 L15 23 L12.5 15.5"/>' },
  Transfer:      { color:'#64748b', icon:'<path d="M4 8 H18 L14.5 4.5"/><path d="M20 16 H6 L9.5 19.5"/>' },
  Cash:          { color:'#475569', icon:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/>' },
  Other:         { color:'#94a3b8', icon:'<circle cx="12" cy="12" r="8"/>' },
};
const SPEND_CATS = ['Housing','Groceries','Dining','Shopping','Bills','Transport','Entertainment','Health','Travel','Cash','Other'];
const catOf = c => CATEGORIES[c] || CATEGORIES[{Food:'Dining'}[c]] || CATEGORIES.Other;

/* Brand-ish tile colours for the merchant monograms in the activity feed.
   Generic monograms only — no third-party logos are bundled. */
const PLACES = {
  newark:     { city:'Newark',       state:'DE', lat:39.6837, lng:-75.7497 },
  wilmington: { city:'Wilmington',   state:'DE', lat:39.7459, lng:-75.5466 },
  christiana: { city:'Christiana',   state:'DE', lat:39.6601, lng:-75.6557 },
  bear:       { city:'Bear',         state:'DE', lat:39.6293, lng:-75.6582 },
  philly:     { city:'Philadelphia', state:'PA', lat:39.9526, lng:-75.1652 },
};

/* ============================================================
   SAMPLE DATA GENERATOR
   Builds ~120 days of history for four accounts. Balances are produced by
   walking every transaction forward from an opening balance, so the
   running balance on each row always reconciles with the account total.
   ============================================================ */
function buildSeed(nowArg){
  const now = nowArg ? new Date(nowArg) : new Date();
  const today = startOfDay(now);
  const rnd = mulberry32(0x4d455249);
  const r = (min, max) => +(min + rnd() * (max - min)).toFixed(2);
  const pick = arr => arr[Math.floor(rnd() * arr.length)];
  const HISTORY = 120;
  const tx = { a1:[], a2:[], a3:[], a4:[] };
  let seq = 0;
  const at = (back, h, m) => { const d = addDays(today, -back); d.setHours(h, m, 0, 0); return d; };
  const add = (acct, back, h, m, o) => {
    const when = at(back, h, m);
    if(when > now) return null;               /* nothing later than "now" today */
    const pending = (back === 0 && o.method !== 'Internal') || (back === 1 && o.method === 'Card');
    const row = { id:`t-${acct}-${String(++seq).padStart(4,'0')}`, ...txStamp(when), status: pending ? 'Pending' : 'Posted', method:'Card', loc:null, ...o };
    row.amt = +row.amt.toFixed(2);
    tx[acct].push(row);
    return row;
  };
  const card = (acct, back, h, m, name, sub, amt, cat, logo, loc) =>
    add(acct, back, h, m, { name, sub, amt:-amt, cat, method:'Card', logo, loc: loc || null });

  /* payroll: every other Friday, anchored on the most recent Friday */
  const lastFri = addDays(today, -((today.getDay() + 2) % 7));
  const isPayday = d => d.getDay() === 5 && (daysBetween(d, lastFri) % 14) === 0;
  const delmarva = [142.18,128.40,109.77,96.12,88.50,104.31,148.66,162.09,131.45,102.88,96.40,118.42];
  let lastPayday = null;

  for(let back = HISTORY; back >= 0; back--){
    const d = addDays(today, -back);
    const dom = d.getDate(), dow = d.getDay(), weekday = dow > 0 && dow < 6;

    if(isPayday(d)){
      add('a1', back, 6, 2, { name:'Northwind Labs', sub:'Payroll · Direct deposit', amt:2486.12, cat:'Income', method:'ACH', logo:'#0f766e' });
      add('a1', back, 9, 0, { name:'Transfer to Vacation Fund', sub:'Scheduled · every 2 weeks', amt:-100, cat:'Transfer', method:'Internal' });
      add('a4', back, 9, 0, { name:'Transfer from Everyday Checking', sub:'Scheduled · every 2 weeks', amt:100, cat:'Transfer', method:'Internal' });
      lastPayday = d;
    }
    if(dom === 1){
      add('a1', back, 0, 5, { name:'Greenfield Commons', sub:'Rent · ACH autopay', amt:-1725, cat:'Housing', method:'ACH', logo:'#0e7490' });
      add('a1', back, 7, 0, { name:'Transfer to High-Yield Savings', sub:'Scheduled · monthly auto-save', amt:-500, cat:'Transfer', method:'Internal' });
      add('a2', back, 7, 0, { name:'Transfer from Everyday Checking', sub:'Scheduled · monthly auto-save', amt:500, cat:'Transfer', method:'Internal' });
    }
    if(dom === 5)  add('a1', back, 3, 12, { name:'Capital One Auto', sub:'Auto loan · Autopay', amt:-384.21, cat:'Bills', method:'ACH', logo:'#1e3a8a' });
    if(dom === 6)  add('a1', back, 10, 41, { name:'GEICO', sub:'Auto insurance · Bill pay', amt:-152.50, cat:'Bills', method:'Bill pay', logo:'#1d4ed8' });
    if(dom === 10) add('a1', back, 9, 15, { name:'Verizon Wireless', sub:'Mobile · Bill pay', amt:-78.00, cat:'Bills', method:'Bill pay', logo:'#dc2626' });
    if(dom === 15) add('a1', back, 4, 30, { name:'Delmarva Power', sub:'Electric · Autopay', amt:-delmarva[d.getMonth()], cat:'Bills', method:'ACH', logo:'#ca8a04' });
    if(dom === 24) add('a1', back, 2, 0, { name:'Xfinity', sub:'Internet · Autopay', amt:-89.99, cat:'Bills', method:'ACH', logo:'#6d28d9' });
    if(dom === 17) card('a1', back, 5, 0, 'Planet Fitness', 'Membership · Recurring', 24.99, 'Health', '#7e22ce');
    if(dom === 27) card('a1', back, 6, 0, 'Spotify', 'Premium · Recurring', 11.99, 'Entertainment', '#15803d');
    if(dom === 12) card('a3', back, 6, 0, 'Netflix', 'Standard · Recurring', 15.49, 'Entertainment', '#b91c1c');
    if(dom === 5)  card('a3', back, 6, 0, 'Apple iCloud+', '200 GB · Recurring', 2.99, 'Bills', '#334155');
    if(dom === 24) card('a3', back, 6, 0, 'Audible', 'Premium Plus · Recurring', 14.95, 'Entertainment', '#d97706');

    /* everyday spending */
    if(back % 6 === 2){
      const g = pick([['Trader Joe’s','#b91c1c',PLACES.wilmington],['ACME Markets','#dc2626',PLACES.newark],['Giant Food','#7c2d12',PLACES.bear],['Wegmans','#166534',PLACES.newark]]);
      card('a1', back, 17, 40, g[0], 'Debit card · Groceries', r(54, 148), 'Groceries', g[1], g[2]);
    }
    if(back % 8 === 3) card('a1', back, 7, 48, 'Wawa', 'Fuel · Pump 6', r(36, 56), 'Transport', '#b45309', PLACES.bear);
    if(weekday && rnd() < 0.38) card(rnd() < .5 ? 'a3' : 'a1', back, 8, 5 + Math.floor(rnd()*40), 'Starbucks', 'Coffee', r(5.25, 8.10), 'Dining', '#166534', PLACES.newark);
    if(weekday && rnd() < 0.26){
      const l = pick([['Chipotle','#9a3412'],['Sweetgreen','#15803d'],['CAVA','#c2410c'],['Panera Bread','#4d7c0f']]);
      card('a3', back, 12, 20 + Math.floor(rnd()*30), l[0], 'Lunch', r(11.40, 17.85), 'Dining', l[1], PLACES.wilmington);
    }
    if(rnd() < 0.17){
      const n = pick([['DoorDash','#dc2626','Delivery · Iron Hill Brewery',null],['Home Grown Café','#a16207','Dinner',PLACES.newark],['Grain Craft Bar + Kitchen','#78350f','Dinner',PLACES.newark],['Uber Eats','#065f46','Delivery',null]]);
      card('a3', back, 19, 10 + Math.floor(rnd()*40), n[0], n[2], r(26, 78), 'Dining', n[1], n[3]);
    }
    if(rnd() < 0.12) card('a3', back, 21, Math.floor(rnd()*50), 'Amazon', 'Online purchase', r(12.99, 96.40), 'Shopping', '#0f172a');
    if(back % 13 === 5) card('a1', back, 15, 22, 'Target', 'Debit card · Christiana Fashion Center', r(38, 142), 'Shopping', '#b91c1c', PLACES.christiana);
    if(rnd() < 0.06) card('a3', back, 22, 15, 'Uber', 'Trip', r(12.40, 34.80), 'Transport', '#111827', PLACES.philly);
    if(dow === 6 && rnd() < 0.4){
      const e = pick([['AMC Theatres','#991b1b','Movies · 2 tickets',31.50],['Topgolf','#1d4ed8','Bay rental',58.00],['Dogfish Head Brewings','#0f766e','Tasting room',42.75]]);
      card('a3', back, 16, 30, e[0], e[2], e[3], 'Entertainment', e[1], PLACES.wilmington);
    }
    if(rnd() < 0.05) card('a1', back, 18, 5, 'CVS Pharmacy', 'Debit card', r(8.49, 38.20), 'Health', '#b91c1c', PLACES.newark);
    if(back % 20 === 9) add('a1', back, 13, 2, { name:'ATM withdrawal', sub:'Meridian ATM · 40 E Main St, Newark', amt:-pick([60,80,100]), cat:'Cash', method:'ATM', loc:PLACES.newark });
    if(back % 16 === 4){
      if(rnd() < .55) add('a1', back, 20, 12, { name:'Alex Rivera', sub:'Zelle® · ' + pick(['Concert tickets','Dinner split','Uber home','Groceries']), amt:-r(24, 62), cat:'Transfer', method:'Zelle', logo:'#7c3aed' });
      else add('a1', back, 20, 12, { name:'Jordan Patel', sub:'Zelle® · ' + pick(['Brunch','Gas money','Thanks!']), amt:r(18, 45), cat:'Income', method:'Zelle', logo:'#7c3aed' });
    }
    if(back % 27 === 11) add('a1', back, 10, 30, { name:'Venmo', sub:'Cash out · Instant transfer', amt:r(40, 140), cat:'Income', method:'ACH', logo:'#0284c7' });
    if(back === 44){
      card('a3', back, 14, 12, 'United Airlines', 'PHL → DEN · Conf. K7Q2LM', 386.40, 'Travel', '#1e40af');
      card('a3', back - 9, 22, 4, 'Hilton Denver Downtown', 'Lodging · 2 nights', 412.18, 'Travel', '#1e3a8a');
    }
    if(back === 31) add('a3', back, 11, 5, { name:'Amazon', sub:'Refund · Return processed', amt:24.99, cat:'Shopping', method:'Card', logo:'#0f172a' });
  }

  /* round-up sweep on the 1st: the change from last month's debit-card purchases */
  for(const rent of tx.a1.filter(t => t.name === 'Greenfield Commons')){
    const d = new Date(rent.ts);
    const from = new Date(d.getFullYear(), d.getMonth() - 1, 1), to = new Date(d.getFullYear(), d.getMonth(), 1);
    const amt = +tx.a1.filter(t => t.method === 'Card' && t.amt < 0 && t.ts >= +from && t.ts < +to)
                      .reduce((s, t) => s + (Math.ceil(-t.amt) + t.amt), 0).toFixed(2);
    if(amt <= 0) continue;
    const back = daysBetween(d, today);
    add('a1', back, 8, 0, { name:'Round-up sweep', sub:'To Vacation Fund · ' + MONTH_LONG[from.getMonth()], amt:-amt, cat:'Transfer', method:'Internal' });
    add('a4', back, 8, 0, { name:'Round-ups from checking', sub:MONTH_LONG[from.getMonth()] + ' purchases', amt, cat:'Transfer', method:'Internal' });
  }

  /* credit card: statement closes on the 20th, paid in full on the 10th */
  const CLOSE_DAY = 20, PAY_DAY = 10, DUE_DAY = 15;
  const ccBalanceAt = (ts, opening) => opening + tx.a3.filter(t => t.ts <= ts).reduce((s, t) => s + t.amt, 0);
  const CC_OPEN = -742.36;
  for(let back = HISTORY; back >= 0; back--){
    const d = addDays(today, -back);
    if(d.getDate() !== PAY_DAY) continue;
    const close = new Date(d.getFullYear(), d.getMonth() - 1, CLOSE_DAY, 23, 59);
    const stmt = -ccBalanceAt(+close, CC_OPEN);
    if(stmt <= 0) continue;
    const amt = +stmt.toFixed(2);
    add('a1', back, 8, 30, { name:'Meridian Rewards Visa', sub:'Card payment · •• 9045', amt:-amt, cat:'Transfer', method:'Online', logo:'#1e293b' });
    add('a3', back, 8, 30, { name:'Payment — thank you', sub:'From Everyday Checking', amt:amt, cat:'Transfer', method:'Online' });
  }

  /* savings: interest credited on the last day of each month at 3.80% APY */
  /* Interest compounds on the running balance, so the opening balance is solved
     for: today's savings balance always lands exactly on SAVINGS_BALANCE. */
  const APY = 3.80, SAVINGS_BALANCE = 235282.00;
  const rate = Math.pow(1 + APY/100, 1/12) - 1;
  const deposits = tx.a2.slice();
  const monthEnds = [];
  for(let back = HISTORY; back >= 0; back--){
    if(addDays(addDays(today, -back), 1).getDate() === 1 && +at(back, 23, 0) <= +now) monthEnds.push(back);
  }
  const simulate = open => {
    const posts = [];
    for(const back of monthEnds){
      const cutoff = +at(back, 23, 0);
      const bal = open + deposits.filter(t => t.ts < cutoff).reduce((s, t) => s + t.amt, 0) + posts.reduce((s, p) => s + p.amt, 0);
      posts.push({ back, amt: +(bal * rate).toFixed(2) });
    }
    return { posts, final: open + deposits.reduce((s, t) => s + t.amt, 0) + posts.reduce((s, p) => s + p.amt, 0) };
  };
  const growth = (simulate(1000).final - simulate(0).final) / 1000;   /* final is affine in the opening */
  let sav = (SAVINGS_BALANCE - simulate(0).final) / growth;
  const solved = simulate(sav);
  sav = +(sav + SAVINGS_BALANCE - solved.final).toFixed(2);           /* absorb sub-cent rounding */
  for(const p of solved.posts){
    const d = addDays(today, -p.back);
    add('a2', p.back, 23, 0, { name:'Interest paid', sub: APY.toFixed(2) + '% APY · ' + MONTH_LONG[d.getMonth()], amt: p.amt, cat:'Income', method:'Interest' });
  }

  /* newest first + reconcile balances */
  const sum = arr => arr.reduce((s, t) => s + t.amt, 0);
  for(const k of Object.keys(tx)) tx[k].sort((a, b) => b.ts - a.ts);
  const minRunning = (arr, opening) => { let b = opening, m = Infinity; for(const t of arr.slice().reverse()){ b += t.amt; m = Math.min(m, b); } return m; };
  let chkOpen = 3920.00;
  const low = minRunning(tx.a1, chkOpen);
  if(low < 650) chkOpen += Math.ceil(650 - low);
  const balance = {
    a1: +(chkOpen + sum(tx.a1)).toFixed(2),
    a2: +(sav + sum(tx.a2)).toFixed(2),
    a3: +(CC_OPEN + sum(tx.a3)).toFixed(2),
    a4: +(1140.00 + sum(tx.a4)).toFixed(2),
  };
  const pendingOut = id => -tx[id].filter(t => t.status === 'Pending' && t.amt < 0).reduce((s, t) => s + t.amt, 0);

  const lastClose = (() => { let c = new Date(today.getFullYear(), today.getMonth(), CLOSE_DAY); if(c > today) c = new Date(today.getFullYear(), today.getMonth() - 1, CLOSE_DAY); c.setHours(23, 59); return c; })();
  const stmtBal = +(-ccBalanceAt(+lastClose, CC_OPEN)).toFixed(2);
  const paidSinceClose = tx.a3.filter(t => t.ts > +lastClose && t.method === 'Online').reduce((s, t) => s + t.amt, 0);
  const lastCcPay = tx.a3.find(t => t.method === 'Online');
  const ccDue = nextOn(DUE_DAY, addDays(lastClose, 1));
  const lastSweep = tx.a4.find(t => /Round-ups/.test(t.name));

  const ago = (days, h = 9, m = 0) => { const d = addDays(today, -days); d.setHours(h, m); return +d; };
  const latestPay = tx.a1.find(t => t.name === 'Northwind Labs');
  const latestCard = tx.a1.concat(tx.a3).filter(t => t.method === 'Card' && t.amt < 0).sort((a, b) => b.ts - a.ts)[0];
  const latestInterest = tx.a2.find(t => t.name === 'Interest paid');
  const stmtMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);

  const payees = [
    { id:'p1', name:'Xfinity',          category:'Internet & cable', account:'•• 8821', logoColor:'#6d28d9', last: 89.99,  autopay:true,  dueDay:24 },
    { id:'p2', name:'Delmarva Power',   category:'Electric utility', account:'•• 4419', logoColor:'#ca8a04', last: delmarva[(today.getMonth()+11)%12], autopay:true, dueDay:15 },
    { id:'p3', name:'Verizon Wireless', category:'Mobile',           account:'•• 7720', logoColor:'#dc2626', last: 78.00,  autopay:false, dueDay:10 },
    { id:'p4', name:'GEICO',            category:'Auto insurance',   account:'•• 0035', logoColor:'#1d4ed8', last:152.50,  autopay:false, dueDay:6 },
    { id:'p5', name:'Capital One Auto', category:'Auto loan',        account:'•• 1199', logoColor:'#1e3a8a', last:384.21,  autopay:true,  dueDay:5 },
  ];

  return {
    seedVersion: 6,
    seededAt: +today,
    user: { name: 'Bryce', avatar: 'BW' },
    theme: (typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light',
    hideBalances: false,
    hasOnboarded: false,
    pin: null,             /* 6-digit string, null until the user sets one */
    bioEnabled: true,      /* Face ID / platform authenticator */
    bioCredentialId: null, /* base64url id of the registered WebAuthn credential */
    signedIn: false,
    lastSignIn: null,
    freezeOn: false,
    notifications: [
      latestPay && { id:'n1', unread:true, ts:latestPay.ts + 60000, title:'Direct deposit received', body:`$${latestPay.amt.toLocaleString('en-US',{minimumFractionDigits:2})} from Northwind Labs is available in Everyday Checking.` },
      latestCard && { id:'n2', unread:true, ts:latestCard.ts + 30000, title:`Card purchase at ${latestCard.name}`, body:`$${(-latestCard.amt).toFixed(2)} on card ${latestCard.id.startsWith('t-a3') ? '•• 9045' : '•• 4827'}. Not you? Tap to review.` },
      { id:'n3', unread:false, ts:Math.min(+new Date(today.getFullYear(), today.getMonth(), 1, 8, 0), Date.now() - 3600000), title:'Your statement is ready', body:`Your ${MONTH_LONG[stmtMonth.getMonth()]} statement for Everyday Checking is available to view.` },
      latestInterest && { id:'n4', unread:false, ts:latestInterest.ts + 120000, title:'Interest paid', body:`$${latestInterest.amt.toFixed(2)} earned in High-Yield Savings at ${APY.toFixed(2)}% APY.` },
      { id:'n5', unread:false, ts:ago(4, 10, 15), title:'Credit score updated', body:'Your FICO® Score went up 12 points to 782.' },
      { id:'n6', unread:false, ts:ago(9, 19, 42), title:'New sign-in to your account', body:'iPhone 15 Pro · Newark, DE. If this wasn’t you, lock your account now.' },
    ].filter(Boolean),
    accounts: [
      { id:'a1', kind:'checking', type:'Checking',     name:'Everyday Checking',     mask:'•• 4827', number:'4100184827', routing:'110000000', swift:'MRDNUS33', balance:balance.a1, pending:pendingOut('a1'), color:'checking', opened:'Mar 2021', spendable:balance.a1, aside:0 },
      { id:'a2', kind:'savings',  type:'Savings',      name:'High-Yield Savings',    mask:'•• 6310', number:'4100206310', routing:'110000000', swift:'MRDNUS33', balance:balance.a2, pending:0, color:'savings', opened:'Mar 2021', apy:APY, spendable:balance.a2, aside:0, ytdInterest: +tx.a2.filter(t => t.name === 'Interest paid' && new Date(t.ts).getFullYear() === today.getFullYear()).reduce((s,t)=>s+t.amt,0).toFixed(2) },
      { id:'a3', kind:'credit',   type:'Credit card',  name:'Meridian Rewards Visa', mask:'•• 9045', number:'4147 2026 1530 9045', routing:'', swift:'', balance:balance.a3, pending:pendingOut('a3'), color:'credit', opened:'Jun 2022', limit:12000, apr:21.24, dueDay:DUE_DAY, due:fmtMD(ccDue), minPayment: Math.max(35, Math.round(stmtBal * 0.02)), statementBalance: +(Math.max(0, stmtBal - paidSinceClose)).toFixed(2), statementClosed: fmtMD(lastClose), lastPayment: lastCcPay ? { amount:lastCcPay.amt, date:lastCcPay.day } : null, rewardsPoints:18420, spendable:0, aside:0 },
      { id:'a4', kind:'savings',  type:'Savings goal', name:'Vacation Fund',         mask:'•• 0938', number:'4100220938', routing:'110000000', swift:'MRDNUS33', balance:balance.a4, pending:0, color:'goal', opened:'Aug 2024', goal:3500, goalBy:fmtMDY(new Date(today.getFullYear() + (today.getMonth() > 3 ? 1 : 0), 4, 24)), spendable:balance.a4, aside:balance.a4 },
    ],
    txByAccount: tx,
    payees,
    zelleContacts: [
      { id:'z1', name:'Denise Wise',  handle:'(302) 555-0110',          tag:'frequent', color:1, last:60    },
      { id:'z2', name:'Alex Rivera',  handle:'(302) 555-0144',          tag:'frequent', color:3, last:42.50 },
      { id:'z3', name:'Jordan Patel', handle:'jordan.patel@gmail.com',  tag:'recent',   color:5, last:25    },
      { id:'z4', name:'Sam Kim',      handle:'(484) 555-0192',          tag:'recent',   color:6, last:18.50 },
      { id:'z5', name:'Dani Torres',  handle:'dani.torres@outlook.com', tag:'',         color:2, last:0     },
    ],
    searches: [],
    scheduledTransfers: [
      { id:'sch-1', fromId:'a1', toId:'a2', amount:500.00, freq:'monthly',  dueDay:1, nextDate:fmtMD(nextOn(1, addDays(today, 1))), memo:'Auto-save' },
      { id:'sch-2', fromId:'a1', toId:'a4', amount:100.00, freq:'biweekly', anchorTs:+lastFri, nextDate:fmtMD(addDays(lastFri, 14)), memo:'Vacation goal' },
    ],
    billPayments: [],
    hiddenTx: [],
    txOverrides: {},
    cardLimits: { daily: 2500, atm: 800, online: 2000, contactless: true, magstripe: false },
    cardRegions: [
      { id:'na', name:'North America', sub:'US, Canada, Mexico',                  allowed:true  },
      { id:'eu', name:'Europe',        sub:'Schengen + UK, Ireland, Switzerland', allowed:true  },
      { id:'ap', name:'Asia Pacific',  sub:'Japan, Korea, Australia, NZ',         allowed:true  },
      { id:'sa', name:'South America', sub:'Brazil, Argentina, Chile, etc.',      allowed:false },
      { id:'af', name:'Africa',        sub:'All countries',                       allowed:false },
      { id:'me', name:'Middle East',   sub:'GCC + Israel, Turkey',                allowed:false },
    ],
    beneficiaries: [
      { id:'b1', name:'Alex Wise',  relation:'Spouse', share:60, ssn:'•• 4291' },
      { id:'b2', name:'Jamie Wise', relation:'Child',  share:40, ssn:'•• 0832' },
    ],
    linkedAccounts: [
      { id:'la1', bank:'Chase',    name:'Total Checking', mask:'•• 9921', balance:1245.10,  status:'verified' },
      { id:'la2', bank:'Vanguard', name:'Brokerage',      mask:'•• 0188', balance:48210.55, status:'verified' },
      { id:'la3', bank:'Coinbase', name:'USD Wallet',     mask:'•• 7314', balance:320.00,   status:'pending'  },
    ],
    profile: {
      legalName: 'Bryce Wise',
      preferredName: 'Bryce',
      email: 'bryce.wise@example.com',
      phone: '(302) 555-0177',
      address: '142 N Greenfield Rd, Newark, DE 19711',
      dob: '•• / •• / 1994',
      ssn: '•••-••-4471'
    },
    notifPrefs: {
      deposits: true, withdrawals: true, lowBalance: true, lowBalanceThreshold: 100,
      cardActivity: true, internationalActivity: true, fraudAlerts: true,
      statements: true, marketing: false, productUpdates: true,
      push: true, email: true, sms: false
    },
    language: 'en-US',
    signOutAfter: 5,
    passcodeChangedAt: fmtMDY(addDays(today, -38)),
    cardReplacements: [],
    wallet: { apple:false, google:false, deviceName:'iPhone 15 Pro' },
    wireRecipients: [
      { id:'wr1', kind:'dom',  name:'Alex Rivera',      bank:'Wells Fargo',     account:'•• 8821', routing:'121000248', address:'123 Main St, Berkeley, CA' },
      { id:'wr2', kind:'intl', name:'Studio Verde Ltd', bank:'Banco Santander', iban:'ES91 2100 0418 4502 0005 1332', swift:'BSCHESMM', address:'Carrer de Pelai 12, Barcelona, Spain', country:'Spain' },
    ],
    wireFees: { dom: 25, intl: 45, fxPct: 1.0, cutoff: '5:00 PM ET' },
    roundUps: { enabled: true, destAccountId: 'a4', accumulated: 0, monthAccumulated: 0, lifetimeSwept: 212.48, lastSweep: lastSweep ? lastSweep.date : '—' },
    creditScore: {
      score: 782,
      range: 'Very good',
      change: +12,
      lastUpdated: fmtMDY(addDays(today, -4)),
      nextUpdate: fmtMDY(addDays(today, 26)),
      bureau: 'Experian · FICO® Score 8',
      factors: [
        { id:'history',     label:'Payment history',     impact:'high',   status:'good', detail:'100% on-time payments · 7 yrs' },
        { id:'utilization', label:'Credit utilization',  impact:'high',   status:'good', detail:'9% of $12,000 total limit' },
        { id:'age',         label:'Average account age', impact:'medium', status:'fair', detail:'4 yrs 2 mos — keep older accounts open' },
        { id:'mix',         label:'Credit mix',          impact:'low',    status:'good', detail:'Revolving + installment (auto loan)' },
        { id:'inquiries',   label:'Hard inquiries',      impact:'low',    status:'good', detail:'1 in the last 24 months' },
      ],
      history: [751, 754, 758, 757, 761, 764, 762, 768, 766, 771, 774, 770, 782]
    },
    ccPayments: [],
    cardDesign: 'graphite',
    emojiPicks: ['💰','🏦','💳','✈️','🏖️','🏠','🚗','🎓','🎁','💍','🛍️','⛷️','🐶','🌱','💼','👨‍👩‍👧'],
    archivedNotifIds: []
  };
}

/* ============================================================
   PERSISTENCE
   ============================================================ */
const STORAGE_KEY = 'meridian.v5';
const LEGACY_KEYS = ['meridian.v4'];
/* user preferences worth carrying over from an older saved schema */
const CARRY_PREFS = ['pin','bioEnabled','bioCredentialId','theme','hasOnboarded','hideBalances','language','signOutAfter','notifPrefs','cardLimits','cardRegions'];

/* Shift saved dates forward in whole weeks so a returning user's feed is
   current. Derived dates (bill due dates, next transfers) are recomputed. */
function rebaseDates(s){
  const weeks = Math.floor(daysBetween(new Date(s.seededAt || TODAY), TODAY) / 7);
  if(weeks > 0){
    const shift = weeks * 7 * DAY_MS;
    for(const list of Object.values(s.txByAccount || {})){
      for(const t of list){ if(t.ts){ Object.assign(t, txStamp(t.ts + shift)); } }
    }
    (s.notifications || []).forEach(n => { if(n.ts) n.ts += shift; });
    s.seededAt = (s.seededAt || +TODAY) + shift;
  }
  (s.payees || []).forEach(p => { if(p.dueDay) p.next = fmtMD(nextOn(p.dueDay)); });
  (s.scheduledTransfers || []).forEach(x => {
    if(x.freq === 'monthly' && x.dueDay) x.nextDate = fmtMD(nextOn(x.dueDay, addDays(TODAY, 1)));
    if(x.freq === 'biweekly' && x.anchorTs){
      let d = startOfDay(x.anchorTs); while(d <= TODAY) d = addDays(d, 14);
      x.nextDate = fmtMD(d);
    }
  });
  const cc = (s.accounts || []).find(a => a.kind === 'credit');
  if(cc && cc.dueDay) cc.due = fmtMD(nextOn(cc.dueDay));
  return s;
}

function loadState(){
  const fresh = buildSeed();
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      const parsed = JSON.parse(raw);
      if(parsed && parsed.seedVersion === fresh.seedVersion) return rebaseDates({ ...fresh, ...parsed });
      /* older sample data: start fresh but keep the user's own settings */
      if(parsed) CARRY_PREFS.forEach(p => { if(parsed[p] !== undefined) fresh[p] = parsed[p]; });
    }
    for(const k of LEGACY_KEYS){
      const old = localStorage.getItem(k);
      if(!old) continue;
      const prev = JSON.parse(old);
      CARRY_PREFS.forEach(p => { if(prev[p] !== undefined) fresh[p] = prev[p]; });
      localStorage.removeItem(k);
      break;
    }
  }catch(e){ /* corrupt or blocked storage — fall back to fresh data */ }
  return rebaseDates(fresh);
}
function saveState(){
  try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }catch(e){ /* storage full / private mode */ }
}
let state = loadState();

/* ============================================================
   FORMATTING + HELPERS
   ============================================================ */
const fmt = n => n.toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const fmtMoney = n => (n<0?'-$':'$') + fmt(Math.abs(n));
const fmtSigned = n => (n>=0?'+':'−') + '$' + fmt(Math.abs(n));
const APP_VERSION = '5.0.1';
/* "$4,862<span class="amt-c">.19</span>" — large amounts with de-emphasised cents */
function moneyHTML(n){
  const [w, c] = fmt(Math.abs(n)).split('.');
  return (n < 0 ? '−' : '') + '$' + w + '<span class="amt-c">.' + c + '</span>';
}
const pickCls = a => a.color === 'savings' ? 'gold' : a.color === 'credit' ? 'dark' : a.color === 'goal' ? 'goal' : '';
function initials(name){
  return String(name || '').replace(/[^\p{L} ]/gu, ' ').split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]).join('').toUpperCase() || 'M';
}
function svgIcon(path, w = 1.9){
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${path}</svg>`;
}
/* Merchant monogram when we know the brand colour, otherwise a category glyph. */
function txAvatar(t, size){
  const pend = t.status === 'Pending' ? `<span class="badge-pend">${svgIcon('<path d="M12 7 V12 L15 14"/>', 3.2)}</span>` : '';
  const style = size ? `width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px;` : '';
  if(t.logo) return `<div class="tx-icon" style="--c:${t.logo};${style}" aria-hidden="true">${escapeHtml(initials(t.name))}${pend}</div>`;
  const cat = catOf(effectiveCat(t));
  return `<div class="tx-icon cat" style="--c:${cat.color};${style}" aria-hidden="true">${svgIcon(cat.icon)}${pend}</div>`;
}
const accountById = id => state.accounts.find(a => a.id === id);

function applyTheme(){
  document.documentElement.setAttribute('data-theme', state.theme);
  const canvas = state.theme === 'dark' ? '#07080c' : '#f2f3f7';
  document.querySelectorAll('meta[name="theme-color"]').forEach(m => m.setAttribute('content', canvas));
  const ds = document.getElementById('darkSwitch');
  const dl = document.getElementById('darkLabel');
  if(ds){ ds.classList.toggle('on', state.theme==='dark') }
  if(dl){ dl.textContent = state.theme==='dark' ? 'On' : 'Off' }
}
function toggleTheme(){ state.theme = state.theme==='dark' ? 'light' : 'dark'; saveState(); applyTheme(); }

function toggleHide(){
  state.hideBalances = !state.hideBalances; saveState();
  PREV_BAL.home = null;
  renderHome();
  if(current === 'detail' && activeId){ PREV_BAL.detail = null; openAccountRefresh(); }
}

function maskAmt(s){ return s.replace(/[0-9]/g,'•') }

/* ============================================================
   SCREEN ROUTER
   ============================================================ */
const screens = ['splash','onboarding','lock','home','detail','transfer','cards','statements','notifications','help','profile','acctDetails','search','deposit','payBill','zelle','cardLimits','cardInternational','cardReport','scheduled','personalInfo','linkedAccounts','beneficiaries','notifPrefs','language','autoSignOut','helpArticle','subs','wire','wallet','cardTracker','about','ccPay','credit'];
let current = 'splash';

function go(toId){
  if(toId === current) return;
  const from = document.getElementById(current);
  const to = document.getElementById(toId);
  if(!to) return;
  const frame = document.getElementById('frame');
  if(TAB_ROOTS.has(current) && TAB_ROOTS.has(toId)){
    frame.classList.add('tab-fade');
    clearTimeout(go._fade);
    go._fade = setTimeout(()=> frame.classList.remove('tab-fade'), 460);
  }
  to.classList.remove('enter-right');
  requestAnimationFrame(()=>{
    to.classList.add('active');
    from.classList.remove('active');
    from.classList.add('exit-left');
  });
  setTimeout(()=>{ from.classList.remove('exit-left'); from.classList.add('enter-right') }, 420);
  current = toId;
  const sc = to.querySelector('.scroll'); if(sc){ sc.scrollTop = 0; sc.classList.remove('shadowed'); }
}
function back(fromId, toId){
  const from = document.getElementById(fromId);
  const to = document.getElementById(toId);
  if(!to) return;
  to.classList.remove('enter-right');
  to.classList.remove('exit-left');
  requestAnimationFrame(()=>{
    to.classList.add('active');
    from.classList.remove('active');
    from.style.transform = 'translateX(100%)';
  });
  setTimeout(()=>{ from.classList.add('enter-right'); from.style.transform=''; }, 400);
  current = toId;
}

/* The four root tabs share one floating tab bar; "Move" opens a sheet. */
const TAB_ROOTS = new Set(['home','cards','help','profile']);
function setTab(tab){
  if(tab === 'move'){ openSheet('move'); return; }
  if(!TAB_ROOTS.has(tab)) return;
  if(current === tab){
    const sc = document.querySelector('#' + tab + ' .scroll');
    if(sc) sc.scrollTo({ top:0, behavior:'smooth' });
    return;
  }
  go(tab);
}
function syncTabbar(){
  const frame = document.getElementById('frame');
  if(!frame) return;
  frame.classList.toggle('show-tabs', TAB_ROOTS.has(current));
  document.querySelectorAll('#tabbar .tab').forEach(t => {
    const on = t.dataset.tab === current;
    t.classList.toggle('active', on);
    if(on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  });
}

/* ============================================================
   ONBOARDING
   ============================================================ */
const onbSlides = [
  {
    art: `
      <div style="position:relative">
        <div class="art-card back"><b>Meridian</b><span>•••• 9045</span></div>
        <div class="art-card front">
          <div style="display:flex;justify-content:space-between;align-items:center;position:relative;z-index:1"><b>Meridian</b><span style="font-size:10px;letter-spacing:.16em">DEBIT</span></div>
          <span>••••&nbsp;&nbsp;4827</span>
        </div>
      </div>`,
    title: 'Banking that keeps up with you',
    desc: 'Checking, high-yield savings and a rewards card in one app. No monthly fees, no minimum balance.'
  },
  {
    art: `
      <div class="art-apy">
        <small>High-Yield Savings</small>
        <div class="n">3.80<em>%</em></div>
        <small>APY · FDIC-insured up to $250,000</small>
        <svg viewBox="0 0 200 46" preserveAspectRatio="none" aria-hidden="true"><path d="M0 42 C40 40 62 32 92 27 S152 13 200 4" fill="none" stroke="var(--pos)" stroke-width="3" stroke-linecap="round"/></svg>
      </div>`,
    title: 'Savings that actually earn',
    desc: 'Earn 3.80% APY, set goals, and let round-ups move your spare change automatically.'
  },
  {
    art: `
      <div class="art-feed">
        <div class="art-row"><div class="tx-icon" style="--c:#0f766e">N</div><div>Northwind Labs<br><small style="color:var(--muted);font-weight:500">Paycheck · 2 days early</small></div><em>+$2,486.12</em></div>
        <div class="art-row"><div class="tx-icon cat" style="--c:#ea580c">${svgIcon(CATEGORIES.Dining.icon)}</div><div>Starbucks<br><small style="color:var(--muted);font-weight:500">Card •• 4827</small></div>−$6.45</div>
        <div class="art-row alert"><div class="tx-icon" style="--c:#3d5afe">${svgIcon('<rect x="4" y="11" width="16" height="10" rx="2.5"/><path d="M8 11 V7.5 a4 4 0 0 1 8 0 V11"/>')}</div><div>Card locked<br><small style="opacity:.7;font-weight:500">One tap, instantly</small></div></div>
      </div>`,
    title: 'Security you can see',
    desc: 'Face ID or passkey sign-in, instant card lock, real-time alerts and $0 liability for unauthorized charges.'
  }
];
let onbIdx = 0;
function renderOnboard(){
  const s = onbSlides[onbIdx];
  document.getElementById('onbStage').innerHTML = `
    <div class="onb-art">${s.art}</div>
    <h1 class="onb-title">${s.title}</h1>
    <p class="onb-desc">${s.desc}</p>
    <div class="onb-dots">
      ${onbSlides.map((_,i)=>`<span class="onb-dot ${i===onbIdx?'active':''}"></span>`).join('')}
    </div>
  `;
  document.getElementById('onbNext').textContent = onbIdx === onbSlides.length-1 ? 'Get started' : 'Continue';
}
document.getElementById('onbNext').addEventListener('click', ()=>{
  if(onbIdx < onbSlides.length-1){ onbIdx++; renderOnboard(); }
  else{ finishOnboard(); }
});
document.getElementById('onbSkip').addEventListener('click', finishOnboard);
function finishOnboard(){
  state.hasOnboarded = true; saveState();
  lockShow();
}

/* ============================================================
   HOME
   ============================================================ */
function greeting(){
  const h = new Date().getHours();
  return h < 5 ? 'Good evening' : h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}
const cashAccounts = () => state.accounts.filter(a => a.kind !== 'credit');
const isHidden = t => !!(state.txOverrides[t.id] && state.txOverrides[t.id].hidden);
/* every visible transaction, tagged with its account id */
function allTx(){
  const out = [];
  for(const [acct, list] of Object.entries(state.txByAccount)) for(const t of list) if(!isHidden(t)) out.push({ ...t, acct });
  return out.sort((a, b) => (b.ts || 0) - (a.ts || 0));
}
/* balance of a set of accounts at the end of `daysAgo` days before today */
function balanceSeries(accts, days){
  const ids = new Set(accts.map(a => a.id));
  const now = accts.reduce((s, a) => s + a.balance, 0);
  const txs = allTx().filter(t => ids.has(t.acct) && t.ts);
  const out = [];
  for(let d = days; d >= 0; d--){
    const end = +addDays(TODAY, 1 - d);
    out.push(now - txs.filter(t => t.ts >= end).reduce((s, t) => s + t.amt, 0));
  }
  return out;
}
/* spending = money leaving checking or charged to the card, excluding transfers/payments */
function spendingBetween(fromTs, toTs){
  const by = {};
  let total = 0;
  for(const t of allTx()){
    if(!t.ts || t.ts < fromTs || t.ts >= toTs || t.amt >= 0) continue;
    const a = accountById(t.acct);
    if(!a || (a.kind !== 'checking' && a.kind !== 'credit')) continue;
    const c = effectiveCat(t);
    if(c === 'Transfer' || c === 'Income') continue;
    by[c] = (by[c] || 0) - t.amt;
    total -= t.amt;
  }
  return { total, by };
}
function sparkPaths(values, w, h, pad = 6){
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => [ (i / (values.length - 1)) * w, pad + (1 - (v - min) / span) * (h - pad * 2) ]);
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`;
  for(let i = 1; i < pts.length; i++){
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    const cx = (x0 + x1) / 2;
    d += ` C${cx.toFixed(1)} ${y0.toFixed(1)} ${cx.toFixed(1)} ${y1.toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`;
  }
  return { line: d, area: d + ` L${w} ${h} L0 ${h} Z`, last: pts[pts.length - 1] };
}
function sparkSVG(values, w, h, id){
  const p = sparkPaths(values, w, h);
  return `<defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".28"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="${p.area}" fill="url(#${id})"/>
    <path d="${p.line}" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${p.last[0]}" cy="${p.last[1]}" r="3.5" fill="#fff"/>`;
}
function acctIcon(a){
  const emoji = (a.name.match(/^(\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic})*️?)\s/u) || [])[1];
  const kind = a.kind === 'credit' ? 'credit' : a.goal ? 'goal' : a.kind;
  const glyph = emoji ? `<span aria-hidden="true">${emoji}</span>` :
    kind === 'checking' ? svgIcon('<path d="M3 10 L12 4 L21 10"/><path d="M5 10 V18 M9.5 10 V18 M14.5 10 V18 M19 10 V18 M3 20 H21"/>') :
    kind === 'savings'  ? svgIcon('<path d="M19 9 a7 7 0 0 0 -13.6 1.2 C3.6 11 3 12.4 3 14 h2 c.6 1.9 2 3.2 3.5 4 V20 h3 v-1.5 h2 V20 h3 v-2.4 c1.6 -1.1 2.5 -2.8 2.5 -4.6 V9 Z"/><circle cx="15" cy="11" r=".9" fill="currentColor"/>') :
    kind === 'credit'   ? svgIcon('<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10 H21.5 M6 15 H10"/>') :
                          svgIcon('<path d="M10.5 13.5 L3 11 L4.5 9.5 L13 10 L17.5 5.5 a2 2 0 0 1 3 3 L16 13 L16.5 21.5 L15 23 L12.5 15.5"/>');
  return `<div class="acct-ico ${kind}">${glyph}</div>`;
}
const displayName = a => a.name.replace(/^(\p{Extended_Pictographic}(?:‍\p{Extended_Pictographic})*️?)\s/u, '');
const hiddenAmt = () => '••••';

function renderHome(){
  const hide = state.hideBalances;
  document.getElementById('greetTime').textContent = greeting();
  document.getElementById('greetName').textContent = state.user.name || 'there';
  const av = document.getElementById('homeAvatar'); if(av) av.textContent = initials(state.profile.legalName || state.user.name);
  const asOf = document.getElementById('apyAsOf'); if(asOf) asOf.textContent = fmtMDY(TODAY);
  const unread = state.notifications.filter(n => n.unread && !state.archivedNotifIds.includes(n.id)).length;
  const badge = document.getElementById('notifBadge');
  if(badge) badge.style.display = unread > 0 ? 'block' : 'none';
  const nb = document.getElementById('notifBtn'); if(nb) nb.setAttribute('aria-label', `Notifications${unread ? `, ${unread} unread` : ''}`);

  /* hero */
  const cash = cashAccounts();
  const total = cash.reduce((s, a) => s + a.balance, 0);
  document.getElementById('heroLbl').textContent = `Total cash · ${cash.length} accounts`;
  animateHomeTotal(total);
  const series = balanceSeries(cash, 30);
  const delta = total - series[0];
  document.getElementById('heroMeta').innerHTML = hide ? '' : `
    <span class="hero-chip ${delta >= 0 ? 'up' : 'down'}">${delta >= 0 ? '▲' : '▼'} ${fmtMoney(Math.abs(delta))}</span>
    <span style="font-size:12.5px;opacity:.7;font-weight:500">vs. 30 days ago</span>`;
  document.getElementById('heroSpark').innerHTML = hide ? '' : sparkSVG(series, 340, 64, 'hs');
  const eye = document.getElementById('eyeIcon');
  if(eye) eye.innerHTML = hide
    ? '<path d="M3 3 L21 21"/><path d="M10.6 5.1 A10.4 10.4 0 0 1 12 5 c6.4 0 10 7 10 7 a17 17 0 0 1 -3.2 4"/><path d="M6.6 6.6 C3.8 8.4 2 12 2 12 s3.6 7 10 7 a9.6 9.6 0 0 0 5.4 -1.6"/><path d="M9.9 9.9 a3 3 0 0 0 4.2 4.2"/>'
    : '<path d="M2 12 s3.6 -7 10 -7 s10 7 10 7 s-3.6 7 -10 7 s-10 -7 -10 -7z"/><circle cx="12" cy="12" r="3"/>';
  const eyeBtn = document.getElementById('eyeBtn'); if(eyeBtn) eyeBtn.setAttribute('aria-label', hide ? 'Show balances' : 'Hide balances');

  renderActions();
  renderBillReminders();

  /* accounts */
  const list = document.getElementById('accountsList');
  list.innerHTML = state.accounts.map(a => {
    let sub = `${a.type} ${a.mask}`, right = '', meter = '';
    if(a.kind === 'credit'){
      const owed = Math.max(0, -a.balance);
      const util = a.limit ? Math.min(100, owed / a.limit * 100) : 0;
      sub = `Due ${a.due} · ${a.mask}`;
      right = `<b>${hide ? hiddenAmt() : fmtMoney(owed)}</b><span>${util.toFixed(0)}% of limit</span>`;
      meter = `<div class="meter" aria-hidden="true"><i style="width:${util.toFixed(1)}%"></i></div>`;
    } else if(a.goal){
      const pct = Math.min(100, a.balance / a.goal * 100);
      sub = `Goal · ${Math.round(pct)}% of ${fmtMoney(a.goal).replace('.00','')}`;
      right = `<b>${hide ? hiddenAmt() : fmtMoney(a.balance)}</b>`;
      meter = `<div class="meter goal" aria-hidden="true"><i style="width:${pct.toFixed(1)}%"></i></div>`;
    } else {
      if(a.apy) sub = `${a.apy.toFixed(2)}% APY · ${a.mask}`;
      right = `<b>${hide ? hiddenAmt() : fmtMoney(a.balance)}</b><span>Available</span>`;
    }
    return `
      <button class="acct-row" data-id="${a.id}" aria-label="${escapeHtml(displayName(a))}">
        ${acctIcon(a)}
        <div class="acct-meta"><b>${escapeHtml(displayName(a))}</b><span>${escapeHtml(sub)}</span></div>
        <div class="acct-bal">${right}${meter}</div>
      </button>`;
  }).join('');
  list.querySelectorAll('.acct-row').forEach(el => el.addEventListener('click', ()=> openAccount(el.dataset.id)));
  const cc = state.accounts.find(a => a.kind === 'credit');
  const net = total + (cc ? cc.balance : 0);
  document.getElementById('netRow').innerHTML = `<span>Net of card balance</span><b>${hide ? hiddenAmt() : fmtMoney(net)}</b>`;

  renderSpending();
  renderCreditScoreCard();

  /* recent activity */
  const recent = allTx().slice(0, 5);
  document.getElementById('recentTx').innerHTML = recent.map(t => txRowHTML(t, t.acct, { showAcct:true })).join('');
  document.querySelectorAll('#recentTx .tx').forEach(el => el.addEventListener('click', ()=> openTxDetail(el.dataset.acct, el.dataset.tx)));

  /* shortcuts */
  const schedCount = (state.scheduledTransfers||[]).length + (state.payees||[]).filter(p=>p.autopay).length;
  const subsTotal = computeSubscriptions().total;
  const row = (onclick, icon, title, sub) => `<div class="li" onclick="${onclick}"><span class="li-icon">${svgIcon(icon)}</span><div class="li-meta"><b>${title}</b><span>${sub}</span></div><span class="li-trail">›</span></div>`;
  document.getElementById('quickLinks').innerHTML =
    row("go('scheduled');renderScheduled()", '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3 V7 M8 3 V7 M3 10 H21"/>', 'Scheduled &amp; recurring', `${schedCount} on autopilot`) +
    row("go('subs');renderSubs()", '<path d="M20 11 a8 8 0 1 0 -2.3 5.7"/><path d="M20 4 V11 H13"/>', 'Subscriptions &amp; bills', `$${fmt(subsTotal)}/month in recurring charges`) +
    row("activeId = activeId || 'a1'; renderStatements(); go('statements')", '<path d="M6 3 H15 L19 7 V21 H6 Z"/><path d="M9 12 H16 M9 16 H16"/>', 'Statements &amp; tax documents', `${MONTH_LONG[(TODAY.getMonth() + 11) % 12]} statement ready`) +
    row('openLinkedAccounts()', '<path d="M10 13 a5 5 0 0 0 7.5 .5 l3 -3 a5 5 0 0 0 -7 -7 l-1.7 1.7"/><path d="M14 11 a5 5 0 0 0 -7.5 -.5 l-3 3 a5 5 0 0 0 7 7 l1.7 -1.7"/>', 'Linked accounts', `${state.linkedAccounts.length} external accounts`);
}

function renderSpending(){
  const panel = document.getElementById('spendPanel'); if(!panel) return;
  const end = +addDays(TODAY, 1);
  const cur = spendingBetween(+addDays(TODAY, -29), end);
  const prev = spendingBetween(+addDays(TODAY, -59), +addDays(TODAY, -29));
  const diff = prev.total ? (cur.total - prev.total) / prev.total * 100 : 0;
  const cats = Object.entries(cur.by).sort((a, b) => b[1] - a[1]);
  const top = cats.slice(0, 5);
  const otherAmt = cats.slice(5).reduce((s, [, v]) => s + v, 0);
  if(otherAmt > 0) top.push(['Other', otherAmt]);
  const hide = state.hideBalances;
  panel.innerHTML = `
    <div style="cursor:pointer" onclick="openSheet('insights')" role="button" tabindex="0" aria-label="Spending details">
      <div class="panel-head">
        <div><h3>Spending</h3><div class="sub">Last 30 days</div></div>
        ${prev.total ? `<span class="pill ${diff <= 0 ? 'good' : 'bad'}">${diff <= 0 ? '▼' : '▲'} ${Math.abs(diff).toFixed(0)}% vs prior 30d</span>` : ''}
      </div>
      <div class="spend-top"><div class="spend-amt">${hide ? '$' + hiddenAmt() : moneyHTML(cur.total)}</div></div>
      <div class="cat-bar" aria-hidden="true">${top.map(([c, v]) => `<i style="flex:${v.toFixed(2)};background:${catOf(c).color}"></i>`).join('')}</div>
      <div class="cat-legend">${top.slice(0, 4).map(([c, v]) => `<div><i style="background:${catOf(c).color}"></i><span>${escapeHtml(c)}</span><b>${hide ? '••' : '$' + Math.round(v).toLocaleString('en-US')}</b></div>`).join('')}</div>
      <div class="panel-head" style="padding-top:12px;border-top:1px solid var(--line-2)"><div class="sub">Everyday spending · last 7 days</div></div>
      <div class="bars-week" id="weekBars" style="border-top:0"></div>
    </div>`;
  renderWeekBars();
}

const actions = [
  { key:'zelle',    label:'Send',     icon:'<path d="M21 3 L10 14"/><path d="M21 3 L14.5 21 L10 14 L3 9.5 Z"/>' },
  { key:'transfer', label:'Transfer', icon:'<path d="M5 8 H19 L15.5 4.5"/><path d="M19 16 H5 L8.5 19.5"/>' },
  { key:'pay',      label:'Pay bills',icon:'<path d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z"/><path d="M9.5 9.5 c0 -1.2 1.1 -1.8 2.5 -1.8 s2.5 .7 2.5 1.8 c0 2.6 -5 1.2 -5 3.9 c0 1.1 1.1 1.8 2.5 1.8 s2.5 -.6 2.5 -1.8 M12 6.5 V7.7 M12 15.2 V16.5"/>' },
  { key:'deposit',  label:'Deposit',  icon:'<path d="M4 8 H7 L8.5 6 H15.5 L17 8 H20 a1 1 0 0 1 1 1 V18 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V9 a1 1 0 0 1 1 -1 Z"/><circle cx="12" cy="13" r="3.2"/>' },
];
function renderActions(){
  const row = document.getElementById('actionsRow');
  row.innerHTML = actions.map(a => `
    <button class="action" data-key="${a.key}">
      <span class="ico">${svgIcon(a.icon)}</span>
      <span>${a.label}</span>
    </button>
  `).join('');
  row.querySelectorAll('.action').forEach(el => {
    el.addEventListener('click', ()=>{
      const k = el.dataset.key;
      if(k==='transfer') startTransfer('send');
      else if(k==='pay') startBillPay();
      else if(k==='deposit') startDeposit();
      else if(k==='zelle') startZelle();
    });
  });
}

/* ============================================================
   ACCOUNT DETAIL
   ============================================================ */
let activeId = null;
let activeFilter = 'All';
let TX_LIMIT = 40;
function openAccount(id){
  const a = accountById(id); if(!a) return;
  if(activeId !== id){ PREV_BAL.detail = null; }
  activeId = id; activeFilter = 'All'; TX_LIMIT = 40;
  paintDetailHeader(a);
  const cats = ['All', ...new Set((state.txByAccount[id]||[]).map(t=>effectiveCat(t)))];
  const fr = document.getElementById('filterRow');
  fr.innerHTML = cats.map(c => `<button class="chip ${c==='All'?'active':''}" data-cat="${escapeHtml(c)}" aria-pressed="${c==='All'}">${escapeHtml(c)}</button>`).join('');
  fr.querySelectorAll('.chip').forEach(c => c.addEventListener('click', ()=>{
    activeFilter = c.dataset.cat; TX_LIMIT = 40;
    fr.querySelectorAll('.chip').forEach(x=>{ x.classList.toggle('active', x===c); x.setAttribute('aria-pressed', x===c); });
    renderTransactions(id);
  }));
  renderGoalSlot(id);
  renderCcPaySlot(id);
  renderRoundUpRow();
  showSkelTx();
  go('detail');
  setTimeout(()=> renderTransactions(id), 280);
}
/* repaint header numbers without resetting filters (after money moves) */
function openAccountRefresh(){
  const a = accountById(activeId); if(!a) return;
  paintDetailHeader(a);
  renderTransactions(activeId);
}
function paintDetailHeader(a){
  const hero = document.getElementById('detailHero');
  hero.dataset.kind = a.kind === 'credit' ? 'credit' : a.goal ? 'goal' : a.kind;
  document.getElementById('detailTitle').textContent = displayName(a);
  document.getElementById('detailSub').textContent = `${a.type} ${a.mask}`;
  document.getElementById('detailLbl').textContent = a.kind === 'credit' ? 'Current balance' : 'Available balance';
  animateDetailBalance(a);
  const hide = state.hideBalances;
  const m = v => hide ? hiddenAmt() : fmtMoney(v);
  const txs = (state.txByAccount[a.id] || []).filter(t => !isHidden(t));
  const pendingOut = -txs.filter(t => t.status === 'Pending' && t.amt < 0).reduce((s, t) => s + t.amt, 0);
  const since = +addDays(TODAY, -29);
  const moneyIn = txs.filter(t => t.ts >= since && t.amt > 0).reduce((s, t) => s + t.amt, 0);
  let stats;
  if(a.kind === 'credit'){
    stats = [['Available credit', m(a.limit + a.balance)], ['Statement balance', m(a.statementBalance || 0)], ['Payment due', `${a.due}`]];
  } else if(a.goal){
    const pct = Math.min(100, Math.round(a.balance / a.goal * 100));
    stats = [['Goal', m(a.goal)], ['Progress', pct + '%'], ['Target', (a.goalBy || '').replace(/, \d{4}$/, '') || '—']];
  } else if(a.kind === 'savings'){
    const lastInt = txs.find(t => t.method === 'Interest');
    stats = [['APY', (a.apy || 0).toFixed(2) + '%'], ['Last interest', lastInt ? m(lastInt.amt) : '—'], ['In · 30 days', m(moneyIn)]];
  } else {
    stats = [['Present balance', m(a.balance + pendingOut)], ['Pending', pendingOut ? '−' + m(pendingOut).replace('-', '') : m(0)], ['In · 30 days', m(moneyIn)]];
  }
  document.getElementById('detailStats').innerHTML = stats.map(([l, v]) => `<div class="hero-stat"><span>${l}</span><b>${v}</b></div>`).join('');
  const series = balanceSeries([a], 30).map(v => a.kind === 'credit' ? -v : v);
  document.getElementById('detailChart').innerHTML = hide ? '' : sparkSVG(series, 340, 70, 'dc');
  const qa = (fn, icon, label) => `<div class="qa" role="button" tabindex="0" onclick="${fn}">${svgIcon(icon)}<span>${label}</span></div>`;
  const I = {
    transfer:'<path d="M5 8 H19 L15.5 4.5"/><path d="M19 16 H5 L8.5 19.5"/>',
    send:'<path d="M21 3 L10 14"/><path d="M21 3 L14.5 21 L10 14 L3 9.5 Z"/>',
    stmt:'<path d="M6 3 H15 L19 7 V21 H6 Z"/><path d="M9 12 H16 M9 16 H16"/>',
    info:'<circle cx="12" cy="12" r="9"/><path d="M12 11 V16 M12 8 h.01"/>',
    pay:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10 H21.5"/>',
    plus:'<circle cx="12" cy="12" r="9"/><path d="M12 8 V16 M8 12 H16"/>',
    card:'<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10 H21.5 M6 15 H10"/>',
  };
  let acts;
  if(a.kind === 'credit') acts = [qa('startCcPay()', I.pay, 'Pay card'), qa("setTab('cards')", I.card, 'Card controls'), qa("renderStatements();go('statements')", I.stmt, 'Statements'), qa(`openAcctDetailsSecure('${a.id}')`, I.info, 'Details')];
  else if(a.goal) acts = [qa(`contributeGoal('${a.id}')`, I.plus, 'Add money'), qa("startTransfer('send')", I.transfer, 'Transfer'), qa("renderStatements();go('statements')", I.stmt, 'Statements'), qa(`openAcctDetailsSecure('${a.id}')`, I.info, 'Details')];
  else if(a.kind === 'savings') acts = [qa("startTransfer('send')", I.transfer, 'Transfer'), qa("startTransfer('request')", I.plus, 'Add money'), qa("renderStatements();go('statements')", I.stmt, 'Statements'), qa(`openAcctDetailsSecure('${a.id}')`, I.info, 'Details')];
  else acts = [qa("startTransfer('send')", I.transfer, 'Transfer'), qa('startZelle()', I.send, 'Zelle®'), qa("renderStatements();go('statements')", I.stmt, 'Statements'), qa(`openAcctDetailsSecure('${a.id}')`, I.info, 'Details')];
  document.getElementById('detailActions').innerHTML = acts.join('');
}
function renderCcPaySlot(id){
  const slot = document.getElementById('ccPaySlot');
  if(!slot) return;
  const a = accountById(id);
  if(!a || a.kind !== 'credit'){ slot.innerHTML = ''; return; }
  const days = daysUntil(a.due);
  const cls = days <= 2 ? 'urgent' : '';
  slot.innerHTML = `
    <div class="bill-reminders standalone">
      <div class="bill-banner ${cls}" onclick="startCcPay()">
        <div class="bb-logo" style="background:#181321">${escapeHtml(a.name.charAt(0))}</div>
        <div class="bb-meta">
          <b>Make a payment</b>
          <span>Statement balance $${fmt(a.statementBalance || Math.abs(a.balance))} · due ${escapeHtml(a.due)} (${days<=0?'today':days+' days'})</span>
        </div>
        <span class="pill brand">Pay</span>
      </div>
    </div>
  `;
}

function txRowHTML(t, acctId, opts = {}){
  const ov = state.txOverrides[t.id] || {};
  const isPend = t.status === 'Pending';
  const a = opts.showAcct ? accountById(acctId) : null;
  const sub = opts.showAcct ? `${relDay(t.ts || Date.now())} · ${a ? displayName(a) : ''}` : (isPend ? 'Pending · ' + t.sub : t.sub);
  const amtCls = t.amt >= 0 ? 'pos' : isPend ? 'pend' : 'neg';
  const bal = opts.balances && opts.balances[t.id];
  const owed = accountById(acctId)?.kind === 'credit';
  const balLine = (typeof bal === 'number' && !isPend && !state.hideBalances) ? `<span class="tx-bal">${fmtMoney(owed ? -bal : bal)}</span>` : '';
  const row = `
        <div class="tx" data-tx="${t.id}" data-acct="${acctId}" role="button" tabindex="0" aria-label="${escapeHtml(t.name)}, ${fmtSigned(t.amt)}${isPend ? ', pending' : ''}">
          ${txAvatar(t)}
          <div class="tx-meta">
            <div class="tx-name">${escapeHtml(ov.note ? t.name : t.name)}</div>
            <div class="tx-sub">${escapeHtml(sub)}</div>
          </div>
          <div>
            <div class="tx-amt ${amtCls}">${fmtSigned(t.amt)}</div>
            ${balLine}
          </div>
        </div>`;
  if(!opts.swipe) return row;
  const hideLbl = ov.hidden ? 'Restore' : 'Hide';
  return `
      <div class="tx-wrap">
        <div class="tx-actions-rev">
          <button class="btn-rev cat" onclick="event.stopPropagation();recategorizeTx('${acctId}','${t.id}');openSheetRaw();collapseTx()" aria-label="Categorize">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6 H21 M6 12 H18 M9 18 H15"/></svg>
            Category
          </button>
          <button class="btn-rev split" onclick="event.stopPropagation();splitTx('${acctId}','${t.id}');openSheetRaw();collapseTx()" aria-label="Split">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7 H8 L13 17 H21 M3 17 H8 L13 7 H21"/></svg>
            Split
          </button>
          <button class="btn-rev hide" onclick="event.stopPropagation();hideTx('${acctId}','${t.id}');collapseTx()" aria-label="${hideLbl}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12 s4 -8 11 -8 s11 8 11 8 s-4 8 -11 8 s-11 -8 -11 -8z"/><circle cx="12" cy="12" r="3"/><path d="M2 2 L22 22"/></svg>
            ${hideLbl}
          </button>
        </div>${row}
      </div>`;
}
function renderTransactions(id){
  const list = document.getElementById('txList');
  let txs = (state.txByAccount[id] || []).filter(t => !isHidden(t));
  if(activeFilter !== 'All') txs = txs.filter(t => effectiveCat(t) === activeFilter);
  if(!txs.length){ list.innerHTML = '<div class="empty">No transactions to show.</div>'; return; }

  const balances = computeRunningBalances(id);
  const pending = txs.filter(t => t.status === 'Pending');
  const posted  = txs.filter(t => t.status !== 'Pending');
  const shown = posted.slice(0, TX_LIMIT);
  const opts = { balances, swipe:true };

  let html = '';
  if(pending.length){
    html += `<div class="tx-section pending"><span class="dot"></span> Pending <span class="count">${pending.length} · ${fmtMoney(pending.reduce((s,t)=>s+Math.abs(t.amt),0))}</span></div>`;
    html += pending.map(t => txRowHTML(t, id, opts)).join('');
  }
  let day = '';
  shown.forEach(t => {
    const label = t.ts ? relDay(t.ts) : t.day;
    if(label !== day){ html += `<div class="tx-day"><span>${label}</span></div>`; day = label; }
    html += txRowHTML(t, id, opts);
  });
  if(posted.length > shown.length){
    html += `<button class="tx-more" onclick="TX_LIMIT += 40; renderTransactions('${id}')">Show older transactions (${posted.length - shown.length})</button>`;
  } else {
    html += `<div class="empty" style="font-size:12.5px">That’s everything from the last 120 days. Older activity is in your statements.</div>`;
  }

  list.innerHTML = html;
  list.querySelectorAll('.tx-wrap .tx').forEach(el => {
    const open = (e)=>{
      const wrap = el.closest('.tx-wrap');
      if(wrap?.classList.contains('revealed')){ wrap.classList.remove('revealed'); return; }
      if(e.target.closest('.btn-rev')) return;
      openTxDetail(el.dataset.acct, el.dataset.tx);
    };
    el.addEventListener('click', open);
    el.addEventListener('keydown', e => { if(e.key === 'Enter' || e.key === ' '){ e.preventDefault(); open(e); } });
  });
  attachTxSwipe(list);
}
function collapseTx(){
  document.querySelectorAll('.tx-wrap.revealed').forEach(w => w.classList.remove('revealed'));
}

function effectiveCat(t){
  const o = state.txOverrides[t.id];
  return (o && o.cat) || t.cat;
}
function escapeHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

/* ============================================================
   TRANSFER FLOW
   ============================================================ */
let xfer = { from:null, to:null, amount:'', memo:'' };
function startTransfer(mode){
  // default from = first checking, to = first savings
  const from = state.accounts.find(a => a.kind==='checking') || state.accounts[0];
  const to = state.accounts.find(a => a.id !== from.id) || state.accounts[1];
  xfer = { from: from.id, to: to.id, amount:'', memo:'' };
  document.getElementById('transferTitle').textContent = mode==='request' ? 'Request money' : 'Transfer money';
  renderTransferForm();
  document.getElementById('amountInput').value = '';
  document.getElementById('memoInput').value = '';
  go('transfer');
}
function renderTransferForm(){
  const from = accountById(xfer.from);
  const to = accountById(xfer.to);
  document.getElementById('fromName').textContent = from.name;
  document.getElementById('fromMask').textContent = from.mask;
  document.getElementById('fromBal').textContent = fmtMoney(from.balance) + ' available';
  document.getElementById('toName').textContent = to.name;
  document.getElementById('toMask').textContent = to.mask;
  document.getElementById('toBal').textContent = fmtMoney(to.balance) + ' available';
  // swatches
  document.querySelector('#fromPick .swatch').className = 'swatch ' + pickCls(from);
  document.querySelector('#toPick .swatch').className = 'swatch ' + pickCls(to);
  validateTransfer();
}
function swapAccts(){
  const tmp = xfer.from; xfer.from = xfer.to; xfer.to = tmp;
  renderTransferForm();
}
function pickAccount(side){
  const sheetBody = document.getElementById('sheetBody');
  document.getElementById('sheetTitle').textContent = side==='from' ? 'Transfer from' : 'Transfer to';
  const otherId = side==='from' ? xfer.to : xfer.from;
  sheetBody.innerHTML = state.accounts.filter(a => a.id !== otherId).map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" data-id="${a.id}">
      <div class="swatch"></div>
      <div class="info">
        <b>${a.name}</b>
        <span>${a.mask}</span>
        <span class="bal">${fmtMoney(a.balance)} available</span>
      </div>
    </div>
  `).join('');
  sheetBody.querySelectorAll('.acct-pick').forEach(el => el.addEventListener('click', ()=>{
    if(side==='from') xfer.from = el.dataset.id; else xfer.to = el.dataset.id;
    renderTransferForm();
    closeSheet();
  }));
  openSheetRaw();
}
function setAmt(n){ document.getElementById('amountInput').value = n.toFixed(2); xfer.amount = n.toFixed(2); validateTransfer(); }
function setAmtMax(){
  const from = accountById(xfer.from);
  const m = Math.max(0, from.balance);
  document.getElementById('amountInput').value = m.toFixed(2);
  xfer.amount = m.toFixed(2); validateTransfer();
}
document.addEventListener('input', e => {
  if(e.target.id === 'amountInput'){
    let v = e.target.value.replace(/[^0-9.]/g,'');
    const parts = v.split('.');
    if(parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    if(parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0,2);
    e.target.value = v;
    xfer.amount = v;
    validateTransfer();
  }
  if(e.target.id === 'memoInput'){ xfer.memo = e.target.value; }
});
function validateTransfer(){
  const v = parseFloat(xfer.amount);
  const from = accountById(xfer.from);
  const ok = v > 0 && v <= (from?.balance || 0) && xfer.from !== xfer.to;
  document.getElementById('reviewBtn').disabled = !ok;
}
function reviewTransfer(){
  const from = accountById(xfer.from);
  const to = accountById(xfer.to);
  const v = parseFloat(xfer.amount);
  const sheetBody = document.getElementById('sheetBody');
  document.getElementById('sheetTitle').textContent = 'Review transfer';
  sheetBody.innerHTML = `
    <div class="review-amount"><span class="cur">$</span>${fmt(v)}</div>
    <div class="review-row"><span class="lbl">From</span><span class="val">${from.name}<span class="sub">${from.mask}</span></span></div>
    <div class="review-row"><span class="lbl">To</span><span class="val">${to.name}<span class="sub">${to.mask}</span></span></div>
    <div class="review-row"><span class="lbl">When</span><span class="val">Today<span class="sub">Arrives instantly</span></span></div>
    <div class="review-row"><span class="lbl">Memo</span><span class="val">${xfer.memo || '—'}</span></div>
    <div class="review-row"><span class="lbl">Fee</span><span class="val" style="color:var(--pos)">$0.00</span></div>
    <div style="margin-top:18px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="confirmTransfer()">Confirm transfer</button>
      <button class="btn btn-ghost" onclick="closeSheet()">Edit</button>
    </div>
  `;
  openSheetRaw();
}
function confirmTransfer(){
  const v = parseFloat(xfer.amount);
  /* step-up for any transfer at or above $1,000 */
  if(v >= 1000){
    closeSheet();
    return setTimeout(()=> requireStepUp({
      reason: `Confirm transfer of $${fmt(v)} between accounts.`,
      onSuccess: doConfirmTransfer,
      onCancel: ()=> reviewTransfer()
    }), 320);
  }
  doConfirmTransfer();
}
function doConfirmTransfer(){
  const from = accountById(xfer.from);
  const to = accountById(xfer.to);
  const v = parseFloat(xfer.amount);
  // mutate balances
  from.balance = +(from.balance - v).toFixed(2);
  if(from.kind !== 'credit') from.spendable = +(from.spendable - v).toFixed(2);
  to.balance = +(to.balance + v).toFixed(2);
  if(to.kind !== 'credit') to.spendable = +(to.spendable + v).toFixed(2);
  // log transactions
  const ts = Date.now();
  state.txByAccount[from.id] = [{ id:'t-tr-'+ts+'-o', ...txStamp(), cat:'Transfer', name:`Transfer to ${to.name.split(' ')[0]}`, sub:to.mask, amt:-v, c:2, status:'Posted', loc:{city:'Internal transfer',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[from.id]||[])];
  state.txByAccount[to.id]   = [{ id:'t-tr-'+ts+'-i', ...txStamp(), cat:'Transfer', name:`Transfer from ${from.name.split(' ')[0]}`, sub:from.mask, amt:v, c:4, status:'Posted', loc:{city:'Internal transfer',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[to.id]||[])];
  // notification
  state.notifications.unshift({ id:'tx-'+Date.now(), unread:true, title:'Transfer complete', body:`${fmtMoney(v)} from ${from.name} to ${to.name}.`, ts:Date.now() });
  saveState();
  // success state
  document.getElementById('sheetTitle').textContent = 'All set';
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg>
      </div>
      <div class="success-title">Transfer sent</div>
      <div class="success-amt">${fmtMoney(v)}</div>
      <div class="success-meta">${from.name} → ${to.name}<br/>Confirmation #MRD-${Math.floor(Math.random()*900000+100000)}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeSheet(); back('transfer','home')">Done</button>
        <button class="btn btn-ghost" onclick="closeSheet(); startTransfer('send')">Make another transfer</button>
      </div>
    </div>
  `;
  openSheetRaw();
  // re-render home + detail in background
  renderHome();
  if(activeId) renderTransactions(activeId);
}

/* ============================================================
   SHEETS
   ============================================================ */
function openSheetRaw(){
  document.getElementById('scrim').classList.add('show');
  document.getElementById('sheet').classList.add('show');
}
function closeSheet(){
  document.getElementById('scrim').classList.remove('show');
  document.getElementById('sheet').classList.remove('show');
}
function openSheet(kind){
  const body = document.getElementById('sheetBody');
  const title = document.getElementById('sheetTitle');
  const li = (onclick, icon, b, span, extra='') => `<div class="li" onclick="${onclick}"${extra}><span class="li-icon">${svgIcon(icon)}</span><div class="li-meta"><b>${b}</b>${span ? `<span>${span}</span>` : ''}</div><span class="li-trail">›</span></div>`;
  if(kind === 'acctOptions'){
    title.textContent = 'Account options';
    body.innerHTML = `
      <div class="list" style="margin:0">
        ${li("closeSheet();renderStatements();go('statements')", '<path d="M6 3 H15 L19 7 V21 H6 Z"/>', 'Statements &amp; documents', 'Monthly PDFs, tax forms')}
        ${li('closeSheet();openAcctDetailsSecure(activeId)', '<circle cx="12" cy="12" r="9"/><path d="M12 11 V16 M12 8 h.01"/>', 'Account &amp; routing number', 'For direct deposit and transfers')}
        ${li('closeSheet();startWire()', '<circle cx="12" cy="12" r="9"/><path d="M3 12 H21 M12 3 a14 14 0 0 1 0 18 a14 14 0 0 1 0 -18"/>', 'Send a wire', 'Domestic or international')}
        ${li("closeSheet();toast('Direct deposit form downloaded')", '<path d="M12 4 V16 M7 11 L12 16 L17 11"/><path d="M5 20 H19"/>', 'Set up direct deposit', 'Get a pre-filled form for your employer')}
        ${li('closeSheet();setTimeout(()=>openRenameAccount(activeId),320)', '<path d="M11 4 H4 V20 H20 V13"/><path d="M18.5 2.5 a2.12 2.12 0 0 1 3 3 L12 15 L8 16 L9 12 z"/>', 'Rename account', 'Add an emoji or change the name')}
      </div>
      <div class="list" style="margin:12px 0 0">
        <div class="li" onclick="closeSheet();toast('A banker will call you to close this account')"><span class="li-icon" style="color:var(--red);background:rgba(229,72,77,.1)">${svgIcon('<path d="M3 6 H21 M19 6 V20 a2 2 0 0 1 -2 2 H7 a2 2 0 0 1 -2 -2 V6 M8 6 V4 a2 2 0 0 1 2 -2 h4 a2 2 0 0 1 2 2 v2"/>')}</span><div class="li-meta"><b style="color:var(--red)">Close account</b></div></div>
      </div>
    `;
    openSheetRaw();
  }
  if(kind === 'move'){
    title.textContent = 'Move money';
    body.innerHTML = `
      <div class="list" style="margin:0">
        ${li("closeSheet();startTransfer('send')", '<path d="M5 8 H19 L15.5 4.5"/><path d="M19 16 H5 L8.5 19.5"/>', 'Transfer between accounts', 'Instant between your Meridian accounts')}
        ${li('closeSheet();startZelle()', '<path d="M21 3 L10 14"/><path d="M21 3 L14.5 21 L10 14 L3 9.5 Z"/>', 'Send with Zelle®', 'To people you know and trust')}
        ${li('closeSheet();startBillPay()', '<path d="M6 3 H18 V21 L15 19 L12 21 L9 19 L6 21 Z"/><path d="M9 8 H15 M9 12 H15"/>', 'Pay bills', `${state.payees.length} payees · ${state.payees.filter(p=>p.autopay).length} on autopay`)}
        ${li('closeSheet();startCcPay()', '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10 H21.5"/>', 'Pay credit card', `Statement balance ${fmtMoney((state.accounts.find(a=>a.kind==='credit')||{}).statementBalance||0)}`)}
        ${li('closeSheet();startDeposit()', '<path d="M4 8 H7 L8.5 6 H15.5 L17 8 H20 a1 1 0 0 1 1 1 V18 a1 1 0 0 1 -1 1 H4 a1 1 0 0 1 -1 -1 V9 a1 1 0 0 1 1 -1 Z"/><circle cx="12" cy="13" r="3.2"/>', 'Deposit a check', 'Snap the front and back')}
        ${li('closeSheet();startWire()', '<circle cx="12" cy="12" r="9"/><path d="M3 12 H21 M12 3 a14 14 0 0 1 0 18 a14 14 0 0 1 0 -18"/>', 'Wire transfer', `Same-day if sent before ${state.wireFees.cutoff}`)}
      </div>
      <div class="list" style="margin:12px 0 0">
        ${li("closeSheet();go('scheduled');renderScheduled()", '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M16 3 V7 M8 3 V7 M3 10 H21"/>', 'Scheduled &amp; recurring', `${state.scheduledTransfers.length} transfers scheduled`)}
      </div>`;
    openSheetRaw();
  }
  if(kind === 'openAccount'){
    title.textContent = 'Open an account';
    const p = (name, rate, sub) => `<div class="li" onclick="closeSheet();toast('Application started — takes about 5 minutes')"><span class="li-icon">${svgIcon('<circle cx="12" cy="12" r="9"/><path d="M12 8 V16 M8 12 H16"/>')}</span><div class="li-meta"><b>${name}</b><span>${sub}</span></div><span class="pill good">${rate}</span></div>`;
    body.innerHTML = `
      <p style="margin:0 0 14px;font-size:14px;color:var(--muted);line-height:1.5">Apply in minutes. Opening an account won’t affect your credit score.</p>
      <div class="list" style="margin:0">
        ${p('12-month CD', '4.05% APY', '$500 minimum · rate locked for 12 months')}
        ${p('Another savings goal', '3.80% APY', 'Separate pocket with its own target')}
        ${p('Joint checking', '$0 fees', 'Share an account with a partner')}
        ${p('Meridian Rewards Visa', '2% back', 'Pre-qualify with no hard inquiry')}
      </div>
      <p style="margin:14px 0 0;font-size:11.5px;color:var(--muted);line-height:1.55">APY = Annual Percentage Yield, accurate as of ${fmtMDY(TODAY)}. Rates may change. Penalty may be imposed for early CD withdrawal.</p>`;
    openSheetRaw();
  }
  if(kind === 'insights'){
    const end = +addDays(TODAY, 1);
    const cur = spendingBetween(+addDays(TODAY, -29), end);
    const prev = spendingBetween(+addDays(TODAY, -59), +addDays(TODAY, -29));
    const diff = cur.total - prev.total;
    const cats = Object.entries(cur.by).sort((a, b) => b[1] - a[1]);
    const merchants = {};
    for(const t of allTx()){
      if(!t.ts || t.ts < +addDays(TODAY, -29) || t.amt >= 0) continue;
      const c = effectiveCat(t); if(c === 'Transfer' || c === 'Income') continue;
      merchants[t.name] = merchants[t.name] || { total:0, n:0, t };
      merchants[t.name].total -= t.amt; merchants[t.name].n++;
    }
    const topM = Object.entries(merchants).sort((a, b) => b[1].total - a[1].total).slice(0, 5);
    title.textContent = 'Spending · last 30 days';
    body.innerHTML = `
      <p style="margin:0 0 14px;font-size:14px;color:var(--muted);font-weight:500;line-height:1.55">You spent <b style="color:var(--ink)">${fmtMoney(cur.total)}</b> across ${cats.length} categories — <b style="color:${diff <= 0 ? 'var(--pos)' : 'var(--red-2)'}">${fmtMoney(Math.abs(diff))} ${diff <= 0 ? 'less' : 'more'}</b> than the 30 days before. Rent, bills and card spending are included; transfers between your accounts aren’t.</p>
      <div class="list" style="margin:0">
        ${cats.map(([c, v]) => { const k = catOf(c); return `<div class="li" style="cursor:default"><span class="li-icon" style="background:color-mix(in srgb, ${k.color} 14%, transparent);color:${k.color}">${svgIcon(k.icon)}</span><div class="li-meta"><b>${escapeHtml(c)}</b><span>${(v / cur.total * 100).toFixed(0)}% of spending</span></div><span style="font-weight:650">${fmtMoney(v)}</span></div>`; }).join('')}
      </div>
      <div class="section-h" style="padding-left:2px">Top merchants</div>
      <div class="list" style="margin:0">
        ${topM.map(([name, m]) => `<div class="li" style="cursor:default">${txAvatar(m.t)}<div class="li-meta"><b>${escapeHtml(name)}</b><span>${m.n} transaction${m.n === 1 ? '' : 's'}</span></div><span style="font-weight:650">${fmtMoney(m.total)}</span></div>`).join('')}
      </div>`;
    openSheetRaw();
  }
}

/* ============================================================
   CARDS / FREEZE
   ============================================================ */
function toggleFreeze(){
  state.freezeOn = !state.freezeOn; saveState();
  syncFreezeUI();
  toast(state.freezeOn ? 'Card locked — new purchases will be declined' : 'Card unlocked');
}
function syncFreezeUI(){
  const on = !!state.freezeOn;
  const sw = document.getElementById('freezeSwitch');
  if(sw){ sw.classList.toggle('on', on); sw.setAttribute('aria-checked', on); }
  const st = document.getElementById('freezeStatus'); if(st) st.textContent = on ? 'Locked — purchases and ATM declined' : 'Card is active';
  const card = document.getElementById('creditCard'); if(card) card.classList.toggle('frozen', on);
  const btn = document.getElementById('freezeBtn'); if(btn) btn.classList.toggle('on', on);
  const lbl = document.getElementById('freezeBtnLbl'); if(lbl) lbl.textContent = on ? 'Unlock' : 'Lock';
}
let cardRevealTimer = null;
function revealCardDetails(){
  requireStepUp({
    reason: 'Verify it’s you to view your full card number and CVV.',
    onSuccess: () => {
      document.getElementById('ccNum').textContent = '4147 2026 5518 4827';
      document.getElementById('ccCvv').textContent = 'CVV 382';
      toast('Card details visible for 30 seconds');
      clearTimeout(cardRevealTimer);
      cardRevealTimer = setTimeout(hideCardDetails, 30000);
    }
  });
}
function hideCardDetails(){
  const n = document.getElementById('ccNum'); if(n) n.textContent = '•••• •••• •••• 4827';
  const c = document.getElementById('ccCvv'); if(c) c.textContent = 'CVV •••';
}
function renderCardsScreen(){
  const start = +addDays(TODAY, -29);
  const spent = -(state.txByAccount.a1 || []).filter(t => t.method === 'Card' && t.amt < 0 && t.ts >= start && !isHidden(t)).reduce((s, t) => s + t.amt, 0);
  const el = document.getElementById('cardMonthSpend'); if(el) el.textContent = state.hideBalances ? '••••' : fmtMoney(spent);
  const nm = document.getElementById('ccName'); if(nm) nm.textContent = state.profile.legalName;
  const cc = state.accounts.find(a => a.kind === 'credit');
  const sum = document.getElementById('ccCardSummary');
  if(sum && cc) sum.textContent = `Balance ${fmtMoney(-cc.balance)} · payment due ${cc.due}`;
  syncFreezeUI();
}

/* ============================================================
   STATEMENTS
   ============================================================ */
function renderStatements(){
  const list = document.getElementById('stmtList'); if(!list) return;
  const a = accountById(activeId) || state.accounts[0];
  const rows = [];
  for(let i = 1; i <= 12; i++){
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    rows.push(`
      <div class="stmt-row" role="button" tabindex="0" onclick="openStatement(${d.getFullYear()}, ${d.getMonth()})">
        <div class="stmt-icon">PDF</div>
        <div class="stmt-meta">
          <b>${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}</b>
          <span>${MON[d.getMonth()]} 1 – ${MON[d.getMonth()]} ${last} · ${escapeHtml(displayName(a))}</span>
        </div>
        <span class="li-trail">›</span>
      </div>`);
  }
  list.innerHTML = rows.join('');
}

/* ============================================================
   NOTIFICATIONS
   ============================================================ */
function readNotif(id){
  const n = state.notifications.find(x=>x.id===id); if(n){ n.unread = false; saveState(); renderNotifications(); renderHome(); }
}
function markAllRead(){ state.notifications.forEach(n => n.unread = false); saveState(); renderNotifications(); renderHome(); }

/* ============================================================
   PROFILE / SIGN OUT (signOut() defined alongside lock logic)
   ============================================================ */

/* ============================================================
   LOCK SCREEN / PIN
   ============================================================ */
const LOCK = {
  mode: 'verify',     /* 'verify' | 'setup' | 'confirm' */
  buffer: '',
  firstPin: '',
  attempts: 0,
  onSuccess: null,    /* callback after verify */
};

function lockClock(){
  const t = new Date();
  const hh = t.getHours();
  const h12 = ((hh + 11) % 12) + 1;
  const mm = String(t.getMinutes()).padStart(2,'0');
  const el = document.getElementById('lockTime');
  if(el) el.textContent = `${h12}:${mm}`;
}
setInterval(lockClock, 30000);

function lockShowDots(){
  const dots = document.querySelectorAll('#pinDots i');
  dots.forEach((d,i) => d.classList.toggle('filled', i < LOCK.buffer.length));
}
function lockShake(msg){
  const dots = document.getElementById('pinDots');
  const err = document.getElementById('pinError');
  dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
  if(msg){ err.textContent = msg; err.classList.add('show'); }
  setTimeout(()=> err.classList.remove('show'), 1800);
  if(navigator.vibrate) navigator.vibrate([30, 60, 30]);
}
function lockReset(){ LOCK.buffer = ''; lockShowDots(); }

function lockSetMode(mode, opts){
  opts = opts || {};
  LOCK.mode = mode; LOCK.buffer = ''; LOCK.firstPin = '';
  const name  = document.getElementById('lockName');
  const greet = document.getElementById('lockGreet');
  const step  = document.getElementById('lockStep');
  const bio   = document.getElementById('pinBio');
  const notYou= document.getElementById('lockNotYou');
  const forgot= document.getElementById('lockForgot');
  const lockEl= document.getElementById('lock');
  lockEl.classList.toggle('setup', mode !== 'verify');
  step.style.display = mode === 'verify' ? 'none' : 'block';
  if(mode === 'verify'){
    const bioReady = state.bioEnabled && webAuthnAvailable() && !!state.bioCredentialId;
    name.textContent  = `Welcome back, ${state.user.name}`;
    greet.textContent = bioReady ? 'Use Face ID or enter passcode' : 'Enter your 6-digit passcode';
    bio.style.visibility = bioReady ? 'visible' : 'hidden';
    notYou.style.display = 'block';
    forgot.style.display = '';
  } else if(mode === 'setup'){
    step.textContent = 'Step 1 of 2';
    name.textContent  = 'Set a passcode';
    greet.textContent = 'You’ll use this 6-digit passcode to sign in';
    bio.style.visibility = 'hidden';
    notYou.style.display = 'none';
    forgot.style.display = 'none';
  } else if(mode === 'confirm'){
    step.textContent = 'Step 2 of 2';
    name.textContent  = 'Confirm passcode';
    greet.textContent = 'Re-enter the same 6 digits';
    bio.style.visibility = 'hidden';
    notYou.style.display = 'none';
    forgot.style.display = 'none';
  }
  lockShowDots();
}

function pinPress(k){
  const err = document.getElementById('pinError');
  err.classList.remove('show');
  if(k === 'bio'){
    if(LOCK.mode !== 'verify' || !state.bioEnabled) return;
    return faceIdMock();
  }
  if(k === 'del'){
    LOCK.buffer = LOCK.buffer.slice(0,-1);
    lockShowDots();
    return;
  }
  if(LOCK.buffer.length >= 6) return;
  LOCK.buffer += k;
  lockShowDots();
  if(navigator.vibrate) navigator.vibrate(8);
  if(LOCK.buffer.length === 6) setTimeout(pinSubmit, 140);
}

function pinSubmit(){
  if(LOCK.mode === 'verify'){
    if(LOCK.buffer === state.pin){
      LOCK.attempts = 0;
      pinUnlocked();
    } else {
      LOCK.attempts++;
      const left = Math.max(0, 5 - LOCK.attempts);
      lockShake(left > 0 ? `Incorrect passcode. ${left} attempt${left===1?'':'s'} remaining.` : 'Account locked. Contact support.');
      LOCK.buffer = ''; lockShowDots();
    }
  } else if(LOCK.mode === 'setup'){
    const first = LOCK.buffer;
    lockSetMode('confirm');
    LOCK.firstPin = first;
  } else if(LOCK.mode === 'confirm'){
    if(LOCK.buffer === LOCK.firstPin){
      state.pin = LOCK.buffer;
      state.signedIn = true;
      saveState();
      pinUnlocked();
    } else {
      lockShake('Passcodes don’t match. Start over.');
      lockSetMode('setup');
    }
  }
}

/* Deep links (manifest shortcuts) open through their normal entry points. */
const DEEP_LINKS = {
  transfer: () => startTransfer('send'),
  zelle: () => startZelle(),
  payBill: () => startBillPay(),
  deposit: () => startDeposit(),
  cards: () => setTab('cards'),
  notifications: () => go('notifications'),
};
let PENDING_LINK = null;
function pinUnlocked(){
  state.signedIn = true; state.lastSignIn = Date.now(); saveState();
  // small success cue
  const dots = document.querySelectorAll('#pinDots i');
  dots.forEach((d,i) => setTimeout(()=> d.style.background = '#5cd99a', i*40));
  setTimeout(()=>{
    dots.forEach(d => d.style.background = '');
    LOCK.buffer = ''; lockShowDots();
    const cb = LOCK.onSuccess; LOCK.onSuccess = null;
    if(cb) cb();
    else {
      go('home');
      const link = PENDING_LINK && DEEP_LINKS[PENDING_LINK];
      PENDING_LINK = null;
      if(link) setTimeout(link, 450);
    }
  }, 280);
}

/* ---------- WebAuthn (real Face ID / Touch ID / Windows Hello) ---------- */
function webAuthnAvailable(){
  return !!(window.PublicKeyCredential && navigator.credentials && navigator.credentials.create);
}
async function platformAuthenticatorAvailable(){
  if(!webAuthnAvailable()) return false;
  try {
    if(typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !== 'function') return false;
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch { return false; }
}
function _b64uToBuf(s){
  s = String(s).replace(/-/g,'+').replace(/_/g,'/');
  const pad = s.length % 4; if(pad) s += '='.repeat(4 - pad);
  const bin = atob(s); const buf = new Uint8Array(bin.length);
  for(let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
function _bufToB64u(buf){
  const bytes = new Uint8Array(buf);
  let s = ''; for(let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
}
async function registerBiometric(){
  if(!webAuthnAvailable()) throw new Error('not-supported');
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Meridian' },
      user: {
        id: userId,
        name: (state.user && state.user.name) || 'meridian-user',
        displayName: (state.user && state.user.name) || 'Meridian user',
      },
      pubKeyCredParams: [
        { type: 'public-key', alg: -7   }, // ES256
        { type: 'public-key', alg: -257 }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    }
  });
  if(!cred) throw new Error('no-credential');
  state.bioCredentialId = _bufToB64u(cred.rawId);
  saveState();
  return true;
}
async function authenticateBiometric(){
  if(!webAuthnAvailable()) throw new Error('not-supported');
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const opts = {
    publicKey: {
      challenge,
      timeout: 60000,
      userVerification: 'required',
    }
  };
  if(state.bioCredentialId){
    opts.publicKey.allowCredentials = [{
      id: _b64uToBuf(state.bioCredentialId),
      type: 'public-key',
      transports: ['internal'],
    }];
  }
  const assertion = await navigator.credentials.get(opts);
  if(!assertion) throw new Error('no-assertion');
  return true;
}

async function faceIdMock(){
  if(!webAuthnAvailable()){
    toast('Face ID isn’t supported on this device');
    return;
  }
  if(!state.bioCredentialId){
    // Not yet enrolled on this device — fall back to passcode and offer to enroll afterward.
    toast('Face ID not set up yet — use your passcode');
    return;
  }
  const greet = document.getElementById('lockGreet');
  const prev = greet ? greet.textContent : '';
  if(greet) greet.textContent = 'Looking for your face…';
  try {
    await authenticateBiometric();
    LOCK.buffer = state.pin || '';
    lockShowDots();
    setTimeout(pinUnlocked, 200);
  } catch (err){
    if(greet) greet.textContent = prev;
    const name = err && err.name;
    if(name === 'NotAllowedError' || name === 'AbortError'){
      lockShake('Face ID canceled. Try again or use passcode.');
    } else if(name === 'InvalidStateError'){
      lockShake('Face ID not enrolled on this device. Use passcode.');
    } else if(err && err.message === 'not-supported'){
      lockShake('Face ID isn’t supported here. Use passcode.');
    } else {
      lockShake('Face not recognized. Try again or use passcode.');
    }
  }
}

function lockShow(opts){
  opts = opts || {};
  LOCK.onSuccess = opts.onSuccess || null;
  if(!state.pin){
    lockSetMode('setup');
  } else {
    lockSetMode('verify');
  }
  lockClock();
  go('lock');
}

function signOut(){
  if(!confirm('Sign out of Meridian?')) return;
  state.signedIn = false; saveState();
  toast('Signed out');
  closeSheet();
  lockShow();
}

function signOutHard(){
  if(!confirm('Forget this device? You’ll need to sign in again with your full credentials.')) return;
  state.pin = null; state.signedIn = false; state.bioEnabled = false; state.bioCredentialId = null; saveState();
  toast('Device signed out');
  closeSheet();
  lockShow();
}

function forgotPin(){
  if(!confirm('Reset your passcode? For this demo, we’ll let you choose a new one.')) return;
  state.pin = null; saveState();
  lockSetMode('setup');
}

/* keyboard support on lock screen */
document.addEventListener('keydown', e => {
  if(current !== 'lock') return;
  if(/^[0-9]$/.test(e.key)) pinPress(e.key);
  else if(e.key === 'Backspace') pinPress('del');
  else if(e.key === 'Enter' && LOCK.buffer.length === 6) pinSubmit();
});

/* delegated taps */
document.addEventListener('click', e => {
  const k = e.target.closest('.pin-key'); if(!k) return;
  pinPress(k.dataset.k);
});

/* forgot link */
document.addEventListener('click', e => {
  if(e.target.id === 'lockForgot') forgotPin();
});

/* ============================================================
   TOAST
   ============================================================ */
let toastTimer=null;
function toast(msg){
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer = setTimeout(()=> el.classList.remove('show'), 1500);
}

/* ============================================================
   COPY HELPER
   ============================================================ */
async function copyText(s){
  try{
    if(navigator.clipboard?.writeText){ await navigator.clipboard.writeText(s); }
    else{
      const ta = document.createElement('textarea'); ta.value = s;
      ta.style.position='fixed'; ta.style.opacity='0';
      document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
    }
    toast('Copied to clipboard');
  }catch(e){ toast('Copy failed') }
}
const COPY_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15 H4 a2 2 0 0 1 -2 -2 V4 a2 2 0 0 1 2 -2 h9 a2 2 0 0 1 2 2 v1"/></svg>';

/* ============================================================
   TRANSACTION DETAIL SHEET
   ============================================================ */
function findTx(acctId, txId){
  return (state.txByAccount[acctId]||[]).find(t => t.id === txId);
}
function openTxDetail(acctId, txId){
  const t = findTx(acctId, txId); if(!t) return;
  const acct = accountById(acctId);
  const ov = state.txOverrides[t.id] || {};
  const cat = ov.cat || t.cat;
  const note = ov.note || '';
  const isPos = t.amt >= 0;
  const isPending = t.status === 'Pending';
  const hasMap = t.loc && t.loc.lat && t.loc.lng;
  const ref = 'MRD' + String(Math.abs([...t.id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7))).padStart(10, '0').slice(0, 10);
  document.getElementById('sheetTitle').textContent = isPending ? 'Pending transaction' : 'Transaction';
  document.getElementById('sheetBody').innerHTML = `
    <div style="display:flex;justify-content:center;margin-top:6px">${txAvatar(t, 60)}</div>
    <div class="tx-detail-amt ${isPos?'pos':''}">${fmtSigned(t.amt)}</div>
    <div class="tx-detail-merchant">${escapeHtml(t.name)}</div>
    <div class="tx-detail-meta">${escapeHtml(t.date || t.day)} · ${escapeHtml(t.time || '')} · ${escapeHtml(t.method || 'Card')}</div>
    <div style="text-align:center"><span class="tx-status-pill ${isPending?'pending':''}">${isPending ? 'Pending — usually posts in 1–2 business days' : 'Posted'}</span></div>

    ${hasMap ? `
    <div class="map-mock">
      <div class="map-pin"></div>
      <div class="map-loc-label">${escapeHtml(t.loc.city)}${t.loc.state?', '+escapeHtml(t.loc.state):''}</div>
    </div>` : ''}

    <div class="tx-actions-grid">
      <button class="tx-act" onclick="recategorizeTx('${acctId}','${txId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6 H21 M6 12 H18 M9 18 H15"/></svg>
        <span>Category</span>
      </button>
      <button class="tx-act" onclick="splitTx('${acctId}','${txId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 7 H8 L13 17 H21 M3 17 H8 L13 7 H21"/></svg>
        <span>Split</span>
      </button>
      <button class="tx-act" onclick="receiptTx('${acctId}','${txId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 3 H17 V21 L14 19 L11 21 L8 19 L5 21 Z"/><path d="M8 8 H14 M8 12 H14"/></svg>
        <span>Receipt</span>
      </button>
      <button class="tx-act danger" onclick="disputeTx('${acctId}','${txId}')">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9 V13 M12 17 V17.01"/><path d="M10.29 3.86 L1.82 18 a2 2 0 0 0 1.71 3 H20.47 a2 2 0 0 0 1.71 -3 L13.71 3.86 a2 2 0 0 0 -3.42 0z"/></svg>
        <span>Dispute</span>
      </button>
    </div>

    <div class="kv-list">
      <div class="kv-row"><span class="lbl">Account</span><span class="val">${escapeHtml(displayName(acct))} <span style="color:var(--muted);font-weight:500">${escapeHtml(acct.mask)}</span></span></div>
      <div class="kv-row"><span class="lbl">Category</span><span class="val">${escapeHtml(cat)} <button class="copy" onclick="recategorizeTx('${acctId}','${txId}')" aria-label="Edit category"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4 H4 V20 H20 V13"/><path d="M18.5 2.5 a2.12 2.12 0 0 1 3 3 L12 15 L8 16 L9 12 z"/></svg></button></span></div>
      <div class="kv-row"><span class="lbl">Description</span><span class="val">${escapeHtml(t.sub || '—')}</span></div>
      <div class="kv-row"><span class="lbl">Method</span><span class="val">${escapeHtml(t.method || '—')}${t.method === 'Card' ? ` · ${acct.kind === 'credit' ? '•• 9045' : '•• 4827'}` : ''}</span></div>
      <div class="kv-row"><span class="lbl">Reference</span><span class="val">${ref}<button class="copy" onclick="copyText('${ref}')" aria-label="Copy reference">${COPY_SVG}</button></span></div>
      ${note ? `<div class="kv-row"><span class="lbl">Note</span><span class="val">${escapeHtml(note)}</span></div>` : ''}
    </div>

    <div style="display:flex;gap:10px;margin:14px 0 6px">
      <button class="btn btn-ghost" onclick="hideTx('${acctId}','${txId}')">${ov.hidden?'Unhide':'Hide'} from feed</button>
      <button class="btn btn-ghost" onclick="searchSimilar('${acctId}','${txId}')">More like this</button>
    </div>
  `;
  openSheetRaw();
}
function recategorizeTx(acctId, txId){
  const t = findTx(acctId, txId); if(!t) return;
  const cats = ['Dining','Groceries','Shopping','Bills','Housing','Transport','Entertainment','Health','Travel','Transfer','Income','Other'];
  document.getElementById('sheetTitle').textContent = 'Choose category';
  document.getElementById('sheetBody').innerHTML = `
    <div class="list" style="margin:0">
      ${cats.map(c => `<div class="li" onclick="setCat('${acctId}','${txId}','${c}')"><span class="li-icon" style="background:color-mix(in srgb, ${catOf(c).color} 14%, transparent);color:${catOf(c).color}">${svgIcon(catOf(c).icon)}</span><div class="li-meta"><b>${c}</b></div><span class="li-trail">${effectiveCat(t)===c?'✓':''}</span></div>`).join('')}
    </div>
  `;
}
function setCat(acctId, txId, cat){
  state.txOverrides[txId] = { ...(state.txOverrides[txId]||{}), cat };
  saveState();
  toast('Category updated');
  openTxDetail(acctId, txId);
  if(activeId) renderTransactions(activeId);
}
function splitTx(acctId, txId){
  const t = findTx(acctId, txId); if(!t) return;
  const half = Math.abs(t.amt)/2;
  document.getElementById('sheetTitle').textContent = 'Split with someone';
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:13px;color:var(--muted);font-weight:500;margin:0 0 12px">Send a Zelle® request for half of <b style="color:var(--ink)">$${fmt(Math.abs(t.amt))}</b> ($${fmt(half)} each).</p>
    <div id="splitContacts"></div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="closeSheet();go('zelle');toast('Pick a contact to request from')">Request via Zelle®</button>
  `;
  document.getElementById('splitContacts').innerHTML = state.zelleContacts.slice(0,3).map(c => `
    <div class="contact-row" onclick="closeSheet();zelleFlow('${c.id}','request',${half.toFixed(2)})">
      <div class="avi tx-c-${c.color}">${c.name.charAt(0)}</div>
      <div class="meta"><b>${escapeHtml(c.name)}</b><span>Request $${fmt(half)}</span></div>
      <span style="color:var(--muted)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
    </div>
  `).join('');
}
function receiptTx(acctId, txId){
  const t = findTx(acctId, txId); if(!t) return;
  document.getElementById('sheetTitle').textContent = 'Receipt';
  const ref = t.id.replace('t-','MRD');
  document.getElementById('sheetBody').innerHTML = `
    <div style="background:#fff;border:1px dashed var(--line);border-radius:14px;padding:18px 16px;font-family:var(--mono);color:#1a2632">
      <div style="text-align:center;font-family:var(--serif);font-weight:600;font-size:18px;color:#0b3358">Meridian</div>
      <div style="text-align:center;font-size:11px;color:#6b7a87;margin-bottom:14px">Electronic receipt</div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin:3px 0"><span>Merchant</span><b>${escapeHtml(t.name)}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin:3px 0"><span>Date</span><b>${escapeHtml(t.date || t.day)} ${escapeHtml(t.time||'')}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin:3px 0"><span>Method</span><b>${escapeHtml(t.method || '—')}</b></div>
      <div style="display:flex;justify-content:space-between;font-size:11.5px;margin:3px 0"><span>Reference</span><b>${ref}</b></div>
      <div style="border-top:1px dashed #cbd5e0;margin:10px 0"></div>
      <div style="display:flex;justify-content:space-between;font-size:14px"><span>Total</span><b>${fmtSigned(t.amt)}</b></div>
      <div style="text-align:center;font-size:10px;color:#94a2ad;margin-top:14px">Thank you</div>
    </div>
    <button class="btn btn-primary" style="margin-top:14px" onclick="copyText('${ref}');closeSheet();toast('Receipt downloaded')">Download PDF</button>
  `;
}
function disputeTx(acctId, txId){
  const t = findTx(acctId, txId); if(!t) return;
  document.getElementById('sheetTitle').textContent = 'Dispute this charge';
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:13.5px;color:var(--muted);font-weight:500;margin:0 0 12px;line-height:1.5">Disputing <b style="color:var(--ink)">${escapeHtml(t.name)}</b> for <b style="color:var(--ink)">${fmtSigned(t.amt)}</b>. We'll open a case and get back to you within 10 business days.</p>
    <div class="list" style="margin:0">
      <div class="li" onclick="confirmDispute('${acctId}','${txId}','I don\\'t recognize this charge')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9 9 L15 15 M15 9 L9 15"/></svg></span><div class="li-meta"><b>I don't recognize this charge</b></div><span class="li-trail">›</span></div>
      <div class="li" onclick="confirmDispute('${acctId}','${txId}','I was charged the wrong amount')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 8 V12 M12 16 V16.01"/></svg></span><div class="li-meta"><b>Wrong amount charged</b></div><span class="li-trail">›</span></div>
      <div class="li" onclick="confirmDispute('${acctId}','${txId}','Duplicate charge')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><rect x="3" y="3" width="13" height="13" rx="2"/></svg></span><div class="li-meta"><b>Duplicate charge</b></div><span class="li-trail">›</span></div>
      <div class="li" onclick="confirmDispute('${acctId}','${txId}','I never received the goods/service')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16 V8 a2 2 0 0 0 -1 -1.73 L13 2.27 a2 2 0 0 0 -2 0 L4 6.27 A2 2 0 0 0 3 8 v8 a2 2 0 0 0 1 1.73 l7 4 a2 2 0 0 0 2 0 l7 -4 A2 2 0 0 0 21 16 z"/></svg></span><div class="li-meta"><b>Goods/service not received</b></div><span class="li-trail">›</span></div>
    </div>
  `;
}
function confirmDispute(acctId, txId, reason){
  const caseNum = 'CASE-' + Math.floor(Math.random()*900000+100000);
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Dispute opened', body:`We're reviewing your case ${caseNum}. Reason: ${reason}.`, ts:Date.now() });
  saveState();
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Dispute submitted</div>
      <div class="success-meta">Case ${caseNum}<br/>We'll email updates as we investigate.</div>
      <div style="margin-top:24px"><button class="btn btn-primary" onclick="closeSheet()">Done</button></div>
    </div>
  `;
  renderHome(); renderNotifications();
}
function hideTx(acctId, txId){
  const ov = state.txOverrides[txId] || {};
  ov.hidden = !ov.hidden;
  state.txOverrides[txId] = ov;
  saveState();
  toast(ov.hidden ? 'Hidden from feed' : 'Restored');
  closeSheet();
  if(activeId) renderTransactions(activeId);
}
function searchSimilar(acctId, txId){
  const t = findTx(acctId, txId); if(!t) return;
  closeSheet();
  startSearch(t.name.split(/\s|#/)[0]);
}

/* ============================================================
   ACCOUNT DETAILS SCREEN
   ============================================================ */
let acctDetailsId = null;
let acctDetailsReveal = false;
function openAcctDetails(id){
  acctDetailsId = id; acctDetailsReveal = false;
  renderAcctDetails();
  go('acctDetails');
}
function openAcctDetailsSecure(id){
  /* require step-up before showing the screen at all on first reveal */
  openAcctDetails(id);
}
function revealAcctNumbers(){
  if(acctDetailsReveal){
    acctDetailsReveal = false; renderAcctDetails(); return;
  }
  requireStepUp({
    reason: 'To display your full account, routing, and SWIFT numbers.',
    onSuccess: ()=>{ acctDetailsReveal = true; renderAcctDetails(); }
  });
}
function renderAcctDetails(){
  const a = accountById(acctDetailsId); if(!a) return;
  const isCredit = a.kind === 'credit';
  const mask = (s) => acctDetailsReveal ? s : (s ? s.replace(/[0-9](?=[0-9]{4})/g,'•').replace(/(.{4})/g,'$1 ').trim() : '—');
  const body = document.getElementById('acctDetailsBody');
  body.innerHTML = `
    <div class="acct-card-hero ${a.color}">
      <div class="ah-type">${escapeHtml(a.type)}</div>
      <div class="ah-name">${escapeHtml(a.name)}</div>
      <div class="ah-mask">${escapeHtml(a.mask)}</div>
      <div style="position:relative;z-index:1;margin-top:14px;font-family:var(--serif);font-weight:600;font-size:24px;letter-spacing:-.02em">${fmtMoney(a.balance)}<span style="font-family:var(--sans);font-size:10.5px;font-weight:600;opacity:.8;letter-spacing:.1em;text-transform:uppercase;margin-left:8px">${isCredit?'Current balance':'Available'}</span></div>
    </div>

    <div class="detail-banner">
      <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11 V7 a5 5 0 0 1 10 0 v4"/></svg></div>
      <div class="meta">
        <b>${acctDetailsReveal?'Numbers visible':'Numbers hidden'}</b>
        <span>${acctDetailsReveal?'Anyone seeing your screen can read them':'Tap to reveal full account info'}</span>
      </div>
      <button class="show-toggle" onclick="revealAcctNumbers()">${acctDetailsReveal?'Hide':'Show'}</button>
    </div>

    ${isCredit ? `
      <div class="detail-section-h">Card</div>
      <div class="list">
        <div class="kv-row" style="padding:14px 16px"><span class="lbl">Card number</span><span class="val">${mask(a.number.replace(/\s/g,''))}<button class="copy" onclick="copyText('${a.number.replace(/\s/g,'')}')" aria-label="Copy">${COPY_SVG}</button></span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Credit limit</span><span class="val">$${fmt(a.limit||0)}</span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">APR</span><span class="val">${a.apr||0}%</span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Next payment due</span><span class="val">${a.due||'—'}</span></div>
      </div>
    ` : `
      <div class="detail-section-h">Account numbers</div>
      <div class="list">
        <div class="kv-row" style="padding:14px 16px"><span class="lbl">Account number</span><span class="val">${mask(a.number)}<button class="copy" onclick="copyText('${a.number}')" aria-label="Copy">${COPY_SVG}</button></span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Routing (ACH)</span><span class="val">${mask(a.routing)}<button class="copy" onclick="copyText('${a.routing}')" aria-label="Copy">${COPY_SVG}</button></span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">SWIFT/BIC</span><span class="val">${escapeHtml(a.swift||'—')}<button class="copy" onclick="copyText('${a.swift||''}')" aria-label="Copy">${COPY_SVG}</button></span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Wire routing</span><span class="val">${mask(a.routing)}<button class="copy" onclick="copyText('${a.routing}')" aria-label="Copy">${COPY_SVG}</button></span></div>
        ${a.apy ? `<div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">APY</span><span class="val" style="color:var(--pos)">${a.apy}%</span></div>` : ''}
        ${a.goal ? `<div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Goal</span><span class="val">${fmtMoney(a.aside)} of $${fmt(a.goal)}</span></div>` : ''}
      </div>

      <div class="detail-section-h">Bank info</div>
      <div class="list">
        <div class="kv-row" style="padding:14px 16px"><span class="lbl">Bank name</span><span class="val">Meridian Bank, N.A.</span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Bank address</span><span class="val" style="text-align:right">100 W 10th St, Suite 800<br/>Wilmington, DE 19801</span></div>
        <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Opened</span><span class="val">${escapeHtml(a.opened||'—')}</span></div>
      </div>
    `}

    <div style="padding:14px 16px 32px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-ghost" onclick="shareAccountDetails()"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 V20 a2 2 0 0 0 2 2 H18 a2 2 0 0 0 2 -2 V12"/><path d="M16 6 L12 2 L8 6"/><path d="M12 2 V15"/></svg>Share account info</button>
      <button class="btn btn-ghost" onclick="copyAllAcctInfo()">Copy all to clipboard</button>
    </div>
  `;
}
function shareAccountDetails(){
  const a = accountById(acctDetailsId); if(!a) return;
  const text = buildAcctText(a);
  if(navigator.share){
    navigator.share({ title: a.name, text }).catch(()=>{});
  } else {
    copyText(text);
  }
}
function copyAllAcctInfo(){
  const a = accountById(acctDetailsId); if(!a) return;
  copyText(buildAcctText(a));
}
function buildAcctText(a){
  if(a.kind === 'credit'){
    return `${a.name}\nCard: ${a.number}\nLimit: $${fmt(a.limit||0)}\nAPR: ${a.apr}%`;
  }
  return `${a.name}\nAccount #: ${a.number}\nRouting (ACH): ${a.routing}\nSWIFT/BIC: ${a.swift}\nBank: Meridian Bank, N.A.\n100 W 10th St, Wilmington, DE 19801`;
}

/* ============================================================
   SEARCH
   ============================================================ */
function startSearch(prefill){
  const inp = document.getElementById('searchInput');
  inp.value = prefill || '';
  document.getElementById('searchBar').classList.toggle('has-text', !!inp.value);
  renderSearchResults(inp.value);
  go('search');
  setTimeout(()=> inp.focus(), 220);
}
function clearSearch(){
  const inp = document.getElementById('searchInput');
  inp.value = '';
  document.getElementById('searchBar').classList.remove('has-text');
  renderSearchResults('');
  inp.focus();
}
function renderSearchResults(q){
  const wrap = document.getElementById('searchResults');
  q = (q||'').trim().toLowerCase();
  if(!q){
    const recent = state.searches.slice(0,5);
    wrap.innerHTML = `
      ${recent.length ? `
        <div class="section-h">Recent searches</div>
        <div class="recent-search">
          ${recent.map(s => `
            <div class="recent-row" onclick="startSearch('${escapeHtml(s)}')">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><path d="M12 7 V12 L15 14"/></svg>
              <b>${escapeHtml(s)}</b>
              <button class="x" onclick="event.stopPropagation();removeRecent('${escapeHtml(s)}')"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 L6 18 M6 6 L18 18"/></svg></button>
            </div>
          `).join('')}
        </div>
      ` : ''}
      <div class="section-h">Browse by category</div>
      <div class="cat-grid" style="margin-bottom:24px">
        <div class="cat-tile" onclick="startSearch('Dining')"><div class="swatch" style="background:#ea580c"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 11 H21 V21 H3 Z"/></svg></div><div><b>Dining</b><span>Restaurants & delivery</span></div></div>
        <div class="cat-tile" onclick="startSearch('Shopping')"><div class="swatch" style="background:#db2777"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2 L3 6 V20 a2 2 0 0 0 2 2 H19 a2 2 0 0 0 2 -2 V6 L18 2 Z"/></svg></div><div><b>Shopping</b><span>Retail & online</span></div></div>
        <div class="cat-tile" onclick="startSearch('Bills')"><div class="swatch" style="background:#7c3aed"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg></div><div><b>Bills</b><span>Recurring payments</span></div></div>
        <div class="cat-tile" onclick="startSearch('Transfer')"><div class="swatch" style="background:#64748b"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 8 H17 L14 5"/><path d="M20 16 H7 L10 19"/></svg></div><div><b>Transfers</b><span>Internal & external</span></div></div>
      </div>
    `;
    return;
  }
  const num = parseFloat(q.replace(/[^0-9.]/g,''));
  const matches = allTx().filter(t => {
    const hay = `${t.name} ${t.sub} ${effectiveCat(t)} ${t.method} ${t.loc?.city||''} ${t.loc?.state||''}`.toLowerCase();
    if(hay.includes(q)) return true;
    if(!isNaN(num) && Math.abs(Math.abs(t.amt) - num) < 0.01) return true;
    return false;
  });
  if(!matches.length){
    wrap.innerHTML = `
      <div class="search-empty">
        <div class="ico">${svgIcon('<circle cx="11" cy="11" r="7"/><path d="M20 20 L16.2 16.2"/>')}</div>
        <b>No matches</b>
        <span>Try a merchant name, category, or amount.</span>
      </div>`;
    return;
  }
  const total = matches.reduce((s, t) => s + t.amt, 0);
  let html = `<div class="section-h" style="display:flex;justify-content:space-between"><span>${matches.length} result${matches.length===1?'':'s'}</span><span>Net ${fmtSigned(total)}</span></div><div class="list">`, day = '';
  matches.slice(0, 60).forEach(t => {
    const label = t.ts ? relDay(t.ts) : t.day;
    if(label !== day){ html += `<div class="tx-day">${label}</div>`; day = label; }
    const a = accountById(t.acct);
    html += `
      <div class="tx" onclick="closeSearchAndOpen('${t.acct}','${t.id}')" role="button" tabindex="0">
        ${txAvatar(t)}
        <div class="tx-meta">
          <div class="tx-name">${highlight(t.name, q)}</div>
          <div class="tx-sub">${escapeHtml(a ? displayName(a) : '')} · ${escapeHtml(effectiveCat(t))}</div>
        </div>
        <div class="tx-amt ${t.amt>=0?'pos':'neg'}">${fmtSigned(t.amt)}</div>
      </div>`;
  });
  wrap.innerHTML = html + '</div>';
}
function highlight(s, q){
  s = String(s||'');
  if(!q) return escapeHtml(s);
  const idx = s.toLowerCase().indexOf(q);
  if(idx < 0) return escapeHtml(s);
  return escapeHtml(s.slice(0,idx)) + '<mark style="background:rgba(200,155,60,.35);color:inherit;padding:0 2px;border-radius:3px">' + escapeHtml(s.slice(idx, idx+q.length)) + '</mark>' + escapeHtml(s.slice(idx+q.length));
}
function closeSearchAndOpen(acctId, txId){
  // remember query
  const q = document.getElementById('searchInput').value.trim();
  if(q && !state.searches.includes(q)){ state.searches.unshift(q); state.searches = state.searches.slice(0,8); saveState(); }
  back('search', prevScreen('home'));
  setTimeout(()=> openTxDetail(acctId, txId), 250);
}
function removeRecent(q){
  state.searches = state.searches.filter(s => s !== q); saveState();
  renderSearchResults('');
}
document.addEventListener('input', e => {
  if(e.target.id === 'searchInput'){
    document.getElementById('searchBar').classList.toggle('has-text', !!e.target.value);
    renderSearchResults(e.target.value);
  }
  if(e.target.id === 'depAmtInput'){
    let v = e.target.value.replace(/[^0-9.]/g,'');
    const parts = v.split('.'); if(parts.length>2) v = parts[0]+'.'+parts.slice(1).join('');
    if(parts[1] && parts[1].length>2) v = parts[0]+'.'+parts[1].slice(0,2);
    e.target.value = v;
    DEP.amount = v;
    validateDeposit();
  }
});

/* ============================================================
   DEPOSIT CHECK
   ============================================================ */
const DEP = { acct:null, amount:'', front:false, back:false, memo:'' };
function startDeposit(){
  const a = state.accounts.find(x => x.kind !== 'credit') || state.accounts[0];
  DEP.acct = a.id; DEP.amount = ''; DEP.front = false; DEP.back = false; DEP.memo = '';
  document.getElementById('depAmtInput').value = '';
  document.getElementById('depMemo').value = '';
  renderDeposit();
  go('deposit');
}
function depPickAccount(){
  document.getElementById('sheetTitle').textContent = 'Deposit to';
  document.getElementById('sheetBody').innerHTML = state.accounts.filter(a => a.kind !== 'credit').map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" onclick="DEP.acct='${a.id}';renderDeposit();closeSheet()">
      <div class="swatch"></div>
      <div class="info"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)}</span><span class="bal">${fmtMoney(a.balance)} available</span></div>
    </div>
  `).join('');
  openSheetRaw();
}
function renderDeposit(){
  const a = accountById(DEP.acct);
  document.getElementById('depAcctName').textContent = a.name;
  document.getElementById('depAcctMask').textContent = a.mask;
  document.getElementById('depAcctBal').textContent = fmtMoney(a.balance) + ' available';
  document.querySelector('#depAcctPick .swatch').className = 'swatch ' + pickCls(a);
  // step states
  setStep('Front', DEP.front, false);
  setStep('Back',  DEP.back,  !DEP.front);
  // back frame enabled?
  const backFrame = document.getElementById('depBackFrame');
  if(DEP.front && !DEP.back){ backFrame.style.opacity=''; backFrame.style.pointerEvents=''; backFrame.querySelector('.hint').textContent = 'Tap to take photo of the BACK'; }
  else if(!DEP.front){ backFrame.style.opacity='.5'; backFrame.style.pointerEvents='none'; backFrame.querySelector('.hint').textContent = 'Capture the front first'; }
  validateDeposit();
}
function setStep(side, done, locked){
  const stepEl = document.getElementById('dep'+side+'Step');
  const status = document.getElementById('dep'+side+'Status');
  stepEl.classList.toggle('done', done);
  stepEl.classList.toggle('todo', !done);
  status.textContent = done ? 'Captured ✓' : (locked ? 'Locked' : 'Tap to start');
  status.style.color = done ? 'var(--pos)' : 'var(--muted)';
  // render the captured artwork
  const frame = document.getElementById('dep'+side+'Frame');
  if(done){
    frame.classList.add('done');
    const a = accountById(DEP.acct);
    const amt = parseFloat(DEP.amount||0).toFixed(2);
    frame.innerHTML = side === 'Front' ? `
      <div class="check-art">
        <div class="bank">First Federal</div>
        <div class="ck-num">No. 4129</div>
        <div class="pay-line">Pay to: ${escapeHtml(state.user.name)}</div>
        <div class="amt-box">$${amt}</div>
        <div class="micr">⑆ 011000028 ⑆ 0123456789 ⑈ 4129</div>
      </div>
    ` : `
      <div class="check-art back">
        <div class="endorse">ENDORSE HERE — DO NOT WRITE BELOW LINE</div>
        <div class="sig-line sig">${escapeHtml(state.user.name)}</div>
        <div style="position:absolute;left:14px;right:14px;top:50px;font-size:9px;color:#1a2632">For Mobile Deposit Only — Meridian ${escapeHtml(a.mask)}</div>
      </div>
    `;
  }
}
function captureCheck(side){
  if(side === 'back' && !DEP.front) return;
  const frame = document.getElementById('dep'+(side==='front'?'Front':'Back')+'Frame');
  frame.style.background = '#fff';
  frame.querySelector('.hint') && (frame.querySelector('.hint').textContent = '⏳ Reading micr line…');
  setTimeout(()=>{
    DEP[side] = true;
    if(side === 'front' && !DEP.amount){
      // auto-fill amount based on a guess if blank
    }
    renderDeposit();
    if(navigator.vibrate) navigator.vibrate(20);
    toast(side === 'front' ? 'Front captured' : 'Back captured');
  }, 700);
}
function validateDeposit(){
  const v = parseFloat(DEP.amount);
  const ok = v > 0 && v <= 5000 && DEP.front && DEP.back;
  document.getElementById('depSubmit').disabled = !ok;
}
function reviewDeposit(){
  const a = accountById(DEP.acct);
  const v = parseFloat(DEP.amount);
  document.getElementById('sheetTitle').textContent = 'Confirm deposit';
  document.getElementById('sheetBody').innerHTML = `
    <div class="review-amount"><span class="cur">$</span>${fmt(v)}</div>
    <div class="review-row"><span class="lbl">To</span><span class="val">${escapeHtml(a.name)}<span class="sub">${escapeHtml(a.mask)}</span></span></div>
    <div class="review-row"><span class="lbl">Available</span><span class="val">Tomorrow by 9 AM<span class="sub">First $250 today</span></span></div>
    <div class="review-row"><span class="lbl">Memo</span><span class="val">${escapeHtml(DEP.memo || '—')}</span></div>
    <div class="review-row"><span class="lbl">Fee</span><span class="val" style="color:var(--pos)">$0.00</span></div>
    <p style="margin:14px 0 4px;font-size:11.5px;color:var(--muted);font-weight:500;line-height:1.5">By confirming, you agree to retain the original check for 14 days, then destroy it. Don't redeposit.</p>
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="confirmDeposit()">Submit deposit</button>
      <button class="btn btn-ghost" onclick="closeSheet()">Edit</button>
    </div>
  `;
  openSheetRaw();
}
function confirmDeposit(){
  const a = accountById(DEP.acct);
  const v = parseFloat(DEP.amount);
  // 1st $250 immediate, rest next day — for the demo we just credit it all but mark $250 as today.
  a.balance = +(a.balance + v).toFixed(2);
  if(a.kind !== 'credit') a.spendable = +(a.spendable + Math.min(v, 250)).toFixed(2);
  const txId = 't-dep-'+Date.now();
  state.txByAccount[a.id] = [{
    id:txId, ...txStamp(),
    cat:'Income', name:'Mobile check deposit', sub:DEP.memo || 'Check', amt:+v, c:4,
    status:'Pending', loc:{city:'Mobile deposit',state:'',lat:0,lng:0}, method:'Check'
  }, ...(state.txByAccount[a.id]||[])];
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Check deposit submitted', body:`${fmtMoney(v)} pending to ${a.name}. First $250 available now.`, ts:Date.now() });
  saveState();
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Deposit submitted</div>
      <div class="success-amt">${fmtMoney(v)}</div>
      <div class="success-meta">Pending to ${escapeHtml(a.name)}<br/>Confirmation #MRD-${Math.floor(Math.random()*900000+100000)}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeSheet();back('deposit','home')">Done</button>
        <button class="btn btn-ghost" onclick="closeSheet();startDeposit()">Deposit another</button>
      </div>
    </div>
  `;
  renderHome(); renderNotifications();
}

/* ============================================================
   BILL PAY
   ============================================================ */
let BILL = { payeeId:null, fromId:null, amount:'', date:'today', recur:'once', memo:'' };
function startBillPay(){
  renderPayees();
  go('payBill');
}
function renderPayees(){
  const list = document.getElementById('payeeList');
  list.innerHTML = state.payees.map(p => {
    const tag = p.autopay ? `<span class="payee-tag">Autopay</span>` : `<span class="payee-tag due">Due ${escapeHtml(p.next)}</span>`;
    return `
      <div class="payee-row" onclick="openPayeeFlow('${p.id}')">
        <div class="payee-logo" style="background:${p.logoColor}">${escapeHtml(p.name.charAt(0))}</div>
        <div class="payee-meta"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.category)} · ${escapeHtml(p.account)}</span></div>
        <div class="payee-trail"><b>$${fmt(p.last)}</b><span>last paid</span><br/>${tag}</div>
      </div>
    `;
  }).join('');
}
function openPayeeFlow(id){
  const p = state.payees.find(x => x.id === id); if(!p) return;
  BILL = { payeeId:id, fromId: state.accounts.find(a=>a.kind==='checking').id, amount:String(p.last.toFixed(2)), date:'today', recur:'once', memo:'' };
  document.getElementById('sheetTitle').textContent = 'Pay ' + p.name;
  renderPayeeSheet();
  openSheetRaw();
}
function renderPayeeSheet(){
  const p = state.payees.find(x => x.id === BILL.payeeId);
  const from = accountById(BILL.fromId);
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">From account</div>
      <div class="acct-pick ${pickCls(from)}" onclick="pickPayFromAccount()">
        <div class="swatch"></div>
        <div class="info"><b>${escapeHtml(from.name)}</b><span>${escapeHtml(from.mask)}</span><span class="bal">${fmtMoney(from.balance)} available</span></div>
        <span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
      </div>
    </div>

    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">Amount</div>
      <div class="amount-input">
        <span class="currency">$</span>
        <input type="text" inputmode="decimal" id="billAmt" value="${escapeHtml(BILL.amount)}" />
      </div>
    </div>

    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">Send on</div>
      <div class="recur-row">
        <div class="opt ${BILL.date==='today'?'active':''}" onclick="BILL.date='today';renderPayeeSheet()">Today</div>
        <div class="opt ${BILL.date==='tomorrow'?'active':''}" onclick="BILL.date='tomorrow';renderPayeeSheet()">Tomorrow</div>
        <div class="opt ${BILL.date==='due'?'active':''}" onclick="BILL.date='due';renderPayeeSheet()">${escapeHtml(p.next)} (due)</div>
      </div>
    </div>

    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">Repeat</div>
      <div class="recur-row">
        <div class="opt ${BILL.recur==='once'?'active':''}" onclick="BILL.recur='once';renderPayeeSheet()">Once</div>
        <div class="opt ${BILL.recur==='monthly'?'active':''}" onclick="BILL.recur='monthly';renderPayeeSheet()">Monthly</div>
        <div class="opt ${BILL.recur==='biweekly'?'active':''}" onclick="BILL.recur='biweekly';renderPayeeSheet()">Bi-weekly</div>
      </div>
    </div>

    <div class="form-section" style="margin-bottom:18px">
      <div class="form-label">Memo (optional)</div>
      <input type="text" class="field" id="billMemo" value="${escapeHtml(BILL.memo)}" placeholder="Account 4419, May invoice…" />
    </div>

    <button class="btn btn-primary" id="billReview" onclick="reviewBillPay()">Review payment</button>
  `;
  document.getElementById('billAmt').addEventListener('input', e => {
    let v = e.target.value.replace(/[^0-9.]/g,'');
    const parts = v.split('.'); if(parts.length>2) v = parts[0]+'.'+parts.slice(1).join('');
    if(parts[1] && parts[1].length>2) v = parts[0]+'.'+parts[1].slice(0,2);
    e.target.value = v; BILL.amount = v;
  });
  document.getElementById('billMemo').addEventListener('input', e => BILL.memo = e.target.value);
}
function pickPayFromAccount(){
  document.getElementById('sheetTitle').textContent = 'Pay from';
  document.getElementById('sheetBody').innerHTML = state.accounts.filter(a => a.kind !== 'credit').map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" onclick="BILL.fromId='${a.id}';renderPayeeSheet()">
      <div class="swatch"></div>
      <div class="info"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)}</span><span class="bal">${fmtMoney(a.balance)} available</span></div>
    </div>
  `).join('');
}
function reviewBillPay(){
  const p = state.payees.find(x => x.id === BILL.payeeId);
  const from = accountById(BILL.fromId);
  const v = parseFloat(BILL.amount);
  if(!(v>0) || v > from.balance){ toast('Check amount'); return; }
  document.getElementById('sheetTitle').textContent = 'Confirm payment';
  const sendLabel = BILL.date === 'today' ? 'Today' : BILL.date === 'tomorrow' ? 'Tomorrow' : p.next;
  const recurLabel = BILL.recur === 'once' ? 'One-time' : BILL.recur === 'monthly' ? 'Every month' : 'Every 2 weeks';
  document.getElementById('sheetBody').innerHTML = `
    <div class="review-amount"><span class="cur">$</span>${fmt(v)}</div>
    <div class="review-row"><span class="lbl">To</span><span class="val">${escapeHtml(p.name)}<span class="sub">${escapeHtml(p.account)}</span></span></div>
    <div class="review-row"><span class="lbl">From</span><span class="val">${escapeHtml(from.name)}<span class="sub">${escapeHtml(from.mask)}</span></span></div>
    <div class="review-row"><span class="lbl">Send</span><span class="val">${escapeHtml(sendLabel)}</span></div>
    <div class="review-row"><span class="lbl">Repeat</span><span class="val">${escapeHtml(recurLabel)}</span></div>
    <div class="review-row"><span class="lbl">Memo</span><span class="val">${escapeHtml(BILL.memo || '—')}</span></div>
    <div class="review-row"><span class="lbl">Fee</span><span class="val" style="color:var(--pos)">$0.00</span></div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="confirmBillPay()">Confirm payment</button>
      <button class="btn btn-ghost" onclick="renderPayeeSheet()">Edit</button>
    </div>
  `;
}
function confirmBillPay(){
  const p = state.payees.find(x => x.id === BILL.payeeId);
  const from = accountById(BILL.fromId);
  const v = parseFloat(BILL.amount);
  from.balance = +(from.balance - v).toFixed(2);
  from.spendable = +(from.spendable - v).toFixed(2);
  const txId = 't-bp-'+Date.now();
  state.txByAccount[from.id] = [{
    id:txId, ...txStamp(),
    cat:'Bills', name:p.name, sub:'Bill payment · '+p.account, amt:-v, c:5, status:'Pending',
    loc:{city:'Online',state:'',lat:0,lng:0}, method:'ACH'
  }, ...(state.txByAccount[from.id]||[])];
  p.last = v;
  state.billPayments.unshift({ id:txId, payeeId:p.id, payee:p.name, amount:v, date:fmtMD(new Date()), ts:Date.now(), recur:BILL.recur });
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Bill scheduled', body:`${fmtMoney(v)} to ${p.name} from ${from.name}.`, ts:Date.now() });
  saveState();
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Payment scheduled</div>
      <div class="success-amt">${fmtMoney(v)}</div>
      <div class="success-meta">${escapeHtml(p.name)}<br/>Confirmation #BP-${Math.floor(Math.random()*900000+100000)}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeSheet();back('payBill','home')">Done</button>
        <button class="btn btn-ghost" onclick="closeSheet();startBillPay()">Pay another bill</button>
      </div>
    </div>
  `;
  renderPayees(); renderHome(); renderNotifications();
}
function addPayeeFlow(){
  document.getElementById('sheetTitle').textContent = 'Add a payee';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Biller name</div><input class="field" id="newPayeeName" placeholder="Comcast, Amex, ConEd…" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Category</div><input class="field" id="newPayeeCat" placeholder="Internet, Credit card, Utility…" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Account number with biller</div><input class="field" id="newPayeeAcct" placeholder="Account / reference number" /></div>
    <button class="btn btn-primary" onclick="addPayeeSubmit()">Add payee</button>
  `;
  openSheetRaw();
}
function addPayeeSubmit(){
  const name = document.getElementById('newPayeeName').value.trim();
  const cat  = document.getElementById('newPayeeCat').value.trim() || 'Other';
  const acct = document.getElementById('newPayeeAcct').value.trim() || '••';
  if(!name){ toast('Enter a biller name'); return; }
  const id = 'p-'+Date.now();
  const colors = ['#a82420','#1f4570','#0e7c4a','#5e3a8c','#c89b3c'];
  state.payees.push({ id, name, category:cat, account:'•• '+acct.slice(-4).padStart(4,'X'), logoColor:colors[Math.floor(Math.random()*colors.length)], last:0, autopay:false, next:'Not scheduled' });
  saveState(); renderPayees(); closeSheet(); toast('Payee added');
}

/* ============================================================
   ZELLE
   ============================================================ */
let ZEL = { contactId:null, fromId:null, amount:'', memo:'', mode:'send' };
function startZelle(){
  renderZelle();
  go('zelle');
}
function renderZelle(){
  const freq = state.zelleContacts.filter(c => c.tag==='frequent');
  const fEl = document.getElementById('zelleFrequent');
  fEl.innerHTML = `
    <div class="contact-cell" onclick="addZelleFlow()">
      <div class="contact-avatar add">+</div>
      <span>New</span>
    </div>
    ${freq.map(c => `
      <div class="contact-cell" onclick="zelleFlow('${c.id}','send')">
        <div class="contact-avatar tx-c-${c.color}">${escapeHtml(c.name.charAt(0))}</div>
        <span>${escapeHtml(c.name.split(' ')[0])}</span>
      </div>
    `).join('')}
  `;
  document.getElementById('zelleAll').innerHTML = state.zelleContacts.map(c => `
    <div class="contact-row" onclick="zelleFlow('${c.id}','send')">
      <div class="avi tx-c-${c.color}">${escapeHtml(c.name.charAt(0))}</div>
      <div class="meta"><b>${escapeHtml(c.name)}</b><span>${escapeHtml(c.handle)}${c.last?` · last $${fmt(c.last)}`:''}</span></div>
      <span style="color:var(--muted)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
    </div>
  `).join('');
}
function zelleFlow(id, mode, prefillAmt){
  const c = state.zelleContacts.find(x => x.id === id); if(!c) return;
  ZEL = { contactId:id, fromId: state.accounts.find(a=>a.kind==='checking').id, amount: prefillAmt? String(parseFloat(prefillAmt).toFixed(2)) : '', memo:'', mode:mode||'send' };
  document.getElementById('sheetTitle').textContent = (mode==='request'?'Request from ':'Send to ') + c.name;
  renderZelleSheet();
  openSheetRaw();
}
function renderZelleSheet(){
  const c = state.zelleContacts.find(x => x.id === ZEL.contactId);
  const from = accountById(ZEL.fromId);
  document.getElementById('sheetBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;padding:8px 0 14px">
      <div class="avi tx-c-${c.color}" style="width:48px;height:48px;border-radius:50%;display:grid;place-items:center;color:#fff;font-family:var(--serif);font-weight:600;font-size:19px">${escapeHtml(c.name.charAt(0))}</div>
      <div><b style="font-size:15px;color:var(--ink)">${escapeHtml(c.name)}</b><div style="font-size:12px;color:var(--muted);font-weight:500">${escapeHtml(c.handle)}</div></div>
    </div>

    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">${ZEL.mode==='request'?'Request':'Send'} amount</div>
      <div class="amount-input" style="padding:18px 16px">
        <span class="currency">$</span>
        <input type="text" inputmode="decimal" id="zelAmt" value="${escapeHtml(ZEL.amount)}" placeholder="0.00" />
      </div>
    </div>

    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">${ZEL.mode==='request'?'Request to':'Send from'}</div>
      <div class="acct-pick ${pickCls(from)}" onclick="pickZelleFrom()">
        <div class="swatch"></div>
        <div class="info"><b>${escapeHtml(from.name)}</b><span>${escapeHtml(from.mask)}</span><span class="bal">${fmtMoney(from.balance)} available</span></div>
        <span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
      </div>
    </div>

    <div class="form-section" style="margin-bottom:18px">
      <div class="form-label">Memo (optional)</div>
      <input type="text" class="field" id="zelMemo" value="${escapeHtml(ZEL.memo)}" placeholder="Brunch, rent…" maxlength="40" />
    </div>

    <p style="font-size:11.5px;color:var(--muted);font-weight:500;line-height:1.5;margin:0 0 12px">Zelle® is for sending money to people you trust. Once sent, payments can't usually be canceled.</p>

    <button class="btn btn-primary" onclick="reviewZelle()">${ZEL.mode==='request'?'Review request':'Review transfer'}</button>
  `;
  document.getElementById('zelAmt').addEventListener('input', e => {
    let v = e.target.value.replace(/[^0-9.]/g,'');
    const parts = v.split('.'); if(parts.length>2) v = parts[0]+'.'+parts.slice(1).join('');
    if(parts[1] && parts[1].length>2) v = parts[0]+'.'+parts[1].slice(0,2);
    e.target.value = v; ZEL.amount = v;
  });
  document.getElementById('zelMemo').addEventListener('input', e => ZEL.memo = e.target.value);
}
function pickZelleFrom(){
  document.getElementById('sheetTitle').textContent = 'Send from';
  document.getElementById('sheetBody').innerHTML = state.accounts.filter(a => a.kind !== 'credit').map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" onclick="ZEL.fromId='${a.id}';renderZelleSheet()">
      <div class="swatch"></div>
      <div class="info"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)}</span><span class="bal">${fmtMoney(a.balance)} available</span></div>
    </div>
  `).join('');
}
function reviewZelle(){
  const c = state.zelleContacts.find(x => x.id === ZEL.contactId);
  const from = accountById(ZEL.fromId);
  const v = parseFloat(ZEL.amount);
  if(!(v>0)){ toast('Enter an amount'); return; }
  if(ZEL.mode==='send' && v > from.balance){ toast('Insufficient funds'); return; }
  document.getElementById('sheetTitle').textContent = ZEL.mode==='request' ? 'Confirm request' : 'Confirm transfer';
  document.getElementById('sheetBody').innerHTML = `
    <div class="review-amount"><span class="cur">$</span>${fmt(v)}</div>
    <div class="review-row"><span class="lbl">${ZEL.mode==='request'?'From':'To'}</span><span class="val">${escapeHtml(c.name)}<span class="sub">${escapeHtml(c.handle)}</span></span></div>
    <div class="review-row"><span class="lbl">${ZEL.mode==='request'?'To':'From'}</span><span class="val">${escapeHtml(from.name)}<span class="sub">${escapeHtml(from.mask)}</span></span></div>
    <div class="review-row"><span class="lbl">When</span><span class="val">In minutes<span class="sub">If recipient is enrolled</span></span></div>
    <div class="review-row"><span class="lbl">Memo</span><span class="val">${escapeHtml(ZEL.memo || '—')}</span></div>
    <div class="review-row"><span class="lbl">Fee</span><span class="val" style="color:var(--pos)">$0.00</span></div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="confirmZelle()">${ZEL.mode==='request'?'Send request':'Send money'}</button>
      <button class="btn btn-ghost" onclick="renderZelleSheet()">Edit</button>
    </div>
  `;
}
function confirmZelle(){
  const c = state.zelleContacts.find(x => x.id === ZEL.contactId);
  const from = accountById(ZEL.fromId);
  const v = parseFloat(ZEL.amount);
  if(ZEL.mode === 'send'){
    from.balance = +(from.balance - v).toFixed(2);
    from.spendable = +(from.spendable - v).toFixed(2);
    const txId = 't-zl-'+Date.now();
    state.txByAccount[from.id] = [{
      id:txId, ...txStamp(),
      cat:'Transfer', name:'Zelle to '+c.name, sub:c.handle, amt:-v, c:c.color||5, status:'Posted',
      loc:{city:'Zelle',state:'',lat:0,lng:0}, method:'Zelle'
    }, ...(state.txByAccount[from.id]||[])];
    c.last = v; c.tag = 'frequent';
    state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Zelle® sent', body:`${fmtMoney(v)} to ${c.name}.`, ts:Date.now() });
  } else {
    state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Zelle® request sent', body:`Asked ${c.name} for ${fmtMoney(v)}. We'll notify you when they pay.`, ts:Date.now() });
  }
  saveState();
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">${ZEL.mode==='request'?'Request sent':'Money sent'}</div>
      <div class="success-amt">${fmtMoney(v)}</div>
      <div class="success-meta">${ZEL.mode==='request'?'Asked':'To'} ${escapeHtml(c.name)}<br/>Confirmation #ZL-${Math.floor(Math.random()*900000+100000)}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeSheet();back('zelle','home')">Done</button>
        <button class="btn btn-ghost" onclick="closeSheet();startZelle()">${ZEL.mode==='request'?'Request from someone else':'Send to someone else'}</button>
      </div>
    </div>
  `;
  renderZelle(); renderHome(); renderNotifications();
}
function addZelleFlow(){
  document.getElementById('sheetTitle').textContent = 'Add Zelle® contact';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Name</div><input class="field" id="newZelName" placeholder="Their name" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">U.S. mobile or email</div><input class="field" id="newZelHandle" placeholder="(555) 555-1234 or name@email.com" /></div>
    <p style="font-size:11.5px;color:var(--muted);font-weight:500;line-height:1.5;margin:0 0 12px">If your contact isn't enrolled, they'll get an invite by text or email.</p>
    <button class="btn btn-primary" onclick="addZelleSubmit()">Add contact</button>
  `;
  openSheetRaw();
}
function addZelleSubmit(){
  const name = document.getElementById('newZelName').value.trim();
  const handle = document.getElementById('newZelHandle').value.trim();
  if(!name || !handle){ toast('Name and handle required'); return; }
  const id = 'z-'+Date.now();
  state.zelleContacts.unshift({ id, name, handle, tag:'recent', color: 1+Math.floor(Math.random()*6), last:0 });
  saveState(); renderZelle(); closeSheet(); toast('Contact added');
}

/* ============================================================
   WEEK CHART (home insights)
   ============================================================ */
function renderWeekBars(){
  const el = document.getElementById('weekBars'); if(!el) return;
  const days = [];
  for(let i = 6; i >= 0; i--){
    const d = addDays(TODAY, -i);
    const sp = spendingBetween(+d, +addDays(d, 1));
    days.push({ d, v: sp.total - (sp.by.Housing || 0) - (sp.by.Bills || 0) });
  }
  const max = Math.max(1, ...days.map(x => x.v));
  el.innerHTML = days.map((x, i) => {
    const h = Math.max(6, Math.round(x.v / max * 70));
    return `
      <div class="bar-col ${i === 6 ? 'today' : ''}" title="${WEEKDAY[x.d.getDay()]} · ${fmtMoney(x.v)}">
        <div class="bar-fill" style="height:${h}px"></div>
        <div class="bar-day">${i === 6 ? 'Today' : WEEKDAY[x.d.getDay()].charAt(0)}</div>
      </div>`;
  }).join('');
}

/* ============================================================
   CARD LIMITS
   ============================================================ */
function openCardLimits(){
  renderCardLimits();
  go('cardLimits');
}
function renderCardLimits(){
  const L = state.cardLimits;
  const body = document.getElementById('limitsBody');
  body.innerHTML = `
    <div class="limit-card">
      <div class="limit-row">
        <div class="meta"><b>Daily purchases</b><span>All in-store and online</span></div>
        <div class="limit-val">$${fmt(L.daily)}<small>per day</small></div>
      </div>
      <input type="range" min="100" max="10000" step="100" value="${L.daily}" class="slider" id="lDaily" />
      <div class="slider-ticks"><span>$100</span><span>$5,000</span><span>$10,000</span></div>
    </div>

    <div class="limit-card" style="margin-top:14px">
      <div class="limit-row">
        <div class="meta"><b>ATM withdrawal</b><span>Cash from any Meridian or Allpoint ATM</span></div>
        <div class="limit-val">$${fmt(L.atm)}<small>per day</small></div>
      </div>
      <input type="range" min="0" max="2000" step="50" value="${L.atm}" class="slider" id="lATM" />
      <div class="slider-ticks"><span>$0</span><span>$1,000</span><span>$2,000</span></div>
    </div>

    <div class="limit-card" style="margin-top:14px">
      <div class="limit-row">
        <div class="meta"><b>Online & contactless</b><span>Card-not-present + tap-to-pay</span></div>
        <div class="limit-val">$${fmt(L.online)}<small>per day</small></div>
      </div>
      <input type="range" min="0" max="10000" step="100" value="${L.online}" class="slider" id="lOnline" />
      <div class="slider-ticks"><span>$0</span><span>$5,000</span><span>$10,000</span></div>
    </div>

    <div class="list" style="margin-top:14px">
      <div class="li" onclick="toggleLimitFlag('contactless', this)">
        <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 12 a9 9 0 0 1 18 0"/><path d="M6 12 a6 6 0 0 1 12 0"/><path d="M9 12 a3 3 0 0 1 6 0"/></svg></span>
        <div class="li-meta"><b>Contactless payments</b><span>Apple Pay, Google Pay, tap-to-pay</span></div>
        <div class="switch ${L.contactless?'on':''}" data-flag="contactless"></div>
      </div>
      <div class="li" onclick="toggleLimitFlag('magstripe', this)">
        <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11 H22"/></svg></span>
        <div class="li-meta"><b>Magnetic stripe</b><span>Less secure — leave off unless needed</span></div>
        <div class="switch ${L.magstripe?'on':''}" data-flag="magstripe"></div>
      </div>
    </div>

    <div style="padding:18px 16px 36px"><button class="btn btn-primary" onclick="saveLimits()">Save limits</button></div>
  `;
  // wire sliders
  ['lDaily','lATM','lOnline'].forEach(id => {
    const inp = document.getElementById(id);
    const upd = () => {
      const max = +inp.max, min = +inp.min, val = +inp.value;
      inp.style.setProperty('--p', ((val-min)/(max-min)*100).toFixed(1)+'%');
      const valEl = inp.previousElementSibling.querySelector('.limit-val');
      valEl.firstChild.nodeValue = '$'+fmt(val);
    };
    inp.addEventListener('input', upd);
    upd();
  });
}
function toggleLimitFlag(flag, el){
  const sw = el.querySelector('.switch');
  state.cardLimits[flag] = !state.cardLimits[flag];
  sw.classList.toggle('on', state.cardLimits[flag]);
  saveState();
}
function saveLimits(){
  state.cardLimits.daily  = +document.getElementById('lDaily').value;
  state.cardLimits.atm    = +document.getElementById('lATM').value;
  state.cardLimits.online = +document.getElementById('lOnline').value;
  saveState();
  updateCardSummaries();
  toast('Limits updated');
  back('cardLimits','cards');
}
function updateCardSummaries(){
  const L = state.cardLimits;
  const r = document.getElementById('ctrlLimitSummary');
  if(r) r.textContent = `$${fmt(L.daily)} daily · $${fmt(L.atm)} ATM`;
  const i = document.getElementById('ctrlIntlSummary');
  if(i){
    const allowed = state.cardRegions.filter(x=>x.allowed).length;
    i.textContent = allowed === 0 ? 'Disabled — US only' : `Allowed in ${allowed} region${allowed===1?'':'s'}`;
  }
}

/* ============================================================
   CARD INTERNATIONAL
   ============================================================ */
function openCardInternational(){
  renderRegions();
  go('cardInternational');
}
function renderRegions(){
  const list = document.getElementById('regionsList');
  list.innerHTML = state.cardRegions.map(r => `
    <div class="region-row" onclick="toggleRegion('${r.id}', this)">
      <div class="region-flag">${r.id.toUpperCase()}</div>
      <div class="region-meta"><b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.sub)}</span></div>
      <div class="switch ${r.allowed?'on':''}"></div>
    </div>
  `).join('');
}
function toggleRegion(id, el){
  const r = state.cardRegions.find(x => x.id === id); if(!r) return;
  r.allowed = !r.allowed;
  el.querySelector('.switch').classList.toggle('on', r.allowed);
  saveState(); updateCardSummaries();
}
function travelNoticeFlow(){
  document.getElementById('sheetTitle').textContent = 'File a travel notice';
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:13.5px;color:var(--muted);font-weight:500;margin:0 0 14px;line-height:1.5">Tell us where you'll be using your card so legitimate purchases aren't declined.</p>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Destination</div><input class="field" id="trvDest" placeholder="Country or region" /></div>
    <div class="field-row" style="margin-bottom:14px">
      <div class="form-section" style="margin:0"><div class="form-label">Start</div><input class="field" type="date" id="trvStart" /></div>
      <div class="form-section" style="margin:0"><div class="form-label">End</div><input class="field" type="date" id="trvEnd" /></div>
    </div>
    <button class="btn btn-primary" onclick="submitTravelNotice()">Submit notice</button>
  `;
  openSheetRaw();
}
function submitTravelNotice(){
  const dest = document.getElementById('trvDest').value.trim();
  if(!dest){ toast('Add a destination'); return; }
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Travel notice filed', body:`We'll keep purchases to ${dest} active.`, ts:Date.now() });
  saveState();
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Travel notice on file</div>
      <div class="success-meta">Bon voyage, ${escapeHtml(state.user.name)}.</div>
      <div style="margin-top:24px"><button class="btn btn-primary" onclick="closeSheet()">Done</button></div>
    </div>
  `;
  renderHome(); renderNotifications();
}

/* ============================================================
   REPORT LOST / STOLEN
   ============================================================ */
let reportReason = null;
function openCardReport(){
  reportReason = null;
  renderReportStep1();
  go('cardReport');
}
function renderReportStep1(){
  document.getElementById('reportBody').innerHTML = `
    <div style="padding:6px 16px 4px"><p style="font-size:13.5px;color:var(--muted);font-weight:500;line-height:1.5">We'll freeze your card immediately and send a replacement to the address on file.</p></div>
    <div class="list">
      <div class="li" onclick="reportReason='lost';renderReportStep2()">
        <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><path d="m21 21 -4.3 -4.3"/></svg></span>
        <div class="li-meta"><b>I lost my card</b><span>I might still find it</span></div>
        <span class="li-trail">›</span>
      </div>
      <div class="li" onclick="reportReason='stolen';renderReportStep2()">
        <span class="li-icon" style="color:var(--red);background:rgba(200,50,44,.1)"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9 V13 M12 17 V17.01"/><path d="M10.29 3.86 L1.82 18 a2 2 0 0 0 1.71 3 H20.47 a2 2 0 0 0 1.71 -3 L13.71 3.86 a2 2 0 0 0 -3.42 0z"/></svg></span>
        <div class="li-meta"><b style="color:var(--red)">My card was stolen</b><span>Cancel and reissue</span></div>
        <span class="li-trail">›</span>
      </div>
      <div class="li" onclick="reportReason='damaged';renderReportStep2()">
        <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11 H22 M9 19 L15 19"/></svg></span>
        <div class="li-meta"><b>My card is damaged</b><span>Won't read or has cracks</span></div>
        <span class="li-trail">›</span>
      </div>
    </div>
  `;
}
function renderReportStep2(){
  const stolen = reportReason === 'stolen';
  const reasonText = reportReason === 'lost' ? 'lost' : reportReason === 'stolen' ? 'stolen' : 'damaged';
  document.getElementById('reportBody').innerHTML = `
    <div style="padding:18px 22px 4px;text-align:center">
      <div style="width:64px;height:64px;border-radius:50%;background:${stolen?'rgba(200,50,44,.12)':'rgba(11,51,88,.08)'};display:grid;place-items:center;color:${stolen?'var(--red)':'var(--navy)'};margin:0 auto 12px">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="6" width="20" height="13" rx="2"/><path d="M2 11 H22"/></svg>
      </div>
      <h2 style="font-family:var(--serif);font-weight:600;font-size:22px;letter-spacing:-.02em;margin:0;color:var(--ink)">Confirm card report</h2>
      <p style="font-size:13.5px;color:var(--muted);font-weight:500;margin:8px auto 0;max-width:300px;line-height:1.5">By confirming, we will <b style="color:var(--ink)">${stolen?'cancel':'freeze'}</b> your Meridian Reserve •• 9045 ${reasonText} card and ship a new one to <b style="color:var(--ink)">142 N Greenfield Rd, Newark, DE 19711</b>.</p>
    </div>

    <div class="list" style="margin:14px 16px">
      <div class="kv-row" style="padding:14px 16px"><span class="lbl">Reason</span><span class="val">${escapeHtml(reasonText)}</span></div>
      <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">New card arrives</span><span class="val">${stolen?'Today via courier':'3–5 business days'}</span></div>
      <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Replacement fee</span><span class="val" style="color:var(--pos)">$0.00</span></div>
      <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Recurring charges</span><span class="val">Auto-updated</span></div>
    </div>

    <div style="padding:14px 16px 36px;display:flex;flex-direction:column;gap:10px">
      <button class="btn ${stolen?'btn-danger':'btn-primary'}" onclick="confirmCardReport()">${stolen?'Cancel and reissue':'Freeze and reissue'}</button>
      <button class="btn btn-ghost" onclick="renderReportStep1()">Change reason</button>
    </div>
  `;
}
function confirmCardReport(){
  state.freezeOn = true;
  document.getElementById('freezeStatus').textContent = 'Card is frozen — purchases declined';
  document.getElementById('freezeSwitch').classList.add('on');
  const id = 'rpl-'+Date.now();
  state.cardReplacements.unshift({ id, reason:reportReason, ordered:new Date().toISOString().slice(0,10) });
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Card replacement ordered', body:`Your new Meridian debit card is on its way.`, ts:Date.now() });
  saveState();
  document.getElementById('reportBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Card report filed</div>
      <div class="success-meta">Replacement arrives ${reportReason==='stolen'?'today by courier':'in 3–5 business days'}.<br/>Confirmation #${id.toUpperCase()}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px;padding:0 16px">
        <button class="btn btn-primary" onclick="openCardTracker('${id}')">Track replacement</button>
        <button class="btn btn-ghost" onclick="back('cardReport','cards')">Done</button>
      </div>
    </div>
  `;
  renderTrackerBannerOnCards();
  renderHome(); renderNotifications();
}
function renderTrackerBannerOnCards(){
  const slot = document.getElementById('trackerBannerSlot');
  if(!slot) return;
  const r = state.cardReplacements[0];
  if(!r){ slot.innerHTML = ''; return; }
  slot.innerHTML = `
    <div class="tracker-banner" onclick="openCardTracker('${r.id}')">
      <div class="ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16 V8 a2 2 0 0 0 -1 -1.73 L13 2.27 a2 2 0 0 0 -2 0 L4 6.27 A2 2 0 0 0 3 8 v8 a2 2 0 0 0 1 1.73 l7 4 a2 2 0 0 0 2 0 l7 -4 A2 2 0 0 0 21 16 z"/></svg></div>
      <div class="meta"><b>Replacement card on the way</b><span>Tap to track delivery</span></div>
      <span style="color:var(--muted)"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
    </div>
  `;
}

/* ============================================================
   STATEMENT VIEWER (sheet)
   ============================================================ */
function openStatement(year, month){
  const acct = accountById(activeId) || state.accounts[0];
  const start = +new Date(year, month, 1), end = +new Date(year, month + 1, 1);
  const txs = (state.txByAccount[acct.id] || []).filter(t => t.ts && t.status !== 'Pending');
  const balAt = ts => acct.balance - txs.filter(t => t.ts >= ts).reduce((s, t) => s + t.amt, 0);
  const inMonth = txs.filter(t => t.ts >= start && t.ts < end).sort((a, b) => a.ts - b.ts);
  const opening = balAt(start), closing = balAt(end);
  const credits = inMonth.filter(t => t.amt > 0).reduce((s, t) => s + t.amt, 0);
  const debits = -inMonth.filter(t => t.amt < 0).reduce((s, t) => s + t.amt, 0);
  const interest = inMonth.filter(t => t.method === 'Interest').reduce((s, t) => s + t.amt, 0);
  const last = new Date(year, month + 1, 0).getDate();
  const label = `${MONTH_LONG[month]} ${year}`;
  const isCC = acct.kind === 'credit';
  const covered = inMonth.length > 0;
  document.getElementById('sheetTitle').textContent = `${label} statement`;
  document.getElementById('sheetBody').innerHTML = `
    <div class="stmt-preview">
      <div class="head">
        <div>
          <div class="brand">Meridian</div>
          <div style="font-size:10.5px;color:#6b7280;letter-spacing:.06em;text-transform:uppercase;margin-top:2px">${isCC ? 'Card statement' : 'Account statement'}</div>
        </div>
        <div class="meta">
          <b>${escapeHtml(displayName(acct))}</b><br/>
          ${escapeHtml(acct.mask)}<br/>
          ${MON[month]} 1 – ${MON[month]} ${last}, ${year}
        </div>
      </div>
      <h4>Summary</h4>
      <div class="summary">
        <div><span>${isCC ? 'Previous balance' : 'Opening balance'}</span><b>${fmtMoney(isCC ? -opening : opening)}</b></div>
        <div><span>${isCC ? 'New balance' : 'Closing balance'}</span><b>${fmtMoney(isCC ? -closing : closing)}</b></div>
        <div><span>${isCC ? 'Payments & credits' : 'Deposits & credits'}</span><b class="pos">+ $${fmt(credits)}</b></div>
        <div><span>${isCC ? 'Purchases' : 'Withdrawals & debits'}</span><b class="neg">– $${fmt(debits)}</b></div>
        <div><span>Fees charged</span><b>$0.00</b></div>
        <div><span>${isCC ? 'Interest charged' : 'Interest earned'}</span><b class="${isCC ? '' : 'pos'}">${isCC ? '$0.00' : '+ $' + fmt(interest)}</b></div>
      </div>
      <h4>Activity</h4>
      ${covered ? `<table>
        <tr><th>Date</th><th>Description</th><th style="text-align:right">Amount</th></tr>
        ${inMonth.slice(0, 14).map(t => `<tr>
          <td>${escapeHtml(t.day)}</td>
          <td class="name">${escapeHtml(t.name)}</td>
          <td class="${t.amt<0?'neg':'pos'}" style="text-align:right">${t.amt<0?'– $':'+ $'}${fmt(Math.abs(t.amt))}</td>
        </tr>`).join('')}
      </table>
      ${inMonth.length > 14 ? `<div style="font-size:10.5px;color:#6b7280;margin-top:6px">+ ${inMonth.length - 14} more transactions in the full PDF</div>` : ''}` :
      `<div style="font-size:11.5px;color:#6b7280;padding:6px 0 2px">Itemized activity for this period is included in the PDF.</div>`}
      <div class="tot"><span>Net change</span><span style="color:${closing - opening >= 0 ? '#0e9f6e' : '#ce2c31'}">${closing - opening >= 0 ? '+ ' : '– '}$${fmt(Math.abs(closing - opening))}</span></div>
    </div>
    <div style="display:flex;gap:10px">
      <button class="btn btn-primary" onclick="closeSheet();toast('${label} statement downloaded')">Download PDF</button>
      <button class="btn btn-ghost" onclick="closeSheet();toast('Statement shared')">Share</button>
    </div>
  `;
  openSheetRaw();
}

/* ============================================================
   SCHEDULED & RECURRING
   ============================================================ */
function renderScheduled(){
  const list = document.getElementById('schList');
  if(!list) return;
  if(!state.scheduledTransfers.length){
    list.innerHTML = '<div class="empty" style="padding:14px 16px">No scheduled transfers.</div>';
  } else {
    list.innerHTML = state.scheduledTransfers.map(s => {
      const from = accountById(s.fromId), to = accountById(s.toId);
      if(!from || !to) return '';
      return `
        <div class="sch-row" onclick="editScheduled('${s.id}')">
          <div class="sch-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2 V6 M8 2 V6 M3 10 H21"/></svg></div>
          <div class="sch-meta">
            <b>${escapeHtml(from.name.split(' ')[0])} → ${escapeHtml(to.name.split(' ')[0])}</b>
            <span>${escapeHtml(s.freq[0].toUpperCase()+s.freq.slice(1))} · next ${escapeHtml(s.nextDate)}${s.memo?' · '+escapeHtml(s.memo):''}</span>
          </div>
          <div class="sch-amt">$${fmt(s.amount)}<small>upcoming</small></div>
        </div>
      `;
    }).join('');
  }
  const bills = document.getElementById('schBills');
  if(bills){
    const auto = state.payees.filter(p => p.autopay);
    if(!auto.length){ bills.innerHTML = '<div class="empty" style="padding:14px 16px">No autopay bills.</div>'; }
    else {
      bills.innerHTML = auto.map(p => `
        <div class="sch-row" onclick="openPayeeFlow('${p.id}');go('payBill')">
          <div class="payee-logo" style="background:${p.logoColor};width:42px;height:42px;border-radius:50%;font-size:15px">${escapeHtml(p.name.charAt(0))}</div>
          <div class="sch-meta"><b>${escapeHtml(p.name)}</b><span>${escapeHtml(p.category)} · next ${escapeHtml(p.next)}</span></div>
          <div class="sch-amt">$${fmt(p.last)}<small>autopay</small></div>
        </div>
      `).join('');
    }
  }
}
function editScheduled(id){
  const s = state.scheduledTransfers.find(x => x.id === id); if(!s) return;
  document.getElementById('sheetTitle').textContent = 'Edit scheduled transfer';
  const from = accountById(s.fromId), to = accountById(s.toId);
  document.getElementById('sheetBody').innerHTML = `
    <div class="kv-list">
      <div class="kv-row"><span class="lbl">From</span><span class="val">${escapeHtml(from.name)}<span style="color:var(--muted);font-weight:500"> ${escapeHtml(from.mask)}</span></span></div>
      <div class="kv-row"><span class="lbl">To</span><span class="val">${escapeHtml(to.name)}<span style="color:var(--muted);font-weight:500"> ${escapeHtml(to.mask)}</span></span></div>
      <div class="kv-row"><span class="lbl">Amount</span><span class="val">$${fmt(s.amount)}</span></div>
      <div class="kv-row"><span class="lbl">Frequency</span><span class="val">${escapeHtml(s.freq)}</span></div>
      <div class="kv-row"><span class="lbl">Next</span><span class="val">${escapeHtml(s.nextDate)}</span></div>
      <div class="kv-row"><span class="lbl">Memo</span><span class="val">${escapeHtml(s.memo||'—')}</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="runScheduledNow('${id}')">Run now</button>
      <button class="btn btn-ghost" onclick="cancelScheduled('${id}')" style="color:var(--red)">Cancel transfer</button>
    </div>
  `;
  openSheetRaw();
}
function runScheduledNow(id){
  const s = state.scheduledTransfers.find(x => x.id === id); if(!s) return;
  const from = accountById(s.fromId), to = accountById(s.toId);
  from.balance = +(from.balance - s.amount).toFixed(2);
  from.spendable = +(from.spendable - s.amount).toFixed(2);
  to.balance = +(to.balance + s.amount).toFixed(2);
  if(to.kind !== 'credit') to.spendable = +(to.spendable + s.amount).toFixed(2);
  const ts = Date.now();
  state.txByAccount[from.id] = [{ id:'t-sch-'+ts+'-o', ...txStamp(), cat:'Transfer', name:`Transfer to ${to.name.split(' ')[0]}`, sub:s.memo||to.mask, amt:-s.amount, c:2, status:'Posted', loc:{city:'Internal transfer',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[from.id]||[])];
  state.txByAccount[to.id] = [{ id:'t-sch-'+ts+'-i', ...txStamp(), cat:'Transfer', name:`Transfer from ${from.name.split(' ')[0]}`, sub:s.memo||from.mask, amt:+s.amount, c:4, status:'Posted', loc:{city:'Internal transfer',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[to.id]||[])];
  toast('Transfer ran'); closeSheet(); renderHome(); renderScheduled();
}
function cancelScheduled(id){
  if(!confirm('Cancel this scheduled transfer?')) return;
  state.scheduledTransfers = state.scheduledTransfers.filter(s => s.id !== id);
  saveState(); closeSheet(); toast('Scheduled transfer canceled'); renderScheduled(); renderHome();
}

/* ============================================================
   PERSONAL INFO
   ============================================================ */
function openPersonalInfo(){
  renderProfileForm();
  go('personalInfo');
}
function renderProfileForm(){
  const p = state.profile;
  document.getElementById('profileForm').innerHTML = `
    <div class="form-grid">
      <div class="field-group">
        <label>Legal name</label>
        <input class="field" id="pfLegal" value="${escapeHtml(p.legalName)}" />
        <div class="hint">Must match your government ID. Contact us to change.</div>
      </div>
      <div class="field-group">
        <label>Preferred name</label>
        <input class="field" id="pfPref" value="${escapeHtml(p.preferredName)}" />
      </div>
      <div class="field-group">
        <label>Email</label>
        <input class="field" id="pfEmail" type="email" value="${escapeHtml(p.email)}" />
      </div>
      <div class="field-group">
        <label>Mobile phone</label>
        <input class="field" id="pfPhone" type="tel" value="${escapeHtml(p.phone)}" />
      </div>
      <div class="field-group">
        <label>Mailing address</label>
        <textarea class="field" id="pfAddr" rows="3" style="resize:none">${escapeHtml(p.address)}</textarea>
      </div>
      <div class="field-row">
        <div class="field-group">
          <label>Date of birth</label>
          <input class="field" value="${escapeHtml(p.dob)}" disabled />
        </div>
        <div class="field-group">
          <label>SSN</label>
          <input class="field" value="${escapeHtml(p.ssn)}" disabled />
        </div>
      </div>
      <div class="hint" style="margin-top:-4px">DOB and SSN can only be updated in person at a branch.</div>
    </div>
  `;
}
function renderProfileHeader(){
  const legal = state.profile.legalName || state.user.name;
  const set = (id, v) => { const el = document.getElementById(id); if(el) el.textContent = v; };
  set('profileName', legal);
  set('avatar', initials(legal));
  set('homeAvatar', initials(legal));
  set('ccName', legal);
  set('profileSub', `Customer since ${state.accounts[0].opened}`);
  set('appVersion', `Meridian for Web ${APP_VERSION}`);
}
function saveProfile(){
  state.profile.legalName     = document.getElementById('pfLegal').value.trim();
  state.profile.preferredName = document.getElementById('pfPref').value.trim();
  state.profile.email         = document.getElementById('pfEmail').value.trim();
  state.profile.phone         = document.getElementById('pfPhone').value.trim();
  state.profile.address       = document.getElementById('pfAddr').value.trim();
  state.user.name             = state.profile.preferredName || state.user.name;
  state.user.avatar           = initials(state.profile.legalName || state.user.name);
  saveState();
  renderProfileHeader();
  renderHome();
  toast('Profile saved');
  back('personalInfo','profile');
}

/* ============================================================
   LINKED ACCOUNTS
   ============================================================ */
function openLinkedAccounts(){
  renderLinkedList();
  go('linkedAccounts');
}
function renderLinkedList(){
  const list = document.getElementById('linkedList');
  list.innerHTML = state.linkedAccounts.map(a => {
    const tag = a.status === 'verified' ? '<span class="tag green">Verified</span>' : '<span class="tag amber">Verifying</span>';
    return `
      <div class="payee-row" onclick="manageLinked('${a.id}')">
        <div class="payee-logo" style="background:${linkedColor(a.bank)}">${escapeHtml(a.bank.charAt(0))}</div>
        <div class="payee-meta"><b>${escapeHtml(a.bank)} ${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)} · $${fmt(a.balance)} ${tag}</span></div>
        <span style="color:var(--muted)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
      </div>
    `;
  }).join('') || '<div class="empty" style="padding:14px 16px">No linked accounts yet.</div>';
  const sum = document.getElementById('linkedSummary');
  if(sum) sum.textContent = `${state.linkedAccounts.length} external · 1 brokerage`;
}
function linkedColor(bank){
  const map = { Chase:'#1f4570', Vanguard:'#a82420', Coinbase:'#0e7c4a', Fidelity:'#5e3a8c', Schwab:'#0e7c4a' };
  return map[bank] || '#0b3358';
}
function manageLinked(id){
  const a = state.linkedAccounts.find(x => x.id === id); if(!a) return;
  document.getElementById('sheetTitle').textContent = a.bank + ' ' + a.name;
  document.getElementById('sheetBody').innerHTML = `
    <div class="kv-list">
      <div class="kv-row"><span class="lbl">Account</span><span class="val">${escapeHtml(a.mask)}</span></div>
      <div class="kv-row"><span class="lbl">Balance</span><span class="val">$${fmt(a.balance)}</span></div>
      <div class="kv-row"><span class="lbl">Status</span><span class="val">${a.status==='verified'?'<span class="tag green">Verified</span>':'<span class="tag amber">Verifying</span>'}</span></div>
    </div>
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="closeSheet();startTransfer('send')">Transfer to/from</button>
      <button class="btn btn-ghost" onclick="closeSheet();toast('Refreshed')">Refresh balance</button>
      <button class="btn btn-ghost" style="color:var(--red)" onclick="unlinkAccount('${id}')">Unlink account</button>
    </div>
  `;
  openSheetRaw();
}
function unlinkAccount(id){
  if(!confirm('Unlink this account?')) return;
  state.linkedAccounts = state.linkedAccounts.filter(x => x.id !== id); saveState();
  closeSheet(); renderLinkedList(); toast('Account unlinked');
}
function addLinkedAccount(){
  document.getElementById('sheetTitle').textContent = 'Link an external account';
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:13.5px;color:var(--muted);font-weight:500;margin:0 0 12px;line-height:1.5">Search 11,000+ banks. We'll verify with two micro-deposits within 1 business day.</p>
    <input class="field" id="newBankName" placeholder="Search your bank…" />
    <div class="list" style="margin:14px 0 0">
      ${['Chase','Bank of America','Wells Fargo','Citibank','Capital One','Ally Bank','Vanguard','Fidelity','Coinbase'].map(b => `
        <div class="li" onclick="confirmAddLinked('${b}')"><span class="li-icon" style="background:${linkedColor(b)};color:#fff">${b.charAt(0)}</span><div class="li-meta"><b>${b}</b></div><span class="li-trail">›</span></div>
      `).join('')}
    </div>
  `;
  openSheetRaw();
}
function confirmAddLinked(bank){
  const id = 'la-'+Date.now();
  state.linkedAccounts.push({ id, bank, name:'External account', mask:'•• '+Math.floor(Math.random()*9000+1000), balance:0, status:'pending' });
  saveState();
  closeSheet(); renderLinkedList(); toast(bank + ' linked — verifying');
}

/* ============================================================
   BENEFICIARIES
   ============================================================ */
function openBeneficiaries(){
  renderBeneficiaries();
  go('beneficiaries');
}
function renderBeneficiaries(){
  const list = document.getElementById('beneList');
  list.innerHTML = state.beneficiaries.map(b => `
    <div class="payee-row" onclick="editBeneficiary('${b.id}')">
      <div class="payee-logo" style="background:linear-gradient(135deg,var(--navy),var(--navy-3))">${escapeHtml(b.name.charAt(0))}</div>
      <div class="payee-meta"><b>${escapeHtml(b.name)}</b><span>${escapeHtml(b.relation)} · SSN ${escapeHtml(b.ssn)}</span></div>
      <div class="payee-trail"><b>${b.share}%</b><span>share</span></div>
    </div>
  `).join('') || '<div class="empty" style="padding:14px 16px">No beneficiaries.</div>';
  const total = state.beneficiaries.reduce((s,b)=>s+b.share, 0);
  const t = document.getElementById('beneTotal');
  if(t) t.innerHTML = `Total share: <b style="color:${total===100?'var(--pos)':'var(--red)'}">${total}%</b>${total===100?' ✓':' — must be 100%'}`;
  const sm = document.getElementById('beneSummary');
  if(sm) sm.textContent = `${state.beneficiaries.length} on file`;
}
function editBeneficiary(id){
  const b = state.beneficiaries.find(x => x.id === id); if(!b) return;
  document.getElementById('sheetTitle').textContent = 'Edit beneficiary';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Full name</div><input class="field" id="bnName" value="${escapeHtml(b.name)}" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Relation</div><input class="field" id="bnRel" value="${escapeHtml(b.relation)}" /></div>
    <div class="form-section" style="margin-bottom:14px"><div class="form-label">Share (%)</div><input class="field" id="bnShare" type="number" min="0" max="100" value="${b.share}" /></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="saveBeneficiary('${id}')">Save</button>
      <button class="btn btn-ghost" style="color:var(--red)" onclick="removeBeneficiary('${id}')">Remove</button>
    </div>
  `;
  openSheetRaw();
}
function saveBeneficiary(id){
  const b = state.beneficiaries.find(x => x.id === id); if(!b) return;
  b.name = document.getElementById('bnName').value.trim();
  b.relation = document.getElementById('bnRel').value.trim();
  b.share = +document.getElementById('bnShare').value || 0;
  saveState(); closeSheet(); renderBeneficiaries(); toast('Beneficiary updated');
}
function removeBeneficiary(id){
  if(!confirm('Remove this beneficiary?')) return;
  state.beneficiaries = state.beneficiaries.filter(x => x.id !== id); saveState();
  closeSheet(); renderBeneficiaries(); toast('Beneficiary removed');
}
function addBeneficiary(){
  document.getElementById('sheetTitle').textContent = 'Add beneficiary';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Full name</div><input class="field" id="bnName" placeholder="Jane Doe" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Relation</div><input class="field" id="bnRel" placeholder="Spouse, Child, Sibling…" /></div>
    <div class="form-section" style="margin-bottom:14px"><div class="form-label">Share (%)</div><input class="field" id="bnShare" type="number" min="0" max="100" placeholder="0" /></div>
    <button class="btn btn-primary" onclick="addBeneficiarySubmit()">Add</button>
  `;
  openSheetRaw();
}
function addBeneficiarySubmit(){
  const name = document.getElementById('bnName').value.trim();
  const rel  = document.getElementById('bnRel').value.trim();
  const sh   = +document.getElementById('bnShare').value || 0;
  if(!name){ toast('Name required'); return; }
  state.beneficiaries.push({ id:'b-'+Date.now(), name, relation:rel||'—', share:sh, ssn:'•• ----' });
  saveState(); closeSheet(); renderBeneficiaries(); toast('Beneficiary added');
}

/* ============================================================
   NOTIFICATION PREFS
   ============================================================ */
function openNotifPrefs(){
  renderNotifPrefs();
  go('notifPrefs');
}
function renderNotifPrefs(){
  const N = state.notifPrefs;
  const sw = (key,label,sub) => `
    <div class="li" data-key="${key}">
      <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0 -12 0c0 7 -3 9 -3 9 h18s-3 -2 -3 -9"/></svg></span>
      <div class="li-meta"><b>${label}</b><span>${sub}</span></div>
      <div class="switch ${N[key]?'on':''}"></div>
    </div>`;
  document.getElementById('notifPrefsBody').innerHTML = `
    <div class="section-h">Money movement</div>
    <div class="list checkbox-list">
      ${sw('deposits','Deposits','Direct deposits, transfers in')}
      ${sw('withdrawals','Withdrawals','ATM, transfers out, bills')}
      ${sw('lowBalance','Low balance','When checking falls below '+ '$'+fmt(N.lowBalanceThreshold))}
    </div>
    <div class="section-h">Card & security</div>
    <div class="list checkbox-list">
      ${sw('cardActivity','Card activity','Every purchase')}
      ${sw('internationalActivity','International activity','Outside your enabled regions')}
      ${sw('fraudAlerts','Fraud alerts','Critical — always recommended')}
    </div>
    <div class="section-h">Documents & marketing</div>
    <div class="list checkbox-list">
      ${sw('statements','Statement ready','When monthly statements post')}
      ${sw('productUpdates','Product updates','New features and tips')}
      ${sw('marketing','Promotional offers','Personalized deals & rewards')}
    </div>
    <div class="section-h">Channels</div>
    <div class="list checkbox-list">
      ${sw('push','Push','In-app and OS notifications')}
      ${sw('email','Email','Sent to '+escapeHtml(state.profile.email))}
      ${sw('sms','SMS','Text to '+escapeHtml(state.profile.phone))}
    </div>
    <div style="padding:18px 16px 36px"><button class="btn btn-ghost" onclick="resetNotifPrefs()">Reset to defaults</button></div>
  `;
  document.querySelectorAll('#notifPrefsBody .li[data-key]').forEach(el => el.addEventListener('click', ()=>{
    const k = el.dataset.key;
    state.notifPrefs[k] = !state.notifPrefs[k];
    el.querySelector('.switch').classList.toggle('on', state.notifPrefs[k]);
    saveState(); updateNotifSummary();
  }));
}
function resetNotifPrefs(){
  state.notifPrefs = { deposits:true, withdrawals:true, lowBalance:true, lowBalanceThreshold:100, cardActivity:true, internationalActivity:true, fraudAlerts:true, statements:true, marketing:false, productUpdates:true, push:true, email:true, sms:false };
  saveState(); renderNotifPrefs(); toast('Reset to defaults');
}
function updateNotifSummary(){
  const N = state.notifPrefs;
  const ch = ['push','email','sms'].filter(k => N[k]);
  const el = document.getElementById('notifPrefSummary');
  if(el) el.textContent = ch.length ? `Via ${ch.join(', ')}` : 'All notifications off';
}

/* ============================================================
   LANGUAGE
   ============================================================ */
const LANGS = [
  { id:'en-US', name:'English', sub:'United States' },
  { id:'en-GB', name:'English', sub:'United Kingdom' },
  { id:'es-US', name:'Español', sub:'Estados Unidos' },
  { id:'fr-CA', name:'Français', sub:'Canada' },
  { id:'pt-BR', name:'Português', sub:'Brasil' },
  { id:'zh-CN', name:'中文', sub:'简体' },
  { id:'ja-JP', name:'日本語', sub:'日本' },
];
function openLanguage(){
  document.getElementById('langList').innerHTML = LANGS.map(l => `
    <div class="li" onclick="setLanguage('${l.id}','${escapeHtml(l.name)}')">
      <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12 H22 M12 2 a15 15 0 0 1 0 20 a15 15 0 0 1 0 -20"/></svg></span>
      <div class="li-meta"><b>${escapeHtml(l.name)}</b><span>${escapeHtml(l.sub)}</span></div>
      <span class="li-trail">${state.language===l.id?'✓':''}</span>
    </div>
  `).join('');
  go('language');
}
function setLanguage(id, name){
  state.language = id; saveState();
  const el = document.getElementById('langLabel');
  if(el) el.textContent = name + ' (' + id.split('-')[1] + ')';
  toast('Language updated');
  back('language','profile');
}

/* ============================================================
   AUTO SIGN-OUT
   ============================================================ */
function openAutoSignOut(){
  const opts = [1, 5, 10, 15, 30];
  document.getElementById('signOutList').innerHTML = opts.map(m => `
    <div class="li" onclick="setSignOut(${m})">
      <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6 V12 L16 14"/></svg></span>
      <div class="li-meta"><b>After ${m} minute${m===1?'':'s'}</b></div>
      <span class="li-trail">${state.signOutAfter===m?'✓':''}</span>
    </div>
  `).join('');
  go('autoSignOut');
}
function setSignOut(m){
  state.signOutAfter = m; saveState();
  const el = document.getElementById('signOutMeta');
  if(el) el.textContent = `After ${m} minute${m===1?'':'s'}`;
  back('autoSignOut','profile');
  resetIdleTimer();
}

/* ============================================================
   IDLE TIMER (auto sign-out)
   ============================================================ */
let idleTimer = null;
function resetIdleTimer(){
  clearTimeout(idleTimer);
  if(!state.signedIn || current === 'lock') return;
  idleTimer = setTimeout(()=>{
    state.signedIn = false; saveState();
    toast('Signed out for security');
    lockShow();
  }, state.signOutAfter * 60 * 1000);
}
['click','touchstart','keydown','scroll'].forEach(ev => document.addEventListener(ev, resetIdleTimer, { passive:true }));

/* ============================================================
   FACE ID TOGGLE / PASSCODE CHANGE
   ============================================================ */
async function toggleFaceId(el){
  const sw    = document.getElementById('bioSwitch');
  const label = document.getElementById('bioLabel');
  const turningOn = !state.bioEnabled;

  if(turningOn){
    if(!webAuthnAvailable()){
      toast('Face ID isn’t supported on this device');
      return;
    }
    const supported = await platformAuthenticatorAvailable();
    if(!supported){
      toast('No Face ID, Touch ID, or fingerprint reader found');
      return;
    }
    if(label) label.textContent = 'Setting up…';
    try {
      await registerBiometric();
      state.bioEnabled = true; saveState();
      if(sw) sw.classList.add('on');
      if(label) label.textContent = 'Enabled';
      toast('Face ID enabled');
    } catch (err){
      if(label) label.textContent = state.bioEnabled ? 'Enabled' : 'Disabled';
      const name = err && err.name;
      if(name === 'NotAllowedError' || name === 'AbortError'){
        toast('Face ID setup canceled');
      } else if(name === 'InvalidStateError'){
        toast('A credential is already registered for this site');
      } else {
        toast('Couldn’t enable Face ID — try again');
      }
    }
    return;
  }

  // Turning off
  state.bioEnabled = false;
  state.bioCredentialId = null;
  saveState();
  if(sw) sw.classList.remove('on');
  if(label) label.textContent = 'Disabled';
}
function changePasscode(){
  if(!confirm('Set a new 6-digit passcode?')) return;
  state.pin = null; state.passcodeChangedAt = new Date().toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'});
  saveState();
  const m = document.getElementById('passcodeMeta');
  if(m) m.textContent = 'Last changed ' + state.passcodeChangedAt;
  lockShow();
}

/* ============================================================
   HELP ARTICLES
   ============================================================ */
const ARTICLES = {
  disputes: {
    title:'Disputes & fraud',
    crumb:'Card management',
    read:'4 min read',
    body:`
      <p>If you spot a charge you didn't make or that doesn't match what you expected, file a dispute right from the transaction screen. Most cases close within 10 business days, and we'll provisionally credit eligible disputes within 24 hours.</p>
      <h3>Before you dispute</h3>
      <ul>
        <li>Try the merchant first — many issues are resolved faster directly.</li>
        <li>Check whether you're sharing the card with anyone (subscriptions in another household member's name often look unfamiliar).</li>
        <li>Have your statement and any communications ready.</li>
      </ul>
      <div class="article-callout"><b>Heads up:</b> if you suspect your card was compromised, freeze it first from the Cards tab, then file the dispute.</div>
      <h3>What we'll need</h3>
      <ul>
        <li>The transaction date and amount</li>
        <li>Your dispute reason (we'll prompt you)</li>
        <li>Any supporting receipts or messages</li>
      </ul>
      <h3>How long it takes</h3>
      <p>Most disputes resolve in 7–10 business days. Complex chargebacks (e.g., goods not received) can take up to 90 days under federal rules. You'll see updates in this app and by email.</p>
    `
  },
  taxes: {
    title:'Statements & taxes',
    crumb:'Documents',
    read:'3 min read',
    body:`
      <p>Your monthly statements live in <b>Activity → Statements</b>. We keep 7 years online and can ship paper copies on request.</p>
      <h3>Tax documents</h3>
      <ul>
        <li><b>1099-INT</b> — interest of $10 or more from your savings account, posted by January 31.</li>
        <li><b>1099-MISC</b> — referral bonuses or other miscellaneous income above $600.</li>
        <li><b>1098</b> — only mailed if you have a Meridian mortgage (not currently available).</li>
      </ul>
      <h3>Going paperless</h3>
      <p>Tap your profile → Notifications → toggle off "Statement ready" — and we'll keep delivering them inside the app, just not by mail.</p>
      <div class="article-callout">Need a statement printed and notarized? Visit any branch with a valid ID.</div>
    `
  }
};
function openArticle(id){
  const a = ARTICLES[id]; if(!a) return;
  document.getElementById('articleTitle').textContent = a.title.length > 22 ? a.title.slice(0,22)+'…' : a.title;
  document.getElementById('helpArticleBody').innerHTML = `
    <div class="article-hero">
      <div class="breadcrumb">${escapeHtml(a.crumb)}</div>
      <h2>${escapeHtml(a.title)}</h2>
      <div class="meta">${escapeHtml(a.read)} · Updated ${escapeHtml(state.passcodeChangedAt||'recently')}</div>
    </div>
    <div class="article-body">${a.body}</div>
    <div style="padding:0 22px 36px;display:flex;gap:10px">
      <button class="btn btn-ghost" onclick="toast('Helpful — thanks!')">👍 Helpful</button>
      <button class="btn btn-ghost" onclick="toast('We\\'ll improve this')">👎 Not helpful</button>
    </div>
  `;
  go('helpArticle');
}

/* ============================================================
   STATUS BAR (time + light/dark per screen)
   ============================================================ */
function paintStatusBar(){
  const t = new Date();
  const h = ((t.getHours() + 11) % 12) + 1;
  const m = String(t.getMinutes()).padStart(2,'0');
  const el = document.getElementById('statusTime');
  if(el) el.textContent = `${h}:${m}`;
}
setInterval(paintStatusBar, 30000);
const LIGHT_BAR_SCREENS = new Set(['lock','splash']);
function updateStatusBarTone(){
  const frame = document.getElementById('frame');
  // status bar visible after splash
  frame.classList.toggle('no-bar', current === 'splash');
  // light text on dark backgrounds (only the lock screen has full-bleed dark)
  frame.classList.toggle('light-bar', LIGHT_BAR_SCREENS.has(current));
  syncTabbar();
  if(current === 'cards') renderCardsScreen();
}

/* hook into go/back to update tone */
const _go = go, _back = back;
go = function(toId){ _go(toId); updateStatusBarTone(); paintStatusBar(); };
back = function(fromId, toId){ _back(fromId, toId); updateStatusBarTone(); paintStatusBar(); };

/* ============================================================
   LAST-UPDATED STAMP
   ============================================================ */
let lastUpdated = Date.now();
function fmtAgo(ms){
  const s = Math.round(ms/1000);
  if(s < 5) return 'just now';
  if(s < 60) return s+'s ago';
  const mn = Math.round(s/60);
  if(mn < 60) return mn+' min ago';
  const h = Math.round(mn/60);
  if(h < 24) return h+'h ago';
  return Math.round(h/24)+'d ago';
}
function tickUpdated(){
  const el = document.getElementById('homeUpdated');
  if(el) el.textContent = 'Updated ' + fmtAgo(Date.now() - lastUpdated);
}
setInterval(tickUpdated, 15000);

/* ============================================================
   PULL-TO-REFRESH
   ============================================================ */
function attachPTR(scrollId, ptrId, onRefresh){
  const sc = document.getElementById(scrollId);
  const ptr = document.getElementById(ptrId);
  if(!sc || !ptr) return;
  let startY = 0, pulling = false, refreshing = false, distance = 0;
  const THRESHOLD = 70, MAX = 130;
  const inner = ptr.querySelector('.ptr-inner');
  const label = ptr.querySelector('.ptr-label');
  sc.addEventListener('touchstart', e => {
    if(refreshing) return;
    if(sc.scrollTop > 0){ pulling = false; return; }
    pulling = true; startY = e.touches[0].clientY; distance = 0;
  }, { passive:true });
  sc.addEventListener('touchmove', e => {
    if(!pulling || refreshing) return;
    const dy = e.touches[0].clientY - startY;
    if(dy <= 0){ ptr.classList.remove('pulling'); return; }
    distance = Math.min(MAX, dy * 0.55);
    ptr.classList.add('pulling');
    ptr.style.setProperty('--pull', distance + 'px');
    sc.style.transform = `translateY(${distance*0.6}px)`;
    sc.style.transition = 'none';
    label.textContent = distance >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
  }, { passive:true });
  const finish = () => {
    if(!pulling) return;
    pulling = false;
    sc.style.transition = 'transform .25s ease';
    sc.style.transform = '';
    if(distance >= THRESHOLD){
      refreshing = true; ptr.classList.remove('pulling'); ptr.classList.add('refreshing');
      label.textContent = 'Updating…';
      Promise.resolve(onRefresh && onRefresh()).then(()=> new Promise(r => setTimeout(r, 700))).then(()=>{
        ptr.classList.remove('refreshing');
        refreshing = false;
        lastUpdated = Date.now(); tickUpdated();
        toast('Up to date');
      });
    } else {
      ptr.classList.remove('pulling');
    }
  };
  sc.addEventListener('touchend', finish);
  sc.addEventListener('touchcancel', finish);
}

/* mouse fallback so it's testable on desktop too */
function attachPTRMouse(scrollId, ptrId, onRefresh){
  const sc = document.getElementById(scrollId);
  const ptr = document.getElementById(ptrId);
  if(!sc || !ptr) return;
  let startY = 0, dragging = false, distance = 0, refreshing = false;
  const THRESHOLD = 70, MAX = 130;
  const inner = ptr.querySelector('.ptr-inner');
  const label = ptr.querySelector('.ptr-label');
  sc.addEventListener('mousedown', e => {
    if(refreshing || sc.scrollTop > 0) return;
    dragging = true; startY = e.clientY; distance = 0;
  });
  window.addEventListener('mousemove', e => {
    if(!dragging) return;
    const dy = e.clientY - startY;
    if(dy <= 0){ ptr.classList.remove('pulling'); return; }
    distance = Math.min(MAX, dy * 0.55);
    ptr.classList.add('pulling');
    ptr.style.setProperty('--pull', distance + 'px');
    sc.style.transform = `translateY(${distance*0.6}px)`; sc.style.transition = 'none';
    label.textContent = distance >= THRESHOLD ? 'Release to refresh' : 'Pull to refresh';
  });
  window.addEventListener('mouseup', () => {
    if(!dragging) return;
    dragging = false;
    sc.style.transition = 'transform .25s ease';
    sc.style.transform = '';
    if(distance >= THRESHOLD){
      refreshing = true; ptr.classList.remove('pulling'); ptr.classList.add('refreshing');
      label.textContent = 'Updating…';
      Promise.resolve(onRefresh && onRefresh()).then(()=> new Promise(r => setTimeout(r, 700))).then(()=>{
        ptr.classList.remove('refreshing'); refreshing = false;
        lastUpdated = Date.now(); tickUpdated();
        toast('Up to date');
      });
    } else { ptr.classList.remove('pulling'); }
  });
}

/* ============================================================
   SKELETON LOADERS
   ============================================================ */
function showSkelAccounts(){
  const list = document.getElementById('accountsList');
  if(!list) return;
  list.innerHTML = Array.from({length:4}).map(()=>`
    <div class="skel-row"><span class="skel skel-ic"></span><div class="skel-meta"><span class="skel"></span><span class="skel"></span></div><span class="skel skel-amt"></span></div>
  `).join('');
}
function showSkelTx(){
  const list = document.getElementById('txList');
  if(!list) return;
  list.innerHTML = Array.from({length:6}).map(()=>`
    <div class="skel-tx">
      <span class="skel skel-ic"></span>
      <div class="skel-meta"><span class="skel"></span><span class="skel"></span></div>
      <span class="skel skel-amt"></span>
    </div>
  `).join('');
}

/* ============================================================
   RUNNING BALANCE
   ============================================================ */
function computeRunningBalances(acctId){
  const acct = accountById(acctId);
  if(!acct) return {};
  const txs = (state.txByAccount[acctId] || []).filter(t => !(state.txOverrides[t.id]?.hidden));
  /* tx are stored newest-first; we walk newest-first and treat current acct.balance
     as the post-most-recent-posted balance, then subtract back as we go.  */
  const map = {};
  let running = acct.balance;
  for(let i = 0; i < txs.length; i++){
    const t = txs[i];
    map[t.id] = running;
    running = +(running - t.amt).toFixed(2);
  }
  return map;
}

/* ============================================================
   GOAL CARD (vacation fund etc.)
   ============================================================ */
function renderGoalSlot(id){
  const slot = document.getElementById('goalSlot');
  if(!slot) return;
  const a = accountById(id);
  if(!a || !a.goal){ slot.innerHTML = ''; return; }
  const cur = a.aside || a.balance;
  const pct = Math.max(0, Math.min(100, Math.round((cur / a.goal) * 100)));
  const r = 36, c = 2*Math.PI*r;
  const dash = c, off = c - (pct/100)*c;
  // ETA estimate based on average of last 3 contributions
  const ins = (state.txByAccount[id]||[]).filter(t => t.amt > 0).slice(0,3);
  const avg = ins.length ? ins.reduce((s,t)=>s+t.amt,0)/ins.length : 100;
  const remaining = Math.max(0, a.goal - cur);
  const months = avg > 0 ? Math.ceil(remaining / avg) : 0;
  slot.innerHTML = `
    <div class="goal-card">
      <div class="goal-ring">
        <svg width="84" height="84" viewBox="0 0 84 84">
          <circle class="track" cx="42" cy="42" r="${r}"/>
          <circle class="fill" cx="42" cy="42" r="${r}" stroke-dasharray="${dash}" stroke-dashoffset="${off}"/>
        </svg>
        <div class="pct">${pct}%</div>
      </div>
      <div class="goal-meta">
        <b>${escapeHtml(a.name)}</b>
        <div class="sub">${remaining > 0 ? `$${fmt(remaining)} to go` : 'Goal reached 🎉'}${months > 0 ? ` · ETA ~${months} mo` : ''}</div>
        <div class="nums">$${fmt(cur)} <em>of $${fmt(a.goal)}</em></div>
        <div class="goal-actions">
          <button class="primary" onclick="contributeGoal('${id}')">Contribute</button>
          <button onclick="editGoal('${id}')">Edit goal</button>
        </div>
      </div>
    </div>
  `;
}
function contributeGoal(id){
  const a = accountById(id);
  document.getElementById('sheetTitle').textContent = 'Add to ' + a.name;
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:13px;color:var(--muted);font-weight:500;margin:0 0 12px">Move money from another account into this goal.</p>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Amount</div><div class="amount-input" style="padding:14px"><span class="currency">$</span><input type="text" inputmode="decimal" id="gAmt" placeholder="0.00" /></div></div>
    <div class="recur-row" style="margin-bottom:12px">
      <button class="opt" onclick="document.getElementById('gAmt').value='25';">$25</button>
      <button class="opt" onclick="document.getElementById('gAmt').value='50';">$50</button>
      <button class="opt" onclick="document.getElementById('gAmt').value='100';">$100</button>
      <button class="opt" onclick="document.getElementById('gAmt').value='250';">$250</button>
    </div>
    <button class="btn btn-primary" onclick="submitGoalContribution('${id}')">Add now</button>
  `;
  openSheetRaw();
}
function submitGoalContribution(id){
  const a = accountById(id);
  const v = parseFloat(document.getElementById('gAmt').value || 0);
  if(!(v > 0)){ toast('Enter an amount'); return; }
  const from = state.accounts.find(x => x.id !== id && x.kind === 'checking');
  if(from.balance < v){ toast('Not enough in '+from.name); return; }
  from.balance = +(from.balance - v).toFixed(2);
  from.spendable = +(from.spendable - v).toFixed(2);
  a.balance = +(a.balance + v).toFixed(2);
  a.aside = +((a.aside||0) + v).toFixed(2);
  const ts = Date.now();
  state.txByAccount[from.id] = [{ id:'t-gl-'+ts+'-o', ...txStamp(), cat:'Transfer', name:'Transfer to '+a.name.split(' ')[0], sub:'Goal contribution', amt:-v, c:2, status:'Posted', loc:{city:'Internal transfer',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[from.id]||[])];
  state.txByAccount[id] = [{ id:'t-gl-'+ts+'-i', ...txStamp(), cat:'Transfer', name:'Goal contribution', sub:from.mask, amt:+v, c:4, status:'Posted', loc:{city:'Internal transfer',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[id]||[])];
  saveState();
  closeSheet();
  renderGoalSlot(id);
  renderHome();
  if(activeId === id) renderTransactions(id);
  toast(`+$${fmt(v)} to ${a.name}`);
}
function editGoal(id){
  const a = accountById(id);
  document.getElementById('sheetTitle').textContent = 'Edit goal';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Goal amount</div><input class="field" id="gGoal" type="number" min="100" step="50" value="${a.goal}" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Goal name</div><input class="field" id="gName" value="${escapeHtml(a.name)}" /></div>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="saveGoal('${id}')">Save</button>
      <button class="btn btn-ghost" style="color:var(--red)" onclick="removeGoal('${id}')">Remove goal</button>
    </div>
  `;
}
function saveGoal(id){
  const a = accountById(id);
  a.goal = +document.getElementById('gGoal').value || a.goal;
  a.name = document.getElementById('gName').value.trim() || a.name;
  saveState(); closeSheet(); renderGoalSlot(id);
  if(activeId === id) document.getElementById('detailTitle').textContent = a.name + ' ' + a.mask;
  toast('Goal updated');
}
function removeGoal(id){
  if(!confirm('Remove the goal target on this account?')) return;
  const a = accountById(id); delete a.goal; saveState();
  closeSheet(); renderGoalSlot(id);
}

/* ============================================================
   SUBSCRIPTIONS DETECTOR
   ============================================================ */
const SUB_PATTERNS = [
  { match:/spotify/i,  name:'Spotify',  cat:'Music',     color:'#15803d', cycle:'monthly' },
  { match:/netflix/i,  name:'Netflix',  cat:'Streaming', color:'#b91c1c', cycle:'monthly' },
  { match:/audible/i,  name:'Audible',  cat:'Audio',     color:'#d97706', cycle:'monthly' },
  { match:/icloud/i,   name:'Apple iCloud+', cat:'Cloud storage', color:'#334155', cycle:'monthly' },
  { match:/planet fitness/i, name:'Planet Fitness', cat:'Gym', color:'#7e22ce', cycle:'monthly' },
  { match:/comcast|xfinity/i,    name:'Xfinity',         cat:'Internet & cable', color:'#6d28d9', cycle:'monthly' },
  { match:/verizon/i,            name:'Verizon Wireless',cat:'Mobile',           color:'#cd040b', cycle:'monthly' },
  { match:/geico/i,              name:'GEICO',           cat:'Auto insurance',   color:'#1d4ed8', cycle:'monthly' },
  { match:/capital one auto/i,   name:'Capital One Auto',cat:'Auto loan',        color:'#1e3a8a', cycle:'monthly' },
  { match:/delmarva/i,           name:'Delmarva Power',  cat:'Electric utility', color:'#ca8a04', cycle:'monthly' },
];
function computeSubscriptions(){
  const found = {};
  for(const acctId of Object.keys(state.txByAccount)){
    for(const t of state.txByAccount[acctId]){
      if(t.amt >= 0) continue;
      const p = SUB_PATTERNS.find(p => p.match.test(t.name) || p.match.test(t.sub||''));
      if(!p) continue;
      const k = p.name;
      if(!found[k]){
        found[k] = { ...p, amount: Math.abs(t.amt), lastDay: t.day, account: accountById(acctId)?.mask || '' };
      }
    }
  }
  const list = Object.values(found).sort((a,b)=> b.amount - a.amount);
  const total = list.reduce((s,x)=> s + x.amount, 0);
  return { list, total };
}
function renderSubs(){
  const { list, total } = computeSubscriptions();
  const annual = total * 12;
  document.getElementById('subsHero').innerHTML = `
    <div><div class="lbl">Per month</div><div class="val">$${fmt(total)}</div></div>
    <div class="ins-divider"></div>
    <div><div class="lbl">Per year</div><div class="val">$${fmt(annual)}</div></div>
  `;
  const wrap = document.getElementById('subsList');
  if(!list.length){
    wrap.innerHTML = '<div class="empty" style="padding:20px 16px">No recurring charges detected yet.</div>';
    return;
  }
  wrap.innerHTML = list.map(s => `
    <div class="sub-row" onclick="openSubSheet('${s.name}', ${s.amount}, '${s.cat}', '${s.color}', '${s.lastDay}', '${s.account}')">
      <div class="sub-logo" style="background:${s.color}">${escapeHtml(s.name.charAt(0))}</div>
      <div class="sub-meta"><b>${escapeHtml(s.name)}</b><span>${escapeHtml(s.cat)} · last on ${escapeHtml(s.lastDay)}</span></div>
      <div class="sub-amt"><b>$${fmt(s.amount)}/mo</b><span>$${fmt(s.amount*12)}/yr</span></div>
    </div>
  `).join('');
}
function openSubSheet(name, amount, cat, color, lastDay, account){
  document.getElementById('sheetTitle').textContent = name;
  document.getElementById('sheetBody').innerHTML = `
    <div style="display:flex;align-items:center;gap:14px;padding:6px 0 14px">
      <div class="sub-logo" style="background:${color}">${escapeHtml(name.charAt(0))}</div>
      <div><b style="font-size:16px;color:var(--ink)">${escapeHtml(name)}</b><div style="font-size:12px;color:var(--muted);font-weight:500">${escapeHtml(cat)} · ${escapeHtml(account)}</div></div>
    </div>
    <div class="kv-list">
      <div class="kv-row"><span class="lbl">Monthly</span><span class="val">$${fmt(amount)}</span></div>
      <div class="kv-row"><span class="lbl">Annual</span><span class="val">$${fmt(amount*12)}</span></div>
      <div class="kv-row"><span class="lbl">Last billed</span><span class="val">${escapeHtml(lastDay)}</span></div>
      <div class="kv-row"><span class="lbl">Next bill (est.)</span><span class="val">~${escapeHtml(estimateNext(lastDay))}</span></div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-ghost" onclick="closeSheet();toast('Reminder set for next bill')">Remind me before next bill</button>
      <button class="btn btn-ghost" style="color:var(--red)" onclick="closeSheet();toast('We can\\'t cancel ${escapeHtml(name)} on your behalf — visit their site')">Cancel subscription</button>
    </div>
  `;
  openSheetRaw();
}
function estimateNext(day){
  const m = day && String(day).match(/^([A-Za-z]+)\s+(\d+)$/);
  if(!m) return 'next month';
  const idx = MONTH_IDX.indexOf(m[1].toLowerCase().slice(0,3));
  if(idx < 0) return 'next month';
  let last = new Date(TODAY.getFullYear(), idx, +m[2]);
  if(last > TODAY) last = new Date(TODAY.getFullYear() - 1, idx, +m[2]);
  return fmtMD(new Date(last.getFullYear(), last.getMonth() + 1, last.getDate()));
}

/* ============================================================
   2FA STEP-UP (Face ID / passcode for sensitive actions)
   ============================================================ */
const STEP = { buffer:'', cb:null, fail:null };
function requireStepUp({ reason='Verify it\'s you', allowBio=true, onSuccess, onCancel } = {}){
  STEP.buffer = ''; STEP.cb = onSuccess || null; STEP.fail = onCancel || null;
  document.getElementById('sheetTitle').textContent = 'Verify it\'s you';
  document.getElementById('sheetBody').innerHTML = `
    <div class="stepup-stage">
      <div class="stepup-icon" id="suIcon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">
          <path d="M5 8 V6 a2 2 0 0 1 2 -2 H9 M15 4 H17 a2 2 0 0 1 2 2 V8 M19 16 V18 a2 2 0 0 1 -2 2 H15 M9 20 H7 a2 2 0 0 1 -2 -2 V16"/>
          <path d="M9 10 V11 M15 10 V11 M12 10 V14 M10 17 c1 .8 3 .8 4 0"/>
        </svg>
      </div>
      <h3 class="stepup-title">Verify it's you</h3>
      <div class="stepup-reason">${escapeHtml(reason)}</div>
      <div class="stepup-state" id="suState">${state.bioEnabled && allowBio && webAuthnAvailable() && state.bioCredentialId ? 'Tap below to use Face ID' : 'Enter your passcode'}</div>
      <div class="stepup-actions">
        ${state.bioEnabled && allowBio && webAuthnAvailable() && state.bioCredentialId ? `<button class="btn btn-primary" onclick="stepupFaceId()">Use Face ID</button>` : ''}
        <button class="btn btn-ghost" onclick="stepupShowPin()">Use passcode</button>
        <button class="btn btn-ghost" onclick="stepupCancel()">Cancel</button>
      </div>
      <div class="stepup-pin" id="suPin">
        <div class="pin-dots" id="suDots"><i></i><i></i><i></i><i></i><i></i><i></i></div>
        <div class="pin-grid" id="suGrid">
          ${[1,2,3,4,5,6,7,8,9].map(n=>`<button class="pin-key" data-su="${n}">${n}</button>`).join('')}
          <span></span>
          <button class="pin-key" data-su="0">0</button>
          <button class="pin-key action" data-su="del" aria-label="Delete">⌫</button>
        </div>
      </div>
    </div>
  `;
  // wire pin pad
  document.querySelectorAll('#suGrid [data-su]').forEach(el => el.addEventListener('click', ()=> stepupPress(el.dataset.su)));
  openSheetRaw();
  if(state.bioEnabled && allowBio && webAuthnAvailable() && state.bioCredentialId){
    /* auto-trigger Face ID like a real app does on app/sheet open */
    setTimeout(stepupFaceId, 500);
  } else {
    stepupShowPin();
  }
}
function stepupShowPin(){
  document.getElementById('suPin').classList.add('show');
  document.getElementById('suState').textContent = 'Enter your 6-digit passcode';
}
function stepupPress(k){
  if(k === 'del'){ STEP.buffer = STEP.buffer.slice(0,-1); }
  else if(STEP.buffer.length < 6) STEP.buffer += k;
  document.querySelectorAll('#suDots i').forEach((d,i)=> d.classList.toggle('filled', i < STEP.buffer.length));
  if(STEP.buffer.length === 6) setTimeout(stepupSubmit, 140);
}
function stepupSubmit(){
  if(STEP.buffer === state.pin){ stepupSuccess(); }
  else {
    const dots = document.getElementById('suDots');
    dots.classList.remove('shake'); void dots.offsetWidth; dots.classList.add('shake');
    document.getElementById('suState').classList.add('fail');
    document.getElementById('suState').textContent = 'Incorrect passcode';
    STEP.buffer = ''; setTimeout(()=>{
      document.querySelectorAll('#suDots i').forEach(d=>d.classList.remove('filled'));
    }, 200);
  }
}
async function stepupFaceId(){
  const ic = document.getElementById('suIcon'); if(!ic) return;
  const stateEl = document.getElementById('suState');
  if(!webAuthnAvailable() || !state.bioCredentialId){
    stepupShowPin();
    return;
  }
  ic.classList.add('scanning');
  if(stateEl){ stateEl.classList.remove('fail'); stateEl.textContent = 'Looking for your face…'; }
  try {
    await authenticateBiometric();
    ic.classList.remove('scanning');
    stepupSuccess();
  } catch (err){
    ic.classList.remove('scanning');
    if(!stateEl) return;
    stateEl.classList.add('fail');
    const name = err && err.name;
    if(name === 'NotAllowedError' || name === 'AbortError'){
      stateEl.textContent = 'Face ID canceled — use passcode';
    } else if(name === 'InvalidStateError'){
      stateEl.textContent = 'Not enrolled on this device — use passcode';
    } else {
      stateEl.textContent = 'Face not recognized — try again or use passcode';
    }
  }
}
function stepupSuccess(){
  const st = document.getElementById('suState');
  if(st){ st.classList.remove('fail'); st.classList.add('success'); st.textContent = 'Verified ✓'; }
  if(navigator.vibrate) navigator.vibrate([10, 30, 10]);
  setTimeout(()=>{
    closeSheet();
    const cb = STEP.cb; STEP.cb = null; STEP.fail = null;
    if(cb) cb();
  }, 350);
}
function stepupCancel(){
  closeSheet();
  const f = STEP.fail; STEP.cb = null; STEP.fail = null;
  if(f) f();
}

/* ============================================================
   WIRE TRANSFER
   ============================================================ */
let WIRE = { mode:'dom', fromId:null, recipientId:null, name:'', bank:'', accountOrIban:'', routingOrSwift:'', address:'', country:'United States', amount:'', purpose:'', memo:'' };
function startWire(){
  const ch = state.accounts.find(a => a.kind === 'checking');
  WIRE = { ...WIRE, mode:'dom', fromId:ch.id, recipientId:null, name:'', bank:'', accountOrIban:'', routingOrSwift:'', address:'', country:'United States', amount:'', purpose:'', memo:'' };
  document.querySelectorAll('#wireTabs .seg').forEach(s => s.classList.toggle('active', s.dataset.mode==='dom'));
  document.querySelectorAll('#wireTabs .seg').forEach(s => s.addEventListener('click', ()=>{
    WIRE.mode = s.dataset.mode;
    document.querySelectorAll('#wireTabs .seg').forEach(x => x.classList.toggle('active', x === s));
    renderWireForm();
  }));
  renderWireForm();
  go('wire');
}
function renderWireForm(){
  const intl = WIRE.mode === 'intl';
  const from = accountById(WIRE.fromId);
  const recip = WIRE.recipientId ? state.wireRecipients.find(r => r.id === WIRE.recipientId) : null;
  const fee = intl ? state.wireFees.intl : state.wireFees.dom;
  const amount = parseFloat(WIRE.amount || 0);
  const fx = intl ? +(amount * state.wireFees.fxPct/100).toFixed(2) : 0;
  const total = amount + fee + fx;

  document.getElementById('wireBody').innerHTML = `
    <div class="form" style="padding-top:0">
      <div class="form-section">
        <div class="form-label">From account</div>
        <div class="acct-pick ${pickCls(from)}" onclick="pickWireFromAccount()">
          <div class="swatch"></div>
          <div class="info"><b>${escapeHtml(from.name)}</b><span>${escapeHtml(from.mask)}</span><span class="bal">${fmtMoney(from.balance)} available</span></div>
          <span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
        </div>
      </div>

      <div class="form-section">
        <div class="form-label">Beneficiary</div>
        ${recip ? `
          <div class="payee-row" style="border:1px solid var(--line);border-radius:14px;padding:14px">
            <div class="payee-logo" style="background:linear-gradient(135deg,var(--navy),var(--navy-3))">${escapeHtml(recip.name.charAt(0))}</div>
            <div class="payee-meta"><b>${escapeHtml(recip.name)}</b><span>${escapeHtml(recip.bank)} · ${escapeHtml(recip.account||recip.iban||'')}</span></div>
            <button class="li-trail" style="background:none;border:0;color:var(--navy);font-size:13px;font-weight:700" onclick="WIRE.recipientId=null;renderWireForm()">Change</button>
          </div>
        ` : `
          <div class="acct-pick" onclick="pickWireRecipient()" style="cursor:pointer">
            <div class="swatch" style="background:var(--bg-2);color:var(--navy);display:grid;place-items:center"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="7" r="4"/><path d="M20 21 v-2 a4 4 0 0 0 -4 -4 H8 a4 4 0 0 0 -4 4 v2"/></svg></div>
            <div class="info"><b>Select recipient</b><span>Saved beneficiaries or enter new</span></div>
            <span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
          </div>
        `}
      </div>

      <div class="form-section">
        <div class="form-label">Amount</div>
        <div class="amount-input">
          <span class="currency">$</span>
          <input type="text" inputmode="decimal" id="wireAmt" placeholder="0.00" value="${escapeHtml(WIRE.amount)}" />
        </div>
      </div>

      ${intl ? `
        <div class="form-section">
          <div class="form-label">Purpose of payment</div>
          <select class="field" id="wirePurpose">
            <option value="">Select…</option>
            <option ${WIRE.purpose==='goods'?'selected':''} value="goods">Payment for goods</option>
            <option ${WIRE.purpose==='services'?'selected':''} value="services">Payment for services</option>
            <option ${WIRE.purpose==='family'?'selected':''} value="family">Family support</option>
            <option ${WIRE.purpose==='property'?'selected':''} value="property">Property purchase</option>
            <option ${WIRE.purpose==='other'?'selected':''} value="other">Other</option>
          </select>
        </div>
      ` : ''}

      <div class="form-section">
        <div class="form-label">Reference (sent with wire)</div>
        <input class="field" id="wireMemo" maxlength="35" value="${escapeHtml(WIRE.memo)}" placeholder="Invoice #, contract #, etc." />
      </div>
    </div>

    <div class="wire-fee-card">
      <div class="row"><span>Wire amount</span><b>$${fmt(amount||0)}</b></div>
      <div class="row"><span>Wire fee${intl?' (international)':' (domestic)'}</span><b>$${fmt(fee)}</b></div>
      ${intl ? `<div class="row"><span>Currency conversion (~${state.wireFees.fxPct}%)</span><b>$${fmt(fx)}</b></div>` : ''}
      <div class="row total"><span>Total debit</span><b>$${fmt(total||0)}</b></div>
    </div>

    <div class="wire-cutoff">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6 V12 L16 14"/></svg>
      <div>
        <b>${intl?'Arrives in 1–3 business days':'Same-day if submitted before '+state.wireFees.cutoff}</b>
        <div style="font-weight:500;color:var(--muted);margin-top:2px">${intl?'Currency conversion happens at recipient bank.':'After cutoff, sent next business day.'}</div>
      </div>
    </div>
  `;

  document.getElementById('wireAmt').addEventListener('input', e => {
    let v = e.target.value.replace(/[^0-9.]/g,'');
    const parts = v.split('.'); if(parts.length>2) v = parts[0]+'.'+parts.slice(1).join('');
    if(parts[1] && parts[1].length>2) v = parts[0]+'.'+parts[1].slice(0,2);
    e.target.value = v; WIRE.amount = v;
    renderWireFeeOnly();
    validateWire();
  });
  document.getElementById('wireMemo').addEventListener('input', e => WIRE.memo = e.target.value);
  if(intl){ document.getElementById('wirePurpose').addEventListener('change', e => WIRE.purpose = e.target.value); }
  validateWire();
}
function renderWireFeeOnly(){
  const intl = WIRE.mode === 'intl';
  const fee = intl ? state.wireFees.intl : state.wireFees.dom;
  const amount = parseFloat(WIRE.amount || 0);
  const fx = intl ? +(amount * state.wireFees.fxPct/100).toFixed(2) : 0;
  const total = amount + fee + fx;
  const card = document.querySelector('.wire-fee-card');
  if(!card) return;
  card.querySelectorAll('.row').forEach((r,idx) => {
    const b = r.querySelector('b');
    if(idx === 0) b.textContent = '$' + fmt(amount||0);
    else if(idx === 1) b.textContent = '$' + fmt(fee);
    else if(idx === 2 && intl) b.textContent = '$' + fmt(fx);
    else if(r.classList.contains('total')) b.textContent = '$' + fmt(total||0);
  });
}
function validateWire(){
  const amount = parseFloat(WIRE.amount || 0);
  const from = accountById(WIRE.fromId);
  const intl = WIRE.mode === 'intl';
  const fee = intl ? state.wireFees.intl : state.wireFees.dom;
  const fx = intl ? amount * state.wireFees.fxPct/100 : 0;
  const total = amount + fee + fx;
  const ok = WIRE.recipientId && amount > 0 && total <= from.balance && (!intl || WIRE.purpose);
  document.getElementById('wireReview').disabled = !ok;
}
function pickWireFromAccount(){
  document.getElementById('sheetTitle').textContent = 'Send wire from';
  document.getElementById('sheetBody').innerHTML = state.accounts.filter(a => a.kind !== 'credit').map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" onclick="WIRE.fromId='${a.id}';renderWireForm()">
      <div class="swatch"></div>
      <div class="info"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)}</span><span class="bal">${fmtMoney(a.balance)} available</span></div>
    </div>
  `).join('');
  openSheetRaw();
}
function pickWireRecipient(){
  const intl = WIRE.mode === 'intl';
  const list = state.wireRecipients.filter(r => r.kind === WIRE.mode);
  document.getElementById('sheetTitle').textContent = 'Wire recipient';
  document.getElementById('sheetBody').innerHTML = `
    ${list.length ? `<div class="section-h" style="padding:0 0 6px">Saved</div>` : ''}
    ${list.map(r => `
      <div class="payee-row" style="border:1px solid var(--line);border-radius:12px;margin-bottom:8px;padding:12px" onclick="WIRE.recipientId='${r.id}';closeSheet();renderWireForm()">
        <div class="payee-logo" style="background:linear-gradient(135deg,var(--navy),var(--navy-3))">${escapeHtml(r.name.charAt(0))}</div>
        <div class="payee-meta"><b>${escapeHtml(r.name)}</b><span>${escapeHtml(r.bank)} · ${escapeHtml(r.account||r.iban||'')}</span></div>
      </div>
    `).join('')}
    <div class="add-payee" onclick="newWireRecipient()" style="margin:0">
      <span class="plus">+</span>
      <div><b>New ${intl?'international':'domestic'} recipient</b><span>${intl?'Name, bank, IBAN, SWIFT':'Name, bank, account, routing'}</span></div>
      <span style="margin-left:auto;color:var(--muted)"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
    </div>
  `;
  openSheetRaw();
}
function newWireRecipient(){
  const intl = WIRE.mode === 'intl';
  document.getElementById('sheetTitle').textContent = 'New wire recipient';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Beneficiary name</div><input class="field" id="wrName" placeholder="Full legal name" /></div>
    <div class="form-section" style="margin-bottom:12px"><div class="form-label">Beneficiary bank</div><input class="field" id="wrBank" placeholder="${intl?'Banco Santander':'Wells Fargo'}" /></div>
    ${intl ? `
      <div class="form-section" style="margin-bottom:12px"><div class="form-label">IBAN</div><input class="field" id="wrAcct" placeholder="ES91 2100 0418 4502 0005 1332" /></div>
      <div class="form-section" style="margin-bottom:12px"><div class="form-label">SWIFT / BIC</div><input class="field" id="wrRouting" placeholder="BSCHESMM" /></div>
      <div class="form-section" style="margin-bottom:12px"><div class="form-label">Country</div><input class="field" id="wrCountry" placeholder="Spain" /></div>
    ` : `
      <div class="form-section" style="margin-bottom:12px"><div class="form-label">Account number</div><input class="field" id="wrAcct" /></div>
      <div class="form-section" style="margin-bottom:12px"><div class="form-label">Routing number (ABA)</div><input class="field" id="wrRouting" inputmode="numeric" maxlength="9" /></div>
    `}
    <div class="form-section" style="margin-bottom:14px"><div class="form-label">Beneficiary address</div><textarea class="field" id="wrAddr" rows="2" style="resize:none"></textarea></div>
    <button class="btn btn-primary" onclick="saveWireRecipient(${intl})">Save recipient</button>
  `;
}
function saveWireRecipient(intl){
  const name = document.getElementById('wrName').value.trim();
  const bank = document.getElementById('wrBank').value.trim();
  const acct = document.getElementById('wrAcct').value.trim();
  const route = document.getElementById('wrRouting').value.trim();
  const addr = document.getElementById('wrAddr').value.trim();
  if(!name || !bank || !acct){ toast('Name, bank and account required'); return; }
  const id = 'wr-'+Date.now();
  const rec = { id, kind: intl?'intl':'dom', name, bank, address:addr };
  if(intl){ rec.iban = acct; rec.swift = route; rec.country = document.getElementById('wrCountry').value.trim() || ''; }
  else { rec.account = '•• ' + acct.slice(-4); rec.routing = route; }
  state.wireRecipients.push(rec); saveState();
  WIRE.recipientId = id;
  closeSheet(); renderWireForm(); toast('Recipient saved');
}
function reviewWire(){
  const r = state.wireRecipients.find(x => x.id === WIRE.recipientId); if(!r) return;
  const from = accountById(WIRE.fromId);
  const intl = WIRE.mode === 'intl';
  const amount = parseFloat(WIRE.amount);
  const fee = intl ? state.wireFees.intl : state.wireFees.dom;
  const fx = intl ? +(amount * state.wireFees.fxPct/100).toFixed(2) : 0;
  const total = amount + fee + fx;
  document.getElementById('sheetTitle').textContent = 'Review wire';
  document.getElementById('sheetBody').innerHTML = `
    <div class="review-amount"><span class="cur">$</span>${fmt(amount)}</div>
    <div class="review-row"><span class="lbl">To</span><span class="val">${escapeHtml(r.name)}<span class="sub">${escapeHtml(r.bank)}</span></span></div>
    <div class="review-row"><span class="lbl">${intl?'IBAN':'Account'}</span><span class="val">${escapeHtml(r.iban || r.account || '')}</span></div>
    <div class="review-row"><span class="lbl">${intl?'SWIFT/BIC':'Routing'}</span><span class="val">${escapeHtml(r.swift || r.routing || '')}</span></div>
    ${intl ? `<div class="review-row"><span class="lbl">Country</span><span class="val">${escapeHtml(r.country||'—')}</span></div>` : ''}
    <div class="review-row"><span class="lbl">From</span><span class="val">${escapeHtml(from.name)}<span class="sub">${escapeHtml(from.mask)}</span></span></div>
    <div class="review-row"><span class="lbl">Wire fee</span><span class="val">$${fmt(fee)}</span></div>
    ${intl ? `<div class="review-row"><span class="lbl">FX cost</span><span class="val">$${fmt(fx)}</span></div>` : ''}
    <div class="review-row" style="font-weight:700"><span class="lbl" style="color:var(--ink)">Total debit</span><span class="val">$${fmt(total)}</span></div>
    <div class="review-row"><span class="lbl">Reference</span><span class="val">${escapeHtml(WIRE.memo || '—')}</span></div>
    ${intl ? `<div class="review-row"><span class="lbl">Purpose</span><span class="val">${escapeHtml(WIRE.purpose||'—')}</span></div>` : ''}
    <p style="font-size:11.5px;color:var(--muted);font-weight:500;line-height:1.5;margin:14px 0 6px">Wires are typically <b style="color:var(--ink)">irreversible</b>. Double-check the IBAN/account number — bank names are not validated against the account.</p>
    <div style="display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="confirmWireWithStepUp()">Confirm wire</button>
      <button class="btn btn-ghost" onclick="closeSheet()">Edit</button>
    </div>
  `;
  openSheetRaw();
}
function confirmWireWithStepUp(){
  const amount = parseFloat(WIRE.amount);
  /* always step-up for wires regardless of amount */
  closeSheet();
  setTimeout(()=> requireStepUp({
    reason: `Confirm wire of $${fmt(amount)} to a beneficiary outside Meridian.`,
    onSuccess: doConfirmWire,
    onCancel: ()=> reviewWire()
  }), 320);
}
function doConfirmWire(){
  const r = state.wireRecipients.find(x => x.id === WIRE.recipientId); if(!r) return;
  const from = accountById(WIRE.fromId);
  const intl = WIRE.mode === 'intl';
  const amount = parseFloat(WIRE.amount);
  const fee = intl ? state.wireFees.intl : state.wireFees.dom;
  const fx = intl ? +(amount * state.wireFees.fxPct/100).toFixed(2) : 0;
  const total = amount + fee + fx;
  from.balance = +(from.balance - total).toFixed(2);
  from.spendable = +(from.spendable - total).toFixed(2);
  const txId = 't-wr-'+Date.now();
  state.txByAccount[from.id] = [{
    id:txId, ...txStamp(),
    cat:'Transfer', name:`Wire to ${r.name.split(' ')[0]}`, sub:`${intl?'International':'Domestic'} wire · ${r.bank}`,
    amt:-total, c:3, status:'Pending', loc:{ city:intl?(r.country||'International'):'Domestic wire', state:'', lat:0, lng:0 }, method:'Wire'
  }, ...(state.txByAccount[from.id]||[])];
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Wire submitted', body:`${fmtMoney(total)} to ${r.name} via ${r.bank}.`, ts:Date.now() });
  saveState();
  document.getElementById('sheetTitle').textContent = 'All set';
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Wire submitted</div>
      <div class="success-amt">${fmtMoney(amount)}</div>
      <div class="success-meta">${escapeHtml(intl?'International':'Domestic')} wire to ${escapeHtml(r.name)}<br/>Confirmation #FED-${Math.floor(Math.random()*9000000+1000000)}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeSheet();back('wire','home')">Done</button>
        <button class="btn btn-ghost" onclick="closeSheet();startWire()">Send another</button>
      </div>
    </div>
  `;
  openSheetRaw();
  renderHome(); renderNotifications();
}

/* ============================================================
   ADD TO WALLET
   ============================================================ */
function startAddToWallet(){
  document.getElementById('walletName').textContent = state.user.name;
  document.getElementById('walletDevice').textContent = state.wallet.deviceName;
  document.getElementById('walletCard').classList.remove('added');
  document.getElementById('walletPass').classList.remove('show');
  /* hide platform we don't apply to (basic UA sniff) */
  const ua = navigator.userAgent || '';
  const isApple = /iPhone|iPad|iPod|Macintosh/.test(ua);
  const btns = document.getElementById('walletButtons');
  Array.from(btns.children).forEach(b => b.style.display = '');
  /* devices summary */
  renderWalletDevices();
  go('wallet');
}
function renderWalletDevices(){
  const el = document.getElementById('walletDevices');
  if(!el) return;
  const enrolled = [];
  if(state.wallet.apple) enrolled.push({ name:state.wallet.deviceName,        sub:'Apple Pay · Face ID',  ico:'apple' });
  if(state.wallet.google) enrolled.push({ name:'Pixel 9 Pro',                  sub:'Google Pay',           ico:'google' });
  if(!enrolled.length){
    el.innerHTML = `<div class="wallet-passes-empty">No devices enrolled yet.</div>`;
    return;
  }
  el.innerHTML = `
    <div class="section-h" style="padding-left:0">On this account</div>
    <div class="list" style="margin:0">
      ${enrolled.map(d => `
        <div class="li"><span class="li-icon" style="background:${d.ico==='apple'?'#000':'#fff'};color:${d.ico==='apple'?'#fff':'#0e1924'};border:1px solid var(--line)"><svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14"><path d="M16.4 1c-.5 0-1.7.5-2.5 1.4-.7.8-1.3 2-1.1 3.1.6.05 1.7-.5 2.5-1.4.7-.8 1.2-2 1.1-3.1zM21 17.5c-.6 1.4-1 2-1.7 3.2-1 1.6-2.4 3.7-4.2 3.7-1.6 0-2-1-4.2-1-2.1 0-2.6 1-4.2 1-1.7 0-3-1.9-4-3.5-2.7-4.4-3-9.6-1.3-12.4 1.2-1.9 3.1-3.1 4.9-3.1 1.7 0 2.9 1 4.4 1 1.5 0 2.4-1 4.4-1 1.6 0 3.3.9 4.4 2.4-3.9 2-3.3 7.5-2.5 9.7z"/></svg></span><div class="li-meta"><b>${escapeHtml(d.name)}</b><span>${escapeHtml(d.sub)} · added today</span></div><span class="li-trail">›</span></div>
      `).join('')}
    </div>
  `;
}
function addToAppleWallet(){
  document.getElementById('walletCard').classList.add('added');
  setTimeout(()=>{
    document.getElementById('walletPass').classList.add('show');
    state.wallet.apple = true; saveState();
    state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Added to Apple Wallet', body:`Meridian Debit •• 4827 is ready on ${state.wallet.deviceName}.`, ts:Date.now() });
    if(navigator.vibrate) navigator.vibrate([40, 60, 40]);
    saveState();
    toast('Added to Apple Wallet');
    setTimeout(renderWalletDevices, 200);
  }, 600);
}
function addToGoogleWallet(){
  document.getElementById('walletCard').classList.add('added');
  setTimeout(()=>{
    state.wallet.google = true; saveState();
    state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Added to Google Pay', body:`Meridian Debit •• 4827 is ready to tap.`, ts:Date.now() });
    toast('Added to Google Pay');
    setTimeout(renderWalletDevices, 200);
  }, 600);
}

/* ============================================================
   REPLACEMENT CARD TRACKER
   ============================================================ */
function openCardTracker(replacementId){
  const r = replacementId
    ? state.cardReplacements.find(x => x.id === replacementId)
    : state.cardReplacements[0];
  if(!r){
    document.getElementById('trackerBody').innerHTML = '<div class="empty" style="padding:30px 16px">No active replacement orders.</div>';
    go('cardTracker'); return;
  }
  /* progress over time — use ordered ts to advance through 5 steps */
  const ordered = new Date(r.ordered + 'T09:00:00Z').getTime();
  const now = Date.now();
  const hours = (now - ordered) / 36e5;
  const stepIdx = Math.min(5, Math.max(0, Math.floor(hours / 8)));     /* one step every ~8h */
  const steps = [
    { name:'Order received',  sub:'We have your request',                                      icon:'M5 12 L10 17 L19 7' },
    { name:'Card produced',   sub:'Embossed and tested at our secure facility',                icon:'M5 12 L10 17 L19 7' },
    { name:'Shipped',         sub:'Handed off to USPS Priority',                               icon:'M5 12 L10 17 L19 7' },
    { name:'In transit',      sub:`En route to Newark, DE`,                                    icon:'M5 12 L10 17 L19 7' },
    { name:'Out for delivery',sub:'On the truck for today',                                    icon:'M5 12 L10 17 L19 7' },
    { name:'Delivered',       sub:'Activate the card to start using it',                       icon:'M5 12 L10 17 L19 7' },
  ];
  const tracking = ('1Z' + Math.floor(Math.random()*9e10+1e10)).slice(0,16).toUpperCase();
  const etaDate = addDays(new Date(ordered), r.reason==='stolen' ? 2 : 5);
  const eta = stepIdx >= 5 ? 'Delivered' : `${WEEKDAY[etaDate.getDay()]}, ${fmtMD(etaDate)} by 8 PM`;
  const tlBuilder = steps.map((s, i) => {
    const cls = i < stepIdx ? 'done' : i === stepIdx ? 'current' : 'todo';
    return `
      <div class="tl-step ${cls}">
        <div class="tl-dot">${cls==='done'?'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg>':cls==='current'?'':'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="3"/></svg>'}</div>
        <div class="tl-meta">
          <b>${escapeHtml(s.name)}</b>
          <span>${escapeHtml(s.sub)} ${cls!=='todo' ? ' · '+ relTime(stepIdx-i) : ''}</span>
        </div>
      </div>`;
  }).join('');
  document.getElementById('trackerBody').innerHTML = `
    <div class="tracker-hero">
      <div class="lbl">Replacement card</div>
      <h2>Meridian Debit</h2>
      <div class="eta">Estimated delivery: <b>${escapeHtml(eta)}</b></div>
      <div class="num"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3 V21 M3 9 H21"/></svg> Tracking ${tracking}</div>
    </div>
    <div class="timeline">${tlBuilder}</div>
    <div style="padding:0 16px 24px">
      ${stepIdx >= 5 ? `<button class="btn btn-primary" onclick="activateNewCard('${r.id}')">Activate card</button>` : `<button class="btn btn-ghost" onclick="copyText('${tracking}')">Copy tracking number</button>`}
    </div>
  `;
  go('cardTracker');
}
function relTime(stepsAgo){
  if(stepsAgo === 0) return 'now';
  if(stepsAgo === 1) return '8h ago';
  if(stepsAgo === 2) return '16h ago';
  if(stepsAgo === 3) return '1d ago';
  if(stepsAgo === 4) return '1d 8h ago';
  return '2d ago';
}
function activateNewCard(id){
  state.freezeOn = false;
  state.cardReplacements = state.cardReplacements.filter(x => x.id !== id);
  saveState();
  toast('Card activated');
  document.getElementById('freezeStatus').textContent = 'Card is active';
  document.getElementById('freezeSwitch').classList.remove('on');
  back('cardTracker','cards');
}

/* ============================================================
   ABOUT SCREEN
   ============================================================ */
function openAbout(){
  /* fill diagnostics */
  const ua = navigator.userAgent || '';
  const dev = /iPhone/.test(ua) ? 'iPhone' : /iPad/.test(ua) ? 'iPad' : /Android/.test(ua) ? 'Android' : 'Web';
  document.getElementById('diagDevice').textContent = dev + ' · ' + (navigator.platform || 'unknown');
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  document.getElementById('diagInstall').textContent = isStandalone ? 'Home screen (PWA)' : 'In browser';
  document.getElementById('diagLocale').textContent = (navigator.language || state.language || 'en-US');
  if('serviceWorker' in navigator){
    navigator.serviceWorker.getRegistration().then(r => {
      document.getElementById('diagSW').textContent = r ? 'Active · scope ' + new URL(r.scope).pathname : 'Not registered';
    }).catch(()=> { document.getElementById('diagSW').textContent = 'Unavailable'; });
  } else {
    document.getElementById('diagSW').textContent = 'Unsupported';
  }
  go('about');
}
function copyDiagnostics(){
  const text =
    'Meridian — diagnostic snapshot\n' +
    'Version: ' + APP_VERSION + '\n' +
    'Device: ' + (document.getElementById('diagDevice')?.textContent || '—') + '\n' +
    'Install: ' + (document.getElementById('diagInstall')?.textContent || '—') + '\n' +
    'Locale: '  + (document.getElementById('diagLocale')?.textContent || '—') + '\n' +
    'SW: '      + (document.getElementById('diagSW')?.textContent || '—') + '\n' +
    'When: '    + new Date().toISOString();
  copyText(text);
}

/* ============================================================
   DEMO TODAY (anchor for due-date math)
   ============================================================ */
const MONTH_IDX = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
function parseMonthDay(s){
  if(!s) return null;
  const m = String(s).trim().match(/^([A-Za-z]+)\s+(\d{1,2})$/);
  if(!m) return null;
  const idx = MONTH_IDX.indexOf(m[1].toLowerCase().slice(0,3));
  if(idx < 0) return null;
  /* next occurrence on or after today */
  let dt = new Date(TODAY.getFullYear(), idx, +m[2]);
  if(dt < TODAY) dt = new Date(TODAY.getFullYear() + 1, idx, +m[2]);
  return dt;
}
function daysUntil(monthDay){
  const dt = parseMonthDay(monthDay); if(!dt) return Infinity;
  return Math.round((dt - TODAY) / DAY_MS);
}

/* ============================================================
   BILL REMINDER BANNER (home)
   ============================================================ */
function renderBillReminders(){
  const slot = document.getElementById('billReminders');
  if(!slot) return;
  const dismissed = JSON.parse(localStorage.getItem('meridian.dismissedBills') || '[]');
  const upcoming = (state.payees||[])
    .map(p => ({ ...p, days: daysUntil(p.next) }))
    .filter(p => !dismissed.includes(p.id))
    /* already paid this cycle */
    .filter(p => !(state.billPayments || []).some(b => (b.payeeId === p.id || b.payee === p.name) && b.ts && Date.now() - b.ts < 25 * DAY_MS))
    .filter(p => p.days >= 0 && p.days <= 7)
    .sort((a,b)=> a.days - b.days)
    .slice(0,3);
  /* also surface CC payment if statement is due in <= 7 days and not yet paid */
  const cc = state.accounts.find(a => a.kind === 'credit');
  if(cc && cc.due){
    const ccDays = daysUntil(cc.due);
    if(ccDays >= 0 && ccDays <= 7 && cc.statementBalance > 0 && !dismissed.includes('cc-'+cc.id)){
      upcoming.unshift({
        id:'cc-'+cc.id, name:cc.name, account:cc.mask, logoColor:'#181321',
        last: cc.statementBalance || Math.abs(cc.balance), autopay:false, next:cc.due, days:ccDays, isCC:true
      });
      if(upcoming.length > 3) upcoming.pop();
    }
  }
  const panel = document.getElementById('upcomingPanel');
  if(panel) panel.hidden = !upcoming.length;
  if(!upcoming.length){ slot.innerHTML = ''; return; }
  slot.innerHTML = upcoming.map(p => {
    const dueIn = p.days === 0 ? 'Due today' : p.days === 1 ? 'Due tomorrow' : `Due in ${p.days} days`;
    const cls = p.autopay ? 'autopay' : (p.days <= 2 ? 'urgent' : '');
    const pillTxt = p.autopay ? 'Autopay' : 'Action needed';
    const onClick = p.isCC ? `startCcPay()` : `openPayeeFlow('${p.id}');go('payBill')`;
    return `
      <div class="bill-banner ${cls}" onclick="${onClick}">
        <div class="bb-logo" style="background:${p.logoColor}">${escapeHtml(p.name.charAt(0))}</div>
        <div class="bb-meta">
          <b>${escapeHtml(p.name)}</b>
          <span>${dueIn} · ${escapeHtml(p.next)} <span class="bb-pill">${pillTxt}</span></span>
        </div>
        <div class="bb-amt">$${fmt(p.last)}</div>
        <button class="bb-x" onclick="event.stopPropagation();dismissBillReminder('${p.id}')" aria-label="Dismiss">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M18 6 L6 18 M6 6 L18 18"/></svg>
        </button>
      </div>`;
  }).join('');
}
function dismissBillReminder(id){
  const arr = JSON.parse(localStorage.getItem('meridian.dismissedBills') || '[]');
  if(!arr.includes(id)) arr.push(id);
  localStorage.setItem('meridian.dismissedBills', JSON.stringify(arr));
  renderBillReminders();
}

/* ============================================================
   CREDIT SCORE
   ============================================================ */
function renderCreditScoreCard(){
  const slot = document.getElementById('scoreCardSlot');
  if(!slot) return;
  const c = state.creditScore;
  const minS = 300, maxS = 850;
  const pct = Math.max(0, Math.min(100, ((c.score - minS) / (maxS - minS)) * 100));
  const ch = c.change || 0;
  const dir = ch > 0 ? 'up' : ch < 0 ? 'down' : '';
  const sign = ch > 0 ? '▲ +' : ch < 0 ? '▼ ' : '';
  slot.innerHTML = `
    <div class="score-card" onclick="openCreditScore()">
      <div class="head">
        <h3 class="title">Credit score
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><circle cx="12" cy="12" r="9"/><path d="M12 8 V12 M12 16 V16.01"/></svg>
        </h3>
        ${ch !== 0 ? `<span class="delta ${dir}">${sign}${Math.abs(ch)} pts</span>` : ''}
      </div>
      <div class="body">
        <div class="score-num">${c.score}<small>${escapeHtml(c.range)}</small></div>
        <div>
          <div class="score-bar">
            <div class="fill" style="--p:${pct}%"></div>
            <div class="pin" style="left:${pct}%"></div>
          </div>
          <div class="score-bar-row">
            <span>300</span><span>670</span><span>850</span>
          </div>
        </div>
      </div>
      <div class="score-foot">
        <span>Updated ${escapeHtml(c.lastUpdated)} · free, no impact</span>
        <b>${escapeHtml(c.bureau)}</b>
      </div>
    </div>
  `;
}
function openCreditScore(){
  renderCreditScreen();
  go('credit');
}
function renderCreditScreen(){
  const c = state.creditScore;
  const minS = 300, maxS = 850;
  const sparkMin = Math.min(...c.history) - 5;
  const sparkMax = Math.max(...c.history) + 5;
  document.getElementById('creditBody').innerHTML = `
    <div class="score-hero">
      <div class="lbl">FICO® Score 8</div>
      <div class="num">${c.score}</div>
      <div class="range">${escapeHtml(c.range)}</div>
      <div class="ch">${c.change>0?'▲ +':'▼ '}${Math.abs(c.change)} pts since last month</div>
    </div>

    <div class="score-spark">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div><b style="font-weight:700;font-size:16px">12-month trend</b><div style="font-size:11.5px;color:var(--muted);font-weight:500">From ${c.history[0]} → ${c.score}</div></div>
        <div style="font-family:var(--mono);font-size:12px;color:var(--pos);font-weight:700">+${c.score - c.history[0]} pts</div>
      </div>
      <div class="spark">
        ${c.history.map((v,i) => {
          const h = Math.max(8, ((v - sparkMin) / (sparkMax - sparkMin)) * 70);
          return `<i class="${i===c.history.length-1?'now':''}" style="height:${h}px"></i>`;
        }).join('')}
      </div>
      <div class="spark-row">${[12, 6, 0].map(k => { const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - k, 1); return `<span>${MON[d.getMonth()]} '${String(d.getFullYear()).slice(2)}</span>`; }).join('')}</div>
    </div>

    <div class="section-h">What's affecting your score</div>
    <div class="list" style="margin:8px 16px 14px">
      ${c.factors.map(f => `
        <div class="factor-row">
          <span class="factor-impact ${f.impact}">${f.impact}</span>
          <div class="meta"><b>${escapeHtml(f.label)}</b><span>${escapeHtml(f.detail)}</span></div>
          <span class="status ${f.status==='good'?'':f.status}">${f.status==='good'?'Good ✓':f.status==='fair'?'Fair':'Needs work'}</span>
        </div>
      `).join('')}
    </div>

    <div class="section-h">How to improve</div>
    <div class="list" style="margin:8px 16px 14px">
      <div class="li" onclick="openArticle('disputes')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 8 V14 M9 11 L12 8 L15 11"/><circle cx="12" cy="12" r="9"/></svg></span><div class="li-meta"><b>Pay down credit card</b><span>Aim for &lt; 10% utilization</span></div><span class="li-trail">›</span></div>
      <div class="li" onclick="toast('Setting up alerts')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8a6 6 0 0 0 -12 0c0 7 -3 9 -3 9 h18s-3 -2 -3 -9"/></svg></span><div class="li-meta"><b>Score change alerts</b><span>Get notified for changes ≥ 5 pts</span></div><div class="switch on"></div></div>
      <div class="li" onclick="toast('Identity monitoring')"><span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 1 a10 10 0 0 0 -7.5 16.65 L12 23 l7.5 -5.35 A10 10 0 0 0 12 1 z"/></svg></span><div class="li-meta"><b>Identity monitoring</b><span>Free with Meridian Select</span></div><span class="li-trail">›</span></div>
    </div>

    <div class="about-disclaimer" style="margin:6px 16px 30px">
      Your FICO® Score 8 is provided by Experian and is updated monthly. Scores from other bureaus or models may differ. This is for educational purposes; lenders may use a different score when reviewing credit.
    </div>
  `;
}

/* ============================================================
   CREDIT CARD PAYMENT FLOW
   ============================================================ */
let CCPAY = { fromId:null, ccId:null, choice:'statement', custom:'', date:'today' };
function startCcPay(){
  const cc = state.accounts.find(a => a.kind === 'credit'); if(!cc){ toast('No credit card'); return; }
  const ch = state.accounts.find(a => a.kind === 'checking');
  CCPAY = { fromId: ch.id, ccId: cc.id, choice:'statement', custom:'', date:'today' };
  renderCcPayForm();
  go('ccPay');
}
function renderCcPayForm(){
  const cc = accountById(CCPAY.ccId);
  const from = accountById(CCPAY.fromId);
  const stmt = cc.statementBalance || Math.abs(cc.balance);
  const min = cc.minPayment || 35;
  const cur = Math.abs(cc.balance);
  const utilPct = Math.round(cur / cc.limit * 100);

  document.getElementById('ccPayBody').innerHTML = `
    <div class="cc-summary">
      <div class="lbl">Credit card</div>
      <div class="name">${escapeHtml(cc.name)} ${escapeHtml(cc.mask)}</div>
      <div class="grid">
        <div class="cell">
          <div class="l">Current balance</div>
          <div class="v big">$${fmt(cur)}</div>
        </div>
        <div class="cell">
          <div class="l">Available credit</div>
          <div class="v">$${fmt(cc.limit - cur)}</div>
        </div>
      </div>
      <div class="due"><span>Due <b>${escapeHtml(cc.due)}</b> · APR ${cc.apr}%</span><span>${utilPct}% utilization</span></div>
    </div>

    <div class="section-h">How much</div>
    <div class="pay-opts">
      <div class="pay-opt ${CCPAY.choice==='min'?'active':''}" data-c="min">
        <span class="radio"></span>
        <div class="meta"><b>Minimum due</b><span>Avoids late fee</span></div>
        <div class="amt">$${fmt(min)}<small>$${fmt(min)} min</small></div>
      </div>
      <div class="pay-opt ${CCPAY.choice==='statement'?'active recommended':CCPAY.choice==='statement'?'active':''}${CCPAY.choice==='statement'?'':' recommended'}" data-c="statement">
        <span class="radio"></span>
        <div class="meta"><b>Statement balance</b><span>Avoids interest</span></div>
        <div class="amt">$${fmt(stmt)}<small>last close</small></div>
      </div>
      <div class="pay-opt ${CCPAY.choice==='current'?'active':''}" data-c="current">
        <span class="radio"></span>
        <div class="meta"><b>Current balance</b><span>Pay everything you owe</span></div>
        <div class="amt">$${fmt(cur)}<small>incl. pending</small></div>
      </div>
      <div class="pay-opt ${CCPAY.choice==='custom'?'active':''}" data-c="custom">
        <span class="radio"></span>
        <div class="meta">
          <b>Other amount</b>
          ${CCPAY.choice==='custom' ? `<input class="field" id="ccCustomAmt" inputmode="decimal" placeholder="0.00" value="${escapeHtml(CCPAY.custom)}" style="margin-top:8px;font-family:var(--mono);font-weight:700" />` : `<span>Choose any amount up to current</span>`}
        </div>
      </div>
    </div>

    <div class="section-h">From</div>
    <div style="margin:0 18px 14px">
      <div class="acct-pick ${pickCls(from)}" onclick="pickCcFromAccount()">
        <div class="swatch"></div>
        <div class="info"><b>${escapeHtml(from.name)}</b><span>${escapeHtml(from.mask)}</span><span class="bal">${fmtMoney(from.balance)} available</span></div>
        <span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><path d="M9 18 L15 12 L9 6"/></svg></span>
      </div>
    </div>

    <div class="section-h">Pay on</div>
    <div style="padding:0 16px 16px">
      <div class="recur-row">
        <div class="opt ${CCPAY.date==='today'?'active':''}" onclick="CCPAY.date='today';renderCcPayForm()">Today</div>
        <div class="opt ${CCPAY.date==='tomorrow'?'active':''}" onclick="CCPAY.date='tomorrow';renderCcPayForm()">Tomorrow</div>
        <div class="opt ${CCPAY.date==='due'?'active':''}" onclick="CCPAY.date='due';renderCcPayForm()">${escapeHtml(cc.due)} (due)</div>
      </div>
    </div>
  `;

  document.querySelectorAll('#ccPayBody .pay-opt').forEach(el => el.addEventListener('click', () => {
    CCPAY.choice = el.dataset.c;
    renderCcPayForm();
    if(CCPAY.choice === 'custom') setTimeout(()=> document.getElementById('ccCustomAmt')?.focus(), 80);
  }));
  const ci = document.getElementById('ccCustomAmt');
  if(ci){
    ci.addEventListener('input', e => {
      let v = e.target.value.replace(/[^0-9.]/g,'');
      const parts = v.split('.'); if(parts.length>2) v = parts[0]+'.'+parts.slice(1).join('');
      if(parts[1] && parts[1].length>2) v = parts[0]+'.'+parts[1].slice(0,2);
      e.target.value = v; CCPAY.custom = v; validateCcPay();
    });
    ci.addEventListener('click', e => e.stopPropagation());
  }
  validateCcPay();
}
function ccPayAmount(){
  const cc = accountById(CCPAY.ccId);
  if(CCPAY.choice === 'min')       return cc.minPayment || 35;
  if(CCPAY.choice === 'statement') return cc.statementBalance || Math.abs(cc.balance);
  if(CCPAY.choice === 'current')   return Math.abs(cc.balance);
  return parseFloat(CCPAY.custom || 0);
}
function validateCcPay(){
  const v = ccPayAmount();
  const from = accountById(CCPAY.fromId);
  const ok = v > 0 && v <= from.balance;
  document.getElementById('ccPayReview').disabled = !ok;
}
function pickCcFromAccount(){
  document.getElementById('sheetTitle').textContent = 'Pay from';
  document.getElementById('sheetBody').innerHTML = state.accounts.filter(a => a.kind !== 'credit').map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" onclick="CCPAY.fromId='${a.id}';renderCcPayForm();closeSheet()">
      <div class="swatch"></div>
      <div class="info"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)}</span><span class="bal">${fmtMoney(a.balance)} available</span></div>
    </div>
  `).join('');
  openSheetRaw();
}
function reviewCcPay(){
  const cc = accountById(CCPAY.ccId);
  const from = accountById(CCPAY.fromId);
  const v = ccPayAmount();
  const dateLbl = CCPAY.date === 'today' ? 'Today' : CCPAY.date === 'tomorrow' ? 'Tomorrow' : cc.due;
  const choiceLbl = CCPAY.choice === 'min' ? 'Minimum due' : CCPAY.choice === 'statement' ? 'Statement balance' : CCPAY.choice === 'current' ? 'Current balance' : 'Custom amount';
  document.getElementById('sheetTitle').textContent = 'Review payment';
  document.getElementById('sheetBody').innerHTML = `
    <div class="review-amount"><span class="cur">$</span>${fmt(v)}</div>
    <div class="review-row"><span class="lbl">To</span><span class="val">${escapeHtml(cc.name)}<span class="sub">${escapeHtml(cc.mask)}</span></span></div>
    <div class="review-row"><span class="lbl">From</span><span class="val">${escapeHtml(from.name)}<span class="sub">${escapeHtml(from.mask)}</span></span></div>
    <div class="review-row"><span class="lbl">Pay option</span><span class="val">${escapeHtml(choiceLbl)}</span></div>
    <div class="review-row"><span class="lbl">Send</span><span class="val">${escapeHtml(dateLbl)}</span></div>
    <div class="review-row"><span class="lbl">Fee</span><span class="val" style="color:var(--pos)">$0.00</span></div>
    ${ CCPAY.choice === 'min' ? `<p style="font-size:11.5px;color:var(--red-2);font-weight:600;margin:12px 0 4px;line-height:1.5">⚠ Paying only the minimum will accrue interest at ${cc.apr}% APR on the remaining $${fmt(Math.abs(cc.balance) - (cc.minPayment||35))}.</p>` : '' }
    <div style="margin-top:14px;display:flex;flex-direction:column;gap:10px">
      <button class="btn btn-primary" onclick="confirmCcPayWithStepUp()">Confirm payment</button>
      <button class="btn btn-ghost" onclick="closeSheet()">Edit</button>
    </div>
  `;
  openSheetRaw();
}
function confirmCcPayWithStepUp(){
  const v = ccPayAmount();
  if(v >= 1000){
    closeSheet();
    return setTimeout(()=> requireStepUp({
      reason: `Confirm credit card payment of $${fmt(v)}.`,
      onSuccess: doConfirmCcPay,
      onCancel: ()=> reviewCcPay()
    }), 320);
  }
  doConfirmCcPay();
}
function doConfirmCcPay(){
  const cc = accountById(CCPAY.ccId);
  const from = accountById(CCPAY.fromId);
  const v = ccPayAmount();
  /* debit checking */
  from.balance = +(from.balance - v).toFixed(2);
  from.spendable = +(from.spendable - v).toFixed(2);
  /* reduce CC balance (CC balance is negative when amount owed; payment moves toward 0) */
  cc.balance = +(cc.balance + v).toFixed(2);
  cc.statementBalance = Math.max(0, (cc.statementBalance || 0) - v);
  cc.lastPayment = { amount: v, date: new Date().toLocaleDateString('en-US',{month:'short', day:'2-digit'}) };
  const ts = Date.now();
  state.txByAccount[from.id] = [{ id:'t-cc-'+ts+'-o', ...txStamp(), cat:'Bills', name:`Payment to ${cc.name}`, sub:`Card ${cc.mask}`, amt:-v, c:5, status:'Pending', loc:{city:'Internal payment',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[from.id]||[])];
  state.txByAccount[cc.id] = [{ id:'t-cc-'+ts+'-i', ...txStamp(), cat:'Income', name:'Payment received', sub:`Thank you · from ${from.name}`, amt:+v, c:4, status:'Posted', loc:{city:'Payment',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[cc.id]||[])];
  state.ccPayments.unshift({ id:'cc-'+ts, amount:v, date:fmtMD(new Date()) });
  state.notifications.unshift({ id:'n-'+Date.now(), unread:true, title:'Card payment scheduled', body:`${fmtMoney(v)} to ${cc.name} from ${from.name}.`, ts:Date.now() });
  /* dismiss the cc bill banner since we just paid */
  const arr = JSON.parse(localStorage.getItem('meridian.dismissedBills') || '[]');
  if(!arr.includes('cc-'+cc.id)){ arr.push('cc-'+cc.id); localStorage.setItem('meridian.dismissedBills', JSON.stringify(arr)); }
  saveState();
  document.getElementById('sheetTitle').textContent = 'All set';
  document.getElementById('sheetBody').innerHTML = `
    <div class="success-stage">
      <div class="success-check"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12 L10 17 L19 7"/></svg></div>
      <div class="success-title">Payment scheduled</div>
      <div class="success-amt">${fmtMoney(v)}</div>
      <div class="success-meta">${escapeHtml(cc.name)}<br/>Confirmation #CC-${Math.floor(Math.random()*900000+100000)}</div>
      <div style="margin-top:24px;display:flex;flex-direction:column;gap:10px">
        <button class="btn btn-primary" onclick="closeSheet();back('ccPay','detail')">Done</button>
        <button class="btn btn-ghost" onclick="closeSheet();renderCcPayForm()">Make another payment</button>
      </div>
    </div>
  `;
  openSheetRaw();
  renderHome(); renderNotifications();
  if(activeId) renderTransactions(activeId);
}

/* ============================================================
   ROUND-UP TO SAVINGS
   ============================================================ */
function computeRoundUps(){
  /* the change on this month's posted debit-card purchases in Everyday Checking */
  const start = +new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  let total = 0;
  for(const t of (state.txByAccount[state.accounts[0].id] || [])){
    if(t.amt < 0 && t.status !== 'Pending' && t.method === 'Card' && (t.ts || 0) >= start){
      const abs = Math.abs(t.amt);
      const up = +(Math.ceil(abs) - abs).toFixed(2);
      if(up > 0 && up < 1) total += up;
    }
  }
  return +total.toFixed(2);
}
function renderRoundUpRow(){
  const slot = document.getElementById('roundupSlot');
  if(!slot) return;
  const r = state.roundUps;
  if(activeId !== state.accounts[0].id){ slot.innerHTML = ''; return; }
  const dest = accountById(r.destAccountId);
  const accumulated = r.enabled ? computeRoundUps() : 0;
  slot.innerHTML = `
    <div class="roundup-card" onclick="openRoundUpSettings()">
      <div class="ic">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 8 V12 L15 14"/><path d="M5 5 L7 7 M19 5 L17 7"/></svg>
      </div>
      <div class="meta">
        <b>Round-ups to savings</b>
        <span>${r.enabled ? `Active · sweeping to ${escapeHtml(dest?.name || 'savings')}` : 'Off · save the change on every purchase'}</span>
        ${r.enabled ? `<div class="accum">$${fmt(accumulated)} <em>this month · $${fmt(r.lifetimeSwept)} swept all-time</em></div>` : ''}
      </div>
      <div class="switch ${r.enabled?'on':''}" onclick="event.stopPropagation();toggleRoundUp(this)"></div>
    </div>
  `;
}
function toggleRoundUp(el){
  state.roundUps.enabled = !state.roundUps.enabled;
  saveState();
  if(el) el.classList.toggle('on', state.roundUps.enabled);
  renderRoundUpRow();
  toast(state.roundUps.enabled ? 'Round-ups on' : 'Round-ups off');
}
function openRoundUpSettings(){
  const r = state.roundUps;
  const dest = accountById(r.destAccountId) || state.accounts[1];
  document.getElementById('sheetTitle').textContent = 'Round-up to savings';
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:13.5px;color:var(--muted);font-weight:500;line-height:1.5;margin:0 0 12px">Round every purchase up to the next dollar and sweep the change weekly to a savings account.</p>
    <div class="list" style="margin:0">
      <div class="li">
        <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/></svg></span>
        <div class="li-meta"><b>Enabled</b><span>${r.enabled?'Sweeping weekly on Mondays':'Off'}</span></div>
        <div class="switch ${r.enabled?'on':''}" onclick="toggleRoundUp(this);openRoundUpSettings()"></div>
      </div>
      <div class="li" onclick="pickRoundUpDest()">
        <span class="li-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 21 V11 L12 4 L21 11 V21 Z"/></svg></span>
        <div class="li-meta"><b>Save to</b><span>${escapeHtml(dest.name)} ${escapeHtml(dest.mask)}</span></div>
        <span class="li-trail">›</span>
      </div>
    </div>
    <div class="section-h">This month so far</div>
    <div class="list" style="margin:0">
      <div class="kv-row" style="padding:14px 16px"><span class="lbl">Round-ups</span><span class="val" style="color:var(--gold);font-family:var(--mono)">$${fmt(computeRoundUps())}</span></div>
      <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">Next sweep</span><span class="val">${(d => WEEKDAY[d.getDay()] + ', ' + fmtMD(d))(nextOn(1, addDays(TODAY, 1)))}</span></div>
      <div class="kv-row" style="padding:14px 16px;border-top:1px solid var(--line-2)"><span class="lbl">All-time saved</span><span class="val">$${fmt(state.roundUps.lifetimeSwept)}</span></div>
    </div>
    <div style="padding:14px 0 6px"><button class="btn btn-ghost" onclick="sweepNow()">Sweep round-ups now</button></div>
  `;
  openSheetRaw();
}
function pickRoundUpDest(){
  document.getElementById('sheetTitle').textContent = 'Save round-ups to';
  document.getElementById('sheetBody').innerHTML = state.accounts.filter(a => a.kind !== 'credit' && a.id !== state.accounts[0].id).map(a => `
    <div class="acct-pick ${pickCls(a)}" style="margin-bottom:10px" onclick="state.roundUps.destAccountId='${a.id}';saveState();openRoundUpSettings()">
      <div class="swatch"></div>
      <div class="info"><b>${escapeHtml(a.name)}</b><span>${escapeHtml(a.mask)}</span><span class="bal">${fmtMoney(a.balance)} balance</span></div>
    </div>
  `).join('');
}
function sweepNow(){
  const r = state.roundUps;
  const total = computeRoundUps();
  if(total <= 0){ toast('Nothing to sweep yet'); return; }
  const from = state.accounts[0];
  const to = accountById(r.destAccountId);
  if(!to){ toast('Pick a destination first'); return; }
  from.balance = +(from.balance - total).toFixed(2);
  from.spendable = +(from.spendable - total).toFixed(2);
  to.balance = +(to.balance + total).toFixed(2);
  if(to.kind !== 'credit') to.spendable = +(to.spendable + total).toFixed(2);
  if(to.aside !== undefined) to.aside = +((to.aside||0) + total).toFixed(2);
  state.roundUps.lifetimeSwept = +(state.roundUps.lifetimeSwept + total).toFixed(2);
  state.roundUps.lastSweep = new Date().toLocaleDateString('en-US',{month:'short', day:'numeric', year:'numeric'});
  state.roundUps.monthAccumulated = 0;
  /* mark a sweep tx (small amount) */
  const ts = Date.now();
  state.txByAccount[from.id] = [{ id:'t-rs-'+ts+'-o', ...txStamp(), cat:'Transfer', name:'Round-up sweep', sub:`To ${to.name}`, amt:-total, c:2, status:'Posted', loc:{city:'Round-up',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[from.id]||[])];
  state.txByAccount[to.id]   = [{ id:'t-rs-'+ts+'-i', ...txStamp(), cat:'Income', name:'Round-up deposit', sub:`From ${from.name}`, amt:+total, c:4, status:'Posted', loc:{city:'Round-up',state:'',lat:0,lng:0}, method:'Internal' }, ...(state.txByAccount[to.id]||[])];
  saveState();
  closeSheet(); renderHome();
  if(activeId) renderTransactions(activeId);
  toast('Swept $'+fmt(total)+' to '+to.name);
}

/* ============================================================
   ANIMATED NUMBER TICKER
   ============================================================ */
function tickNumber(el, from, to, opts){
  if(!el) return;
  opts = opts || {};
  const dur = opts.dur || 650;
  const formatter = opts.fmt || (n => '$' + fmt(n));
  const paint = v => { if(opts.html) el.innerHTML = formatter(v); else el.textContent = formatter(v); };
  if(state.hideBalances){ el.textContent = opts.hidden || '$••••••'; return; }
  if(Math.abs(to - from) < 0.005 || matchMedia('(prefers-reduced-motion: reduce)').matches){ paint(to); return; }
  const start = performance.now();
  const ease = t => 1 - Math.pow(1 - t, 3);
  function step(now){
    const t = Math.min(1, (now - start) / dur);
    paint(from + (to - from) * ease(t));
    if(t < 1) el.__tick = requestAnimationFrame(step);
  }
  cancelAnimationFrame(el.__tick);
  el.__tick = requestAnimationFrame(step);
}
const PREV_BAL = { home:null, detail:null, spendable:null };
function animateHomeTotal(newTotal){
  const el = document.getElementById('totalAmt');
  if(PREV_BAL.home === null || state.hideBalances){
    if(state.hideBalances) el.textContent = '$••••••'; else el.innerHTML = moneyHTML(newTotal);
  } else {
    tickNumber(el, PREV_BAL.home, newTotal, { fmt: moneyHTML, html:true });
  }
  PREV_BAL.home = newTotal;
}
function animateDetailBalance(acct){
  const el = document.getElementById('detailAmt');
  const shown = acct.kind === 'credit' ? Math.max(0, -acct.balance) : acct.balance;
  if(PREV_BAL.detail === null || state.hideBalances){
    if(state.hideBalances) el.textContent = '$••••••'; else el.innerHTML = moneyHTML(shown);
  } else {
    tickNumber(el, PREV_BAL.detail, shown, { fmt: moneyHTML, html:true });
  }
  PREV_BAL.detail = shown;
  const sp = document.getElementById('spendable'); if(sp) sp.textContent = fmtMoney(acct.spendable || 0);
}

/* ============================================================
   DRAG-TO-DISMISS SHEETS
   ============================================================ */
function attachSheetDrag(){
  const sheet = document.getElementById('sheet');
  const handle = sheet.querySelector('.sheet-handle');
  const head   = sheet.querySelector('.sheet-head');
  let startY = 0, dy = 0, dragging = false, startTime = 0;
  const onStart = (e) => {
    if(!sheet.classList.contains('show')) return;
    const t = e.touches ? e.touches[0] : e;
    startY = t.clientY; dy = 0; dragging = true; startTime = performance.now();
    sheet.style.transition = 'none';
    document.getElementById('scrim').style.transition = 'none';
  };
  const onMove = (e) => {
    if(!dragging) return;
    const t = e.touches ? e.touches[0] : e;
    dy = Math.max(0, t.clientY - startY);
    sheet.style.transform = `translateY(${dy}px)`;
    /* fade scrim as the sheet drags */
    const op = Math.max(0, 1 - dy / 400);
    document.getElementById('scrim').style.opacity = op.toFixed(2);
  };
  const onEnd = () => {
    if(!dragging) return;
    dragging = false;
    sheet.style.transition = '';
    document.getElementById('scrim').style.transition = '';
    document.getElementById('scrim').style.opacity = '';
    const elapsed = performance.now() - startTime;
    const velocity = dy / Math.max(1, elapsed);
    if(dy > 130 || velocity > 0.5){
      sheet.style.transform = '';
      closeSheet();
    } else {
      sheet.style.transform = '';
    }
    dy = 0;
  };
  [handle, head].forEach(el => {
    if(!el) return;
    el.addEventListener('touchstart', onStart, { passive:true });
    el.addEventListener('mousedown', onStart);
  });
  document.addEventListener('touchmove', onMove, { passive:true });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchend', onEnd);
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchcancel', onEnd);
}

/* ============================================================
   SWIPE-TO-REVEAL ON TX ROWS
   ============================================================ */
let __txSwipeAttached = false;
function attachTxSwipe(root){
  if(!root) root = document.getElementById('txList');
  if(!root || __txSwipeAttached) return;
  __txSwipeAttached = true;
  let active = null;
  let startX = 0, startY = 0, dx = 0, dragging = false, axis = '';
  const THRESH = 60, MAX = 222;

  const onStart = (e) => {
    const wrap = e.target.closest('.tx-wrap'); if(!wrap) return;
    /* close any other revealed row */
    root.querySelectorAll('.tx-wrap.revealed').forEach(w => { if(w !== wrap) w.classList.remove('revealed'); });
    active = wrap;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY; dx = 0; axis = ''; dragging = true;
    wrap.classList.add('dragging');
  };
  const onMove = (e) => {
    if(!dragging || !active) return;
    const t = e.touches ? e.touches[0] : e;
    const dxRaw = t.clientX - startX;
    const dyRaw = t.clientY - startY;
    if(!axis){
      if(Math.abs(dxRaw) > 8 || Math.abs(dyRaw) > 8){
        axis = Math.abs(dxRaw) > Math.abs(dyRaw) ? 'x' : 'y';
      }
    }
    if(axis !== 'x') return;
    /* only allow swiping left to reveal; or right if already revealed */
    const startedRevealed = active.classList.contains('revealed');
    let next = startedRevealed ? -MAX + dxRaw : dxRaw;
    next = Math.min(0, Math.max(-MAX, next));
    dx = next;
    active.querySelector('.tx').style.transform = `translateX(${dx}px)`;
    if(e.cancelable) e.preventDefault?.();
  };
  const onEnd = () => {
    if(!dragging || !active){ dragging = false; return; }
    dragging = false;
    active.classList.remove('dragging');
    active.querySelector('.tx').style.transform = '';
    if(axis === 'x'){
      const startedRevealed = active.classList.contains('revealed');
      const shouldReveal = startedRevealed ? dx < -THRESH : dx < -THRESH;
      active.classList.toggle('revealed', shouldReveal);
    }
    active = null;
  };

  root.addEventListener('touchstart', onStart, { passive:true });
  root.addEventListener('mousedown',  onStart);
  document.addEventListener('touchmove', onMove, { passive:false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchend',  onEnd);
  document.addEventListener('mouseup',   onEnd);
  document.addEventListener('touchcancel', onEnd);

  /* tap-anywhere outside collapses */
  document.addEventListener('click', e => {
    if(e.target.closest('.tx-wrap.revealed') || e.target.closest('.btn-rev')) return;
    root.querySelectorAll('.tx-wrap.revealed').forEach(w => w.classList.remove('revealed'));
  });
}

/* ============================================================
   ACCOUNT EMOJI + RENAME
   ============================================================ */
function openRenameAccount(id){
  const a = accountById(id); if(!a) return;
  /* parse out a leading emoji if present */
  const m = a.name.match(/^(\p{Extended_Pictographic}(‍\p{Extended_Pictographic})*️?)\s+(.+)$/u);
  const currentEmoji = m ? m[1] : '';
  const cleanName = m ? m[3] : a.name;
  document.getElementById('sheetTitle').textContent = 'Rename account';
  document.getElementById('sheetBody').innerHTML = `
    <div class="form-section" style="margin-bottom:14px">
      <div class="form-label">Display name</div>
      <input class="field" id="rnName" value="${escapeHtml(cleanName)}" maxlength="32" />
    </div>
    <div class="form-section" style="margin-bottom:6px">
      <div class="form-label">Emoji (optional)</div>
      <div class="emoji-grid" id="rnEmojiGrid">
        <div class="emoji-cell none ${!currentEmoji?'active':''}" data-e="">None</div>
        ${state.emojiPicks.map(e => `<div class="emoji-cell ${e===currentEmoji?'active':''}" data-e="${e}">${e}</div>`).join('')}
      </div>
    </div>
    <div style="display:flex;flex-direction:column;gap:10px;margin-top:14px">
      <button class="btn btn-primary" onclick="saveRenameAccount('${id}')">Save</button>
      <button class="btn btn-ghost" onclick="closeSheet()">Cancel</button>
    </div>
  `;
  document.querySelectorAll('#rnEmojiGrid .emoji-cell').forEach(el => el.addEventListener('click', ()=>{
    document.querySelectorAll('#rnEmojiGrid .emoji-cell').forEach(x => x.classList.remove('active'));
    el.classList.add('active');
  }));
  openSheetRaw();
}
function saveRenameAccount(id){
  const a = accountById(id); if(!a) return;
  const name = document.getElementById('rnName').value.trim();
  if(!name){ toast('Name required'); return; }
  const emoji = document.querySelector('#rnEmojiGrid .emoji-cell.active')?.dataset.e || '';
  a.name = (emoji ? emoji + ' ' : '') + name;
  saveState();
  closeSheet();
  /* refresh visible places */
  if(activeId === id) document.getElementById('detailTitle').textContent = a.name + ' ' + a.mask;
  renderHome();
  if(activeId) renderTransactions(activeId);
  toast('Account renamed');
}

/* ============================================================
   RICH NOTIFICATIONS (grouping + archive + deep-link)
   ============================================================ */
function notifGroup(time){
  const t = String(time).toLowerCase();
  if(t === 'just now' || /^\d+(s|m| min|h| hr)/.test(t.replace(/\s/g,'')) || /^\d+\s*(s|min|h|hr)/.test(t)) return 'today';
  if(t.includes('yesterday')) return 'yesterday';
  if(/^\d+\s*(d|day)/.test(t) || /^\dh ago/.test(t)){
    const m = t.match(/^(\d+)/);
    const d = m ? parseInt(m[1],10) : 99;
    return d <= 7 ? 'this-week' : 'older';
  }
  if(/week/.test(t)) return 'this-week';
  return 'older';
}
const NOTIF_GROUP_LABEL = { 'today':'Today','yesterday':'Yesterday','this-week':'This week','older':'Older' };
function notifDeepLink(n){
  const text = (n.title + ' ' + (n.body||'')).toLowerCase();
  if(/statement/.test(text)) return ()=> go('statements');
  if(/dispute|case/.test(text)) return ()=> openArticle('disputes');
  if(/wire/.test(text)) return ()=> startWire();
  if(/zelle/.test(text)) return ()=> startZelle();
  if(/bill|payment/.test(text)) return ()=> { go('payBill'); renderPayees(); };
  if(/replacement/.test(text)) return ()=> { const r = state.cardReplacements[0]; if(r) openCardTracker(r.id); };
  if(/wallet|apple pay|google pay/.test(text)) return ()=> { go('cards'); setTab('cards'); };
  if(/transfer|deposit|interest/.test(text)){
    const a = state.accounts.find(x => new RegExp(x.name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'),'i').test(text));
    return ()=> { if(a) openAccount(a.id); else go('home'); };
  }
  return ()=> go('home');
}
function notifKind(n){
  const t = (n.title + ' ' + (n.body || '')).toLowerCase();
  if(/sign-in|security|passcode|locked|fraud/.test(t)) return ['warn', '<path d="M12 3 L20 6 V12 c0 4.5 -3.4 8 -8 9 c-4.6 -1 -8 -4.5 -8 -9 V6 Z"/>'];
  if(/dispute|declined|failed/.test(t)) return ['bad', '<path d="M12 9 V13 M12 17 h.01"/><circle cx="12" cy="12" r="9"/>'];
  if(/deposit|interest|received|refund/.test(t)) return ['good', '<path d="M12 4 V20 M5 13 L12 20 L19 13"/>'];
  if(/score/.test(t)) return ['good', '<path d="M3 17 L9 11 L13 15 L21 7"/><path d="M15 7 H21 V13"/>'];
  if(/statement/.test(t)) return ['', '<path d="M6 3 H15 L19 7 V21 H6 Z"/><path d="M9 12 H16 M9 16 H16"/>'];
  if(/card/.test(t)) return ['', '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 10 H21.5"/>'];
  return ['', '<path d="M5 8 H19 L15.5 4.5"/><path d="M19 16 H5 L8.5 19.5"/>'];
}
function notifBucket(n){
  if(!n.ts) return notifGroup(n.time);
  const d = daysBetween(new Date(n.ts), TODAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 7 ? 'this-week' : 'older';
}
function renderNotifications(){
  const list = document.getElementById('notifList');
  if(!list) return;
  const visible = state.notifications.filter(n => !state.archivedNotifIds.includes(n.id)).sort((a, b) => (b.ts || 0) - (a.ts || 0));
  if(!visible.length){
    list.innerHTML = `
      <div style="padding:56px 30px;text-align:center;color:var(--muted)">
        <div style="width:60px;height:60px;border-radius:50%;background:var(--bg);display:grid;place-items:center;margin:0 auto 14px;color:var(--muted-2);box-shadow:var(--shadow-sm)">
          ${svgIcon('<path d="M18 8a6 6 0 0 0 -12 0c0 7 -3 9 -3 9 h18s-3 -2 -3 -9"/><path d="M13.73 21a2 2 0 0 1 -3.46 0"/>')}
        </div>
        <b style="display:block;color:var(--ink);font-size:16px;font-weight:700;margin-bottom:4px">You’re all caught up</b>
        <span style="font-size:14px;font-weight:500">We’ll let you know when something needs your attention.</span>
      </div>`;
    return;
  }
  const groups = { today:[], yesterday:[], 'this-week':[], older:[] };
  visible.forEach(n => groups[notifBucket(n)]?.push(n));
  let html = '';
  for(const k of ['today','yesterday','this-week','older']){
    if(!groups[k].length) continue;
    html += `<div class="notif-section">${NOTIF_GROUP_LABEL[k]}</div>`;
    html += groups[k].map(n => {
      const [tone, icon] = notifKind(n);
      return `
      <div class="notif-wrap" data-id="${n.id}">
        <div class="notif-archive-action" onclick="archiveNotif('${n.id}')">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 8 V21 H3 V8"/><rect x="1" y="3" width="22" height="5"/><path d="M10 12 H14"/></svg>
          Archive
        </div>
        <div class="notif ${n.unread?'unread':''}" role="button" tabindex="0" onclick="onNotifClick('${n.id}')">
          <div class="notif-ico ${tone}">${svgIcon(icon)}</div>
          <div class="notif-meta">
            <div class="notif-title">${escapeHtml(n.title)}</div>
            <div class="notif-body">${escapeHtml(n.body||'')}</div>
            <div class="notif-time">${escapeHtml(n.ts ? relAgo(n.ts) : (n.time || ''))}</div>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  list.innerHTML = html;
  attachNotifSwipe();
}
function onNotifClick(id){
  const n = state.notifications.find(x => x.id === id); if(!n) return;
  /* if revealed, just collapse */
  const wrap = document.querySelector(`.notif-wrap[data-id="${id}"]`);
  if(wrap?.classList.contains('revealed')){ wrap.classList.remove('revealed'); return; }
  if(n.unread){ n.unread = false; saveState(); renderHome(); }
  const action = notifDeepLink(n);
  back('notifications', 'home');                    /* keep stack tidy */
  setTimeout(action, 320);
}
function archiveNotif(id){
  if(!state.archivedNotifIds.includes(id)) state.archivedNotifIds.push(id);
  saveState(); renderNotifications(); renderHome();
  toast('Archived');
}
let __notifSwipeAttached = false;
function attachNotifSwipe(){
  const root = document.getElementById('notifList'); if(!root || __notifSwipeAttached) return;
  __notifSwipeAttached = true;
  let active = null, startX = 0, startY = 0, dx = 0, axis = '', dragging = false;
  const THRESH = 40, MAX = 92;
  const onStart = e => {
    const wrap = e.target.closest('.notif-wrap'); if(!wrap) return;
    root.querySelectorAll('.notif-wrap.revealed').forEach(w => { if(w !== wrap) w.classList.remove('revealed'); });
    active = wrap;
    const t = e.touches ? e.touches[0] : e;
    startX = t.clientX; startY = t.clientY; dx = 0; axis = ''; dragging = true;
    wrap.classList.add('dragging');
  };
  const onMove = e => {
    if(!dragging || !active) return;
    const t = e.touches ? e.touches[0] : e;
    const dxRaw = t.clientX - startX, dyRaw = t.clientY - startY;
    if(!axis){ if(Math.abs(dxRaw) > 8 || Math.abs(dyRaw) > 8) axis = Math.abs(dxRaw) > Math.abs(dyRaw) ? 'x' : 'y'; }
    if(axis !== 'x') return;
    const startedRevealed = active.classList.contains('revealed');
    let next = startedRevealed ? -MAX + dxRaw : dxRaw;
    next = Math.min(0, Math.max(-MAX, next));
    dx = next;
    active.querySelector('.notif').style.transform = `translateX(${dx}px)`;
    if(e.cancelable) e.preventDefault?.();
  };
  const onEnd = () => {
    if(!dragging || !active){ dragging = false; return; }
    dragging = false;
    active.classList.remove('dragging');
    active.querySelector('.notif').style.transform = '';
    if(axis === 'x') active.classList.toggle('revealed', dx < -THRESH);
    active = null;
  };
  root.addEventListener('touchstart', onStart, { passive:true });
  root.addEventListener('mousedown',  onStart);
  document.addEventListener('touchmove', onMove, { passive:false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchend',  onEnd);
  document.addEventListener('mouseup',   onEnd);
  document.addEventListener('touchcancel', onEnd);
}

/* ============================================================
   CARD ART SELECTION
   ============================================================ */
const CARD_DESIGNS = [
  { id:'graphite', name:'Graphite', desc:'Signature' },
  { id:'cobalt',   name:'Cobalt',   desc:'Meridian blue' },
  { id:'aurora',   name:'Aurora',   desc:'Limited edition' },
  { id:'emerald',  name:'Emerald',  desc:'Travel' },
  { id:'sand',     name:'Sand',     desc:'Matte' },
  { id:'rose',     name:'Rosewood', desc:'Deep red' },
];
function applyCardDesign(){
  const el = document.getElementById('creditCard');
  const id = CARD_DESIGNS.some(d => d.id === state.cardDesign) ? state.cardDesign : 'graphite';
  if(el) el.setAttribute('data-design', id);
}
function openCardArt(){
  document.getElementById('sheetTitle').textContent = 'Card design';
  document.getElementById('sheetBody').innerHTML = `
    <p style="font-size:14px;color:var(--muted);font-weight:500;margin:0 0 12px">Pick a design — the preview updates instantly.</p>
    <div class="design-grid">
      ${CARD_DESIGNS.map(d => `
        <button class="design-tile ${state.cardDesign===d.id?'active':''}" data-design="${d.id}" aria-pressed="${state.cardDesign===d.id}" style="font:inherit;text-align:left">
          <div class="top">${escapeHtml(d.name)}<div style="font-size:10px;opacity:.7;font-weight:500">${escapeHtml(d.desc)}</div></div>
          <div class="num">•••• 4827</div>
        </button>
      `).join('')}
    </div>
    <p style="font-size:12px;color:var(--muted);font-weight:500;margin:0 0 4px;line-height:1.5">Your first design change each year is free. We’ll mail a new card in 5–7 business days; Apple Pay and Google Pay artwork updates right away.</p>
  `;
  document.querySelectorAll('.design-tile').forEach(tile => {
    tile.addEventListener('click', () => {
      state.cardDesign = tile.dataset.design;
      saveState();
      document.querySelectorAll('.design-tile').forEach(t => { t.classList.toggle('active', t === tile); t.setAttribute('aria-pressed', t === tile); });
      applyCardDesign();
      toast(CARD_DESIGNS.find(d => d.id === tile.dataset.design).name + ' selected');
    });
  });
  openSheetRaw();
}

/* ============================================================
   BOOT
   ============================================================ */
function boot(){
  applyTheme();
  renderOnboard();
  paintStatusBar();
  showSkelAccounts();
  setTimeout(()=>{ renderHome(); renderWeekBars(); }, 380);
  renderStatements();
  renderNotifications();
  updateCardSummaries();
  updateNotifSummary();
  renderTrackerBannerOnCards();
  applyCardDesign();
  renderProfileHeader();
  renderCardsScreen();
  attachSheetDrag();
  // pull-to-refresh
  attachPTR('homeScroll',  'ptrHome',  ()=>{ lastUpdated = Date.now(); renderHome(); });
  attachPTRMouse('homeScroll', 'ptrHome', ()=>{ lastUpdated = Date.now(); renderHome(); });
  attachPTR('detailScroll','ptrDetail',()=>{ if(activeId) renderTransactions(activeId); });
  attachPTRMouse('detailScroll','ptrDetail',()=>{ if(activeId) renderTransactions(activeId); });
  // sync bio switch — reconcile saved state against real WebAuthn support
  const bioSw = document.getElementById('bioSwitch');
  const bioLb = document.getElementById('bioLabel');
  const bioRow = bioSw ? bioSw.closest('.li') : null;
  if(!webAuthnAvailable()){
    state.bioEnabled = false; state.bioCredentialId = null; saveState();
    if(bioSw) bioSw.classList.remove('on');
    if(bioLb) bioLb.textContent = 'Not supported';
    if(bioRow) bioRow.style.opacity = '0.55';
  } else {
    // If toggle was on but no credential exists yet, treat it as off until enrolled.
    if(state.bioEnabled && !state.bioCredentialId){
      state.bioEnabled = false; saveState();
    }
    if(bioSw) bioSw.classList.toggle('on', state.bioEnabled);
    if(bioLb) bioLb.textContent = state.bioEnabled ? 'Enabled' : 'Not set up';
    platformAuthenticatorAvailable().then(ok => {
      if(!ok && bioLb && !state.bioEnabled) bioLb.textContent = 'Unavailable';
    });
  }
  const pcMeta = document.getElementById('passcodeMeta');
  if(pcMeta) pcMeta.textContent = 'Last changed ' + (state.passcodeChangedAt || 'recently');
  const soMeta = document.getElementById('signOutMeta');
  if(soMeta) soMeta.textContent = `After ${state.signOutAfter} minute${state.signOutAfter===1?'':'s'}`;
  const lkSum = document.getElementById('linkedSummary');
  if(lkSum) lkSum.textContent = `${state.linkedAccounts.length} external account${state.linkedAccounts.length===1?'':'s'}`;
  const beSum = document.getElementById('beneSummary');
  if(beSum) beSum.textContent = `${state.beneficiaries.length} on file`;
  // home scroll shadow
  ['homeScroll','detailScroll','transferScroll','cardsScroll','helpScroll','profileScroll'].forEach(id=>{
    const sc = document.getElementById(id);
    if(!sc) return;
    sc.addEventListener('scroll', ()=> sc.classList.toggle('shadowed', sc.scrollTop > 4));
  });
}

setTimeout(()=>{
  boot();
  document.getElementById('splash').classList.add('fade-out');
  setTimeout(()=>{
    document.getElementById('splash').style.display='none';
    let next;
    if(!state.hasOnboarded){ next = 'onboarding'; }
    else { next = 'lock'; }
    document.getElementById(next).classList.remove('enter-right');
    document.getElementById(next).classList.add('active');
    current = next;
    updateStatusBarTone();
    if(next === 'lock'){
      lockClock();
      if(!state.pin) lockSetMode('setup'); else lockSetMode('verify');
    }
    // seed an initial history entry so popstate has somewhere to go back to
    try { history.replaceState({ screen: current, root: true }, ''); } catch(e){}
    // PWA shortcut deep links are honoured only after the user unlocks
    const hash = (location.hash || '').slice(1);
    if(DEEP_LINKS[hash]) PENDING_LINK = hash;
  }, 320);
}, 1500);

/* ============================================================
   PWA: standalone detection, history-based back, SW registration,
   "Add to Home Screen" prompt
   ============================================================ */
(function pwa(){
  /* --- Standalone detection --- */
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
                    || window.navigator.standalone === true
                    || document.referrer.startsWith('android-app://');
  if(isStandalone){
    document.documentElement.classList.add('standalone');
  }
  /* re-check if user enters/exits fullscreen / standalone mid-session */
  window.matchMedia('(display-mode: standalone)').addEventListener?.('change', ev => {
    document.documentElement.classList.toggle('standalone', ev.matches);
  });

  /* --- iOS detection (for A2HS hint) --- */
  const ua = navigator.userAgent || '';
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !window.MSStream;
  const isSafari = isIOS && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);

  /* --- A2HS banner (only on iOS Safari, only outside standalone, dismissable) --- */
  function maybeShowInstall(){
    if(isStandalone) return;
    const dismissed = localStorage.getItem('meridian.installDismissed');
    if(dismissed){
      const ago = Date.now() - parseInt(dismissed, 10);
      if(ago < 7*24*60*60*1000) return;            /* show again after 7 days */
    }
    if(!isIOS || !isSafari) return;
    setTimeout(()=>{
      const el = document.getElementById('iosInstall');
      if(el) el.classList.add('show');
    }, 4500);
  }
  window.dismissInstall = function(){
    const el = document.getElementById('iosInstall');
    if(el) el.classList.remove('show');
    localStorage.setItem('meridian.installDismissed', String(Date.now()));
  };

  /* Chrome / Edge install prompt */
  let deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferredPrompt = e;
    /* repurpose the iOS banner with native prompt on tap */
    const el = document.getElementById('iosInstall');
    if(!el) return;
    if(localStorage.getItem('meridian.installDismissed')) return;
    el.querySelector('.meta b').textContent = 'Install Meridian';
    el.querySelector('.meta span').textContent = 'Tap to install on your home screen';
    el.style.cursor = 'pointer';
    el.onclick = async () => {
      if(!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if(outcome === 'accepted') toast('Installing…');
      deferredPrompt = null;
      el.classList.remove('show');
    };
    setTimeout(()=> el.classList.add('show'), 4500);
  });
  window.addEventListener('appinstalled', () => {
    window.dismissInstall && window.dismissInstall();
    toast('Welcome to Meridian');
  });
  maybeShowInstall();

  /* --- History-API based screen stack so iOS edge-swipe goes back --- */
  const screenStack = [];
  const ROOT_SCREENS = new Set(['lock','splash','onboarding','home']);
  const _go4 = window.go;
  const _back4 = window.back;
  /* where a back button should return to: the screen we actually came from */
  window.prevScreen = fallback => screenStack.length ? screenStack[screenStack.length - 1] : fallback;

  /* screens we never want to leave on the back stack */
  const NO_STACK = new Set(['splash','lock','onboarding']);
  window.go = function(toId){
    if(toId !== current && toId !== 'splash' && !NO_STACK.has(current)){
      screenStack.push(current);
      try { history.pushState({ screen: toId, depth: screenStack.length }, '', '#'+toId); } catch(e){}
    }
    _go4(toId);
  };
  window.back = function(fromId, toId){
    /* Pop our stack to keep it in sync with the browser stack */
    if(screenStack.length && screenStack[screenStack.length-1] === toId) screenStack.pop();
    _back4(fromId, toId);
  };

  window.addEventListener('popstate', e => {
    const st = e.state || {};
    /* never escape lock or splash via back */
    if(current === 'lock' || current === 'splash'){
      try { history.pushState({ screen: current, root:true }, '', '#'+current); } catch(_){}
      return;
    }
    if(screenStack.length){
      const prev = screenStack.pop();
      _back4(current, prev);
      updateStatusBarTone && updateStatusBarTone();
    } else if(!ROOT_SCREENS.has(current)){
      _back4(current, 'home');
    } else {
      /* at root — re-pin ourselves so the user can't pop out of the PWA */
      try { history.pushState({ screen: current, root:true }, '', '#'+current); } catch(_){}
    }
  });

  /* --- Service worker registration --- */
  if('serviceWorker' in navigator){
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('banking-sw.js', { scope: './' }).then(reg => {
        /* poll for updates while running */
        reg.update?.();
        reg.addEventListener?.('updatefound', () => {
          const sw = reg.installing;
          sw && sw.addEventListener('statechange', () => {
            if(sw.state === 'installed' && navigator.serviceWorker.controller){
              /* there's a new version; activate it on next launch */
              sw.postMessage('skipWaiting');
            }
          });
        });
      }).catch(()=>{ /* SW unsupported / offline / file:// — silent */ });
    });
  }

  /* --- iOS double-tap zoom block (the meta covers most cases, but on
       very old iOS this catches the rest) --- */
  let lastTouch = 0;
  document.addEventListener('touchend', e => {
    const now = Date.now();
    if(now - lastTouch < 300){ e.preventDefault(); }
    lastTouch = now;
  }, { passive:false });

  /* --- visibility hooks: re-lock the app when backgrounded for a while --- */
  let backgroundedAt = null;
  document.addEventListener('visibilitychange', () => {
    if(document.hidden){
      backgroundedAt = Date.now();
    } else if(backgroundedAt && state.pin && state.signedIn){
      const ms = Date.now() - backgroundedAt;
      backgroundedAt = null;
      if(ms > 60_000 && current !== 'lock'){
        state.signedIn = false; saveState();
        if(typeof lockShow === 'function') lockShow();
      }
    }
  });
})();
