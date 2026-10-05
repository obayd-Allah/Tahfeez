const state = {
    quran: [],
    surahs: [],
    reciters: [],

    selectedReciter: null,
    selectedSurah: null,

    session: null
};


/* =========================================================
   نظام الصوت
========================================================= */

/*
    نستخدم عنصر Audio واحد فقط طوال جلسة التحفيظ.

    مهم:
    لا ننشئ Audio جديدًا عند كل pause point.

    Firefox وبعض المتصفحات الأخرى قد تعتبر Audio الجديد
    تشغيلًا جديدًا يحتاج إلى تفاعل المستخدم.
*/
const audio = new Audio();

audio.preload = "auto";
audio.controls = false;

try {
    audio.disableRemotePlayback = true;
} catch (error) {}


/*
    رقم يميز كل مقطع صوتي.

    إذا وصل حدث قديم من مقطع سابق،
    يتم تجاهله.
*/
let audioSegmentId = 0;


/*
    هذه القيمة لا تعني أن المستخدم ضغط Pause.

    هي فقط تعني أن التطبيق نفسه يقوم الآن
    بعملية داخلية على عنصر الصوت.
*/
let internalAudioAction = false;


/*
    عداد لحماية العمليات الداخلية المتداخلة.

    أفضل من الاعتماد على true/false فقط،
    لأن تغيير src قد ينتج أكثر من حدث.
*/
let internalAudioActionDepth = 0;


/*
    حماية تغيير currentTime الذي يقوم به التطبيق.
*/
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

let playbackToken = 0;


/* =========================================================
   أدوات العمليات الداخلية على Audio
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


/*
    إزالة جميع أحداث عنصر الصوت.

    نستخدمها قبل تغيير src أو تنظيف العنصر.
*/
function detachAudioEvents() {

    audio.onplay = null;
    audio.onplaying = null;
    audio.onloadedmetadata = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    audio.onpause = null;
    audio.onemptied = null;
    audio.onseeking = null;
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

        navigator.mediaSession.playbackState =
            "none";

    } catch (error) {

        console.warn(
            "تعذر ضبط Media Session:",
            error
        );
    }
}


