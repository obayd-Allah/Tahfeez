const state = {
    quran: [],
    surahs: [],
    reciters: [],

    selectedReciter: null,
    selectedSurah: null,

    session: null
};


/* =========================================
   حالة الصوت
========================================= */

let audio = null;

let pausePoints = [];
let currentPauseIndex = 0;

let segmentStart = 0;
let segmentEnd = null;

let currentAudioType = "normal";

let waitTimer = null;

/*
    رقم تشغيل جديد.
    يمنع أحداث الصوت القديم من التأثير
    على التشغيل الجديد.
*/
let playbackToken = 0;


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
                "تعذر تحميل data/quran.json"
            );
        }


        if (!recitersResponse.ok) {
            throw new Error(
                "تعذر تحميل data/reciters.json"
            );
        }


        const quranData =
            await quranResponse.json();

        const recitersData =
            await recitersResponse.json();


        /*
            quran.json الحالي عبارة عن Array
            مباشرة.
        */

        if (!Array.isArray(quranData)) {

            throw new Error(
                "صيغة quran.json غير صحيحة: يجب أن تكون Array."
            );
        }


        if (!Array.isArray(recitersData)) {

            throw new Error(
                "صيغة reciters.json غير صحيحة: يجب أن تكون Array."
            );
        }


        state.reciters =
            recitersData;


        /*
            تحويل quran.json إلى الشكل الداخلي
            الذي يستخدمه التطبيق.
        */

        state.quran =
            quranData.map(surah => ({

                number:
                    Number(surah.id),

                name:
                    surah.name,

                ayahCount:
                    Number(surah.total_verses),

                ayahs:
                    Array.isArray(surah.verses)
                        ? surah.verses.map(ayah => ({

                            number:
                                Number(ayah.id),

                            text:
                                ayah.text

                        }))
                        : []

            }));


        state.surahs =
            state.quran;


        /*
            إظهار الشيوخ.
        */

        populateReciters();


        /*
            استعادة الإعدادات السابقة.
        */

        restoreSettings();


    } catch (error) {

        console.error(
            "Tahfeez loadData error:",
            error
        );


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


        reciterSelect.appendChild(
            option
        );
    }
}


/* =========================================
   السور المتوفرة للشيخ
========================================= */

function populateSurahs() {

    surahSelect.innerHTML = `
        <option value="">
            اختر السورة
        </option>
    `;


    state.selectedSurah =
        null;


    if (!state.selectedReciter) {

        surahSelect.disabled =
            true;

        return;
    }


    const availableSurahs =
        state.selectedReciter.surahs || {};


    let addedCount = 0;


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
            String(surah.number);


        option.textContent =
            `${surah.number}. ${surah.name}`;


        surahSelect.appendChild(
            option
        );


        addedCount++;
    }


    surahSelect.disabled =
        addedCount === 0;


    if (addedCount === 0) {

        showAvailability(
            `لا توجد سور متاحة حاليًا للشيخ ${state.selectedReciter.name}.`
        );

    } else {

        hideAvailability();
    }
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


        /*
            تغيير الشيخ يعني إعادة اختيار
            السورة من البداية.
        */

        resetAyahInputs();


        populateSurahs();


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
                    Number(surah.number) ===
                    number
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

            disableAyahInputs();


            showAvailability(
                `سورة ${state.selectedSurah.name} غير متوفرة بصوت ${state.selectedReciter.name} حاليًا.`
            );


            startButton.disabled =
                true;


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
   الحصول على توفر السورة
========================================= */

function getAvailableSurah(number) {

    if (!state.selectedReciter) {
        return null;
    }


    const surahs =
        state.selectedReciter.surahs || {};


    return (
        surahs[String(number)] ||
        surahs[number] ||
        null
    );
}


