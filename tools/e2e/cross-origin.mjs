// 다른 주소 배포 점검 — 247 입시의신(pick.test)과 진로설계·진단실(site.test)이 다른 출처일 때 설정 주소·파일 불러오기가 동작하는지
// 실행: node ipsi-pick/tools/e2e/cross-origin.mjs [jinro-dash·Expert-Course·ipsi-pick 의 부모 폴더]
// Playwright 위치가 다르면 PW=/path/to/node_modules/playwright/index.mjs 로 지정한다.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW || 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(HERE, '../../..'));
const SITE = 'http://site.test/';   // 진로설계·진단실 (예: etooseci.github.io)
const PICK = 'http://pick.test/';   // 247 입시의신 (다른 계정·도메인)
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.svg': 'image/svg+xml' };
for (const d of ['jinro-dash', 'Expert-Course', 'ipsi-pick']) {
  if (!fs.existsSync(path.join(ROOT, d))) { console.error(`❌ ${ROOT} 아래에 ${d} 폴더가 없습니다.`); process.exit(2); }
}
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'ipsi-xo-'));
const CONFIG = `window.IPSI_CONFIG = { jinroBase: '${SITE}jinro-dash', ecBase: '${SITE}Expert-Course/' };`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, acceptDownloads: true });
/* 폴더를 두 출처로 나눠 응답. site.test 는 GitHub Pages처럼 CORS 허용 헤더를 붙인다 */
const serve = (base, allow, override) => ctx.route(base + '**', route => {
  let p = decodeURIComponent(new URL(route.request().url()).pathname);
  if (p.endsWith('/')) p += 'index.html';
  if (!allow.some(a => p.startsWith('/' + a + '/'))) return route.fulfill({ status: 404, body: 'not found' });
  if (override && override[p]) return route.fulfill({ status: 200, contentType: 'text/javascript', body: override[p] });
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'not found' });
  route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream',
    headers: { 'access-control-allow-origin': '*' }, body: fs.readFileSync(file) });
});
await serve(SITE, ['jinro-dash', 'Expert-Course']);
await serve(PICK, ['ipsi-pick'], { '/ipsi-pick/assets/js/config.js': CONFIG });

const errs = [];
const watch = (pg, tag) => {
  pg.on('console', m => { if (m.type() === 'error') errs.push(`${tag} CONSOLE ${m.text()}`); });
  pg.on('pageerror', e => errs.push(`${tag} PAGEERROR ${e.message}`));
  pg.on('response', r => { if (r.status() >= 400) errs.push(`${tag} HTTP ${r.status()} ${r.url()}`); });
};
const results = [];
const check = (name, ok, got) => { results.push({ name, ok: !!ok, got }); };

/* 1) site.test 진로설계에서 학생을 만들고 「설계 JSON 내보내기」 */
const SAMPLE = `교과학습발달상황\n1학년\n1 국어 국어 4 85/70(10) A(300) 2\n1 수학 수학 4 90/65(15) A(300) 1\n창의적 체험활동상황\n진로활동: 반도체 공정 특강을 듣고 소자 구조를 조사함.`;
const jp = await ctx.newPage(); watch(jp, 'jinro');
await jp.goto(SITE + 'jinro-dash/', { waitUntil: 'networkidle' });
await jp.click('#entrySeg button[data-entry="2"]');
await jp.check('#nameConsent');
await jp.fill('#nameInput', '픽점검');
await jp.click('#toSchool'); await jp.waitForTimeout(300);
await jp.fill('#schoolSearch', '경기고'); await jp.waitForTimeout(400);
await jp.click('#acList button'); await jp.waitForTimeout(600);
await jp.click('#toRecordFromSchool'); await jp.waitForTimeout(300);
await jp.check('#cAgree'); await jp.check('#cGuardian');
await jp.click('#consentBtn'); await jp.waitForTimeout(200);
await jp.fill('#recText', SAMPLE);
await jp.click('#analyzeBtn'); await jp.waitForTimeout(800);
await jp.click('#toMajorFromRecord'); await jp.waitForTimeout(300);
await jp.click('#fields .field[data-id="eng"]'); await jp.waitForTimeout(500);
await jp.click('#progGrid .progcard:not(.soon)'); await jp.waitForTimeout(400);
await jp.click('#toDesign'); await jp.waitForTimeout(400);
await jp.click('#applyRec'); await jp.waitForTimeout(300);
await jp.click('#steps button[data-step="report"]'); await jp.waitForTimeout(400);
const [dl] = await Promise.all([jp.waitForEvent('download'), jp.click('#exportBtn')]);
const jinroFile = path.join(TMP, 'jinro.json'); await dl.saveAs(jinroFile);
check('진로설계 내보내기 파일 받음', JSON.parse(fs.readFileSync(jinroFile, 'utf8')).studentKey === '픽점검');

/* 진단실 전체 백업 (진단실 app.js 의 backupAll 형식) — 상담 내용은 저장되면 안 된다 */
const ecFile = path.join(TMP, 'ec.json');
fs.writeFileSync(ecFile, JSON.stringify({ type: 'expert-course-backup', schemaVersion: 1, students: [
  { number: 3, updated: '2026-11-26', record: { values: { studentName: '픽점검', gpa: '비밀내신1.2', context: '비밀상담메모' } } },
] }));
const badFile = path.join(TMP, 'bad.json'); fs.writeFileSync(badFile, '{ 이건 JSON 아님');

