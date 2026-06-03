// ========================================================
// receipt.js — 실제 매장 영수증 출력 (QA R2-3)
//
// 목적:
//   기존엔 "영수증이 출력되고 있어요" 애니메이션만 있고 실제 출력이 없었다.
//   이 모듈은 실제 매장 영수증 양식(가맹점 정보 / 품목 명세 / 공급가·부가세 /
//   결제수단 / 대기번호 / 바코드)을 80mm 감열지 레이아웃으로 그려 window.print() 한다.
//
// 한국어 인코딩:
//   감열 프린터에 ESC/POS 텍스트를 직접 쏘면 CP949(EUC-KR)로 변환해야 해 한글이 깨지기 쉽다.
//   브라우저 인쇄(window.print)는 HTML 을 "이미지(글리프)"로 래스터화해 프린터에 보내므로
//   문서를 UTF-8 로 두기만 하면 한글이 절대 깨지지 않는다. → 본 모듈은 인쇄 경로를 사용.
//   (OS 기본 프린터로 출력 — 영수증 프린터를 기본 프린터로 지정해두면 그대로 영수증이 나온다.)
//
// 사용:
//   NunchiReceipt.print({
//       storeName, orderNo, orderType, methodLabel, orderTime,
//       items: [{ menuName, quantity, unitPrice, itemTotal, options:[{optionName, extraPrice}] }],
//       totalAmount,
//   });
// ========================================================

