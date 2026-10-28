var H = {
  token: null, me: null, sessions: [], filter: 'all', legacy: false,
  eventId: null, ed: null, tab: 'slides', form: null, dirty: false, saving: false,
  edTimer: null, partTimer: null, parts: null, settingsDraft: null
};
var TEMPLATES = [
  { id: 'blank', icon: 'plus', color: 'var(--c8)', name: 'Blank', desc: 'Start from scratch.' },
  { id: 'classroom', icon: 'graduation', color: 'var(--c1)', name: 'Classroom', desc: 'Icebreaker, quiz, leaderboard, Q&A, exit ticket.' },
  { id: 'meeting', icon: 'briefcase', color: 'var(--c2)', name: 'Business meeting', desc: 'Agenda, pulse poll, priorities, feedback.' },
  { id: 'retro', icon: 'refresh-cw', color: 'var(--c3)', name: 'Retrospective', desc: 'Anonymous: went well, improve, next steps.' }
];

akSetLogo(['logo-gate', 'logo-top']);
akMountTheme('theme-gate');
akMountTheme('theme-top');
$id('gate-home').href = AK_SITE.home;
$id('search-wrap').insertBefore(akIcon('search', 18), $id('search'));
$id('btn-new').appendChild(akIcon('plus', 18)); $id('btn-new').appendChild(document.createTextNode('New session'));
$id('btn-import').appendChild(akIcon('download', 17)); $id('btn-import').appendChild(document.createTextNode('Import v2 session'));
$id('btn-back').appendChild(akIcon('arrow-left', 20));
$id('btn-add-slide').appendChild(akIcon('plus', 18)); $id('btn-add-slide').appendChild(document.createTextNode('Add slide'));
[['slides', 'layers', 'Slides'], ['participants', 'users', 'Participants'], ['settings', 'settings', 'Settings'], ['report', 'file-text', 'Report']].forEach(function (t) {
  var b = document.querySelector('[data-tab="' + t[0] + '"]');
  b.appendChild(akIcon(t[1], 17)); b.appendChild(document.createTextNode(t[2]));
  if (t[0] === 'slides' || t[0] === 'participants') b.appendChild(mk('span', { class: 'count', id: 'count-' + t[0] }));
  b.addEventListener('click', function () { switchTab(t[0]); });
});

window.akOnAuthError = function (msg) {
  if (!H.token) return;
  logout(true);
  akToast(/FORBIDDEN/.test(msg) ? 'You do not have access to that session.' : 'Your session expired. Please log in again.', 'info', 4000);
};

/* ================= Auth ================= */
function showGate() {
  $id('app').hidden = true;
  $id('gate').hidden = false;
  var slot = akClear($id('gate-auth'));
  var onOk = function (res) { H.token = res.token; H.me = res.host; enterApp(); };
  var panel = akAuthPanel({ tabs: ['login', 'register'], inviteRequired: false, onSuccess: onOk });
  slot.appendChild(panel);
  akPublicConfig(function (cfg) {
    if (cfg.inviteRequired && slot.contains(panel)) slot.replaceChild(akAuthPanel({ tabs: ['login', 'register'], inviteRequired: true, onSuccess: onOk }), panel);
  });
}

function enterApp() {
  $id('gate').hidden = true;
  $id('app').hidden = false;
  renderUser();
  var target = akAppData('session');
  if (target && !H._openedParam) { H._openedParam = true; openEditor(target); }
  else showList();
}

function renderUser() {
  var n = (H.me && H.me.name) || 'Host';
  $id('avatar').textContent = n.split(/\s+/).filter(Boolean).slice(0, 2).map(function (w) { return w.charAt(0).toUpperCase(); }).join('');
  $id('uname').textContent = n;
  var first = n.split(/[\s,]+/).filter(function (w) { return w && !/^(dr|drs|dra|prof|ir|h|hj|ust|ustadz|ustadzah|bapak|ibu|pak|bu|mr|mrs|ms|miss|sir)\.?$/i.test(w); })[0] || n;
  $id('hello').textContent = 'Hello, ' + first + ' \u{1F44B}';
}

function logout(silent) {
  if (H.token && !silent) akCall('logoutSession', [H.token], null, function () {});
  akStore.set('host_token', null, true);
  H.token = null; H.me = null;
  clearInterval(H.edTimer); clearInterval(H.partTimer);
  showGate();
}

function confirmLogout() {
  var m = $id('user-menu'); if (m) m.parentNode.removeChild(m);
  akConfirm({
    title: 'Log out?', icon: 'log-out', tone: 'warning',
    message: H.dirty ? 'You have unsaved changes on a slide. They will be lost if you log out now.' : 'You will need to log in again to manage your sessions. Your sessions and results stay saved.',
    cancelText: 'Stay', confirmText: 'Log out', danger: true,
    onConfirm: function () { H.dirty = false; logout(false); }
  });
}

$id('user-btn').addEventListener('click', function (e) {
  e.stopPropagation();
  var existing = $id('user-menu');
  if (existing) { existing.parentNode.removeChild(existing); return; }
  var r = e.currentTarget.getBoundingClientRect();
  var menu = mk('div', { class: 'menu', id: 'user-menu', style: 'position:fixed;top:' + (r.bottom + 8) + 'px;right:' + Math.max(12, window.innerWidth - r.right) + 'px' }, [
    mk('div', { class: 'menu-head' }, [mk('b', { text: H.me.name }), mk('div', { class: 'small muted ellipsis', text: H.me.email }), H.me.institution ? mk('div', { class: 'tiny faint', text: H.me.institution }) : null]),
    mk('button', { class: 'menu-item', type: 'button', onclick: profileModal }, [akIcon('user', 17), 'Profile']),
    mk('button', { class: 'menu-item', type: 'button', onclick: passwordModal }, [akIcon('key', 17), 'Change password']),
    mk('a', { class: 'menu-item', href: AK_SITE.home }, [akIcon('monitor', 17), 'Home page']),
    mk('button', { class: 'menu-item danger', type: 'button', onclick: confirmLogout }, [akIcon('log-out', 17), 'Log out'])
  ]);
  document.body.appendChild(menu);
});
document.addEventListener('click', function (e) {
  var m = $id('user-menu');
  if (m && !m.contains(e.target)) m.parentNode.removeChild(m);
});

function profileModal() {
  var name = mk('input', { class: 'input', value: H.me.name, maxlength: '80' });
  var inst = mk('input', { class: 'input', value: H.me.institution || '', maxlength: '120' });
  var err = mk('div', { class: 'field-error' });
  akModal({
    title: 'Your profile', icon: 'user',
    body: mk('div', { style: 'margin-top:14px' }, [
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Full name' }), name, mk('span', { class: 'hint', text: 'Used as the default facilitator on new sessions and reports.' })]),
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Institution' }), inst]), err
    ]),
    actions: [{ label: 'Cancel', kind: 'btn-ghost' }, { label: 'Save', onClick: function (btn) {
      akBusy(btn, true);
      akCall('updateProfile', [H.token, { name: name.value, institution: inst.value }], function (res) {
        akBusy(btn, false);
        if (!res.success) { err.textContent = res.message; return; }
        H.me = res.host; renderUser(); akToast('Profile saved', 'success');
        var m = document.querySelector('.ak-modal-backdrop'); if (m) m.parentNode.removeChild(m);
      }, function () { akBusy(btn, false); err.textContent = 'Could not save.'; });
      return false;
    } }]
  });
}

function passwordModal() {
  var a = akPasswordInput('pw-old', 'Current password'), b = akPasswordInput('pw-new', 'New password', 'new-password'), c = akPasswordInput('pw-new2', 'Repeat new password', 'new-password');
  var err = mk('div', { class: 'field-error' });
  var m = akModal({
    title: 'Change password', icon: 'key',
    body: mk('div', { style: 'margin-top:14px' }, [
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Current password' }), a.wrap]),
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'New password' }), b.wrap]),
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Repeat new password' }), c.wrap]), err
    ]),
    actions: [{ label: 'Cancel', kind: 'btn-ghost' }, { label: 'Update password', onClick: function (btn) {
      err.textContent = '';
      if (b.input.value !== c.input.value) { err.textContent = 'New passwords do not match.'; return false; }
      akBusy(btn, true);
      akCall('changePassword', [H.token, a.input.value, b.input.value], function (res) {
        akBusy(btn, false);
        if (!res.success) { err.textContent = res.message; return; }
        akToast('Password updated', 'success'); m.close();
      }, function () { akBusy(btn, false); err.textContent = 'Could not update.'; });
      return false;
    } }]
  });
}

