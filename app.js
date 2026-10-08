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

const CODE_VERSION = "CODE 32";


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
            fetch("./data/quran-kareem.json"),
            fetch("./data/reciters.json")
        ]);

        if (!quranResponse.ok) {
            throw new Error(
                "تعذر تحميل quran-kareem.json"
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

        if (
            !quranData ||
            !Array.isArray(quranData.surahs)
        ) {
            throw new Error(
                "بنية ملف القرآن غير صحيحة"
            );
        }

        state.quran =
            quranData.surahs.map(surah => ({
                number: Number(surah.number),
                name: surah.name_ar,
                ayahCount: surah.ayahs.length,

                ayahs: surah.ayahs.map(ayah => ({
                    number: Number(ayah.ayah),
                    text: ayah.text
                }))
            }));

        state.surahs = state.quran;

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

        /*
            إصلاح CODE 31:
            قيمة select تكون نصًا دائمًا،
            بينما id في reciters.json قد يكون رقمًا.
        */
        state.selectedReciter =
            state.reciters.find(
                reciter =>
                    String(reciter.id) ===
                    String(id)
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

    let waitingForSeek = false;
    let seekTarget = 0;


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


    function playAgain() {

        if (
            !isCurrentSegment() ||
            finished ||
            waitingForSeek
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
                        finished ||
                        waitingForSeek
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


    function prepareTeacherSegment() {

        if (
            !isCurrentSegment() ||
            finished ||
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

        if (
            Math.abs(
                currentAudio.currentTime -
                start
            ) > 0.02
        ) {

            waitingForSeek = true;
            seekTarget = start;

            internalSeekAction = true;

            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                waitingForSeek = false;
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

            return;
        }

        const segmentDuration =
            Math.max(
                0,
                end - start
            );

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


    function continueAfterTeacherSeek() {

        if (
            !isCurrentSegment() ||
            finished
        ) {
            return;
        }

        waitingForSeek = false;

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

        const start =
            Number(bounds.start);

        const end =
            Number(bounds.end);

        const actualPosition =
            Number(
                currentAudio.currentTime
            );

        /*
            في Mi/Firefox-like engines لا نثق في حدث
            seeked وحده إذا لم يصل currentTime للمكان المطلوب.
        */

        if (
            !Number.isFinite(actualPosition) ||
            Math.abs(
                actualPosition -
                seekTarget
            ) > 0.15
        ) {

            waitingForSeek = true;

            internalSeekAction = true;

            try {
                currentAudio.currentTime =
                    seekTarget;
            } catch (error) {}

            setTimeout(
                () => {
                    internalSeekAction =
                        false;
                },
                0
            );

            return;
        }

        currentAudio._tahfeezSegmentDuration =
            Math.max(
                0,
                end - start
            );

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
            waitingForSeek ||
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

            prepareTeacherSegment();
        };


    currentAudio.ondurationchange =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.onloadeddata =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.oncanplay =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.onseeked =
        () => {

            if (
                !isCurrentSegment() ||
                !waitingForSeek
            ) {
                return;
            }

            continueAfterTeacherSeek();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !started ||
                waitingForSeek ||
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

            const now =
                Number(
                    currentAudio.currentTime
                );

            if (
                Number.isFinite(now) &&
                now >=
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
                waitingForSeek ||
                !isCurrentSegment()
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

            if (!isCurrentSegment()) {
                return;
            }

            if (
                internalAudioAction ||
                waitingForSeek
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

        prepareTeacherSegment();
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


    /* =====================================================
       MI BROWSER - وضع المعلم
       نستخدم نظامًا خاصًا لأن Mi Browser قد يبدأ ملف
       الطفل من الثانية 0 قبل اكتمال seek.
    ===================================================== */

    if (
        isMiBrowser &&
        state.session.teacherMode
    ) {

        startCurrentSegmentMiBrowserTeacher(
            token,
            userInitiated
        );

        return;
    }


    /* =====================================================
       باقي المتصفحات
    ===================================================== */

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

        if (!audioActuallyStarted) {
            return;
        }

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

            clearTimeout(segmentTimer);

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

                    if (
                        Number.isFinite(now) &&
                        now >=
                            bounds.end - 0.03
                    ) {

                        finishOnce();

                    } else {

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


    if (
        userInitiated &&
        segmentIndex === 0 &&
        currentAudioType === "normal"
    ) {

        playSegment();
    }


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
   MI BROWSER - وضع المعلم
========================================================= */

function startCurrentSegmentMiBrowserTeacher(
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


    let finished = false;

    let started = false;

    let metadataReady = false;

    let waitingForSeek = false;

    let seekTarget = 0;

    let preparedStart = 0;

    let preparedEnd = 0;

    let segmentStartedAt = 0;


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


    try {
        currentAudio.pause();
    } catch (error) {}


    try {

        currentAudio.removeAttribute("src");
        currentAudio.load();

        currentAudio.src =
            url;

        currentAudio.load();

    } catch (error) {

        endInternalAudioActionSoon();

        console.error(
            "تعذر تحميل ملف الصوت في Mi Browser:",
            error
        );

        return;
    }


    configureAudioSpeed(
        currentAudio,
        actualSpeed
    );


    endInternalAudioActionSoon();


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
            !started ||
            waitingForSeek ||
            !isCurrentSegment()
        ) {
            return;
        }


        /*
            لا نسمح بالانتقال إلا إذا كان currentTime
            وصل فعلًا إلى نهاية الجزء الحالي.
        */

        const now =
            Number(
                currentAudio.currentTime
            );


        if (
            !Number.isFinite(now) ||
            !Number.isFinite(preparedEnd)
        ) {
            return;
        }


        if (
            now <
            preparedEnd - 0.04
        ) {
            return;
        }


        /*
            حماية من إنهاء الجزء فورًا بعد onplaying.
        */

        if (segmentStartedAt > 0) {

            const expectedDuration =
                Math.max(
                    0,
                    preparedEnd -
                    preparedStart
                );


            const expectedWallTime =
                (
                    expectedDuration /
                    actualSpeed
                ) * 1000;


            const elapsed =
                performance.now() -
                segmentStartedAt;


            const minimumAllowedTime =
                Math.max(
                    120,
                    expectedWallTime * 0.30
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


    function playWhenReady() {

        if (
            !isCurrentSegment() ||
            finished ||
            waitingForSeek
        ) {
            return;
        }


        if (
            !metadataReady
        ) {
            return;
        }


        let promise;


        try {

            promise =
                currentAudio.play();

        } catch (error) {

            console.error(
                "تعذر تشغيل Mi Browser:",
                error
            );

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

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


                    console.error(
                        "تعذر تشغيل Mi Browser:",
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


    function prepareSegment() {

        if (
            !isCurrentSegment() ||
            finished
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
            Number(
                bounds.start
            );


        const end =
            Number(
                bounds.end
            );


        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return;
        }


        preparedStart =
            start;


        preparedEnd =
            end;


        metadataReady =
            true;


        configureAudioSpeed(
            currentAudio,
            actualSpeed
        );


        /*
            =================================================
            أهم جزء في إصلاح Mi Browser:

            لا نقول للمتصفح:
                currentTime = start
                ثم play مباشرة.

            بل:
                1. نوقف التشغيل.
                2. نطلب seek.
                3. ننتظر seeked.
                4. نتأكد أن currentTime أصبح قريبًا
                   من start.
                5. بعدها فقط نشغل.
            =================================================
        */


        const currentPosition =
            Number(
                currentAudio.currentTime
            );


        if (
            Math.abs(
                currentPosition -
                start
            ) > 0.03
        ) {

            waitingForSeek =
                true;


            seekTarget =
                start;


            internalSeekAction =
                true;


            try {

                currentAudio.pause();

            } catch (error) {}


            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                waitingForSeek =
                    false;

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


            /*
                بعض إصدارات Mi Browser قد لا ترسل seeked
                في كل مرة؛ لذلك نتحقق مرة أخرى قليلًا
                بعد ذلك.
            */

            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !waitingForSeek
                    ) {
                        return;
                    }


                    const position =
                        Number(
                            currentAudio.currentTime
                        );


                    if (
                        Number.isFinite(position) &&
                        Math.abs(
                            position -
                            seekTarget
                        ) <= 0.15
                    ) {

                        waitingForSeek =
                            false;

                        playWhenReady();

                    }

                },
                80
            );


            return;
        }


        waitingForSeek =
            false;


        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );


        if (shouldAutoPlay) {

            playWhenReady();

        }
    }


    function armSegmentTimer() {

        if (
            !isCurrentSegment() ||
            finished ||
            !started ||
            waitingForSeek ||
            !metadataReady
        ) {
            return;
        }


        const segmentDuration =
            Math.max(
                0,
                preparedEnd -
                preparedStart
            );


        if (
            !Number.isFinite(segmentDuration) ||
            segmentDuration <= 0
        ) {
            return;
        }


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }


        const wallTime =
            (
                segmentDuration /
                actualSpeed
            ) * 1000;


        segmentTimer =
            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !started ||
                        waitingForSeek
                    ) {
                        return;
                    }


                    const now =
                        Number(
                            currentAudio.currentTime
                        );


                    if (
                        Number.isFinite(now) &&
                        now >=
                            preparedEnd - 0.04
                    ) {

                        finishOnce();

                    } else {

                        armSegmentTimer();

                    }

                },
                Math.max(
                    150,
                    wallTime + 220
                )
            );
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            started =
                true;


            segmentStartedAt =
                performance.now();


            state.session.playing =
                true;


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


            started =
                true;


            if (!segmentStartedAt) {

                segmentStartedAt =
                    performance.now();

            }


            state.session.playing =
                true;


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


    currentAudio.onseeked =
        () => {

            if (
                !isCurrentSegment() ||
                !waitingForSeek
            ) {
                return;
            }


            const position =
                Number(
                    currentAudio.currentTime
                );


            if (
                !Number.isFinite(position)
            ) {
                return;
            }


            /*
                لا نعتبر seek ناجحًا إلا إذا وصلنا
                فعلًا إلى نقطة البداية المطلوبة.
            */

            if (
                Math.abs(
                    position -
                    seekTarget
                ) > 0.15
            ) {

                return;
            }


            waitingForSeek =
                false;


            internalSeekAction =
                true;


            setTimeout(
                () => {

                    internalSeekAction =
                        false;

                },
                0
            );


            playWhenReady();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !started ||
                waitingForSeek ||
                !isCurrentSegment()
            ) {
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


            /*
                لا نعتمد على duration هنا.
                نحن نستخدم preparedEnd الخاصة بالجزء.
            */

            if (
                now >=
                preparedEnd - 0.02
            ) {

                finishOnce();

            }
        };


    currentAudio.onended =
        () => {

            if (
                finished ||
                !started ||
                waitingForSeek ||
                !isCurrentSegment()
            ) {
                return;
            }


            const now =
                Number(
                    currentAudio.currentTime
                );


            /*
                إذا انتهى الملف كاملًا قبل نقطة الوقف،
                لا نقفز للجزء التالي بشكل خاطئ.
            */

            if (
                Number.isFinite(now) &&
                now >=
                    preparedEnd - 0.08
            ) {

                finishOnce();

            }

        };


    currentAudio.onpause =
        () => {

            if (
                internalAudioAction ||
                waitingForSeek
            ) {
                return;
            }


            if (!isCurrentSegment()) {
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
                "خطأ في ملف الصوت في Mi Browser:",
                currentAudio.error
            );


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


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


    /*
        عند الضغط الأول على التشغيل:
        prepareSegment ستقوم بالتشغيل بعد التأكد
        من الموضع الصحيح.
    */

    if (
        userInitiated &&
        segmentIndex === 0 &&
        currentAudioType === "normal"
    ) {

        setTimeout(
            () => {

                if (
                    !isCurrentSegment() ||
                    finished
                ) {
                    return;
                }


                if (
                    metadataReady &&
                    !waitingForSeek &&
                    currentAudio.paused
                ) {

                    playWhenReady();

                }

            },
            0
        );
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

            /*
                إصلاح CODE 31:
                localStorage يخزن القيمة كنص،
                بينما id في reciters.json قد يكون رقمًا.
            */
            state.selectedReciter =
                state.reciters.find(
                    reciter =>
                        String(reciter.id) ===
                        String(settings.reciter)
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
