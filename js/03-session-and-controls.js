/* =========================================================
   شاشة التحفيظ
========================================================= */

function openMemorizationScreen() {

    setupScreen.classList.add("hidden");

    memorizationScreen.classList.remove("hidden");

    completionMessage.classList.add("hidden");

    currentSurahName.textContent =
        `سورة ${state.session.surah.name}`;

    renderCurrentAyah();

    updateSessionInfo();

    playPauseButton.textContent =
        "▶️";

    setMediaSessionNone();
}


/* =========================================================
   الآية الحالية
========================================================= */

function getCurrentAyah() {

    if (!state.session) {
        return null;
    }

    const surah =
        state.quran.find(
            item =>
                item.number ===
                state.session.surah.number
        );

    if (!surah) {
        return null;
    }

    return surah.ayahs?.find(
        ayah =>
            ayah.number ===
            state.session.currentAyah
    ) || null;
}


function renderCurrentAyah() {

    const ayah =
        getCurrentAyah();

    if (!ayah) {

        currentAyahText.textContent =
            "سيظهر نص الآية هنا";

        return;
    }

    currentAyahText.innerHTML =
        `${ayah.text} <span class="ayah-number">۝${ayah.number}</span>`;
}


/* =========================================================
   معلومات الجلسة
========================================================= */

function updateSessionInfo() {

    if (!state.session) {
        return;
    }

    blockRepeatInfo.textContent =
        `المقطع ${state.session.currentBlockRepeat} / ${state.session.blockRepeat}`;

    ayahRepeatInfo.textContent =
        `الآية ${state.session.currentAyahRepeat} / ${state.session.ayahRepeat}`;
}


/* =========================================================
   الانتقال إلى آية أخرى
========================================================= */

async function navigateToAyah(targetAyah) {

    if (!state.session) {
        return;
    }

    const wasPlaying =
        state.session.playing;

    stopPlayback();

    state.session.currentAyah =
        targetAyah;

    state.session.currentAyahRepeat =
        1;

    renderCurrentAyah();

    updateSessionInfo();

    const navigationToken =
        playbackToken;

    if (wasPlaying) {

        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";
    }

    await loadPausePoints();

    if (
        !state.session ||
        navigationToken !== playbackToken
    ) {
        return;
    }

    if (wasPlaying) {

        playCurrentAyah(
            false,
            true
        );

    } else {

        state.session.playing = false;

        playPauseButton.textContent =
            "▶️";

        setMediaSessionNone();
    }
}


/* =========================================================
   السابق
========================================================= */

previousAyahButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }

        if (
            state.session.currentAyah >
            state.session.fromAyah
        ) {

            navigateToAyah(
                state.session.currentAyah - 1
            );
        }
    }
);


/* =========================================================
   التالي
========================================================= */

nextAyahButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }

        if (
            state.session.currentAyah <
            state.session.toAyah
        ) {

            navigateToAyah(
                state.session.currentAyah + 1
            );
        }
    }
);


/* =========================================================
   إعادة بداية المقطع
========================================================= */

restartBlockButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }

        stopPlayback();

        state.session.currentAyah =
            state.session.fromAyah;

        state.session.currentAyahRepeat =
            1;

        state.session.currentBlockRepeat =
            1;

        loadPausePoints();

        renderCurrentAyah();

        updateSessionInfo();

        state.session.playing =
            false;

        playPauseButton.textContent =
            "▶️";

        setMediaSessionNone();
    }
);


/* =========================================================
   زر التشغيل
========================================================= */

playPauseButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }

        if (state.session.playing) {

            pausePlayback();

        } else {

            playCurrentAyah(true);
        }
    }
);


/* =========================================================
   تحميل نقاط الوقف
========================================================= */

async function loadPausePoints() {

    pausePoints = [];

    if (!state.session) {
        return;
    }

    const reciter =
        state.session.reciter;

    if (!reciter.audioBaseUrl) {
        return;
    }

    const surahNumber =
        state.session.surah.number;

    const ayahNumber =
        state.session.currentAyah;

    const cacheKey =
        `${reciter.id}_${surahNumber}_${ayahNumber}`;

    if (pausePointsCache.has(cacheKey)) {

        pausePoints =
            [
                ...pausePointsCache.get(cacheKey)
            ];

        return;
    }

    try {

        const surahCacheKey =
            `${reciter.id}_${surahNumber}`;

        let allPauseData =
            pausePointsCache.get(
                `SURAH_${surahCacheKey}`
            );

        if (!allPauseData) {

            const response =
                await fetch(
                    `${reciter.audioBaseUrl}/pauses/${surahNumber}.json`
                );

            if (!response.ok) {
                return;
            }

            allPauseData =
                await response.json();

            pausePointsCache.set(
                `SURAH_${surahCacheKey}`,
                allPauseData
            );
        }

        const ayahData =
            allPauseData.find(
                item =>
                    Number(item.ayah) ===
                    Number(ayahNumber)
            );

        if (
            ayahData &&
            Array.isArray(ayahData.pauses)
        ) {

            const points =
                ayahData.pauses
                    .map(Number)
                    .filter(
                        value =>
                            Number.isFinite(value) &&
                            value > 0
                    )
                    .sort(
                        (a, b) => a - b
                    );

            pausePointsCache.set(
                cacheKey,
                points
            );

            pausePoints =
                [...points];
        }

    } catch (error) {

        console.warn(
            "تعذر تحميل pauses.json",
            error
        );

        pausePoints = [];
    }
}


