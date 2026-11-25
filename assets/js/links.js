// 진로설계(jinro-dash)·상담 진단실(Expert-Course) 저장값과 수록 데이터를 읽는 연결 모듈 — 읽기 전용(마지막 학생 포인터만 예외)
(function (global) {
  'use strict';
  const JINRO = '../jinro-dash/';
  const EC = '../Expert-Course/';
  const JINRO_KEY = 'jinro.profiles.v4';
  const JINRO_LAST = 'jinro.lastProfile';
  const EC_KEY = 'expertCourse.students.v1';

  /* 진로설계 학생 목록 (최근 수정순) */
  function jinroProfiles() {
    const all = Core.readLS(JINRO_KEY, {});
    return Object.values(all || {}).filter(p => p && p.studentKey)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  }
  const jinroProfile = key => (key ? jinroProfiles().find(p => p.studentKey === key) || null : null);

  /* 진단실 기록 — 학생 이름이 같은 기록을 찾는다 (진단실은 ?jinro=로 넘겨받을 때 이름을 채운다) */
  function ecRecords() {
    const rows = Core.readLS(EC_KEY, []);
    return Array.isArray(rows) ? rows : [];
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

  /* 진로설계를 이 학생으로 열기 — jinro는 '마지막 학생' 포인터로 학생을 되살린다 */
  function openJinro(key) {
    if (key) { try { localStorage.setItem(JINRO_LAST, key); } catch (e) {} }
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

  global.Links = { JINRO, EC, jinroProfiles, jinroProfile, ecRecords, ecRecordFor, progress, openJinro, ecUrl, coverage };
})(window);
