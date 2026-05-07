const menuTableBody = document.getElementById("menuTableBody");
const menuLoading = document.getElementById("menuLoading");
const menuError = document.getElementById("menuError");

const refreshMenuButton = document.getElementById("refreshMenuButton");
const openCreateFormButton = document.getElementById("openCreateFormButton");
const closeFormButton = document.getElementById("closeFormButton");

const menuFormSection = document.getElementById("menuFormSection");
const menuForm = document.getElementById("menuForm");
const menuFormTitle = document.getElementById("menuFormTitle");
const submitMenuButton = document.getElementById("submitMenuButton");
const menuFormError = document.getElementById("menuFormError");

const menuIdInput = document.getElementById("menuId");
const nameInput = document.getElementById("name");
const priceInput = document.getElementById("price");
const categoryIdInput = document.getElementById("categoryId");
const imageUrlInput = document.getElementById("imageUrl");
const isSoldOutInput = document.getElementById("isSoldOut");
const isRecommendedInput = document.getElementById("isRecommended");

const logoutButton = document.getElementById("logoutButton");
const statusEditHint = document.getElementById("statusEditHint");

let menus = [];

document.addEventListener("DOMContentLoaded", () => {
    if (!getAdminToken()) {
        redirectToAdminLogin();
        return;
    }

    loadMenus();
});

logoutButton.addEventListener("click", () => {
    clearAdminToken();
    window.location.href = "/admin/login.html";
});

refreshMenuButton.addEventListener("click", loadMenus);

openCreateFormButton.addEventListener("click", () => {
    openCreateForm();
});

closeFormButton.addEventListener("click", () => {
    closeMenuForm();
});

menuForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const editingMenuId = menuIdInput.value ? Number(menuIdInput.value) : null;

    if (menuIdInput.value && (!Number.isInteger(editingMenuId) || editingMenuId < 1)) {
        menuFormError.textContent = "유효하지 않은 메뉴 ID입니다.";
        return;
    }

    const payload = {
        name: nameInput.value.trim(),
        price: Number(priceInput.value),
        imageUrl: imageUrlInput.value.trim(),
        categoryId: Number(categoryIdInput.value)
    };

    if (!payload.name) {
        menuFormError.textContent = "메뉴명을 입력해주세요.";
        return;
    }

    if (Number.isNaN(payload.price) || payload.price < 0) {
        menuFormError.textContent = "가격을 올바르게 입력해주세요.";
        return;
    }

    if (Number.isNaN(payload.categoryId) || payload.categoryId < 1) {
        menuFormError.textContent = "카테고리 ID를 올바르게 입력해주세요.";
        return;
    }

    submitMenuButton.disabled = true;
    submitMenuButton.textContent = "저장 중...";
    menuFormError.textContent = "";

    try {
        if (editingMenuId) {
            await adminFetch(`/api/admin/menus/${editingMenuId}`, {
                method: "PATCH",
                body: JSON.stringify(payload)
            });
        } else {
            await adminFetch("/api/admin/menus", {
                method: "POST",
                body: JSON.stringify({
                    ...payload,
                    isSoldOut: isSoldOutInput.checked,
                    isRecommended: isRecommendedInput.checked
                })
            });
        }

        closeMenuForm();
        await loadMenus();
    } catch (error) {
        menuFormError.textContent = error.message;
    } finally {
        submitMenuButton.disabled = false;
        submitMenuButton.textContent = "저장";
    }
});

async function loadMenus() {
    menuLoading.classList.remove("hidden");
    menuError.textContent = "";

    try {
        menus = await adminFetch("/api/admin/menus");
        renderMenus(menus || []);
    } catch (error) {
        menuError.textContent = error.message;
    } finally {
        menuLoading.classList.add("hidden");
    }
}