/* 2) pick.test — 다른 출처 */
const pg = await ctx.newPage(); watch(pg, 'pick');
pg.on('dialog', d => d.accept());
await pg.goto(PICK + 'ipsi-pick/', { waitUntil: 'networkidle' }); await pg.waitForTimeout(500);
check('다른 출처에서는 진로설계 학생이 보이지 않음 (브라우저 원칙)', (await pg.locator('#jinroSel option').count()) === 1);
check('① 단계 — 파일 불러오기 안내', (await pg.locator('#app').innerText()).includes('다른 주소에 있어'));
await pg.click('#roleSeg [data-role="staff"]'); await pg.waitForTimeout(400);
check('상담자 — 다른 주소 안내 표시', await pg.locator('#xoNote').isVisible());
const kpi = await pg.locator('.kpis').innerText().catch(() => '');
check('상담자 — 수록 현황을 다른 출처에서 읽음 (17·4·35)', /17[\s\S]*4[\s\S]*35/.test(kpi), kpi.replace(/\s+/g, ' '));
const jinroHref = await pg.locator('a.tcard', { hasText: '진로·선택과목' }).getAttribute('href');
check('도구 링크가 설정 주소로 바뀜 (진로설계)', jinroHref === SITE + 'jinro-dash/', jinroHref);
const ecHref = await pg.locator('a.tcard', { hasText: '학생부 정밀분석' }).getAttribute('href');
check('도구 링크가 설정 주소로 바뀜 (진단실 하위 화면)', ecHref === SITE + 'Expert-Course/hakjong.html', ecHref);

await pg.setInputFiles('#impFile', [jinroFile, ecFile, badFile]); await pg.waitForTimeout(500);
const bannersTxt = await pg.locator('#banners').innerText();
check('불러오기 결과 안내 (2건 성공)', bannersTxt.includes('진로설계 픽점검') && bannersTxt.includes('진단실 기록 1건'), bannersTxt.replace(/\s+/g, ' '));
check('잘못된 파일은 이유와 함께 경고', bannersTxt.includes('bad.json') && bannersTxt.includes('JSON 파일이 아닙니다'));
const row = await pg.locator('table.stu tbody tr').first().innerText().catch(() => '');
check('상담자 — 불러온 학생 1행 (학교·진단실 번호)', (await pg.locator('table.stu tbody tr').count()) === 1 && row.includes('경기고등학교') && row.includes('03번'), row.replace(/\s+/g, ' '));
const ecLink = await pg.locator('table.stu a', { hasText: '진단실' }).getAttribute('href');
check('상담자 — 진단실 링크는 설정 주소 + ?jinro=', ecLink === SITE + 'Expert-Course/?jinro=' + encodeURIComponent('픽점검'), ecLink);

/* 저장 내용 — 요약만 */
const stored = await pg.evaluate(() => localStorage.getItem('ipsiPick.imported.v1'));
const st = JSON.parse(stored);
const prof = st.jinro['픽점검'];
check('저장 — 성적은 과목명만 (점수 없음)', prof.grades.rows.length === 2 && prof.grades.rows.every(r => Object.keys(r).join() === 'subject'), JSON.stringify(prof.grades));
check('저장 — 생기부 문장·진단 내용 없음', !stored.includes('반도체') && JSON.stringify(prof.record) === '{"diagnosis":true}', JSON.stringify(prof.record));
check('저장 — 진단실 상담 내용 없음', !stored.includes('비밀내신') && !stored.includes('비밀상담메모'));

/* 진로설계 열기 — 다른 출처면 포인터를 쓰지 않고 첫 화면만 */
const [popup] = await Promise.all([ctx.waitForEvent('page'), pg.locator('table.stu [data-open-jinro]').click()]);
check('진로설계 버튼은 설정 주소를 염', popup.url().startsWith(SITE + 'jinro-dash/'), popup.url());
await popup.close();
check('다른 출처 localStorage에 포인터를 쓰지 않음', (await pg.evaluate(() => localStorage.getItem('jinro.lastProfile'))) === null);

/* 3) 학생 화면에서 불러온 학생 연결 */
await pg.click('#roleSeg [data-role="student"]'); await pg.waitForTimeout(300);
await pg.click('#gradeGrid [data-grade="h2"]'); await pg.waitForTimeout(200);
await pg.selectOption('#jinroSel', '픽점검'); await pg.waitForTimeout(200);
await pg.click('#next1'); await pg.click('#next2'); await pg.click('#next3'); await pg.waitForTimeout(300);
const progTxt = await pg.locator('.prog').innerText().catch(() => '');
check('나의 Pick — 불러온 진로설계 진행 상황', progTxt.includes('경기고등학교') && progTxt.includes('2과목') && progTxt.includes('03번'), progTxt.replace(/\s+/g, ' ').slice(0, 200));

/* 4) 같은 파일 다시 불러와도 중복 없음, 지우기 */
await pg.click('#roleSeg [data-role="staff"]'); await pg.waitForTimeout(300);
await pg.setInputFiles('#impFile', [jinroFile, ecFile]); await pg.waitForTimeout(400);
check('같은 파일 다시 불러와도 중복 없음', (await pg.locator('.imp .note').innerText()).includes('진로설계 1명 · 진단실 1건'));
await pg.click('#impClear'); await pg.waitForTimeout(300);
check('불러온 기록 지우기 — Pick 기록만 남음', (await pg.evaluate(() => localStorage.getItem('ipsiPick.imported.v1'))) === null
  && !(await pg.locator('table.stu').innerText().catch(() => '')).includes('경기고등학교'));

check('콘솔·페이지 오류 0건', errs.length === 0, errs.slice(0, 5).join(' | '));
await browser.close();
fs.rmSync(TMP, { recursive: true, force: true });

const w = Math.max(...results.map(r => r.name.length));
results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(w)}${r.ok || r.got === undefined ? '' : '  → ' + r.got}`));
const fail = results.filter(r => !r.ok).length;
console.log(`\n${results.length - fail}/${results.length} 통과`);
process.exit(fail ? 1 : 0);
