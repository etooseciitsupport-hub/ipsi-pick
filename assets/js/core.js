// 247 입시의신 공통 유틸 — 버전·DOM 헬퍼·이스케이프·배너·JSON 로더(실패해도 앱은 계속 동작)
(function (global) {
  'use strict';
  /* 고친 뒤에는 반드시 올린다 — index.html 의 ?v= 와 함께 캐시를 깬다 */
  const VERSION = '1.4';

  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function nowKST() {
    const d = new Date(Date.now() + 9 * 3600 * 1000);
    return d.toISOString().slice(0, 16).replace('T', ' ');
  }

  /* 화면 위쪽 알림. replaceKey가 같으면 앞의 것을 바꾼다 */
  function banner(kind, title, detail, opts) {
    const box = $('#banners'); if (!box) return;
    const key = opts && opts.replaceKey;
    if (key) { const old = box.querySelector(`[data-key="${key}"]`); if (old) old.remove(); }
    const div = document.createElement('div');
    div.className = 'banner ' + kind;
    if (key) div.dataset.key = key;
    div.innerHTML = `<b>${esc(title)}</b>${detail ? ' <span>' + esc(detail) + '</span>' : ''}<button type="button" class="x" aria-label="닫기">×</button>`;
    div.querySelector('.x').onclick = () => div.remove();
    box.appendChild(div);
  }

  /* 필수 필드 점검 — 형식이 틀리면 이유를 돌려준다 */
  function validate(obj, schema) {
    const bad = [];
    Object.keys(schema || {}).forEach(k => {
      const want = schema[k], v = obj ? obj[k] : undefined;
      const ok = want === '배열' ? Array.isArray(v) : want === '문자열' ? typeof v === 'string' : v != null;
      if (!ok) bad.push(`${k}(${want})`);
    });
    return bad;
  }

  /* JSON 읽기. 실패하면 배너를 띄우고 fallback을 돌려준다 — 조용히 실패하지 않는다 */
  async function loadJSON(path, opts) {
    const o = opts || {};
    try {
      const url = path + (path.includes('?') ? '&' : '?') + 'v=' + VERSION;
      const r = await fetch(url, { cache: 'no-cache' });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const data = await r.json();
      const bad = validate(data, o.schema);
      if (bad.length) throw new Error('필수 항목 누락: ' + bad.join(', '));
      return data;
    } catch (e) {
      if (!o.quiet) banner('warn', '데이터를 불러오지 못했습니다: ' + path, '사유: ' + e.message, { replaceKey: 'load-' + path });
      return o.fallback === undefined ? null : o.fallback;
    }
  }

  function readLS(key, fallback) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch (e) { return fallback; }
  }

  global.Core = { VERSION, $, $$, esc, nowKST, banner, validate, loadJSON, readLS };
})(window);
