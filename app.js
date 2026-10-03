const state = {
    quran: [],
    surahs: [],
    reciters: [],

    selectedReciter: null,
    selectedSurah: null,

    session: null
};

let audio = null;

let pausePoints = [];
let currentPauseIndex = 0;

let segmentStart = 0;
let segmentEnd = null;

let currentAudioType = "normal";

let waitTimer = null;


/* =========================================
   عناصر الصفحة
========================================= */

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
    document.getElementById(
        "teacherModeDescription"
    );

const availabilityMessage =
    document.getElementById(
        "availabilityMessage"
    );

const startButton =
    document.getElementById("startButton");

const playerSettingsButton =
    document.getElementById(
        "playerSettingsButton"
    );

const currentSurahName =
    document.getElementById(
        "currentSurahName"
    );

const currentAyahText =
    document.getElementById(
        "currentAyahText"
    );

const blockRepeatInfo =
    document.getElementById(
        "blockRepeatInfo"
    );

const ayahRepeatInfo =
    document.getElementById(
        "ayahRepeatInfo"
    );

const completionMessage =
    document.getElementById(
        "completionMessage"
    );

const previousAyahButton =
    document.getElementById(
        "previousAyahButton"
    );

const restartBlockButton =
    document.getElementById(
        "restartBlockButton"
    );

const playPauseButton =
    document.getElementById(
        "playPauseButton"
    );

const nextAyahButton =
    document.getElementById(
        "nextAyahButton"
    );


/* =========================================
   تحميل البيانات
========================================= */

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
            quran.json هو المصدر الأساسي للقرآن.
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


/* =========================================
   الشيوخ
========================================= */

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


/* =========================================
   السور
========================================= */

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


/* =========================================
   اختيار الشيخ
========================================= */

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


/* =========================================
   اختيار السورة
========================================= */

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


/* =========================================
   معرفة السورة المتوفرة
========================================= */

function getAvailableSurah(number) {

    if (!state.selectedReciter) {
        return null;
    }


    return state.selectedReciter.surahs?.[
        String(number)
    ] || null;
}


/* =========================================
   الآيات
========================================= */

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


/* =========================================
   السرعة
========================================= */

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


/* =========================================
   الإعدادات الأخرى
========================================= */

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


/* =========================================
   وضع المعلم
========================================= */

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


/* =========================================
   التحقق من الإعدادات
========================================= */

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


/* =========================================
   بدء التحفيظ
========================================= */

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

        playing:
            false
    };


    openMemorizationScreen();
}


/* =========================================
   عالم التحفيظ
========================================= */

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
}


/* =========================================
   الآية الحالية
========================================= */

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


/* =========================================
   معلومات الجلسة
========================================= */

function updateSessionInfo() {

    if (!state.session) {
        return;
    }


    blockRepeatInfo.textContent =
        `المقطع ${state.session.currentBlockRepeat} / ${state.session.blockRepeat}`;


    ayahRepeatInfo.textContent =
        `الآية ${state.session.currentAyahRepeat} / ${state.session.ayahRepeat}`;
}


/* =========================================
   السابق
========================================= */

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


/* =========================================
   التالي
========================================= */

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


/* =========================================
   إعادة بداية المقطع
========================================= */

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


        renderCurrentAyah();

        updateSessionInfo();

        playCurrentAyah();
    }
);


/* =========================================
   تشغيل / إيقاف
========================================= */

playPauseButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }


        if (state.session.playing) {

            pausePlayback();

        } else {

            playCurrentAyah();
        }
    }
);