/* ================= Sessions list ================= */
$id('brand-home').addEventListener('click', function () { guardLeave(showList); });
$id('btn-back').addEventListener('click', function () { guardLeave(showList); });
$id('btn-new').addEventListener('click', newSessionModal);
$id('btn-import').addEventListener('click', importModal);
$id('search').addEventListener('input', renderSessions);
document.querySelectorAll('#filter-seg .seg-btn').forEach(function (b) {
  b.addEventListener('click', function () {
    H.filter = b.getAttribute('data-f');
    document.querySelectorAll('#filter-seg .seg-btn').forEach(function (x) { x.classList.toggle('active', x === b); });
    renderSessions();
  });
});

function showList() {
  clearInterval(H.edTimer); clearInterval(H.partTimer);
  H.eventId = null; H.ed = null; H.form = null; H.dirty = false;
  $id('view-editor').hidden = true;
  $id('view-list').hidden = false;
  window.scrollTo(0, 0);
  var grid = akClear($id('session-grid'));
  for (var i = 0; i < 3; i++) grid.appendChild(mk('div', { class: 'skeleton', style: 'height:196px' }));
  loadSessions();
}

function loadSessions() {
  akCall('listMySessions', [H.token], function (res) {
    H.sessions = res.sessions || [];
    H.legacy = !!res.legacyAvailable;
    if (res.host) { H.me = res.host; renderUser(); }
    $id('btn-import').hidden = !H.legacy;
    renderStats();
    renderSessions();
  }, function (m, auth) { if (!auth) akClear($id('session-grid')).appendChild(mk('div', { class: 'empty', text: 'Could not load your sessions. Please refresh.' })); });
}

function renderStats() {
  var box = akClear($id('list-stats'));
  var total = H.sessions.length;
  var open = H.sessions.filter(function (s) { return s.status === 'active'; }).length;
  var people = H.sessions.reduce(function (a, s) { return a + s.participants; }, 0);
  var slides = H.sessions.reduce(function (a, s) { return a + s.slides; }, 0);
  [['layers', 'var(--c1)', total, 'Sessions'], ['activity', 'var(--c7)', open, 'Open now'], ['users', 'var(--c2)', people, 'Participants'], ['grid', 'var(--c4)', slides, 'Slides']].forEach(function (s) {
    box.appendChild(mk('div', { class: 'card stat' }, [mk('span', { class: 'si', style: '--sc:' + s[1] }, [akIcon(s[0], 22)]), mk('div', null, [mk('div', { class: 'sv', text: akFmt(s[2]) }), mk('div', { class: 'sl', text: s[3] })])]));
  });
}

function renderSessions() {
  var grid = akClear($id('session-grid'));
  var q = $id('search').value.trim().toLowerCase();
  var list = H.sessions.filter(function (s) {
    if (H.filter !== 'all' && s.status !== H.filter) return false;
    return !q || (s.name + ' ' + s.code + ' ' + s.facilitator).toLowerCase().indexOf(q) >= 0;
  });
  grid.appendChild(mk('button', { class: 'card s-card new-card', type: 'button', onclick: newSessionModal }, [mk('div', null, [mk('div', { class: 'empty-ic', style: 'width:54px;height:54px;border-radius:18px;margin:0 auto 10px;display:grid;place-items:center;background:var(--primary-soft);color:var(--primary)' }, [akIcon('plus', 26)]), mk('b', { text: 'New session' }), mk('div', { class: 'small', text: 'Blank or from a template' })])]));
  if (!list.length && H.sessions.length) grid.appendChild(mk('div', { class: 'empty', style: 'grid-column:1/-1', text: 'No sessions match your search.' }));
  list.forEach(function (s, i) {
    var present = mk('a', { class: 'btn btn-sm btn-secondary', href: AK_SITE.presenter(s.id), target: '_blank', rel: 'noopener', onclick: function (e) { e.stopPropagation(); } }, [akIcon('play', 15), 'Present']);
    var dup = mk('button', { class: 'icon-btn sm', type: 'button', title: 'Duplicate', 'aria-label': 'Duplicate' }, [akIcon('copy', 17)]);
    var del = mk('button', { class: 'icon-btn sm danger', type: 'button', title: 'Delete', 'aria-label': 'Delete' }, [akIcon('trash', 17)]);
    dup.addEventListener('click', function (e) { e.stopPropagation(); duplicateSession(s, dup); });
    del.addEventListener('click', function (e) { e.stopPropagation(); deleteSession(s); });
    grid.appendChild(mk('div', { class: 'card s-card', style: 'animation-delay:' + Math.min(i * 40, 400) + 'ms', tabindex: '0', onclick: function () { openEditor(s.id); }, onkeydown: function (e) { if (e.key === 'Enter') openEditor(s.id); } }, [
      mk('div', { class: 'row', style: 'justify-content:space-between' }, [
        mk('span', { class: 'badge ' + (s.status === 'active' ? 'badge-success' : '') }, [s.status === 'active' ? mk('span', { class: 'live-dot' }) : akIcon('lock', 12), s.status === 'active' ? 'Open' : 'Closed']),
        mk('span', { class: 'code-chip', style: 'font-size:13px;padding:3px 10px', text: s.code })
      ]),
      mk('h3', { text: s.name }),
      mk('div', { class: 's-meta' }, [mk('span', null, [akIcon('user', 14), s.facilitator]), mk('span', null, [akIcon('layers', 14), s.slides + ' slides']), mk('span', null, [akIcon('users', 14), s.participants + ' joined'])]),
      mk('div', { class: 'tiny faint', text: 'Updated ' + akAgo(s.updatedAt) }),
      mk('div', { class: 's-actions' }, [mk('button', { class: 'btn btn-sm btn-soft', type: 'button' }, [akIcon('edit', 15), 'Edit']), present, mk('span', { class: 'grow' }), dup, del])
    ]));
  });
}

function newSessionModal() {
  var name = mk('input', { class: 'input', placeholder: 'e.g. Biology 10A — Photosynthesis', maxlength: '120', autofocus: true });
  var fac = mk('input', { class: 'input', value: (H.me && H.me.name) || '', maxlength: '120' });
  var desc = mk('textarea', { class: 'textarea', rows: '2', maxlength: '500', placeholder: 'Optional — shown on the report' });
  var tpl = 'classroom';
  var grid = mk('div', { class: 'tpl-grid' });
  TEMPLATES.forEach(function (t) {
    var b = mk('button', { class: 'tpl' + (t.id === tpl ? ' sel' : ''), type: 'button' }, [mk('span', { class: 'ti', style: 'background:' + t.color }, [akIcon(t.icon, 19)]), mk('div', null, [mk('b', { text: t.name }), mk('span', { text: t.desc })])]);
    b.addEventListener('click', function () { tpl = t.id; Array.prototype.forEach.call(grid.children, function (c) { c.classList.toggle('sel', c === b); }); });
    grid.appendChild(b);
  });
  var err = mk('div', { class: 'field-error' });
  var m = akModal({
    title: 'New session', size: 'lg', icon: 'sparkles',
    body: mk('div', { style: 'margin-top:14px' }, [
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Session name' }), name]),
      mk('div', { class: 'grid-2' }, [
        mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Facilitator (teacher / lecturer / mentor)' }), fac]),
        mk('div', { class: 'field' }, [mk('label', { class: 'label', html: null, text: 'Description' }), desc])
      ]),
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Start from' }), grid]), err
    ]),
    actions: [{ label: 'Cancel', kind: 'btn-ghost' }, { label: 'Create session', onClick: function (btn) {
      err.textContent = '';
      if (!name.value.trim()) { err.textContent = 'Please give your session a name.'; name.focus(); return false; }
      akBusy(btn, true, 'Creating…');
      akCall('createSession', [H.token, { name: name.value, facilitator: fac.value, description: desc.value, template: tpl }], function (res) {
        akBusy(btn, false);
        if (!res.success) { err.textContent = res.message; return; }
        m.close(); akToast('Session created', 'success'); openEditor(res.eventId);
      }, function () { akBusy(btn, false); err.textContent = 'Could not create the session.'; });
      return false;
    } }]
  });
}

