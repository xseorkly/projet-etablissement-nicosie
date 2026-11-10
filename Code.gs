/**
 * Projet d'établissement 2026-2030 — Lycée franco-chypriote de Nicosie
 * Récepteur Apps Script AUTONOME (Google Sheet + Google Drive).
 *
 * Déployer comme Application Web :
 *   - Exécuter en tant que : Moi
 *   - Qui a accès : Tout le monde (accès sans connexion)
 *
 * Confidentialité : chaque groupe ne peut lire et modifier QUE son propre travail
 * (protégé par le « code du groupe »). L'ensemble des contributions n'est lisible
 * qu'avec le CODE ADMINISTRATEUR.
 *
 * CODE ADMINISTRATEUR : il n'est PAS écrit dans ce fichier (le dépôt GitHub est public).
 * Apps Script > Paramètres du projet > Propriétés du script > ajouter :
 *     ADMIN_CODE = (le code choisi)
 *
 * Fichiers rangés dans le dossier Drive PE_FOLDER_ID :
 *     /Groupes  un PDF par groupe (remplacé à chaque envoi)
 *     /Exports  exports complets (PDF + texte) générés par l'administration
 */

const PE_SHEET_ID = '1KEj4YgP8VOWd-A4YKXFiRpCQO2kMqdUkAJgjz87jKMk';
const PE_FOLDER_ID = '1JtXAPRibfLMAkrSsocTc8rLcPhhfkHUR';
const PE_SCHOOL = 'Lycée franco-chypriote de Nicosie';

const PE_AXES = {
  1: 'Réussir et grandir : réussite et parcours de chaque élève',
  2: 'Langues, cultures et ouverture au monde',
  3: 'Sport, santé, bien-être et citoyenneté',
  4: 'Construire ensemble l\'école de demain'
};

const PE_TRAME = ['Diagnostic', 'Objectif général', 'Sous-objectifs', 'Actions', 'Indicateurs', 'Critères d\'évaluation'];

const PE_TABS = {
  Groupes: ['id', 'axe', 'numero', 'pin', 'membres', 'statut', 'creeLe', 'majLe', 'docUrl', 'docId', 'docLe'],
  Rubriques: ['id', 'groupeId', 'ordre', 'titre', 'auteur', 'creeLe'],
  Contributions: ['id', 'groupeId', 'rubriqueId', 'guide', 'texte', 'auteur', 'creeLe', 'majLe']
};

const PE_AI_BRIEF = [
  'CONSIGNE POUR L\'ASSISTANT IA',
  'Tu aides le comité de rédaction du projet d\'établissement 2026-2030 du ' + PE_SCHOOL + '.',
  'Ce document rassemble les contributions de groupes de personnels, classées par axe puis selon la trame commune : diagnostic, objectif général, sous-objectifs, actions, indicateurs, critères d\'évaluation.',
  'Pour CHAQUE axe : (1) synthétise le diagnostic (points forts, difficultés, besoins) en indiquant convergences et divergences ; (2) propose un objectif général à l\'horizon 2030 ; (3) retiens 3 ou 4 sous-objectifs hiérarchisés ; (4) regroupe et reformule les actions (dispositifs existants à consolider, nouvelles actions) sans redondance ; (5) propose pour chaque sous-objectif des indicateurs mesurables et des critères d\'évaluation ; (6) signale les contributions isolées, contradictoires ou peu réalistes.',
  'Rédige en français clair et institutionnel. Ne perds aucune idée importante. Indique entre parenthèses le ou les groupes d\'origine. Les contributions peuvent être écrites en français, en grec ou en anglais : traduis-les en français.'
].join('\n');

/* ---------- Points d'entrée ---------- */

