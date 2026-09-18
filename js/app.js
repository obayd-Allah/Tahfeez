/* =========================================
   Tahfeez - Settings Screen
========================================= */

"use strict";


/* =========================================
   Elements
========================================= */

const reciterSelect = document.getElementById("reciter");
const surahSelect = document.getElementById("surah");

const fromAyahInput = document.getElementById("fromAyah");
const toAyahInput = document.getElementById("toAyah");

const speedInput = document.getElementById("speed");
const speedValue = document.getElementById("speedValue");

const ayahRepeatValue = document.getElementById("ayahRepeatValue");
const ayahRepeatMinus = document.getElementById("ayahRepeatMinus");
const ayahRepeatPlus = document.getElementById("ayahRepeatPlus");

const paragraphRepeatValue =
    document.getElementById("paragraphRepeatValue");

const paragraphRepeatMinus =
    document.getElementById("paragraphRepeatMinus");

const paragraphRepeatPlus =
    document.getElementById("paragraphRepeatPlus");

const teacherMode =
    document.getElementById("teacherMode");

const startButton =
    document.getElementById("startButton");


/* =========================================
   Internal Settings
========================================= */

const settings = {

    reciter: reciterSelect.value,

    surah: Number(surahSelect.value),

    fromAyah: Number(fromAyahInput.value),

    toAyah: Number(toAyahInput.value),

    speed: Number(speedInput.value),

    ayahRepeat: 3,

    paragraphRepeat: 1,

    teacherMode: false

};


/* =========================================
   Helper
========================================= */

function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}


/* =========================================
   Speed
========================================= */

function updateSpeed() {

    settings.speed = Number(speedInput.value);

    speedValue.textContent =
        `${settings.speed.toFixed(2)}×`;
}

speedInput.addEventListener(
    "input",
    updateSpeed
);


/* =========================================
   Ayah Repeat
========================================= */

function updateAyahRepeat(value) {

    settings.ayahRepeat =
        clamp(value, 1, 20);

    ayahRepeatValue.textContent =
        settings.ayahRepeat;
}


ayahRepeatMinus.addEventListener(
    "click",
    () => {
        updateAyahRepeat(
            settings.ayahRepeat - 1
        );
    }
);


ayahRepeatPlus.addEventListener(
    "click",
    () => {
        updateAyahRepeat(
            settings.ayahRepeat + 1
        );
    }
);


/* =========================================
   Paragraph Repeat
========================================= */

function updateParagraphRepeat(value) {

    settings.paragraphRepeat =
        clamp(value, 1, 50);

    paragraphRepeatValue.textContent =
        settings.paragraphRepeat;
}


paragraphRepeatMinus.addEventListener(
    "click",
    () => {
        updateParagraphRepeat(
            settings.paragraphRepeat - 1
        );
    }
);


paragraphRepeatPlus.addEventListener(
    "click",
    () => {
        updateParagraphRepeat(
            settings.paragraphRepeat + 1
        );
    }
);


/* =========================================
   Reciter
========================================= */

reciterSelect.addEventListener(
    "change",
    () => {
        settings.reciter =
            reciterSelect.value;
    }
);


/* =========================================
   Surah
========================================= */

surahSelect.addEventListener(
    "change",
    () => {

        settings.surah =
            Number(surahSelect.value);

        /*
         * مؤقتًا:
         * لا نملك بعد بيانات عدد آيات
         * كل سورة.
         *
         * لذلك لا نقوم بتغيير الحدود
         * تلقائيًا في هذه المرحلة.
         */
    }
);


/* =========================================
   Ayah Range
========================================= */

fromAyahInput.addEventListener(
    "change",
    () => {

        let value =
            Number(fromAyahInput.value);

        if (!Number.isFinite(value) || value < 1) {
            value = 1;
        }

        fromAyahInput.value = value;

        settings.fromAyah = value;

        /*
         * لاحقًا سيتم التحقق من الحد
         * الأقصى الحقيقي لآيات السورة
         * من data/surahs.js.
         */
    }
);


toAyahInput.addEventListener(
    "change",
    () => {

        let value =
            Number(toAyahInput.value);

        if (!Number.isFinite(value) || value < 1) {
            value = 1;
        }

        toAyahInput.value = value;

        settings.toAyah = value;
    }
);


/* =========================================
   Teacher Mode
========================================= */

teacherMode.addEventListener(
    "change",
    () => {

        settings.teacherMode =
            teacherMode.checked;
    }
);


/* =========================================
   Start
========================================= */

startButton.addEventListener(
    "click",
    () => {

        /*
         * تحديث كل القيم قبل بدء الجلسة.
         */

        settings.reciter =
            reciterSelect.value;

        settings.surah =
            Number(surahSelect.value);

        settings.fromAyah =
            Number(fromAyahInput.value);

        settings.toAyah =
            Number(toAyahInput.value);

        settings.speed =
            Number(speedInput.value);

        settings.teacherMode =
            teacherMode.checked;


        /* -----------------------------
           Basic Validation
        ----------------------------- */

        if (
            !Number.isInteger(settings.fromAyah) ||
            settings.fromAyah < 1
        ) {

            alert("من فضلك أدخل رقم آية صحيح.");

            fromAyahInput.focus();

            return;
        }


        if (
            !Number.isInteger(settings.toAyah) ||
            settings.toAyah < 1
        ) {

            alert("من فضلك أدخل رقم آية صحيح.");

            toAyahInput.focus();

            return;
        }


        if (
            settings.fromAyah >
            settings.toAyah
        ) {

            alert(
                "آية البداية يجب أن تكون أصغر من أو تساوي آية النهاية."
            );

            fromAyahInput.focus();

            return;
        }


        /* -----------------------------
           Temporary Debug Output
        ----------------------------- */

        console.log(
            "Tahfeez Session Settings:",
            {
                ...settings
            }
        );


        /*
         * شاشة player.html لم ننشئها بعد.
         *
         * لذلك لن ننتقل إليها الآن.
         *
         * عندما نصل إلى المرحلة الثانية
         * سيصبح هنا الانتقال إلى Player.
         */

        alert(
            "تم حفظ إعدادات جلسة التحفيظ بنجاح 📖"
        );
    }
);


/* =========================================
   Initial UI
========================================= */

updateSpeed();
updateAyahRepeat(settings.ayahRepeat);
updateParagraphRepeat(settings.paragraphRepeat);
