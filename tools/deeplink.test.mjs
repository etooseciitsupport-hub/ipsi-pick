// 맞춤 링크 생성 규칙 단위 테스트 — 도구별 URL·딥링크 스위치·개인정보 미포함을 실제 대응표로 확인한다
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';

const read = p => JSON.parse(fs.readFileSync(new URL('../' + p, import.meta.url), 'utf8'));
const tools = Object.fromEntries(read('data/tools.json').tools.map(t => [t.id, t]));
function load() {
  const window = { Links: { jinroProfile: () => null } };
  const ctx = vm.createContext({ window, URLSearchParams, Links: window.Links });
  vm.runInContext(fs.readFileSync(new URL('../assets/js/deeplink.js', import.meta.url), 'utf8'), ctx);
  window.DeepLink.init(read('data/school-map.json'), read('data/program-links.json'));
  return window.DeepLink;
}
const D = load();
const ctx = D.context({ schoolId: 'seoul-gangnam-hwimun', programId: 'computer' }, [{ programId: 'computer', name: '컴퓨터공학과' }]);
const dec = l => l && decodeURIComponent(l.url);

test('관심 고교·학과로 맞춤 기준을 만든다', () => {
  assert.equal(ctx.schoolName, '휘문고등학교');
  assert.equal(ctx.programName, '컴퓨터공학과');
  assert.equal(ctx.source, 'Pick');
});

test('도구별 링크 규칙', () => {
  assert.equal(dec(D.build(tools.dongyeo, 'school', ctx)), 'https://schoolinfo-dashboard.vercel.app/?region=서울&year=2026&school=휘문고등학교');
  assert.equal(dec(D.build(tools.susi2027, 'susi', ctx)), 'https://omnisis01.github.io/etoos247-ipsi-dashboard/?q=컴퓨터&cat=eng_cs');
  assert.equal(dec(D.build(tools.susijeongsi2028, 'jeongsi', ctx)), 'https://2028-delta.vercel.app/search?season=정시&q=컴퓨터');
  assert.equal(D.build(tools.jinro, 'design', ctx), null, '진로설계는 같은 출처라 링크 대신 학생 열기 버튼을 쓴다');
});

test('논술 딥링크는 계열로 열고, 스위치를 끄면 만들지 않는다', () => {
  assert.equal(tools.essay2027.deepLink, true, '논술 운영본이 ?cat= 을 받는다 (PR #260)');
  assert.equal(dec(D.build(tools.essay2027, 'essay', ctx)), 'https://2027essayanalysis.pages.dev/?cat=자연');
  assert.equal(D.build({ ...tools.essay2027, deepLink: false }, 'essay', ctx), null);
  const med = D.context({ programId: 'medicine' }, [{ programId: 'medicine', name: '의예과' }]);
  assert.equal(dec(D.build({ ...tools.essay2027, deepLink: true }, 'essay', med)), 'https://2027essayanalysis.pages.dev/?cat=의학');
});

test('대응표에 없는 값은 링크를 만들지 않는다', () => {
  const none = D.context({ schoolId: 'nope', programId: 'nope' }, []);
  assert.equal(none.schoolId, null);
  assert.equal(D.build(tools.dongyeo, 'school', none), null);
  assert.equal(D.build(tools.susi2028, 'susi', none), null);
});

test('모든 학교·학과 조합의 URL에 개인정보 자리가 없다 (학교명·학과 키워드·계열만)', () => {
  const programs = Object.keys(read('data/program-links.json').programs);
  for (const s of D.schoolList()) for (const p of programs) {
    const c = D.context({ schoolId: s.jinroId, programId: p }, []);
    for (const t of Object.values(tools)) {
      const l = D.build({ ...t, deepLink: true }, 'susi', c);
      if (!l) continue;
      const keys = [...new URL(l.url).searchParams.keys()];
      assert.ok(keys.every(k => ['region', 'year', 'school', 'q', 'cat', 'season'].includes(k)), `${t.id}: ${keys}`);
    }
  }
});
