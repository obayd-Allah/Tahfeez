const reciters = {
    "mohamed-alsouri": {
        id: "mohamed-alsouri",
        name: "محمد السوري",
        teacherMode: false,
        surahs: {}
    },

    "ibrahim": {
        id: "ibrahim",
        name: "الشيخ إبراهيم",
        teacherMode: false,
        surahs: {}
    },

    "ziad": {
        id: "ziad",
        name: "الشيخ زياد",
        teacherMode: false,
        surahs: {}
    },

    "marwan": {
        id: "marwan",
        name: "الشيخ مروان",
        teacherMode: false,
        surahs: {}
    },

    "youssef": {
        id: "youssef",
        name: "الشيخ يوسف",
        teacherMode: false,
        surahs: {}
    },

    "mohamed-hamdy": {
        id: "mohamed-hamdy",
        name: "الشيخ محمد حمدي",
        teacherMode: false,
        surahs: {}
    },

    "osama": {
        id: "osama",
        name: "الشيخ أسامة",
        teacherMode: false,
        surahs: {}
    }
};


/*
    سنضع بيانات القرآن الرسمية هنا لاحقًا
    بعد إضافة ملف quran.json.

    لا نكتب نص القرآن يدويًا داخل JavaScript.
*/

let quranData = [];

let selectedReciter = null;
let selectedSurah = null;

let session = null;


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

const settingsButton =
    document.getElementById(
        "settingsButton"
    );

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
   تحميل بيانات القرآن
========================================= */

async function loadQuran() {

    try {

        const response =
            await fetch("./data/quran.json");

        if (!response.ok) {
            throw new Error(
                "تعذر تحميل بيانات القرآن"
            );
        }

        quranData =
            await response.json();

        populateSurahs();

    } catch (error) {

        console.error(error);

        showMessage(
            "تعذر تحميل بيانات القرآن حاليًا."
        );
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

    for (const surah of quranData) {

        const option =
            document.createElement("option");

        option.value =
            surah.number;

        option.textContent =
            surah.name;

        surahSelect.appendChild(option);
    }
}


/* =========================================
   اختيار الشيخ
========================================= */

reciterSelect.addEventListener(
    "change",
    handleReciterChange
);


function handleReciterChange() {

    const id =
        reciterSelect.value;

    selectedReciter =
        reciters[id] || null;

    selectedSurah = null;

    resetSurahSelection();

    updateTeacherMode();

    validateSetup();
}


/* =========================================
   اختيار السورة
========================================= */

surahSelect.addEventListener(
    "change",
    handleSurahChange
);


function handleSurahChange() {

    const number =
        Number(surahSelect.value);

    if (!selectedReciter || !number) {

        selectedSurah = null;

        resetAyahInputs();

        validateSetup();

        return;
    }

    selectedSurah =
        quranData.find(
            surah =>
                surah.number === number
        );

    if (!selectedSurah) {

        resetAyahInputs();

        validateSetup();

        return;
    }

    const availability =
        selectedReciter.surahs[
            String(number)
        ];

    if (!availability) {

        showAvailability(
            `سورة ${selectedSurah.name} غير متوفرة بصوت ${selectedReciter.name} حاليًا.`
        );

        disableAyahInputs();

        startButton.disabled = true;

        return;
    }

    hideAvailability();

    enableAyahInputs();

    fromAyah.max =
        availability.from;

    /*
        القيمة الحقيقية يجب أن تكون آخر آية
        متاحة لهذا الشيخ، وليس رقمًا عشوائيًا.
    */

    toAyah.max =
        availability.to;

    fromAyah.value =
        availability.from;

    toAyah.value =
        availability.to;

    validateSetup();
}


/* =========================================
   الآيات
========================================= */

fromAyah.addEventListener(
    "input",
    handleAyahRangeChange
);

toAyah.addEventListener(
    "input",
    handleAyahRangeChange
);


function handleAyahRangeChange() {

    if (!selectedSurah) {
        return;
    }

    const lastAyah =
        selectedSurah.ayahCount;

    let from =
        Number(fromAyah.value);

    let to =
        Number(toAyah.value);

    if (from < 1) {
        from = 1;
    }

    if (to < 1) {
        to = 1;
    }

    if (from > lastAyah) {
        from = lastAyah;
    }

    if (to > lastAyah) {
        to = lastAyah;
    }

    if (to < from) {
        to = from;
    }

    fromAyah.value = from;
    toAyah.value = to;

    validateSetup();
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
    }
);


/* =========================================
   وضع المعلم
========================================= */