/* =========================================================
   إعادة ضبط عنصر الصوت
========================================================= */

function resetAudioElement() {

    audioSegmentId++;

    beginInternalAudioAction();

    detachAudioEvents();

    try {
        audio.pause();
    } catch (error) {}

    try {
        audio.removeAttribute("src");
    } catch (error) {}

    try {
        audio.load();
    } catch (error) {}

    endInternalAudioActionSoon();
}


/* =========================================================
   تنظيف الموارد
========================================================= */

function clearPlaybackResources() {

    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    if (segmentTimer) {

        clearTimeout(segmentTimer);

        segmentTimer = null;
    }


    if (firefoxEndTimer) {

        clearTimeout(firefoxEndTimer);

        firefoxEndTimer = null;
    }


    resetAudioElement();

    setMediaSessionNone();
}


/* =========================================================
   تشغيل الآية
========================================================= */

function playCurrentAyah(
    userInitiated = false,
    preservePlayingVisual = false
) {

    if (!state.session) {
        return;
    }

    playbackToken++;

    const token =
        playbackToken;

    clearPlaybackResources();

    if (preservePlayingVisual) {

        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

    } else {

        state.session.playing = false;

        playPauseButton.textContent =
            "▶️";
    }

    segmentIndex = 0;

    currentAudioType = "normal";

    startCurrentSegment(
        token,
        userInitiated
    );
}


/* =========================================================
   حدود الجزء
========================================================= */

function getSegmentBounds(duration) {

    const totalSegments =
        pausePoints.length + 1;

    if (
        segmentIndex >=
        totalSegments
    ) {
        return null;
    }

    const start =
        segmentIndex === 0
            ? 0
            : pausePoints[
                segmentIndex - 1
            ];

    const end =
        segmentIndex <
        pausePoints.length
            ? pausePoints[
                segmentIndex
            ]
            : duration;

    return {

        start:
            Math.max(0, start),

        end:
            Math.min(duration, end)
    };
}


/* =========================================================
   تنظيف نقاط الوقف
========================================================= */

function sanitizePausePoints(duration) {

    pausePoints =
        pausePoints
            .map(Number)
            .filter(
                point =>
                    Number.isFinite(point) &&
                    point > 0 &&
                    point < duration
            )
            .sort(
                (a, b) => a - b
            );

    pausePoints =
        pausePoints.filter(
            (point, index, array) => {

                if (index === 0) {
                    return true;
                }

                return Math.abs(
                    point -
                    array[index - 1]
                ) > 0.001;
            }
        );
}


/* =========================================================
   سرعة Firefox
========================================================= */

function configureFirefoxNativeAudioSpeed(
    media,
    speed
) {

    const safeSpeed = 1;

    try {
        media.preservesPitch = true;
    } catch (error) {}

    try {
        media.mozPreservesPitch = true;
    } catch (error) {}

    try {
        media.defaultPlaybackRate = safeSpeed;
    } catch (error) {}

    try {
        media.playbackRate = safeSpeed;
    } catch (error) {}

    return safeSpeed;
}


/* =========================================================
   إعداد السرعة - باقي المتصفحات
========================================================= */

function configureAudioSpeed(
    media,
    speed
) {

    const safeSpeed =
        Math.min(
            1.25,
            Math.max(
                0.75,
                Number(speed) || 1
            )
        );

    if (isFirefox) {
        return safeSpeed;
    }

    try {
        media.preservesPitch = true;
    } catch (error) {}

    try {
        media.webkitPreservesPitch = true;
    } catch (error) {}

    try {
        media.mozPreservesPitch = true;
    } catch (error) {}

    try {
        media.defaultPlaybackRate =
            safeSpeed;
    } catch (error) {}

    try {
        media.playbackRate =
            safeSpeed;
    } catch (error) {}

    return safeSpeed;
}


/* =========================================================
   تشغيل الصوت
========================================================= */

function playAudioForCurrentBrowser(media) {

    if (!media) {
        return null;
    }

    try {
        return media.play();
    } catch (error) {
        throw error;
    }
}


/* =========================================================
   إيقاف صوت داخلي
========================================================= */

function pauseAudioInternally(media) {

    if (!media) {
        return;
    }

    beginInternalAudioAction();

    const oldPauseHandler =
        media.onpause;

    media.onpause = null;

    try {
        media.pause();
    } catch (error) {}

    setTimeout(
        () => {

            if (
                media === audio &&
                state.session &&
                state.session.playing
            ) {

            } else {

                try {
                    media.onpause =
                        oldPauseHandler;
                } catch (error) {}
            }

            endInternalAudioActionSoon();

        },
        0
    );
}


/* =========================================================
   إيقاف خارجي
========================================================= */

function handleExternalAudioStop() {

    if (internalAudioAction) {
        return;
    }

    if (!state.session) {
        return;
    }

    if (!state.session.playing) {
        return;
    }

    playbackToken++;

    if (waitTimer) {
        clearTimeout(waitTimer);
        waitTimer = null;
    }

    if (segmentTimer) {
        clearTimeout(segmentTimer);
        segmentTimer = null;
    }

    if (firefoxEndTimer) {
        clearTimeout(firefoxEndTimer);
        firefoxEndTimer = null;
    }

    resetAudioElement();

    segmentIndex = 0;

    currentAudioType = "normal";

    state.session.currentAyahRepeat = 1;

    state.session.playing = false;

    playPauseButton.textContent =
        "▶️";

    setMediaSessionNone();
}


