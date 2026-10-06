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

const CODE_VERSION = "CODE 14";


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
   Web Audio - Firefox فقط
========================================================= */

let firefoxAudioContext = null;

let firefoxGainNode = null;

let firefoxSource = null;

let firefoxSourceId = 0;

const firefoxBufferCache = new Map();


/* =========================================================
   Firefox AudioWorklet
   يحاول تغيير السرعة مع الحفاظ على طبقة الصوت
========================================================= */

let firefoxWorkletReady = false;

let firefoxWorkletPromise = null;

let firefoxStretchNode = null;


/* =========================================================
   كود AudioWorklet الخاص بـ Firefox
========================================================= */

const FIREFOX_WORKLET_CODE = `

class TahfeezTimeStretchProcessor extends AudioWorkletProcessor {

    constructor() {

        super();

        this.buffer = null;

        this.channels = 1;

        this.bufferLength = 0;

        this.startFrame = 0;

        this.endFrame = 0;

        this.position = 0;

        this.speed = 1;

        this.active = false;

        this.finished = false;

        this.grainSize = 2048;

        this.hopOut = 512;

        this.grainHopIn = 512;

        this.grains = [];

        this.nextGrainPosition = 0;

        this.outputPosition = 0;

        this.grainCounter = 0;

        this.sampleRate = sampleRate;

        this.port.onmessage = event => {

            const data = event.data || {};

            if (data.type === "buffer") {

                this.buffer = data.channels || null;

                this.channels =
                    this.buffer ?
                    this.buffer.length :
                    1;

                this.bufferLength =
                    this.buffer &&
                    this.buffer[0]
                        ? this.buffer[0].length
                        : 0;

                return;
            }


            if (data.type === "start") {

                this.startFrame =
                    Math.max(
                        0,
                        Number(data.startFrame) || 0
                    );

                this.endFrame =
                    Math.min(
                        this.bufferLength,
                        Number(data.endFrame) ||
                        this.bufferLength
                    );

                this.speed =
                    Math.min(
                        1.25,
                        Math.max(
                            0.75,
                            Number(data.speed) || 1
                        )
                    );

                this.position =
                    this.startFrame;

                this.outputPosition = 0;

                this.nextGrainPosition = 0;

                this.grains = [];

                this.grainCounter = 0;

                this.active = true;

                this.finished = false;

                return;
            }


            if (data.type === "speed") {

                this.speed =
                    Math.min(
                        1.25,
                        Math.max(
                            0.75,
                            Number(data.speed) || 1
                        )
                    );

                return;
            }


            if (data.type === "stop") {

                this.active = false;

                this.finished = true;

                this.grains = [];

                return;
            }
        };
    }


    createGrain() {

        if (
            !this.buffer ||
            !this.buffer[0] ||
            !this.bufferLength
        ) {
            return null;
        }


        const grainStart =
            Math.floor(
                this.position
            );


        if (
            grainStart >=
            this.endFrame
        ) {
            return null;
        }


        const length =
            Math.min(
                this.grainSize,
                this.endFrame -
                grainStart
            );


        if (length <= 0) {
            return null;
        }


        const grain = {

            start:
                grainStart,

            length,

            outputStart:
                this.nextGrainPosition,

            data:
                []
        };


        for (
            let channel = 0;
            channel < this.channels;
            channel++
        ) {

            const source =
                this.buffer[channel];


            const samples =
                new Float32Array(
                    length
                );


            for (
                let i = 0;
                i < length;
                i++
            ) {

                samples[i] =
                    source[
                        grainStart + i
                    ] || 0;
            }


            grain.data.push(
                samples
            );
        }


        this.position +=
            this.grainHopIn *
            this.speed;


        this.nextGrainPosition +=
            this.hopOut;


        this.grainCounter++;

        return grain;
    }


    process(inputs, outputs) {

        const output =
            outputs[0];


        if (
            !output ||
            !output[0]
        ) {
            return true;
        }


        const outputLength =
            output[0].length;


        for (
            let channel = 0;
            channel < output.length;
            channel++
        ) {

            output[channel].fill(0);
        }


        if (
            !this.active ||
            !this.buffer ||
            !this.buffer[0]
        ) {

            return true;
        }


        /*
            إنشاء حبيبات كافية للمخرج الحالي.
        */

        while (
            this.nextGrainPosition <
            this.outputPosition +
            outputLength +
            this.grainSize
        ) {

            const grain =
                this.createGrain();


            if (!grain) {
                break;
            }


            this.grains.push(
                grain
            );
        }


        /*
            تركيب الحبيبات باستخدام نافذة Hann.
        */

        for (
            const grain of this.grains
        ) {

            const grainOutputStart =
                grain.outputStart -
                this.outputPosition;


            for (
                let i = 0;
                i < grain.length;
                i++
            ) {

                const outIndex =
                    grainOutputStart + i;


                if (
                    outIndex < 0 ||
                    outIndex >= outputLength
                ) {
                    continue;
                }


                const phase =
                    grain.length <= 1
                        ? 1
                        :
                        i /
                        (grain.length - 1);


                const window =
                    0.5 -
                    0.5 *
                    Math.cos(
                        2 *
                        Math.PI *
                        phase
                    );


                for (
                    let channel = 0;
                    channel < output.length;
                    channel++
                ) {

                    const sourceChannel =
                        Math.min(
                            channel,
                            grain.data.length - 1
                        );


                    output[channel][outIndex] +=
                        grain.data[
                            sourceChannel
                        ][i] *
                        window;
                }
            }
        }


        this.outputPosition +=
            outputLength;


        /*
            حذف الحبيبات التي خرجت بالكامل.
        */

        this.grains =
            this.grains.filter(
                grain =>
                    grain.outputStart +
                    grain.length >
                    this.outputPosition
            );


        /*
            عندما نصل لنهاية الجزء الصوتي،
            نسمح للحبيبات الأخيرة بالخروج.
        */

        if (
            this.position >=
            this.endFrame &&
            this.grains.length === 0
        ) {

            if (!this.finished) {

                this.finished = true;

                this.active = false;

                this.port.postMessage({
                    type: "ended"
                });
            }
        }


        return true;
    }
}


registerProcessor(
    "tahfeez-time-stretch",
    TahfeezTimeStretchProcessor
);

`;