function doGet(e) {
  const action = e && e.parameter && e.parameter.action ? String(e.parameter.action) : '';
  if (action.indexOf('pe_') === 0) return json_(handlePE_(action, {}, true));
  return json_({ ok: true, service: 'Projet etablissement', version: 2 });
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) throw new Error('Requête vide.');
    const data = JSON.parse(e.postData.contents);
    const action = typeof data.action === 'string' ? data.action : '';
    if (action.indexOf('pe_') !== 0) throw new Error('Action inconnue.');
    return json_(handlePE_(action, data, false));
  } catch (err) {
    return json_({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** À exécuter UNE FOIS depuis l'éditeur : autorise Sheets + Drive et crée les onglets et dossiers. */
function setupProjetEtablissement() {
  Object.keys(PE_TABS).forEach(peSheet_);
  const root = DriveApp.getFolderById(PE_FOLDER_ID);
  getOrCreateFolder_(root, 'Groupes');
  getOrCreateFolder_(root, 'Exports');
  const hasCode = !!PropertiesService.getScriptProperties().getProperty('ADMIN_CODE');
  Logger.log('Projet d\'établissement prêt. Code admin configuré : ' + hasCode);
  return 'OK - code admin configuré : ' + hasCode;
}

function handlePE_(action, p, isGet) {
  try {
    if (action === 'pe_slots') return peSlots_();
    if (isGet) throw new Error('Action inconnue.');

    const lock = LockService.getScriptLock();
    lock.waitLock(25000);
    try {
      switch (action) {
        case 'pe_createGroup': return peCreateGroup_(p);
        case 'pe_joinOrCreate': return peJoinOrCreate_(p);
        case 'pe_group': return peGroupData_(peAuth_(p));
        case 'pe_setMembers': return peSetMembers_(p);
        case 'pe_addRubrique': return peAddRubrique_(p);
        case 'pe_editRubrique': return peEditRubrique_(p);
        case 'pe_deleteRubrique': return peDeleteRubrique_(p);
        case 'pe_addContribution': return peAddContribution_(p);
        case 'pe_editContribution': return peEditContribution_(p);
        case 'pe_deleteContribution': return peDeleteContribution_(p);
        case 'pe_generateDoc': return peGenerateDoc_(p);
        case 'pe_adminCheck': peRequireAdmin_(p.code); return { ok: true };
        case 'pe_adminData': return peAdminData_(p);
        case 'pe_adminDeleteGroup': return peAdminDeleteGroup_(p);
        case 'pe_adminExport': return peAdminExport_(p);
        default: throw new Error('Action inconnue.');
      }
    } finally {
      lock.releaseLock();
    }
  } catch (err) {
    return { ok: false, error: String(err && err.message ? err.message : err) };
  }
}

/* ---------- Accès Sheet ---------- */

function peSheet_(name) {
  const ss = SpreadsheetApp.openById(PE_SHEET_ID);
  const headers = PE_TABS[name];
  let sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), headers.length).setNumberFormat('@'); // tout en texte : aucune formule possible
    sh.getRange(1, 1, 1, headers.length).setValues([headers]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}

function peRead_(name) {
  const sh = peSheet_(name);
  const values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0];
  return values.slice(1).filter(r => r[0] !== '').map(r => {
    const o = {};
    headers.forEach((h, i) => { o[h] = r[i] === null || r[i] === undefined ? '' : String(r[i]); });
    return o;
  });
}

function peAppendMany_(name, objs) {
  if (!objs.length) return;
  const sh = peSheet_(name);
  const headers = PE_TABS[name];
  const row = sh.getLastRow() + 1;
  const range = sh.getRange(row, 1, objs.length, headers.length);
  range.setNumberFormat('@');
  range.setValues(objs.map(o => headers.map(h => (o[h] === undefined || o[h] === null) ? '' : String(o[h]))));
}

function peAppend_(name, obj) { peAppendMany_(name, [obj]); }

function peRowOf_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(1, 1, last, 1).getValues();
  for (let i = 1; i < ids.length; i++) if (String(ids[i][0]) === String(id)) return i + 1;
  return -1;
}

function peUpdate_(name, id, patch) {
  const sh = peSheet_(name);
  const headers = PE_TABS[name];
  const row = peRowOf_(sh, id);
  if (row < 0) throw new Error('Élément introuvable.');
  const range = sh.getRange(row, 1, 1, headers.length);
  const cur = range.getValues()[0];
  const next = headers.map((h, i) => patch[h] !== undefined ? String(patch[h]) : cur[i]);
  range.setNumberFormat('@');
  range.setValues([next]);
}

