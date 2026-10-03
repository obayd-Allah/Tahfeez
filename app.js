const state = {
    quran: [],
    surahs: [],
    reciters: [],

    selectedReciter: null,
    selectedSurah: null,

    session: null
};


/* =========================================================
   حالة التشغيل
========================================================= */

let audio = null;

let pausePoints = [];

/*
    رقم الجزء الحالي.

    إذا كانت لدينا:
    [2.5, 7.4]

    فالأجزاء تكون:

    0 → 2.5
    2.5 → 7.4
    7.4 → نهاية الآية

    أي أن عدد الأجزاء = pausePoints.length + 1
*/
let segmentIndex = 0;

let currentAudioType = "normal";

let waitTimer = null;
let segmentTimer = null;

/*
    كل عملية تشغيل تحصل على Token جديد.
    أي حدث من تشغيل قديم يتم تجاهله.
*/
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


/* =========================================================
   عالم التحفيظ
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
   إيقاف المقطع والرجوع إلى بدايته
========================================================= */

restartBlockButton.addEventListener(
    "click",
    () => {

        if (!state.session) {
            return;
        }


        /*
            مهم:

            نوقف فقط.

            لا نستدعي playCurrentAyah().
        */

        stopPlayback();


        state.session.currentAyah =
            state.session.fromAyah;


        state.session.currentAyahRepeat =
            1;


        renderCurrentAyah();

        updateSessionInfo();


        /*
            يبقى متوقفًا.
        */

        state.session.playing =
            false;


        playPauseButton.textContent =
            "▶️";
    }
);


/* =========================================================
   تشغيل / إيقاف مؤقت
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
   إلغاء المؤقتات والصوت القديم
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

        audio.pause();

        audio.removeAttribute("src");

        audio.load();

        audio = null;
    }
}


/* =========================================================
   بدء الآية الحالية
========================================================= */

async function playCurrentAyah() {

    if (!state.session) {
        return;
    }


    /*
        تشغيل جديد تمامًا.
    */

    playbackToken++;

    const token =
        playbackToken;


    clearPlaybackResources();


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


    /*
        تحميل نقاط الوقف الخاصة
        بالآية الحالية.
    */

    await loadPausePoints();


    /*
        ربما ضغط المستخدم على زر
        آخر أثناء التحميل.
    */

    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    /*
        نبدأ دائمًا من أول جزء.
    */

    segmentIndex = 0;

    currentAudioType =
        "normal";


    startCurrentSegment(token);
}


/* =========================================================
   حساب حدود الجزء
========================================================= */

function getSegmentBounds(duration) {

    const totalSegments =
        pausePoints.length + 1;


    /*
        إذا وصلنا بعد آخر جزء،
        فهذا يعني أن الآية انتهت.
    */

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
        start: Math.max(
            0,
            start
        ),

        end: Math.min(
            duration,
            end
        )
    };
}


