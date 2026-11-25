// 247 입시의신 전체 흐름 점검 — 진로설계 학생 생성 → Pick 4단계 → 통합 리포트 → 상담자 화면 → 새로고침 복원
// 실행: 세 저장소를 한 폴더 아래 두고  node ipsi-pick/tools/e2e/pick-flow.mjs [그 폴더 경로]
// Playwright 위치가 다르면 PW=/path/to/node_modules/playwright/index.mjs 로 지정한다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = await import(process.env.PW || 'playwright');
const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(process.argv[2] || path.join(HERE, '../../..'));   // jinro-dash · Expert-Course · ipsi-pick 의 부모
const BASE = 'http://site.test/';
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.wasm': 'application/wasm', '.gz': 'application/gzip', '.png': 'image/png', '.svg': 'image/svg+xml' };
for (const d of ['jinro-dash', 'Expert-Course', 'ipsi-pick']) {
  if (!fs.existsSync(path.join(ROOT, d))) { console.error(`❌ ${ROOT} 아래에 ${d} 폴더가 없습니다.`); process.exit(2); }
}

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 } });
/* 서버 없이 폴더를 한 출처로 응답 — 세 사이트가 같은 localStorage를 쓴다 (GitHub Pages 같은 계정과 동일) */
await ctx.route(BASE + '**', route => {
  let p = decodeURIComponent(new URL(route.request().url()).pathname);
  if (p.endsWith('/')) p += 'index.html';
  const file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return route.fulfill({ status: 404, body: 'not found' });
  route.fulfill({ status: 200, contentType: TYPES[path.extname(file)] || 'application/octet-stream', body: fs.readFileSync(file) });
});
const errs = [];
const watch = (pg, tag) => {
  pg.on('console', m => { if (m.type() === 'error') errs.push(`${tag} CONSOLE ${m.text()}`); });
  pg.on('pageerror', e => errs.push(`${tag} PAGEERROR ${e.message}`));
  pg.on('response', r => { if (r.url().startsWith(BASE) && r.status() >= 400) errs.push(`${tag} HTTP ${r.status()} ${r.url()}`); });
};
const results = [];
const shot = async (pg, n) => { if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, n + '.png'), fullPage: true }); };
const check = (name, ok, got) => { results.push({ name, ok: !!ok, got }); };

/* 1) 진로설계에서 학생 하나를 만든다 (가상 성적 2과목 포함) */
const page = await ctx.newPage(); watch(page, 'jinro');
const SAMPLE = `교과학습발달상황\n1학년\n1 국어 국어 4 85/70(10) A(300) 2\n1 수학 수학 4 90/65(15) A(300) 1\n창의적 체험활동상황\n진로활동: 반도체 공정 특강을 듣고 소자 구조를 조사함.`;
await page.goto(BASE + 'jinro-dash/', { waitUntil: 'networkidle' });
await page.click('#entrySeg button[data-entry="2"]');
await page.check('#nameConsent');
await page.fill('#nameInput', '픽점검');
await page.click('#toSchool'); await page.waitForTimeout(300);
await page.fill('#schoolSearch', '경기고'); await page.waitForTimeout(400);
await page.click('#acList button'); await page.waitForTimeout(600);
await page.click('#toRecordFromSchool'); await page.waitForTimeout(300);
await page.check('#cAgree'); await page.check('#cGuardian');
await page.click('#consentBtn'); await page.waitForTimeout(200);
await page.fill('#recText', SAMPLE);
await page.click('#analyzeBtn'); await page.waitForTimeout(800);
await page.click('#toMajorFromRecord'); await page.waitForTimeout(300);
await page.click('#fields .field[data-id="eng"]'); await page.waitForTimeout(500);
await page.click('#progGrid .progcard:not(.soon)'); await page.waitForTimeout(400);
await page.click('#toDesign'); await page.waitForTimeout(400);
await page.click('#applyRec'); await page.waitForTimeout(300);
await page.click('#saveBtn').catch(() => {}); await page.waitForTimeout(200);