function peDeleteIds_(name, ids) {
  if (!ids.length) return;
  const sh = peSheet_(name);
  ids.map(id => peRowOf_(sh, id)).filter(r => r > 0).sort((a, b) => b - a).forEach(r => sh.deleteRow(r));
}

function peGet_(name, id) {
  const found = peRead_(name).filter(o => o.id === String(id))[0];
  if (!found) throw new Error('Élément introuvable.');
  return found;
}

function peNow_() { return new Date().toISOString(); }
function peId_() { return Utilities.getUuid().replace(/-/g, '').slice(0, 10); }

/* ---------- Sécurité ---------- */

function peIsAdmin_(code) {
  const expected = PropertiesService.getScriptProperties().getProperty('ADMIN_CODE');
  return !!expected && String(code || '').trim() === String(expected).trim();
}

function peRequireAdmin_(code) {
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get('pe_admin_fails') || 0);
  if (fails >= 10) throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');
  if (!PropertiesService.getScriptProperties().getProperty('ADMIN_CODE')) {
    throw new Error('Le code administrateur n\'est pas configuré dans Apps Script (propriété ADMIN_CODE).');
  }
  if (!peIsAdmin_(code)) {
    cache.put('pe_admin_fails', String(fails + 1), 600);
    throw new Error('Code administrateur incorrect.');
  }
}

function peNormPin_(v) { return String(v || '').trim().toLowerCase(); }

/** Vérifie l'accès à un groupe : bon code du groupe (ou code administrateur). Renvoie la ligne du groupe. */
function peAuth_(p) {
  const g = peGet_('Groupes', p.groupId);
  if (peIsAdmin_(p.code)) return g;
  const key = 'pe_pinfail_' + g.id;
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get(key) || 0);
  if (fails >= 10) throw new Error('Trop de tentatives pour ce groupe. Réessayez dans quelques minutes.');
  if (!peNormPin_(p.pin) || peNormPin_(p.pin) !== peNormPin_(g.pin)) {
    cache.put(key, String(fails + 1), 600);
    throw new Error('Accès refusé : code du groupe incorrect.');
  }
  return g;
}

/* ---------- Nettoyage des entrées ---------- */

function peClean_(v, max) { return cleanText_(v, max); }

function peCleanLong_(v, max) {
  return String(v || '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ').trim().slice(0, max || 5000);
}

function peMembers_(list) {
  const out = [];
  (Array.isArray(list) ? list : []).slice(0, 15).forEach(m => {
    const prenom = peClean_(m && m.prenom, 60);
    const nom = peClean_(m && m.nom, 60);
    if (!prenom && !nom) return;
    const dup = out.some(o => o.prenom.toLowerCase() === prenom.toLowerCase() && o.nom.toLowerCase() === nom.toLowerCase());
    if (!dup) out.push({ prenom, nom });
  });
  return out;
}

