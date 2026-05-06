const loginForm = document.getElementById("adminLoginForm");
const passwordInput = document.getElementById("password");
const loginButton = document.getElementById("loginButton");
const loginErrorMessage = document.getElementById("loginErrorMessage");

loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const password = passwordInput.value.trim();

    if (!password) {
        loginErrorMessage.textContent = "관리자 비밀번호를 입력해주세요.";
        return;
    }

    loginButton.disabled = true;
    loginButton.textContent = "확인 중...";
    loginErrorMessage.textContent = "";

    try {
        const response = await fetch("/api/admin/auth/unlock", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ password })
        });

        const body = await response.json();

        if (!response.ok) {
            loginErrorMessage.textContent = body.msg || "관리자 인증에 실패했습니다.";
            return;
        }

        const accessToken = body.data?.accessToken;

        if (!accessToken) {
            loginErrorMessage.textContent = "토큰 발급에 실패했습니다.";
            return;
        }

        saveAdminToken(accessToken);
        window.location.href = "/admin/dashboard.html";
    } catch (error) {
        loginErrorMessage.textContent = "서버와 통신할 수 없습니다.";
    } finally {
        loginButton.disabled = false;
        loginButton.textContent = "관리자 모드 진입";
    }
});