/* =========================================
   نطاق الآيات
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


    if (!Number.isFinite(from)) {
        from =
            available.from;
    }


    if (!Number.isFinite(to)) {
        to =
            available.to;
    }


    from =
        Math.max(
            available.from,
            Math.min(
                from,
                available.to
            )
        );


    to =
        Math.max(
            available.from,
            Math.min(
                to,
                available.to
            )
        );


    if (to < from) {
        to = from;
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
   الإعدادات
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


/* =========================================
   التحقق من الإعدادات
========================================= */

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


    startButton.disabled =
        !(
            Number.isFinite(from) &&
            Number.isFinite(to) &&
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
   شاشة التحفيظ
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
                Number(item.number) ===
                Number(
                    state.session.surah.number
                )
        );


    if (!surah) {
        return null;
    }


    return surah.ayahs.find(
        ayah =>
            Number(ayah.number) ===
            Number(
                state.session.currentAyah
            )
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


    const url =
        `${reciter.audioBaseUrl}/pauses/${surahNumber}.json`;


    try {

        const response =
            await fetch(url);


        if (!response.ok) {

            console.warn(
                "لا يوجد ملف pauses:",
                url
            );

            return;
        }


        const data =
            await response.json();


        if (!Array.isArray(data)) {
            return;
        }


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
            "تعذر تحميل نقاط الوقف:",
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


    /*
        إلغاء التشغيل السابق.
    */

    playbackToken++;


    const token =
        playbackToken;


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    if (audio) {

        audio.pause();

        audio.removeAttribute("src");

        audio.load();

        audio = null;
    }


    state.session.playing =
        false;


    /*
        تحميل نقاط الوقف الخاصة بهذه الآية.
    */

    await loadPausePoints();


    /*
        إذا تغير التشغيل أثناء تحميل
        pauses.json فلا نكمل.
    */

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }


    currentPauseIndex =
        0;


    segmentStart =
        0;


    currentAudioType =
        "normal";


    /*
        أول جزء:
        من 0 إلى أول وقفة.

        إذا لم توجد وقفات:
        من 0 إلى نهاية الآية.
    */

    segmentEnd =
        pausePoints.length > 0
            ? pausePoints[0]
            : null;


    playCurrentSegment(token);
}


/* =========================================
   تشغيل جزء من الآية
========================================= */