function peParseMembers_(s) { try { const v = JSON.parse(s || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; } }

function peAuthor_(v) {
  const a = peClean_(v, 120);
  if (!a) throw new Error('Indiquez qui écrit (prénom, nom ou pseudonyme).');
  return a;
}

/* ---------- Lecture ---------- */

/** Public : uniquement l'état des places (aucun nom, aucun contenu). */
function peSlots_() {
  return {
    ok: true,
    slots: peRead_('Groupes').map(g => ({ axe: Number(g.axe), numero: Number(g.numero), statut: g.statut || 'En cours' }))
  };
}

function peSortRubriques_(list) {
  return list.slice().sort((a, b) => {
    const oa = a.ordre === '' ? 99 : Number(a.ordre), ob = b.ordre === '' ? 99 : Number(b.ordre);
    return oa - ob || String(a.creeLe).localeCompare(String(b.creeLe));
  });
}

function peGroupPublic_(g) {
  return { id: g.id, axe: Number(g.axe), numero: Number(g.numero), membres: peParseMembers_(g.membres), statut: g.statut, majLe: g.majLe, docLe: g.docLe };
}

function peGroupData_(g) {
  return {
    ok: true,
    groupe: peGroupPublic_(g),
    rubriques: peSortRubriques_(peRead_('Rubriques').filter(r => r.groupeId === g.id)),
    contributions: peRead_('Contributions').filter(c => c.groupeId === g.id)
  };
}

/* ---------- Groupes ---------- */

/** Ouvre ou retrouve le groupe (axe, numéro). Création : un code est obligatoire et les 6 rubriques de la trame sont posées. */
/** Reprise d'un groupe à partir de son seul code de reprise (ne crée jamais rien). */
function peResume_(pinRaw) {
  const key = 'pe_resumefail';
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get(key) || 0);
  if (fails >= 30) throw new Error('Trop de tentatives. Réessayez dans quelques minutes.');
  const pin = peNormPin_(pinRaw);
  const found = pin.length < 4 ? [] : peRead_('Groupes').filter(x => peNormPin_(x.pin) === pin);
  if (found.length !== 1) {
    cache.put(key, String(fails + 1), 600);
    throw new Error(found.length > 1 ? 'Ce code est utilisé par plusieurs groupes : contactez l\'administrateur.' : 'Code de reprise incorrect.');
  }
  const g = found[0];
  return { ok: true, created: false, groupId: g.id, axe: Number(g.axe), numero: Number(g.numero), pin: g.pin };
}

/** Création d'un groupe : le serveur attribue le numéro et un code de reprise à 4 chiffres. */
function peCreateGroup_(p) {
  const axe = Number(p.axe);
  if (!(axe >= 1 && axe <= 4)) throw new Error('Axe invalide.');
  const nouveaux = peMembers_(p.membres);
  if (!nouveaux.length) throw new Error('Indiquez au moins une personne devant l\'écran.');
  const groupes = peRead_('Groupes').filter(g => Number(g.axe) === axe);
  const numero = groupes.reduce((m, g) => Math.max(m, Number(g.numero) || 0), 0) + 1;
  if (numero > 99) throw new Error('Nombre maximal de groupes atteint pour cet axe.');
  const used = peRead_('Groupes').map(x => peNormPin_(x.pin));
  const ALPHA = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let pin = '';
  do {
    pin = '';
    for (let i = 0; i < 6; i++) pin += ALPHA.charAt(Math.floor(Math.random() * ALPHA.length));
  } while (used.indexOf(pin.toLowerCase()) !== -1);
  const now = peNow_();
  const g = { id: peId_(), axe, numero, pin, membres: JSON.stringify(nouveaux), statut: 'En cours', creeLe: now, majLe: now, docUrl: '', docId: '', docLe: '' };
  peAppend_('Groupes', g);
  peAppendMany_('Rubriques', PE_TRAME.map((titre, i) => ({ id: peId_(), groupeId: g.id, ordre: i + 1, titre, auteur: 'Trame commune', creeLe: now })));
  return { ok: true, created: true, groupId: g.id, numero, pin };
}

function peJoinOrCreate_(p) {
  const axe = Number(p.axe), numero = Number(p.numero);
  if (p.resume) return peResume_(p.pin);
  if (!(axe >= 1 && axe <= 4)) throw new Error('Axe invalide.');
  if (!(numero >= 1 && numero <= 99)) throw new Error('Numéro de groupe invalide.');
  const nouveaux = peMembers_(p.membres);
  if (!nouveaux.length) throw new Error('Indiquez au moins une personne devant l\'écran.');
  const pin = peNormPin_(p.pin);
  if (pin.length < 4) throw new Error('Le code du groupe doit comporter au moins 4 caractères.');

  const existing = peRead_('Groupes').filter(g => Number(g.axe) === axe && Number(g.numero) === numero)[0];
  const now = peNow_();

  if (!existing) {
    const g = { id: peId_(), axe, numero, pin, membres: JSON.stringify(nouveaux), statut: 'En cours', creeLe: now, majLe: now, docUrl: '', docId: '', docLe: '' };
    peAppend_('Groupes', g);
    peAppendMany_('Rubriques', PE_TRAME.map((titre, i) => ({ id: peId_(), groupeId: g.id, ordre: i + 1, titre, auteur: 'Trame commune', creeLe: now })));
    return { ok: true, created: true, groupId: g.id };
  }

  const key = 'pe_slotfail_' + axe + '_' + numero;
  const cache = CacheService.getScriptCache();
  const fails = Number(cache.get(key) || 0);
  if (fails >= 8) throw new Error('Trop de tentatives pour ce groupe. Réessayez dans quelques minutes.');
  if (pin !== peNormPin_(existing.pin)) {
    cache.put(key, String(fails + 1), 600);
    throw new Error('Ce groupe est déjà ouvert : le code du groupe est incorrect. Si tu n\'as pas le code, choisis un autre groupe.');
  }
  const membres = peMembers_(peParseMembers_(existing.membres).concat(nouveaux));
  peUpdate_('Groupes', existing.id, { membres: JSON.stringify(membres) });
  return { ok: true, created: false, groupId: existing.id };
}