(function () {
    'use strict';

    // 사업자 정보 — 실제 매장 정보로 교체 (지금은 캠퍼스 식당 기준 샘플)
    const STORE_INFO = {
        bizName:   '상록원',
        ceo:       '동국대학교 생활협동조합',
        bizNo:     '201-82-06370',
        tel:       '02-2260-3114',
        addr:      '서울특별시 중구 필동로1길 30 동국대학교',
    };

    const VAT_RATE = 0.1;  // 부가세 10% (공급가 + 세액 분리 표기용)

    const nf = new Intl.NumberFormat('ko-KR');
    const won = (n) => nf.format(Math.max(0, Math.round(n || 0)));
    const esc = (s) => String(s == null ? '' : s)
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

    function pad2(n) { return String(n).padStart(2, '0'); }
    function fmtTime(d) {
        d = d || new Date();
        return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} `
             + `${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}`;
    }

    // 품목 행 — 메뉴명/수량/금액 + 옵션은 들여쓰기 보조행
    function itemRows(items) {
        return (items || []).map((it) => {
            const name = esc(it.menuName || '');
            const qty  = it.quantity || 1;
            const amount = won(it.itemTotal != null
                ? it.itemTotal
                : (it.unitPrice || 0) * qty);
            const optLines = (it.options || [])
                .filter((o) => o && o.optionName)
                .map((o) => {
                    const extra = o.extraPrice ? ` (+${won(o.extraPrice)})` : '';
                    return `<div class="r-opt">└ ${esc(o.optionName)}${extra}</div>`;
                }).join('');
            return `
                <div class="r-item">
                    <div class="r-item-name">${name}</div>
                    <div class="r-item-fig">
                        <span class="r-qty">${qty}</span>
                        <span class="r-amt">${amount}</span>
                    </div>
                </div>
                ${optLines}`;
        }).join('');
    }

    function buildHtml(data) {
        const total    = data.totalAmount || 0;
        const supply   = Math.round(total / (1 + VAT_RATE));  // 공급가액
        const vat      = total - supply;                       // 부가세
        const orderType = data.orderType === 'TAKEOUT' ? '포장'
                        : data.orderType === 'DINE_IN' ? '매장' : '';

        return `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>영수증</title>
<style>
  @page { size: 80mm auto; margin: 0; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { background: #fff; }
  .receipt {
    width: 76mm;
    padding: 4mm 4mm 8mm;
    margin: 0 auto;
    font-family: 'Pretendard', -apple-system, 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
    color: #000;
    font-size: 12px;
    line-height: 1.5;
    -webkit-font-smoothing: none;
  }
  .r-center { text-align: center; }
  .r-title { font-size: 19px; font-weight: 800; letter-spacing: 2px; margin-bottom: 2px; }
  .r-sub   { font-size: 11px; }
  .r-hr    { border: 0; border-top: 1px dashed #000; margin: 7px 0; }
  .r-hr-solid { border: 0; border-top: 2px solid #000; margin: 7px 0; }
  .r-row   { display: flex; justify-content: space-between; gap: 8px; font-size: 11.5px; }
  .r-row .k { color: #000; }
  .r-doc   { font-size: 13px; font-weight: 800; text-align: center; letter-spacing: 1px; margin: 2px 0 4px; }

  .r-item { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; }
  .r-item-name { flex: 1; font-weight: 700; word-break: break-all; }
  .r-item-fig  { display: flex; gap: 10px; white-space: nowrap; }
  .r-qty { width: 22px; text-align: center; }
  .r-amt { min-width: 62px; text-align: right; font-variant-numeric: tabular-nums; }
  .r-opt { font-size: 10.5px; color: #222; padding-left: 6px; }

  .r-total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; margin-top: 3px; }
  .r-order-no  { font-size: 30px; font-weight: 900; letter-spacing: 3px; margin: 4px 0; }
  .r-foot { font-size: 10.5px; text-align: center; margin-top: 8px; line-height: 1.7; }
  .r-barcode {
    margin: 10px auto 2px;
    height: 42px; width: 86%;
    background: repeating-linear-gradient(90deg,
      #000 0 1px, #fff 1px 2px, #000 2px 4px, #fff 4px 7px,
      #000 7px 8px, #fff 8px 11px, #000 11px 13px, #fff 13px 14px);
  }
  .r-barcode-num { text-align: center; font-size: 11px; letter-spacing: 3px; }
</style>
</head>
<body>
<div class="receipt">
  <div class="r-center">
    <div class="r-title">${esc(data.storeName || STORE_INFO.bizName)}</div>
    <div class="r-sub">${esc(STORE_INFO.ceo)}</div>
    <div class="r-sub">사업자번호 ${esc(STORE_INFO.bizNo)}</div>
    <div class="r-sub">TEL ${esc(STORE_INFO.tel)}</div>
    <div class="r-sub">${esc(STORE_INFO.addr)}</div>
  </div>

  <hr class="r-hr">
  <div class="r-doc">고 객 용 영 수 증</div>
  <div class="r-row"><span class="k">주문일시</span><span>${esc(data.orderTime || fmtTime())}</span></div>
  ${orderType ? `<div class="r-row"><span class="k">식사구분</span><span>${orderType}</span></div>` : ''}
  ${data.orderId != null ? `<div class="r-row"><span class="k">주문번호</span><span>${esc(data.orderId)}</span></div>` : ''}

  <hr class="r-hr">
  <div class="r-row" style="font-weight:700;">
    <span>상품명</span>
    <span style="display:flex; gap:10px;"><span style="width:22px; text-align:center;">수량</span><span style="min-width:62px; text-align:right;">금액</span></span>
  </div>
  <hr class="r-hr">
  ${itemRows(data.items)}

  <hr class="r-hr">
  <div class="r-row"><span class="k">공급가액</span><span>${won(supply)}</span></div>
  <div class="r-row"><span class="k">부가세(10%)</span><span>${won(vat)}</span></div>
  <hr class="r-hr-solid">
  <div class="r-total-row"><span>합계</span><span>₩ ${won(total)}</span></div>

  <hr class="r-hr">
  <div class="r-row"><span class="k">결제수단</span><span>${esc(data.methodLabel || '')}</span></div>
  <div class="r-row"><span class="k">결제금액</span><span>₩ ${won(total)}</span></div>

  <hr class="r-hr">
  <div class="r-center">
    <div class="r-sub" style="font-weight:700;">대기번호</div>
    <div class="r-order-no">${esc(data.orderNo || '-')}</div>
    <div class="r-sub">번호가 호출되면 카운터로 와주세요</div>
  </div>

  <div class="r-barcode"></div>
  <div class="r-barcode-num">${esc(String(data.orderId || Date.now()).padStart(12, '0').slice(-12))}</div>

  <div class="r-foot">
    이용해 주셔서 감사합니다<br>
    본 영수증은 교환·환불 시 필요합니다<br>
    ${esc(fmtTime())}
  </div>
</div>
</body>
</html>`;
    }

    // 숨긴 iframe 에 영수증 문서를 써서 그 안에서만 인쇄 → 키오스크 본 화면은 그대로.
    function print(data) {
        try {
            const html = buildHtml(data || {});
            const iframe = document.createElement('iframe');
            iframe.setAttribute('aria-hidden', 'true');
            iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;';
            document.body.appendChild(iframe);

            const doc = iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();

            const fire = () => {
                try {
                    iframe.contentWindow.focus();
                    iframe.contentWindow.print();
                } catch (e) {
                    console.warn('[Receipt] 인쇄 실패', e);
                }
                // 인쇄 대화/처리 후 정리
                setTimeout(() => { try { document.body.removeChild(iframe); } catch (_) {} }, 1500);
            };

            // 폰트/레이아웃 안정화 후 인쇄
            if (iframe.contentWindow.document.readyState === 'complete') setTimeout(fire, 250);
            else iframe.onload = () => setTimeout(fire, 250);
            return true;
        } catch (e) {
            console.warn('[Receipt] 출력 준비 실패', e);
            return false;
        }
    }

    window.NunchiReceipt = { print, buildHtml };
})();
