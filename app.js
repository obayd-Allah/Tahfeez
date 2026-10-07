const state = {
    quran: [],
    surahs: [],
    reciters: [],
    selectedReciter: null,
    selectedSurah: null,
    session: null
};


/* =========================================================
   رقم النسخة المؤقت
========================================================= */

const CODE_VERSION = "CODE 25";


/* =========================================================
   مربع اختبار تحميل النسخة
========================================================= */

(function createTemporaryVersionBox() {

    const box = document.createElement("div");

    box.textContent = CODE_VERSION;
    box.id = "temporaryCodeVersion";

    box.style.position = "fixed";
    box.style.top = "8px";
    box.style.left = "8px";
    box.style.zIndex = "999999";
    box.style.padding = "4px 8px";
    box.style.borderRadius = "8px";
    box.style.background = "#222";
    box.style.color = "#fff";
    box.style.fontSize = "11px";
    box.style.fontFamily = "Arial, sans-serif";
    box.style.fontWeight = "bold";
    box.style.opacity = "0.85";
    box.style.pointerEvents = "none";

    document.body.appendChild(box);

})();


/* =========================================================
   نظام الصوت
========================================================= */

const audio = new Audio();

audio.preload = "auto";
audio.controls = false;

try {
    audio.disableRemotePlayback = true;
} catch (error) {}


/* =========================================================
   FIREFOX
========================================================= */

const isFirefox =
    /firefox/i.test(navigator.userAgent);


/* =========================================================
   MI BROWSER
========================================================= */

const isMiBrowser =
    /MiuiBrowser|Mi Browser/i.test(
        navigator.userAgent
    );


/* =========================================================
   إخفاء التحكم في السرعة في Firefox
========================================================= */

function hideFirefoxSpeedControl() {

    if (!isFirefox) {
        return;
    }

    try {

        if (speedRange) {
            speedRange.style.display = "none";
            speedRange.disabled = true;
        }

        if (speedValue) {
            speedValue.style.display = "none";
        }

        if (speedRange) {

            const candidates = [
                speedRange.closest("label"),
                speedRange.closest(".setting"),
                speedRange.closest(".setting-item"),
                speedRange.closest(".control-group"),
                speedRange.closest(".form-group"),
                speedRange.parentElement
            ];

            for (const element of candidates) {

                if (!element) {
                    continue;
                }

                const text =
                    (element.textContent || "").trim();

                if (
                    element === speedRange.parentElement ||
                    /سرعة|speed/i.test(text)
                ) {
                    element.style.display = "none";
                    break;
                }
            }
        }

    } catch (error) {

        console.warn(
            "تعذر إخفاء تحكم السرعة في Firefox:",
            error
        );
    }
}


/* =========================================================
   حالة التشغيل
========================================================= */

let audioSegmentId = 0;

let internalAudioAction = false;

let internalAudioActionDepth = 0;

let internalSeekAction = false;


/* =========================================================
   بيانات التشغيل
========================================================= */

let pausePoints = [];

let pausePointsCache = new Map();

let segmentIndex = 0;

let currentAudioType = "normal";

let waitTimer = null;

let segmentTimer = null;

/*
    مؤقت احتياطي لنهاية الآية في Firefox.
*/
let firefoxEndTimer = null;

let playbackToken = 0;


/* =========================================================
   أدوات العمليات الداخلية
========================================================= */

function beginInternalAudioAction() {

    internalAudioActionDepth++;

    internalAudioAction = true;
}


function endInternalAudioActionSoon() {

    setTimeout(
        () => {

            internalAudioActionDepth =
                Math.max(
                    0,
                    internalAudioActionDepth - 1
                );

            internalAudioAction =
                internalAudioActionDepth > 0;

        },
        0
    );
}


function detachAudioEvents() {

    audio.onplay = null;
    audio.onplaying = null;
    audio.onloadedmetadata = null;
    audio.ondurationchange = null;
    audio.onloadeddata = null;
    audio.oncanplay = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    audio.onpause = null;
    audio.onemptied = null;
    audio.onseeking = null;
    audio.onseeked = null;
}


/* =========================================================
   عناصر الصفحة
========================================================= */

const setupScreen =
    document.getElementById("setupScreen");

const memorizationScreen =
    document.getElementById("memorizationScreen");

const reciterSelect =
    document.getElementById("reciterSelect");

const surahSelect =
    document.getElementById("surahSelect");

const fromAyah =
    document.getElementById("fromAyah");

const toAyah =
    document.getElementById("toAyah");

const speedRange =
    document.getElementById("speedRange");

const speedValue =
    document.getElementById("speedValue");

if (isFirefox) {
    hideFirefoxSpeedControl();
}

const ayahRepeat =
    document.getElementById("ayahRepeat");

const blockRepeat =
    document.getElementById("blockRepeat");

const waitSelect =
    document.getElementById("waitSelect");

const teacherModeField =
    document.getElementById("teacherModeField");

const teacherMode =
    document.getElementById("teacherMode");

const teacherModeDescription =
    document.getElementById("teacherModeDescription");

const availabilityMessage =
    document.getElementById("availabilityMessage");

const startButton =
    document.getElementById("startButton");

const playerSettingsButton =
    document.getElementById("playerSettingsButton");

const currentSurahName =
    document.getElementById("currentSurahName");

const currentAyahText =
    document.getElementById("currentAyahText");

const blockRepeatInfo =
    document.getElementById("blockRepeatInfo");

const ayahRepeatInfo =
    document.getElementById("ayahRepeatInfo");

const completionMessage =
    document.getElementById("completionMessage");

const previousAyahButton =
    document.getElementById("previousAyahButton");

const restartBlockButton =
    document.getElementById("restartBlockButton");

const playPauseButton =
    document.getElementById("playPauseButton");

const nextAyahButton =
    document.getElementById("nextAyahButton");


/* =========================================================
   Media Session
========================================================= */

function setMediaSessionNone() {

    if (!("mediaSession" in navigator)) {
        return;
    }

    try {

        navigator.mediaSession.metadata = null;

        navigator.mediaSession.playbackState = "none";

    } catch (error) {

        console.warn(
            "تعذر ضبط Media Session:",
            error
        );
    }
}