function playCurrentSegment(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }


    const reciter =
        state.session.reciter;


    if (!reciter.audioBaseUrl) {

        showAvailability(
            "لا يوجد رابط صوت لهذا الشيخ حاليًا."
        );


        return;
    }


    const surahNumber =
        state.session.surah.number;


    const ayahNumber =
        state.session.currentAyah;


    const audioUrl =
        `${reciter.audioBaseUrl}/${currentAudioType}/${surahNumber}/${ayahNumber}.mp3`;


    /*
        إيقاف الصوت السابق.
    */

    if (audio) {

        audio.pause();

        audio.removeAttribute("src");

        audio.load();

        audio = null;
    }


    const currentAudio =
        new Audio();


    audio =
        currentAudio;


    currentAudio.preload =
        "auto";


    currentAudio.playbackRate =
        state.session.speed;


    let finished =
        false;


    let endTimer =
        null;


    /*
        إنهاء الجزء مرة واحدة فقط.
    */

    function finishOnce() {

        if (finished) {
            return;
        }


        finished =
            true;


        if (endTimer) {

            clearTimeout(endTimer);

            endTimer = null;
        }


        if (
            !state.session ||
            token !== playbackToken ||
            audio !== currentAudio
        ) {
            return;
        }


        currentAudio.pause();


        handleSegmentFinished(
            token,
            currentAudio
        );
    }


    /*
        عند معرفة مدة الملف:
        نحدد نقطة البداية أولًا،
        ثم نبدأ التشغيل.
    */

    currentAudio.onloadedmetadata =
        () => {

            if (
                !state.session ||
                token !== playbackToken ||
                audio !== currentAudio
            ) {
                return;
            }


            const duration =
                currentAudio.duration;


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {

                finishOnce();

                return;
            }


            /*
                نقاط الوقف يجب أن تكون داخل
                مدة الملف فقط.
            */

            pausePoints =
                pausePoints.filter(
                    point =>
                        point > 0 &&
                        point < duration
                );


            /*
                نعيد حساب segmentEnd
                بناءً على القائمة المنقحة.
            */

            if (
                currentPauseIndex <
                pausePoints.length
            ) {

                segmentEnd =
                    pausePoints[
                        currentPauseIndex
                    ];

            } else {

                segmentEnd =
                    null;
            }


            const actualEnd =
                segmentEnd !== null
                    ? Math.min(
                        segmentEnd,
                        duration
                    )
                    : duration;


            /*
                حماية من جزء بطول صفر.
            */

            if (
                segmentStart >=
                actualEnd
            ) {

                finishOnce();

                return;
            }


            /*
                نضع الصوت في بداية الجزء
                قبل تشغيله.
            */

            currentAudio.currentTime =
                segmentStart;


            /*
                مدة هذا الجزء.
            */

            const segmentDuration =
                actualEnd -
                segmentStart;


            /*
                مؤقت دقيق نسبيًا للوصول
                إلى نهاية الجزء.

                timeupdate يبقى كاحتياط.
            */

            if (
                segmentEnd !== null &&
                segmentDuration > 0
            ) {

                const realTime =
                    (
                        segmentDuration /
                        state.session.speed
                    ) * 1000;


                endTimer =
                    setTimeout(
                        finishOnce,
                        realTime + 25
                    );
            }


            /*
                التشغيل بعد تثبيت currentTime.
            */

            currentAudio
                .play()
                .then(() => {

                    if (
                        !state.session ||
                        token !== playbackToken ||
                        audio !== currentAudio
                    ) {
                        return;
                    }


                    state.session.playing =
                        true;


                    playPauseButton.textContent =
                        "⏸️";
                })
                .catch(error => {

                    console.error(
                        "Audio play error:",
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


                    showAvailability(
                        "تعذر تشغيل ملف الصوت."
                    );
                });
        };


    /*
        احتياط:
        إذا وصل currentTime إلى نهاية
        الجزء قبل المؤقت.
    */

    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !state.session ||
                token !== playbackToken ||
                audio !== currentAudio
            ) {
                return;
            }


            if (
                segmentEnd !== null &&
                currentAudio.currentTime >=
                segmentEnd
            ) {

                finishOnce();
            }
        };


    /*
        إذا انتهى الملف فعلًا.
    */

    currentAudio.onended =
        () => {

            if (
                finished ||
                !state.session ||
                token !== playbackToken ||
                audio !== currentAudio
            ) {
                return;
            }


            finishOnce();
        };


    /*
        خطأ في الملف الصوتي.
    */

    currentAudio.onerror =
        () => {

            if (
                token !== playbackToken ||
                audio !== currentAudio
            ) {
                return;
            }


            if (endTimer) {

                clearTimeout(endTimer);

                endTimer = null;
            }


            state.session.playing =
                false;


            playPauseButton.textContent =
                "▶️";


            showAvailability(
                `تعذر تشغيل الصوت للآية ${ayahNumber}.`
            );
        };


    /*
        تعيين المصدر بعد تجهيز الأحداث.
    */

    currentAudio.src =
        audioUrl;


    currentAudio.load();
}


/* =========================================
   انتهاء الجزء
========================================= */