/* =========================================
   تحميل نقاط الوقف
========================================= */

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
                            value >= 0
                    )
                    .sort(
                        (a, b) => a - b
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


/* =========================================
   بدء الآية
========================================= */

async function playCurrentAyah() {

    if (!state.session) {
        return;
    }


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    await loadPausePoints();


    currentPauseIndex = 0;

    segmentStart = 0;


    currentAudioType =
        "normal";


    segmentEnd =
        pausePoints.length > 0
            ? pausePoints[0]
            : null;


    playCurrentSegment();
}


/* =========================================
   تشغيل الجزء الحالي
========================================= */

function playCurrentSegment() {

    if (!state.session) {
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


    if (audio) {

        audio.pause();

        audio = null;
    }


    const newAudio =
        new Audio(url);


    audio =
        newAudio;


    newAudio.playbackRate =
        state.session.speed;


    newAudio.onloadedmetadata = () => {

        if (!state.session) {
            return;
        }


        /*
            نبدأ من بداية الجزء الحالي.
        */

        newAudio.currentTime =
            segmentStart;
    };


    newAudio.ontimeupdate =
        handleAudioTimeUpdate;


    newAudio.onended =
        handleAudioEnded;


    newAudio.onerror = () => {

        if (!state.session) {
            return;
        }


        state.session.playing =
            false;


        playPauseButton.textContent =
            "▶️";


        showAvailability(
            "تعذر تشغيل ملف الصوت."
        );
    };


    newAudio.play()
        .then(() => {

            if (!state.session) {
                return;
            }


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";

        })
        .catch(error => {

            console.error(error);


            if (!state.session) {
                return;
            }


            state.session.playing =
                false;


            playPauseButton.textContent =
                "▶️";
        });
}


/* =========================================
   الوصول إلى نهاية الجزء
========================================= */

function handleAudioTimeUpdate() {

    if (
        !audio ||
        !state.session
    ) {

        return;
    }


    /*
        null تعني أن هذا هو الجزء الأخير
        حتى نهاية الملف.
    */

    if (segmentEnd === null) {
        return;
    }


    if (
        audio.currentTime >=
        segmentEnd
    ) {

        audio.pause();


        handleSegmentFinished();
    }
}


/* =========================================
   انتهاء الجزء الحالي
========================================= */

function handleSegmentFinished() {

    if (!state.session) {
        return;
    }


    /*
        إذا كان الشيخ قد قرأ الجزء،
        وفي وضع المعلم:
        نعيد نفس الجزء من نفس البداية
        إلى نفس النهاية بالتسجيل التعليمي.
    */

    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        playCurrentSegment();

        return;
    }


    /*
        هنا انتهى الجزء بالكامل:
        سواء كان الوضع عاديًا،
        أو انتهى تسجيل المعلم.
    */

    const segmentDuration =
        segmentEnd !== null
            ? Math.max(
                0,
                segmentEnd -
                segmentStart
            )
            : 0;


    currentAudioType =
        "normal";


    currentPauseIndex++;


    segmentStart =
        segmentEnd !== null
            ? segmentEnd
            : segmentStart;


    segmentEnd =
        currentPauseIndex <
        pausePoints.length

            ? pausePoints[
                currentPauseIndex
            ]

            : null;


    waitAfterSegment(
        segmentDuration,
        () => {

            if (!state.session) {
                return;
            }


            /*
                ما زالت هناك نقطة وقف،
                إذن نبدأ الجزء التالي.
            */

            if (segmentEnd !== null) {

                playCurrentSegment();

                return;
            }


            /*
                انتهت جميع الأجزاء.
            */

            handleAyahEnded();
        }
    );
}


/* =========================================
   انتهاء الملف الصوتي
========================================= */

function handleAudioEnded() {

    if (!state.session) {
        return;
    }


    /*
        إذا كانت هناك نقطة نهاية للجزء،
        فهذا يعني أن onended وصل قبل
        timeupdate إلى النقطة المطلوبة.
    */

    if (segmentEnd !== null) {

        handleSegmentFinished();

        return;
    }


    /*
        لا توجد نقطة وقف أخرى.
        إذن هذا هو آخر جزء في الآية.
    */


    /*
        في وضع المعلم:
        الشيخ أنهى الجزء الأخير،
        فنشغل التسجيل التعليمي من نفس
        segmentStart حتى نهاية الآية.

        مهم:
        لا نعيد segmentStart إلى صفر هنا،
        لأننا قد نكون في الجزء الأخير
        مثل 7 → نهاية الآية.
    */

    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        playCurrentSegment();

        return;
    }


    /*
        انتهى التسجيل التعليمي
        أو الوضع العادي.
    */

    const duration =
        audio?.duration || 0;


    const finalSegmentDuration =
        Math.max(
            0,
            duration - segmentStart
        );


    currentAudioType =
        "normal";


    waitAfterSegment(
        finalSegmentDuration,
        () => {

            handleAyahEnded();
        }
    );
}


/* =========================================
   الانتظار بين الأجزاء
========================================= */

function waitAfterSegment(
    segmentDuration,
    callback
) {

    if (!state.session) {
        return;
    }


    const multiplier =
        state.session.wait;


    if (
        multiplier <= 0 ||
        segmentDuration <= 0
    ) {

        callback();

        return;
    }


    const waitTime =
        segmentDuration *
        multiplier *
        1000;


    if (waitTimer) {

        clearTimeout(waitTimer);
    }


    waitTimer =
        setTimeout(
            () => {

                waitTimer = null;


                if (!state.session) {
                    return;
                }


                callback();

            },
            waitTime
        );
}


/* =========================================
   انتهاء الآية
========================================= */

function handleAyahEnded() {

    if (!state.session) {
        return;
    }


    /*
        تكرار الآية نفسها
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
        نعيد عداد تكرار الآية إلى 1.
    */

    state.session.currentAyahRepeat =
        1;


    /*
        الانتقال إلى الآية التالية.
    */

    if (
        state.session.currentAyah <
        state.session.toAyah
    ) {

        state.session.currentAyah++;


        renderCurrentAyah();

        updateSessionInfo();


        playCurrentAyah();


        return;
    }


    /*
        انتهى المقطع بالكامل.
        هل بقي تكرار للمقطع؟
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
        انتهى كل شيء.
    */

    finishMemorization();
}


/* =========================================
   إنهاء التحفيظ
========================================= */

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
}


/* =========================================
   إيقاف مؤقت
========================================= */

function pausePlayback() {

    if (!state.session) {
        return;
    }


    /*
        إذا كنا في فترة انتظار،
        نلغي الانتظار.
    */

    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    /*
        إيقاف الصوت وإعادته للبداية.
    */

    if (audio) {

        audio.pause();

        audio.currentTime = 0;

        audio = null;
    }


    /*
        عند الضغط على تشغيل مرة أخرى،
        تبدأ الآية الحالية من البداية.
    */

    currentPauseIndex = 0;

    segmentStart = 0;

    segmentEnd =
        pausePoints.length > 0
            ? pausePoints[0]
            : null;


    currentAudioType =
        "normal";


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";
}


/* =========================================
   إيقاف كامل
========================================= */

function stopPlayback() {

    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    if (audio) {

        audio.pause();

        audio.currentTime = 0;

        audio = null;
    }


    currentPauseIndex = 0;

    segmentStart = 0;

    segmentEnd = null;


    currentAudioType =
        "normal";


    if (state.session) {

        state.session.playing =
            false;
    }


    playPauseButton.textContent =
        "▶️";
}


/* =========================================
   العودة للإعدادات
========================================= */

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


/* =========================================
   الحفظ التلقائي للإعدادات
========================================= */

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

            نستخدم !== undefined
            حتى يعمل أيضًا اختيار 0.
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

            لا نفعّله إلا إذا كان متاحًا
            للشيخ المختار.
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


/* =========================================
   أدوات
========================================= */

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


/* =========================================
   تشغيل البداية
========================================= */

loadData();
