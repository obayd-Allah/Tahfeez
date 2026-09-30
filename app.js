const state = {
    quran: [],
    surahs: [],
    reciters: [],

    selectedReciter: null,
    selectedSurah: null,

    session: null
};


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
            surahsResponse,
            recitersResponse
        ] = await Promise.all([

            fetch("./data/surahs.json"),

            fetch("./data/reciters.json")
        ]);


        if (!surahsResponse.ok) {
            throw new Error(
                "تعذر تحميل surahs.json"
            );
        }


        if (!recitersResponse.ok) {
            throw new Error(
                "تعذر تحميل reciters.json"
            );
        }


        state.surahs =
            await surahsResponse.json();

        state.reciters =
            await recitersResponse.json();


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


    for (const surah of state.surahs) {

        const option =
            document.createElement("option");

        option.value =
            surah.number;

        option.textContent =
            `${surah.number}. ${surah.name}`;

        surahSelect.appendChild(option);
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
            بمجرد اختيار الشيخ،
            نعرض السور.

            لكن availability الخاصة بالشيخ
            هي التي ستحدد لاحقًا إن كانت
            السورة متوفرة أم لا.
        */

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
        "سيكرر الطفل ما يقرأه الشيخ";
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


function playCurrentAyah() {

    if (!state.session) {
        return;
    }


    state.session.playing = true;

    playPauseButton.textContent =
        "⏸️";


    /*
        محرك الصوت سيأتي بعد تجهيز:
        manifest + ملفات الصوت.
    */
}


function pausePlayback() {

    if (!state.session) {
        return;
    }


    state.session.playing = false;

    /*
        لا نغير:
        الآية
        رقم التكرار
        رقم تكرار المقطع

        وعند التشغيل من جديد سيبدأ
        الصوت من بداية الآية.
    */


    playPauseButton.textContent =
        "▶️";
}


function stopPlayback() {

    if (!state.session) {
        return;
    }


    state.session.playing = false;

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


    populateSurahs();


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


        if (settings.speed) {

            speedRange.value =
                settings.speed;

            speedValue.textContent =
                `${Number(settings.speed).toFixed(2)}×`;
        }


        if (settings.ayahRepeat) {

            ayahRepeat.value =
                settings.ayahRepeat;
        }


        if (settings.blockRepeat) {

            blockRepeat.value =
                settings.blockRepeat;
        }


        if (settings.wait) {

            waitSelect.value =
                settings.wait;
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


/* =========================================
   تشغيل البداية
========================================= */

loadData();