/* =========================================================
   إنشاء Worklet Firefox
========================================================= */

async function ensureFirefoxWorklet() {

    if (!isFirefox) {
        return false;
    }


    const context =
        getFirefoxAudioContext();


    if (!context) {
        return false;
    }


    if (firefoxWorkletReady) {
        return true;
    }


    if (firefoxWorkletPromise) {
        return firefoxWorkletPromise;
    }


    firefoxWorkletPromise =
        (async () => {

            try {

                if (
                    !context.audioWorklet ||
                    !context.audioWorklet.addModule
                ) {

                    throw new Error(
                        "AudioWorklet غير متوفر في Firefox."
                    );
                }


                const blob =
                    new Blob(
                        [
                            FIREFOX_WORKLET_CODE
                        ],
                        {
                            type:
                                "application/javascript"
                        }
                    );


                const url =
                    URL.createObjectURL(
                        blob
                    );


                try {

                    await context.audioWorklet.addModule(
                        url
                    );

                } finally {

                    URL.revokeObjectURL(
                        url
                    );
                }


                firefoxWorkletReady =
                    true;


                return true;

            } catch (error) {

                console.error(
                    "تعذر إنشاء Firefox AudioWorklet:",
                    error
                );


                firefoxWorkletReady =
                    false;


                return false;
            }
        })();


    return firefoxWorkletPromise;
}


/* =========================================================
   إنشاء AudioContext لـ Firefox
========================================================= */

function getFirefoxAudioContext() {

    if (!isFirefox) {
        return null;
    }


    if (firefoxAudioContext) {
        return firefoxAudioContext;
    }


    try {

        const AudioContextClass =
            window.AudioContext ||
            window.webkitAudioContext;


        if (!AudioContextClass) {
            throw new Error(
                "Web Audio API غير متوفر في Firefox."
            );
        }


        firefoxAudioContext =
            new AudioContextClass();


        firefoxGainNode =
            firefoxAudioContext.createGain();


        firefoxGainNode.gain.value =
            1;


        firefoxGainNode.connect(
            firefoxAudioContext.destination
        );


        return firefoxAudioContext;

    } catch (error) {

        console.error(
            "تعذر إنشاء Web Audio في Firefox:",
            error
        );


        firefoxAudioContext =
            null;

        firefoxGainNode =
            null;


        return null;
    }
}


/* =========================================================
   تشغيل / استئناف AudioContext
========================================================= */

async function resumeFirefoxAudioContext() {

    if (!isFirefox) {
        return true;
    }


    const context =
        getFirefoxAudioContext();


    if (!context) {
        return false;
    }


    try {

        if (context.state !== "running") {

            await context.resume();
        }


        return true;

    } catch (error) {

        console.error(
            "تعذر تشغيل AudioContext في Firefox:",
            error
        );


        return false;
    }
}


