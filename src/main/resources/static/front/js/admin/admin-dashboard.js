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

const refreshAnalyticsButton = document.getElementById("refreshAnalyticsButton");
const analyticsLoading = document.getElementById("analyticsLoading");
const analyticsError = document.getElementById("analyticsError");
const analyticsContent = document.getElementById("analyticsContent");

const salesReportMonth = document.getElementById("salesReportMonth");
const downloadSalesExcelButton = document.getElementById("downloadSalesExcelButton");
const salesReportError = document.getElementById("salesReportError");

const dailySalesChart = document.getElementById("dailySalesChart");
const hourlySalesChart = document.getElementById("hourlySalesChart");
const topMenuChart = document.getElementById("topMenuChart");

document.addEventListener("DOMContentLoaded", () => {
    const token = getAdminToken();

    if (!token) {
        redirectToAdminLogin();
        return;
    }

    setDefaultSalesReportMonth();

    loadDashboard();
    loadAnalytics();
});

logoutButton.addEventListener("click", () => {
    clearAdminToken();
    window.location.href = "/admin/login.html";
});

refreshDashboardButton.addEventListener("click", () => {
    loadDashboard();
});

if (refreshAnalyticsButton) {
    refreshAnalyticsButton.addEventListener("click", () => {
        loadAnalytics();
    });
}

if (downloadSalesExcelButton) {
    downloadSalesExcelButton.addEventListener("click", () => {
        downloadSalesExcelReport();
    });
}

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

async function loadAnalytics() {
    if (!analyticsLoading || !analyticsContent) {
        return;
    }

    analyticsLoading.classList.remove("hidden");
    analyticsContent.classList.add("hidden");
    analyticsError.textContent = "";

    try {
        const data = await adminFetch("/api/admin/dashboard/analytics");

        if (!data) return;

        renderDailySalesChart(data.dailySales || []);
        renderHourlySalesChart(data.hourlySales || []);
        renderTopMenuChart(data.topMenus || []);

        analyticsContent.classList.remove("hidden");
    } catch (error) {
        analyticsError.textContent = error.message;
    } finally {
        analyticsLoading.classList.add("hidden");
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
            <td>${escapeHtml(order.orderId)}</td>
            <td>${escapeHtml(order.sessionId)}</td>
            <td>${formatCurrency(order.totalAmount)}</td>
            <td>${escapeHtml(order.orderStatus)}</td>
            <td>${escapeHtml(order.itemCount)}</td>
            <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
        </tr>
    `).join("");
}

function renderDailySalesChart(items) {
    renderBarChart(dailySalesChart, items, {
        label: item => formatShortDate(item.date),
        value: item => item.salesAmount || 0,
        subText: item => `${item.orderCount || 0}건`,
        valueText: value => formatCurrency(value),
        emptyMessage: "최근 7일 매출 데이터가 없습니다."
    });
}

function renderHourlySalesChart(items) {
    const filtered = items.filter(item => (item.orderCount || 0) > 0 || (item.salesAmount || 0) > 0);

    renderBarChart(hourlySalesChart, filtered, {
        label: item => `${item.hour}시`,
        value: item => item.salesAmount || 0,
        subText: item => `${item.orderCount || 0}건`,
        valueText: value => formatCurrency(value),
        emptyMessage: "오늘 시간대별 판매 데이터가 없습니다."
    });
}

function renderTopMenuChart(items) {
    renderBarChart(topMenuChart, items, {
        label: item => item.menuName || "-",
        value: item => item.quantitySold || 0,
        subText: item => formatCurrency(item.salesAmount || 0),
        valueText: value => `${value}개`,
        emptyMessage: "TOP 판매 메뉴 데이터가 없습니다."
    });
}

function renderBarChart(target, items, options) {
    if (!target) return;

    if (!items.length) {
        target.innerHTML = `<div class="empty-chart">${options.emptyMessage}</div>`;
        return;
    }

    const maxValue = Math.max(...items.map(options.value), 1);

    target.innerHTML = items.map(item => {
        const value = options.value(item);
        const width = Math.max((value / maxValue) * 100, value > 0 ? 6 : 0);

        return `
            <div class="bar-row">
                <div class="bar-label">${escapeHtml(options.label(item))}</div>
                <div class="bar-track">
                    <div class="bar-fill" style="width: ${width}%"></div>
                </div>
                <div class="bar-value">
                    <strong>${escapeHtml(options.valueText(value))}</strong>
                    <span>${escapeHtml(options.subText(item))}</span>
                </div>
            </div>
        `;
    }).join("");
}

function formatShortDate(value) {
    if (!value) return "-";

    const parts = String(value).split("-");
    if (parts.length !== 3) return value;

    return `${parts[1]}/${parts[2]}`;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function setDefaultSalesReportMonth() {
    if (!salesReportMonth) return;

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");

    salesReportMonth.value = `${year}-${month}`;
}

async function downloadSalesExcelReport() {
    if (!salesReportMonth || !downloadSalesExcelButton) return;

    const month = salesReportMonth.value;

    if (!month) {
        salesReportError.textContent = "조회 월을 선택해주세요.";
        return;
    }

    salesReportError.textContent = "";
    downloadSalesExcelButton.disabled = true;
    downloadSalesExcelButton.textContent = "다운로드 중...";

    try {
        const token = getAdminToken();

        if (!token) {
            redirectToAdminLogin();
            return;
        }

        const response = await fetch(`/api/admin/reports/sales/excel?month=${encodeURIComponent(month)}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401 || response.status === 403) {
            clearAdminToken();
            alert("관리자 인증이 만료되었거나 유효하지 않습니다. 다시 인증해주세요.");
            redirectToAdminLogin();
            return;
        }

        if (!response.ok) {
            throw new Error("엑셀 리포트 다운로드에 실패했습니다.");
        }

        const blob = await response.blob();
        const downloadUrl = window.URL.createObjectURL(blob);

        const link = document.createElement("a");
        link.href = downloadUrl;
        link.download = `monthly-sales-report-${month}.xlsx`;

        document.body.appendChild(link);
        link.click();
        link.remove();

        window.URL.revokeObjectURL(downloadUrl);
    } catch (error) {
        salesReportError.textContent = error.message;
    } finally {
        downloadSalesExcelButton.disabled = false;
        downloadSalesExcelButton.textContent = "엑셀 다운로드";
    }
}