/* 2) 247 입시의신 — 학생 화면 */
const pick = await ctx.newPage(); watch(pick, 'pick');
await pick.goto(BASE + 'ipsi-pick/', { waitUntil: 'networkidle' }); await pick.waitForTimeout(500);
check('앱 이름 247 입시의신', (await pick.title()) === '247 입시의신' && (await pick.locator('.brand b').innerText()) === '247 입시의신');
check('시작 화면은 ① 학년 선택', await pick.locator('.step.on').innerText().then(t => t.includes('학년')));
const cov = await pick.locator('.cov').innerText();
check('수록 현황을 jinro 데이터에서 계산 (17곳·35개)', cov.includes('17곳') && cov.includes('35개'), cov.slice(0, 80));
check('학년 고르기 전 다음 버튼 잠김', await pick.locator('#next1').isDisabled());

await shot(pick, '1-grade');
await pick.click('#gradeGrid [data-grade="h2"]'); await pick.waitForTimeout(200);
await pick.fill('#alias', '테스트학생'); await pick.locator('#alias').dispatchEvent('change');
await pick.click('#memberSeg [data-m="ext"]');
await pick.selectOption('#jinroSel', '픽점검'); await pick.waitForTimeout(200);
await pick.click('#next1'); await pick.waitForTimeout(200);

const checked = await pick.locator('[data-pick]:checked').evaluateAll(xs => xs.map(x => x.dataset.pick));
check('고2 추천 Pick 자동 선택 (수시·정시)', checked.join() === 'susi,jeongsi', checked.join());
check('추천 표시 2개', (await pick.locator('.tag.rec').count()) === 2);
await pick.check('[data-pick="essay"]'); await pick.waitForTimeout(200);
await shot(pick, '2-pick');
await pick.click('#next2'); await pick.waitForTimeout(200);

check('외부 회원은 재원생 혜택 선택 불가', await pick.locator('input[name="mode-susi"][value="member"]').isDisabled());
check('정시는 유료 컨설팅 잠김 (개발 전)', await pick.locator('input[name="mode-jeongsi"][value="consult"]').isDisabled());
check('고민 메모는 컨설팅 고르기 전 숨김', await pick.locator('#memoBox').evaluate(e => e.classList.contains('hide')));
await pick.check('input[name="mode-susi"][value="consult"]'); await pick.waitForTimeout(100);
check('컨설팅 고르면 고민 메모 표시', !(await pick.locator('#memoBox').evaluate(e => e.classList.contains('hide'))));
await pick.fill('#memo', '컴퓨터공학 수시 후보가 고민입니다.'); await pick.locator('#memo').dispatchEvent('change');
check('결제 미제공 안내 표시', (await pick.locator('.callout').innerText()).includes('결제를 제공하지 않습니다'));
await shot(pick, '3-mode');
await pick.click('#next3'); await pick.waitForTimeout(300);
await shot(pick, '4-my');

