const orderTableBody = document.getElementById("orderTableBody");
const orderLoading = document.getElementById("orderLoading");
const orderError = document.getElementById("orderError");

const refreshOrderButton = document.getElementById("refreshOrderButton");
const logoutButton = document.getElementById("logoutButton");

const orderDetailSection = document.getElementById("orderDetailSection");
const closeDetailButton = document.getElementById("closeDetailButton");
const orderDetailError = document.getElementById("orderDetailError");
const orderDetailTitle = document.getElementById("orderDetailTitle");

const detailOrderId = document.getElementById("detailOrderId");
const detailSessionId = document.getElementById("detailSessionId");
const detailTotalAmount = document.getElementById("detailTotalAmount");
const detailCreatedAt = document.getElementById("detailCreatedAt");

const orderStatusSelect = document.getElementById("orderStatusSelect");
const updateStatusButton = document.getElementById("updateStatusButton");
const orderItemTableBody = document.getElementById("orderItemTableBody");

let selectedOrderId = null;

document.addEventListener("DOMContentLoaded", () => {
    if (!getAdminToken()) {
        redirectToAdminLogin();
        return;
    }

    loadOrders();
});

logoutButton.addEventListener("click", () => {
    clearAdminToken();
    window.location.href = "/admin/login.html";
});

refreshOrderButton.addEventListener("click", () => {
    loadOrders();
});

closeDetailButton.addEventListener("click", () => {
    closeOrderDetail();
});

orderTableBody.addEventListener("click", async (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const orderId = Number(button.dataset.orderId);
    const action = button.dataset.action;

    if (action === "detail") {
        await loadOrderDetail(orderId);
    }
});

updateStatusButton.addEventListener("click", async () => {
    if (!selectedOrderId) {
        alert("선택된 주문이 없습니다.");
        return;
    }

    const orderStatus = orderStatusSelect.value;

    updateStatusButton.disabled = true;
    updateStatusButton.textContent = "변경 중...";
    orderDetailError.textContent = "";

    try {
        const updatedOrder = await adminFetch(`/api/admin/orders/${selectedOrderId}/status`, {
            method: "PATCH",
            body: JSON.stringify({ orderStatus })
        });

        renderOrderDetail(updatedOrder);
        await loadOrders();

        alert("주문 상태가 변경되었습니다.");
    } catch (error) {
        orderDetailError.textContent = error.message;
    } finally {
        updateStatusButton.disabled = false;
        updateStatusButton.textContent = "상태 변경";
    }
});

async function loadOrders() {
    orderLoading.classList.remove("hidden");
    orderError.textContent = "";

    try {
        const orders = await adminFetch("/api/admin/orders");
        renderOrders(orders || []);
    } catch (error) {
        orderError.textContent = error.message;
    } finally {
        orderLoading.classList.add("hidden");
    }
}

function renderOrders(orders) {
    if (!orders.length) {
        orderTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">주문이 없습니다.</td>
            </tr>
        `;
        return;
    }

    orderTableBody.innerHTML = orders.map(order => `
        <tr>
            <td>${escapeHtml(order.orderId)}</td>
            <td>${escapeHtml(order.sessionId)}</td>
            <td>${formatCurrency(order.totalAmount)}</td>
            <td>
                <span class="status-badge ${getOrderStatusClass(order.orderStatus)}">
                    ${escapeHtml(order.orderStatus)}
                </span>
            </td>
            <td>${escapeHtml(order.itemCount)}</td>
            <td>${escapeHtml(formatDateTime(order.createdAt))}</td>
            <td>
                <button class="small-button" data-action="detail" data-order-id="${escapeHtml(order.orderId)}">
                    상세
                </button>
            </td>
        </tr>
    `).join("");
}

async function loadOrderDetail(orderId) {
    orderDetailError.textContent = "";

    try {
        const order = await adminFetch(`/api/admin/orders/${orderId}`);
        renderOrderDetail(order);
        orderDetailSection.classList.remove("hidden");
        orderDetailSection.scrollIntoView({ behavior: "smooth" });
    } catch (error) {
        alert(error.message);
    }
}

function renderOrderDetail(order) {
    if (!order) return;

    selectedOrderId = order.orderId;

    orderDetailTitle.textContent = `주문 상세 #${order.orderId}`;
    detailOrderId.textContent = order.orderId;
    detailSessionId.textContent = order.sessionId;
    detailTotalAmount.textContent = formatCurrency(order.totalAmount);
    detailCreatedAt.textContent = formatDateTime(order.createdAt);
    orderStatusSelect.value = order.orderStatus;

    renderOrderItems(order.items || []);
}

function renderOrderItems(items) {
    if (!items.length) {
        orderItemTableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-cell">주문 상품이 없습니다.</td>
            </tr>
        `;
        return;
    }

    orderItemTableBody.innerHTML = items.map(item => `
        <tr>
            <td>${escapeHtml(item.orderItemId)}</td>
            <td>${escapeHtml(item.menuId)}</td>
            <td>${escapeHtml(item.menuName)}</td>
            <td>${escapeHtml(item.quantity)}</td>
            <td>${formatCurrency(item.unitPrice)}</td>
            <td>${formatCurrency(item.totalPrice)}</td>
        </tr>
    `).join("");
}

function closeOrderDetail() {
    selectedOrderId = null;
    orderDetailSection.classList.add("hidden");
    orderDetailError.textContent = "";
}

function getOrderStatusClass(status) {
    if (status === "COMPLETED") return "completed";
    if (status === "CANCELLED") return "cancelled";
    return "pending";
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}