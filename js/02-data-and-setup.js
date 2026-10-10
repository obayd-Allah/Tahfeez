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