function setupMediaSessionHandlers() {

    if (!("mediaSession" in navigator)) {
        return;
    }

    try {

        navigator.mediaSession.setActionHandler(
            "play",
            () => {

                if (!state.session) {
                    return;
                }

                if (!state.session.playing) {
                    playCurrentAyah(true);
                }

            }
        );


        navigator.mediaSession.setActionHandler(
            "pause",
            () => {

                if (!state.session) {
                    return;
                }

                if (state.session.playing) {
                    pausePlayback();
                }

            }
        );


        try {

            navigator.mediaSession.setActionHandler(
                "stop",
                () => {
                    handleExternalAudioStop();
                }
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "seekbackward",
                () => {
                    handleExternalSeekAttempt();
                }
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "seekforward",
                () => {
                    handleExternalSeekAttempt();
                }
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "previoustrack",
                null
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "nexttrack",
                null
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "seekto",
                () => {
                    handleExternalSeekAttempt();
                }
            );

        } catch (error) {}

    } catch (error) {

        console.warn(
            "تعذر إعداد Media Session:",
            error
        );
    }
}


setupMediaSessionHandlers();

setMediaSessionNone();


/* =========================================================
   محاولة تغيير الموضع خارجيًا
========================================================= */

function handleExternalSeekAttempt() {

    if (!state.session) {
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

    playPauseButton.textContent = "▶️";

    setMediaSessionNone();
}


/* =========================================================
   تحميل البيانات
========================================================= */

async function loadData() {

    try {

        const [
            quranResponse,
            recitersResponse
        ] = await Promise.all([
            fetch("./data/quran.json"),
            fetch("./data/reciters.json")
        ]);

        if (!quranResponse.ok) {
            throw new Error(
                "تعذر تحميل quran.json"
            );
        }

        if (!recitersResponse.ok) {
            throw new Error(
                "تعذر تحميل reciters.json"
            );
        }

        const quranData =
            await quranResponse.json();

        state.reciters =
            await recitersResponse.json();

        state.quran =
            quranData.map(
                surah => ({
                    number: surah.id,
                    name: surah.name,
                    ayahCount: surah.total_verses,

                    ayahs:
                        surah.verses.map(
                            ayah => ({
                                number: ayah.id,
                                text: ayah.text
                            })
                        )
                })
            );

        state.surahs =
            state.quran;

        populateReciters();

        restoreSettings();

        if (isFirefox) {
            hideFirefoxSpeedControl();
        }

    } catch (error) {

        console.error(error);

        showAvailability(
            "تعذر تحميل بيانات التحفيظ حاليًا."
        );
    }
}


/* =========================================================
   الشيوخ
========================================================= */

function populateReciters() {

    reciterSelect.innerHTML = `
        <option value="">
            اختر الشيخ
        </option>
    `;

    for (const reciter of state.reciters) {

        const option =
            document.createElement("option");

        option.value =
            reciter.id;

        option.textContent =
            reciter.name;

        reciterSelect.appendChild(option);
    }
}


/* =========================================================
   السور
========================================================= */

function populateSurahs() {

    surahSelect.innerHTML = `
        <option value="">
            اختر السورة
        </option>
    `;

    if (!state.selectedReciter) {

        surahSelect.disabled = true;
        return;
    }

    const availableSurahs =
        state.selectedReciter.surahs || {};

    for (
        const number of Object.keys(availableSurahs)
    ) {

        const surah =
            state.surahs.find(
                item =>
                    String(item.number) ===
                    String(number)
            );

        if (!surah) {
            continue;
        }

        const option =
            document.createElement("option");

        option.value =
            surah.number;

        option.textContent =
            `${surah.number}. ${surah.name}`;

        surahSelect.appendChild(option);
    }

    surahSelect.disabled = false;
}


/* =========================================================
   اختيار الشيخ
========================================================= */

reciterSelect.addEventListener(
    "change",
    () => {

        const id =
            reciterSelect.value;

        state.selectedReciter =
            state.reciters.find(
                reciter =>
                    reciter.id === id
            ) || null;

        pausePointsCache.clear();
        pausePoints = [];

        populateSurahs();

        resetAyahInputs();

        hideAvailability();

        updateTeacherMode();

        validateSetup();

        saveSettings();
    }
);


/* =========================================================
   اختيار السورة
========================================================= */

surahSelect.addEventListener(
    "change",
    () => {

        const number =
            Number(surahSelect.value);

        state.selectedSurah =
            state.surahs.find(
                surah =>
                    surah.number === number
            ) || null;

        pausePointsCache.clear();
        pausePoints = [];

        if (!state.selectedSurah) {

            resetAyahInputs();
            hideAvailability();
            validateSetup();

            return;
        }

        const available =
            getAvailableSurah(
                state.selectedSurah.number
            );

        if (!available) {

            showAvailability(
                `سورة ${state.selectedSurah.name} غير متوفرة بصوت ${state.selectedReciter.name} حاليًا.`
            );

            disableAyahInputs();

            startButton.disabled = true;

            return;
        }

        hideAvailability();

        enableAyahInputs();

        fromAyah.min =
            available.from;

        fromAyah.max =
            available.to;

        toAyah.min =
            available.from;

        toAyah.max =
            available.to;

        fromAyah.value =
            available.from;

        toAyah.value =
            available.to;

        validateSetup();

        saveSettings();
    }
);


/* =========================================================
   معرفة السورة المتوفرة
========================================================= */

function getAvailableSurah(number) {

    if (!state.selectedReciter) {
        return null;
    }

    return state.selectedReciter.surahs?.[
        String(number)
    ] || null;
}


/* =========================================================
   الآيات
========================================================= */

fromAyah.addEventListener(
    "input",
    validateAyahRange
);

toAyah.addEventListener(
    "input",
    validateAyahRange
);


function validateAyahRange() {

    if (!state.selectedSurah) {
        return;
    }

    const available =
        getAvailableSurah(
            state.selectedSurah.number
        );

    if (!available) {
        return;
    }

    let from =
        Number(fromAyah.value);

    let to =
        Number(toAyah.value);

    if (
        !Number.isFinite(from) ||
        from < available.from
    ) {
        from = available.from;
    }

    if (
        !Number.isFinite(to) ||
        to < available.from
    ) {
        to = available.from;
    }

    if (from > available.to) {
        from = available.to;
    }

    if (to > available.to) {
        to = available.to;
    }

    if (to < from) {
        to = from;
    }

    fromAyah.value = from;
    toAyah.value = to;

    validateSetup();

    saveSettings();
}


/* =========================================================
   السرعة
========================================================= */

speedRange.addEventListener(
    "input",
    () => {

        const speed =
            Number(speedRange.value);

        speedValue.textContent =
            `${speed.toFixed(2)}×`;

        if (
            state.session &&
            state.session.playing &&
            Number.isFinite(speed)
        ) {

            if (isFirefox) {

                state.session.speed = 1;

                configureFirefoxNativeAudioSpeed(
                    audio,
                    1
                );

            } else {

                state.session.speed =
                    Math.min(
                        1.25,
                        Math.max(
                            0.75,
                            speed
                        )
                    );

                configureAudioSpeed(
                    audio,
                    state.session.speed
                );
            }
        }

        saveSettings();
    }
);


/* =========================================================
   الإعدادات الأخرى
========================================================= */

ayahRepeat.addEventListener(
    "change",
    saveSettings
);

blockRepeat.addEventListener(
    "change",
    saveSettings
);

waitSelect.addEventListener(
    "change",
    saveSettings
);

teacherMode.addEventListener(
    "change",
    saveSettings
);


/* =========================================================
   وضع المعلم
========================================================= */

function updateTeacherMode() {

    const available =
        Boolean(
            state.selectedReciter?.teacherMode
        );

    teacherMode.checked = false;

    teacherMode.disabled =
        !available;

    if (!available) {

        teacherModeField.classList.add(
            "is-disabled"
        );

        teacherModeDescription.textContent =
            "غير متوفر لهذا الشيخ";

        return;
    }

    teacherModeField.classList.remove(
        "is-disabled"
    );

    teacherModeDescription.textContent =
        "يقرأ المحفّظ أولًا ثم يردد التسجيل التعليمي";
}


/* =========================================================
   التحقق من الإعدادات
========================================================= */

function validateSetup() {

    if (
        !state.selectedReciter ||
        !state.selectedSurah
    ) {

        startButton.disabled = true;
        return;
    }

    const available =
        getAvailableSurah(
            state.selectedSurah.number
        );

    if (!available) {

        startButton.disabled = true;
        return;
    }

    const from =
        Number(fromAyah.value);

    const to =
        Number(toAyah.value);

    startButton.disabled = !(
        from >= available.from &&
        to <= available.to &&
        from <= to
    );
}


/* =========================================================
   بدء التحفيظ
========================================================= */

startButton.addEventListener(
    "click",
    startMemorization
);


async function startMemorization() {

    if (
        !state.selectedReciter ||
        !state.selectedSurah
    ) {
        return;
    }

    const from =
        Number(fromAyah.value);

    const to =
        Number(toAyah.value);

    state.session = {

        reciter:
            state.selectedReciter,

        surah:
            state.selectedSurah,

        fromAyah:
            from,

        toAyah:
            to,

        currentAyah:
            from,

        ayahRepeat:
            Number(ayahRepeat.value),

        blockRepeat:
            Number(blockRepeat.value),

        currentAyahRepeat:
            1,

        currentBlockRepeat:
            1,

        speed:
            isFirefox
                ? 1
                : Number(speedRange.value),

        wait:
            Number(waitSelect.value),

        teacherMode:
            teacherMode.checked,

        playing:
            false
    };

    await loadPausePoints();

    if (!state.session) {
        return;
    }

    openMemorizationScreen();
}


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

    /*
        إزالة أي نقاط مكررة تمامًا حتى لا يتكون
        جزء طوله صفر.
    */

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


/* =========================================================
   تشغيل الجزء الحالي
========================================================= */

function startCurrentSegment(
    token,
    userInitiated = false
) {

    if (isFirefox) {

        startCurrentSegmentFirefox(
            token,
            userInitiated
        );

        return;
    }

    startCurrentSegmentOtherBrowsers(
        token,
        userInitiated
    );
}


/* =========================================================
   Firefox
   الوضع العادي:
   الآية كلها ملف واحد
   pausePoint = pause / wait / resume

   وضع المعلم:
   normal segment -> teacher segment
========================================================= */

function startCurrentSegmentFirefox(
    token,
    userInitiated = false
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    if (state.session.teacherMode) {

        startCurrentSegmentFirefoxTeacher(
            token,
            userInitiated
        );

        return;
    }


    /* =====================================================
       Firefox - الوضع العادي
    ===================================================== */

    const reciter =
        state.session.reciter;

    const surahNumber =
        state.session.surah.number;

    const ayahNumber =
        state.session.currentAyah;

    const url =
        `${reciter.audioBaseUrl}/normal/${surahNumber}/${ayahNumber}.mp3`;

    const thisAudioId =
        ++audioSegmentId;

    const currentAudio =
        audio;

    let metadataReady = false;
    let started = false;
    let finished = false;
    let pauseWaiting = false;

    let pauseIndex = 0;
    let lastPausePoint = -1;

    beginInternalAudioAction();

    detachAudioEvents();

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

    try {
        currentAudio.pause();
    } catch (error) {}

    if (currentAudio.src !== url) {

        try {

            currentAudio.src = url;
            currentAudio.load();

        } catch (error) {

            endInternalAudioActionSoon();

            console.error(
                "تعذر تحميل ملف الصوت في Firefox:",
                error
            );

            return;
        }
    }

    configureFirefoxNativeAudioSpeed(
        currentAudio,
        1
    );


    function isCurrent() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisAudioId === audioSegmentId
        );
    }


    function clearTimers() {

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
    }


    function setPlaying() {

        if (!isCurrent()) {
            return;
        }

        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

        if ("mediaSession" in navigator) {

            try {

                navigator.mediaSession.playbackState =
                    "playing";

            } catch (error) {}
        }
    }


    function setStopped() {

        if (!isCurrent()) {
            return;
        }

        state.session.playing = false;

        playPauseButton.textContent =
            "▶️";

        setMediaSessionNone();
    }


    function playAgain() {

        if (
            !isCurrent() ||
            finished ||
            pauseWaiting
        ) {
            return;
        }

        let promise = null;

        try {

            promise =
                currentAudio.play();

        } catch (error) {

            setTimeout(
                () => {

                    if (
                        !isCurrent() ||
                        finished ||
                        pauseWaiting
                    ) {
                        return;
                    }

                    try {

                        const retry =
                            currentAudio.play();

                        if (
                            retry &&
                            typeof retry.catch ===
                                "function"
                        ) {

                            retry.catch(
                                retryError => {

                                    console.error(
                                        "تعذر استئناف Firefox:",
                                        retryError
                                    );

                                    setStopped();
                                }
                            );
                        }

                    } catch (retryError) {

                        console.error(
                            "تعذر استئناف Firefox:",
                            retryError
                        );

                        setStopped();
                    }

                },
                100
            );

            return;
        }

        if (
            promise &&
            typeof promise.catch ===
                "function"
        ) {

            promise.catch(
                error => {

                    if (!isCurrent()) {
                        return;
                    }

                    if (
                        error &&
                        (
                            error.name ===
                                "AbortError" ||
                            error.name ===
                                "NotAllowedError"
                        )
                    ) {

                        setTimeout(
                            () => {
                                playAgain();
                            },
                            100
                        );

                        return;
                    }

                    console.error(
                        "تعذر تشغيل Firefox:",
                        error
                    );

                    setStopped();
                }
            );
        }
    }


    function finishFirefoxAyah() {

        if (
            finished ||
            !isCurrent() ||
            !started
        ) {
            return;
        }

        finished = true;

        clearTimers();

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();

        finishAyah(token);
    }


    function waitAtPause(point) {

        if (
            pauseWaiting ||
            finished ||
            !isCurrent()
        ) {
            return;
        }

        pauseWaiting = true;

        if (segmentTimer) {
            clearTimeout(segmentTimer);
            segmentTimer = null;
        }

        const previousPoint =
            pauseIndex === 0
                ? 0
                : Number(
                    pausePoints[
                        pauseIndex - 1
                    ]
                );

        const segmentDuration =
            Math.max(
                0,
                Number(point) -
                previousPoint
            );

        pauseIndex++;

        lastPausePoint =
            Number(point);

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();


        const multiplier =
            Number(
                state.session.wait
            );


        const waitTime =
            (
                Number.isFinite(multiplier) &&
                multiplier > 0
                    ? segmentDuration *
                      multiplier *
                      1000
                    : 0
            );


        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

        setMediaSessionNone();


        if (waitTime <= 0) {

            pauseWaiting = false;

            playAgain();

            return;
        }


        waitTimer =
            setTimeout(
                () => {

                    waitTimer = null;

                    if (
                        !isCurrent() ||
                        finished
                    ) {
                        return;
                    }

                    pauseWaiting = false;

                    playAgain();

                },
                waitTime
            );
    }


    function setupAudio() {

        if (
            !isCurrent() ||
            metadataReady
        ) {
            return;
        }

        const duration =
            Number(
                currentAudio.duration
            );

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {
            return;
        }

        metadataReady = true;

        sanitizePausePoints(
            duration
        );

        pauseIndex = 0;

        lastPausePoint = -1;


        if (firefoxEndTimer) {

            clearTimeout(
                firefoxEndTimer
            );

            firefoxEndTimer = null;
        }


        firefoxEndTimer =
            setTimeout(
                () => {

                    firefoxEndTimer = null;

                    if (
                        !isCurrent() ||
                        finished ||
                        !started
                    ) {
                        return;
                    }

                    const now =
                        Number(
                            currentAudio.currentTime
                        );

                    const currentDuration =
                        Number(
                            currentAudio.duration
                        );


                    if (
                        currentAudio.ended ||
                        (
                            Number.isFinite(now) &&
                            Number.isFinite(currentDuration) &&
                            currentDuration > 0 &&
                            now >=
                                currentDuration - 0.25
                        )
                    ) {

                        finishFirefoxAyah();

                        return;
                    }


                    const remaining =
                        Number.isFinite(
                            currentDuration
                        ) &&
                        currentDuration > now

                            ? Math.max(
                                100,
                                (
                                    currentDuration -
                                    now
                                ) * 1000 +
                                300
                            )

                            : 500;


                    firefoxEndTimer =
                        setTimeout(
                            () => {

                                firefoxEndTimer =
                                    null;

                                if (
                                    !isCurrent() ||
                                    finished ||
                                    !started
                                ) {
                                    return;
                                }

                                const finalNow =
                                    Number(
                                        currentAudio.currentTime
                                    );

                                const finalDuration =
                                    Number(
                                        currentAudio.duration
                                    );


                                if (
                                    currentAudio.ended ||
                                    (
                                        Number.isFinite(
                                            finalNow
                                        ) &&
                                        Number.isFinite(
                                            finalDuration
                                        ) &&
                                        finalDuration > 0 &&
                                        finalNow >=
                                            finalDuration -
                                            0.25
                                    )
                                ) {

                                    finishFirefoxAyah();
                                }

                            },
                            remaining
                        );

                },
                Math.max(
                    100,
                    duration * 1000 + 500
                )
            );


        while (
            pauseIndex <
                pausePoints.length &&
            Number(
                pausePoints[pauseIndex]
            ) <= 0
        ) {

            pauseIndex++;
        }

        configureFirefoxNativeAudioSpeed(
            currentAudio,
            1
        );

        endInternalAudioActionSoon();


        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );

        if (shouldAutoPlay) {
            playAgain();
        }
    }


    currentAudio.onplay =
        () => {

            if (!isCurrent()) {
                return;
            }

            started = true;

            setPlaying();
        };


    currentAudio.onplaying =
        () => {

            if (!isCurrent()) {
                return;
            }

            started = true;

            setPlaying();
        };


    currentAudio.onloadedmetadata =
        () => {

            if (!isCurrent()) {
                return;
            }

            setupAudio();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                !isCurrent() ||
                finished ||
                pauseWaiting ||
                !started
            ) {
                return;
            }

            const now =
                Number(
                    currentAudio.currentTime
                );

            const duration =
                Number(
                    currentAudio.duration
                );

            if (
                !Number.isFinite(now) ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }


            if (
                now >=
                    duration - 0.08 &&
                pauseIndex >=
                    pausePoints.length
            ) {

                finishFirefoxAyah();

                return;
            }


            if (
                pauseIndex <
                pausePoints.length
            ) {

                const point =
                    Number(
                        pausePoints[
                            pauseIndex
                        ]
                    );

                if (
                    Number.isFinite(point) &&
                    point > lastPausePoint &&
                    now >= point - 0.025
                ) {

                    waitAtPause(point);
                }
            }
        };


    currentAudio.onended =
        () => {

            if (!isCurrent()) {
                return;
            }

            finishFirefoxAyah();
        };


    currentAudio.onpause =
        () => {

            if (!isCurrent()) {
                return;
            }

            if (
                internalAudioAction ||
                pauseWaiting
            ) {
                return;
            }

            if (state.session.playing) {

                handleExternalAudioStop();
            }
        };


    currentAudio.onseeking =
        () => {

            if (internalSeekAction) {
                return;
            }

            if (internalAudioAction) {
                return;
            }

            if (!isCurrent()) {
                return;
            }

            handleExternalSeekAttempt();
        };


    currentAudio.onerror =
        () => {

            if (!isCurrent()) {
                return;
            }

            clearTimers();

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

            console.error(
                "خطأ في ملف الصوت في Firefox:",
                currentAudio.error
            );

            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


    if (
        Number.isFinite(
            Number(
                currentAudio.duration
            )
        ) &&
        Number(
            currentAudio.duration
        ) > 0
    ) {

        setupAudio();
    }


    const shouldAutoPlay =
        userInitiated ||
        Boolean(
            state.session?.playing
        );

    if (
        shouldAutoPlay &&
        metadataReady
    ) {

        playAgain();
    }
}


