const state = {
    quran: [],
    surahs: [],
    reciters: [],

    selectedReciter: null,
    selectedSurah: null,

    session: null
};


/* =========================================================
   نظام التشغيل
========================================================= */

let audio = null;

let pausePoints = [];

let segmentIndex = 0;

let currentAudioType = "normal";

let waitTimer = null;
let segmentTimer = null;

let playbackToken = 0;


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

/*
    لا ننشئ MediaMetadata ولا نسجل أزرار النظام.

    وعند وجود Media Session في المتصفح،
    نحاول إبقاء حالتها none.

    ملاحظة:
    المتصفح/نظام الهاتف قد يعرض تحكمات الوسائط
    رغم ذلك أثناء تشغيل <audio>.
*/

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
    لا نستخدم Media Session للتحكم في التطبيق.
*/

setMediaSessionNone();


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


        /*
            quran.json عبارة عن Array مباشرة.
        */

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


function startMemorization() {

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

        /*
            هذه تعني أن جلسة الصفحة
            في حالة تشغيل حتى أثناء الانتظار.

            لذلك زر الصفحة يبقى ⏸️
            أثناء السكوت أيضًا.
        */

        playing:
            false
    };


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


            renderCurrentAyah();

            updateSessionInfo();
        }
    }
);


/* =========================================================
   إيقاف المقطع
========================================================= */

restartBlockButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }


        /*
            إيقاف حقيقي.

            لا تشغيل بعده.
        */

        stopPlayback();


        state.session.currentAyah =
            state.session.fromAyah;


        state.session.currentAyahRepeat =
            1;


        state.session.currentBlockRepeat =
            1;


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

            /*
                سواء كان الصوت يعمل
                أو نحن في فترة انتظار:

                الضغط على ⏸️ يوقف الجلسة
                ويعيد الآية من البداية.
            */

            pausePlayback();

        } else {

            playCurrentAyah();
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


    try {

        const response =
            await fetch(
                `${reciter.audioBaseUrl}/pauses/${surahNumber}.json`
            );


        if (!response.ok) {
            return;
        }


        const data =
            await response.json();


        const ayahNumber =
            state.session.currentAyah;


        const ayahData =
            data.find(
                item =>
                    Number(item.ayah) ===
                    Number(ayahNumber)
            );


        if (
            ayahData &&
            Array.isArray(ayahData.pauses)
        ) {

            pausePoints =
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


    if (audio) {

        try {
            audio.pause();
        } catch (error) {}


        audio.onloadedmetadata = null;
        audio.ontimeupdate = null;
        audio.onended = null;
        audio.onerror = null;


        audio.removeAttribute("src");

        try {
            audio.load();
        } catch (error) {}


        audio = null;
    }


    setMediaSessionNone();
}


/* =========================================================
   تشغيل الآية
========================================================= */

async function playCurrentAyah() {

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


    await loadPausePoints();


    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    /*
        نبدأ تشغيل الجلسة.

        مهم:
        بمجرد بدء التشغيل الناجح،
        يبقى session.playing = true
        حتى أثناء الانتظار.
    */

    startCurrentSegment(token);
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
   إعداد السرعة بدون تغيير طبقة الصوت
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


    /*
        مهم:

        نحدد preserve pitch صراحةً
        لتقليل تشوه الصوت عند تغيير
        السرعة.

        المتصفحات المختلفة تستخدم
        أسماء مختلفة لهذه الخاصية.
    */

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


    /*
        نحدد السرعة قبل play().
    */

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
   تشغيل الجزء
========================================================= */

function startCurrentSegment(token) {

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
        إزالة الصوت السابق.
    */

    if (audio) {

        try {
            audio.pause();
        } catch (error) {}


        audio.removeAttribute("src");

        try {
            audio.load();
        } catch (error) {}

        audio = null;
    }


    const newAudio =
        new Audio();


    audio =
        newAudio;


    /*
        خصائص مهمة للصوت.
    */

    newAudio.preload =
        "auto";


    /*
        لا توجد controls أصلًا،
        حتى لا يظهر مشغل داخل الصفحة.
    */

    newAudio.controls =
        false;


    /*
        منع الإرسال إلى جهاز خارجي
        إن كان المتصفح يدعم ذلك.
    */

    try {
        newAudio.disableRemotePlayback =
            true;
    } catch (error) {}


    newAudio.src =
        url;


    /*
        نضبط السرعة وPitch.
    */

    const actualSpeed =
        configureAudioSpeed(
            newAudio,
            state.session.speed
        );


    let finished =
        false;


    function finishOnce() {

        if (finished) {
            return;
        }


        finished = true;


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }


        if (
            !state.session ||
            token !== playbackToken ||
            audio !== newAudio
        ) {

            return;
        }


        try {
            newAudio.pause();
        } catch (error) {}


        handleCurrentSegmentFinished(
            token,
            newAudio
        );
    }


    /* -----------------------------------------------------
       Metadata
    ----------------------------------------------------- */

    newAudio.onloadedmetadata =
        () => {

            if (
                !state.session ||
                token !== playbackToken ||
                audio !== newAudio
            ) {

                return;
            }


            const duration =
                Number(
                    newAudio.duration
                );


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {

                finishOnce();

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
                أولًا نضع الموضع.
            */

            try {

                newAudio.currentTime =
                    start;

            } catch (error) {

                console.error(error);

                finishOnce();

                return;
            }


            /*
                ثم نثبت السرعة مرة أخرى
                بعد تحميل metadata.

                هذا مهم في بعض المتصفحات
                التي تعيد السرعة إلى 1 أثناء
                تحميل الملف.
            */

            configureAudioSpeed(
                newAudio,
                actualSpeed
            );


            const segmentDuration =
                end - start;


            /*
                مدة التشغيل الحقيقية مع السرعة.
            */

            const wallTime =
                (
                    segmentDuration /
                    actualSpeed
                ) * 1000;


            /*
                المؤقت مجرد حماية.

                ontimeupdate هو الحارس الآخر.
            */

            segmentTimer =
                setTimeout(
                    finishOnce,
                    Math.max(
                        50,
                        wallTime + 80
                    )
                );


            /*
                تشغيل الصوت.
            */

            newAudio.play()
                .then(() => {

                    if (
                        !state.session ||
                        token !== playbackToken ||
                        audio !== newAudio
                    ) {

                        return;
                    }


                    /*
                        من هنا وحتى نهاية
                        الانتظار:

                        session.playing = true

                        لذلك الزر يبقى ⏸️.
                    */

                    state.session.playing =
                        true;


                    playPauseButton.textContent =
                        "⏸️";


                    /*
                        لا نعلن Media Session
                        على مستوى النظام.
                    */

                    setMediaSessionNone();

                })
                .catch(error => {

                    console.error(
                        "تعذر تشغيل الصوت:",
                        error
                    );


                    if (
                        token !== playbackToken
                    ) {

                        return;
                    }


                    state.session.playing =
                        false;


                    playPauseButton.textContent =
                        "▶️";


                    setMediaSessionNone();
                });
        };


    /* -----------------------------------------------------
       مراقبة الموضع
    ----------------------------------------------------- */

    newAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !state.session ||
                token !== playbackToken ||
                audio !== newAudio
            ) {

                return;
            }


            const duration =
                Number(
                    newAudio.duration
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


            /*
                هامش صغير لمنع تجاوز
                نهاية الجزء.
            */

            if (
                newAudio.currentTime >=
                bounds.end - 0.015
            ) {

                finishOnce();
            }
        };


    /* -----------------------------------------------------
       نهاية الملف
    ----------------------------------------------------- */

    newAudio.onended =
        () => {

            if (
                finished ||
                !state.session ||
                token !== playbackToken ||
                audio !== newAudio
            ) {

                return;
            }


            finishOnce();
        };


    /* -----------------------------------------------------
       خطأ الصوت
    ----------------------------------------------------- */

    newAudio.onerror =
        () => {

            if (
                token !== playbackToken ||
                audio !== newAudio
            ) {

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


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };
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
        وضع المعلم:

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


        /*
            لا نغير segmentIndex.
            نعيد نفس الجزء تمامًا.
        */

        startCurrentSegment(
            token
        );


        return;
    }


    /*
        انتهى الجزء.
    */

    currentAudioType =
        "normal";


    segmentIndex++;


    /*
        الانتظار.

        والأهم:
        لا نغير session.playing إلى false.

        لذلك الزر يظل ⏸️.
    */

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


    /*
        لا يوجد انتظار.
    */

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


    /*
        هنا التغيير المهم:

        لا نقول playing = false.

        من وجهة نظر زر الصفحة:
        الجلسة ما زالت تعمل.

        لذلك الزر يبقى ⏸️.
    */

    state.session.playing =
        true;


    playPauseButton.textContent =
        "⏸️";


    /*
        لكن لا يوجد صوت حاليًا،
        لذلك لا نحتاج Media Session.
    */

    setMediaSessionNone();


    if (waitTimer) {

        clearTimeout(
            waitTimer
        );

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


                /*
                    نستمر تلقائيًا.
                */

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
            token
        );


        return;
    }


    /*
        انتهت كل أجزاء الآية.
    */

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


        playCurrentAyah();


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


        /*
            الانتقال المباشر.
        */

        playCurrentAyah();


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


        playCurrentAyah();


        return;
    }


    /*
        انتهت الجلسة بالكامل.
    */

    finishMemorization();
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
   زر ⏸️
========================================================= */

function pausePlayback() {

    if (!state.session) {
        return;
    }


    /*
        إلغاء الانتظار إن كان موجودًا.
    */

    if (waitTimer) {

        clearTimeout(
            waitTimer
        );

        waitTimer = null;
    }


    /*
        إلغاء مؤقت الجزء.
    */

    if (segmentTimer) {

        clearTimeout(
            segmentTimer
        );

        segmentTimer = null;
    }


    /*
        إلغاء كل الأحداث القديمة.
    */

    playbackToken++;


    /*
        إيقاف الصوت.
    */

    if (audio) {

        try {
            audio.pause();
        } catch (error) {}


        audio.onloadedmetadata = null;
        audio.ontimeupdate = null;
        audio.onended = null;
        audio.onerror = null;


        audio.removeAttribute("src");

        try {
            audio.load();
        } catch (error) {}


        audio = null;
    }


    /*
        الضغط على ⏸️ يعيد الآية الحالية
        من البداية عند التشغيل التالي.
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