function handleSegmentFinished(
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


    /*
        مدة الجزء الحالي.

        مثال:
        0 → 2.5 = 2.5
        2.5 → 7.4 = 4.9
    */

    const currentSegmentDuration =
        segmentEnd !== null

            ? Math.max(
                0,
                segmentEnd -
                segmentStart
            )

            : Math.max(
                0,
                finishedAudio.duration -
                segmentStart
            );


    /*
        وضع المعلم:

        Normal:
        0 → 3

        Teacher:
        0 → 3

        ثم فقط بعد انتهاء التسجيل
        التعليمي ننتقل للجزء التالي.
    */

    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        /*
            مهم:
            لا نغير segmentStart
            ولا segmentEnd
            ولا currentPauseIndex.

            المعلم يعيد نفس الجزء تمامًا.
        */

        playCurrentSegment(token);


        return;
    }


    /*
        هنا انتهى الجزء بالكامل:
        سواء كان عاديًا أو تعليميًا.
    */

    currentAudioType =
        "normal";


    /*
        حفظ نهاية الجزء الحالي
        قبل الانتقال للجزء التالي.
    */

    const finishedSegmentEnd =
        segmentEnd;


    /*
        الانتقال إلى الجزء التالي.
    */

    if (
        finishedSegmentEnd !== null
    ) {

        segmentStart =
            finishedSegmentEnd;


        currentPauseIndex++;


        if (
            currentPauseIndex <
            pausePoints.length
        ) {

            segmentEnd =
                pausePoints[
                    currentPauseIndex
                ];

        } else {

            /*
                لا توجد وقفة أخرى.
                الجزء القادم سيكون:
                segmentStart → نهاية الملف.
            */

            segmentEnd =
                null;
        }
    }


    /*
        انتظار بعد كل جزء.
    */

    waitAfterSegment(
        currentSegmentDuration,
        () => {

            if (
                !state.session ||
                token !== playbackToken
            ) {
                return;
            }


            /*
                ما زال هناك جزء متبقٍ.
            */

            if (
                segmentStart >= 0 &&
                (
                    segmentEnd !== null ||
                    currentPauseIndex >=
                    pausePoints.length
                )
            ) {

                /*
                    إذا كان هناك جزء أخير
                    segmentStart → نهاية الآية،
                    يجب تشغيله فقط مرة واحدة.
                */

                if (
                    segmentEnd === null &&
                    currentPauseIndex >=
                    pausePoints.length
                ) {

                    /*
                        إذا كان الجزء الذي انتهى
                        أصلًا هو الجزء الأخير،
                        فقد انتهت الآية.
                    */

                    const lastPauseWasReached =
                        finishedSegmentEnd !== null &&
                        currentPauseIndex >
                        pausePoints.length;


                    if (lastPauseWasReached) {

                        handleAyahEnded(
                            token
                        );

                        return;
                    }


                    /*
                        لدينا جزء أخير:
                        segmentStart → duration
                    */

                    playCurrentSegment(
                        token
                    );

                    return;
                }


                playCurrentSegment(
                    token
                );

                return;
            }


            handleAyahEnded(
                token
            );
        }
    );
}


/* =========================================
   الانتظار بعد الجزء
========================================= */

function waitAfterSegment(
    segmentDuration,
    callback
) {

    if (!state.session) {
        return;
    }


    const multiplier =
        Number(state.session.wait);


    /*
        إذا كان الانتظار = صفر
        ننتقل مباشرة.
    */

    if (
        !Number.isFinite(multiplier) ||
        multiplier <= 0 ||
        segmentDuration <= 0
    ) {

        callback();

        return;
    }


    const waitMilliseconds =
        segmentDuration *
        multiplier *
        1000;


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


    waitTimer =
        setTimeout(
            () => {

                waitTimer =
                    null;


                if (!state.session) {
                    return;
                }


                callback();

            },
            waitMilliseconds
        );
}


/* =========================================
   انتهاء الآية
========================================= */

function handleAyahEnded(token) {

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
        الانتقال للآية التالية.
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
        انتهى المقطع الحالي.
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
        انتهت الجلسة.
    */

    finishMemorization();
}


/* =========================================
   انتهاء جلسة التحفيظ
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
   إيقاف التشغيل
========================================= */

