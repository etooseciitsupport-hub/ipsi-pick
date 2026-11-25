// 학생 맞춤 링크 생성기 — 학교·학과 대응표로 기존 도구의 딥링크 주소를 만든다 (기존 도구는 수정하지 않음, URL에 개인정보 넣지 않음)
(function (global) {
  'use strict';
  let SCHOOLS = {}, PROGRAMS = {}, DONGYEO_YEAR = '2026';

  function init(schoolMap, programLinks) {
    SCHOOLS = {}; PROGRAMS = {};
    ((schoolMap && schoolMap.schools) || []).forEach(s => { SCHOOLS[s.jinroId] = s; });
    if (schoolMap && schoolMap.dongyeoYear) DONGYEO_YEAR = schoolMap.dongyeoYear;
    PROGRAMS = (programLinks && programLinks.programs) || {};
  }

  const schoolList = () => Object.values(SCHOOLS);
  const school = id => SCHOOLS[id] || null;
  const program = id => PROGRAMS[id] || null;

  /* 맞춤 기준 — 연결한 진로설계 값이 있으면 그것을, 없으면 Pick에서 고른 값을 쓴다 */
  function context(rec, programList) {
    const p = rec && rec.jinroKey ? Links.jinroProfile(rec.jinroKey) : null;
    const fromJinro = !!(p && (p.schoolId || p.programId));
    const schoolId = (p && p.schoolId) || (rec && rec.schoolId) || null;
    const programId = (p && p.programId) || (rec && rec.programId) || null;
    const prog = (programList || []).find(x => x.programId === programId);
    return {
      schoolId: SCHOOLS[schoolId] ? schoolId : null,
      programId: PROGRAMS[programId] ? programId : null,
      schoolName: SCHOOLS[schoolId] ? SCHOOLS[schoolId].dongyeo.fullName : null,
      programName: prog ? prog.name : (PROGRAMS[programId] ? programId : null),
      source: fromJinro ? '진로설계' : 'Pick',
    };
  }

  const qs = o => new URLSearchParams(o).toString();

  /* 도구별 딥링크 규칙 — 각 도구 소스에서 확인한 파라미터만 쓴다 (통합기획서 v1 §4) */
  function build(tool, pickId, ctx) {
    if (!tool || !tool.url || !ctx) return null;
    if (tool.deepLink === false) return null;   // 대상 도구 운영본이 아직 파라미터를 받지 않음 — 기본 링크로 둔다
    const s = ctx.schoolId && SCHOOLS[ctx.schoolId];
    const g = ctx.programId && PROGRAMS[ctx.programId];
    switch (tool.id) {
      case 'dongyeo':            // ?region=&year=&school=<정식명> (App.jsx 딥링크)
        if (!s) return null;
        return { url: tool.url + '?' + qs({ region: s.dongyeo.region, year: DONGYEO_YEAR, school: s.dongyeo.fullName }),
          label: `${s.dongyeo.fullName} 바로 보기` };
      case 'susi2027':
      case 'susi2028':           // ?q=&cat= (restoreView VIEW_KEYS) — cat AND q 로 오매칭 방지
        if (!g) return null;
        return { url: tool.url + '?' + qs({ q: g.q, cat: g.susiCat }),
          label: `${ctx.programName} 관련 수시 전형` };
      case 'susijeongsi2028': {  // /search?season=&q= (admission-search.ts queryKeys)
        if (!g) return null;
        const season = pickId === 'jeongsi' ? '정시' : '수시';
        return { url: tool.url + 'search?' + qs({ season, q: g.q }),
          label: `${ctx.programName} 관련 ${season} 모집단위` };
      }
      case 'essay2027':          // ?cat=<계열> (논술 app.js readUrlState — 브랜치 ipsi-pick/url-deeplink)
        if (!g || !g.essayCat) return null;
        return { url: tool.url + '?' + qs({ cat: g.essayCat }),
          label: `${g.essayCat} 계열 논술 대학 보기` };
      default: return null;
    }
  }

  global.DeepLink = { init, schoolList, school, program, context, build };
})(window);