/* =========================================================
   Firefox - وضع المعلم
========================================================= */

function startCurrentSegmentFirefoxTeacher(
    token,
    userInitiated = false
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    const reciter =
        state.session.reciter;

    const surahNumber =
        state.session.surah.number;

    const ayahNumber =
        state.session.currentAyah;

    const url =
        `${reciter.audioBaseUrl}/${currentAudioType}/${surahNumber}/${ayahNumber}.mp3`;

    const thisSegmentId =
        ++audioSegmentId;

    const currentAudio =
        audio;

    let metadataReady = false;
    let finished = false;
    let started = false;


    beginInternalAudioAction();

    detachAudioEvents();

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


    try {
        currentAudio.pause();
    } catch (error) {}


    try {

        currentAudio.removeAttribute("src");
        currentAudio.load();

        currentAudio.src = url;
        currentAudio.load();

    } catch (error) {

        endInternalAudioActionSoon();

        console.error(
            "تعذر تحميل ملف Firefox في وضع المعلم:",
            error
        );

        return;
    }


    configureFirefoxNativeAudioSpeed(
        currentAudio,
        1
    );


    function isCurrentSegment() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisSegmentId === audioSegmentId
        );
    }


    function finishOnce() {

        /*
            الحماية الأساسية:
            لا يمكن إنهاء الجزء قبل أن يبدأ الصوت فعلًا.
        */

        if (
            finished ||
            !started ||
            !isCurrentSegment()
        ) {
            return;
        }

        finished = true;

        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();

        handleCurrentSegmentFinished(
            token,
            currentAudio
        );
    }


    function prepareFirefoxTeacherSegment() {

        if (
            !isCurrentSegment() ||
            metadataReady ||
            finished
        ) {
            return;
        }

        const duration =
            Number(
                currentAudio.duration
            );

        /*
            مهم جدًا في Mi-like media engines:
            إذا لم تصبح المدة جاهزة فلا نعتبر الجزء منتهيًا.
        */

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {
            return;
        }

        metadataReady = true;

        sanitizePausePoints(
            duration
        );

        const bounds =
            getSegmentBounds(
                duration
            );

        if (!bounds) {
            return;
        }

        const start =
            Number(bounds.start);

        const end =
            Number(bounds.end);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return;
        }


        if (
            Math.abs(
                currentAudio.currentTime -
                start
            ) > 0.02
        ) {

            internalSeekAction = true;

            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                internalSeekAction =
                    false;

                return;
            }

            setTimeout(
                () => {
                    internalSeekAction =
                        false;
                },
                0
            );
        }


        configureFirefoxNativeAudioSpeed(
            currentAudio,
            1
        );


        const segmentDuration =
            Math.max(
                0,
                end - start
            );


        /*
            لا نبدأ المؤقت إلا بعد onplaying.
            هذا يمنع القفز السريع إذا كان المتصفح
            يرسل metadata قبل بدء الصوت.
        */

        currentAudio._tahfeezSegmentDuration =
            segmentDuration;


        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );


        if (shouldAutoPlay) {
            playAgain();
        }
    }


    function armFirefoxTeacherTimer() {

        if (
            !metadataReady ||
            !started ||
            finished ||
            !isCurrentSegment()
        ) {
            return;
        }

        const segmentDuration =
            Number(
                currentAudio._tahfeezSegmentDuration
            );

        if (
            !Number.isFinite(segmentDuration) ||
            segmentDuration <= 0
        ) {
            return;
        }

        if (segmentTimer) {
            clearTimeout(segmentTimer);
        }

        segmentTimer =
            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !started
                    ) {
                        return;
                    }

                    const now =
                        Number(
                            currentAudio.currentTime
                        );

                    const duration =
                        Number(
                            currentAudio.duration
                        );

                    const bounds =
                        getSegmentBounds(
                            duration
                        );

                    if (
                        bounds &&
                        Number.isFinite(now) &&
                        now >=
                            bounds.end - 0.03
                    ) {

                        finishOnce();
                    }

                },
                Math.max(
                    100,
                    segmentDuration * 1000 + 250
                )
            );
    }


    function playAgain() {

        if (
            !isCurrentSegment() ||
            finished
        ) {
            return;
        }

        let promise = null;

        try {

            promise =
                currentAudio.play();

        } catch (error) {

            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished
                    ) {
                        return;
                    }

                    try {

                        const retry =
                            currentAudio.play();

                        if (
                            retry &&
                            typeof retry.catch ===
                                "function"
                        ) {

                            retry.catch(
                                retryError => {

                                    console.error(
                                        "تعذر تشغيل Firefox في وضع المعلم:",
                                        retryError
                                    );

                                    if (
                                        isCurrentSegment()
                                    ) {

                                        state.session.playing =
                                            false;

                                        playPauseButton.textContent =
                                            "▶️";

                                        setMediaSessionNone();
                                    }
                                }
                            );
                        }

                    } catch (retryError) {

                        console.error(
                            "تعذر تشغيل Firefox في وضع المعلم:",
                            retryError
                        );

                        if (
                            isCurrentSegment()
                        ) {

                            state.session.playing =
                                false;

                            playPauseButton.textContent =
                                "▶️";

                            setMediaSessionNone();
                        }
                    }

                },
                100
            );

            return;
        }


        if (
            promise &&
            typeof promise.catch ===
                "function"
        ) {

            promise.catch(
                error => {

                    if (!isCurrentSegment()) {
                        return;
                    }

                    if (
                        error &&
                        (
                            error.name ===
                                "AbortError" ||
                            error.name ===
                                "NotAllowedError"
                        )
                    ) {

                        setTimeout(
                            () => {
                                playAgain();
                            },
                            100
                        );

                        return;
                    }

                    console.error(
                        "تعذر تشغيل Firefox في وضع المعلم:",
                        error
                    );

                    state.session.playing =
                        false;

                    playPauseButton.textContent =
                        "▶️";

                    setMediaSessionNone();
                }
            );
        }
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            started = true;

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armFirefoxTeacherTimer();

            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onplaying =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            started = true;

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armFirefoxTeacherTimer();

            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onloadedmetadata =
        () => {

            prepareFirefoxTeacherSegment();
        };


    currentAudio.ondurationchange =
        () => {

            prepareFirefoxTeacherSegment();
        };


    currentAudio.onloadeddata =
        () => {

            prepareFirefoxTeacherSegment();
        };


    currentAudio.oncanplay =
        () => {

            prepareFirefoxTeacherSegment();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !started ||
                !isCurrentSegment()
            ) {
                return;
            }

            const duration =
                Number(
                    currentAudio.duration
                );

            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }

            const bounds =
                getSegmentBounds(
                    duration
                );

            if (!bounds) {
                return;
            }

            if (
                currentAudio.currentTime >=
                bounds.end - 0.02
            ) {

                finishOnce();
            }
        };


    currentAudio.onended =
        () => {

            if (
                finished ||
                !started ||
                !isCurrentSegment()
            ) {
                return;
            }

            finishOnce();
        };


    currentAudio.onpause =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            if (internalAudioAction) {
                return;
            }

            if (state.session.playing) {

                handleExternalAudioStop();
            }
        };


    currentAudio.onseeking =
        () => {

            if (internalSeekAction) {
                return;
            }

            if (internalAudioAction) {
                return;
            }

            if (!isCurrentSegment()) {
                return;
            }

            handleExternalSeekAttempt();
        };


    currentAudio.onerror =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            if (segmentTimer) {

                clearTimeout(
                    segmentTimer
                );

                segmentTimer = null;
            }

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

            console.error(
                "خطأ في ملف الصوت في Firefox - وضع المعلم:",
                currentAudio.error
            );

            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


    if (
        Number.isFinite(
            Number(
                currentAudio.duration
            )
        ) &&
        Number(
            currentAudio.duration
        ) > 0
    ) {

        prepareFirefoxTeacherSegment();
    }
}