function pausePlayback() {

    if (!state.session) {
        return;
    }


    /*
        إلغاء الانتظار.
    */

    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    /*
        إلغاء جميع أحداث التشغيل القديم.
    */

    playbackToken++;


    /*
        إيقاف الصوت.
    */

    if (audio) {

        audio.pause();

        audio.removeAttribute("src");

        audio.load();

        audio = null;
    }


    /*
        عند الضغط على تشغيل مرة أخرى،
        تبدأ الآية من البداية.
    */

    currentPauseIndex =
        0;


    segmentStart =
        0;


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

    playbackToken++;


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    if (audio) {

        audio.pause();

        audio.removeAttribute("src");

        audio.load();

        audio = null;
    }


    currentPauseIndex =
        0;


    segmentStart =
        0;


    segmentEnd =
        null;


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
   حفظ الإعدادات
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


/* =========================================
   استعادة الإعدادات
========================================= */

function restoreSettings() {

    const saved =
        localStorage.getItem(
            "tahfeez-settings"
        );


    if (!saved) {

        updateTeacherMode();

        validateSetup();

        return;
    }


    try {

        const settings =
            JSON.parse(saved);


        /*
            الشيخ
        */

        if (settings.reciter) {

            const reciter =
                state.reciters.find(
                    item =>
                        item.id ===
                        settings.reciter
                );


            if (reciter) {

                state.selectedReciter =
                    reciter;


                reciterSelect.value =
                    reciter.id;


                populateSurahs();
            }
        }


        updateTeacherMode();


        /*
            السورة
        */

        if (
            settings.surah &&
            state.selectedReciter
        ) {

            const surah =
                state.surahs.find(
                    item =>
                        String(item.number) ===
                        String(settings.surah)
                );


            const available =
                surah
                    ? getAvailableSurah(
                        surah.number
                    )
                    : null;


            if (
                surah &&
                available
            ) {

                state.selectedSurah =
                    surah;


                surahSelect.value =
                    String(
                        surah.number
                    );


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
                    clampNumber(
                        settings.fromAyah,
                        available.from,
                        available.to
                    );


                toAyah.value =
                    clampNumber(
                        settings.toAyah,
                        available.from,
                        available.to
                    );


                if (
                    Number(toAyah.value) <
                    Number(fromAyah.value)
                ) {

                    toAyah.value =
                        fromAyah.value;
                }


            } else {

                state.selectedSurah =
                    null;

                surahSelect.value =
                    "";
            }
        }


        /*
            السرعة
        */

        if (
            settings.speed !==
            undefined
        ) {

            const speed =
                Number(settings.speed);


            if (
                Number.isFinite(speed)
            ) {

                speedRange.value =
                    speed;


                speedValue.textContent =
                    `${speed.toFixed(2)}×`;
            }
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

        teacherMode.checked =
            Boolean(
                settings.teacherMode &&
                state.selectedReciter?.teacherMode
            );


        validateAyahRange();

        validateSetup();


    } catch (error) {

        console.error(
            "تعذر استعادة الإعدادات:",
            error
        );


        /*
            إذا كانت الإعدادات القديمة
            تالفة، نمسحها فقط.
        */

        localStorage.removeItem(
            "tahfeez-settings"
        );


        updateTeacherMode();

        validateSetup();
    }
}


/* =========================================
   أدوات الأرقام
========================================= */

function clampNumber(
    value,
    min,
    max
) {

    const number =
        Number(value);


    if (!Number.isFinite(number)) {
        return min;
    }


    return Math.max(
        min,
        Math.min(
            number,
            max
        )
    );
}


/* =========================================
   إعادة حقول الآيات
========================================= */

function resetAyahInputs() {

    fromAyah.value =
        1;


    toAyah.value =
        1;


    disableAyahInputs();
}


/* =========================================
   تعطيل حقول الآيات
========================================= */

function disableAyahInputs() {

    fromAyah.disabled =
        true;


    toAyah.disabled =
        true;
}


/* =========================================
   تفعيل حقول الآيات
========================================= */

function enableAyahInputs() {

    fromAyah.disabled =
        false;


    toAyah.disabled =
        false;
}


/* =========================================
   رسالة التوفر
========================================= */

function showAvailability(message) {

    availabilityMessage.textContent =
        message;


    availabilityMessage.classList.remove(
        "hidden"
    );
}


/* =========================================
   إخفاء رسالة التوفر
========================================= */

function hideAvailability() {

    availabilityMessage.textContent =
        "";


    availabilityMessage.classList.add(
        "hidden"
    );
}


/* =========================================
   بدء التطبيق
========================================= */

loadData();