function importModal() {
  var key = mk('input', { class: 'input', type: 'password', placeholder: 'AdminKey from version 2', autocomplete: 'off', maxlength: '64' });
  var err = mk('div', { class: 'field-error' });
  var m = akModal({
    title: 'Import a version 2 session', icon: 'download',
    message: 'Sessions created before accounts existed can be attached to your account with their AdminKey (see the Events sheet or the setup log).',
    body: mk('div', { style: 'margin-top:14px' }, [key, err]),
    actions: [{ label: 'Cancel', kind: 'btn-ghost' }, { label: 'Import', onClick: function (btn) {
      akBusy(btn, true);
      akCall('claimLegacySession', [H.token, key.value], function (res) {
        akBusy(btn, false);
        if (!res.success) { err.textContent = res.message; return; }
        m.close(); akToast('"' + res.name + '" imported', 'success'); loadSessions();
      }, function () { akBusy(btn, false); err.textContent = 'Could not import.'; });
      return false;
    } }]
  });
}

function duplicateSession(s, btn) {
  btn.disabled = true;
  akCall('duplicateSession', [H.token, s.id], function (res) {
    btn.disabled = false;
    if (!res.success) { akToast(res.message, 'error'); return; }
    akToast('Copy created with a new code', 'success'); loadSessions();
  }, function () { btn.disabled = false; });
}

function deleteSession(s, after) {
  var confirmInput = mk('input', { class: 'input', placeholder: 'Type DELETE to confirm', autocomplete: 'off' });
  akModal({
    title: 'Delete "' + s.name + '"?', icon: 'trash', danger: true,
    message: 'All slides, answers and the participant list will be permanently deleted. Export the PDF report first if you still need the results.',
    body: mk('div', { style: 'margin-top:14px' }, [confirmInput]),
    actions: [{ label: 'Cancel', kind: 'btn-ghost' }, { label: 'Delete forever', kind: 'btn-solid-danger', onClick: function (btn) {
      if (confirmInput.value.trim().toUpperCase() !== 'DELETE') { confirmInput.focus(); akToast('Type DELETE to confirm', 'info'); return false; }
      akBusy(btn, true);
      akCall('deleteSession', [H.token, s.id], function (res) {
        akBusy(btn, false);
        if (!res.success) { akToast(res.message, 'error'); return; }
        var m = document.querySelector('.ak-modal-backdrop'); if (m) m.parentNode.removeChild(m);
        akToast('Session deleted', 'success');
        if (after) after(); else loadSessions();
      }, function () { akBusy(btn, false); });
      return false;
    } }]
  });
}

/* ================= Editor ================= */
// Runs fn now, or after the user confirms discarding unsaved slide changes (themed dialog, not window.confirm).
function guardLeave(fn) {
  if (!H.dirty) { fn(); return; }
  akConfirm({
    title: 'Discard unsaved changes?', icon: 'edit', tone: 'warning',
    message: 'You have edits on this slide that have not been saved yet.',
    cancelText: 'Keep editing', confirmText: 'Discard', danger: true,
    onConfirm: function () { H.dirty = false; fn(); }
  });
}

function openEditor(id) {
  H.eventId = id; H.ed = null; H.form = null; H.dirty = false; H.parts = null; H.settingsDraft = null;
  $id('view-list').hidden = true;
  $id('view-editor').hidden = false;
  window.scrollTo(0, 0);
  $id('ed-name').textContent = 'Loading…';
  akClear($id('ed-sub')); akClear($id('ed-actions')); akClear($id('slide-list'));
  akClear($id('slide-form')).appendChild(mk('div', { class: 'skeleton', style: 'height:300px' }));
  switchTab('slides', true);
  loadEditor(function () {
    var first = H.ed.items[0];
    if (first) selectSlide(first.contentId); else renderSlideForm();
  });
  clearInterval(H.edTimer);
  H.edTimer = setInterval(function () { if (!document.hidden && !H.saving && H.eventId) loadEditor(); }, 12000);
}

function loadEditor(cb) {
  var id = H.eventId;
  akCall('getSessionEditor', [H.token, id], function (res) {
    if (H.eventId !== id) return;
    res.joinUrl = AK_SITE.join(res.event.code);
    res.presentUrl = AK_SITE.presenter(res.event.id);
    H.ed = res;
    renderEditorHead();
    renderSlideList();
    if (H.form && H.form.cid && !H.ed.items.some(function (i) { return i.contentId === H.form.cid; })) { H.form = null; H.dirty = false; renderSlideForm(); }
    if (H.tab === 'report') renderReport();
    if (cb) cb();
  }, function (msg, auth) {
    if (auth) return;
    if (/NOT_FOUND/.test(msg)) { akToast('That session no longer exists.', 'error'); showList(); }
  });
}

function renderEditorHead() {
  var ev = H.ed.event;
  $id('ed-name').textContent = ev.name;
  var sub = akClear($id('ed-sub'));
  sub.appendChild(mk('span', { class: 'code-chip', title: 'Session code' }, [ev.codeDisplay]));
  sub.appendChild(mk('span', null, [akIcon('user', 14), ' ', ev.facilitatorResolved || '-']));
  sub.appendChild(mk('span', null, [mk('span', { class: 'online on' }), H.ed.onlineCount + ' online \u00B7 ' + H.ed.participantCount + ' joined']));
  $id('count-slides').textContent = String(H.ed.items.length);
  $id('count-participants').textContent = String(H.ed.participantCount);

  var act = akClear($id('ed-actions'));
  var open = ev.status === 'active';
  var sw = mk('input', { type: 'checkbox' }); sw.checked = open;
  sw.addEventListener('change', function () {
    var want = sw.checked ? 'active' : 'closed';
    var go = function () {
      akCall('setSessionStatus', [H.token, H.eventId, want], function (res) {
        if (!res.success) { akToast(res.message, 'error'); sw.checked = !sw.checked; return; }
        akToast(want === 'active' ? 'Session is open — participants can join' : 'Session closed — participants were signed out', 'success'); loadEditor();
      }, function () { sw.checked = !sw.checked; });
    };
    if (want === 'closed') akConfirm({ title: 'Close this session?', message: 'Participants will be signed out and nobody can join until you open it again. Results are kept.', confirmText: 'Close session', danger: true, onConfirm: go });
    else go();
    if (want === 'closed') sw.checked = true; // revert until confirmed
  });
  act.appendChild(mk('label', { class: 'switch', title: 'Open or close the session' }, [sw, mk('span', { class: 'track' }), mk('span', { class: 'small', style: 'font-weight:650', text: open ? 'Open' : 'Closed' })]));
  act.appendChild(mk('button', { class: 'btn btn-secondary btn-sm', type: 'button', onclick: qrModal }, [akIcon('qr', 16), 'Share']));
  act.appendChild(mk('a', { class: 'btn btn-primary', href: H.ed.presentUrl || '#', target: '_blank', rel: 'noopener' }, [akIcon('play', 16), 'Present']));
}

function qrModal() {
  var ev = H.ed.event;
  var qr = mk('div', { class: 'center', style: 'margin:18px 0' });
  akModal({
    title: 'Invite participants', icon: 'qr',
    body: mk('div', null, [
      qr,
      mk('div', { class: 'center', style: 'margin-bottom:14px' }, [mk('div', { class: 'small muted', text: 'Session code' }), mk('div', { class: 'code-chip', style: 'font-size:26px;margin-top:6px', text: ev.codeDisplay })]),
      mk('div', { class: 'row' }, [mk('input', { class: 'input', readonly: true, value: H.ed.joinUrl, onclick: function (e) { e.target.select(); } }), mk('button', { class: 'btn btn-soft', type: 'button', onclick: function () { akCopy(H.ed.joinUrl, 'Join link copied'); } }, [akIcon('copy', 16), 'Copy'])])
    ]),
    actions: [{ label: 'Done', kind: 'btn-primary' }]
  });
  akQr(qr, H.ed.joinUrl, 200);
}