function peSetMembers_(p) {
  const g = peAuth_(p);
  const membres = peMembers_(p.membres);
  if (!membres.length) throw new Error('Un groupe doit garder au moins un membre.');
  peUpdate_('Groupes', g.id, { membres: JSON.stringify(membres), majLe: peNow_() });
  return { ok: true };
}

function peTouchGroup_(groupId) { peUpdate_('Groupes', groupId, { majLe: peNow_(), statut: 'En cours' }); }

/* ---------- Rubriques supplémentaires (la trame est fixe) ---------- */

function peRubriqueOf_(g, id) {
  const r = peGet_('Rubriques', id);
  if (r.groupeId !== g.id) throw new Error('Rubrique introuvable.');
  return r;
}

function peAddRubrique_(p) {
  const g = peAuth_(p);
  const titre = peClean_(p.titre, 200);
  if (!titre) throw new Error('Donnez un titre à la rubrique.');
  const r = { id: peId_(), groupeId: g.id, ordre: '', titre, auteur: peAuthor_(p.auteur), creeLe: peNow_() };
  peAppend_('Rubriques', r);
  peTouchGroup_(g.id);
  return { ok: true, rubriqueId: r.id };
}

function peEditRubrique_(p) {
  const g = peAuth_(p);
  const r = peRubriqueOf_(g, p.rubriqueId);
  if (r.ordre !== '') throw new Error('Les rubriques de la trame commune ne peuvent pas être renommées.');
  const titre = peClean_(p.titre, 200);
  if (!titre) throw new Error('Le titre ne peut pas être vide.');
  peUpdate_('Rubriques', r.id, { titre });
  peTouchGroup_(g.id);
  return { ok: true };
}

function peDeleteRubrique_(p) {
  const g = peAuth_(p);
  const r = peRubriqueOf_(g, p.rubriqueId);
  if (r.ordre !== '') throw new Error('Les rubriques de la trame commune ne peuvent pas être supprimées.');
  peDeleteIds_('Contributions', peRead_('Contributions').filter(c => c.rubriqueId === r.id).map(c => c.id));
  peDeleteIds_('Rubriques', [r.id]);
  peTouchGroup_(g.id);
  return { ok: true };
}

/* ---------- Contributions ---------- */

function peAddContribution_(p) {
  const g = peAuth_(p);
  const r = peRubriqueOf_(g, p.rubriqueId);
  const texte = peCleanLong_(p.texte, 5000);
  if (!texte) throw new Error('Le texte est vide.');
  const now = peNow_();
  const c = { id: peId_(), groupeId: g.id, rubriqueId: r.id, guide: peClean_(p.guide, 300), texte, auteur: peAuthor_(p.auteur), creeLe: now, majLe: now };
  peAppend_('Contributions', c);
  peTouchGroup_(g.id);
  return { ok: true, id: c.id };
}

function peContribOf_(g, id) {
  const c = peGet_('Contributions', id);
  if (c.groupeId !== g.id) throw new Error('Contribution introuvable.');
  return c;
}

