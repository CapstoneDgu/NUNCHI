const ADMIN_TOKEN_KEY = "adminAccessToken";

function getAdminToken() {
    return sessionStorage.getItem(ADMIN_TOKEN_KEY);
}

function saveAdminToken(token) {
    sessionStorage.setItem(ADMIN_TOKEN_KEY, token);
}

function clearAdminToken() {
    sessionStorage.removeItem(ADMIN_TOKEN_KEY);
}

function redirectToAdminLogin() {
    window.location.href = "/admin/login.html";
}

async function adminFetch(url, options = {}) {
    const token = getAdminToken();

    if (!token) {
        redirectToAdminLogin();
        return;
    }

    const headers = {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`,
        ...(options.headers || {})
    };

    const response = await fetch(url, {
        ...options,
        headers
    });

    const contentType = response.headers.get("content-type");
    const hasJson = contentType && contentType.includes("application/json");
    const body = hasJson ? await response.json() : null;

    if (response.status === 204) {
        return null;
    }

    if (response.status === 401 || response.status === 403) {
        clearAdminToken();
        alert("관리자 인증이 만료되었거나 유효하지 않습니다. 다시 인증해주세요.");
        redirectToAdminLogin();
        return;
    }

    if (!response.ok) {
        const message = body?.msg || "요청 처리 중 오류가 발생했습니다.";
        throw new Error(message);
    }

    return body?.data;
}

function formatCurrency(value) {
    const number = Number(value || 0);
    return number.toLocaleString("ko-KR") + "원";
}

function formatDateTime(value) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }

    return date.toLocaleString("ko-KR", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit"
    });
}