(function () {
    'use strict';

    const WS_URL = 'ws://127.0.0.1:8765';
    const SAMPLE_MS = 1800;
    const SETTLE_MS = 900;

    const steps = [
        {
            key: 'center',
            position: 'center',
            step: '1 / 3',
            title: '가운데 점을 바라봐 주세요',
            desc: '평소 자세 그대로 정면 기준을 맞춥니다.'
        },
        {
            key: 'left',
            position: 'left',
            step: '2 / 3',
            title: '왼쪽 점을 바라봐 주세요',
            desc: '고개는 그대로 두고 눈만 왼쪽을 봐 주세요.'
        },
        {
            key: 'right',
            position: 'right',
            step: '3 / 3',
            title: '오른쪽 점을 바라봐 주세요',
            desc: '고개는 그대로 두고 눈만 오른쪽을 봐 주세요.'
        }
    ];

    const samples = {
        center: [],
        left: [],
        right: []
    };

    let socket = null;
    let activeKey = null;
    let startedAt = 0;

    const $target = document.querySelector('[data-target]');
    const $step = document.querySelector('[data-step]');
    const $title = document.querySelector('[data-title]');
    const $desc = document.querySelector('[data-desc]');
    const $progress = document.querySelector('[data-progress]');
    const $skip = document.querySelector('[data-action="skip"]');

    function getNextUrl() {
        const params = new URLSearchParams(location.search);
        const next = params.get('next');
        if (!next || !next.startsWith('/') || next.startsWith('//')) return '/menu';
        return next;
    }

    function connect() {
        socket = new WebSocket(WS_URL);

        socket.addEventListener('open', function () {
            send({ type: 'calibration_debug', enabled: true });
            run();
        });

        socket.addEventListener('message', function (event) {
            const data = JSON.parse(event.data);
            if (data.type !== 'vision_debug') return;
            if (!activeKey || !data.face_detected) return;
            if (typeof data.iris_ratio !== 'number') return;

            samples[activeKey].push(data.iris_ratio);
        });

        socket.addEventListener('close', function () {
            if (!sessionStorage.getItem('nunchiVisionCalibrated')) {
                setStatus('연결이 끊겼어요', 'Python 비전 서버를 확인해 주세요.');
            }
        });
    }

    async function run() {
        for (const step of steps) {
            await runStep(step);
        }

        finish();
    }

    function runStep(step) {
        return new Promise(function (resolve) {
            activeKey = null;
            setStep(step);

            setTimeout(function () {
                activeKey = step.key;
                startedAt = Date.now();

                const timer = setInterval(function () {
                    const elapsed = Date.now() - startedAt;
                    const ratio = Math.min(1, elapsed / SAMPLE_MS);
                    $progress.style.width = Math.round(ratio * 100) + '%';

                    if (elapsed >= SAMPLE_MS) {
                        clearInterval(timer);
                        activeKey = null;
                        resolve();
                    }
                }, 80);
            }, SETTLE_MS);
        });
    }

    function setStep(step) {
        $target.dataset.position = step.position;
        $step.textContent = step.step;
        $title.textContent = step.title;
        $desc.textContent = step.desc;
        $progress.style.width = '0';
    }

    function finish() {
        const center = median(samples.center);
        const left = median(samples.left);
        const right = median(samples.right);

        if (center == null || left == null || right == null) {
            setStatus('보정에 실패했어요', '얼굴이 잘 보이는 위치에서 다시 시도해 주세요.');
            setTimeout(run, 1300);
            return;
        }

        send({
            type: 'gaze_calibration',
            center: center,
            left: left,
            right: right
        });
        send({ type: 'calibration_debug', enabled: false });

        sessionStorage.setItem('nunchiVisionCalibrated', 'true');
        sessionStorage.setItem('nunchiVisionCalibration', JSON.stringify({
            center: center,
            left: left,
            right: right
        }));

        setStatus('보정 완료', '이제 메뉴를 눈으로 선택할 수 있어요.');
        setTimeout(function () {
            location.href = getNextUrl();
        }, 900);
    }

    function median(values) {
        const clean = values
            .filter(function (value) {
                return typeof value === 'number' && Number.isFinite(value);
            })
            .sort(function (a, b) {
                return a - b;
            });

        if (!clean.length) return null;

        return clean[Math.floor(clean.length / 2)];
    }

    function send(message) {
        if (!socket || socket.readyState !== WebSocket.OPEN) return;
        socket.send(JSON.stringify(message));
    }

    function setStatus(title, desc) {
        $target.dataset.position = 'center';
        $step.textContent = '';
        $title.textContent = title;
        $desc.textContent = desc;
        $progress.style.width = '100%';
    }

    function skip() {
        send({ type: 'calibration_debug', enabled: false });
        sessionStorage.setItem('nunchiVisionCalibrated', 'true');
        location.href = getNextUrl();
    }

    $skip.addEventListener('click', skip);
    window.addEventListener('beforeunload', function () {
        send({ type: 'calibration_debug', enabled: false });
    });
    connect();
})();