function peEditContribution_(p) {
  const g = peAuth_(p);
  const c = peContribOf_(g, p.id);
  const texte = peCleanLong_(p.texte, 5000);
  if (!texte) throw new Error('Le texte est vide.');
  peUpdate_('Contributions', c.id, { texte, majLe: peNow_() });
  peTouchGroup_(g.id);
  return { ok: true };
}

function peDeleteContribution_(p) {
  const g = peAuth_(p);
  const c = peContribOf_(g, p.id);
  peDeleteIds_('Contributions', [c.id]);
  peTouchGroup_(g.id);
  return { ok: true };
}

/* ---------- Rendu des documents ---------- */

function esc_(v) {
  return String(v === undefined || v === null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
    .replace(/\n/g, '<br>');
}

const PE_PDF_CSS = 'body{font-family:Arial,Helvetica,sans-serif;color:#242038;font-size:11pt;line-height:1.45}' +
  'h1{color:#211d47;font-size:22pt;margin:0 0 4px}h2{color:#c20a73;font-size:15pt;margin:22px 0 6px;border-bottom:2px solid #c20a73;padding-bottom:3px}' +
  'h3{font-size:12pt;color:#211d47;margin:16px 0 4px}h4{font-size:11pt;color:#211d47;margin:12px 0 2px}.meta{color:#5a5670;font-size:10pt;margin:2px 0}' +
  '.q{background:#f4f0f7;border-left:4px solid #211d47;padding:6px 10px;margin:10px 0 4px}' +
  '.r{border-left:4px solid #c20a73;padding:4px 10px;margin:4px 0 6px 14px;background:#fbf8fb}' +
  '.by{color:#6a6580;font-size:9pt}.foot{margin-top:28px;color:#8a8598;font-size:9pt;border-top:1px solid #ddd;padding-top:6px}' +
  '.brief{background:#fff6e0;border:1px solid #ecd28a;padding:10px 12px;margin:14px 0;font-size:10pt}';

function peDate_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Nicosia', 'dd/MM/yyyy HH:mm');
}

function peAxeLabel_(n) { return 'Axe ' + n + ' — ' + PE_AXES[n]; }

/** Contributions d'une rubrique, regroupées par question guide. */
function peContribBlocks_(list) {
  const guides = [];
  list.forEach(c => { if (c.guide && guides.indexOf(c.guide) < 0) guides.push(c.guide); });
  return { guides, libres: list.filter(c => !c.guide) };
}

function peGroupHtml_(g, rubriques, contribs) {
  const membres = peParseMembers_(g.membres).map(m => esc_((m.prenom + ' ' + m.nom).trim())).join(', ');
  let h = '<html><head><meta charset="utf-8"><style>' + PE_PDF_CSS + '</style></head><body>';
  h += '<div class="meta">' + esc_(PE_SCHOOL) + ' — Projet d\'établissement 2026-2030</div>';
  h += '<h1>' + esc_(peAxeLabel_(Number(g.axe))) + '</h1><div class="meta"><b>Groupe ' + esc_(g.numero) + '</b></div>';
  h += '<div class="meta"><b>Participants :</b> ' + (membres || '—') + '</div>';
  h += '<div class="meta">Document généré le ' + esc_(peDate_()) + '</div>';
  peSortRubriques_(rubriques).forEach(r => {
    const rc = contribs.filter(c => c.rubriqueId === r.id);
    h += '<h2>' + (r.ordre !== '' ? esc_(r.ordre + '. ') : '') + esc_(r.titre) + '</h2>';
    if (!rc.length) { h += '<p><i>Pas de contribution.</i></p>'; return; }
    const b = peContribBlocks_(rc);
    b.guides.forEach(q => {
      h += '<div class="q"><b>Question</b> — ' + esc_(q) + '</div>';
      rc.filter(c => c.guide === q).forEach(c => { h += '<div class="r">' + esc_(c.texte) + '<div class="by">— ' + esc_(c.auteur) + '</div></div>'; });
    });
    b.libres.forEach(c => { h += '<div class="r">' + esc_(c.texte) + '<div class="by">— ' + esc_(c.auteur) + '</div></div>'; });
  });
  h += '<div class="foot">' + esc_(PE_SCHOOL) + ' — ' + esc_(peAxeLabel_(Number(g.axe))) + ', Groupe ' + esc_(g.numero) + '</div>';
  return h + '</body></html>';
}

