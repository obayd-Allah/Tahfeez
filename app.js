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

/*
    رقم تشغيل جديد لكل عملية تشغيل.
    يمنع أحداث الصوت القديم من التأثير
    على الجزء الجديد.
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


/* =========================================
   بدء الآية
========================================= */

async function playCurrentAyah() {

    if (!state.session) {
        return;
    }


    /*
        إلغاء أي تشغيل أو انتظار قديم.
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

        audio.src = "";

        audio = null;
    }


    state.session.playing =
        false;


    /*
        تحميل نقاط الوقف الخاصة بالآية.
    */

    await loadPausePoints();


    /*
        قد يكون المستخدم أوقف التشغيل
        أثناء تحميل pauses.json.
    */

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }


    currentPauseIndex = 0;

    segmentStart = 0;

    currentAudioType =
        "normal";


    /*
        إذا توجد وقفة:
        الجزء الأول 0 → أول وقفة.

        إذا لا توجد وقفات:
        الآية كلها جزء واحد.
    */

    segmentEnd =
        pausePoints.length > 0
            ? pausePoints[0]
            : null;


    playCurrentSegment(token);
}


/* =========================================
   تشغيل الجزء الحالي
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


    const surahNumber =
        state.session.surah.number;


    const ayahNumber =
        state.session.currentAyah;


    const url =
        `${reciter.audioBaseUrl}/${currentAudioType}/${surahNumber}/${ayahNumber}.mp3`;


    /*
        إيقاف الصوت السابق.
    */

    if (audio) {

        audio.pause();

        audio.src = "";

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


    let finished = false;

    let endTimer = null;


    /*
        إنهاء الجزء مرة واحدة فقط.
    */

    const finishOnce =
        () => {

            if (finished) {
                return;
            }


            finished = true;


            if (endTimer) {

                clearTimeout(endTimer);

                endTimer = null;
            }


            if (
                token !== playbackToken ||
                audio !== newAudio
            ) {
                return;
            }


            newAudio.pause();


            handleSegmentFinished(
                token,
                newAudio
            );
        };


    /*
        عند تحميل بيانات الملف:
        نثبت البداية أولًا،
        ثم نبدأ التشغيل.

        هذا مهم جدًا حتى لا يبدأ
        الصوت من الثانية 0 قبل
        الوصول إلى segmentStart.
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
                newAudio.duration;


            /*
                تنظيف نقاط الوقف التي تتجاوز
                مدة الملف.
            */

            pausePoints =
                pausePoints.filter(
                    point =>
                        point > 0 &&
                        point < duration
                );


            /*
                بعد التنظيف، قد تتغير النهاية.
            */

            if (
                segmentEnd !== null &&
                segmentEnd >= duration
            ) {

                segmentEnd =
                    null;
            }


            /*
                إذا كنا في الجزء الأخير،
                فالنهاية هي مدة الملف.
            */

            const actualEnd =
                segmentEnd !== null
                    ? Math.min(
                        segmentEnd,
                        duration
                    )
                    : duration;


            /*
                إذا كانت البداية وصلت للنهاية
                فلا يوجد جزء صالح.
            */

            if (
                segmentStart >=
                actualEnd
            ) {

                finishOnce();

                return;
            }


            /*
                نضع الصوت عند البداية الدقيقة
                للجزء قبل play().
            */

            try {

                newAudio.currentTime =
                    segmentStart;

            } catch (error) {

                console.error(error);

                finishOnce();

                return;
            }


            /*
                مدة الجزء على الخط الزمني
                للصوت نفسه.
            */

            const remainingDuration =
                Math.max(
                    0,
                    actualEnd -
                    segmentStart
                );


            /*
                إذا كانت هناك نهاية للجزء،
                نستخدم مؤقتًا دقيقًا بالإضافة
                إلى timeupdate كاحتياط.

                القسمة على playbackRate لأن
                remainingDuration هي مدة
                صوتية، وليست مدة زمنية فعلية
                عند السرعات المختلفة.
            */

            if (
                segmentEnd !== null &&
                remainingDuration > 0
            ) {

                const wallTime =
                    (
                        remainingDuration /
                        state.session.speed
                    ) * 1000;


                endTimer =
                    setTimeout(
                        finishOnce,
                        wallTime + 20
                    );
            }


            /*
                نبدأ التشغيل فقط بعد ضبط
                currentTime.
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

                    console.error(error);


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
        احتياط إضافي:
        إذا وصل timeupdate إلى النهاية
        قبل المؤقت.
    */

    newAudio.ontimeupdate =
        () => {

            if (
                !state.session ||
                token !== playbackToken ||
                audio !== newAudio ||
                finished
            ) {
                return;
            }


            if (
                segmentEnd !== null &&
                newAudio.currentTime >=
                segmentEnd
            ) {

                finishOnce();
            }
        };


    /*
        onended يستخدم فقط عندما يصل
        الملف فعليًا إلى نهايته.
    */

    newAudio.onended =
        () => {

            if (
                finished ||
                token !== playbackToken ||
                audio !== newAudio
            ) {
                return;
            }


            finishOnce();
        };


    newAudio.onerror =
        () => {

            if (
                token !== playbackToken ||
                audio !== newAudio
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
                "تعذر تشغيل ملف الصوت."
            );
        };
}