function updateTeacherMode() {

    if (
        !selectedReciter ||
        !selectedReciter.teacherMode
    ) {

        teacherMode.checked = false;
        teacherMode.disabled = true;

        teacherModeField.classList.add(
            "is-disabled"
        );

        teacherModeDescription.textContent =
            "غير متوفر لهذا الشيخ";

        return;
    }

    teacherMode.disabled = false;

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
        !selectedReciter ||
        !selectedSurah
    ) {

        startButton.disabled = true;

        return;
    }

    const availability =
        selectedReciter.surahs[
            String(selectedSurah.number)
        ];

    if (!availability) {

        startButton.disabled = true;

        return;
    }

    const from =
        Number(fromAyah.value);

    const to =
        Number(toAyah.value);

    const validRange =
        from >= availability.from &&
        to <= availability.to &&
        from <= to;

    startButton.disabled =
        !validRange;
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
        !selectedReciter ||
        !selectedSurah
    ) {
        return;
    }

    const from =
        Number(fromAyah.value);

    const to =
        Number(toAyah.value);

    session = {

        reciter:
            selectedReciter,

        surah:
            selectedSurah,

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
   فتح عالم التحفيظ
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
        `سورة ${session.surah.name}`;

    renderCurrentAyah();

    updateSessionInfo();

    playPauseButton.textContent =
        "▶️";
}


/* =========================================
   الآية الحالية
========================================= */

function renderCurrentAyah() {

    const ayah =
        getCurrentAyah();

    if (!ayah) {

        currentAyahText.textContent =
            "—";

        return;
    }

    currentAyahText.innerHTML =
        `${ayah.text} <span class="ayah-number">۝${ayah.number}</span>`;
}


function getCurrentAyah() {

    if (!session) {
        return null;
    }

    return quranData
        .find(
            surah =>
                surah.number ===
                session.surah.number
        )
        ?.ayahs
        ?.find(
            ayah =>
                ayah.number ===
                session.currentAyah
        );
}


/* =========================================
   معلومات الجلسة
========================================= */

function updateSessionInfo() {

    if (!session) {
        return;
    }

    blockRepeatInfo.textContent =
        `المقطع ${session.currentBlockRepeat} / ${session.blockRepeat}`;

    ayahRepeatInfo.textContent =
        `الآية ${session.currentAyahRepeat} / ${session.ayahRepeat}`;
}


/* =========================================
   الآية السابقة
========================================= */

previousAyahButton.addEventListener(
    "click",
    () => {

        if (!session) {
            return;
        }

        if (
            session.currentAyah >
            session.fromAyah
        ) {

            stopPlayback();

            session.currentAyah--;

            session.currentAyahRepeat =
                1;

            renderCurrentAyah();

            updateSessionInfo();
        }
    }
);


/* =========================================
   الآية التالية
========================================= */

nextAyahButton.addEventListener(
    "click",
    () => {

        if (!session) {
            return;
        }

        if (
            session.currentAyah <
            session.toAyah
        ) {

            stopPlayback();

            session.currentAyah++;

            session.currentAyahRepeat =
                1;

            renderCurrentAyah();

            updateSessionInfo();
        }
    }
);


/* =========================================
   إعادة المقطع الحالي
========================================= */

restartBlockButton.addEventListener(
    "click",
    () => {

        if (!session) {
            return;
        }

        stopPlayback();

        /*
            مهم:
            نعيد إلى بداية المقطع
            لكن لا نعيد رقم تكرار المقطع.

            مثال:
            4 / 7 + الآية 5

            تصبح:
            4 / 7 + الآية 1
        */

        session.currentAyah =
            session.fromAyah;

        session.currentAyahRepeat =
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

        if (!session) {
            return;
        }

        if (session.playing) {

            pausePlayback();

        } else {

            playCurrentAyah();

        }
    }
);


function playCurrentAyah() {

    if (!session) {
        return;
    }

    session.playing = true;

    playPauseButton.textContent =
        "⏸️";

    /*
        محرك الصوت الحقيقي سيأتي هنا.
        لن نستخدم Audio API الآن
        قبل تثبيت بنية الملفات والـ manifest.
    */
}


function pausePlayback() {

    if (!session) {
        return;
    }

    session.playing = false;

    /*
        حسب المواصفة:
        عند العودة للتشغيل تبدأ الآية الحالية
        من أولها، مع الحفاظ على أرقام التكرار.
    */

    playPauseButton.textContent =
        "▶️";
}


function stopPlayback() {

    if (!session) {
        return;
    }

    session.playing = false;

    playPauseButton.textContent =
        "▶️";
}


/* =========================================
   الإعدادات من عالم التحفيظ
========================================= */

settingsButton.addEventListener(
    "click",
    returnToSetup
);

playerSettingsButton.addEventListener(
    "click",
    returnToSetup
);


function returnToSetup() {

    stopPlayback();

    memorizationScreen.classList.add(
        "hidden"
    );

    setupScreen.classList.remove(
        "hidden"
    );
}


/* =========================================
   أدوات الواجهة
========================================= */

function resetSurahSelection() {

    surahSelect.value = "";

    resetAyahInputs();

    hideAvailability();
}


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


function showMessage(message) {

    showAvailability(message);
}


/* =========================================
   البداية
========================================= */

disableAyahInputs();

loadQuran();