/*
    أوامر شريط النظام.
*/
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

        } catch (error) {

            console.warn(
                "زر stop غير مدعوم:",
                error
            );
        }


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
   حماية محاولة تغيير الموضع
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
            quranData.map(surah => ({

                number:
                    surah.id,

                name:
                    surah.name,

                ayahCount:
                    surah.total_verses,

                ayahs:
                    surah.verses.map(ayah => ({

                        number:
                            ayah.id,

                        text:
                            ayah.text
                    }))
            }));


        state.surahs =
            state.quran;


        populateReciters();

        restoreSettings();


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
        const number of
        Object.keys(availableSurahs)
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

        from =
            available.from;
    }


    if (
        !Number.isFinite(to) ||
        to < available.from
    ) {

        to =
            available.from;
    }


    if (from > available.to) {

        from =
            available.to;
    }


    if (to > available.to) {

        to =
            available.to;
    }


    if (to < from) {

        to =
            from;
    }


    fromAyah.value =
        from;

    toAyah.value =
        to;


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


        /*
            إذا كان الصوت يعمل،
            نغير السرعة مباشرة على نفس العنصر.

            لا نعيد تحميل الملف.
        */

        if (
            state.session &&
            state.session.playing &&
            Number.isFinite(speed)
        ) {

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


    teacherMode.checked =
        false;


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

        startButton.disabled =
            true;

        return;
    }


    const available =
        getAvailableSurah(
            state.selectedSurah.number
        );


    if (!available) {

        startButton.disabled =
            true;

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
            Number(speedRange.value),

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

    setupScreen.classList.add(
        "hidden"
    );


    memorizationScreen.classList.remove(
        "hidden"
    );


    completionMessage.classList.add(
        "hidden"
    );


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

            stopPlayback();


            state.session.currentAyah--;

            state.session.currentAyahRepeat =
                1;


            loadPausePoints();


            renderCurrentAyah();

            updateSessionInfo();
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

            stopPlayback();


            state.session.currentAyah++;

            state.session.currentAyahRepeat =
                1;


            loadPausePoints();


            renderCurrentAyah();

            updateSessionInfo();
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

            /*
                مهم:

                لا يوجد await هنا.

                حتى يصل أول play()
                مباشرة من ضغطة المستخدم.
            */

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


    if (
        pausePointsCache.has(cacheKey)
    ) {

        pausePoints =
            [
                ...pausePointsCache.get(
                    cacheKey
                )
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
                        (a, b) =>
                            a - b
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

    /*
        نزيد رقم المقطع حتى تصبح أي أحداث قديمة
        غير صالحة.
    */

    audioSegmentId++;


    beginInternalAudioAction();


    /*
        نفصل الأحداث أولًا.

        هذا مهم جدًا.

        لأن pause() و load() قد يطلقان أحداثًا
        بعد استدعائهما.
    */

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


    resetAudioElement();


    setMediaSessionNone();
}


/* =========================================================
   تشغيل الآية
========================================================= */

function playCurrentAyah(
    userInitiated = false
) {

    if (!state.session) {
        return;
    }


    playbackToken++;

    const token =
        playbackToken;


    clearPlaybackResources();


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


    segmentIndex =
        0;


    currentAudioType =
        "normal";


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
            Math.max(
                0,
                start
            ),

        end:
            Math.min(
                duration,
                end
            )
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
                (a, b) =>
                    a - b
            );
}


/* =========================================================
   إعداد السرعة
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


    try {

        media.preservesPitch =
            true;

    } catch (error) {}


    try {

        media.webkitPreservesPitch =
            true;

    } catch (error) {}


    try {

        media.mozPreservesPitch =
            true;

    } catch (error) {}


    try {

        media.defaultPlaybackRate =
            safeSpeed;

    } catch (error) {}


    try {

        media.playbackRate =
            safeSpeed;

    } catch (error) {

        console.warn(
            "تعذر ضبط سرعة التشغيل:",
            error
        );
    }


    return safeSpeed;
}


/* =========================================================
   إيقاف صوت داخلي
========================================================= */

function pauseAudioInternally(media) {

    if (!media) {
        return;
    }


    beginInternalAudioAction();


    /*
        نفصل حدث pause مؤقتًا قبل pause().
    */

    const oldPauseHandler =
        media.onpause;


    media.onpause = null;


    try {

        media.pause();

    } catch (error) {}


    /*
        نعيد handler القديم بعد انتهاء الحدث الحالي.

        لكن في حالة تغيير المقطع،
        قد يكون handler القديم لم يعد صالحًا أصلًا.
    */

    setTimeout(
        () => {

            if (
                media === audio &&
                state.session &&
                state.session.playing
            ) {

                /*
                    لا نعيد الحدث القديم هنا.

                    startCurrentSegment()
                    سيضع handler الخاص بالمقطع الجديد.
                */

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
   إيقاف خارجي من النظام
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


    resetAudioElement();


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    state.session.currentAyahRepeat =
        1;


    state.session.playing =
        false;


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


    /*
        رقم جديد لهذا الجزء.

        أي event من جزء أقدم سيتم تجاهله.
    */

    const thisSegmentId =
        ++audioSegmentId;


    const currentAudio =
        audio;


    /*
        =====================================================
        تغيير المصدر بأمان
        =====================================================
    */

    beginInternalAudioAction();


    /*
        نفصل الأحداث القديمة قبل pause/load.
    */

    detachAudioEvents();


    try {

        currentAudio.pause();

    } catch (error) {}


    try {

        currentAudio.removeAttribute(
            "src"
        );

    } catch (error) {}


    try {

        currentAudio.load();

    } catch (error) {}


    /*
        نضع المصدر الجديد.
    */

    currentAudio.src =
        url;


    /*
        نجهز السرعة قبل التشغيل.
    */

    const actualSpeed =
        configureAudioSpeed(
            currentAudio,
            state.session.speed
        );


    /*
        لا نترك الحماية للأبد.
    */

    endInternalAudioActionSoon();


    let finished =
        false;


    /* -----------------------------------------------------
       هل هذا الجزء ما زال هو الجزء الحالي؟
    ----------------------------------------------------- */

    function isCurrentSegment() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisSegmentId === audioSegmentId
        );
    }


    /* -----------------------------------------------------
       إنهاء الجزء مرة واحدة
    ----------------------------------------------------- */

    function finishOnce() {

        if (finished) {
            return;
        }


        finished =
            true;


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }


        if (!isCurrentSegment()) {
            return;
        }


        /*
            إيقاف داخلي فقط.

            لا نريد أن يعتبر onpause
            هذا إيقافًا من المستخدم.
        */

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


    /* -----------------------------------------------------
       play
    ----------------------------------------------------- */

    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";


            if (
                "mediaSession" in navigator
            ) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    /* -----------------------------------------------------
       playing
    ----------------------------------------------------- */

    currentAudio.onplaying =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";


            if (
                "mediaSession" in navigator
            ) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    /* -----------------------------------------------------
       loadedmetadata
    ----------------------------------------------------- */

    currentAudio.onloadedmetadata =
        () => {

            if (!isCurrentSegment()) {
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

                finishOnce();

                return;
            }


            /*
                تنظيف نقاط الوقف
                حسب مدة الملف الحالي.
            */

            sanitizePausePoints(
                duration
            );


            const bounds =
                getSegmentBounds(
                    duration
                );


            if (!bounds) {

                finishOnce();

                return;
            }


            const start =
                bounds.start;


            const end =
                bounds.end;


            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {

                finishOnce();

                return;
            }


            /*
                مقطع بعد pause point.

                ننتقل داخليًا إلى بداية المقطع.
            */

            if (
                Math.abs(
                    currentAudio.currentTime -
                    start
                ) > 0.02
            ) {

                internalSeekAction =
                    true;


                try {

                    currentAudio.currentTime =
                        start;

                } catch (error) {

                    internalSeekAction =
                        false;

                    finishOnce();

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


            const segmentDuration =
                end - start;


            const wallTime =
                (
                    segmentDuration /
                    actualSpeed
                ) * 1000;


            if (segmentTimer) {

                clearTimeout(
                    segmentTimer
                );
            }


            segmentTimer =
                setTimeout(
                    finishOnce,
                    Math.max(
                        50,
                        wallTime + 100
                    )
                );


            /*
                الجزء الأول بدأ بالفعل من play()
                المباشر في ضغطة المستخدم.

                لا نعيد play هنا.
            */

            if (
                userInitiated &&
                segmentIndex === 0 &&
                currentAudioType === "normal"
            ) {

                return;
            }


            /*
                إذا كان الصوت يعمل بالفعل،
                لا داعي لإعادة play.
            */

            if (!currentAudio.paused) {
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
        };


    /* -----------------------------------------------------
       مراقبة الموضع
    ----------------------------------------------------- */

    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
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
                bounds.end - 0.015
            ) {

                finishOnce();
            }
        };


    /* -----------------------------------------------------
       حماية السحب
    ----------------------------------------------------- */

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


    /* -----------------------------------------------------
       نهاية الملف
    ----------------------------------------------------- */

    currentAudio.onended =
        () => {

            if (
                finished ||
                !isCurrentSegment()
            ) {

                return;
            }


            finishOnce();
        };


    /* -----------------------------------------------------
       pause الخارجي
    ----------------------------------------------------- */

    currentAudio.onpause =
        () => {

            /*
                إذا كان pause بسبب التطبيق،
                نتجاهله.
            */

            if (internalAudioAction) {
                return;
            }


            if (!isCurrentSegment()) {
                return;
            }


            /*
                إذا توقف الصوت فعليًا من خارج التطبيق،
                نعالج ذلك هنا.
            */

            if (state.session.playing) {

                handleExternalAudioStop();
            }
        };


    /*
        مهم جدًا:

        لا نضع onemptied الذي يوقف الجلسة.

        emptied يحدث طبيعيًا عند تغيير src،
        وبالتالي لا يمكن اعتباره إيقافًا خارجيًا.
    */

    currentAudio.onemptied =
        null;


    /* -----------------------------------------------------
       خطأ الصوت
    ----------------------------------------------------- */

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


    /* =====================================================
       التشغيل المباشر لأول جزء
    ===================================================== */

    if (
        userInitiated &&
        segmentIndex === 0 &&
        currentAudioType === "normal"
    ) {

        /*
            مهم جدًا:

            play() يحدث مباشرة من click
            بدون await قبله.
        */

        let immediatePlayPromise;


        try {

            immediatePlayPromise =
                currentAudio.play();

        } catch (error) {

            console.error(
                "تعذر بدء الصوت:",
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


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );


            return;
        }


        if (
            immediatePlayPromise &&
            typeof immediatePlayPromise.then ===
            "function"
        ) {

            immediatePlayPromise
                .then(
                    () => {

                        if (!isCurrentSegment()) {
                            return;
                        }


                        state.session.playing =
                            true;


                        playPauseButton.textContent =
                            "⏸️";


                        if (
                            "mediaSession" in navigator
                        ) {

                            try {

                                navigator.mediaSession.playbackState =
                                    "playing";

                            } catch (error) {}
                        }
                    }
                )
                .catch(
                    error => {

                        console.error(
                            "تعذر تشغيل الصوت:",
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
                                "اضغط زر التشغيل مرة أخرى للسماح بتشغيل الصوت."
                            );

                        } else {

                            showAvailability(
                                "تعذر تشغيل ملف الصوت."
                            );
                        }
                    }
                );
        }
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

        finishAyah(
            token
        );

        return;
    }


    const segmentDuration =
        Math.max(
            0,
            bounds.end -
            bounds.start
        );


    /*
        Teacher Mode:

        normal
            ↓
        teacher
            ↓
        wait
    */

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

        continueAfterWait(
            token
        );

        return;
    }


    const waitTime =
        segmentDuration *
        multiplier *
        1000;


    state.session.playing =
        true;


    playPauseButton.textContent =
        "⏸️";


    setMediaSessionNone();


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
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


                continueAfterWait(
                    token
                );
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


    finishAyah(
        token
    );
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


    /*
        تكرار الآية.
    */

    if (
        state.session.currentAyahRepeat <
        state.session.ayahRepeat
    ) {

        state.session.currentAyahRepeat++;


        updateSessionInfo();


        playCurrentAyah(false);


        return;
    }


    /*
        انتهت تكرارات الآية.
    */

    state.session.currentAyahRepeat =
        1;


    /*
        توجد آية تالية.
    */

    if (
        state.session.currentAyah <
        state.session.toAyah
    ) {

        state.session.currentAyah++;


        renderCurrentAyah();

        updateSessionInfo();


        prepareNextAyahAndPlay(
            token
        );


        return;
    }


    /*
        انتهت الآيات.

        نكرر المقطع إذا لزم.
    */

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


        prepareNextAyahAndPlay(
            token
        );


        return;
    }


    finishMemorization();
}


