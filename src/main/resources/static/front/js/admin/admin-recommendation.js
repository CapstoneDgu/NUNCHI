const recommendationLoading = document.getElementById("recommendationLoading");
const recommendationError = document.getElementById("recommendationError");
const refreshRecommendationButton = document.getElementById("refreshRecommendationButton");
const logoutButton = document.getElementById("logoutButton");

const defaultRecommendationBody = document.getElementById("defaultRecommendationBody");
const todayPopularBody = document.getElementById("todayPopularBody");
const orderPopularBody = document.getElementById("orderPopularBody");

document.addEventListener("DOMContentLoaded", () => {
    if (!getAdminToken()) {
        redirectToAdminLogin();
        return;
    }

    loadRecommendations();
});

logoutButton.addEventListener("click", () => {
    clearAdminToken();
    window.location.href = "/admin/login.html";
});

refreshRecommendationButton.addEventListener("click", () => {
    loadRecommendations();
});

async function loadRecommendations() {
    recommendationLoading.classList.remove("hidden");
    recommendationError.textContent = "";

    try {
        const [defaultMenus, todayPopularMenus, orderPopularMenus] = await Promise.all([
            adminFetch("/api/admin/recommendations/default"),
            adminFetch("/api/admin/recommendations/popular/today"),
            adminFetch("/api/admin/recommendations/popular/orders")
        ]);

        renderDefaultRecommendations(defaultMenus || []);
        renderPopularMenus(todayPopularBody, todayPopularMenus || [], "오늘 판매 데이터가 없습니다.");
        renderPopularMenus(orderPopularBody, orderPopularMenus || [], "주문 기반 인기 데이터가 없습니다.");
    } catch (error) {
        recommendationError.textContent = error.message;
    } finally {
        recommendationLoading.classList.add("hidden");
    }
}

function renderDefaultRecommendations(menus) {
    if (!menus.length) {
        defaultRecommendationBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">기본 추천 메뉴가 없습니다.</td>
            </tr>
        `;
        return;
    }

    defaultRecommendationBody.innerHTML = menus.map(menu => `
        <tr>
            <td>${menu.menuId}</td>
            <td>${escapeHtml(menu.name)}</td>
            <td>${formatCurrency(menu.price)}</td>
            <td>${escapeHtml(menu.categoryName || "-")}</td>
            <td>
                <span class="status-badge ${menu.isSoldOut ? "cancelled" : "completed"}">
                    ${menu.isSoldOut ? "품절" : "판매중"}
                </span>
            </td>
            <td>
                <span class="status-badge ${menu.isRecommended ? "completed" : "pending"}">
                    ${menu.isRecommended ? "추천" : "일반"}
                </span>
            </td>
        </tr>
    `).join("");
}

function renderPopularMenus(targetBody, menus, emptyMessage) {
    if (!menus.length) {
        targetBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">${emptyMessage}</td>
            </tr>
        `;
        return;
    }

    targetBody.innerHTML = menus.map((menu, index) => `
        <tr>
            <td>
                <span class="rank-badge">${index + 1}</span>
            </td>
            <td>${menu.menuId}</td>
            <td>${escapeHtml(menu.name)}</td>
            <td>${formatCurrency(menu.price)}</td>
            <td>
                <span class="status-badge ${menu.isSoldOut ? "cancelled" : "completed"}">
                    ${menu.isSoldOut ? "품절" : "판매중"}
                </span>
            </td>
            <td>${menu.totalQuantity ?? "-"}</td>
        </tr>
    `).join("");
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}