/* =========================================================
   إيقاف مصدر Firefox الحالي
========================================================= */

function stopFirefoxSource() {

    firefoxSourceId++;


    const source =
        firefoxSource;


    firefoxSource =
        null;


    if (!source) {
        return;
    }


    try {

        source.port.postMessage({
            type: "stop"
        });

    } catch (error) {}


    try {
        source.onprocessorerror = null;
    } catch (error) {}


    try {
        source.disconnect();
    } catch (error) {}
}


/* =========================================================
   تحويل AudioBuffer إلى بيانات قابلة للإرسال
========================================================= */

function getFirefoxBufferChannels(buffer) {

    const channels = [];


    const count =
        Math.max(
            1,
            Math.min(
                buffer.numberOfChannels || 1,
                2
            )
        );


    for (
        let channel = 0;
        channel < count;
        channel++
    ) {

        channels.push(
            new Float32Array(
                buffer.getChannelData(
                    channel
                )
            )
        );
    }


    return channels;
}


/* =========================================================
   تحميل وفك ضغط ملف صوت Firefox
========================================================= */

async function getFirefoxAudioBuffer(url) {

    if (
        firefoxBufferCache.has(url)
    ) {

        return firefoxBufferCache.get(url);
    }


    const context =
        getFirefoxAudioContext();


    if (!context) {
        throw new Error(
            "Web Audio API غير متوفر."
        );
    }


    const response =
        await fetch(url);


    if (!response.ok) {

        throw new Error(
            `تعذر تحميل ملف الصوت: ${response.status}`
        );
    }


    const arrayBuffer =
        await response.arrayBuffer();


    const audioBuffer =
        await context.decodeAudioData(
            arrayBuffer
        );


    firefoxBufferCache.set(
        url,
        audioBuffer
    );


    return audioBuffer;
}


/* =========================================================
   تغيير سرعة Firefox
========================================================= */

function configureFirefoxSourceSpeed(
    source,
    speed
) {

    if (!source) {
        return;
    }


    const safeSpeed =
        Math.min(
            1.25,
            Math.max(
                0.75,
                Number(speed) || 1
            )
        );


    try {

        source.port.postMessage({

            type:
                "speed",

            speed:
                safeSpeed
        });

    } catch (error) {

        console.warn(
            "تعذر تغيير سرعة Firefox:",
            error
        );
    }
}


/* =========================================================
   تشغيل الصوت حسب المتصفح
========================================================= */

function playAudioForCurrentBrowser(media) {

    if (!media) {
        return null;
    }


    /*
        Firefox يستخدم AudioWorklet
        من startCurrentSegment.
    */

    if (isFirefox) {

        return null;
    }


    /*
        باقي المتصفحات:
        لا تغيير عليها إطلاقًا.
    */

    try {
        return media.play();
    } catch (error) {
        throw error;
    }
}


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


/* =========================================================
   Media Session
========================================================= */

function setMediaSessionNone() {

    if (!("mediaSession" in navigator)) {
        return;
    }

    try {

        navigator.mediaSession.metadata =
            null;

        navigator.mediaSession.playbackState =
            "none";

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


    resetAudioElement();


    segmentIndex = 0;

    currentAudioType = "normal";

    state.session.currentAyahRepeat = 1;

    state.session.playing = false;

    playPauseButton.textContent = "▶️";

    setMediaSessionNone();
}


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

        surahSelect.disabled =
            true;

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


    surahSelect.disabled =
        false;
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


        if (
            state.session &&
            state.session.playing &&
            Number.isFinite(speed)
        ) {

            state.session.speed =
                Math.min(
                    1.25,
                    Math.max(
                        0.75,
                        speed
                    )
                );


            if (isFirefox) {

                configureFirefoxSourceSpeed(
                    firefoxStretchNode,
                    state.session.speed
                );

            } else {

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


/* =========================================================
   التحقق من الإعدادات
========================================================= */

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
            Number(speedRange.value),

        wait:
            Number(waitSelect.value),

        teacherMode:
            teacherMode.checked,

        playing:
            false
    };


    /*
        تجهيز AudioWorklet عند Firefox فقط.
    */

    if (isFirefox) {

        await ensureFirefoxWorklet();
    }


    await loadPausePoints();


    if (!state.session) {
        return;
    }


    openMemorizationScreen();
}


/* =========================================================
   شاشة التحفيظ
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


    setMediaSessionNone();
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
   الانتقال إلى آية أخرى
========================================================= */

async function navigateToAyah(targetAyah) {

    if (!state.session) {
        return;
    }


    const wasPlaying =
        state.session.playing;


    stopPlayback();


    state.session.currentAyah =
        targetAyah;


    state.session.currentAyahRepeat =
        1;


    renderCurrentAyah();

    updateSessionInfo();


    const navigationToken =
        playbackToken;


    if (wasPlaying) {

        state.session.playing =
            true;

        playPauseButton.textContent =
            "⏸️";
    }


    await loadPausePoints();


    if (
        !state.session ||
        navigationToken !== playbackToken
    ) {

        return;
    }


    if (wasPlaying) {

        playCurrentAyah(
            false,
            true
        );

    } else {

        state.session.playing =
            false;

        playPauseButton.textContent =
            "▶️";

        setMediaSessionNone();
    }
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

            navigateToAyah(
                state.session.currentAyah - 1
            );
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

            navigateToAyah(
                state.session.currentAyah + 1
            );
        }
    }
);