function peGenerateDoc_(p) {
  const g = peAuth_(p);
  const html = peGroupHtml_(g, peRead_('Rubriques').filter(r => r.groupeId === g.id), peRead_('Contributions').filter(c => c.groupeId === g.id));
  const baseName = cleanFilename_('Axe' + g.axe + '_Groupe' + g.numero);
  const pdf = Utilities.newBlob(html, 'text/html', baseName + '.html').getAs('application/pdf').setName(baseName + '.pdf');
  const folder = getOrCreateFolder_(DriveApp.getFolderById(PE_FOLDER_ID), 'Groupes');
  if (g.docId) { try { DriveApp.getFileById(g.docId).setTrashed(true); } catch (e) { /* déjà supprimé */ } }
  const file = folder.createFile(pdf);
  const now = peNow_();
  peUpdate_('Groupes', g.id, { statut: 'Terminé', docUrl: file.getUrl(), docId: file.getId(), docLe: now });
  return { ok: true, docLe: now, fileName: file.getName() };
}

/* ---------- Administration ---------- */

function peAdminData_(p) {
  peRequireAdmin_(p.code);
  return {
    ok: true,
    groupes: peRead_('Groupes').map(g => ({
      id: g.id, axe: Number(g.axe), numero: Number(g.numero), pin: g.pin, membres: peParseMembers_(g.membres),
      statut: g.statut, creeLe: g.creeLe, majLe: g.majLe, docUrl: g.docUrl, docLe: g.docLe
    })),
    rubriques: peSortRubriques_(peRead_('Rubriques')),
    contributions: peRead_('Contributions')
  };
}

function peAdminDeleteGroup_(p) {
  peRequireAdmin_(p.code);
  const g = peGet_('Groupes', p.groupId);
  peDeleteIds_('Contributions', peRead_('Contributions').filter(c => c.groupeId === g.id).map(c => c.id));
  peDeleteIds_('Rubriques', peRead_('Rubriques').filter(r => r.groupeId === g.id).map(r => r.id));
  peDeleteIds_('Groupes', [g.id]);
  if (g.docId) { try { DriveApp.getFileById(g.docId).setTrashed(true); } catch (e) { /* ignore */ } }
  return { ok: true };
}

/**
 * Export complet (PDF + Markdown) pour la synthèse : par axe, puis par point de la trame,
 * avec les contributions de tous les groupes et leur origine. Rangé dans Drive/Exports.
 */