/* =========================================================
   تشغيل الجزء - باقي المتصفحات
========================================================= */

function startCurrentSegmentOtherBrowsers(
    token,
    userInitiated = false
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    const reciter =
        state.session.reciter;

    const surahNumber =
        state.session.surah.number;

    const ayahNumber =
        state.session.currentAyah;

    const url =
        `${reciter.audioBaseUrl}/${currentAudioType}/${surahNumber}/${ayahNumber}.mp3`;

    const thisSegmentId =
        ++audioSegmentId;

    const currentAudio =
        audio;

    beginInternalAudioAction();

    detachAudioEvents();

    try {
        currentAudio.pause();
    } catch (error) {}

    try {
        currentAudio.removeAttribute("src");
    } catch (error) {}

    try {
        currentAudio.load();
    } catch (error) {}

    currentAudio.src =
        url;

    const actualSpeed =
        Math.min(
            1.25,
            Math.max(
                0.75,
                Number(
                    state.session.speed
                ) || 1
            )
        );

    configureAudioSpeed(
        currentAudio,
        actualSpeed
    );

    endInternalAudioActionSoon();

    let finished = false;

    /*
        CODE 25:
        لا نسمح بأي انتقال قبل أن يبدأ الصوت فعلًا.
    */

    let audioActuallyStarted = false;

    let metadataReady = false;

    let preparedSegmentDuration = 0;

    let segmentStartedAt = 0;


    function isCurrentSegment() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisSegmentId === audioSegmentId
        );
    }


    function finishOnce() {

        if (
            finished ||
            !isCurrentSegment()
        ) {
            return;
        }

        /*
            حماية Mi Browser:
            onloadedmetadata / onended / timer قد يحدث
            قبل أن يبدأ الصوت الحقيقي.

            في هذه الحالة لا ننتقل إلى الآية التالية.
        */

        if (!audioActuallyStarted) {
            return;
        }

        /*
            حماية إضافية:
            إذا كان المتصفح يحاول إنهاء الجزء مباشرة بعد
            onplaying بسبب حدث غير صحيح، ننتظر الحد الأدنى
            من زمن التشغيل الحقيقي.
        */

        if (
            segmentStartedAt > 0 &&
            preparedSegmentDuration > 0
        ) {

            const expectedWallTime =
                (
                    preparedSegmentDuration /
                    actualSpeed
                ) * 1000;

            const elapsed =
                performance.now() -
                segmentStartedAt;

            const minimumAllowedTime =
                Math.max(
                    120,
                    expectedWallTime * 0.35
                );

            if (
                elapsed <
                minimumAllowedTime
            ) {
                return;
            }
        }

        finished = true;

        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }

        if (!isCurrentSegment()) {
            return;
        }

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();

        handleCurrentSegmentFinished(
            token,
            currentAudio
        );
    }


    function prepareSegment() {

        if (
            !isCurrentSegment() ||
            metadataReady ||
            finished
        ) {
            return;
        }

        const duration =
            Number(
                currentAudio.duration
            );

        /*
            أهم إصلاح في CODE 25:

            لا ننادي finishOnce() عندما تكون duration
            غير جاهزة.

            Mi Browser قد يرسل loadedmetadata قبل أن
            تصبح duration رقمًا صالحًا، وكان هذا يؤدي
            إلى انتقال الآية وراء الآية بسرعة.
        */

        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {
            return;
        }

        sanitizePausePoints(
            duration
        );

        const bounds =
            getSegmentBounds(
                duration
            );

        if (!bounds) {
            return;
        }

        const start =
            Number(bounds.start);

        const end =
            Number(bounds.end);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return;
        }

        metadataReady = true;

        preparedSegmentDuration =
            Math.max(
                0,
                end - start
            );


        if (
            Math.abs(
                currentAudio.currentTime -
                start
            ) > 0.02
        ) {

            internalSeekAction = true;

            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                internalSeekAction = false;

                return;
            }

            setTimeout(
                () => {

                    internalSeekAction =
                        false;

                },
                0
            );
        }

        configureAudioSpeed(
            currentAudio,
            actualSpeed
        );


        /*
            لا نضع timer هنا.

            سيتم وضعه بعد onplaying فقط.
        */

        if (
            userInitiated &&
            segmentIndex === 0 &&
            currentAudioType === "normal"
        ) {
            return;
        }

        if (!currentAudio.paused) {
            return;
        }

        playSegment();
    }


    function armSegmentTimer() {

        if (
            !isCurrentSegment() ||
            finished ||
            !audioActuallyStarted ||
            !metadataReady
        ) {
            return;
        }

        const segmentDuration =
            Number(
                preparedSegmentDuration
            );

        if (
            !Number.isFinite(segmentDuration) ||
            segmentDuration <= 0
        ) {
            return;
        }

        const wallTime =
            (
                segmentDuration /
                actualSpeed
            ) * 1000;

        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }

        segmentTimer =
            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !audioActuallyStarted
                    ) {
                        return;
                    }

                    const duration =
                        Number(
                            currentAudio.duration
                        );

                    const bounds =
                        getSegmentBounds(
                            duration
                        );

                    if (!bounds) {
                        return;
                    }

                    const now =
                        Number(
                            currentAudio.currentTime
                        );

                    /*
                        لا ننهي الجزء إلا إذا وصل الصوت فعلًا
                        إلى نهايته.
                    */

                    if (
                        Number.isFinite(now) &&
                        now >=
                            bounds.end - 0.03
                    ) {

                        finishOnce();

                    } else {

                        /*
                            إذا انتهى المؤقت ولكن currentTime
                            لم يصل للنهاية، نعطي المتصفح فرصة
                            أخرى بدل الانتقال مباشرة.
                        */

                        armSegmentTimer();
                    }

                },
                Math.max(
                    150,
                    wallTime + 180
                )
            );
    }


    function playSegment() {

        if (
            !isCurrentSegment() ||
            finished
        ) {
            return;
        }

        let playPromise;

        try {

            playPromise =
                currentAudio.play();

        } catch (error) {

            console.error(
                "تعذر تشغيل الجزء:",
                error
            );

            if (!isCurrentSegment()) {
                return;
            }

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

            return;
        }

        if (
            playPromise &&
            typeof playPromise.catch ===
                "function"
        ) {

            playPromise.catch(
                error => {

                    console.error(
                        "تعذر تشغيل الجزء بعد metadata:",
                        error
                    );

                    if (!isCurrentSegment()) {
                        return;
                    }

                    state.session.playing =
                        false;

                    playPauseButton.textContent =
                        "▶️";

                    setMediaSessionNone();

                    if (
                        error &&
                        error.name ===
                            "NotAllowedError"
                    ) {

                        showAvailability(
                            "تعذر متابعة تشغيل الصوت."
                        );
                    }
                }
            );
        }
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            audioActuallyStarted = true;

            segmentStartedAt =
                performance.now();

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armSegmentTimer();

            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onplaying =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            audioActuallyStarted = true;

            if (!segmentStartedAt) {

                segmentStartedAt =
                    performance.now();
            }

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armSegmentTimer();

            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onloadedmetadata =
        () => {

            prepareSegment();
        };


    /*
        Mi Browser وبعض المتصفحات قد تحتاج حدثًا لاحقًا
        حتى تصبح duration صالحة.
    */

    currentAudio.ondurationchange =
        () => {

            prepareSegment();
        };


    currentAudio.onloadeddata =
        () => {

            prepareSegment();
        };


    currentAudio.oncanplay =
        () => {

            prepareSegment();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !isCurrentSegment() ||
                !audioActuallyStarted
            ) {
                return;
            }

            const duration =
                Number(
                    currentAudio.duration
                );

            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }

            const bounds =
                getSegmentBounds(
                    duration
                );

            if (!bounds) {
                return;
            }

            const now =
                Number(
                    currentAudio.currentTime
                );

            if (
                !Number.isFinite(now)
            ) {
                return;
            }

            if (
                now >=
                bounds.end - 0.015
            ) {

                finishOnce();
            }
        };


    currentAudio.onseeking =
        () => {

            if (internalSeekAction) {
                return;
            }

            if (internalAudioAction) {
                return;
            }

            if (!isCurrentSegment()) {
                return;
            }

            handleExternalSeekAttempt();
        };


    currentAudio.onended =
        () => {

            if (
                finished ||
                !audioActuallyStarted ||
                !isCurrentSegment()
            ) {
                return;
            }

            /*
                onended الآن لا يكفي وحده.
                نتأكد أن currentTime وصل بالفعل إلى نهاية الجزء.
            */

            const duration =
                Number(
                    currentAudio.duration
                );

            const bounds =
                getSegmentBounds(
                    duration
                );

            const now =
                Number(
                    currentAudio.currentTime
                );

            if (
                bounds &&
                Number.isFinite(now) &&
                now >=
                    bounds.end - 0.08
            ) {

                finishOnce();
            }
        };


    currentAudio.onpause =
        () => {

            if (internalAudioAction) {
                return;
            }

            if (!isCurrentSegment()) {
                return;
            }

            if (state.session.playing) {
                handleExternalAudioStop();
            }
        };


    currentAudio.onerror =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            if (segmentTimer) {

                clearTimeout(
                    segmentTimer
                );

                segmentTimer = null;
            }

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

            console.error(
                "خطأ في ملف الصوت:",
                currentAudio.error
            );

            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


    /*
        أول تشغيل عند ضغط المستخدم.
        نبدأ play مباشرة حتى لا تمنع المتصفحات التشغيل.
    */

    if (
        userInitiated &&
        segmentIndex === 0 &&
        currentAudioType === "normal"
    ) {

        playSegment();
    }


    /*
        إذا كانت metadata جاهزة بالفعل.
    */

    if (
        Number.isFinite(
            Number(
                currentAudio.duration
            )
        ) &&
        Number(
            currentAudio.duration
        ) > 0
    ) {

        prepareSegment();
    }
}


