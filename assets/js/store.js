// 247 입시의신 선택 기록 저장 — 이 브라우저의 localStorage 'ipsiPick.v1'에만, 별칭 기준, 성적·생기부는 저장하지 않음
(function (global) {
  'use strict';
  const KEY = 'ipsiPick.v1';

  function readAll() {
    const d = Core.readLS(KEY, null);
    return d && typeof d === 'object' && d.students ? d : { role: 'student', current: null, students: {} };
  }
  function writeAll(d) {
    try { localStorage.setItem(KEY, JSON.stringify(d)); return true; }
    catch (e) {
      Core.banner('warn', '브라우저에 저장하지 못했습니다', '시크릿 모드이거나 저장 공간이 가득 찼을 수 있습니다. 통합 리포트를 인쇄해 두세요.', { replaceKey: 'save' });
      return false;
    }
  }

  function blank(alias) {
    return {
      id: 'p-' + Math.random().toString(16).slice(2, 8),
      alias: alias || '',        // 화면 표시용 별칭 (실명 대신 권장)
      jinroKey: null,            // 연결한 진로설계 학생 (읽기만)
      schoolId: null,            // 관심 고교 (school-map.json 의 jinroId) — 진로설계를 연결하지 않았을 때 맞춤 링크 기준
      programId: null,           // 관심 학과 (program-links.json 의 키)
      grade: null,               // grades.json 의 id
      member: 'ext',             // 'ext' 외부 / 'member' 247 재원생
      picks: [],                 // 선택한 Pick id
      modes: {},                 // pickId → 'free' | 'member' | 'consult'
      memo: '',                  // 상담 요청 메모 (학생이 직접 적는 고민 — 생기부 문장 붙여넣기 금지 안내)
      createdAt: Core.nowKST(),
      updatedAt: Core.nowKST(),
    };
  }

  const Store = {
    blank,
    all() { return readAll(); },
    list() { return Object.values(readAll().students).sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt))); },
    get(id) { return readAll().students[id] || null; },
    current() { const d = readAll(); return d.current ? d.students[d.current] || null : null; },
    role() { return readAll().role || 'student'; },
    setRole(r) { const d = readAll(); d.role = r; writeAll(d); },
    setCurrent(id) { const d = readAll(); d.current = id; writeAll(d); },
    save(rec) {
      const d = readAll();
      rec.updatedAt = Core.nowKST();
      d.students[rec.id] = rec; d.current = rec.id;
      return writeAll(d);
    },
    remove(id) {
      const d = readAll();
      delete d.students[id];
      if (d.current === id) d.current = null;
      writeAll(d);
    },
    /* 이 앱이 만든 기록만 지운다 — 진로설계·진단실 기록은 각 앱에서 지운다 */
    clear() { try { localStorage.removeItem(KEY); } catch (e) {} },
  };

  global.Store = Store;
})(window);
