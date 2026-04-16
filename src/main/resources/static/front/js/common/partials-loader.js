// data-include="..." 속성을 가진 요소를 찾아 해당 HTML을 fetch 후 치환
// 예: <div data-include="/layouts/_help-button.html"></div>
// 로드 후 커스텀 이벤트 "partials:ready" 를 document 에 발생시켜 후속 JS 가 훅 가능

var PARTIAL_TIMEOUT_MS = 5000;

async function loadPartials() {
    var targets = document.querySelectorAll("[data-include]");
    var jobs = Array.from(targets).map(async function (el) {
        var url = el.getAttribute("data-include");
        var controller = new AbortController();
        var timer = setTimeout(function () { controller.abort(); }, PARTIAL_TIMEOUT_MS);
        try {
            var res = await fetch(url, { signal: controller.signal });
            clearTimeout(timer);
            if (!res.ok) throw new Error("HTTP " + res.status);
            var html = await res.text();
            el.outerHTML = html;
        } catch (err) {
            clearTimeout(timer);
            console.error("[partials-loader] " + url + " 로드 실패:", err);
        }
    });
    await Promise.allSettled(jobs);
    document.dispatchEvent(new CustomEvent("partials:ready"));
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPartials);
} else {
    loadPartials();
}