check('나의 Pick 카드 3개', (await pick.locator('.mycard').count()) === 3);
const prog = await pick.locator('.prog').innerText();
check('진로설계 진행 상황 — 학교', prog.includes('경기고등학교'), prog.replace(/\s+/g, ' ').slice(0, 160));
check('진로설계 진행 상황 — 성적 2과목', prog.includes('2과목'));
check('준비중 도구는 링크 없이 표시', (await pick.locator('.tl.soon').count()) >= 1);
/* 1.1 맞춤 링크 — 진로설계 값(경기고 · 기계공학과) 기준 */
const ctxTxt = await pick.locator('.callout.ctx').innerText().catch(() => '');
check('맞춤 기준 표시 (경기고 · 기계공학과 · 진로설계)', ctxTxt.includes('경기고등학교') && ctxTxt.includes('기계공학과') && ctxTxt.includes('진로설계'), ctxTxt.slice(0, 80));
const hrefOf = async (pickNo, tool) => pick.locator(`.mycard:has(header b:text-is("${pickNo}")) a[data-deep="${tool}"]`).getAttribute('href').catch(() => null);
const dec = u => u && decodeURIComponent(u);
check('수시 → 2028 수시 계승판 ?q=기계&cat=eng_mech', dec(await hrefOf('3. 수시 지원 전략', 'susi2028')) === 'https://omnisis01.github.io/etoos247-ipsi-dashboard-2028/?q=기계&cat=eng_mech', dec(await hrefOf('3. 수시 지원 전략', 'susi2028')));
check('수시 → 2028 수시·정시 season=수시', dec(await hrefOf('3. 수시 지원 전략', 'susijeongsi2028')) === 'https://2028-delta.vercel.app/search?season=수시&q=기계');
check('정시 → 2028 수시·정시 season=정시', dec(await hrefOf('4. 정시 지원 전략', 'susijeongsi2028')) === 'https://2028-delta.vercel.app/search?season=정시&q=기계');
check('논술 → 논술 대시보드 ?cat=자연', dec(await hrefOf('5. 논술 지원 및 준비', 'essay2027')) === 'https://2027essayanalysis.pages.dev/?cat=자연', dec(await hrefOf('5. 논술 지원 및 준비', 'essay2027')));
check('맞춤 링크 옆에 전체 보기 링크', (await pick.locator('.tl.deep a.all').count()) === (await pick.locator('.tl.deep').count()));
const urls = await pick.locator('a[data-deep]').evaluateAll(as => as.map(a => a.href));
check('맞춤 URL에 이름·별칭 없음', urls.every(u => !decodeURIComponent(u).includes('픽점검') && !decodeURIComponent(u).includes('테스트학생')), urls.length + '개');
check('외부 도구 링크는 새 창', await pick.locator('.tl a').first().getAttribute('target') === '_blank');

await pick.click('#toReport'); await pick.waitForTimeout(200);
await shot(pick, '5-report');
const rep = await pick.locator('.report').innerText();
check('통합 리포트 — Pick 3행', (await pick.locator('.report table:not(.kv) tbody tr').count()) === 3);
check('통합 리포트 — 상담 요청서와 메모', rep.includes('상담 요청서') && rep.includes('컴퓨터공학 수시 후보'));
check('통합 리포트 — 합격 예측 아님 고지', rep.includes('예측하거나 보장하지 않습니다'));
await pick.emulateMedia({ media: 'print' });
check('인쇄 시 버튼·머리글 숨김', !(await pick.locator('#printReport').isVisible()) && !(await pick.locator('.top').isVisible()));
await pick.emulateMedia({ media: 'screen' });
await pick.click('#backReport'); await pick.waitForTimeout(200);

/* 3) 새로고침 후 복원 */
await pick.reload({ waitUntil: 'networkidle' }); await pick.waitForTimeout(400);
check('새로고침 후 나의 Pick으로 복원', (await pick.locator('.step.on').innerText()).includes('나의 Pick') && (await pick.locator('.mycard').count()) === 3);

/* 4) 진로설계를 이 학생으로 열기 */
const [jp] = await Promise.all([ctx.waitForEvent('page'), pick.click('.prog [data-open-jinro]')]);
watch(jp, 'jinro2'); await jp.waitForLoadState('networkidle'); await jp.waitForTimeout(400);
check('진로설계가 이 학생으로 열림', (await jp.locator('#profileSel').inputValue().catch(() => '')) === '픽점검');
await jp.close();

