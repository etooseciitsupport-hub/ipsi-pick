// 247 입시의신 화면 흐름 — 학생·학부모(학년→Pick→이용 방식→나의 Pick·통합 리포트)와 상담자 화면
(function () {
  'use strict';
  const { $, $$, esc, banner, loadJSON } = Core;

  const S = {
    tools: {}, picks: [], groups: [], modes: [], grades: [],
    cov: null, rec: null, step: 1, view: 'student', report: false,
  };
  const pickById = id => S.picks.find(p => p.id === id);
  const gradeById = id => S.grades.find(g => g.id === id);
  const modeName = id => (S.modes.find(m => m.id === id) || {}).name || '';
  const STATUS_CLS = { live: 'ok', review: 'warn', soon: 'soon', member: 'info' };

  /* ---------- 시작 ---------- */
  async function init() {
    const [tools, picks, grades, schoolMap, programLinks] = await Promise.all([
      loadJSON('data/tools.json', { schema: { tools: '배열' } }),
      loadJSON('data/picks.json', { schema: { picks: '배열', groups: '배열', modes: '배열' } }),
      loadJSON('data/grades.json', { schema: { grades: '배열' } }),
      /* 대응표가 없어도 앱은 동작한다 — 맞춤 링크만 빠지고 기본 링크로 대신한다 */
      loadJSON('data/school-map.json', { schema: { schools: '배열' }, fallback: { schools: [] } }),
      loadJSON('data/program-links.json', { schema: { programs: '있음' }, fallback: { programs: {} } }),
    ]);
    DeepLink.init(schoolMap, programLinks);
    if (!tools || !picks || !grades) {
      $('#app').innerHTML = '<p class="empty">기본 데이터를 읽지 못해 화면을 만들 수 없습니다. data 폴더가 함께 업로드됐는지 확인해 주세요.</p>';
      return;
    }
    tools.tools.forEach(t => { S.tools[t.id] = t; });
    S.toolMeta = { asOf: tools.asOf, source: tools.statusSource };
    S.picks = picks.picks; S.groups = picks.groups; S.modes = picks.modes; S.grades = grades.grades;
    S.view = Store.role();
    S.rec = Store.current() || Store.blank();
    S.step = S.rec.grade ? (S.rec.picks.length ? 4 : 2) : 1;
    $$('#roleSeg button').forEach(b => { b.onclick = () => setView(b.dataset.role); });
    Links.coverage().then(c => { S.cov = c; if (!S.report && (S.view === 'staff' || S.step === 1 || S.step === 4)) render(); });
    render();
  }

  function setView(v) {
    S.view = v; S.report = false; Store.setRole(v); render();
  }

  function persist() { Store.save(S.rec); }

  function render() {
    $$('#roleSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.role === S.view)));
    document.body.dataset.view = S.view;
    const app = $('#app');
    if (S.report) { app.innerHTML = reportHTML(S.rec); bindReport(); return; }
    app.innerHTML = S.view === 'staff' ? staffHTML() : studentHTML();
    S.view === 'staff' ? bindStaff() : bindStudent();
    window.scrollTo({ top: 0 });
  }

  /* ---------- 학생·학부모 ---------- */
  const STEPS = ['학년 선택', 'Pick 선택', '이용 방식', '나의 Pick'];

  function canGo(n) {
    if (n <= 1) return true;
    if (n === 2) return !!S.rec.grade;
    return !!S.rec.grade && S.rec.picks.length > 0;
  }

  function studentHTML() {
    const list = Store.list();
    const opts = list.map(r => `<option value="${esc(r.id)}"${r.id === S.rec.id ? ' selected' : ''}>${esc(r.alias || '이름 없음')} · ${esc((gradeById(r.grade) || {}).name || '학년 미선택')}</option>`).join('');
    const stepper = STEPS.map((t, i) => {
      const n = i + 1;
      return `<button type="button" class="step${n === S.step ? ' on' : ''}" data-step="${n}"${canGo(n) ? '' : ' disabled'}><span>${n}</span>${t}</button>`;
    }).join('');
    const body = [step1, step2, step3, step4][S.step - 1]();
    return `
      <div class="recbar">
        <label for="recSel">기록</label>
        <select id="recSel">${list.some(r => r.id === S.rec.id) ? '' : '<option value="">새 기록 (아직 저장 안 됨)</option>'}${opts}</select>
        <button type="button" class="btn ghost sm" id="newRec">새로 시작</button>
      </div>
      <nav class="stepper" aria-label="진행 단계">${stepper}</nav>
      <section class="panel">${body}</section>`;
  }

  function step1() {
    const profs = Links.jinroProfiles();
    const jopts = profs.map(p => `<option value="${esc(p.studentKey)}"${p.studentKey === S.rec.jinroKey ? ' selected' : ''}>${esc(p.studentName || p.studentKey)}${p.schoolName ? ' · ' + esc(p.schoolName) : ''}</option>`).join('');
    const cards = S.grades.map(g => `
      <button type="button" class="gcard${g.id === S.rec.grade ? ' on' : ''}" data-grade="${g.id}">
        <b>${esc(g.name)}</b><span>${esc(g.concern)}</span>
      </button>`).join('');
    return `
      <h2>① 학년을 선택하세요</h2>
      <p class="note">학년에 맞는 Pick을 추천합니다. 추천일 뿐이며 필요한 것만 고르면 됩니다.</p>
      <div class="ggrid" id="gradeGrid">${cards}</div>
      <div class="row2">
        <div class="fld"><label for="alias">별칭 <small>(선택 · 실명 대신 권장)</small></label>
          <input id="alias" maxlength="20" placeholder="예: 별빛-1" value="${esc(S.rec.alias)}"></div>
        <div class="fld"><span class="lbl">소속</span>
          <div class="seg" id="memberSeg">
            <button type="button" data-m="ext" aria-pressed="${S.rec.member !== 'member'}">외부 학생·학부모</button>
            <button type="button" data-m="member" aria-pressed="${S.rec.member === 'member'}">247 재원생</button>
          </div></div>
      </div>
      <div class="fld"><label for="jinroSel">진로설계 학생 연결 <small>(선택 · 이 브라우저에 저장된 설계)</small></label>
        <select id="jinroSel"><option value="">연결 안 함</option>${jopts}</select>
        <p class="note">${profs.length ? '연결하면 나의 Pick과 통합 리포트에 진로설계 진행 상황이 함께 나옵니다.' : '이 브라우저에 저장된 진로설계 학생이 없습니다. 진로설계를 먼저 하셨다면 같은 브라우저에서 여세요.'}</p></div>
      ${interestHTML()}
      ${coverageNote()}
      <div class="nav"><span></span><button type="button" class="btn" id="next1"${S.rec.grade ? '' : ' disabled'}>Pick 고르기 →</button></div>`;
  }

  /* 관심 고교·학과 — 진로설계 기록이 없는 학생(중학생 등)도 맞춤 링크를 받게 한다. 공개 정보만 고른다 */
  function interestHTML() {
    const p = S.rec.jinroKey ? Links.jinroProfile(S.rec.jinroKey) : null;
    const locked = !!(p && (p.schoolId || p.programId));
    const sopts = DeepLink.schoolList().map(s => `<option value="${esc(s.jinroId)}"${s.jinroId === S.rec.schoolId ? ' selected' : ''}>${esc(s.name)} · ${esc(s.dongyeo.region)} ${esc(s.dongyeo.district)}</option>`).join('');
    const plist = (S.cov && S.cov.programList) || [];
    const fields = [...new Set(plist.map(x => x.field))];
    const popts = fields.map(f => `<optgroup label="${esc(f)}">${plist.filter(x => x.field === f && DeepLink.program(x.programId))
      .map(x => `<option value="${esc(x.programId)}"${x.programId === S.rec.programId ? ' selected' : ''}>${esc(x.name)}</option>`).join('')}</optgroup>`).join('');
    return `<div class="row2">
        <div class="fld"><label for="schoolSel">관심 고교 <small>(선택)</small></label>
          <select id="schoolSel"${locked ? ' disabled' : ''}><option value="">선택 안 함</option>${sopts}</select></div>
        <div class="fld"><label for="programSel">관심 학과 <small>(선택)</small></label>
          <select id="programSel"${locked ? ' disabled' : ''}><option value="">선택 안 함</option>${popts}</select></div>
      </div>
      <p class="note">${locked ? '연결한 진로설계의 학교·학과로 맞춤 링크를 만듭니다.' : '고르면 나의 Pick의 도구 링크가 그 학교·학과로 바로 열립니다. 진로설계 수록 학교만 고를 수 있습니다.'}</p>`;
  }

  function coverageNote() {
    const c = S.cov;
    if (!c) return '<p class="note cov">진로설계 수록 학교 정보를 불러오는 중이거나, 진로설계 사이트에 연결하지 못했습니다.</p>';
    return `<p class="note cov">진로설계 수록 학교 <b>${c.schools}곳</b>(${esc(c.areas.join(' · '))}) · 학과 <b>${c.programs == null ? '확인 불가' : c.programs + '개'}</b>. 수록되지 않은 학교는 다른 학교 편제로 대신 설계하지 않습니다.</p>`;
  }

  function step2() {
    const g = gradeById(S.rec.grade);
    const groups = S.groups.map(gr => {
      const cards = S.picks.filter(p => p.group === gr.id).map(p => {
        const rec = g && g.recommend.includes(p.id);
        const on = S.rec.picks.includes(p.id);
        return `<label class="pcard${on ? ' on' : ''}">
          <input type="checkbox" data-pick="${p.id}"${on ? ' checked' : ''}>
          <div class="ph"><b>${p.no}. ${esc(p.name)}</b>${rec ? '<span class="tag rec">추천</span>' : ''}</div>
          <div class="pm">대상 ${esc(p.target)} · <span class="st ${STATUS_CLS[p.status] || ''}">${esc(p.statusText)}</span></div>
          <p>${esc(p.result)}</p></label>`;
      }).join('');
      return `<div class="pgroup"><h3>${esc(gr.name)}</h3><div class="pgrid">${cards}</div></div>`;
    }).join('');
    return `
      <h2>② 필요한 Pick을 고르세요</h2>
      <p class="note">${g ? `<b>${esc(g.name)}</b>의 주요 고민: ${esc(g.concern)} → 추천 결과: ${esc(g.results)}` : ''}</p>
      ${groups}
      <div class="nav"><button type="button" class="btn ghost" data-go="1">← 학년</button>
        <button type="button" class="btn" id="next2"${S.rec.picks.length ? '' : ' disabled'}>이용 방식 고르기 →</button></div>`;
  }

  function availableModes(p) {
    return S.modes.map(m => {
      let ok = true, why = '';
      if (m.id === 'member' && S.rec.member !== 'member') { ok = false; why = '247 재원생만 해당합니다.'; }
      if (m.id === 'consult' && !p.consult) { ok = false; why = p.consultBlock || '준비 중입니다.'; }
      return { ...m, ok, why };
    });
  }

  function defaultMode(p) {
    const cur = S.rec.modes[p.id];
    const av = availableModes(p);
    if (cur && av.find(m => m.id === cur && m.ok)) return cur;
    return S.rec.member === 'member' ? 'member' : 'free';
  }

  function step3() {
    const rows = S.rec.picks.map(pickById).filter(Boolean).map(p => {
      const cur = defaultMode(p);
      const radios = availableModes(p).map(m => `
        <label class="mode${m.ok ? '' : ' off'}">
          <input type="radio" name="mode-${p.id}" value="${m.id}"${m.id === cur ? ' checked' : ''}${m.ok ? '' : ' disabled'}>
          <b>${esc(m.name)}</b><span>${esc(m.ok ? m.desc : m.why)}</span></label>`).join('');
      return `<div class="mrow"><h3>${p.no}. ${esc(p.name)}</h3><div class="mgrid">${radios}</div></div>`;
    }).join('');
    const anyConsult = S.rec.picks.some(id => defaultMode(pickById(id)) === 'consult');
    return `
      <h2>③ Pick마다 이용 방식을 고르세요</h2>
      <p class="note">무료 탐색은 바로 이용합니다. 유료 컨설팅은 도구 결과를 바탕으로 전문가가 검토하는 선택 상품입니다.</p>
      ${rows}
      <div class="fld${anyConsult ? '' : ' hide'}" id="memoBox"><label for="memo">상담에서 다루고 싶은 고민 <small>(선택)</small></label>
        <textarea id="memo" rows="3" maxlength="400" placeholder="예: 컴퓨터공학과를 희망하는데 2학년 과목 선택이 고민입니다.">${esc(S.rec.memo)}</textarea>
        <p class="note">학교생활기록부 문장을 붙여 넣지 마세요. 고민을 직접 적어 주시면 됩니다.</p></div>
      <p class="callout">현재는 <b>온라인 예약·결제를 제공하지 않습니다.</b> 유료 컨설팅을 고르면 나의 Pick에서 <b>상담 요청서</b>를 만들어 지점에 전달합니다. 금액과 일정은 지점 상담에서 안내합니다.</p>
      <div class="nav"><button type="button" class="btn ghost" data-go="2">← Pick</button>
        <button type="button" class="btn" id="next3">나의 Pick 보기 →</button></div>`;
  }

  function toolLine(id, key, pickId, ctx) {
    const t = S.tools[id]; if (!t) return '';
    if (!t.url) return `<li class="tl soon"><b>${esc(t.name)}</b> <span class="st soon">준비중</span><small>${esc(t.desc)}</small></li>`;
    const jinroBtn = id === 'jinro' && key
      ? ` <button type="button" class="btn sm ghost" data-open-jinro="${esc(key)}">이 학생으로 열기 ↗</button>` : '';
    const deep = DeepLink.build(t, pickId, ctx);
    if (deep) {
      return `<li class="tl deep"><span class="tname">${esc(t.name)}</span>
        <a class="dl" data-deep="${esc(id)}" href="${esc(deep.url)}" target="_blank" rel="noopener">${esc(deep.label)} ↗</a>
        <a class="all" href="${esc(t.url)}" target="_blank" rel="noopener">전체 보기</a><small>${esc(t.desc)}</small></li>`;
    }
    return `<li class="tl"><a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name)} ↗</a>${jinroBtn}<small>${esc(t.desc)}</small></li>`;
  }

  /* 맞춤 링크 기준 안내 — 무엇으로 걸렀는지 숨기지 않는다 */
  function ctxHTML(ctx) {
    const parts = [ctx.schoolName, ctx.programName].filter(Boolean);
    if (!parts.length) return `<p class="callout">관심 고교나 학과를 ① 단계에서 고르거나 진로설계를 연결하면, 도구 링크가 <b>그 학교·학과로 바로 열리는 맞춤 링크</b>로 바뀝니다.</p>`;
    return `<p class="callout ctx">맞춤 링크 기준: <b>${esc(parts.join(' · '))}</b> <small>(${esc(ctx.source)})</small><br>
      <small>학과 링크는 학과명 키워드로 거른 결과입니다. 2028 자료는 대학별로 일부만 수록된 경우가 있어 결과가 없거나 적어도 해당 모집이 없다는 뜻은 아닙니다.</small></p>`;
  }

  function progressHTML(key) {
    if (!key) return '';
    const p = Links.jinroProfile(key);
    if (!p) return `<div class="prog"><h3>진로설계 진행 상황</h3><p class="note">연결한 학생(${esc(key)})을 이 브라우저에서 찾지 못했습니다.</p></div>`;
    const g = Links.progress(p);
    const major = S.cov && g.majorId ? (S.cov.majors.find(m => m.majorId === g.majorId) || {}).name : g.majorId;
    const prog = S.cov && g.programId ? (S.cov.programList.find(x => x.programId === g.programId) || {}).name : g.programId;
    const ec = Links.ecRecordFor(p);
    const li = (ok, label, val) => `<li class="${ok ? 'ok' : 'no'}"><span>${ok ? '✓' : '·'}</span>${esc(label)}${val ? ': <b>' + esc(val) + '</b>' : ''}</li>`;
    return `<div class="prog"><h3>진로설계 진행 상황 <small>${esc(g.name)} · 마지막 저장 ${esc(g.updatedAt || '-')}</small></h3>
      <ul class="checks">
        ${li(!!g.school, '내 학교', g.school || '미선택')}
        ${li(!!g.majorId, '희망 계열·학과', [major, prog].filter(Boolean).join(' · ') || '미선택')}
        ${li(g.chosen > 0, '설계한 과목', g.chosen ? g.chosen + '과목' : '없음')}
        ${li(g.diagnosed, '생기부 진단', g.diagnosed ? '완료' : '안 함')}
        ${li(g.gradeRows > 0, '교과 성적', g.gradeRows ? g.gradeRows + '과목' : '없음')}
        ${li(!!ec, '상담 진단실 기록', ec ? String(ec.number).padStart(2, '0') + '번' : '없음')}
      </ul>
      <p class="noprint" style="margin:10px 0 0"><button type="button" class="btn sm ghost" data-open-jinro="${esc(key)}">진로설계 이어서 하기 ↗</button></p></div>`;
  }

  function step4() {
    const key = S.rec.jinroKey;
    const ctx = DeepLink.context(S.rec, S.cov ? S.cov.programList : []);
    const cards = S.rec.picks.map(pickById).filter(Boolean).map(p => {
      const m = defaultMode(p);
      const tools = p.tools.map(id => toolLine(id, key, p.id, ctx)).join('');
      return `<article class="mycard">
        <header><b>${p.no}. ${esc(p.name)}</b><span class="tag mode-${m}">${esc(modeName(m))}</span><span class="st ${STATUS_CLS[p.status] || ''}">${esc(p.statusText)}</span></header>
        <p class="res">받는 결과: ${esc(p.result)}</p>
        <ul class="tools">${tools}</ul></article>`;
    }).join('');
    const consult = S.rec.picks.filter(id => defaultMode(pickById(id)) === 'consult');
    return `
      <h2>④ 나의 Pick ${S.rec.alias ? '<small>' + esc(S.rec.alias) + '</small>' : ''}</h2>
      <p class="note">고른 Pick별로 바로 쓸 도구를 모았습니다. 외부 도구는 새 창으로 열립니다.</p>
      ${progressHTML(key)}
      ${ctxHTML(ctx)}
      <div class="mylist">${cards}</div>
      ${consult.length ? `<p class="callout">유료 컨설팅 검토 ${consult.length}건 — <b>통합 리포트</b>에 상담 요청서가 함께 들어갑니다. 인쇄하거나 PDF로 저장해 지점에 전달해 주세요.</p>` : ''}
      <div class="nav"><button type="button" class="btn ghost" data-go="3">← 이용 방식</button>
        <span class="gap"></span>
        <button type="button" class="btn ghost danger" id="delRec">이 기록 삭제</button>
        <button type="button" class="btn" id="toReport">통합 리포트 보기</button></div>`;
  }

  function bindStudent() {
    $$('.stepper .step').forEach(b => { b.onclick = () => { S.step = Number(b.dataset.step); render(); }; });
    $$('[data-go]').forEach(b => { b.onclick = () => { S.step = Number(b.dataset.go); render(); }; });
    $('#recSel').onchange = e => {
      const r = Store.get(e.target.value); if (!r) return;
      S.rec = r; Store.setCurrent(r.id); S.step = r.picks.length ? 4 : r.grade ? 2 : 1; render();
    };
    $('#newRec').onclick = () => { S.rec = Store.blank(); S.step = 1; render(); };

    if (S.step === 1) {
      $$('#gradeGrid .gcard').forEach(b => {
        b.onclick = () => {
          const changed = S.rec.grade !== b.dataset.grade;
          S.rec.grade = b.dataset.grade;
          /* 학년을 처음 고르거나 바꾸면 추천 Pick으로 다시 채운다 */
          if (changed || !S.rec.picks.length) S.rec.picks = gradeById(S.rec.grade).recommend.slice();
          persist(); render();
        };
      });
      $('#alias').onchange = e => { S.rec.alias = e.target.value.trim(); persist(); };
      $$('#memberSeg button').forEach(b => { b.onclick = () => { S.rec.member = b.dataset.m; persist(); render(); }; });
      $('#jinroSel').onchange = e => {
        S.rec.jinroKey = e.target.value || null;
        if (S.rec.jinroKey && !S.rec.alias) { const p = Links.jinroProfile(S.rec.jinroKey); S.rec.alias = (p && (p.studentName || p.studentKey)) || ''; }
        persist(); render();
      };
      $('#schoolSel').onchange = e => { S.rec.schoolId = e.target.value || null; persist(); };
      $('#programSel').onchange = e => { S.rec.programId = e.target.value || null; persist(); };
      $('#next1').onclick = () => { S.step = 2; render(); };
    }
    if (S.step === 2) {
      $$('[data-pick]').forEach(c => {
        c.onchange = () => {
          const id = c.dataset.pick;
          S.rec.picks = c.checked ? [...new Set([...S.rec.picks, id])] : S.rec.picks.filter(x => x !== id);
          S.rec.picks.sort((a, b) => pickById(a).no - pickById(b).no);
          persist(); render();
        };
      });
      $('#next2').onclick = () => { S.step = 3; render(); };
    }
    if (S.step === 3) {
      $$('.mrow input[type=radio]').forEach(r => {
        r.onchange = () => {
          S.rec.modes[r.name.slice(5)] = r.value; persist();
          const any = S.rec.picks.some(id => defaultMode(pickById(id)) === 'consult');
          $('#memoBox').classList.toggle('hide', !any);
        };
      });
      $('#memo').onchange = e => { S.rec.memo = e.target.value.trim(); persist(); };
      $('#next3').onclick = () => {
        S.rec.picks.forEach(id => { S.rec.modes[id] = defaultMode(pickById(id)); });
        persist(); S.step = 4; render();
      };
    }
    if (S.step === 4) {
      $$('[data-open-jinro]').forEach(b => { b.onclick = () => Links.openJinro(b.dataset.openJinro); });
      $('#toReport').onclick = () => { S.report = true; render(); };
      $('#delRec').onclick = () => {
        if (!confirm('이 Pick 기록을 삭제할까요? 진로설계·상담 진단실 기록은 지워지지 않습니다.')) return;
        Store.remove(S.rec.id); S.rec = Store.blank(); S.step = 1; render();
        banner('info', 'Pick 기록을 삭제했습니다.', '진로설계와 상담 진단실의 기록은 각 화면에서 따로 삭제할 수 있습니다.', { replaceKey: 'del' });
      };
    }
  }

  /* ---------- 통합 리포트 (인쇄) ---------- */
  function reportHTML(rec) {
    const g = gradeById(rec.grade) || {};
    const picks = rec.picks.map(pickById).filter(Boolean);
    const rows = picks.map(p => {
      const m = defaultMode(p);
      const tools = p.tools.map(id => S.tools[id]).filter(Boolean).map(t => esc(t.name) + (t.url ? '' : ' (준비중)')).join(', ');
      return `<tr><td>${p.no}. ${esc(p.name)}</td><td>${esc(modeName(m))}</td><td>${esc(p.result)}</td><td>${tools}</td><td>${esc(p.statusText)}</td></tr>`;
    }).join('');
    const consult = picks.filter(p => defaultMode(p) === 'consult');
    return `
      <div class="noprint nav"><button type="button" class="btn ghost" id="backReport">← 나의 Pick</button>
        <button type="button" class="btn" id="printReport">인쇄 / PDF 저장</button></div>
      <article class="report">
        <h1>247 입시의신 — 나만의 입시 Pick 리포트</h1>
        <p class="meta">${esc(rec.alias || '이름 없음')} · ${esc(g.name || '학년 미선택')} · ${rec.member === 'member' ? '247 재원생' : '외부 학생·학부모'} · 작성 ${esc(Core.nowKST())}</p>
        <h2>이번 시기의 고민과 기대 결과</h2>
        <p>${esc(g.concern || '-')} → ${esc(g.results || '-')} (${esc(g.value || '')})</p>
        <h2>선택한 Pick</h2>
        <table><thead><tr><th>Pick</th><th>이용 방식</th><th>받는 결과</th><th>사용할 도구</th><th>상태</th></tr></thead><tbody>${rows}</tbody></table>
        ${progressHTML(rec.jinroKey)}
        ${consult.length ? `<h2>상담 요청서</h2>
          <table class="kv"><tbody>
            <tr><th>요청 항목</th><td>${consult.map(p => esc(p.name)).join(', ')}</td></tr>
            <tr><th>소속</th><td>${rec.member === 'member' ? '247 재원생' : '외부'}</td></tr>
            <tr><th>고민</th><td>${esc(rec.memo || '(적지 않음)')}</td></tr>
            <tr><th>지점 기재</th><td>희망 일시 ______ · 담당자 ______ · 금액 안내 ______</td></tr>
          </tbody></table>
          <p class="note">온라인 예약·결제는 아직 제공하지 않습니다. 이 요청서를 지점에 전달하면 금액·일정을 안내합니다.</p>` : ''}
        <h2>읽을 때 주의할 점</h2>
        <ul class="small">
          <li>이 리포트는 고른 항목과 저장된 사실을 모은 것입니다. 합격 가능성을 예측하거나 보장하지 않습니다.</li>
          <li>도구 상태는 ${esc(S.toolMeta.source)} 기준입니다.</li>
          <li>정보는 이 브라우저에만 저장되어 있으며 서버로 전송되지 않습니다.</li>
        </ul>
      </article>`;
  }
  function bindReport() {
    $('#backReport').onclick = () => { S.report = false; render(); };
    $('#printReport').onclick = () => window.print();
  }

  /* ---------- 상담자 ---------- */
  function staffHTML() {
    const recs = Store.list();
    const linked = new Set(recs.map(r => r.jinroKey).filter(Boolean));
    const profs = Links.jinroProfiles();
    const rowFor = (rec, prof) => {
      const key = prof ? prof.studentKey : rec && rec.jinroKey;
      const g = prof ? Links.progress(prof) : null;
      const ec = prof ? Links.ecRecordFor(prof) : null;
      const consult = rec ? rec.picks.filter(id => rec.modes[id] === 'consult').map(id => pickById(id).name) : [];
      return `<tr>
        <td><b>${esc(rec ? rec.alias || '이름 없음' : (g.name))}</b>${rec && prof ? `<br><small>진로설계: ${esc(g.name)}</small>` : ''}</td>
        <td>${rec ? esc((gradeById(rec.grade) || {}).name || '-') + (rec.member === 'member' ? '<br><small>재원생</small>' : '') : '-'}</td>
        <td>${rec ? rec.picks.map(id => esc(pickById(id).name)).join('<br>') || '-' : '<small>Pick 기록 없음</small>'}</td>
        <td>${consult.length ? '<span class="tag mode-consult">요청</span> ' + esc(consult.join(', ')) : '-'}</td>
        <td>${g ? `${esc(g.school || '학교 미선택')}<br><small>과목 ${g.chosen} · 진단 ${g.diagnosed ? '✓' : '–'} · 성적 ${g.gradeRows}과목</small>` : '<small>연결 안 됨</small>'}</td>
        <td>${ec ? String(ec.number).padStart(2, '0') + '번' : '-'}</td>
        <td class="acts">
          ${key ? `<button type="button" class="btn sm ghost" data-open-jinro="${esc(key)}">진로설계</button>
            <a class="btn sm ghost" href="${esc(Links.ecUrl('', key))}" target="_blank" rel="noopener">진단실</a>
            <a class="btn sm ghost" href="${esc(Links.ecUrl('hakjong.html', key))}" target="_blank" rel="noopener">정밀분석</a>` : ''}
          ${rec ? `<button type="button" class="btn sm" data-report="${esc(rec.id)}">리포트</button>` : ''}
        </td></tr>`;
    };
    const rows = [
      ...recs.map(r => rowFor(r, Links.jinroProfile(r.jinroKey))),
      ...profs.filter(p => !linked.has(p.studentKey)).map(p => rowFor(null, p)),
    ].join('');
    const c = S.cov;
    const cov = c ? `<div class="kpis">
        <div><b>${c.schools}</b><span>수록 학교</span></div>
        <div><b>${c.majors.length}</b><span>계열</span></div>
        <div><b>${c.programs == null ? '–' : c.programs}</b><span>학과</span></div>
      </div><p class="note">${esc(c.areas.join(' · '))} · 진로설계 데이터 기준 ${esc(c.updatedAt || '')}</p>`
      : '<p class="note">진로설계 데이터를 읽지 못했습니다. 같은 계정 아래 jinro-dash 저장소가 있는지 확인하세요.</p>';
    const staffTools = ['ec-clinic', 'ec-univ', 'ec-gyogwa', 'ec-hakjong', 'jinro'].map(id => {
      const t = S.tools[id];
      return `<a class="tcard" href="${esc(t.url)}" target="_blank" rel="noopener"><b>${esc(t.name)} ↗</b><span>${esc(t.desc)}</span></a>`;
    }).join('');
    const pickMap = S.picks.map(p => `<tr><td>${p.no}. ${esc(p.name)}</td>
      <td>${p.tools.concat(p.staffTools || []).map(id => S.tools[id]).filter(Boolean).map(t => t.url ? `<a href="${esc(t.url)}" target="_blank" rel="noopener">${esc(t.name)}</a>` : esc(t.name) + ' (준비중)').join(' · ')}</td>
      <td><span class="st ${STATUS_CLS[p.status] || ''}">${esc(p.statusText)}</span></td></tr>`).join('');
    return `
      <p class="callout">상담자 화면은 <b>보기 전환</b>일 뿐 보안 권한이 아닙니다. 이 브라우저에 저장된 학생만 보입니다.</p>
      <section class="panel"><h2>수록 현황</h2>${cov}</section>
      <section class="panel"><h2>학생 <small>Pick 기록 ${recs.length} · 진로설계 ${profs.length}</small></h2>
        ${rows ? `<div class="tblwrap"><table class="stu"><thead><tr><th>학생</th><th>학년</th><th>선택 Pick</th><th>상담 요청</th><th>진로설계</th><th>진단실</th><th></th></tr></thead><tbody>${rows}</tbody></table></div>`
          : '<p class="empty">이 브라우저에 저장된 학생이 없습니다.</p>'}
      </section>
      <section class="panel"><h2>상담 도구</h2><div class="tgrid">${staffTools}</div></section>
      <section class="panel"><h2>Pick별 연결 도구 <small>${esc(S.toolMeta.source)}</small></h2>
        <table class="map"><thead><tr><th>Pick</th><th>도구</th><th>상태</th></tr></thead><tbody>${pickMap}</tbody></table></section>`;
  }

  function bindStaff() {
    $$('[data-open-jinro]').forEach(b => { b.onclick = () => Links.openJinro(b.dataset.openJinro); });
    $$('[data-report]').forEach(b => {
      b.onclick = () => { const r = Store.get(b.dataset.report); if (!r) return; S.rec = r; Store.setCurrent(r.id); S.report = true; render(); };
    });
  }

  document.addEventListener('DOMContentLoaded', init);
})();