/* =========================================================
   إعادة بداية المقطع
========================================================= */

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


        state.session.currentBlockRepeat =
            1;


        loadPausePoints();


        renderCurrentAyah();

        updateSessionInfo();


        state.session.playing =
            false;


        playPauseButton.textContent =
            "▶️";


        setMediaSessionNone();
    }
);


/* =========================================================
   زر التشغيل
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

            playCurrentAyah(true);
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


    const ayahNumber =
        state.session.currentAyah;


    const cacheKey =
        `${reciter.id}_${surahNumber}_${ayahNumber}`;


    if (pausePointsCache.has(cacheKey)) {

        pausePoints =
            [
                ...pausePointsCache.get(
                    cacheKey
                )
            ];

        return;
    }


    try {

        const surahCacheKey =
            `${reciter.id}_${surahNumber}`;


        let allPauseData =
            pausePointsCache.get(
                `SURAH_${surahCacheKey}`
            );


        if (!allPauseData) {

            const response =
                await fetch(
                    `${reciter.audioBaseUrl}/pauses/${surahNumber}.json`
                );


            if (!response.ok) {
                return;
            }


            allPauseData =
                await response.json();


            pausePointsCache.set(
                `SURAH_${surahCacheKey}`,
                allPauseData
            );
        }


        const ayahData =
            allPauseData.find(
                item =>
                    Number(item.ayah) ===
                    Number(ayahNumber)
            );


        if (
            ayahData &&
            Array.isArray(
                ayahData.pauses
            )
        ) {

            const points =
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


            pausePointsCache.set(
                cacheKey,
                points
            );


            pausePoints =
                [...points];
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
   إعادة ضبط عنصر الصوت
========================================================= */

function resetAudioElement() {

    audioSegmentId++;


    if (isFirefox) {

        stopFirefoxSource();

    }


    beginInternalAudioAction();


    detachAudioEvents();


    try {
        audio.pause();
    } catch (error) {}


    try {
        audio.removeAttribute("src");
    } catch (error) {}


    try {
        audio.load();
    } catch (error) {}


    endInternalAudioActionSoon();
}


/* =========================================================
   تنظيف الموارد
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


    resetAudioElement();

    setMediaSessionNone();
}


/* =========================================================
   تشغيل الآية
========================================================= */

function playCurrentAyah(
    userInitiated = false,
    preservePlayingVisual = false
) {

    if (!state.session) {
        return;
    }


    playbackToken++;


    const token =
        playbackToken;


    clearPlaybackResources();


    if (preservePlayingVisual) {

        state.session.playing =
            true;

        playPauseButton.textContent =
            "⏸️";

    } else {

        state.session.playing =
            false;

        playPauseButton.textContent =
            "▶️";
    }


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    startCurrentSegment(
        token,
        userInitiated
    );
}


/* =========================================================
   حدود الجزء
========================================================= */

function getSegmentBounds(duration) {

    const totalSegments =
        pausePoints.length + 1;


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

        start:
            Math.max(
                0,
                start
            ),

        end:
            Math.min(
                duration,
                end
            )
    };
}


/* =========================================================
   تنظيف نقاط الوقف
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
   إعداد السرعة - HTMLAudio
   باقي المتصفحات فقط
========================================================= */

function configureAudioSpeed(
    media,
    speed
) {

    const safeSpeed =
        Math.min(
            1.25,
            Math.max(
                0.75,
                Number(speed) || 1
            )
        );


    /*
        Firefox لا يدخل هنا.
    */

    if (isFirefox) {
        return safeSpeed;
    }


    try {

        media.preservesPitch =
            true;

    } catch (error) {}


    try {

        media.webkitPreservesPitch =
            true;

    } catch (error) {}


    try {

        media.mozPreservesPitch =
            true;

    } catch (error) {}


    try {

        media.defaultPlaybackRate =
            safeSpeed;

    } catch (error) {}


    try {

        media.playbackRate =
            safeSpeed;

    } catch (error) {

        console.warn(
            "تعذر ضبط سرعة التشغيل:",
            error
        );
    }


    return safeSpeed;
}