function peAdminExport_(p) {
  peRequireAdmin_(p.code);
  const all = String(p.axe) === 'all';
  const axes = all ? [1, 2, 3, 4] : [Number(p.axe)];
  if (!axes.every(a => a >= 1 && a <= 4)) throw new Error('Axe invalide.');

  const groupes = peRead_('Groupes');
  const rubAll = peRead_('Rubriques');
  const conAll = peRead_('Contributions');
  const nbContrib = conAll.filter(c => axes.indexOf(Number((groupes.filter(g => g.id === c.groupeId)[0] || {}).axe)) >= 0).length;
  if (!nbContrib) throw new Error('Aucune contribution à exporter pour le moment.');

  const scope = all ? 'Projet complet' : 'Axe ' + axes[0];
  let html = '<html><head><meta charset="utf-8"><style>' + PE_PDF_CSS + '</style></head><body>';
  let md = '';
  html += '<div class="meta">' + esc_(PE_SCHOOL) + '</div><h1>Projet d\'établissement 2026-2030 — ' + esc_(scope) + '</h1>';
  html += '<div class="meta">Export généré le ' + esc_(peDate_()) + ' — ' + nbContrib + ' contribution(s)</div>';
  html += '<div class="brief">' + esc_(PE_AI_BRIEF) + '</div>';
  md += '# Projet d\'établissement 2026-2030 — ' + scope + '\n\n' + PE_SCHOOL + ' — export du ' + peDate_() + ' — ' + nbContrib + ' contribution(s)\n\n> ' + PE_AI_BRIEF.replace(/\n/g, '\n> ') + '\n\n';

  axes.forEach(a => {
    const gs = groupes.filter(g => Number(g.axe) === a).sort((x, y) => Number(x.numero) - Number(y.numero));
    html += '<h1 style="margin-top:30px">' + esc_(peAxeLabel_(a)) + '</h1>';
    md += '\n## ' + peAxeLabel_(a) + '\n\n';
    if (!gs.length) { html += '<p><i>Aucun groupe n\'a travaillé sur cet axe.</i></p>'; md += '_Aucun groupe n\'a travaillé sur cet axe._\n'; return; }
    html += '<div class="meta">Groupes : ' + gs.map(g => 'Groupe ' + esc_(g.numero)).join(', ') + '</div>';
    md += 'Groupes : ' + gs.map(g => 'Groupe ' + g.numero).join(', ') + '\n';

    const section = (titre, perGroup) => {
      html += '<h2>' + esc_(titre) + '</h2>'; md += '\n### ' + titre + '\n';
      let any = false;
      gs.forEach(g => {
        const items = perGroup(g);
        if (!items.length) return;
        any = true;
        html += '<h4>Groupe ' + esc_(g.numero) + '</h4>'; md += '\n**Groupe ' + g.numero + '**\n\n';
        items.forEach(c => {
          const q = c.guide ? '<div class="by">Sujet : ' + esc_(c.guide) + '</div>' : '';
          html += '<div class="r">' + q + esc_(c.texte) + '<div class="by">— ' + esc_(c.auteur) + '</div></div>';
          md += '- ' + (c.guide ? '_(sujet : ' + c.guide + ')_ ' : '') + c.texte.replace(/\n+/g, ' ') + ' — ' + c.auteur + '\n';
        });
      });
      if (!any) { html += '<p><i>Aucune contribution.</i></p>'; md += '\n_Aucune contribution._\n'; }
    };

    PE_TRAME.forEach((titre, i) => {
      section((i + 1) + '. ' + titre, g => {
        const rub = rubAll.filter(r => r.groupeId === g.id && Number(r.ordre) === i + 1)[0];
        return rub ? conAll.filter(c => c.rubriqueId === rub.id) : [];
      });
    });
    section('Autres rubriques ajoutées par les groupes', g => {
      const out = [];
      rubAll.filter(r => r.groupeId === g.id && r.ordre === '').forEach(r => {
        conAll.filter(c => c.rubriqueId === r.id).forEach(c => out.push({ guide: r.titre, texte: c.texte, auteur: c.auteur }));
      });
      return out;
    });
  });
  html += '<div class="foot">' + esc_(PE_SCHOOL) + ' — Projet d\'établissement 2026-2030</div></body></html>';

  const stamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'Europe/Nicosia', 'yyyyMMdd_HHmm');
  const base = cleanFilename_('Projet_etablissement_' + (all ? 'complet' : 'Axe' + axes[0]) + '_' + stamp);
  const pdf = Utilities.newBlob(html, 'text/html', base + '.html').getAs('application/pdf').setName(base + '.pdf');
  const folder = getOrCreateFolder_(DriveApp.getFolderById(PE_FOLDER_ID), 'Exports');
  const pdfFile = folder.createFile(pdf);
  const mdFile = folder.createFile(Utilities.newBlob(md, 'text/markdown', base + '.md'));
  return {
    ok: true, scope, contributions: nbContrib,
    pdfUrl: pdfFile.getUrl(), mdUrl: mdFile.getUrl(),
    pdfName: base + '.pdf', mdName: base + '.md',
    pdfBase64: Utilities.base64Encode(pdf.getBytes()), md
  };
}

/* ---------- Utilitaires ---------- */

function getOrCreateFolder_(parent, name) {
  const folders = parent.getFoldersByName(name);
  return folders.hasNext() ? folders.next() : parent.createFolder(name);
}

function cleanFilename_(value) {
  return cleanText_(value, 120)
    .replace(/[\\/:*?"<>|#%{}~&]/g, '_')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '') || 'production';
}

function cleanText_(value, max) {
  return String(value || '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim().slice(0, max || 120);
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