/* =========================================
   انتهاء الجزء الحالي
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
        نحسب مدة الجزء من نقاط الوقف
        وليس من وقت وصول الحدث.

        مثال:
        0 → 2.5
        = 2.5 ثانية

        2.5 → 7.4
        = 4.9 ثانية
    */

    let segmentDuration = 0;


    if (segmentEnd !== null) {

        segmentDuration =
            Math.max(
                0,
                segmentEnd -
                segmentStart
            );
    }


    /*
        في وضع المعلم:

        الشيخ:
        0 → 3

        المعلم:
        0 → 3

        ثم ننتقل للجزء التالي.

        المهم أننا لا نغير:
        segmentStart
        segmentEnd
        currentPauseIndex

        أثناء إعادة الجزء بالتسجيل
        التعليمي.
    */

    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        playCurrentSegment(
            token
        );


        return;
    }


    /*
        هنا انتهى الجزء بالكامل.
    */

    currentAudioType =
        "normal";


    /*
        إذا كانت هناك نقطة وقف:
        ننتقل إلى الوقفة التالية.
    */

    if (segmentEnd !== null) {

        segmentStart =
            segmentEnd;


        currentPauseIndex++;


        segmentEnd =
            currentPauseIndex <
            pausePoints.length

                ? pausePoints[
                    currentPauseIndex
                ]

                : null;
    }


    /*
        إذا كان هذا هو الجزء الأخير،
        فـ segmentDuration لا يمكن حسابه
        من segmentEnd لأنه null.

        في هذه الحالة نحسب مدة الجزء
        من مدة الملف.
    */

    if (
        segmentEnd === null &&
        segmentDuration === 0
    ) {

        const duration =
            Number.isFinite(
                finishedAudio.duration
            )
                ? finishedAudio.duration
                : 0;


        segmentDuration =
            Math.max(
                0,
                duration -
                segmentStart
            );
    }


    /*
        الانتظار بعد كل جزء.

        بما في ذلك:
        الجزء الأخير من الآية.
    */

    waitAfterSegment(
        segmentDuration,
        () => {

            if (
                !state.session ||
                token !== playbackToken
            ) {
                return;
            }


            /*
                ما زالت هناك نقطة وقف.
                إذن نشغل الجزء التالي.
            */

            if (
                segmentEnd !== null
            ) {

                playCurrentSegment(
                    token
                );

                return;
            }


            /*
                لا توجد وقفات أخرى.
                انتهت الآية.
            */

            handleAyahEnded(
                token
            );
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

        waitTimer = null;
    }


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


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

function handleAyahEnded(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }


    /*
        تكرار الآية نفسها.
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
        انتهت الجلسة كلها.
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
        إلغاء الانتظار.
    */

    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    /*
        إلغاء أي أحداث صوت قديم.
    */

    playbackToken++;


    /*
        إيقاف الصوت.
    */

    if (audio) {

        audio.pause();

        audio.src = "";

        audio = null;
    }


    /*
        عند الضغط على تشغيل مرة أخرى:
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

    /*
        إلغاء كل الأحداث القديمة.
    */

    playbackToken++;


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    if (audio) {

        audio.pause();

        audio.src = "";

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