/* =========================================================
   إيقاف صوت داخلي
========================================================= */

function pauseAudioInternally(media) {

    if (!media) {
        return;
    }


    beginInternalAudioAction();


    const oldPauseHandler =
        media.onpause;


    media.onpause =
        null;


    try {

        media.pause();

    } catch (error) {}


    setTimeout(
        () => {

            if (
                media === audio &&
                state.session &&
                state.session.playing
            ) {

            } else {

                try {

                    media.onpause =
                        oldPauseHandler;

                } catch (error) {}
            }


            endInternalAudioActionSoon();

        },
        0
    );
}


/* =========================================================
   إيقاف خارجي من النظام
========================================================= */

function handleExternalAudioStop() {

    if (internalAudioAction) {
        return;
    }


    if (!state.session) {
        return;
    }


    if (!state.session.playing) {
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


    resetAudioElement();


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    state.session.currentAyahRepeat =
        1;


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


    setMediaSessionNone();
}


/* =========================================================
   تشغيل Firefox باستخدام AudioWorklet
========================================================= */

async function startFirefoxWebAudioSegment(
    token,
    userInitiated = false
) {

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


    const thisSourceId =
        ++firefoxSourceId;


    try {

        const context =
            getFirefoxAudioContext();


        if (!context) {

            throw new Error(
                "Web Audio API غير متوفر في Firefox."
            );
        }


        const resumed =
            await resumeFirefoxAudioContext();


        if (!resumed) {

            throw new Error(
                "تعذر تشغيل AudioContext."
            );
        }


        if (
            !state.session ||
            token !== playbackToken ||
            thisSourceId !== firefoxSourceId
        ) {

            return;
        }


        const workletReady =
            await ensureFirefoxWorklet();


        if (!workletReady) {

            throw new Error(
                "تعذر تجهيز AudioWorklet في Firefox."
            );
        }


        const buffer =
            await getFirefoxAudioBuffer(
                url
            );


        if (
            !state.session ||
            token !== playbackToken ||
            thisSourceId !== firefoxSourceId
        ) {

            return;
        }


        const duration =
            Number(buffer.duration);


        if (
            !Number.isFinite(duration) ||
            duration <= 0
        ) {

            throw new Error(
                "مدة ملف الصوت غير صالحة."
            );
        }


        sanitizePausePoints(
            duration
        );


        const bounds =
            getSegmentBounds(
                duration
            );


        if (!bounds) {

            handleCurrentFirefoxSegmentFinished(
                token,
                null,
                0
            );

            return;
        }


        const start =
            bounds.start;


        const end =
            bounds.end;


        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {

            handleCurrentFirefoxSegmentFinished(
                token,
                null,
                0
            );

            return;
        }


        /*
            إنشاء AudioWorklet جديد لهذا الجزء.
        */

        const node =
            new AudioWorkletNode(
                context,
                "tahfeez-time-stretch",
                {
                    numberOfInputs: 0,
                    numberOfOutputs: 1,
                    outputChannelCount: [2]
                }
            );


        node.connect(
            firefoxGainNode
        );


        firefoxStretchNode =
            node;


        firefoxSource =
            node;


        const channels =
            getFirefoxBufferChannels(
                buffer
            );


        const channelArrays =
            channels.map(
                channel =>
                    new Float32Array(
                        channel
                    )
            );


        node.port.postMessage(
            {
                type:
                    "buffer",

                channels:
                    channelArrays
            },
            channelArrays.map(
                channel =>
                    channel.buffer
            )
        );


        const actualSpeed =
            Math.min(
                1.25,
                Math.max(
                    0.75,
                    Number(state.session.speed) || 1
                )
            );


        const startFrame =
            Math.floor(
                start *
                context.sampleRate
            );


        const endFrame =
            Math.floor(
                end *
                context.sampleRate
            );


        let finished =
            false;


        const finishOnce =
            () => {

                if (finished) {
                    return;
                }


                finished =
                    true;


                if (segmentTimer) {

                    clearTimeout(
                        segmentTimer
                    );

                    segmentTimer = null;
                }


                if (
                    !state.session ||
                    token !== playbackToken ||
                    thisSourceId !== firefoxSourceId
                ) {

                    return;
                }


                if (
                    firefoxSource === node
                ) {

                    firefoxSource =
                        null;

                    firefoxStretchNode =
                        null;
                }


                try {
                    node.disconnect();
                } catch (error) {}


                handleCurrentFirefoxSegmentFinished(
                    token,
                    node,
                    end - start
                );
            };


        node.port.onmessage =
            event => {

                if (
                    event.data &&
                    event.data.type ===
                    "ended"
                ) {

                    finishOnce();
                }
            };


        node.onprocessorerror =
            error => {

                console.error(
                    "Firefox AudioWorklet processor error:",
                    error
                );


                finishOnce();
            };


        node.port.postMessage({

            type:
                "start",

            startFrame:
                startFrame,

            endFrame:
                endFrame,

            speed:
                actualSpeed
        });


        /*
            الزمن المتوقع للجزء.
            نستخدم هامشًا إضافيًا لأن المعالجة
            الحبيبية تحتاج إلى إنهاء آخر الحبيبات.
        */

        const wallTime =
            (
                (end - start) /
                actualSpeed
            ) * 1000;


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );
        }


        segmentTimer =
            setTimeout(
                finishOnce,
                Math.max(
                    100,
                    wallTime + 1000
                )
            );


        state.session.playing =
            true;


        playPauseButton.textContent =
            "⏸️";


        if (
            "mediaSession" in navigator
        ) {

            try {

                navigator.mediaSession.playbackState =
                    "playing";

            } catch (error) {}
        }

    } catch (error) {

        if (
            !state.session ||
            token !== playbackToken
        ) {

            return;
        }


        console.error(
            "Firefox AudioWorklet error:",
            error
        );


        if (
            thisSourceId === firefoxSourceId
        ) {

            firefoxSource =
                null;

            firefoxStretchNode =
                null;
        }


        state.session.playing =
            false;


        playPauseButton.textContent =
            "▶️";


        setMediaSessionNone();


        showAvailability(
            "تعذر تشغيل ملف الصوت في Firefox."
        );
    }
}