/* =========================================================
   انتهاء الجزء
========================================================= */

function handleCurrentSegmentFinished(
    token,
    finishedAudio
) {

    if (
        !state.session ||
        token !== playbackToken ||
        audio !== finishedAudio
    ) {
        return;
    }

    const duration =
        Number(
            finishedAudio.duration
        );

    const bounds =
        getSegmentBounds(
            duration
        );

    if (!bounds) {

        finishAyah(token);

        return;
    }

    const segmentDuration =
        Math.max(
            0,
            bounds.end - bounds.start
        );

    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";

        startCurrentSegment(
            token,
            false
        );

        return;
    }

    currentAudioType =
        "normal";

    segmentIndex++;

    waitAfterSegment(
        segmentDuration,
        token
    );
}


/* =========================================================
   الانتظار
========================================================= */

function waitAfterSegment(
    segmentDuration,
    token
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    const multiplier =
        Number(
            state.session.wait
        );

    if (
        !Number.isFinite(multiplier) ||
        multiplier <= 0 ||
        segmentDuration <= 0
    ) {

        continueAfterWait(token);

        return;
    }

    const waitTime =
        segmentDuration *
        multiplier *
        1000;

    state.session.playing = true;

    playPauseButton.textContent =
        "⏸️";

    setMediaSessionNone();

    if (waitTimer) {
        clearTimeout(waitTimer);
    }

    waitTimer =
        setTimeout(
            () => {

                waitTimer = null;

                if (
                    !state.session ||
                    token !== playbackToken
                ) {
                    return;
                }

                continueAfterWait(token);

            },
            waitTime
        );
}


