(() => {
  'use strict';

  /* ------------------------------------------------------------------ *
   * CONFIGURATION
   * ------------------------------------------------------------------ */
  // URL du déploiement Apps Script (Application Web) de CE site, à coller ici (voir CONFIGURATION.md).
  const ENDPOINT = 'https://script.google.com/macros/s/AKfycbxC-ESk26sKN3rW9a3nJEwRwy3T8ROOTk7UdJKGaN6QYqIbbI5BNFwUWDNuH31p8mB5FA/exec';

  // Les 4 axes du projet d'établissement 2026-2030 (titres du document de méthode).
  const AXES = [
    { n: 1, court: 'Réussir et grandir', titre: 'Réussir et grandir : réussite et parcours de chaque élève' },
    { n: 2, court: 'Langues, cultures et ouverture au monde', titre: 'Langues, cultures et ouverture au monde' },
    { n: 3, court: 'Sport, santé, bien-être et citoyenneté', titre: 'Sport, santé, bien-être et citoyenneté' },
    { n: 4, court: 'Construire ensemble l\'école de demain', titre: 'Construire ensemble l\'école de demain' }
  ];
  const PDF_URL = 'assets/projet-etablissement-2026-2030.pdf';
  const DRIVE_URL = 'https://drive.google.com/drive/folders/1JtXAPRibfLMAkrSsocTc8rLcPhhfkHUR';
  const GROUPS_PER_AXE = 5;       // nombre de groupes proposés par axe
  const MAX_PRESENT = 6;          // personnes max. devant un même écran
  const WORK_MINUTES = 45;        // durée d'une séquence de travail
  const WARN_MINUTES = 5;         // alerte avant la fin
  const POLL_MS = 30000;

  // Trame commune du document de méthode (identique à celle posée par le serveur).
  const TRAME = [
    { n: 1, titre: 'Diagnostic', desc: 'Points forts, difficultés et besoins identifiés.' },
    { n: 2, titre: 'Objectif général', desc: 'Ambition poursuivie à l\'horizon 2030.' },
    { n: 3, titre: 'Sous-objectifs', desc: 'Trois ou quatre priorités par axe.' },
    { n: 4, titre: 'Actions', desc: 'Dispositifs existants à consolider et nouvelles actions envisageables.' },
    { n: 5, titre: 'Indicateurs', desc: 'Éléments permettant de mesurer les progrès.' },
    { n: 6, titre: 'Critères d\'évaluation', desc: 'Résultats attendus pour apprécier l\'atteinte des objectifs.' }
  ];

  // Questions qui guident chaque point de la trame (communes à tous les axes).
  const GUIDES_COMMUNS = {
    1: ['Quels sont nos points forts, à conserver et à valoriser ?', 'Quelles difficultés et quels besoins constatons-nous (élèves, familles, équipes) ?'],
    2: ['Quelle ambition voulons-nous atteindre à l\'horizon 2030 ?', 'Comment la formuler en une phrase claire, partagée par tous ?'],
    3: ['Quelles sont les 3 ou 4 priorités qui permettraient d\'atteindre cet objectif ?', 'Dans quel ordre les hiérarchiser, et pourquoi ?'],
    4: ['Quels dispositifs existants faut-il consolider ?', 'Quelles nouvelles actions, réalistes, proposer ?'],
    5: ['Qu\'est-ce qui permettrait de mesurer concrètement les progrès ?', 'De quelles données disposons-nous déjà (enquêtes, résultats, observations) ?'],
    6: ['Quels résultats attendus montreraient que l\'objectif est atteint ?', 'À quelle échéance les évaluer (chaque année, mi-parcours, 2030) ?']
  };

  // Questions propres à chaque axe, ajoutées à celles ci-dessus.
  const GUIDES_AXE = {
    1: {
      1: ['Comment se passent la réussite et le parcours des élèves aux différents paliers (maternelle, élémentaire, collège, lycée) ?', 'Les élèves en difficulté comme les élèves à haut potentiel sont-ils bien repérés et accompagnés ?'],
      4: ['Quels dispositifs d\'aide, de soutien ou d\'approfondissement faut-il renforcer ?']
    },
    2: {
      1: ['Quelle place ont aujourd\'hui le français, le grec et l\'anglais dans la vie de l\'établissement ?', 'Comment les langues et cultures d\'origine de nos élèves sont-elles reconnues ?'],
      4: ['Quels projets, échanges ou partenariats existent et sont à consolider ?']
    },
    3: {
      1: ['Comment les élèves et les personnels perçoivent-ils le climat scolaire et leur bien-être ?', 'Quelle place ont le sport, la santé et l\'engagement citoyen dans la vie des élèves ?'],
      4: ['Quelles actions de prévention, de santé ou d\'engagement citoyen faut-il consolider ou créer ?']
    },
    4: {
      1: ['Comment fonctionnent aujourd\'hui la communication, le travail collectif et la relation avec les familles ?', 'Quels besoins repérons-nous en formation, en outils et en locaux ?'],
      4: ['Quelles pratiques collectives ou organisationnelles faut-il faire évoluer ?']
    }
  };

  // Pistes de sous-objectifs à examiner, par axe (idées de départ, à discuter).
  const PISTES = {
    1: ['Évaluation et progrès de chaque élève', 'Accompagnement différencié et école inclusive', 'Continuité des parcours entre les degrés', 'Orientation et poursuite d\'études', 'Valorisation de l\'excellence et des talents'],
    2: ['Plurilinguisme français-grec-anglais', 'Certifications et parcours linguistiques', 'Ouverture culturelle et partenariats locaux', 'Échanges, mobilités et ouverture internationale', 'Identité franco-chypriote et valeurs partagées'],
    3: ['Climat scolaire et prévention du harcèlement', 'Sport et santé', 'Bien-être des élèves et des personnels', 'Engagement, vie lycéenne et citoyenneté', 'Éducation aux médias et au numérique responsable'],
    4: ['Gouvernance, communication et relations avec les familles', 'Travail collectif et formation des équipes', 'Numérique et intelligence artificielle au service des apprentissages', 'Locaux, sécurité et développement durable', 'Pilotage, suivi et évaluation du projet']
  };

  const guidesFor = (axe, ordre) => (GUIDES_COMMUNS[ordre] || []).concat((GUIDES_AXE[axe] || {})[ordre] || []);

  /* ------------------------------------------------------------------ *
   * OUTILS
   * ------------------------------------------------------------------ */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* stockage indisponible */ } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } }
  };

  function h(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  const axeOf = n => AXES.find(a => a.n === Number(n)) || { n, court: 'Axe ' + n, titre: 'Axe ' + n };
  const groupLabel = g => `Axe ${g.axe} · Groupe ${g.numero}`;
  const sameName = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();
  const fullName = m => `${m.prenom || ''} ${m.nom || ''}`.trim();
  const GROUP_AUTHOR = 'Tout le groupe';

  function fmtDate(iso) {
    const d = new Date(iso);
    if (!iso || isNaN(d)) return '';
    return d.toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  }

  function toast(msg) {
    const el = $('#peToast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toast._t);
    toast._t = setTimeout(() => el.classList.remove('show'), 3600);
  }

  function setSync(text, err) {
    const el = $('#peSync');
    el.textContent = text || '';
    el.className = 'pe-sync' + (err ? ' err' : '');
  }

  function renderFlash(key) {
    const f = flash[key];
    return f ? `<div class="${f.type === 'error' ? 'pe-error' : 'pe-ok'}">${h(f.text)}</div>` : '';
  }

  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }

  function b64ToBlob(b64, type) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type });
  }

  /* ------------------------------------------------------------------ *
   * ÉTAT
   * ------------------------------------------------------------------ */
  let activeTab = 'travail';
  const flash = { travail: null, admin: null };
  let slots = store.get('pe_slots', []);                 // [{axe, numero, statut}] — aucun nom, aucun contenu
  let session = store.get('pe_session', null);           // { groupId, pin, axe, numero }
  let present = session ? store.get('pe_present_' + session.groupId, []) : [];
  let grp = null;                                        // { groupe, rubriques, contributions } du groupe en cours
  let step = (session && present.length) ? 'work' : 'choose';   // choose | who | work
  let slot = null;                                       // { axe, numero } en cours de choix
  let editingPresent = false;
  let draft = [];
  let activeAuthor = null;
  let editingId = null;
  let loading = false;

  let adminCode = null;
  try { adminCode = sessionStorage.getItem('pe_admin') || null; } catch (e) { adminCode = null; }
  let adminData = null;
  let adminAxe = 'all';
  let exportResult = null;

  const slotOf = (axe, numero) => slots.find(s => Number(s.axe) === Number(axe) && Number(s.numero) === Number(numero));

  function currentAuthor() {
    if (activeAuthor && (activeAuthor === GROUP_AUTHOR || present.includes(activeAuthor))) return activeAuthor;
    if (present.length === 1) return present[0];
    return null;
  }

  /* ------------------------------------------------------------------ *
   * API (Apps Script)
   * ------------------------------------------------------------------ */
  function requireEndpoint() {
    if (!ENDPOINT) throw new Error('Le service n\'est pas encore configuré (adresse Apps Script manquante dans projet.js).');
  }

  async function parseResponse(res) {
    const text = (await res.text()).trim();
    if (!res.ok) throw new Error(`Le serveur a répondu HTTP ${res.status}.`);
    if (!text) throw new Error('Réponse vide du serveur.');
    try { return JSON.parse(text); } catch (e) {
      if (/<!doctype|<html/i.test(text)) throw new Error('Le service Google a renvoyé une page au lieu de données : le script n\'est probablement pas redéployé ou pas autorisé.');
      throw new Error('Réponse du serveur illisible.');
    }
  }

  async function apiGet(action) {
    requireEndpoint();
    let res;
    try { res = await fetch(`${ENDPOINT}?action=${encodeURIComponent(action)}&t=${Date.now()}`, { redirect: 'follow' }); }
    catch (e) { throw new Error('Connexion impossible. Vérifie ta connexion internet.'); }
    return parseResponse(res);
  }

  async function apiPost(payload) {
    requireEndpoint();
    let res;
    try {
      res = await fetch(ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(payload), redirect: 'follow' });
    } catch (e) { throw new Error('Connexion impossible. Vérifie ta connexion internet.'); }
    const out = await parseResponse(res);
    if (!out.ok) throw new Error(out.error || 'Erreur inconnue.');
    return out;
  }

  /** Action sur le groupe en cours : joint automatiquement l'identifiant et le code du groupe. */
  const gp = extra => Object.assign({ groupId: session && session.groupId, pin: session && session.pin }, extra);

  async function refreshSlots() {
    const out = await apiGet('pe_slots');
    if (!out.ok) throw new Error(out.error || 'Erreur de lecture.');
    slots = out.slots || [];
    store.set('pe_slots', slots);
  }

  async function loadGroup() {
    const out = await apiPost(gp({ action: 'pe_group' }));
    grp = { groupe: out.groupe, rubriques: out.rubriques, contributions: out.contributions };
  }

  async function refresh(silent) {
    if (loading) return;
    loading = true;
    if (!silent) setSync('Actualisation…');
    try {
      if (activeTab === 'admin') {
        if (adminCode) await loadAdmin();
      } else if (step === 'work' && session) {
        await loadGroup();
      }
      setSync('Synchronisé à ' + new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }));
    } catch (e) {
      if (step === 'work' && /Accès refusé|introuvable/i.test(e.message)) {
        leaveGroup(); flash.travail = { type: 'error', text: 'Ce groupe n\'est plus accessible (supprimé ou code modifié). Choisis ton groupe à nouveau.' };
      } else {
        setSync('⚠️ ' + e.message, true);
      }
    } finally {
      loading = false;
      renderAll();
    }
  }

  async function act(payload, okMessage, flashKey) {
    try {
      const out = await apiPost(payload);
      if (flashKey) flash[flashKey] = null;
      if (okMessage) toast(okMessage);
      if (activeTab === 'travail' && step === 'work') await loadGroup();
      renderAll();
      return out;
    } catch (e) {
      if (flashKey) flash[flashKey] = { type: 'error', text: e.message };
      toast('⚠️ ' + e.message);
      renderAll();
      return null;
    }
  }

  /* ------------------------------------------------------------------ *
   * MINUTEUR (séquence de travail du groupe)
   * ------------------------------------------------------------------ */
  let timer = null;       // { total, left, endAt, warned, done }
  let tickHandle = null;

  const timerKey = () => 'pe_timer_' + (session ? session.groupId : 'x');

  function loadTimer() {
    const t = store.get(timerKey(), null);
    timer = t || { total: WORK_MINUTES * 60000, left: WORK_MINUTES * 60000, endAt: null, warned: false, done: false };
  }

  function saveTimer() { store.set(timerKey(), timer); }

  function timerLeft() { return timer.endAt ? Math.max(0, timer.endAt - Date.now()) : timer.left; }

  function fmtClock(ms) {
    const s = Math.ceil(ms / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }

  function beep(times) {
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      const ctx = new Ctx();
      for (let i = 0; i < times; i++) {
        const o = ctx.createOscillator(), g = ctx.createGain();
        o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
        const t0 = ctx.currentTime + i * 0.35;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(0.25, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.28);
        o.start(t0); o.stop(t0 + 0.3);
      }
    } catch (e) { /* son indisponible */ }
  }

  function timerHTML() {
    if (!timer) return '';
    const left = timerLeft();
    const running = !!timer.endAt;
    const cls = left <= 0 ? 'over' : (left <= WARN_MINUTES * 60000 ? 'warn' : '');
    return `
      <span class="pe-timer-label">⏱ Séquence de travail</span>
      <span class="pe-clock ${cls}" id="peClock">${fmtClock(left)}</span>
      <span class="pe-timer-btns">
        ${running
          ? '<button class="btn secondary small" data-action="timer-pause" type="button">⏸ Pause</button>'
          : `<button class="btn primary small" data-action="timer-start" type="button">▶ ${left < timer.total && left > 0 ? 'Reprendre' : 'Démarrer'}</button>`}
        <button class="btn ghost small" data-action="timer-reset" type="button">↺ Remettre à ${Math.round(timer.total / 60000)} min</button>
      </span>
      <span class="pe-timer-msg" id="peTimerMsg">${left <= 0 ? '⏰ Temps écoulé : concluez et envoyez votre document.' : (left <= WARN_MINUTES * 60000 && running ? `⚠️ Il reste moins de ${WARN_MINUTES} minutes.` : '')}</span>`;
  }

  function updateTimerUI() {
    const box = $('#peTimer');
    if (box) box.innerHTML = timerHTML();
  }

  function tick() {
    if (!timer || !timer.endAt) return;
    const left = timerLeft();
    const clock = $('#peClock');
    if (clock) {
      clock.textContent = fmtClock(left);
      clock.className = 'pe-clock ' + (left <= 0 ? 'over' : (left <= WARN_MINUTES * 60000 ? 'warn' : ''));
    }
    if (!timer.warned && left <= WARN_MINUTES * 60000 && left > 0) {
      timer.warned = true; saveTimer(); beep(2); toast(`⏱ Il reste ${WARN_MINUTES} minutes.`); updateTimerUI();
    }
    if (left <= 0 && !timer.done) {
      timer.done = true; timer.left = 0; timer.endAt = null; saveTimer(); beep(4); toast('⏰ Temps écoulé !'); updateTimerUI();
    }
  }

  function startTicking() {
    clearInterval(tickHandle);
    tickHandle = setInterval(tick, 1000);
  }

  /* ------------------------------------------------------------------ *
   * ONGLETS
   * ------------------------------------------------------------------ */
  function showTab(name) {
    activeTab = name;
    $$('.pe-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
    $$('.pe-view').forEach(v => v.classList.toggle('visible', v.dataset.view === name));
    editingId = null;
    renderAll();
    if (name === 'admin' && adminCode) refresh(true);
    if (name === 'travail') refresh(true);
    try { history.replaceState(null, '', '#' + name); } catch (e) { /* ignore */ }
  }

  /* ------------------------------------------------------------------ *
   * VUE TRAVAIL
   * ------------------------------------------------------------------ */
  function renderTravail() {
    const root = $('#view-travail');
    if (step === 'work' && session && grp && present.length) { root.innerHTML = renderWorkspace(); return; }
    if (step === 'work' && session) { root.innerHTML = '<div class="pe-card"><div class="pe-empty">Chargement de ton groupe…</div></div>'; return; }
    if (step === 'who' && slot) { root.innerHTML = renderWho(); return; }
    step = 'choose';
    root.innerHTML = renderChooser();
  }

  const METHODE = `
    <details class="pe-method"><summary>📋 Rappel de la méthode et de la trame de travail</summary>
      <p>Le projet d'établissement 2026-2030 s'élabore de façon collaborative. Pendant chaque séquence de <b>45 minutes</b>, votre groupe travaille sur <b>un axe</b> en suivant la trame commune :</p>
      <ol>${TRAME.map(t => `<li><b>${h(t.titre)}</b> — ${h(t.desc)}</li>`).join('')}</ol>
      <p>L'objectif : faire émerger des propositions concrètes et réalistes. Vous pouvez écrire en français, en grec ou en anglais. Votre travail n'est visible que de votre groupe et de l'équipe de coordination.</p>
    </details>`;

  const pdfBlock = (open, id) => `
    <details class="pe-method" ${open ? 'open' : ''}><summary>📄 Projet d'établissement 2026-2030 — document de référence</summary>
      <p class="pe-hint">Le document de méthode fourni par la direction. Consultez-le pendant votre travail.</p>
      <div class="pe-actions" style="margin:6px 0 10px">
        <a class="btn primary small" href="${PDF_URL}" download style="text-decoration:none">⬇ Télécharger le PDF</a>
        <a class="btn ghost small" href="${PDF_URL}" target="_blank" rel="noopener" style="text-decoration:none">Ouvrir dans un nouvel onglet</a>
      </div>
      <iframe class="pe-pdf" title="Projet d'établissement 2026-2030" src="${PDF_URL}#view=FitH" loading="lazy"></iframe>
      <p class="pe-hint">Si le document ne s'affiche pas dans le cadre (certains téléphones), utilisez les boutons ci-dessus.</p>
    </details>`;

  const TUTO = `
    <details class="pe-method" open><summary>🧭 Comment ça marche ? (tutoriel)</summary>
      <ol class="pe-tuto">
        <li><b>Choisissez votre axe</b> en cliquant dessus : votre groupe est créé automatiquement.</li>
        <li><b>Indiquez qui travaille sur cet ordinateur</b> : prénom, nom ou pseudonyme, comme vous préférez (jusqu'à 6 personnes).</li>
        <li><b>Notez votre code de reprise</b>, affiché en haut de la page de travail : il permet de retrouver votre groupe plus tard ou depuis un autre ordinateur (« Reprendre un groupe déjà commencé » sur cette page).</li>
        <li><b>Suivez la trame en 6 points</b> (diagnostic, objectif général, sous-objectifs, actions, indicateurs, critères d'évaluation). Répondez aux questions pour guider, ou ajoutez une contribution libre. Avant d'écrire, cliquez sur votre nom dans « Qui écrit ? ».</li>
        <li><b>Gardez un œil sur le minuteur</b> : une séquence dure 45 minutes. Il vous prévient 5 minutes avant la fin, sans vous empêcher d'écrire.</li>
        <li><b>Envoyez votre travail</b> avec « Envoyer au Drive » (vous pouvez le refaire autant de fois que vous voulez) et/ou imprimez-le.</li>
      </ol>
      <p class="pe-hint">Votre travail s'enregistre au fur et à mesure et n'est visible que de votre groupe et de l'équipe de coordination.</p>
    </details>`;

  /* Étape 1 : choisir l'axe (le groupe est créé automatiquement) */
  function renderChooser() {
    const cards = AXES.map(a => `
      <div class="pe-slot">
        <b>Axe ${a.n}</b>
        <small>${h(a.titre)}</small>
        <div class="pe-slot-actions"><button class="btn primary small" data-action="pick-axe" data-axe="${a.n}" type="button">Travailler sur cet axe</button></div>
      </div>`).join('');
    return `
      <div class="pe-card">
        <span class="pe-eyebrow" style="color:var(--magenta)">Étape 1 sur 2</span>
        <h2>Sur quel axe travaillez-vous ?</h2>
        <p class="pe-lead">Cliquez sur votre axe : votre groupe est créé automatiquement. Vous indiquerez ensuite qui travaille sur cet ordinateur.</p>
        ${renderFlash('travail')}
        ${TUTO}
        ${pdfBlock(true)}
        <h3 style="margin-top:18px">Choisissez votre axe</h3>
        <div class="pe-slots">${cards}</div>
        <details class="pe-method" style="margin-top:18px" ${flash.travail ? "open" : ""}><summary>🔑 Reprendre un groupe déjà commencé</summary>
          <form id="resumeForm" class="pe-row" autocomplete="off" style="margin-top:10px">
            <label style="flex:1 1 220px">Code de reprise<input type="text" name="pin" required maxlength="30" autocapitalize="characters" data-ignore-pending placeholder="Ex. K7M2QX"></label>
            <button class="btn secondary" type="submit">Reprendre</button>
          </form>
        </details>
      </div>`;
  }

  /* Étape 2 : qui est devant l'écran + code du groupe */
  function renderWho() {
        const known = editingPresent && grp ? (grp.groupe.membres || []).map(fullName) : [];
    const all = [...new Set(known.concat(draft))];
    const chips = all.length ? all.map(n => `
      <button class="pe-person ${draft.includes(n) ? 'on' : ''}" data-action="toggle-person" data-name="${h(n)}" type="button">${draft.includes(n) ? '✅' : '＋'} ${h(n)}</button>`).join('')
      : '<span class="pe-empty">Personne pour le moment : ajoute les noms ci-dessous.</span>';
    const a = axeOf(slot.axe);

    return `
      <div class="pe-card">
        <button class="pe-link" data-action="back-choose" type="button">← Changer d'axe</button>
        <span class="pe-eyebrow" style="color:var(--magenta);display:block;margin-top:8px">Étape 2 sur 2</span>
        <h2>Axe ${h(slot.axe)}</h2>
        <p class="pe-lead"><b>${h(a.titre)}</b></p>
        <p class="pe-lead">Qui travaille <b>sur cet ordinateur</b> ? Écris un prénom, un nom ou un pseudonyme : comme tu préfères.</p>
        <div class="pe-people">${chips}</div>
        <form id="personForm" class="pe-row" autocomplete="off" style="margin-top:14px">
          <label style="flex:2 1 260px">Prénom, nom ou pseudonyme<input type="text" name="nom" maxlength="80" data-ignore-pending></label>
          <button class="btn secondary" type="submit">➕ Ajouter</button>
        </form>
        ${renderFlash('travail')}
        <div class="pe-actions">
          <button class="btn primary" data-action="start-work" type="button" ${draft.length ? '' : 'disabled'}>${editingPresent ? 'Enregistrer' : 'Commencer à travailler'} (${draft.length}) →</button>
        </div>
      </div>`;
  }

  function renderWhoBar() {
    const ca = currentAuthor();
    const chips = present.map(n => `<button class="pe-person ${ca === n ? 'on' : ''}" data-action="set-author" data-name="${h(n)}" type="button">${h(n)}</button>`).join('');
    const all = present.length > 1 ? `<button class="pe-person ${ca === GROUP_AUTHOR ? 'on' : ''}" data-action="set-author" data-name="${h(GROUP_AUTHOR)}" type="button">👥 ${GROUP_AUTHOR}</button>` : '';
    return `
      <div class="pe-who" id="whoBar">
        <b>✍️ Qui écrit ?</b>
        <div class="pe-people">${chips}${all}</div>
        ${ca ? '' : '<span class="pe-hint" style="color:#ad1c28;font-weight:700">Clique sur ton nom avant d\'écrire.</span>'}
        <button class="pe-link" data-action="change-present" type="button">👥 Modifier les personnes présentes</button>
      </div>`;
  }

  function contribActions(c) {
    return `<span class="pe-mini">
      <button class="pe-link" data-action="edit" data-id="${h(c.id)}" type="button">Modifier</button>
      <button class="pe-link danger" data-action="del-contrib" data-id="${h(c.id)}" type="button">Supprimer</button>
    </span>`;
  }

  function contribHtml(c) {
    if (editingId === c.id) {
      return `<div class="pe-r">
        <textarea class="pe-ta" id="editBox" data-ignore-pending>${h(c.texte)}</textarea>
        <div class="pe-actions">
          <button class="btn primary small" data-action="save-edit" data-id="${h(c.id)}" data-kind="contrib" type="button">Enregistrer</button>
          <button class="btn ghost small" data-action="cancel-edit" type="button">Annuler</button>
        </div></div>`;
    }
    return `<div class="pe-r">
      <div class="pe-txt">${h(c.texte)}</div>
      <div class="pe-by">${h(c.auteur)} · ${h(fmtDate(c.creeLe))}${c.majLe && c.majLe !== c.creeLe ? ' · modifié' : ''}${contribActions(c)}</div>
    </div>`;
  }

  function rubriqueBody(r, contribs) {
    const axe = grp.groupe.axe;
    const mine = contribs.filter(c => c.rubriqueId === r.id);
    const isTrame = r.ordre !== '';
    let html = '';

    if (isTrame) {
      const ordre = Number(r.ordre);
      const guides = guidesFor(axe, ordre);
      const extraGuides = [...new Set(mine.map(c => c.guide).filter(g => g && !guides.includes(g)))];
      guides.concat(extraGuides).forEach((q, i) => {
        const answers = mine.filter(c => c.guide === q);
        html += `
          <div class="pe-q">
            <span class="pe-q-label">Question pour guider</span>
            <div class="pe-txt"><b>${h(q)}</b></div>
            ${answers.map(contribHtml).join('')}
            <details class="pe-add"><summary>+ Répondre à cette question</summary>
              <textarea class="pe-ta" id="ans-${h(r.id)}-${i}" placeholder="Votre réponse, vos recommandations…"></textarea>
              <div class="pe-actions"><button class="btn primary small" data-action="add-contrib" data-rid="${h(r.id)}" data-ta="ans-${h(r.id)}-${i}" data-guide="${h(q)}" type="button">Ajouter</button></div>
            </details>
          </div>`;
      });
    }

    const libres = mine.filter(c => !c.guide);
    if (libres.length) html += `<div class="pe-q"><span class="pe-q-label">${isTrame ? 'Contributions libres' : 'Contributions'}</span>${libres.map(contribHtml).join('')}</div>`;
    if (!isTrame && !libres.length) html += '<div class="pe-empty">Rubrique vide pour l\'instant.</div>';

    html += `
      <details class="pe-add q" ${isTrame ? '' : 'open'}><summary>+ Ajouter une contribution libre</summary>
        <textarea class="pe-ta" id="free-${h(r.id)}" placeholder="Une idée, un constat, une proposition…"></textarea>
        <div class="pe-actions"><button class="btn primary small" data-action="add-contrib" data-rid="${h(r.id)}" data-ta="free-${h(r.id)}" data-guide="" type="button">Ajouter</button></div>
      </details>`;

    if (isTrame && Number(r.ordre) === 3 && PISTES[axe]) {
      html += `
        <details class="pe-add q"><summary>💡 Pistes de sous-objectifs à examiner</summary>
          <p class="pe-hint">Des idées de départ, à discuter librement. Clique sur une piste pour l'ajouter dans la zone de contribution libre.</p>
          <div class="pe-ideas">${PISTES[axe].map(t => `<button class="pe-idea" data-action="piste" data-rid="${h(r.id)}" data-text="${h(t)}" type="button">+ ${h(t)}</button>`).join('')}</div>
        </details>`;
    }
    return html;
  }

  function renderWorkspace() {
    const g = grp.groupe;
    const outdated = g.docLe && g.majLe && g.majLe > g.docLe;
    const docState = !g.docLe
      ? '<span class="pe-chip warn">Document pas encore envoyé au Drive</span>'
      : outdated
        ? `<span class="pe-chip warn">Dernier envoi le ${h(fmtDate(g.docLe))} — des ajouts ont eu lieu depuis</span>`
        : `<span class="pe-chip ok">✅ Document à jour (${h(fmtDate(g.docLe))})</span>`;
    const names = (g.membres || []).map(m => `<span class="pe-chip">${h(fullName(m))}</span>`).join('');

    const rubs = grp.rubriques.map(r => {
      const trame = r.ordre !== '';
      const t = trame ? TRAME[Number(r.ordre) - 1] : null;
      const head = editingId === r.id
        ? `<div style="flex:1 1 300px"><input type="text" id="editBox" value="${h(r.titre)}" maxlength="200" data-ignore-pending>
             <div class="pe-actions"><button class="btn primary small" data-action="save-edit" data-id="${h(r.id)}" data-kind="rubrique" type="button">Enregistrer</button>
             <button class="btn ghost small" data-action="cancel-edit" type="button">Annuler</button></div></div>`
        : `<div><h3>${trame ? `<span class="pe-num">${h(r.ordre)}</span>` : ''}${h(r.titre)}</h3>
             <span class="pe-by">${trame ? h(t ? t.desc : '') : 'rubrique ajoutée par ' + h(r.auteur)}</span></div>
           ${trame ? '' : `<span class="pe-mini">
             <button class="pe-link" data-action="edit" data-id="${h(r.id)}" type="button">Renommer</button>
             <button class="pe-link danger" data-action="del-rubrique" data-id="${h(r.id)}" type="button">Supprimer</button></span>`}`;
      return `<article class="pe-rub"><div class="pe-rub-head">${head}</div><div class="pe-rub-body">${rubriqueBody(r, grp.contributions)}</div></article>`;
    }).join('');

    return `
      <div class="pe-card">
        <div class="pe-ws-head">
          <div>
            <button class="pe-link" data-action="leave-group" type="button">← Quitter ce groupe</button>
            <h2>${h(groupLabel(g))}</h2>
            <p class="pe-lead" style="margin:0">${h(axeOf(g.axe).titre)}</p>
            <div class="pe-chips">${names}</div>
          </div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn ghost small" data-action="refresh" type="button">↻ Actualiser</button>
            <button class="btn ghost small" data-action="edit-members" type="button">✏️ Corriger les noms</button>
          </div>
        </div>
        <div class="pe-codecard">
          <div class="pe-codecard-text">
            <b>🔑 Notez votre code pour retrouver ce travail plus tard</b>
            <span>Si vous fermez la page, ou pour continuer chez vous, revenez sur ce site, ouvrez « Reprendre un groupe déjà commencé » et tapez ce code :</span>
          </div>
          <div class="pe-codecard-code" id="peCode">${h(session.pin)}</div>
          <button class="btn primary small" data-action="copy-code" type="button">📋 Copier le code</button>
        </div>
        ${renderFlash('travail')}
        <div class="pe-axe-banner"><b>Axe ${h(g.axe)}</b> — ${h(axeOf(g.axe).titre)}</div>
        ${pdfBlock(false)}
        <details class="pe-method"><summary>🧭 Rappel : comment ça marche ?</summary>
          <p class="pe-hint" style="margin:6px 0 0">Cliquez sur votre nom dans « Qui écrit ? », répondez aux questions de chaque point de la trame ou ajoutez une contribution libre, surveillez le minuteur (45 min), puis cliquez sur « Envoyer au Drive » en bas de page. </p>
        </details>
        <div id="membersBox"></div>
        <div class="pe-sticky">
          <div class="pe-timer" id="peTimer">${timerHTML()}</div>
          ${renderWhoBar()}
        </div>
        <p class="pe-lead" style="margin-top:12px">Suivez la trame ci-dessous : répondez aux questions pour guider, ou ajoutez des contributions libres. Le nom choisi dans « Qui écrit ? » est enregistré avec chaque contribution. Votre travail est enregistré au fur et à mesure.</p>
        ${rubs}
        <div class="pe-card" style="box-shadow:none;background:#fbf9fc">
          <h3>➕ Ajouter une rubrique</h3>
          <p class="pe-hint" style="margin-top:0">Pour un sujet qui ne rentre pas dans la trame.</p>
          <form id="rubForm" class="pe-newrub" autocomplete="off">
            <input type="text" name="titre" placeholder="Titre de la rubrique" maxlength="200" required>
            <button class="btn primary" type="submit">Ajouter la rubrique</button>
          </form>
        </div>
        <div class="pe-docbox">
          <div>
            <b>📄 Envoyer le travail du groupe</b>
            <p>Génère le PDF récapitulatif et l'envoie dans le Drive de l'équipe de coordination (un seul PDF par groupe, remplacé à chaque envoi). Vous pouvez aussi l'imprimer.</p>
            <div class="pe-chips">${docState}</div>
          </div>
          <div class="pe-actions" style="margin-top:0">
            <button class="btn primary" data-action="generate" type="button">Envoyer au Drive</button>
            <button class="btn ghost" data-action="print" type="button">🖨 Imprimer</button>
          </div>
        </div>
      </div>`;
  }

  /* ------------------------------------------------------------------ *
   * VUE ADMINISTRATION
   * ------------------------------------------------------------------ */
  async function loadAdmin() {
    const out = await apiPost({ action: 'pe_adminData', code: adminCode });
    adminData = out;
  }

  function adminContribs(g, r) { return adminData.contributions.filter(c => c.rubriqueId === r.id); }

  function renderAdmin() {
    const root = $('#view-admin');
    if (!adminCode) {
      root.innerHTML = `
        <div class="pe-card">
          <h2>🔐 Espace administrateur</h2>
          <p class="pe-lead">Réservé à l'équipe de coordination : consultation de toutes les contributions par axe, export en PDF vers le Drive.</p>
          <form id="adminForm" class="pe-row" autocomplete="off">
            <label>Code administrateur<input type="password" name="code" required autocomplete="off" data-ignore-pending></label>
            <button class="btn primary" type="submit">Entrer</button>
          </form>
          ${renderFlash('admin')}
        </div>`;
      return;
    }
    if (!adminData) { root.innerHTML = '<div class="pe-card"><div class="pe-empty">Chargement…</div></div>'; return; }

    const { groupes, rubriques, contributions } = adminData;
    const axes = adminAxe === 'all' ? AXES : AXES.filter(a => String(a.n) === String(adminAxe));
    const nbByGroup = id => contributions.filter(c => c.groupeId === id).length;

    const filter = `
      <div class="pe-filter">
        <button data-action="admin-axe" data-axe="all" class="${adminAxe === 'all' ? 'active' : ''}" type="button">Tous les axes</button>
        ${AXES.map(a => `<button data-action="admin-axe" data-axe="${a.n}" class="${String(adminAxe) === String(a.n) ? 'active' : ''}" type="button">Axe ${a.n}</button>`).join('')}
      </div>`;

    const exportBox = exportResult ? `
      <div class="pe-ok">
        <b>✅ Export « ${h(exportResult.scope)} » enregistré dans le Drive</b> (${exportResult.contributions} contribution${exportResult.contributions > 1 ? 's' : ''}).
        <div class="pe-actions">
          <a class="btn secondary small" href="${h(exportResult.pdfUrl)}" target="_blank" rel="noopener" style="text-decoration:none">Ouvrir le PDF dans Drive</a>
          <a class="btn ghost small" href="${h(exportResult.mdUrl)}" target="_blank" rel="noopener" style="text-decoration:none">Ouvrir le texte dans Drive</a>
          <button class="btn primary small" data-action="dl-pdf" type="button">⬇ Télécharger le PDF</button>
          <button class="btn primary small" data-action="dl-md" type="button">⬇ Télécharger le texte (.md)</button>
        </div>
      </div>` : '';

    const compiled = axes.map(a => {
      const gs = groupes.filter(g => g.axe === a.n).sort((x, y) => x.numero - y.numero);
      const nb = gs.reduce((s, g) => s + nbByGroup(g.id), 0);
      const items = TRAME.map(t => {
        const lines = [];
        gs.forEach(g => {
          const r = rubriques.find(x => x.groupeId === g.id && Number(x.ordre) === t.n);
          if (!r) return;
          adminContribs(g, r).forEach(c => lines.push({ g, c }));
        });
        return `<div class="pe-adm-item"><h4>${t.n}. ${h(t.titre)} <span class="pe-by">(${lines.length})</span></h4>
          ${lines.length ? lines.map(({ g, c }) => `<div class="pe-r" style="margin-left:0">${c.guide ? `<div class="pe-by"><i>${h(c.guide)}</i></div>` : ''}<div class="pe-txt">${h(c.texte)}</div><div class="pe-by"><b>Groupe ${g.numero}</b> · ${h(c.auteur)} <button class="pe-link danger" data-action="admin-del-contrib" data-gid="${h(g.id)}" data-id="${h(c.id)}" type="button">Supprimer</button></div></div>`).join('') : '<div class="pe-empty">Aucune contribution.</div>'}</div>`;
      }).join('');
      const extras = [];
      gs.forEach(g => rubriques.filter(r => r.groupeId === g.id && r.ordre === '').forEach(r => adminContribs(g, r).forEach(c => extras.push({ g, r, c }))));
      const extraHtml = extras.length ? `<div class="pe-adm-item"><h4>Autres rubriques ajoutées <span class="pe-by">(${extras.length})</span></h4>${extras.map(({ g, r, c }) => `<div class="pe-r" style="margin-left:0"><div class="pe-by"><i>${h(r.titre)}</i></div><div class="pe-txt">${h(c.texte)}</div><div class="pe-by"><b>Groupe ${g.numero}</b> · ${h(c.auteur)} <button class="pe-link danger" data-action="admin-del-contrib" data-gid="${h(g.id)}" data-id="${h(c.id)}" type="button">Supprimer</button></div></div>`).join('')}</div>` : '';
      return `
        <details class="pe-resto-group" ${adminAxe === 'all' ? '' : 'open'}>
          <summary>Axe ${a.n} — ${h(a.court)} <span class="pe-by">· ${gs.length} groupe${gs.length > 1 ? 's' : ''}, ${nb} contribution${nb > 1 ? 's' : ''}</span></summary>
          <div class="pe-resto-body">${gs.length ? items + extraHtml : '<div class="pe-empty">Aucun groupe n\'a encore travaillé sur cet axe.</div>'}</div>
        </details>`;
    }).join('');

    const gs = groupes.slice().sort((a, b) => a.axe - b.axe || a.numero - b.numero);
    const table = gs.length ? `
      <table class="pe-table"><thead><tr><th>Groupe</th><th>Participants</th><th>Code</th><th>Contrib.</th><th>Dernière activité</th><th>PDF Drive</th><th></th></tr></thead><tbody>
        ${gs.map(g => `<tr><td><b>Axe ${g.axe} · G${g.numero}</b><br><span class="pe-by">${h(g.statut || '')}</span></td>
          <td>${h((g.membres || []).map(fullName).join(', '))}</td><td><code>${h(g.pin)}</code></td><td>${nbByGroup(g.id)}</td><td>${h(fmtDate(g.majLe))}</td>
          <td>${g.docUrl ? `<a href="${h(g.docUrl)}" target="_blank" rel="noopener">Ouvrir</a><br><span class="pe-by">${h(fmtDate(g.docLe))}</span>` : '<span class="pe-by">pas envoyé</span>'}</td>
          <td><button class="pe-link danger" data-action="admin-del-group" data-id="${h(g.id)}" type="button">Supprimer</button></td></tr>`).join('')}
      </tbody></table>` : '<div class="pe-empty">Aucun groupe pour le moment.</div>';

    root.innerHTML = `
      <div class="pe-card">
        <div class="pe-ws-head"><div><h2>🔐 Administration</h2>
          <p class="pe-lead" style="margin:0">${groupes.length} groupe${groupes.length > 1 ? 's' : ''} · ${contributions.length} contribution${contributions.length > 1 ? 's' : ''}. Tout ce que les groupes saisissent apparaît ici, par axe.</p></div>
          <div class="pe-actions" style="margin-top:0">
            <a class="btn secondary small" href="${DRIVE_URL}" target="_blank" rel="noopener" style="text-decoration:none">📁 Ouvrir le dossier Drive</a>
            <button class="btn ghost small" data-action="refresh" type="button">↻ Actualiser</button>
            <button class="btn ghost small" data-action="admin-logout" type="button">Se déconnecter</button></div></div>
        ${renderFlash('admin')}
        ${filter}
        <div class="pe-actions">
          ${adminAxe === 'all' ? '' : `<button class="btn primary" data-action="admin-export" data-axe="${h(adminAxe)}" type="button">📥 Exporter l'axe ${h(adminAxe)} (PDF + texte → Drive)</button>`}
          <button class="btn ${adminAxe === 'all' ? 'primary' : 'secondary'}" data-action="admin-export" data-axe="all" type="button">📥 Exporter tout le projet (PDF + texte → Drive)</button>
        </div>
        <p class="pe-hint">L'export réunit, pour chaque axe et chaque point de la trame, les contributions de tous les groupes, avec une consigne prête à donner à une IA pour produire la synthèse. Il est rangé dans le dossier « Exports » du Drive.</p>
        ${exportBox}
      </div>
      <div class="pe-card"><h2>Contributions par axe</h2>${compiled}</div>
      <div class="pe-card"><h2>Les groupes</h2>${table}</div>`;
  }

  /* ------------------------------------------------------------------ *
   * RENDU GLOBAL
   * ------------------------------------------------------------------ */
  function renderAll() {
    if (activeTab === 'travail') renderTravail();
    else renderAdmin();
    if (editingId) {
      const box = $('#editBox');
      if (box) { box.focus(); const n = box.value.length; try { box.setSelectionRange(n, n); } catch (e) { /* input type */ } }
    }
  }

  /* ------------------------------------------------------------------ *
   * ACTIONS
   * ------------------------------------------------------------------ */
  function leaveGroup() {
    if (session) { store.del('pe_present_' + session.groupId); }
    session = null; store.del('pe_session'); present = []; grp = null; activeAuthor = null; editingId = null;
    timer = null; step = 'choose'; slot = null; editingPresent = false;
  }

  function needAuthor() {
    const a = currentAuthor();
    if (!a) {
      toast('Clique d\'abord sur ton nom dans « Qui écrit ? ».');
      const bar = $('#whoBar'); if (bar) bar.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    return a;
  }

  async function onClick(ev) {
    const btn = ev.target.closest('[data-action]');
    if (!btn) return;
    const a = btn.dataset.action;

    switch (a) {
      case 'copy-code':
        try { await navigator.clipboard.writeText(session.pin); toast('Code copié : ' + session.pin); }
        catch (e) { toast('Votre code : ' + session.pin); }
        return;
      case 'refresh': return refresh(false);
      case 'print': return window.print();

      /* ----- choix du groupe ----- */
      case 'pick-axe':
        slot = { axe: Number(btn.dataset.axe) };
        draft = []; editingPresent = false; flash.travail = null; step = 'who';
        return renderAll();
      case 'back-choose':
        slot = null; editingPresent = false; flash.travail = null;
        step = session && present.length ? 'work' : 'choose';
        return renderAll();
      case 'toggle-person': {
        const n = btn.dataset.name;
        draft = draft.includes(n) ? draft.filter(x => x !== n) : draft.concat(n).slice(0, MAX_PRESENT);
        return renderAll();
      }
      case 'start-work': {
        if (!draft.length || !slot) return;
        btn.disabled = true;
        try {
          let out;
          if (editingPresent) {
            out = await apiPost(gp({ action: 'pe_setMembers', membres: draft.map(n => ({ prenom: n, nom: '' })) }));
            present = draft.slice(); store.set('pe_present_' + session.groupId, present);
            await loadGroup();
          } else {
            out = await apiPost({ action: 'pe_createGroup', axe: slot.axe, membres: draft.map(n => ({ prenom: n, nom: '' })) });
            session = { groupId: out.groupId, pin: out.pin, axe: slot.axe, numero: out.numero };
            store.set('pe_session', session);
            present = draft.slice(); store.set('pe_present_' + session.groupId, present);
            activeAuthor = present.length === 1 ? present[0] : null;
            await loadGroup(); loadTimer();
          }
          slot = null; editingPresent = false; step = 'work'; flash.travail = null;
        } catch (e) {
          flash.travail = { type: 'error', text: e.message };
        }
        return renderAll();
      }
      case 'change-present':
        if (!session) return;
        slot = { axe: session.axe, numero: session.numero };
        draft = present.slice(); editingPresent = true; step = 'who';
        return renderAll();
      case 'set-author': activeAuthor = btn.dataset.name; return renderAll();
      case 'leave-group':
        if (!confirm('Quitter ce groupe ? Pour le retrouver, il faudra son code (' + (session ? session.pin : '') + ').')) return;
        leaveGroup(); flash.travail = null;
        return renderAll();

      case 'edit-members': {
        const box = $('#membersBox');
        if (box.innerHTML) { box.innerHTML = ''; return; }
        box.innerHTML = `
          <div class="pe-card" style="box-shadow:none;background:#fbf9fc">
            <b>Participants du groupe</b> <span class="pe-hint">(un par ligne — corrige les fautes ou retire un nom)</span>
            <textarea class="pe-ta" id="membersTa" data-ignore-pending>${h((grp.groupe.membres || []).map(fullName).join('\n'))}</textarea>
            <div class="pe-actions"><button class="btn primary small" data-action="save-members" type="button">Enregistrer</button></div>
          </div>`;
        return;
      }
      case 'save-members': {
        const membres = $('#membersTa').value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 15).map(n => ({ prenom: n, nom: '' }));
        const out = await act(gp({ action: 'pe_setMembers', membres }), 'Participants mis à jour', 'travail');
        if (out) { present = present.filter(n => membres.some(m => sameName(m.prenom, n))); store.set('pe_present_' + session.groupId, present); }
        return;
      }

      /* ----- contributions ----- */
      case 'add-contrib': {
        const ta = $('#' + CSS.escape(btn.dataset.ta));
        const texte = ta ? ta.value.trim() : '';
        if (!texte) { toast('Écris d\'abord ton texte.'); return; }
        const auteur = needAuthor(); if (!auteur) return;
        btn.disabled = true;
        const out = await act(gp({ action: 'pe_addContribution', rubriqueId: btn.dataset.rid, guide: btn.dataset.guide || '', texte, auteur }), 'Contribution enregistrée', 'travail');
        if (!out) btn.disabled = false;
        return;
      }
      case 'piste': {
        const ta = $('#free-' + CSS.escape(btn.dataset.rid));
        if (!ta) return;
        const det = ta.closest('details'); if (det) det.open = true;
        ta.value = (ta.value ? ta.value.replace(/\s*$/, '\n') : '') + '• ' + btn.dataset.text + ' : ';
        ta.focus();
        return;
      }
      case 'edit': editingId = btn.dataset.id; return renderAll();
      case 'cancel-edit': editingId = null; return renderAll();
      case 'save-edit': {
        const val = ($('#editBox') || {}).value || '';
        const id = btn.dataset.id;
        const payload = btn.dataset.kind === 'rubrique'
          ? gp({ action: 'pe_editRubrique', rubriqueId: id, titre: val })
          : gp({ action: 'pe_editContribution', id, texte: val });
        const out = await act(payload, 'Modification enregistrée', 'travail');
        if (out) { editingId = null; renderAll(); }
        return;
      }
      case 'del-contrib':
        if (!confirm('Supprimer cette contribution ?')) return;
        return void await act(gp({ action: 'pe_deleteContribution', id: btn.dataset.id }), 'Supprimé', 'travail');
      case 'del-rubrique':
        if (!confirm('Supprimer cette rubrique et tout son contenu ?')) return;
        return void await act(gp({ action: 'pe_deleteRubrique', rubriqueId: btn.dataset.id }), 'Rubrique supprimée', 'travail');

      case 'generate': {
        btn.disabled = true; btn.textContent = 'Envoi en cours…';
        const out = await act(gp({ action: 'pe_generateDoc' }), '✅ Travail du groupe envoyé au Drive', 'travail');
        if (!out) { btn.disabled = false; btn.textContent = 'Envoyer au Drive'; }
        return;
      }

      /* ----- minuteur ----- */
      case 'timer-start':
        if (!timer) loadTimer();
        if (timer.done || timer.left <= 0) { timer.left = timer.total; timer.done = false; timer.warned = false; }
        timer.endAt = Date.now() + timer.left; saveTimer(); beep(1); return updateTimerUI();
      case 'timer-pause':
        timer.left = timerLeft(); timer.endAt = null; saveTimer(); return updateTimerUI();
      case 'timer-reset':
        if (!confirm('Remettre le minuteur à ' + Math.round(timer.total / 60000) + ' minutes ?')) return;
        timer = { total: timer.total, left: timer.total, endAt: null, warned: false, done: false }; saveTimer(); return updateTimerUI();

      /* ----- administration ----- */
      case 'admin-axe': adminAxe = btn.dataset.axe; return renderAll();
      case 'admin-logout':
        adminCode = null; adminData = null; exportResult = null;
        try { sessionStorage.removeItem('pe_admin'); } catch (e) { /* ignore */ }
        flash.admin = null; return renderAll();
      case 'admin-del-contrib':
        if (!confirm('Supprimer cette contribution ?')) return;
        try { await apiPost({ action: 'pe_deleteContribution', code: adminCode, groupId: btn.dataset.gid, id: btn.dataset.id }); toast('Contribution supprimée'); await loadAdmin(); exportResult = null; }
        catch (e) { flash.admin = { type: 'error', text: e.message }; }
        return renderAll();
      case 'admin-del-group':
        if (!confirm('Supprimer définitivement ce groupe, toutes ses contributions et son PDF ?')) return;
        try { await apiPost({ action: 'pe_adminDeleteGroup', code: adminCode, groupId: btn.dataset.id }); toast('Groupe supprimé'); await loadAdmin(); }
        catch (e) { flash.admin = { type: 'error', text: e.message }; }
        return renderAll();
      case 'admin-export': {
        btn.disabled = true; const old = btn.textContent; btn.textContent = 'Export en cours…';
        try {
          exportResult = await apiPost({ action: 'pe_adminExport', code: adminCode, axe: btn.dataset.axe });
          flash.admin = null; toast('✅ Export enregistré dans le Drive');
        } catch (e) { flash.admin = { type: 'error', text: e.message }; exportResult = null; }
        return renderAll();
      }
      case 'dl-pdf': return exportResult && downloadBlob(exportResult.pdfName, b64ToBlob(exportResult.pdfBase64, 'application/pdf'));
      case 'dl-md': return exportResult && downloadBlob(exportResult.mdName, new Blob([exportResult.md], { type: 'text/markdown;charset=utf-8' }));
      default:
    }
  }

  async function onSubmit(ev) {
    const form = ev.target;
    if (!form.id) return;
    ev.preventDefault();
    const fd = new FormData(form);
    const submit = form.querySelector('[type="submit"]');

    if (form.id === 'resumeForm') {
      try {
        const pin = String(fd.get('pin') || '').trim();
        const out = await apiPost({ action: 'pe_joinOrCreate', resume: true, pin });
        const axe = out.axe, numero = out.numero;
        session = { groupId: out.groupId, pin, axe, numero };
        store.set('pe_session', session);
        present = store.get('pe_present_' + session.groupId, []);
        await loadGroup(); loadTimer();
        if (!present.length) { slot = { axe }; draft = []; editingPresent = true; step = 'who'; } else { step = 'work'; }
        flash.travail = null;
      } catch (e) { flash.travail = { type: 'error', text: e.message }; }
      return renderAll();
    }

    if (form.id === 'personForm') {
      const name = String(fd.get('nom') || '').trim().replace(/\s+/g, ' ');
      if (!name) return;
      if (!draft.some(n => sameName(n, name))) draft = draft.concat(name).slice(0, MAX_PRESENT);
      return renderAll();
    }

    if (submit) submit.disabled = true;
    try {
      if (form.id === 'rubForm') {
        const titre = String(fd.get('titre') || '').trim();
        const auteur = needAuthor();
        if (auteur && titre) await act(gp({ action: 'pe_addRubrique', titre, auteur }), 'Rubrique ajoutée', 'travail');
      } else if (form.id === 'adminForm') {
        const code = String(fd.get('code') || '');
        try {
          await apiPost({ action: 'pe_adminCheck', code });
          adminCode = code; try { sessionStorage.setItem('pe_admin', code); } catch (e) { /* ignore */ }
          flash.admin = null;
          await loadAdmin();
        } catch (e) { flash.admin = { type: 'error', text: e.message }; }
        renderAll();
      }
    } finally {
      if (submit) submit.disabled = false;
    }
  }

  /* ------------------------------------------------------------------ *
   * DÉMARRAGE
   * ------------------------------------------------------------------ */
  document.addEventListener('click', onClick);
  document.addEventListener('submit', onSubmit);
  $$('.pe-tab').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));

  const hash = (location.hash || '').replace('#', '');
  if (['travail', 'admin'].includes(hash)) activeTab = hash;
  $$('.pe-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === activeTab));
  $$('.pe-view').forEach(v => v.classList.toggle('visible', v.dataset.view === activeTab));

  if (session) loadTimer();
  startTicking();
  renderAll();
  if (activeTab === 'admin' && adminCode) loadAdmin().then(renderAll).catch(() => { adminCode = null; renderAll(); });
  refresh(false);

  setInterval(() => {
    if (document.hidden || editingId || activeTab === 'admin') return;
    const typing = $$('#view-travail textarea, #view-travail input[type="text"]').some(el => el.value.trim() !== '' && !el.hasAttribute('data-ignore-pending'));
    if (step === 'who' || typing) return;
    refresh(true);
  }, POLL_MS);
})();
