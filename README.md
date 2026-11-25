# 247 입시의신

학년별 입시 고민에 맞춰 필요한 **Pick**만 골라, 진로설계·수시·정시·논술·학습 도구와 상담을 한곳에서 연결하는 정적 웹앱입니다.
「ECI 입시도구 통합 기획(안)」(2026.10.16)의 입시 Pick 구조를 구현했습니다.

```
① 학년 선택 → ② Pick 선택 → ③ 이용 방식 선택 → ④ 나의 Pick · 통합 리포트
```

| 화면 | 하는 일 |
|---|---|
| 학생·학부모 | 학년 추천 Pick 자동 선택, 무료 탐색 / 재원생 혜택 / 유료 컨설팅 검토 선택, Pick별 도구 모음, 진로설계 진행 상황, 통합 리포트(인쇄·PDF)와 상담 요청서 |
| 상담자 | 이 브라우저의 학생(Pick 기록 + 진로설계)을 한 표로, 진로설계·상담 진단실·정밀분석 바로가기, 수록 현황, Pick별 연결 도구 |

## 1.1 — 학생 맞춤 링크

나의 Pick의 도구 링크가 학생의 학교·학과로 **바로 걸러진 화면**을 엽니다. 기존 도구는 한 줄도 고치지 않고, 각 도구가 이미 받는 URL 파라미터만 씁니다.

| 도구 | 맞춤 링크 | 기준 |
|---|---|---|
| 입시동여지도 | `?region=서울&year=2026&school=휘문고등학교` | 관심 고교 (로그인 후 표시) |
| 2027·2028 수시 | `?q=기계&cat=eng_mech` | 관심 학과 — 카테고리 AND 검색어 |
| 2028 수시·정시 | `/search?season=정시&q=기계` | 관심 학과 + Pick(수시/정시) |
| 논술 | `?cat=자연` (계열) | 관심 학과 → 논술 계열. 논술 저장소 PR #260으로 운영 반영 (2026-11-25) |
| MY247 | 준비중 | 프로토타입이라 연결하지 않음 |

- 기준은 연결한 진로설계 값이 우선이고, 없으면 ① 단계에서 고른 관심 고교·학과를 씁니다.
- 대응표: `data/school-map.json`(17교 ↔ 동여지도 정식명), `data/program-links.json`(35개 학과 ↔ 수시 카테고리·검색어). 둘 다 각 도구의 실제 데이터와 대조해 만들었고, `validate.mjs`가 진로설계의 학교·학과가 빠짐없이 대응되는지 검사합니다.
- **URL에는 학교명·학과 키워드만 넣습니다.** 이름·별칭·성적은 넣지 않습니다(여러 도구가 GA로 URL을 수집).
- 수시 대시보드의 `?h=`·`?r=`·`?c=`(지원카드 복원) 링크는 만들지 않습니다 — 학생의 기존 지원카드를 덮어씁니다.
- 학교 NEIS 코드는 아직 비어 있습니다(`neis: null`). 입시동여지도 수집 DB에서 확인한 뒤 채웁니다.

## 반드시 지킬 배치

세 저장소를 **같은 GitHub 계정(또는 조직) 아래**, 이름을 대소문자까지 정확히 둡니다.

```
<계정>.github.io/jinro-dash/      진로·선택과목 설계 대시보드
<계정>.github.io/Expert-Course/   입시컨설팅 진단실
<계정>.github.io/ipsi-pick/       247 입시의신 (이 저장소 — 저장소 이름은 달라도 동작)
```

247 입시의신은 `../jinro-dash/`, `../Expert-Course/` 상대 경로로 두 앱의 데이터와 브라우저 저장값을 읽습니다.
계정이 다르면 진로설계 연결·수록 현황·상담자 학생 목록이 비어 보입니다(앱은 계속 동작합니다).

## 배포

> **기존 배포 주소에 덮어쓰지 않습니다.** jinro-dash·Expert-Course 등 이미 운영 중인 저장소에 이 파일을 올리지 마십시오.
> 247 입시의신은 반드시 **새 저장소**에 **별도 커밋**으로 배포합니다. 계정에 같은 이름의 저장소가 이미 있으면 다른 이름(예: `ipsi-pick-v1`)을 쓰십시오 —
> 저장소 이름이 달라도 동작합니다(두 앱을 `../jinro-dash/`, `../Expert-Course/` 로 찾기 때문).