/* =========================================================
   بعد الانتظار
========================================================= */

function continueAfterWait(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    const totalSegments =
        pausePoints.length + 1;

    if (
        segmentIndex <
        totalSegments
    ) {

        currentAudioType =
            "normal";

        startCurrentSegment(
            token,
            false
        );

        return;
    }

    finishAyah(token);
}


/* =========================================================
   انتهاء الآية
========================================================= */

function finishAyah(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    if (
        state.session.currentAyahRepeat <
        state.session.ayahRepeat
    ) {

        state.session.currentAyahRepeat++;

        updateSessionInfo();

        playCurrentAyah(
            false,
            true
        );

        return;
    }

    state.session.currentAyahRepeat =
        1;

    if (
        state.session.currentAyah <
        state.session.toAyah
    ) {

        state.session.currentAyah++;

        renderCurrentAyah();

        updateSessionInfo();

        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

        prepareNextAyahAndPlay(token);

        return;
    }

    if (
        state.session.currentBlockRepeat <
        state.session.blockRepeat
    ) {

        state.session.currentBlockRepeat++;

        state.session.currentAyah =
            state.session.fromAyah;

        state.session.currentAyahRepeat =
            1;

        renderCurrentAyah();

        updateSessionInfo();

        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

        prepareNextAyahAndPlay(token);

        return;
    }

    finishMemorization();
}