/* 5) 상담자 화면 */
await pick.click('#roleSeg [data-role="staff"]'); await pick.waitForTimeout(400);
await shot(pick, '6-staff');
const kpi = await pick.locator('.kpis').innerText();
check('상담자 — 수록 현황 17·4·35', /17[\s\S]*4[\s\S]*35/.test(kpi), kpi.replace(/\s+/g, ' '));
check('상담자 — 학생 1행 (Pick과 진로설계가 한 줄로 합쳐짐)', (await pick.locator('table.stu tbody tr').count()) === 1);
const row = await pick.locator('table.stu tbody tr').first().innerText();
check('상담자 — 상담 요청 표시', row.includes('요청') && row.includes('수시 지원 전략'));
const ecHref = await pick.locator('table.stu a', { hasText: '진단실' }).getAttribute('href');
check('상담자 — 진단실 링크에 ?jinro=', ecHref === '../Expert-Course/?jinro=' + encodeURIComponent('픽점검'), ecHref);
const [ec] = await Promise.all([ctx.waitForEvent('page'), pick.click('table.stu a:has-text("진단실")')]);
watch(ec, 'expert'); await ec.waitForLoadState('networkidle'); await ec.waitForTimeout(1000);
check('진단실이 학생 이름으로 채워짐', (await ec.locator('#caseTitle').innerText()).includes('픽점검'));
await ec.close();
await pick.click('table.stu [data-report]'); await pick.waitForTimeout(200);
check('상담자 — 리포트 열기', (await pick.locator('.report h1').count()) === 1);
await pick.click('#backReport'); await pick.waitForTimeout(200);
check('상담자 — 리포트에서 돌아오면 상담자 화면', (await pick.locator('table.stu').count()) === 1);

/* 6) 학생 화면으로 돌아와 기록 삭제 */
await pick.click('#roleSeg [data-role="student"]'); await pick.waitForTimeout(200);
pick.once('dialog', d => d.accept());
await pick.click('#delRec'); await pick.waitForTimeout(300);
const left = await pick.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('ipsiPick.v1') || '{"students":{}}').students).length);
const jinroLeft = await pick.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('jinro.profiles.v4') || '{}')).length);
check('삭제 — Pick 기록만 지우고 진로설계는 남김', left === 0 && jinroLeft === 1, `pick ${left} / jinro ${jinroLeft}`);

/* 6-1) 진로설계 연결 없이 관심 고교·학과만 골라도 맞춤 링크 */
await pick.click('#gradeGrid [data-grade="m3"]'); await pick.waitForTimeout(200);
await pick.selectOption('#schoolSel', 'seoul-gangnam-hwimun');
await pick.selectOption('#programSel', 'computer'); await pick.waitForTimeout(100);
await pick.click('#next1'); await pick.waitForTimeout(200);
await pick.click('#next2'); await pick.waitForTimeout(200);
await pick.click('#next3'); await pick.waitForTimeout(300);
const dy = dec(await pick.locator('a[data-deep="dongyeo"]').first().getAttribute('href').catch(() => null));
check('관심 고교 → 동여지도 ?region=서울&year=2026&school=휘문고등학교', dy === 'https://schoolinfo-dashboard.vercel.app/?region=서울&year=2026&school=휘문고등학교', dy);
check('맞춤 기준 표시 (Pick에서 고름)', (await pick.locator('.callout.ctx').innerText().catch(() => '')).includes('(Pick)'));
await shot(pick, '8-deep');

/* 7) 휴대폰 폭 */
await pick.setViewportSize({ width: 375, height: 800 }); await pick.waitForTimeout(200);
await shot(pick, '7-mobile');
check('375px에서 가로 스크롤 없음', await pick.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));

check('콘솔·페이지 오류 0건', errs.length === 0, errs.slice(0, 5).join(' | '));
await browser.close();

const w = Math.max(...results.map(r => r.name.length));
results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.name.padEnd(w)}${r.ok || r.got === undefined ? '' : '  → ' + r.got}`));
const fail = results.filter(r => !r.ok).length;
console.log(`\n${results.length - fail}/${results.length} 통과`);
process.exit(fail ? 1 : 0);