function switchTab(tab, silent) {
  if (!silent && H.tab === 'slides' && tab !== 'slides' && H.dirty) { guardLeave(function () { switchTab(tab, true); }); return; }
  if (tab !== 'slides') H.dirty = false;
  H.tab = tab;
  document.querySelectorAll('#ed-tabs .tab').forEach(function (b) { b.classList.toggle('active', b.getAttribute('data-tab') === tab); });
  ['slides', 'participants', 'settings', 'report'].forEach(function (t) { $id('tab-' + t).hidden = t !== tab; });
  clearInterval(H.partTimer);
  if (tab === 'participants') { loadParticipants(); H.partTimer = setInterval(function () { if (!document.hidden) loadParticipants(); }, 10000); }
  if (tab === 'settings' && H.ed) renderSettings();
  if (tab === 'report' && H.ed) renderReport();
}

/* ---------- Slides list ---------- */
$id('btn-add-slide').addEventListener('click', function () { guardLeave(typePicker); });

function renderSlideList() {
  var list = akClear($id('slide-list'));
  var items = H.ed.items;
  if (!items.length) {
    list.appendChild(mk('div', { class: 'empty', style: 'padding:30px 10px' }, [mk('p', { class: 'small', text: 'No slides yet. Add your first one!' })]));
    return;
  }
  items.forEach(function (it, idx) {
    var t = AK_TYPES[it.type] || { label: it.type, icon: 'alert', color: 'var(--danger)' };
    var up = mk('button', { class: 'icon-btn', type: 'button', title: 'Move up', 'aria-label': 'Move up', disabled: idx === 0 }, [akIcon('chevron-up', 15)]);
    var dn = mk('button', { class: 'icon-btn', type: 'button', title: 'Move down', 'aria-label': 'Move down', disabled: idx === items.length - 1 }, [akIcon('chevron-down', 15)]);
    up.addEventListener('click', function (e) { e.stopPropagation(); moveSlide(it, 'up'); });
    dn.addEventListener('click', function (e) { e.stopPropagation(); moveSlide(it, 'down'); });
    var meta = [t.label];
    if (['announcement', 'leaderboard'].indexOf(it.type) < 0) meta.push(it.responseCount + ' resp.');
    if (it.status === 'draft') meta.push('Hidden'); else if (it.status === 'closed') meta.push('Closed');
    if (!it.known) meta = ['Unknown type — edit to fix'];
    list.appendChild(mk('div', { class: 'sl-item' + (H.form && H.form.cid === it.contentId ? ' sel' : '') + (it.status === 'draft' ? ' draft' : ''), tabindex: '0', onclick: function () { if (!H.form || H.form.cid !== it.contentId) guardLeave(function () { selectSlide(it.contentId); }); }, onkeydown: function (e) { if (e.key === 'Enter') guardLeave(function () { selectSlide(it.contentId); }); } }, [
      mk('span', { class: 'sl-num', text: String(idx + 1) }),
      mk('span', { class: 'sl-ic', style: '--tc:' + t.color }, [akIcon(t.icon, 18)]),
      mk('span', { class: 'sl-t' }, [mk('b', { text: it.title }), mk('span', { text: meta.join(' \u00B7 ') })]),
      mk('span', { class: 'sl-move' }, [up, dn])
    ]));
  });
}

function moveSlide(it, dir) {
  H.saving = true;
  akCall('moveContentItem', [H.token, H.eventId, it.contentId, dir], function (res) {
    H.saving = false;
    if (!res.success) akToast(res.message, 'error');
    loadEditor();
  }, function () { H.saving = false; });
}

function typePicker() {
  var grid = mk('div', { class: 'type-grid', style: 'margin-top:16px' });
  var m;
  AK_TYPE_ORDER.forEach(function (k) {
    var t = AK_TYPES[k];
    grid.appendChild(mk('button', { class: 'type-card', type: 'button', style: '--tc:' + t.color, onclick: function () { m.close(); startNew(k); } }, [
      mk('span', { class: 'tic' }, [akIcon(t.icon, 20)]), mk('b', { text: t.label }), mk('span', { text: t.desc })
    ]));
  });
  m = akModal({ title: 'Choose a slide type', size: 'xl', body: grid });
}

function blankForm(type) {
  var f = { cid: null, type: type, title: '', description: '', options: [], correctIdx: -1, config: {}, status: 'active', responseCount: 0 };
  if (type === 'poll' || type === 'multiplechoice') f.options = ['', '', ''];
  if (type === 'ranking') f.options = ['', '', ''];
  if (type === 'scales') { f.options = ['', '']; f.config = { min: 1, max: 5, minLabel: 'Strongly disagree', maxLabel: 'Strongly agree' }; }
  if (type === 'multiplechoice') f.config = { timeLimit: 20 };
  if (type === 'wordcloud') f.config = { maxEntries: 1 };
  if (type === 'writing') f.config = { maxLength: 1000 };
  if (type === 'qna') f.config = { maxQuestions: 3 };
  if (type === 'leaderboard') f.title = 'Leaderboard';
  return f;
}

function startNew(type) {
  H.form = blankForm(type);
  H.dirty = true;
  renderSlideList();
  renderSlideForm();
}

function selectSlide(cid) {
  var it = H.ed.items.find(function (i) { return i.contentId === cid; });
  if (!it) return;
  var type = it.known ? it.type : 'poll';
  H.form = {
    cid: it.contentId, type: type, title: it.title, description: it.description || '',
    options: (it.options || []).slice(), correctIdx: (it.options || []).indexOf(it.correctAnswer),
    config: JSON.parse(JSON.stringify(it.config || {})), status: it.status, responseCount: it.responseCount, origType: it.type
  };
  if (!it.known) H.form.config = blankForm(type).config;
  H.dirty = false;
  renderSlideList();
  renderSlideForm();
}

function selectField(label, value, options, onChange, disabled) {
  var sel = mk('select', { class: 'select', disabled: !!disabled });
  options.forEach(function (o) { var op = new Option(o[1], String(o[0])); sel.appendChild(op); });
  sel.value = String(value);
  sel.addEventListener('change', function () { onChange(sel.value); H.dirty = true; });
  return mk('div', { class: 'field' }, [mk('label', { class: 'label', text: label }), sel]);
}

function normOpt(s) { return String(s || '').replace(/\s+/g, ' ').trim().replace(/\|/g, '/'); }

