const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardError = document.getElementById("dashboardError");
const dashboardContent = document.getElementById("dashboardContent");

const todayOrderCount = document.getElementById("todayOrderCount");
const todaySalesAmount = document.getElementById("todaySalesAmount");
const totalOrderCount = document.getElementById("totalOrderCount");
const soldOutMenuCount = document.getElementById("soldOutMenuCount");
const recommendedMenuCount = document.getElementById("recommendedMenuCount");
const recentOrdersBody = document.getElementById("recentOrdersBody");

const logoutButton = document.getElementById("logoutButton");
const refreshDashboardButton = document.getElementById("refreshDashboardButton");

document.addEventListener("DOMContentLoaded", () => {
    const token = getAdminToken();

    if (!token) {
        redirectToAdminLogin();
        return;
    }

    loadDashboard();
});

logoutButton.addEventListener("click", () => {
    clearAdminToken();
    window.location.href = "/admin/login.html";
});

refreshDashboardButton.addEventListener("click", () => {
    loadDashboard();
});

async function loadDashboard() {
    dashboardLoading.classList.remove("hidden");
    dashboardContent.classList.add("hidden");
    dashboardError.textContent = "";

    try {
        const data = await adminFetch("/api/admin/dashboard");

        if (!data) return;

        todayOrderCount.textContent = data.todayOrderCount ?? 0;
        todaySalesAmount.textContent = formatCurrency(data.todaySalesAmount);
        totalOrderCount.textContent = data.totalOrderCount ?? 0;
        soldOutMenuCount.textContent = data.soldOutMenuCount ?? 0;
        recommendedMenuCount.textContent = data.recommendedMenuCount ?? 0;

        renderRecentOrders(data.recentOrders || []);

        dashboardContent.classList.remove("hidden");
    } catch (error) {
        dashboardError.textContent = error.message;
    } finally {
        dashboardLoading.classList.add("hidden");
    }
}

function renderRecentOrders(orders) {
    if (!orders.length) {
        recentOrdersBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">최근 주문이 없습니다.</td>
            </tr>
        `;
        return;
    }

    recentOrdersBody.innerHTML = orders.map(order => `
        <tr>
            <td>${order.orderId}</td>
            <td>${order.sessionId}</td>
            <td>${formatCurrency(order.totalAmount)}</td>
            <td>${order.orderStatus}</td>
            <td>${order.itemCount}</td>
            <td>${formatDateTime(order.createdAt)}</td>
        </tr>
    `).join("");
}