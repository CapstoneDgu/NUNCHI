// data-include="..." 속성을 가진 요소를 찾아 해당 HTML을 fetch 후 치환
// 예: <div data-include="/layouts/_help-button.html"></div>
// 로드 후 커스텀 이벤트 "partials:ready" 를 document 에 발생시켜 후속 JS 가 훅 가능

async function loadPartials() {
    const targets = document.querySelectorAll("[data-include]");
    const jobs = Array.from(targets).map(async (el) => {
        const url = el.getAttribute("data-include");
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const html = await res.text();
            el.outerHTML = html;
        } catch (err) {
            console.error(`[partials-loader] ${url} 로드 실패:`, err);
        }
    });
    await Promise.all(jobs);
    document.dispatchEvent(new CustomEvent("partials:ready"));
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadPartials);
} else {
    loadPartials();
}