/* =========================================================
   انتهاء جزء Firefox
========================================================= */

function handleCurrentFirefoxSegmentFinished(
    token,
    finishedSource,
    segmentDuration
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    if (
        finishedSource &&
        firefoxSource === finishedSource
    ) {

        firefoxSource =
            null;

        firefoxStretchNode =
            null;
    }


    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        startCurrentSegment(
            token,
            false
        );


        return;
    }


    currentAudioType =
        "normal";


    segmentIndex++;


    waitAfterSegment(
        segmentDuration,
        token
    );
}


/* =========================================================
   تشغيل الجزء الحالي
========================================================= */

function startCurrentSegment(
    token,
    userInitiated = false
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    /*
        =====================================================
        FIREFOX فقط
        =====================================================
    */

    if (isFirefox) {

        startFirefoxWebAudioSegment(
            token,
            userInitiated
        );


        return;
    }


    /*
        =====================================================
        باقي المتصفحات
        نفس المسار السابق
        =====================================================
    */


    const reciter =
        state.session.reciter;


    const surahNumber =
        state.session.surah.number;


    const ayahNumber =
        state.session.currentAyah;


    const url =
        `${reciter.audioBaseUrl}/${currentAudioType}/${surahNumber}/${ayahNumber}.mp3`;


    const thisSegmentId =
        ++audioSegmentId;


    const currentAudio =
        audio;


    beginInternalAudioAction();


    detachAudioEvents();


    try {
        currentAudio.pause();
    } catch (error) {}


    try {
        currentAudio.removeAttribute("src");
    } catch (error) {}


    try {
        currentAudio.load();
    } catch (error) {}


    currentAudio.src =
        url;


    const actualSpeed =
        Math.min(
            1.25,
            Math.max(
                0.75,
                Number(state.session.speed) || 1
            )
        );


    configureAudioSpeed(
        currentAudio,
        actualSpeed
    );


    endInternalAudioActionSoon();


    let finished =
        false;


    function isCurrentSegment() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisSegmentId === audioSegmentId
        );
    }


    function finishOnce() {

        if (finished) {
            return;
        }


        finished =
            true;


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }


        if (!isCurrentSegment()) {
            return;
        }


        beginInternalAudioAction();


        currentAudio.onpause =
            null;


        try {
            currentAudio.pause();
        } catch (error) {}


        endInternalAudioActionSoon();


        handleCurrentSegmentFinished(
            token,
            currentAudio
        );
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";


            if (
                "mediaSession" in navigator
            ) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onplaying =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";


            if (
                "mediaSession" in navigator
            ) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onloadedmetadata =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            const duration =
                Number(
                    currentAudio.duration
                );


            if (
                !Number.isFinite(duration) ||
                duration <= 0
            ) {

                finishOnce();

                return;
            }


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


            if (
                !Number.isFinite(start) ||
                !Number.isFinite(end) ||
                end <= start
            ) {

                finishOnce();

                return;
            }


            if (
                Math.abs(
                    currentAudio.currentTime -
                    start
                ) > 0.02
            ) {

                internalSeekAction =
                    true;


                try {

                    currentAudio.currentTime =
                        start;

                } catch (error) {

                    internalSeekAction =
                        false;

                    finishOnce();

                    return;
                }


                setTimeout(
                    () => {

                        internalSeekAction =
                            false;

                    },
                    0
                );
            }


            configureAudioSpeed(
                currentAudio,
                actualSpeed
            );


            const segmentDuration =
                end - start;


            const wallTime =
                (
                    segmentDuration /
                    actualSpeed
                ) * 1000;


            if (segmentTimer) {

                clearTimeout(
                    segmentTimer
                );
            }


            segmentTimer =
                setTimeout(
                    finishOnce,
                    Math.max(
                        50,
                        wallTime + 100
                    )
                );


            if (
                userInitiated &&
                segmentIndex === 0 &&
                currentAudioType === "normal"
            ) {

                return;
            }


            if (!currentAudio.paused) {
                return;
            }


            let playPromise;


            try {

                playPromise =
                    currentAudio.play();

            } catch (error) {

                console.error(
                    "تعذر تشغيل الجزء:",
                    error
                );


                if (!isCurrentSegment()) {
                    return;
                }


                state.session.playing =
                    false;


                playPauseButton.textContent =
                    "▶️";


                setMediaSessionNone();


                return;
            }


            if (
                playPromise &&
                typeof playPromise.catch ===
                "function"
            ) {

                playPromise.catch(
                    error => {

                        console.error(
                            "تعذر تشغيل الجزء بعد metadata:",
                            error
                        );


                        if (!isCurrentSegment()) {
                            return;
                        }


                        state.session.playing =
                            false;


                        playPauseButton.textContent =
                            "▶️";


                        setMediaSessionNone();


                        if (
                            error &&
                            error.name ===
                            "NotAllowedError"
                        ) {

                            showAvailability(
                                "تعذر متابعة تشغيل الصوت."
                            );
                        }
                    }
                );
            }
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !isCurrentSegment()
            ) {

                return;
            }


            const duration =
                Number(
                    currentAudio.duration
                );


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
                currentAudio.currentTime >=
                bounds.end - 0.015
            ) {

                finishOnce();
            }
        };


    currentAudio.onseeking =
        () => {

            if (internalSeekAction) {
                return;
            }


            if (internalAudioAction) {
                return;
            }


            if (!isCurrentSegment()) {
                return;
            }


            handleExternalSeekAttempt();
        };


    currentAudio.onended =
        () => {

            if (
                finished ||
                !isCurrentSegment()
            ) {

                return;
            }


            finishOnce();
        };


    currentAudio.onpause =
        () => {

            if (internalAudioAction) {
                return;
            }


            if (!isCurrentSegment()) {
                return;
            }


            if (state.session.playing) {

                handleExternalAudioStop();
            }
        };


    currentAudio.onerror =
        () => {

            if (!isCurrentSegment()) {
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


            setMediaSessionNone();


            console.error(
                "خطأ في ملف الصوت:",
                currentAudio.error
            );


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


    if (
        userInitiated &&
        segmentIndex === 0 &&
        currentAudioType === "normal"
    ) {

        let immediatePlayPromise;


        try {

            immediatePlayPromise =
                currentAudio.play();

        } catch (error) {

            console.error(
                "تعذر بدء الصوت:",
                error
            );


            state.session.playing =
                false;


            playPauseButton.textContent =
                "▶️";


            setMediaSessionNone();


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );


            return;
        }


        if (
            immediatePlayPromise &&
            typeof immediatePlayPromise.then ===
            "function"
        ) {

            immediatePlayPromise
                .then(
                    () => {

                        if (!isCurrentSegment()) {
                            return;
                        }


                        state.session.playing =
                            true;


                        playPauseButton.textContent =
                            "⏸️";


                        if (
                            "mediaSession" in navigator
                        ) {

                            try {

                                navigator.mediaSession.playbackState =
                                    "playing";

                            } catch (error) {}
                        }
                    }
                )
                .catch(
                    error => {

                        console.error(
                            "تعذر تشغيل الصوت:",
                            error
                        );


                        if (!isCurrentSegment()) {
                            return;
                        }


                        state.session.playing =
                            false;


                        playPauseButton.textContent =
                            "▶️";


                        setMediaSessionNone();


                        if (
                            error &&
                            error.name ===
                            "NotAllowedError"
                        ) {

                            showAvailability(
                                "اضغط زر التشغيل مرة أخرى للسماح بتشغيل الصوت."
                            );

                        } else {

                            showAvailability(
                                "تعذر تشغيل ملف الصوت."
                            );
                        }
                    }
                );
        }
    }
}


