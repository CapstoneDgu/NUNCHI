// ========================================================
// payment-modal.js — 공통 결제 승인 모달 (QA R2-16: 3단계 결제 페이지 흡수)
//
// 한 모달에서 결제 3페이지 전체를 처리한다:
//   ① confirm    : 결제수단·결제내역·금액·할부(일시불) + [취소][승인 요청]
//   ② processing : 승인 요청 중 (스피너 + 수단별 안내) — approve() 백엔드 처리
//   ③ done       : 결제 완료 + "영수증/번호표" 선택 → onDone(kind)
//   ④ fail       : 승인 실패 + [다시 시도][취소]
//
// 사용:
//   PaymentModal.open({
//       method: 'ic'|'vein'|'barcode',
//       items, totalAmount,
//       approve: async () => ({ ok:true }) | ({ ok:false, reason }),  // 백엔드 결제 확정
//       onDone:  (receiptKind) => { ...영수증 종류 저장 후 /complete... },
//       onCancel: () => {},   // 옵션 — confirm 단계에서 취소
//   });
//
// 의존: 없음 (CSS는 payment-modal.css)
// ========================================================

(function () {
    'use strict';

    const VAT_RATE = 0.1;
    const nf = new Intl.NumberFormat('ko-KR');
    const won = (n) => '₩' + nf.format(Math.max(0, Math.round(n || 0)));
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    const METHOD = {
        ic:      { label: 'IC카드 결제',     icon: 'xi-credit-card', tip: '카드를 단말기에 꽂은 채 기다려 주세요' },
        vein:    { label: '정맥 인증 결제',  icon: 'xi-check',       tip: '손바닥 정맥으로 인증하고 있어요' },
        barcode: { label: '카카오페이 결제', icon: 'xi-barcode',     tip: '바코드를 스캐너에 대 주세요' },
    };
    const FAIL_MSG = {
        timeout:        '시간이 초과되었어요. 다시 시도해 주세요.',
        card_error:     '카드를 읽지 못했어요. 다시 시도해 주세요.',
        declined:       '승인이 거절되었어요. 다른 카드로 시도해 주세요.',
        barcode_error:  '바코드를 읽지 못했어요. 다시 시도해 주세요.',
        payment_failed: '결제에 실패했어요. 다시 시도해 주세요.',
    };

    let _root = null, _opts = null, _onKey = null;

    /* ---------- 결제내역(품목) ---------- */
    function _itemsHtml(items) {
        if (!items || !items.length) {
            return '<li class="paymod__item paymod__item--empty">주문 내역이 없습니다</li>';
        }
        return items.map((it) => {
            const qty = it.quantity || 1;
            const amount = won(it.itemTotal != null ? it.itemTotal : (it.unitPrice || 0) * qty);
            const opts = (it.options || [])
                .filter((o) => o && o.optionName).map((o) => esc(o.optionName)).join(', ');
            return `
                <li class="paymod__item">
                    <div class="paymod__item-main">
                        <span class="paymod__item-name">${esc(it.menuName || '')}</span>
                        ${opts ? `<span class="paymod__item-opt">${opts}</span>` : ''}
                    </div>
                    <span class="paymod__item-qty">${qty}</span>
                    <span class="paymod__item-amt">${amount}</span>
                </li>`;
        }).join('');
    }

    /* ---------- 모달 골격 (헤더 + 본문 슬롯 + 액션 슬롯) ---------- */
    function _shell(method) {
        const m = METHOD[method] || METHOD.ic;
        const el = document.createElement('div');
        el.className = 'paymod';
        el.innerHTML = `
            <div class="paymod__backdrop"></div>
            <div class="paymod__box" role="dialog" aria-modal="true" aria-label="결제">
                <div class="paymod__head">
                    <span class="paymod__head-icon"><i class="xi ${m.icon}"></i></span>
                    <div class="paymod__head-text">
                        <strong class="paymod__head-title" data-paymod-htitle>${esc(m.label)}</strong>
                        <span class="paymod__head-tip" data-paymod-htip>주문 내역을 확인하고 결제를 진행해 주세요</span>
                    </div>
                </div>
                <div class="paymod__body" data-paymod-body></div>
                <div class="paymod__actions" data-paymod-actions></div>
            </div>`;
        return el;
    }

    /* ---------- 단계 ① confirm ---------- */
    function _renderConfirm() {
        const o = _opts;
        const total  = o.totalAmount || 0;
        const supply = Math.round(total / (1 + VAT_RATE));
        const vat    = total - supply;
        const qtySum = (o.items || []).reduce((s, it) => s + (it.quantity || 0), 0);

        _setTip('주문 내역을 확인하고 결제를 진행해 주세요');
        _body(`
            <div class="paymod__section-label">결제 내역 <span>(${qtySum}개)</span></div>
            <ul class="paymod__items">${_itemsHtml(o.items)}</ul>
            <div class="paymod__rows">
                <div class="paymod__row"><span>공급가액</span><span>${won(supply)}</span></div>
                <div class="paymod__row"><span>부가세 (10%)</span><span>${won(vat)}</span></div>
                <div class="paymod__row"><span>할부</span><span>일시불</span></div>
            </div>
            <div class="paymod__total">
                <span class="paymod__total-label">결제 금액</span>
                <span class="paymod__total-value">${won(total)}</span>
            </div>
        `);
        _actions(`
            <button type="button" class="paymod__btn paymod__btn--cancel" data-act="cancel">취소</button>
            <button type="button" class="paymod__btn paymod__btn--approve" data-act="approve">승인 요청</button>
        `);
    }

    /* ---------- 결제수단별 진행 애니메이션 (기존 P03/P04/P07 비주얼 그대로 재사용) ---------- */
    function _animHtml(method) {
        if (method === 'vein') {
            return `
            <div class="paymod__anim">
              <div class="p03" data-state="scanning">
                <div class="p03__scanner" aria-hidden="true">
                  <span class="p03__pulse p03__pulse--1"></span>
                  <span class="p03__pulse p03__pulse--2"></span>
                  <span class="p03__pulse p03__pulse--3"></span>
                  <div class="p03__frame">
                    <svg class="p03__palm" viewBox="0 0 200 200" fill="none" stroke="currentColor"
                         stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
                      <path d="M72 92V44a11 11 0 0 1 22 0v48"/>
                      <path d="M94 92V36a11 11 0 0 1 22 0v56"/>
                      <path d="M116 92V42a11 11 0 0 1 22 0v50"/>
                      <path d="M138 92V74a11 11 0 0 1 22 0v72c0 24-18 42-42 42h-18c-11 0-21-4-29-12l-28-30c-5-6-4-14 2-18 6-4 14-2 18 3l9 9"/>
                      <path class="p03__vein p03__vein--1" d="M82 130c10 7 28 7 38 0"/>
                      <path class="p03__vein p03__vein--2" d="M92 150c7 4 16 4 23 0"/>
                      <path class="p03__vein p03__vein--3" d="M98 168c5 2.5 10 2.5 15 0"/>
                    </svg>
                    <span class="p03__scanline" aria-hidden="true"></span>
                  </div>
                </div>
              </div>
            </div>`;
        }
        if (method === 'barcode') {
            return `
            <div class="paymod__anim">
              <div class="p07" data-state="waiting">
                <div class="p07__scanner" aria-hidden="true">
                  <span class="p07__pulse p07__pulse--1"></span>
                  <span class="p07__pulse p07__pulse--2"></span>
                  <span class="p07__pulse p07__pulse--3"></span>
                  <div class="p07__frame">
                    <div class="p07__card">
                      <div class="p07__card-head"><span class="p07__card-brand">kakaopay</span></div>
                      <div class="p07__barcode" aria-hidden="true">${'<span></span>'.repeat(20)}</div>
                    </div>
                    <span class="p07__scanline" aria-hidden="true"></span>
                  </div>
                </div>
              </div>
            </div>`;
        }
        // ic (기본) — 카드 삽입 + 슬롯 스피너
        return `
            <div class="paymod__anim">
              <div class="p04" data-state="processing">
                <div class="p04__visual" aria-hidden="true">
                  <div class="p04__card">
                    <div class="p04__card-chip" aria-hidden="true">${'<span></span>'.repeat(6)}</div>
                    <div class="p04__card-stripe"></div>
                    <span class="p04__card-brand">NUNCHI</span>
                  </div>
                  <div class="p04__slot">
                    <span class="p04__slot-mouth"></span>
                    <span class="p04__slot-label">IC CARD</span>
                    <span class="p04__spinner" role="status" aria-label="결제 처리 중"><i></i></span>
                  </div>
                </div>
              </div>
            </div>`;
    }

    /* ---------- 단계 ② processing ---------- */
    function _renderProcessing() {
        const m = METHOD[_opts.method] || METHOD.ic;
        _setTip('잠시만 기다려 주세요');
        _body(`
            <div class="paymod__state">
                ${_animHtml(_opts.method)}
                <strong class="paymod__state-title">승인 요청 중…</strong>
                <span class="paymod__state-desc">${esc(m.tip)}</span>
                <div class="paymod__state-amount">${won(_opts.totalAmount || 0)} · 일시불</div>
            </div>
        `);
        _actions(`<button type="button" class="paymod__btn paymod__btn--cancel" data-act="noop" disabled>처리 중…</button>`);
    }

    /* ---------- 단계 ③ done (영수증/번호표 선택) ---------- */
    function _renderDone() {
        _setTip('결제가 완료되었어요');
        _body(`
            <div class="paymod__state">
                <div class="paymod__success" aria-hidden="true"><i class="xi-check"></i></div>
                <strong class="paymod__state-title">결제가 완료되었어요</strong>
                <span class="paymod__state-desc">${won(_opts.totalAmount || 0)} · 일시불 승인 완료</span>
            </div>
            <div class="paymod__section-label" style="margin-top:8px;">출력할 항목을 선택해 주세요</div>
            <div class="paymod__output">
                <button type="button" class="paymod__output-btn" data-output="receipt">
                    <span class="paymod__output-ic"><i class="xi-print"></i></span>
                    <span class="paymod__output-txt">
                        <span class="paymod__output-t">영수증 출력</span>
                        <span class="paymod__output-d">결제 영수증을 받아요</span>
                    </span>
                </button>
                <button type="button" class="paymod__output-btn" data-output="ticket">
                    <span class="paymod__output-ic"><i class="xi-document"></i></span>
                    <span class="paymod__output-txt">
                        <span class="paymod__output-t">번호표 출력</span>
                        <span class="paymod__output-d">대기번호표를 받아요</span>
                    </span>
                </button>
            </div>
        `);
        _actions('');   // '출력 없이 완료' 버튼 제거 — 영수증/번호표 둘 중 하나 선택 (QA R3)
    }

    /* ---------- 단계 ④ fail ---------- */
    function _renderFail(reason) {
        _setTip('승인에 실패했어요');
        _body(`
            <div class="paymod__state">
                <div class="paymod__failx" aria-hidden="true"><i class="xi-close"></i></div>
                <strong class="paymod__state-title">결제 승인 실패</strong>
                <span class="paymod__state-desc">${esc(FAIL_MSG[reason] || FAIL_MSG.payment_failed)}</span>
            </div>
        `);
        _actions(`
            <button type="button" class="paymod__btn paymod__btn--cancel" data-act="cancel">취소</button>
            <button type="button" class="paymod__btn paymod__btn--approve" data-act="approve">다시 시도</button>
        `);
    }

    /* ---------- 슬롯 헬퍼 ---------- */
    function _body(html)    { _root.querySelector('[data-paymod-body]').innerHTML = html; }
    function _actions(html) {
        const el = _root.querySelector('[data-paymod-actions]');
        el.innerHTML = html || '';
        el.style.display = html ? '' : 'none';   // 비면 하단 바 자체를 숨김
    }
    function _setTip(t)     { const e = _root.querySelector('[data-paymod-htip]'); if (e) e.textContent = t; }

    /* ---------- 승인 처리 ---------- */
    // 백엔드 승인이 즉시 끝나도 진행 애니메이션이 최소 이만큼은 보이도록 보장.
    const MIN_PROCESSING_MS = 2600;

    async function _runApprove() {
        _renderProcessing();
        const startedAt = Date.now();
        let r;
        try {
            r = _opts.approve ? await _opts.approve() : { ok: true };
        } catch (e) {
            r = { ok: false, reason: (e && e.reason) || 'payment_failed' };
        }
        // 애니메이션이 너무 빨리 사라지지 않게 최소 표시 시간 확보
        const elapsed = Date.now() - startedAt;
        if (elapsed < MIN_PROCESSING_MS) {
            await new Promise((res) => setTimeout(res, MIN_PROCESSING_MS - elapsed));
        }
        if (!_root) return;             // 그새 닫힘
        if (r && r.ok) _renderDone();
        else           _renderFail(r && r.reason);
    }

    /* ---------- 이벤트 ---------- */
    function _onClick(e) {
        const act = e.target.closest('[data-act]');
        const out = e.target.closest('[data-output]');
        if (act) {
            const a = act.getAttribute('data-act');
            if (a === 'approve') _runApprove();
            else if (a === 'cancel') { const cb = _opts.onCancel; close(); if (cb) cb(); }
            return;
        }
        if (out) {
            const kind = out.getAttribute('data-output');   // receipt | ticket | none
            const cb = _opts.onDone;
            close();
            if (cb) cb(kind);
        }
    }

    function open(opts) {
        opts = opts || {};
        close();
        _opts = opts;
        _root = _shell(opts.method);
        document.body.appendChild(_root);
        _renderConfirm();
        requestAnimationFrame(() => _root && _root.classList.add('is-open'));

        _root.addEventListener('click', _onClick);
        // ESC = confirm/fail 단계에서만 취소 (processing/done 중에는 무시)
        _onKey = (e) => {
            if (e.key !== 'Escape' || !_root) return;
            if (_root.querySelector('[data-act="approve"]')) {
                const cb = _opts.onCancel; close(); if (cb) cb();
            }
        };
        document.addEventListener('keydown', _onKey);
    }

    function close() {
        if (_onKey) { document.removeEventListener('keydown', _onKey); _onKey = null; }
        if (_root && _root.parentNode) _root.parentNode.removeChild(_root);
        _root = null; _opts = null;
    }

    window.PaymentModal = { open, close };
})();
