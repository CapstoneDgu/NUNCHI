// ========================================================
// avatar-voice-guide.js — 아바타 모드 음성 안내 헬퍼
//
// 책임:
//   A01 라우팅 이후 P-flow(P01~P07) 페이지에서 진입 시 정적 멘트만 발화.
//   ConvEngine/STT 없이 Spring `/api/voice/synthesize` 로 TTS 만 호출.
//   캐릭터 아바타는 다시 등장하지 않음 — 음성 안내(narration)만 유지.
//
// 사용:
//   <script src="/js/common/app-state.js"></script>
//   <script src="/js/common/avatar-voice-guide.js"></script>
//   document.addEventListener('DOMContentLoaded', () => {
//       AvatarGuide.speak('주문하신 메뉴 확인하시고 결제 버튼을 눌러주세요');
//   });
//
// 의존:
//   - window.AppState   — MODE, AVATAR_MUTED 키 사용
//   - same-origin fetch — Spring `/api/voice/synthesize`
//
// 동작:
//   - MODE !== 'AVATAR' 이면 no-op (일반 모드에서 호출돼도 안전)
//   - AVATAR_MUTED === '1' 이면 합성 호출도 생략
//   - 새 speak() 호출 시 이전 재생은 즉시 중단(겹침 방지)
// ========================================================

(function () {
    'use strict';

    const LOG = '[AvatarGuide]';

    let currentAudio = null;
    let currentAudioUrl = null;

    function isAvatarMode() {
        return !!(window.AppState && window.AppState.get('MODE') === 'AVATAR');
    }

    function isMuted() {
        return !!(window.AppState && window.AppState.get('AVATAR_MUTED') === '1');
    }

    function stopCurrent() {
        if (currentAudio) {
            try { currentAudio.pause(); } catch (_) {}
            currentAudio = null;
        }
        if (currentAudioUrl) {
            try { URL.revokeObjectURL(currentAudioUrl); } catch (_) {}
            currentAudioUrl = null;
        }
    }

    function synthesize(text) {
        return fetch('/api/voice/synthesize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        }).then((res) => {
            if (!res.ok) throw new Error('TTS HTTP ' + res.status);
            return res.blob();
        });
    }

    async function speak(text) {
        if (!isAvatarMode()) return;
        const t = (text || '').trim();
        if (!t) return;
        if (isMuted()) return;

        stopCurrent();
        try {
            const blob = await synthesize(t);
            // 합성 중에 또 다른 speak() 가 호출돼 stopCurrent() 가 돌았다면 무시
            if (currentAudio) return;
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            currentAudio = audio;
            currentAudioUrl = url;
            audio.addEventListener('ended', () => {
                if (currentAudio === audio) stopCurrent();
            });
            audio.play().catch((e) => console.warn(LOG, '재생 실패', e));
        } catch (e) {
            console.warn(LOG, '합성 실패', e && e.message);
        }
    }

    function stop() {
        stopCurrent();
    }

    window.AvatarGuide = { speak, stop, isMuted, isAvatarMode };
})();
