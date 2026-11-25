// 입시 Pick 데이터 검증 — Pick·도구·학년 JSON의 필수 필드와 상호 참조, 버전 번호 일치를 확인한다
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = p => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const errs = [];
const need = (cond, msg) => { if (!cond) errs.push(msg); };

const { tools } = read('data/tools.json');
const P = read('data/picks.json');
const { grades } = read('data/grades.json');

const toolIds = new Set();
tools.forEach(t => {
  need(t.id && !toolIds.has(t.id), `도구 id 누락·중복: ${t.id}`); toolIds.add(t.id);
  need(t.name && t.desc, `도구 ${t.id}: name·desc 필요`);
  need(t.url === null || typeof t.url === 'string', `도구 ${t.id}: url은 문자열 또는 null`);
  if (t.url) need(t.url.startsWith('https://') || t.url.startsWith('../'), `도구 ${t.id}: url은 https:// 또는 ../ 로 시작`);
  need(['all', 'staff'].includes(t.audience), `도구 ${t.id}: audience는 all|staff`);
});

const groupIds = new Set(P.groups.map(g => g.id));
const modeIds = new Set(P.modes.map(m => m.id));
need(['free', 'member', 'consult'].every(m => modeIds.has(m)), '이용 방식 free·member·consult 필요');
const pickIds = new Set();
P.picks.forEach(p => {
  need(p.id && !pickIds.has(p.id), `Pick id 누락·중복: ${p.id}`); pickIds.add(p.id);
  need(groupIds.has(p.group), `Pick ${p.id}: 없는 묶음 ${p.group}`);
  need(['live', 'review', 'soon', 'member'].includes(p.status), `Pick ${p.id}: status 값 오류`);
  need(p.tools && p.tools.length, `Pick ${p.id}: 도구 없음`);
  [...(p.tools || []), ...(p.staffTools || [])].forEach(id => need(toolIds.has(id), `Pick ${p.id}: 없는 도구 ${id}`));
  (p.tools || []).forEach(id => need(tools.find(t => t.id === id)?.audience === 'all', `Pick ${p.id}: 고객 도구 목록에 직원용 ${id}`));
  need(p.consult === true || (p.consult === false && p.consultBlock), `Pick ${p.id}: 컨설팅 불가면 consultBlock 사유 필요`);
  need(p.price === null || typeof p.price === 'number', `Pick ${p.id}: price는 null 또는 숫자 (확정 전 null)`);
});
need(P.picks.map(p => p.no).sort().join() === '1,2,3,4,5,6', 'Pick 번호는 1~6');

grades.forEach(g => {
  need(g.id && g.name && g.concern, `학년 ${g.id}: 필수 필드`);
  need(g.recommend.length > 0, `학년 ${g.id}: 추천 Pick 없음`);
  g.recommend.forEach(id => need(pickIds.has(id), `학년 ${g.id}: 없는 Pick ${id}`));
});

/* 버전 — core.js 의 VERSION 과 index.html 의 ?v= 가 모두 같아야 캐시가 깨진다 */
const ver = (fs.readFileSync(path.join(ROOT, 'assets/js/core.js'), 'utf8').match(/VERSION = '([^']+)'/) || [])[1];
const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const vs = [...html.matchAll(/\?v=([\w.]+)/g)].map(m => m[1]);
need(ver && vs.length && vs.every(v => v === ver), `버전 불일치: core.js ${ver} / index.html ${[...new Set(vs)].join(',')}`);

console.log(`검사 대상: 도구 ${tools.length}개 · Pick ${P.picks.length}개 · 학년 ${grades.length}개 · 버전 ${ver}`);
if (errs.length) { console.log('\n❌ 문제 ' + errs.length + '건'); errs.forEach(e => console.log(' - ' + e)); process.exit(1); }
console.log('\n✅ 모두 정상입니다.');