/* =========================================================
   تجهيز الآية التالية
========================================================= */

async function prepareNextAyahAndPlay(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    state.session.playing = true;

    playPauseButton.textContent =
        "⏸️";

    await loadPausePoints();

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    playCurrentAyah(
        false,
        true
    );
}


/* =========================================================
   انتهاء الجلسة
========================================================= */

function finishMemorization() {

    stopPlayback();

    completionMessage.classList.remove(
        "hidden"
    );

    if (state.session) {
        state.session.playing = false;
    }

    playPauseButton.textContent =
        "▶️";

    setMediaSessionNone();
}


/* =========================================================
   زر الإيقاف المؤقت
========================================================= */

function pausePlayback() {

    if (!state.session) {
        return;
    }

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

    playbackToken++;

    resetAudioElement();

    segmentIndex = 0;

    currentAudioType = "normal";

    state.session.playing = false;

    playPauseButton.textContent =
        "▶️";

    setMediaSessionNone();
}


/* =========================================================
   زر الإيقاف الكامل
========================================================= */

function stopPlayback() {

    playbackToken++;

    clearPlaybackResources();

    segmentIndex = 0;

    currentAudioType = "normal";

    if (state.session) {
        state.session.playing = false;
    }

    playPauseButton.textContent =
        "▶️";

    setMediaSessionNone();
}