1. 새 저장소 `ipsi-pick` (Public) 생성 → 이 폴더 내용 전부 업로드
2. `.nojekyll` 이 빠졌다면 직접 생성 (Add file → Create new file → 이름 `.nojekyll`, 내용 비움)
3. Settings → Pages → `main` / `(root)`
4. `…/ipsi-pick/assets/js/core.js` 에서 `VERSION` 확인

## 고친 뒤에는

- **버전을 올립니다** — `assets/js/core.js` 의 `VERSION` 과 `index.html` 의 `?v=` 를 같은 값으로. 안 올리면 사용자 화면에 예전 코드가 남습니다.
- 데이터 검증: `node tools/validate.mjs`
- 브라우저 점검: 세 저장소를 한 폴더 아래 두고

```bash
npm install playwright && npx playwright install chromium   # 최초 1회
node ipsi-pick/tools/e2e/pick-flow.mjs                        # 부모 폴더에서 실행 · 서버 필요 없음
```

Playwright를 다른 곳에 설치했다면 `PW=/경로/node_modules/playwright/index.mjs` 를 앞에 붙입니다. `SHOTS=/폴더` 를 주면 화면 캡처를 남깁니다.

## 구조

```
index.html               셸
assets/css/pick.css      스타일 (다크 모드·인쇄 포함)
assets/js/core.js        VERSION · DOM 헬퍼 · 배너 · loadJSON(실패해도 계속 동작)
assets/js/store.js       Pick 기록 — localStorage 'ipsiPick.v1' (별칭·학년·Pick·이용 방식·고민 메모)
assets/js/links.js       진로설계·진단실 저장값 읽기, 수록 현황 계산 (읽기 전용)
assets/js/deeplink.js    학생 맞춤 링크 생성 (도구별 URL 파라미터 규칙)
data/school-map.json     진로설계 학교 ↔ 입시동여지도 정식명 (NEIS 코드 자리)
data/program-links.json  진로설계 학과 ↔ 수시 카테고리·검색어
assets/js/app.js         화면 흐름
data/picks.json          Pick 6개 · 묶음 · 이용 방식 · 상태 · 연결 도구 · 가격(확정 전 null)
data/tools.json          연결 도구 목록과 URL
data/grades.json         학년별 고민 · 추천 Pick · 결과
tools/validate.mjs       데이터 상호 참조 · 버전 일치 검사
tools/deeplink.test.mjs  맞춤 링크 규칙 단위 테스트 (node --test tools/deeplink.test.mjs)
tools/e2e/pick-flow.mjs  전체 흐름 브라우저 점검 (40개 항목)
```

## 운영 원칙

- **합격 예측·보장을 하지 않습니다.** 리포트는 고른 항목과 저장된 사실만 모읍니다.
- **가격은 비워 둡니다.** 상품 가격이 확정되면 `data/picks.json` 의 `price` 에 숫자(원)를 넣습니다. 그 전에는 "지점 상담 시 안내"로 표시됩니다.
- **결제·예약은 아직 없습니다.** 유료 컨설팅을 고르면 통합 리포트에 상담 요청서가 붙고, 이를 지점에 전달합니다.
- **개인정보** — 성적·생기부는 이 앱에 저장하지 않습니다(진로설계에서 읽어 보여 주기만). 실명 대신 별칭을 권장하며, 기록은 이 브라우저에만 있고 언제든 삭제할 수 있습니다. 공개 저장소에 학생 정보를 올리지 않습니다.
- **상담자 화면은 보안 권한이 아닙니다.** 정적 사이트라 누구나 전환할 수 있습니다. 권한 구분이 필요하면 로그인·서버가 있는 다음 단계에서 다룹니다.
- **수록 현황은 하드코딩하지 않습니다.** 학교·계열·학과 수는 jinro-dash 데이터에서 매번 셉니다.
- 도구 상태(운영 중 / 검수 중 / 준비중)는 기획안 1016 Appendix 5 기준입니다. 바뀌면 `data/picks.json` 의 `status`·`statusText` 를 고칩니다.