function renderMenus(menuList) {
    if (!menuList.length) {
        menuTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-cell">메뉴가 없습니다.</td>
            </tr>
        `;
        return;
    }

    menuTableBody.innerHTML = menuList.map(menu => `
        <tr>
            <td>${menu.menuId}</td>
            <td>${escapeHtml(menu.name)}</td>
            <td>${formatCurrency(menu.price)}</td>
            <td>${escapeHtml(menu.categoryName || "-")}</td>
            <td>
                <button class="status-button ${menu.isSoldOut ? "danger" : "success"}"
                        onclick="toggleSoldOut(${menu.menuId}, ${!menu.isSoldOut})">
                    ${menu.isSoldOut ? "품절" : "판매중"}
                </button>
            </td>
            <td>
                <button class="status-button ${menu.isRecommended ? "success" : "muted"}"
                        onclick="toggleRecommended(${menu.menuId}, ${!menu.isRecommended})">
                    ${menu.isRecommended ? "추천" : "일반"}
                </button>
            </td>
            <td>
                <button class="small-button" onclick="openEditForm(${menu.menuId})">수정</button>
                <button class="small-button danger" onclick="deleteMenu(${menu.menuId})">삭제</button>
            </td>
        </tr>
    `).join("");
}

function openCreateForm() {
    menuFormTitle.textContent = "메뉴 등록";
    menuForm.reset();
    menuIdInput.value = "";

    isSoldOutInput.disabled = false;
    isRecommendedInput.disabled = false;

    if (statusEditHint) {
        statusEditHint.classList.add("hidden");
    }

    menuFormError.textContent = "";
    menuFormSection.classList.remove("hidden");
    menuFormSection.scrollIntoView({ behavior: "smooth" });
}

function openEditForm(menuId) {
    menuId = validatePositiveId(menuId);
    if (!menuId) return;
    const menu = menus.find(item => item.menuId === menuId);

    if (!menu) {
        alert("메뉴 정보를 찾을 수 없습니다.");
        return;
    }

    menuFormTitle.textContent = "메뉴 수정";
    menuIdInput.value = menu.menuId;
    nameInput.value = menu.name || "";
    priceInput.value = menu.price || 0;
    categoryIdInput.value = menu.categoryId || "";
    imageUrlInput.value = menu.imageUrl || "";

    isSoldOutInput.checked = !!menu.isSoldOut;
    isRecommendedInput.checked = !!menu.isRecommended;
    isSoldOutInput.disabled = true;
    isRecommendedInput.disabled = true;

    if (statusEditHint) {
        statusEditHint.classList.remove("hidden");
    }

    menuFormError.textContent = "";
    menuFormSection.classList.remove("hidden");
    menuFormSection.scrollIntoView({ behavior: "smooth" });
}

function closeMenuForm() {
    menuFormSection.classList.add("hidden");
    menuForm.reset();
    menuIdInput.value = "";
    menuFormError.textContent = "";

    if (statusEditHint) {
        statusEditHint.classList.add("hidden");
    }
}

async function toggleSoldOut(menuId, isSoldOut) {
    menuId = validatePositiveId(menuId);
    if (!menuId) return;

    try {
        await adminFetch(`/api/admin/menus/${menuId}/sold-out`, {
            method: "PATCH",
            body: JSON.stringify({ isSoldOut })
        });

        await loadMenus();
    } catch (error) {
        alert(error.message);
    }
}

async function toggleRecommended(menuId, isRecommended) {
    menuId = validatePositiveId(menuId);
    if (!menuId) return;

    try {
        await adminFetch(`/api/admin/menus/${menuId}/recommended`, {
            method: "PATCH",
            body: JSON.stringify({ isRecommended })
        });

        await loadMenus();
    } catch (error) {
        alert(error.message);
    }
}

async function deleteMenu(menuId) {
    menuId = validatePositiveId(menuId);
    if (!menuId) return;

    if (!confirm("정말 이 메뉴를 삭제하시겠습니까?")) {
        return;
    }

    try {
        await adminFetch(`/api/admin/menus/${menuId}`, {
            method: "DELETE"
        });

        await loadMenus();
    } catch (error) {
        alert(error.message);
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

function validatePositiveId(id) {
    const numberId = Number(id);

    if (!Number.isInteger(numberId) || numberId < 1) {
        alert("유효하지 않은 메뉴 ID입니다.");
        return null;
    }

    return numberId;
}