/* =========================================================
   العودة للإعدادات
========================================================= */

playerSettingsButton.addEventListener(
    "click",
    () => {

        stopPlayback();

        memorizationScreen.classList.add(
            "hidden"
        );

        setupScreen.classList.remove(
            "hidden"
        );
    }
);


/* =========================================================
   حفظ الإعدادات
========================================================= */

function saveSettings() {

    const settings = {

        reciter:
            reciterSelect.value,

        surah:
            surahSelect.value,

        fromAyah:
            fromAyah.value,

        toAyah:
            toAyah.value,

        speed:
            speedRange.value,

        ayahRepeat:
            ayahRepeat.value,

        blockRepeat:
            blockRepeat.value,

        wait:
            waitSelect.value,

        teacherMode:
            teacherMode.checked
    };

    localStorage.setItem(
        "tahfeez-settings",
        JSON.stringify(settings)
    );
}


/* =========================================================
   استعادة الإعدادات
========================================================= */

function restoreSettings() {

    const saved =
        localStorage.getItem(
            "tahfeez-settings"
        );

    if (!saved) {
        return;
    }

    try {

        const settings =
            JSON.parse(saved);

        if (settings.reciter) {

            reciterSelect.value =
                settings.reciter;

            state.selectedReciter =
                state.reciters.find(
                    reciter =>
                        reciter.id ===
                        settings.reciter
                ) || null;

            populateSurahs();
        }

        updateTeacherMode();

        if (settings.surah) {

            surahSelect.value =
                settings.surah;

            state.selectedSurah =
                state.surahs.find(
                    surah =>
                        String(surah.number) ===
                        String(settings.surah)
                ) || null;
        }

        if (state.selectedSurah) {

            const available =
                getAvailableSurah(
                    state.selectedSurah.number
                );

            if (available) {

                enableAyahInputs();

                fromAyah.min =
                    available.from;

                fromAyah.max =
                    available.to;

                toAyah.min =
                    available.from;

                toAyah.max =
                    available.to;

                fromAyah.value =
                    settings.fromAyah ||
                    available.from;

                toAyah.value =
                    settings.toAyah ||
                    available.to;

            } else {

                disableAyahInputs();

                showAvailability(
                    `سورة ${state.selectedSurah.name} غير متوفرة بصوت ${state.selectedReciter.name} حاليًا.`
                );
            }
        }

        if (
            settings.speed !==
            undefined
        ) {

            speedRange.value =
                settings.speed;

            speedValue.textContent =
                `${Number(
                    settings.speed
                ).toFixed(2)}×`;
        }

        if (
            settings.ayahRepeat !==
            undefined
        ) {

            ayahRepeat.value =
                settings.ayahRepeat;
        }

        if (
            settings.blockRepeat !==
            undefined
        ) {

            blockRepeat.value =
                settings.blockRepeat;
        }

        if (
            settings.wait !==
            undefined
        ) {

            waitSelect.value =
                settings.wait;
        }

        if (
            settings.teacherMode === true &&
            state.selectedReciter?.teacherMode
        ) {

            teacherMode.checked = true;
        }

        validateSetup();

    } catch (error) {

        console.error(
            "تعذر استعادة الإعدادات",
            error
        );
    }
}


/* =========================================================
   أدوات
========================================================= */

function resetAyahInputs() {

    fromAyah.value = 1;

    toAyah.value = 1;

    disableAyahInputs();
}


function disableAyahInputs() {

    fromAyah.disabled = true;

    toAyah.disabled = true;
}


function enableAyahInputs() {

    fromAyah.disabled = false;

    toAyah.disabled = false;
}


function showAvailability(message) {

    availabilityMessage.textContent =
        message;

    availabilityMessage.classList.remove(
        "hidden"
    );
}


function hideAvailability() {

    availabilityMessage.textContent =
        "";

    availabilityMessage.classList.add(
        "hidden"
    );
}


/* =========================================================
   بدء التطبيق
========================================================= */

loadData();