/* =========================================================
   تجهيز الآية التالية ثم تشغيلها
========================================================= */

async function prepareNextAyahAndPlay(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    await loadPausePoints();


    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    playCurrentAyah(false);
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

        state.session.playing =
            false;
    }


    playPauseButton.textContent =
        "▶️";


    setMediaSessionNone();
}


/* =========================================================
   زر ⏸️ داخل التطبيق
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


    playbackToken++;


    /*
        إيقاف داخلي.

        resetAudioElement يفصل الأحداث
        قبل pause/load.
    */

    resetAudioElement();


    /*
        عند الضغط على ▶️ مرة أخرى،
        تبدأ الآية الحالية من البداية.
    */

    segmentIndex =
        0;


    currentAudioType =
        "normal";


    state.session.playing =
        false;


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


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    if (state.session) {

        state.session.playing =
            false;
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


        /*
            الشيخ
        */

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


        /*
            السورة
        */

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


        /*
            الآيات
        */

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


        /*
            السرعة
        */

        if (
            settings.speed !==
            undefined
        ) {

            speedRange.value =
                settings.speed;


            speedValue.textContent =
                `${Number(settings.speed).toFixed(2)}×`;
        }


        /*
            تكرار الآية
        */

        if (
            settings.ayahRepeat !==
            undefined
        ) {

            ayahRepeat.value =
                settings.ayahRepeat;
        }


        /*
            تكرار المقطع
        */

        if (
            settings.blockRepeat !==
            undefined
        ) {

            blockRepeat.value =
                settings.blockRepeat;
        }


        /*
            الانتظار
        */

        if (
            settings.wait !==
            undefined
        ) {

            waitSelect.value =
                settings.wait;
        }


        /*
            وضع المعلم
        */

        if (
            settings.teacherMode === true &&
            state.selectedReciter?.teacherMode
        ) {

            teacherMode.checked =
                true;
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

    fromAyah.value =
        1;

    toAyah.value =
        1;


    disableAyahInputs();
}


function disableAyahInputs() {

    fromAyah.disabled =
        true;

    toAyah.disabled =
        true;
}


function enableAyahInputs() {

    fromAyah.disabled =
        false;

    toAyah.disabled =
        false;
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