function renderSlideForm() {
  var box = akClear($id('slide-form'));
  var f = H.form;
  if (!f) {
    box.appendChild(mk('div', { class: 'empty' }, [
      mk('div', { class: 'empty-ic' }, [akIcon('layers', 30)]), mk('h3', { text: H.ed && H.ed.items.length ? 'Select a slide to edit' : 'Add your first slide' }),
      mk('p', { style: 'margin-bottom:18px', text: 'Polls, quizzes, word clouds, Q&A and more.' }),
      mk('button', { class: 'btn btn-primary', type: 'button', onclick: typePicker }, [akIcon('plus', 18), 'Add slide'])
    ]));
    return;
  }
  var locked = f.cid && f.responseCount > 0;
  var hasOptions = ['poll', 'multiplechoice', 'ranking', 'scales'].indexOf(f.type) >= 0;
  var t = AK_TYPES[f.type];
  var mark = function () { H.dirty = true; };

  var head = mk('div', { class: 'form-head' }, [mk('h2', { text: f.cid ? 'Edit slide' : 'New slide' }), akTypePill(f.type)]);
  if (f.cid && ['announcement', 'leaderboard'].indexOf(f.type) < 0) head.appendChild(mk('span', { class: 'badge', text: f.responseCount + ' response(s)' }));
  box.appendChild(head);

  if (locked && (hasOptions || true)) {
    box.appendChild(mk('div', { class: 'edit-note' }, [akIcon('lock', 17), mk('span', { text: 'This slide already has answers, so its type' + (hasOptions ? ' and options are' : ' is') + ' locked to keep results valid. You can still edit the text' + (f.type === 'multiplechoice' ? ', the correct answer (scores are recalculated)' : '') + ' and visibility. To change more, duplicate the slide.' })]));
  }

  // Type
  var typeOpts = AK_TYPE_ORDER.map(function (k) { return [k, AK_TYPES[k].label]; });
  box.appendChild(selectField('Slide type', f.type, typeOpts, function (v) {
    var nf = blankForm(v);
    nf.cid = f.cid; nf.title = f.title || nf.title; nf.description = f.description; nf.status = f.status; nf.responseCount = f.responseCount;
    if (['poll', 'multiplechoice', 'ranking'].indexOf(v) >= 0 && f.options.length) nf.options = f.options.slice();
    H.form = nf; H.dirty = true; renderSlideForm();
  }, locked));

  // Title & description
  var titleLabel = f.type === 'announcement' ? 'Heading' : f.type === 'leaderboard' ? 'Title' : 'Your question';
  var title = mk('input', { class: 'input input-lg', maxlength: '200', value: f.title, placeholder: f.type === 'announcement' ? 'e.g. Today\'s agenda' : 'Ask your audience something…' });
  var tCount = mk('span', { class: 'counter', text: f.title.length + ' / 200' });
  title.addEventListener('input', function () { f.title = title.value; tCount.textContent = f.title.length + ' / 200'; mark(); });
  box.appendChild(mk('div', { class: 'field' }, [mk('div', { class: 'row', style: 'justify-content:space-between' }, [mk('label', { class: 'label', text: titleLabel }), tCount]), title]));
  if (f.type !== 'leaderboard') {
    var desc = mk('textarea', { class: 'textarea', rows: f.type === 'announcement' ? '6' : '2', maxlength: '2000', placeholder: f.type === 'announcement' ? 'Body text — instructions, agenda, key points…' : 'Optional extra instructions or context' });
    desc.value = f.description;
    desc.addEventListener('input', function () { f.description = desc.value; mark(); });
    box.appendChild(mk('div', { class: 'field' }, [mk('label', { class: 'label' }, [f.type === 'announcement' ? 'Body text' : 'Description ', f.type === 'announcement' ? null : mk('span', { class: 'opt', text: '(optional)' })]), desc]));
  }

  // Options
  if (hasOptions) box.appendChild(optionsEditor(f, locked));

  // Type-specific settings
  var cfg = mk('div', { class: 'config-grid' });
  if (f.type === 'poll') {
    var multi = mk('input', { type: 'checkbox' }); multi.checked = !!f.config.multi; multi.disabled = locked;
    multi.addEventListener('change', function () { f.config.multi = multi.checked; mark(); });
    cfg.appendChild(mk('div', { class: 'field', style: 'justify-content:flex-end' }, [mk('label', { class: 'switch' }, [multi, mk('span', { class: 'track' }), mk('span', { class: 'small', style: 'font-weight:600', text: 'Allow multiple choices' })])]));
  }
  if (f.type === 'multiplechoice') {
    cfg.appendChild(selectField('Countdown', f.config.timeLimit || 0, [[0, 'No timer'], [10, '10 seconds'], [15, '15 seconds'], [20, '20 seconds'], [30, '30 seconds'], [45, '45 seconds'], [60, '1 minute'], [90, '90 seconds'], [120, '2 minutes']], function (v) { f.config.timeLimit = Number(v); }));
  }
  if (f.type === 'wordcloud') cfg.appendChild(selectField('Entries per participant', f.config.maxEntries || 1, [[1, '1'], [2, '2'], [3, '3'], [4, '4'], [5, '5']], function (v) { f.config.maxEntries = Number(v); }));
  if (f.type === 'writing') cfg.appendChild(selectField('Maximum length', f.config.maxLength || 1000, [[200, '200 characters'], [500, '500 characters'], [1000, '1,000 characters'], [2000, '2,000 characters']], function (v) { f.config.maxLength = Number(v); }));
  if (f.type === 'qna') cfg.appendChild(selectField('Questions per participant', f.config.maxQuestions || 3, [[1, '1'], [2, '2'], [3, '3'], [5, '5'], [10, '10']], function (v) { f.config.maxQuestions = Number(v); }));
  if (f.type === 'scales') {
    cfg.appendChild(selectField('Lowest value', f.config.min, [[0, '0'], [1, '1']], function (v) { f.config.min = Number(v); }, locked));
    cfg.appendChild(selectField('Highest value', f.config.max, [[3, '3'], [4, '4'], [5, '5'], [7, '7'], [10, '10']], function (v) { f.config.max = Number(v); }, locked));
    var lo = mk('input', { class: 'input', maxlength: '40', value: f.config.minLabel || '' });
    var hi = mk('input', { class: 'input', maxlength: '40', value: f.config.maxLabel || '' });
    lo.addEventListener('input', function () { f.config.minLabel = lo.value; mark(); });
    hi.addEventListener('input', function () { f.config.maxLabel = hi.value; mark(); });
    cfg.appendChild(mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Label for lowest' }), lo]));
    cfg.appendChild(mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Label for highest' }), hi]));
  }
  if (cfg.childNodes.length) box.appendChild(cfg);
  if (f.type === 'multiplechoice') box.appendChild(mk('p', { class: 'hint', style: 'margin:-6px 0 14px', text: 'In presenter-paced sessions the countdown starts 3 seconds after you show the slide. Faster correct answers earn more points (500–1,000).' }));
  if (f.type === 'leaderboard') box.appendChild(mk('div', { class: 'notice', style: 'display:flex;gap:10px;padding:12px 14px;border-radius:14px;background:var(--primary-soft);margin-bottom:14px' }, [akIcon('info', 18), mk('span', { class: 'small', text: 'Shows the total quiz points of all participants. Place it after your quiz questions.' })]));

  // Visibility
  var seg = mk('div', { class: 'seg' });
  [['active', 'eye', 'Open'], ['closed', 'lock', 'Closed'], ['draft', 'eye-off', 'Hidden']].forEach(function (s) {
    var b = mk('button', { class: 'seg-btn' + (f.status === s[0] ? ' active' : ''), type: 'button' }, [akIcon(s[1], 15), s[2]]);
    b.addEventListener('click', function () { f.status = s[0]; Array.prototype.forEach.call(seg.children, function (c) { c.classList.toggle('active', c === b); }); statusHint.textContent = STATUS_HINT[s[0]]; mark(); });
    seg.appendChild(b);
  });
  var STATUS_HINT = { active: 'Visible and accepting answers.', closed: 'Visible with results, but no new answers.', draft: 'Skipped in the presentation and hidden from participants.' };
  var statusHint = mk('span', { class: 'hint', text: STATUS_HINT[f.status] });
  box.appendChild(mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Visibility' }), mk('div', { class: 'row wrap' }, [seg, statusHint])]));

  var err = mk('div', { class: 'field-error', id: 'form-err' });
  box.appendChild(err);
  var save = mk('button', { class: 'btn btn-primary', type: 'button' }, [akIcon('check', 17), f.cid ? 'Save changes' : 'Add slide']);
  save.addEventListener('click', function () { saveSlide(save, err); });
  var actions = mk('div', { class: 'form-actions' }, [save]);
  if (!f.cid || H.dirty) actions.appendChild(mk('button', { class: 'btn btn-ghost', type: 'button', text: 'Cancel', onclick: function () { H.dirty = false; if (f.cid) selectSlide(f.cid); else { H.form = null; renderSlideList(); renderSlideForm(); } } }));
  actions.appendChild(mk('span', { class: 'sp' }));
  if (f.cid) {
    var dup = mk('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [akIcon('copy', 15), 'Duplicate']);
    dup.addEventListener('click', function () { duplicateSlide(f.cid, dup); });
    var del = mk('button', { class: 'btn btn-danger btn-sm', type: 'button' }, [akIcon('trash', 15), 'Delete']);
    del.addEventListener('click', function () { deleteSlide(f); });
    actions.appendChild(dup); actions.appendChild(del);
  }
  box.appendChild(actions);
  if (!f.cid) setTimeout(function () { title.focus(); }, 60);
}

function optionsEditor(f, locked) {
  var isScale = f.type === 'scales', isQuiz = f.type === 'multiplechoice';
  var max = isScale ? 8 : 10, min = isScale ? 1 : 2;
  var wrap = mk('div', { class: 'field' });
  wrap.appendChild(mk('label', { class: 'label', text: isScale ? 'Statements to rate' : f.type === 'ranking' ? 'Items to rank' : isQuiz ? 'Answer options — mark the correct one' : 'Options' }));
  var list = mk('div', { class: 'opt-editor' });
  var addBtn = mk('button', { class: 'btn btn-ghost btn-sm', type: 'button', style: 'align-self:flex-start' }, [akIcon('plus', 15), isScale ? 'Add statement' : 'Add option']);
  function draw() {
    akClear(list);
    f.options.forEach(function (o, i) {
      var input = mk('input', { class: 'input', maxlength: '150', value: o, placeholder: (isScale ? 'Statement ' : 'Option ') + (i + 1), disabled: locked });
      input.addEventListener('input', function () { f.options[i] = input.value; H.dirty = true; });
      input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !locked && f.options.length < max) { e.preventDefault(); f.options.splice(i + 1, 0, ''); H.dirty = true; draw(); var n = list.children[i + 1]; if (n) n.querySelector('input').focus(); } });
      var row = mk('div', { class: 'opt-row' }, [mk('span', { class: 'dot', style: 'background:' + akColor(i) }), input]);
      if (isQuiz) {
        var cb = mk('button', { class: 'correct-btn' + (f.correctIdx === i ? ' on' : ''), type: 'button', title: 'Mark as correct' }, [akIcon('check', 15), f.correctIdx === i ? 'Correct' : '']);
        cb.addEventListener('click', function () { f.correctIdx = i; H.dirty = true; draw(); });
        row.appendChild(cb);
      }
      if (!locked) {
        var rm = mk('button', { class: 'icon-btn sm danger', type: 'button', title: 'Remove', 'aria-label': 'Remove', disabled: f.options.length <= min }, [akIcon('x', 16)]);
        rm.addEventListener('click', function () {
          f.options.splice(i, 1);
          if (f.correctIdx === i) f.correctIdx = -1; else if (f.correctIdx > i) f.correctIdx--;
          H.dirty = true; draw();
        });
        row.appendChild(rm);
      }
      list.appendChild(row);
    });
    addBtn.hidden = locked || f.options.length >= max;
  }
  addBtn.addEventListener('click', function () { f.options.push(''); H.dirty = true; draw(); var last = list.lastChild; if (last) last.querySelector('input').focus(); });
  draw();
  wrap.appendChild(list);
  wrap.appendChild(addBtn);
  return wrap;
}

function saveSlide(btn, err) {
  var f = H.form;
  err.textContent = '';
  var opts = f.options.map(normOpt);
  var payload = { type: f.type, title: f.title, description: f.description, options: opts.filter(Boolean), config: f.config, status: f.status };
  if (!payload.title.trim()) { err.textContent = f.type === 'announcement' ? 'Please add a heading.' : 'Please write your question.'; return; }
  if (['poll', 'multiplechoice', 'ranking'].indexOf(f.type) >= 0 && payload.options.length < 2) { err.textContent = 'Please provide at least 2 options.'; return; }
  if (f.type === 'scales' && !payload.options.length) { err.textContent = 'Please add at least 1 statement.'; return; }
  if (f.type === 'multiplechoice') {
    var correct = f.correctIdx >= 0 ? opts[f.correctIdx] : '';
    if (!correct) { err.textContent = 'Please mark the correct answer.'; return; }
    payload.correctAnswer = correct;
  }
  H.saving = true;
  akBusy(btn, true, 'Saving…');
  var fn = f.cid ? 'updateContentItem' : 'addContentItem';
  var args = f.cid ? [H.token, H.eventId, f.cid, payload] : [H.token, H.eventId, payload];
  akCall(fn, args, function (res) {
    H.saving = false;
    akBusy(btn, false);
    if (!res.success) { err.textContent = res.message; return; }
    H.dirty = false;
    akToast(f.cid ? 'Slide saved' : 'Slide added', 'success');
    var target = f.cid || res.contentId;
    loadEditor(function () { selectSlide(target); });
  }, function (m, auth) { H.saving = false; akBusy(btn, false); if (!auth) err.textContent = 'Could not save. Please try again.'; });
}

function duplicateSlide(cid, btn) {
  akBusy(btn, true);
  akCall('duplicateContentItem', [H.token, H.eventId, cid], function (res) {
    akBusy(btn, false);
    if (!res.success) { akToast(res.message, 'error'); return; }
    akToast('Copy added (hidden) right after the original', 'success');
    loadEditor(function () { selectSlide(res.contentId); });
  }, function () { akBusy(btn, false); });
}

function deleteSlide(f) {
  akConfirm({
    title: 'Delete this slide?', danger: true, confirmText: 'Delete',
    message: '"' + f.title + '"' + (f.responseCount ? ' and its ' + f.responseCount + ' response(s) will be permanently deleted.' : ' will be permanently deleted.') + ' This cannot be undone.',
    onConfirm: function () {
      akCall('deleteContentItem', [H.token, H.eventId, f.cid], function (res) {
        if (!res.success) { akToast(res.message, 'error'); return; }
        akToast('Slide deleted', 'success');
        H.form = null; H.dirty = false;
        loadEditor(function () { renderSlideForm(); });
      });
    }
  });
}

/* ---------- Participants ---------- */
function loadParticipants() {
  var id = H.eventId;
  var box = $id('tab-participants');
  if (!H.parts) akClear(box).appendChild(mk('div', { class: 'skeleton', style: 'height:240px' }));
  akCall('getParticipantList', [H.token, id], function (res) {
    if (H.eventId !== id || H.tab !== 'participants') return;
    H.parts = res;
    renderParticipants();
  }, function () {});
}

function renderParticipants() {
  var res = H.parts, box = $id('tab-participants');
  var keepQ = $id('p-search') ? $id('p-search').value : '';
  akClear(box);
  var rows = res.rows || [];
  var active = rows.filter(function (r) { return r.status !== 'removed'; });
  var online = active.filter(function (r) { return r.online; }).length;
  var settings = H.ed.event.settings;

  var lock = mk('input', { type: 'checkbox' }); lock.checked = !!settings.lockJoin;
  lock.addEventListener('change', function () {
    akCall('updateSession', [H.token, H.eventId, { settings: { lockJoin: lock.checked } }], function (r) {
      if (!r.success) { akToast(r.message, 'error'); lock.checked = !lock.checked; return; }
      settings.lockJoin = lock.checked;
      akToast(lock.checked ? 'Joining locked — no new participants' : 'Joining unlocked', 'success');
    });
  });
  box.appendChild(mk('div', { class: 'stat-row' }, [
    mk('div', { class: 'card stat' }, [mk('span', { class: 'si', style: '--sc:var(--c2)' }, [akIcon('users', 22)]), mk('div', null, [mk('div', { class: 'sv', text: active.length + ' / ' + res.max }), mk('div', { class: 'sl', text: 'Joined' })])]),
    mk('div', { class: 'card stat' }, [mk('span', { class: 'si', style: '--sc:var(--c7)' }, [akIcon('activity', 22)]), mk('div', null, [mk('div', { class: 'sv', text: String(online) }), mk('div', { class: 'sl', text: 'Online now' })])]),
    mk('div', { class: 'card stat', style: 'justify-content:space-between' }, [mk('div', null, [mk('div', { style: 'font-weight:700', text: 'Lock joining' }), mk('div', { class: 'sl', text: 'Block new participants' })]), mk('label', { class: 'switch' }, [lock, mk('span', { class: 'track' })])])
  ]));

  var search = mk('input', { class: 'input', id: 'p-search', placeholder: 'Search by name, email or ID…', value: keepQ });
  var tools = mk('div', { class: 'list-tools' }, [mk('div', { class: 'search' }, [akIcon('search', 18), search]), mk('span', { class: 'grow' }),
    mk('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: loadParticipants }, [akIcon('refresh', 15), 'Refresh'])]);
  box.appendChild(tools);
  var tableWrap = mk('div', { class: 'table-wrap card' });
  box.appendChild(tableWrap);
  var draw = function () {
    akClear(tableWrap);
    var q = search.value.trim().toLowerCase();
    var list = rows.filter(function (r) { return !q || (r.name + ' ' + r.email + ' ' + r.nim).toLowerCase().indexOf(q) >= 0; });
    if (!list.length) { tableWrap.appendChild(mk('div', { class: 'empty', text: rows.length ? 'No participants match your search.' : 'Nobody has joined yet. Share the code or QR to get started.' })); return; }
    var table = mk('table', { class: 'table' }, [mk('tr', null, ['#', 'Name', 'Email', 'ID', 'Joined', 'Answered', 'Quiz pts', 'Left page', ''].map(function (h) { return mk('th', { text: h }); }))]);
    list.forEach(function (r, i) {
      var j = new Date(r.joinedAt);
      var act = r.status === 'removed'
        ? mk('button', { class: 'btn btn-ghost btn-sm', type: 'button', text: 'Restore', onclick: function () { setPart(r, 'active'); } })
        : mk('button', { class: 'btn btn-danger btn-sm', type: 'button', text: 'Remove', onclick: function () { akConfirm({ title: 'Remove ' + r.name + '?', message: 'They will be signed out and cannot rejoin with the same email. Their answers are kept.', confirmText: 'Remove', danger: true, onConfirm: function () { setPart(r, 'removed'); } }); } });
      table.appendChild(mk('tr', { class: r.status === 'removed' ? 'removed' : '' }, [
        mk('td', { text: String(i + 1) }),
        mk('td', null, [mk('span', { class: 'online' + (r.online ? ' on' : ''), title: r.online ? 'Online' : 'Offline' }), r.name]),
        mk('td', { text: r.email || '\u2013' }), mk('td', { text: r.nim || '\u2013' }),
        mk('td', { text: isNaN(j) ? '\u2013' : j.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) }),
        mk('td', { text: r.answered + ' / ' + res.inputSlides }),
        mk('td', { text: akFmt(r.score) }),
        mk('td', null, [r.away ? mk('span', { class: 'badge badge-warning', text: r.away + '\u00D7' }) : '\u2013']),
        mk('td', null, [act])
      ]));
    });
    tableWrap.appendChild(table);
  };
  search.addEventListener('input', draw);
  draw();
  if (keepQ) { search.focus(); search.setSelectionRange(keepQ.length, keepQ.length); }
}

function setPart(r, status) {
  akCall('setParticipantStatus', [H.token, H.eventId, r.pid, status], function (res) {
    if (!res.success) { akToast(res.message, 'error'); return; }
    akToast(status === 'removed' ? r.name + ' was removed' : r.name + ' was restored', 'success');
    loadParticipants();
  });
}

/* ---------- Settings ---------- */
function renderSettings() {
  var ev = H.ed.event;
  var d = H.settingsDraft = { name: ev.name, facilitator: ev.facilitator, description: ev.description, settings: JSON.parse(JSON.stringify(ev.settings)) };
  var s = d.settings;
  var box = akClear($id('tab-settings'));

  var input = function (key, attrs) { var i = mk('input', Object.assign({ class: 'input', value: d[key] || '' }, attrs)); i.addEventListener('input', function () { d[key] = i.value; }); return i; };
  var toggle = function (key, title, desc) {
    var cb = mk('input', { type: 'checkbox' }); cb.checked = !!s[key];
    cb.addEventListener('change', function () { s[key] = cb.checked; });
    return mk('div', { class: 'setting-row' }, [mk('div', null, [mk('div', { class: 't', text: title }), mk('div', { class: 'd', text: desc })]), mk('label', { class: 'switch' }, [cb, mk('span', { class: 'track' })])]);
  };

  var descTa = mk('textarea', { class: 'textarea', rows: '2', maxlength: '500' }); descTa.value = d.description || '';
  descTa.addEventListener('input', function () { d.description = descTa.value; });
  box.appendChild(mk('div', { class: 'card panel' }, [
    mk('h3', null, [akIcon('file-text', 20), 'General']), mk('p', { class: 'muted', text: 'The facilitator name appears on participants\' screens, the presenter view and the PDF report.' }),
    mk('div', { class: 'grid-2' }, [
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Session name' }), input('name', { maxlength: '120' })]),
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Facilitator (teacher / lecturer / mentor)' }), input('facilitator', { maxlength: '120', placeholder: H.me.name })])
    ]),
    mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Description' }), descTa])
  ]));

  var paceGrid = mk('div', { class: 'pace-grid' });
  [['presenter', 'monitor', 'Presenter-paced', 'Everyone sees the slide you are presenting — like Mentimeter. Best for live classes and meetings.'],
   ['audience', 'smartphone', 'Self-paced', 'Participants pick any open slide and answer at their own speed. Best for homework, surveys and stations.']].forEach(function (p) {
    var b = mk('button', { class: 'pace' + (s.pace === p[0] ? ' sel' : ''), type: 'button' }, [mk('b', null, [akIcon(p[1], 17), p[2]]), mk('span', { text: p[3] })]);
    b.addEventListener('click', function () { s.pace = p[0]; Array.prototype.forEach.call(paceGrid.children, function (c) { c.classList.toggle('sel', c === b); }); });
    paceGrid.appendChild(b);
  });
  var idSel = mk('select', { class: 'select' });
  [['full', 'Name + email (+ optional ID) — attendance'], ['name', 'Name only'], ['anonymous', 'Anonymous (random nickname)']].forEach(function (o) { idSel.appendChild(new Option(o[1], o[0])); });
  idSel.value = s.identity; idSel.addEventListener('change', function () { s.identity = idSel.value; });
  var maxIn = mk('input', { class: 'input', type: 'number', min: '1', max: '300', value: String(s.maxParticipants) });
  maxIn.addEventListener('input', function () { s.maxParticipants = Number(maxIn.value) || 1; });
  box.appendChild(mk('div', { class: 'card panel' }, [
    mk('h3', null, [akIcon('users', 20), 'Participation']), mk('p', { class: 'muted', text: 'How participants join and move through the session.' }),
    paceGrid,
    mk('div', { class: 'grid-2' }, [
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Participants identify with' }), idSel]),
      mk('div', { class: 'field' }, [mk('label', { class: 'label', text: 'Maximum participants (1–300)' }), maxIn])
    ]),
    toggle('audienceResults', 'Show results to participants', 'After answering, participants see the live results on their own device.'),
    toggle('reactions', 'Emoji reactions', 'Participants can send reactions that float on the presenter screen.'),
    toggle('lockJoin', 'Lock joining', 'Nobody new can join. Existing participants can still rejoin.')
  ]));

  box.appendChild(mk('div', { class: 'card panel' }, [
    mk('h3', null, [akIcon('shield', 20), 'Moderation & integrity']), mk('p', { class: 'muted', text: 'Keep the room safe and focused.' }),
    toggle('profanityFilter', 'Profanity filter', 'Masks common offensive words (English & Indonesian) in text answers.'),
    toggle('qnaModeration', 'Moderate Q&A', 'New questions wait for your approval in the presenter view before anyone sees them.'),
    toggle('showNames', 'Show names on open-ended answers', 'Display who wrote each card on the big screen (not in anonymous mode).'),
    toggle('focusMode', 'Focus mode (exam style)', 'Shows a personal watermark, discourages copying and records when participants leave the page.')
  ]));

  var keyChip = mk('span', { class: 'code-chip', text: '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022' });
  var shown = false;
  var showBtn = mk('button', { class: 'btn btn-ghost btn-sm', type: 'button' }, [akIcon('eye', 15), 'Show']);
  showBtn.addEventListener('click', function () { shown = !shown; keyChip.textContent = shown ? ev.presenterKey : '\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022\u2022'; });
  box.appendChild(mk('div', { class: 'card panel' }, [
    mk('h3', null, [akIcon('key', 20), 'Access']), mk('p', { class: 'muted', text: 'Share the presenter key with a co-host or use it on a classroom computer — it only opens the presenter view of this session.' }),
    mk('div', { class: 'key-box' }, [keyChip, showBtn,
      mk('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () { akCopy(ev.presenterKey, 'Presenter key copied'); } }, [akIcon('copy', 15), 'Copy']),
      mk('button', { class: 'btn btn-ghost btn-sm', type: 'button', onclick: function () {
        akConfirm({ title: 'Generate a new presenter key?', message: 'The old key stops working immediately and anyone using it is signed out.', confirmText: 'Generate', onConfirm: function () {
          akCall('regeneratePresenterKey', [H.token, H.eventId], function (r) { if (r.success) { ev.presenterKey = r.presenterKey; shown = true; keyChip.textContent = r.presenterKey; akToast('New presenter key created', 'success'); } });
        } });
      } }, [akIcon('refresh', 15), 'Regenerate'])
    ]),
    mk('div', { class: 'field', style: 'margin:16px 0 0' }, [mk('label', { class: 'label', text: 'Participant link' }), mk('div', { class: 'row' }, [mk('input', { class: 'input', readonly: true, value: H.ed.joinUrl, onclick: function (e) { e.target.select(); } }), mk('button', { class: 'btn btn-soft', type: 'button', onclick: function () { akCopy(H.ed.joinUrl, 'Join link copied'); } }, [akIcon('copy', 16), 'Copy'])])])
  ]));

  var alsoParts = mk('input', { type: 'checkbox' });
  box.appendChild(mk('div', { class: 'card panel danger-zone' }, [
    mk('h3', { style: 'color:var(--danger)' }, [akIcon('alert', 20), 'Danger zone']),
    mk('div', { class: 'setting-row' }, [mk('div', null, [mk('div', { class: 't', text: 'Reset results' }), mk('div', { class: 'd', text: 'Delete all answers, upvotes and quiz scores so the session can be reused. Slides are kept.' }),
      mk('label', { class: 'check-row', style: 'margin:8px 0 0' }, [alsoParts, mk('span', { text: 'Also remove the participant list' })])]),
      mk('button', { class: 'btn btn-danger btn-sm', type: 'button', onclick: function () {
        akConfirm({ title: 'Reset all results?', danger: true, confirmText: 'Reset', message: 'This permanently deletes every answer in this session' + (alsoParts.checked ? ' and the participant list' : '') + '. Export the report first if you need it.', onConfirm: function () {
          akCall('resetResults', [H.token, H.eventId, alsoParts.checked], function (r) { if (r.success) { akToast('Results reset', 'success'); H.parts = null; loadEditor(); } else akToast(r.message, 'error'); });
        } });
      } }, [akIcon('refresh', 15), 'Reset'])]),
    mk('div', { class: 'setting-row' }, [mk('div', null, [mk('div', { class: 't', text: 'Delete session' }), mk('div', { class: 'd', text: 'Permanently delete this session, its slides, answers and participants.' })]),
      mk('button', { class: 'btn btn-solid-danger btn-sm', type: 'button', onclick: function () { deleteSession({ id: H.eventId, name: ev.name }, showList); } }, [akIcon('trash', 15), 'Delete'])])
  ]));

  var saveBtn = mk('button', { class: 'btn btn-primary', type: 'button' }, [akIcon('check', 17), 'Save settings']);
  saveBtn.addEventListener('click', function () {
    if (!String(d.name || '').trim()) { akToast('Session name cannot be empty.', 'error'); return; }
    akBusy(saveBtn, true, 'Saving…');
    akCall('updateSession', [H.token, H.eventId, { name: d.name, facilitator: d.facilitator, description: d.description, settings: s }], function (r) {
      akBusy(saveBtn, false);
      if (!r.success) { akToast(r.message, 'error'); return; }
      akToast('Settings saved', 'success');
      loadEditor();
    }, function () { akBusy(saveBtn, false); });
  });
  box.appendChild(mk('div', { class: 'save-bar glass' }, [mk('span', { class: 'small muted grow', style: 'align-self:center', text: 'Changes apply to participants within a few seconds.' }), saveBtn]));
}

/* ---------- Report ---------- */
function renderReport() {
  var box = akClear($id('tab-report'));
  var items = H.ed.items;
  var inputItems = items.filter(function (i) { return ['announcement', 'leaderboard'].indexOf(i.type) < 0; });
  var totalResp = inputItems.reduce(function (a, i) { return a + i.responseCount; }, 0);
  var maxResp = inputItems.reduce(function (a, i) { return Math.max(a, i.responseCount); }, 0) || 1;
  box.appendChild(mk('div', { class: 'stat-row' }, [
    [akIcon('users', 22), 'var(--c2)', H.ed.participantCount, 'Participants'],
    [akIcon('layers', 22), 'var(--c1)', items.length, 'Slides'],
    [akIcon('message', 22), 'var(--c3)', totalResp, 'Responses'],
    [akIcon('activity', 22), 'var(--c7)', H.ed.participantCount && inputItems.length ? Math.round((totalResp / (H.ed.participantCount * inputItems.length)) * 100) + '%' : '\u2013', 'Response rate']
  ].map(function (s) { return mk('div', { class: 'card stat' }, [mk('span', { class: 'si', style: '--sc:' + s[1] }, [s[0]]), mk('div', null, [mk('div', { class: 'sv', text: typeof s[2] === 'number' ? akFmt(s[2]) : s[2] }), mk('div', { class: 'sl', text: s[3] })])]); })));

  var pdfBtn = mk('button', { class: 'btn btn-primary btn-sm', type: 'button' }, [akIcon('download', 15), 'Export PDF']);
  var shBtn = mk('button', { class: 'btn btn-secondary btn-sm', type: 'button' }, [akIcon('download', 15), 'Export to Sheets']);
  pdfBtn.addEventListener('click', function () { exportRun('exportSessionPdf', pdfBtn, 'PDF report ready', 'Saved to the "AKTIVO_Archives" folder in Google Drive.', 'Open PDF'); });
  shBtn.addEventListener('click', function () { exportRun('exportSessionSheet', shBtn, 'Spreadsheet ready', 'Participants, every response and the leaderboard — saved to "AKTIVO_Archives" in Google Drive.', 'Open spreadsheet'); });
  box.appendChild(mk('div', { class: 'export-grid', style: 'margin-bottom:18px' }, [
    mk('div', { class: 'card export-card' }, [mk('span', { class: 'ei', style: 'background:var(--danger-soft);color:var(--danger)' }, [akIcon('file-text', 22)]), mk('div', { class: 'grow' }, [mk('b', { text: 'PDF report' }), mk('p', { class: 'small muted', style: 'margin:4px 0 12px', text: 'Results of every slide, leaderboard, attendance list and the facilitator\'s name and signature block.' }), pdfBtn])]),
    mk('div', { class: 'card export-card' }, [mk('span', { class: 'ei', style: 'background:var(--success-soft);color:var(--success)' }, [akIcon('sheet', 22)]), mk('div', { class: 'grow' }, [mk('b', { text: 'Google Sheets' }), mk('p', { class: 'small muted', style: 'margin:4px 0 12px', text: 'Raw data for grading or analysis: one row per answer with names, emails and points.' }), shBtn])])
  ]));

  var tw = mk('div', { class: 'table-wrap card' });
  var table = mk('table', { class: 'table' }, [mk('tr', null, ['#', 'Slide', 'Type', 'Status', 'Responses', ''].map(function (h) { return mk('th', { text: h }); }))]);
  items.forEach(function (it, i) {
    var t = AK_TYPES[it.type] || { label: it.type };
    var counts = ['announcement', 'leaderboard'].indexOf(it.type) < 0;
    table.appendChild(mk('tr', null, [
      mk('td', { text: String(i + 1) }), mk('td', { class: 'ellipsis', style: 'max-width:340px', text: it.title }), mk('td', { text: t.label }),
      mk('td', { text: it.status === 'active' ? 'Open' : it.status === 'closed' ? 'Closed' : 'Hidden' }),
      mk('td', { text: counts ? String(it.responseCount) : '\u2013' }),
      mk('td', null, [counts ? mk('div', { class: 'mini-bar' }, [mk('i', { style: 'width:' + Math.round((it.responseCount / maxResp) * 100) + '%' })]) : null])
    ]));
  });
  tw.appendChild(items.length ? table : mk('div', { class: 'empty', text: 'No slides yet.' }));
  box.appendChild(tw);
}

function exportRun(fn, btn, title, msg, linkText) {
  akBusy(btn, true, 'Generating…');
  akCall(fn, [H.token, H.eventId], function (res) {
    akBusy(btn, false);
    if (res.success) akLinkDialog(title, msg, res.fileUrl, linkText);
    else akAlert('Export failed', res.message || 'Please try again.', 'OK', null, 'alert');
  }, function (m, auth) { akBusy(btn, false); if (!auth) akAlert('Export failed', 'Please try again in a moment.', 'OK', null, 'alert'); });
}

window.addEventListener('beforeunload', function (e) { if (H.dirty) { e.preventDefault(); e.returnValue = ''; } });

/* ================= Boot ================= */
(function boot() {
  var t = akStore.get('host_token', true);
  if (!t) { showGate(); return; }
  H.token = t;
  akCall('getMe', [t], function (res) { H.me = res.host; enterApp(); }, function (m, auth) { if (!auth) showGate(); });
})();