/* =========================================================
   تنظيف نقاط الوقف حسب مدة الملف
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
   تشغيل الجزء الحالي
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
        إيقاف الصوت السابق قبل إنشاء
        الصوت الجديد.
    */

    if (audio) {

        audio.pause();

        audio.removeAttribute("src");

        audio.load();

        audio = null;
    }


    const newAudio =
        new Audio();


    audio =
        newAudio;


    newAudio.preload =
        "auto";


    newAudio.src =
        url;


    newAudio.playbackRate =
        state.session.speed;


    let finished =
        false;


    function finishOnce() {

        if (finished) {
            return;
        }


        finished = true;


        if (segmentTimer) {

            clearTimeout(segmentTimer);

            segmentTimer = null;
        }


        if (
            !state.session ||
            token !== playbackToken ||
            audio !== newAudio
        ) {

            return;
        }


        newAudio.pause();


        handleCurrentSegmentFinished(
            token,
            newAudio
        );
    }


    /*
        عند معرفة مدة الملف:
        نحدد بداية ونهاية الجزء
        بشكل واضح.
    */

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
                Number(newAudio.duration);


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {

                finishOnce();

                return;
            }


            /*
                تنظيف نقاط الوقف مرة واحدة
                بناءً على مدة الملف.
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


            /*
                حماية من نقطة وقف غير صحيحة.
            */

            if (
                end <= start
            ) {

                finishOnce();

                return;
            }


            /*
                نبدأ من الموضع المحدد.
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
                مدة الجزء على خط الصوت.
            */

            const segmentDuration =
                end - start;


            /*
                مؤقت احتياطي دقيق.

                عند سرعة 1.00:
                5 ثوانٍ صوتية = 5 ثوانٍ فعلية.

                عند سرعة 1.25:
                5 ثوانٍ صوتية = 4 ثوانٍ فعلية.
            */

            const wallTime =
                (
                    segmentDuration /
                    state.session.speed
                ) * 1000;


            segmentTimer =
                setTimeout(
                    finishOnce,
                    wallTime + 30
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


                    state.session.playing =
                        true;


                    playPauseButton.textContent =
                        "⏸️";

                })
                .catch(error => {

                    console.error(
                        "تعذر تشغيل الصوت",
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
                });
        };


    /*
        timeupdate احتياط إضافي.

        إذا وصل الصوت إلى نهاية الجزء
        قبل المؤقت، ننهي الجزء.
    */

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
                Number(newAudio.duration);


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
                newAudio.currentTime >=
                bounds.end - 0.01
            ) {

                finishOnce();
            }
        };


    /*
        إذا انتهى الملف فعليًا.
    */

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


    /*
        خطأ في ملف الصوت.
    */

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


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };
}


/* =========================================================
   انتهاء الجزء الحالي
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
        Number(finishedAudio.duration);


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

        عادي:
        الجزء الحالي

        ثم:
        teacher:
        نفس الجزء بالضبط

        ثم ننتقل للانتظار.
    */

    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        /*
            نفس segmentIndex.
            لا نزيده هنا.
        */

        startCurrentSegment(
            token
        );


        return;
    }


    /*
        انتهى الجزء بالكامل.
    */

    currentAudioType =
        "normal";


    /*
        انتقل إلى الجزء التالي.
    */

    segmentIndex++;


    /*
        انتظار بعد الجزء.
    */

    waitAfterSegment(
        segmentDuration,
        token
    );
}


/* =========================================================
   الانتظار بعد الجزء
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
        Number(state.session.wait);


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


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


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
   بعد انتهاء الانتظار
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


    /*
        ما زالت هناك أجزاء؟
    */

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
        انتهت جميع أجزاء الآية.
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
        أولًا:
        هل بقي تكرار للآية؟
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
        نعيد عداد الآية إلى 1.
    */

    state.session.currentAyahRepeat =
        1;


    /*
        هل توجد آية تالية؟
    */

    if (
        state.session.currentAyah <
        state.session.toAyah
    ) {

        state.session.currentAyah++;


        renderCurrentAyah();

        updateSessionInfo();


        /*
            الانتقال مباشرًا وتشغيل الآية
            التالية تلقائيًا.
        */

        playCurrentAyah();


        return;
    }


    /*
        انتهى المقطع.
        هل يوجد تكرار للمقطع؟
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
   إنهاء التحفيظ
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
}


/* =========================================================
   الإيقاف المؤقت
========================================================= */

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
        إلغاء المؤقت الخاص بالجزء.
    */

    if (segmentTimer) {

        clearTimeout(segmentTimer);

        segmentTimer = null;
    }


    /*
        إلغاء جميع الأحداث القديمة.
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
        عند الضغط على ▶️ مرة أخرى:
        تبدأ الآية الحالية من البداية.
    */

    segmentIndex = 0;

    currentAudioType =
        "normal";


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";
}


/* =========================================================
   إيقاف كامل
========================================================= */

function stopPlayback() {

    /*
        إلغاء كل الأحداث القديمة.
    */

    playbackToken++;


    clearPlaybackResources();


    /*
        إعادة حالة التشغيل فقط.
    */

    segmentIndex = 0;

    currentAudioType =
        "normal";


    if (state.session) {

        state.session.playing =
            false;
    }


    playPauseButton.textContent =
        "▶️";
}


/* =========================================================
   العودة إلى الإعدادات
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
   الحفظ التلقائي للإعدادات
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
   تشغيل البداية
========================================================= */

loadData();
