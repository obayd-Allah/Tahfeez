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