/* =========================================================
   انتهاء الجزء
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
        Number(
            finishedAudio.duration
        );


    const bounds =
        getSegmentBounds(
            duration
        );


    if (!bounds) {

        finishAyah(token);

        return;
    }


    const segmentDuration =
        Math.max(
            0,
            bounds.end -
            bounds.start
        );


    if (
        state.session.teacherMode &&
        currentAudioType === "normal"
    ) {

        currentAudioType =
            "teacher";


        startCurrentSegment(
            token,
            false
        );


        return;
    }


    currentAudioType =
        "normal";


    segmentIndex++;


    waitAfterSegment(
        segmentDuration,
        token
    );
}


/* =========================================================
   الانتظار
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
        Number(
            state.session.wait
        );


    if (
        !Number.isFinite(multiplier) ||
        multiplier <= 0 ||
        segmentDuration <= 0
    ) {

        continueAfterWait(token);

        return;
    }


    const waitTime =
        segmentDuration *
        multiplier *
        1000;


    state.session.playing =
        true;


    playPauseButton.textContent =
        "⏸️";


    setMediaSessionNone();


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


                continueAfterWait(token);

            },
            waitTime
        );
}


/* =========================================================
   بعد الانتظار
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


    if (
        segmentIndex <
        totalSegments
    ) {

        currentAudioType =
            "normal";


        startCurrentSegment(
            token,
            false
        );


        return;
    }


    finishAyah(token);
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


    if (
        state.session.currentAyahRepeat <
        state.session.ayahRepeat
    ) {

        state.session.currentAyahRepeat++;


        updateSessionInfo();


        playCurrentAyah(
            false,
            true
        );


        return;
    }


    state.session.currentAyahRepeat =
        1;


    if (
        state.session.currentAyah <
        state.session.toAyah
    ) {

        state.session.currentAyah++;


        renderCurrentAyah();

        updateSessionInfo();


        state.session.playing =
            true;


        playPauseButton.textContent =
            "⏸️";


        prepareNextAyahAndPlay(token);


        return;
    }


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


        state.session.playing =
            true;


        playPauseButton.textContent =
            "⏸️";


        prepareNextAyahAndPlay(token);


        return;
    }


    finishMemorization();
}


/* =========================================================
   تجهيز الآية التالية
========================================================= */

