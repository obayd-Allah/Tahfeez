const state = {
    quran: [],
    surahs: [],
    reciters: [],
    selectedReciter: null,
    selectedSurah: null,
    session: null
};


/* =========================================================
   رقم النسخة المؤقت
========================================================= */

const CODE_VERSION = "CODE 32";


/* =========================================================
   مربع اختبار تحميل النسخة
========================================================= */

(function createTemporaryVersionBox() {

    const box = document.createElement("div");

    box.textContent = CODE_VERSION;
    box.id = "temporaryCodeVersion";

    box.style.position = "fixed";
    box.style.top = "8px";
    box.style.left = "8px";
    box.style.zIndex = "999999";
    box.style.padding = "4px 8px";
    box.style.borderRadius = "8px";
    box.style.background = "#222";
    box.style.color = "#fff";
    box.style.fontSize = "11px";
    box.style.fontFamily = "Arial, sans-serif";
    box.style.fontWeight = "bold";
    box.style.opacity = "0.85";
    box.style.pointerEvents = "none";

    document.body.appendChild(box);

})();


/* =========================================================
   نظام الصوت
========================================================= */

const audio = new Audio();

audio.preload = "auto";
audio.controls = false;

try {
    audio.disableRemotePlayback = true;
} catch (error) {}


/* =========================================================
   FIREFOX
========================================================= */

const isFirefox =
    /firefox/i.test(navigator.userAgent);


/* =========================================================
   MI BROWSER
========================================================= */

const isMiBrowser =
    /MiuiBrowser|Mi Browser/i.test(
        navigator.userAgent
    );


/* =========================================================
   إخفاء التحكم في السرعة في Firefox
========================================================= */

function hideFirefoxSpeedControl() {

    if (!isFirefox) {
        return;
    }

    try {

        if (speedRange) {
            speedRange.style.display = "none";
            speedRange.disabled = true;
        }

        if (speedValue) {
            speedValue.style.display = "none";
        }

        if (speedRange) {

            const candidates = [
                speedRange.closest("label"),
                speedRange.closest(".setting"),
                speedRange.closest(".setting-item"),
                speedRange.closest(".control-group"),
                speedRange.closest(".form-group"),
                speedRange.parentElement
            ];

            for (const element of candidates) {

                if (!element) {
                    continue;
                }

                const text =
                    (element.textContent || "").trim();

                if (
                    element === speedRange.parentElement ||
                    /سرعة|speed/i.test(text)
                ) {
                    element.style.display = "none";
                    break;
                }
            }
        }

    } catch (error) {

        console.warn(
            "تعذر إخفاء تحكم السرعة في Firefox:",
            error
        );
    }
}


/* =========================================================
   حالة التشغيل
========================================================= */

let audioSegmentId = 0;

let internalAudioAction = false;

let internalAudioActionDepth = 0;

let internalSeekAction = false;


/* =========================================================
   بيانات التشغيل
========================================================= */

let pausePoints = [];

let pausePointsCache = new Map();

let segmentIndex = 0;

let currentAudioType = "normal";

let waitTimer = null;

let segmentTimer = null;

/*
    مؤقت احتياطي لنهاية الآية في Firefox.
*/
let firefoxEndTimer = null;

let playbackToken = 0;


/* =========================================================
   أدوات العمليات الداخلية
========================================================= */

function beginInternalAudioAction() {

    internalAudioActionDepth++;

    internalAudioAction = true;
}


function endInternalAudioActionSoon() {

    setTimeout(
        () => {

            internalAudioActionDepth =
                Math.max(
                    0,
                    internalAudioActionDepth - 1
                );

            internalAudioAction =
                internalAudioActionDepth > 0;

        },
        0
    );
}


function detachAudioEvents() {

    audio.onplay = null;
    audio.onplaying = null;
    audio.onloadedmetadata = null;
    audio.ondurationchange = null;
    audio.onloadeddata = null;
    audio.oncanplay = null;
    audio.ontimeupdate = null;
    audio.onended = null;
    audio.onerror = null;
    audio.onpause = null;
    audio.onemptied = null;
    audio.onseeking = null;
    audio.onseeked = null;
}


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

if (isFirefox) {
    hideFirefoxSpeedControl();
}

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

function setMediaSessionNone() {

    if (!("mediaSession" in navigator)) {
        return;
    }

    try {

        navigator.mediaSession.metadata = null;

        navigator.mediaSession.playbackState = "none";

    } catch (error) {

        console.warn(
            "تعذر ضبط Media Session:",
            error
        );
    }
}


function setupMediaSessionHandlers() {

    if (!("mediaSession" in navigator)) {
        return;
    }

    try {

        navigator.mediaSession.setActionHandler(
            "play",
            () => {

                if (!state.session) {
                    return;
                }

                if (!state.session.playing) {
                    playCurrentAyah(true);
                }

            }
        );


        navigator.mediaSession.setActionHandler(
            "pause",
            () => {

                if (!state.session) {
                    return;
                }

                if (state.session.playing) {
                    pausePlayback();
                }

            }
        );


        try {

            navigator.mediaSession.setActionHandler(
                "stop",
                () => {
                    handleExternalAudioStop();
                }
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "seekbackward",
                () => {
                    handleExternalSeekAttempt();
                }
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "seekforward",
                () => {
                    handleExternalSeekAttempt();
                }
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "previoustrack",
                null
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "nexttrack",
                null
            );

        } catch (error) {}


        try {

            navigator.mediaSession.setActionHandler(
                "seekto",
                () => {
                    handleExternalSeekAttempt();
                }
            );

        } catch (error) {}

    } catch (error) {

        console.warn(
            "تعذر إعداد Media Session:",
            error
        );
    }
}


setupMediaSessionHandlers();

setMediaSessionNone();


/* =========================================================
   محاولة تغيير الموضع خارجيًا
========================================================= */

function handleExternalSeekAttempt() {

    if (!state.session) {
        return;
    }

    playbackToken++;

    if (waitTimer) {
        clearTimeout(waitTimer);
        waitTimer = null;
    }

    if (segmentTimer) {
        clearTimeout(segmentTimer);
        segmentTimer = null;
    }

    if (firefoxEndTimer) {
        clearTimeout(firefoxEndTimer);
        firefoxEndTimer = null;
    }

    resetAudioElement();

    segmentIndex = 0;
    currentAudioType = "normal";

    state.session.currentAyahRepeat = 1;
    state.session.playing = false;

    playPauseButton.textContent = "▶️";

    setMediaSessionNone();
}


