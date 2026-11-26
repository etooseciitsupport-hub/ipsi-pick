// 진로설계(jinro-dash)·상담 진단실(Expert-Course) 저장값과 수록 데이터를 읽는 연결 모듈 — 읽기 전용(마지막 학생 포인터만 예외)
(function (global) {
  'use strict';
  /* 주소는 config.js 에서 — 없거나 비어 있으면 같은 계정 배치(상대 경로)로 본다 */
  const CFG = global.IPSI_CONFIG || {};
  const slash = u => (u && !u.endsWith('/') ? u + '/' : u);
  const JINRO = slash(CFG.jinroBase) || '../jinro-dash/';
  const EC = slash(CFG.ecBase) || '../Expert-Course/';
  const JINRO_KEY = 'jinro.profiles.v4';
  const JINRO_LAST = 'jinro.lastProfile';
  const EC_KEY = 'expertCourse.students.v1';
  const IMPORT_KEY = 'ipsiPick.imported.v1';

  /* 진로설계가 이 앱과 같은 출처인가 — 아니면 그 앱의 localStorage는 보이지 않는다 */
  const originOf = u => { try { return new URL(u, global.location.href).origin; } catch (e) { return null; } };
  const SAME_ORIGIN = originOf(JINRO) === global.location.origin;

  /* tools.json 의 '../jinro-dash/…'·'../Expert-Course/…' 링크를 설정 주소로 바꾼다 */
  function toolUrl(u) {
    if (typeof u !== 'string') return u;
    if (u.startsWith('../jinro-dash/')) return JINRO + u.slice('../jinro-dash/'.length);
    if (u.startsWith('../Expert-Course/')) return EC + u.slice('../Expert-Course/'.length);
    return u;
  }

  /* ---------- 파일로 불러온 기록 (다른 출처 배포용) — 요약만 저장 ---------- */
  function readImported() {
    const d = Core.readLS(IMPORT_KEY, null);
    return d && typeof d === 'object' ? { jinro: d.jinro || {}, ec: Array.isArray(d.ec) ? d.ec : [] } : { jinro: {}, ec: [] };
  }
  function writeImported(d) {
    try { localStorage.setItem(IMPORT_KEY, JSON.stringify(d)); return true; } catch (e) { return false; }
  }
  const names = a => (Array.isArray(a) ? a.map(x => (x && typeof x === 'object' ? x.name || x.subject || '' : String(x))).filter(Boolean) : []);
  /* 진로설계 내보내기 → 진행 상황에 필요한 값만. 성적 점수·생기부 문장은 버린다 */
  function slimJinro(p) {
    const rows = (p.grades && Array.isArray(p.grades.rows)) ? p.grades.rows : [];
    return {
      studentKey: String(p.studentKey), studentName: p.studentName || null,
      schoolId: p.schoolId || null, schoolName: p.schoolName || null,
      majorId: p.majorId || null, programId: p.programId || null, entryGrade: p.entryGrade || null,
      chosenSubjects: names(p.chosenSubjects), manualSubjects: names(p.manualSubjects), takenSubjects: names(p.takenSubjects),
      record: p.record && p.record.diagnosis ? { diagnosis: true } : null,
      grades: p.grades ? { source: p.grades.source || null, rows: rows.filter(r => r && r.subject).map(r => ({ subject: String(r.subject) })) } : null,
      updatedAt: p.updatedAt || null,
    };
  }
  /* 진단실 기록 → 번호·저장일·학생 이름만. 상담 내용은 버린다 */
  const slimEc = (rec, number, updated) => ({
    number: number == null ? null : number, updated: updated || null,
    record: { values: { studentName: String(rec.values.studentName) } },
  });
  const isEcRecord = o => o && typeof o === 'object' && o.values && typeof o.values.studentName === 'string' && o.values.studentName.trim();

  /* JSON 하나를 읽어 종류를 판정하고 저장한다. 결과 문장을 돌려준다(실패하면 throw) */
  function importJSON(obj) {
    const d = readImported();
    if (obj && obj.type === 'expert-course-backup') {
      if (!Array.isArray(obj.students)) throw new Error('진단실 전체 백업 형식이 올바르지 않습니다.');
      const add = obj.students.filter(s => s && isEcRecord(s.record)).map(s => slimEc(s.record, s.number, s.updated));
      add.forEach(r => {
        d.ec = d.ec.filter(x => !(x.number === r.number && x.record.values.studentName === r.record.values.studentName));
        d.ec.push(r);
      });
      writeImported(d);
      return `진단실 기록 ${add.length}건`;
    }
    if (isEcRecord(obj)) {
      const r = slimEc(obj, null, obj.updated || null);
      d.ec = d.ec.filter(x => !(x.number == null && x.record.values.studentName === r.record.values.studentName));
      d.ec.push(r); writeImported(d);
      return `진단실 기록 1건 (${r.record.values.studentName})`;
    }
    if (obj && typeof obj === 'object' && obj.studentKey) {
      const p = slimJinro(obj);
      const old = d.jinro[p.studentKey];
      if (old && String(old.updatedAt) > String(p.updatedAt)) return `진로설계 ${p.studentName || p.studentKey} — 이미 더 최근 기록이 있어 건너뜀`;
      d.jinro[p.studentKey] = p; writeImported(d);
      return `진로설계 ${p.studentName || p.studentKey}`;
    }
    throw new Error('진로설계 내보내기 파일이나 진단실 백업 파일이 아닙니다.');
  }
  function importedCount() { const d = readImported(); return { jinro: Object.keys(d.jinro).length, ec: d.ec.length }; }
  function clearImported() { try { localStorage.removeItem(IMPORT_KEY); } catch (e) {} }

  /* 진로설계 학생 목록 (최근 수정순) — 이 브라우저 저장값 + 불러온 파일. 같은 학생이면 최근 것 */
  function jinroProfiles() {
    const merged = {};
    const put = p => { if (p && p.studentKey && (!merged[p.studentKey] || String(p.updatedAt) > String(merged[p.studentKey].updatedAt))) merged[p.studentKey] = p; };
    Object.values(Core.readLS(JINRO_KEY, {}) || {}).forEach(put);
    Object.values(readImported().jinro).forEach(put);
    return Object.values(merged).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  const jinroProfile = key => (key ? jinroProfiles().find(p => p.studentKey === key) || null : null);

  /* 진단실 기록 — 학생 이름이 같은 기록을 찾는다 (진단실은 ?jinro=로 넘겨받을 때 이름을 채운다) */
  function ecRecords() {
    const rows = Core.readLS(EC_KEY, []);
    return (Array.isArray(rows) ? rows : []).concat(readImported().ec);
  }
  function ecRecordFor(profile) {
    if (!profile) return null;
    const names = [profile.studentName, profile.studentKey].filter(Boolean);
    return ecRecords().find(r => r && r.record && r.record.values && names.includes(r.record.values.studentName)) || null;
  }

  /* 진로설계 진행 상황 — 저장된 사실만 옮긴다. 판단은 하지 않는다 */
  function progress(p) {
    if (!p) return null;
    const rows = (p.grades && p.grades.rows) || [];
    return {
      name: p.studentName || p.studentKey,
      school: p.schoolName || null,
      majorId: p.majorId || null,
      programId: p.programId || null,
      entryGrade: p.entryGrade || null,
      chosen: (p.chosenSubjects || []).length + (p.manualSubjects || []).length,
      taken: (p.takenSubjects || []).length,
      diagnosed: !!(p.record && p.record.diagnosis),
      gradeRows: rows.filter(r => r && r.subject).length,
      gradeSource: p.grades ? p.grades.source : null,
      updatedAt: p.updatedAt || null,
    };
  }

  /* 진로설계를 이 학생으로 열기 — jinro는 '마지막 학생' 포인터로 학생을 되살린다.
     다른 출처면 포인터를 쓸 수 없어 첫 화면만 연다 */
  function openJinro(key) {
    if (key && SAME_ORIGIN) { try { localStorage.setItem(JINRO_LAST, key); } catch (e) {} }
    global.open(JINRO, '_blank', 'noopener');
  }
  const ecUrl = (page, key) => EC + (page || '') + (key ? '?jinro=' + encodeURIComponent(key) : '');

  /* 수록 현황 — 문서 숫자를 옮겨 적지 않고 jinro 데이터에서 직접 센다 */
  async function coverage() {
    const [regions, programs, majors] = await Promise.all([
      Core.loadJSON(JINRO + 'data/regions.json', { quiet: true }),
      Core.loadJSON(JINRO + 'data/programs/index.json', { quiet: true }),
      Core.loadJSON(JINRO + 'data/majors/index.json', { quiet: true }),
    ]);
    if (!regions) return null;
    const areas = [];
    let schools = 0;
    (regions.sido || []).forEach(s => (s.sigungu || []).forEach(g => {
      const n = (g.schools || []).length; schools += n;
      if (n) areas.push(`${s.name} ${g.name} ${n}`);
    }));
    return {
      schools, areas, updatedAt: regions.updatedAt || null,
      programs: programs && Array.isArray(programs.programs) ? programs.programs.length : null,
      majors: majors && Array.isArray(majors.majors) ? majors.majors : [],
      programList: programs && Array.isArray(programs.programs) ? programs.programs : [],
    };
  }

  global.Links = { JINRO, EC, SAME_ORIGIN, toolUrl, importJSON, importedCount, clearImported, jinroProfiles, jinroProfile, ecRecords, ecRecordFor, progress, openJinro, ecUrl, coverage };
})(window);