async function prepareNextAyahAndPlay(token) {

    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    state.session.playing =
        true;


    playPauseButton.textContent =
        "⏸️";


    await loadPausePoints();


    if (
        !state.session ||
        token !== playbackToken
    ) {

        return;
    }


    playCurrentAyah(
        false,
        true
    );
}


/* =========================================================
   انتهاء الجلسة
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


    setMediaSessionNone();
}


/* =========================================================
   زر الإيقاف المؤقت
========================================================= */

function pausePlayback() {

    if (!state.session) {
        return;
    }


    if (waitTimer) {

        clearTimeout(waitTimer);

        waitTimer = null;
    }


    if (segmentTimer) {

        clearTimeout(segmentTimer);

        segmentTimer = null;
    }


    playbackToken++;


    resetAudioElement();


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    state.session.playing =
        false;


    playPauseButton.textContent =
        "▶️";


    setMediaSessionNone();
}


/* =========================================================
   زر الإيقاف الكامل
========================================================= */

function stopPlayback() {

    playbackToken++;


    clearPlaybackResources();


    segmentIndex =
        0;


    currentAudioType =
        "normal";


    if (state.session) {

        state.session.playing =
            false;
    }


    playPauseButton.textContent =
        "▶️";


    setMediaSessionNone();
}


/* =========================================================
   العودة للإعدادات
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


            state.selectedReciter =
                state.reciters.find(
                    reciter =>
                        reciter.id ===
                        settings.reciter
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
                `${Number(settings.speed).toFixed(2)}×`;
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
   بدء التطبيق
========================================================= */

loadData();
