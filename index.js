/* =========================================================
   تحفيظ القرآن — Game UI
   index.js
   ========================================================= */

/* =========================================================
   1) الإعدادات العامة
   ========================================================= */

const DATA_URL = "data/quran.json";

const state = {
  data: null,

  selectedSurah: null,

  fromAyah: 1,
  toAyah: 1,

  speed: 1,

  wait: "medium",

  ayahRepeat: 1,

  paragraphRepeat: 1,

  teacherMode: false,

  currentAyah: 1,

  currentParagraphStart: 1,

  currentParagraphEnd: 1,

  currentAyahRepeat: 1,

  currentParagraphRepeat: 1,

  isPlaying: false,

  isWaiting: false,

  waitTimer: null,

  playbackToken: 0,

  currentAudioMode: "sheikh",

  currentPauseIndex: 0,

  playerStarted: false
};


/* =========================================================
   2) عناصر الصفحة
   ========================================================= */

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];


/* الشاشات */

const screens = {
  main: $("#mainScreen"),
  surah: $("#surahScreen"),
  fromAyah: $("#fromAyahScreen"),
  toAyah: $("#toAyahScreen"),
  paragraph: $("#paragraphRepeatScreen"),
  player: $("#playerScreen")
};


/* الصوت */

const audio = $("#audioPlayer");


/* =========================================================
   3) تشغيل عند فتح الصفحة
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);


async function init() {

  setupMainEvents();
  setupNavigationEvents();
  setupPlayerEvents();

  updateAyahRepeatUI();
  updateParagraphRepeatUI();
  updateSpeedUI();
  updateWaitUI();
  updateTeacherUI();

  await loadQuranData();
}


/* =========================================================
   4) تحميل quran.json
   ========================================================= */

async function loadQuranData() {

  try {

    showLoading(
      screens.main,
      "جاري تجهيز عالم التحفيظ..."
    );

    const response = await fetch(
      `${DATA_URL}?v=${Date.now()}`
    );

    if (!response.ok) {
      throw new Error(
        `HTTP ${response.status}`
      );
    }

    state.data = await response.json();

    validateData();

    const firstSurah = getSurahs()[0];

    if (firstSurah) {

      state.selectedSurah = firstSurah;

      state.fromAyah = 1;
      state.toAyah = getAyahCount(firstSurah);

      updateMainSelectionUI();
    }

    showScreen("main");

  } catch (error) {

    console.error(
      "فشل تحميل quran.json:",
      error
    );

    showError(
      screens.main,
      "تعذر تحميل بيانات القرآن. تأكد أن ملف data/quran.json موجود."
    );
  }
}


/* =========================================================
   5) التحقق من البيانات
   ========================================================= */

function validateData() {

  if (!state.data) {
    throw new Error("بيانات القرآن فارغة");
  }

  /*
    الشكل الأساسي المتوقع:

    {
      "surahs": [...]
    }

    أو:

    {
      "surahs": {
        "93": {...},
        "94": {...}
      }
    }
  */

  if (!state.data.surahs) {
    throw new Error(
      "quran.json لا يحتوي على surahs"
    );
  }
}


/* =========================================================
   6) الحصول على السور
   ========================================================= */

function getSurahs() {

  if (!state.data?.surahs) {
    return [];
  }

  if (Array.isArray(state.data.surahs)) {
    return state.data.surahs;
  }

  return Object.entries(state.data.surahs)
    .map(([id, surah]) => ({
      id,
      ...surah
    }));
}


/* =========================================================
   7) أدوات السورة
   ========================================================= */

function getSurahById(id) {

  return getSurahs().find(
    surah => String(surah.id) === String(id)
  );
}


function getSelectedSurah() {

  return state.selectedSurah;
}


function getAyahCount(surah) {

  if (!surah) {
    return 0;
  }

  if (Number.isFinite(Number(surah.ayahCount))) {
    return Number(surah.ayahCount);
  }

  if (Array.isArray(surah.ayahs)) {
    return surah.ayahs.length;
  }

  if (typeof surah.ayahs === "object") {
    return Object.keys(surah.ayahs).length;
  }

  return 0;
}


/* =========================================================
   8) الحصول على الآية
   ========================================================= */

function getAyah(surah, number) {

  if (!surah) {
    return null;
  }

  if (Array.isArray(surah.ayahs)) {

    return (
      surah.ayahs.find(
        ayah =>
          Number(
            ayah.number ??
            ayah.id ??
            ayah.ayah
          ) === Number(number)
      ) ||
      surah.ayahs[number - 1] ||
      null
    );
  }

  if (typeof surah.ayahs === "object") {

    return (
      surah.ayahs[number] ??
      surah.ayahs[String(number)] ??
      null
    );
  }

  return null;
}


/* =========================================================
   9) نص الآية
   ========================================================= */

function getAyahText(number) {

  const surah = getSelectedSurah();

  const ayah = getAyah(
    surah,
    number
  );

  if (!ayah) {
    return `الآية ${number}`;
  }

  return (
    ayah.text ??
    ayah.ayahText ??
    ayah.arabic ??
    `الآية ${number}`
  );
}


/* =========================================================
   10) بيانات القارئ
   ========================================================= */

function getReciterData() {

  const surah = getSelectedSurah();

  if (!surah) {
    return null;
  }

  /*
    سنجعل JSON مرنًا حتى لا نضطر
    لتغيير JavaScript لاحقًا.
  */

  if (surah.reciters) {

    if (surah.reciters.osama) {
      return surah.reciters.osama;
    }

    const firstKey =
      Object.keys(surah.reciters)[0];

    if (firstKey) {
      return surah.reciters[firstKey];
    }
  }

  if (surah.audio) {
    return surah;
  }

  return null;
}


/* =========================================================
   11) الحصول على رابط التسجيل
   ========================================================= */

function getAudioUrl(mode = "sheikh") {

  const reciter = getReciterData();

  if (!reciter) {
    return null;
  }

  /*
    الوضع الطبيعي
  */
if (mode === "sheikh") {
  if (reciter.audio && typeof reciter.audio === "object") {
    return reciter.audio.sheikh ?? reciter.audio.normal ?? null;
  }

  return reciter.audio
    ?? reciter.sheikhAudio
    ?? reciter.normalAudio
    ?? null;
}

if (reciter.audio && typeof reciter.audio === "object") {
  return reciter.audio.mo3allem
    ?? reciter.audio.teacher
    ?? null;
}

return reciter.mo3allemAudio
  ?? reciter.teacherAudio
  ?? reciter.moallemAudio
  ?? null;
}


/* =========================================================
   12) بيانات نقاط الوقف
   ========================================================= */

function getPauseData() {

  const reciter = getReciterData();

  if (!reciter) {
    return [];
  }

  return (
    reciter.ayahPauses ??
    reciter.pausePoints ??
    reciter.pauses ??
    []
  );
}


/* =========================================================
   13) استخراج نقاط الوقف للآية
   ========================================================= */

function getAyahPause(number) {

  const pauses = getPauseData();

  /*
    يدعم مستقبلًا أكثر من شكل.

    مثال:

    "ayahPauses": {
      "1": [2.8, 5.4],
      "2": [3.1]
    }

    أو:

    "ayahPauses": [
      [2.8, 5.4],
      [3.1]
    ]
  */

  if (Array.isArray(pauses)) {

    const item =
      pauses[number - 1];

    if (Array.isArray(item)) {
      return item;
    }

    if (
      item &&
      typeof item === "object" &&
      Array.isArray(item.points)
    ) {
      return item.points;
    }
  }

  if (
    pauses &&
    typeof pauses === "object" &&
    !Array.isArray(pauses)
  ) {

    const item =
      pauses[number] ??
      pauses[String(number)];

    if (Array.isArray(item)) {
      return item;
    }

    if (
      item &&
      typeof item === "object" &&
      Array.isArray(item.points)
    ) {
      return item.points;
    }
  }

  return [];
}


/* =========================================================
   14) أحداث الشاشة الرئيسية
   ========================================================= */

function setupMainEvents() {

  $("#surahButton")?.addEventListener(
    "click",
    () => {
      renderSurahList();
      showScreen("surah");
    }
  );


  $("#fromAyahButton")?.addEventListener(
    "click",
    () => {

      if (!state.selectedSurah) {
        return;
      }

      renderAyahGrid("from");
      showScreen("fromAyah");
    }
  );


  $("#toAyahButton")?.addEventListener(
    "click",
    () => {

      if (!state.selectedSurah) {
        return;
      }

      renderAyahGrid("to");
      showScreen("toAyah");
    }
  );


  $("#paragraphRepeatButton")?.addEventListener(
    "click",
    () => {

      renderParagraphRepeatGrid();
      showScreen("paragraph");
    }
  );


  $$("#speedOptions .option-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.speed =
            Number(
              button.dataset.speed
            );

          updateSpeedUI();
        }
      );
    });


  $$("#waitOptions .option-button")
    .forEach(button => {

      button.addEventListener(
        "click",
        () => {

          state.wait =
            button.dataset.wait;

          updateWaitUI();
        }
      );
    });


  $("#ayahRepeatMinus")?.addEventListener(
    "click",
    () => {

      if (state.ayahRepeat > 1) {

        state.ayahRepeat--;

        animateButton(
          $("#ayahRepeatMinus")
        );
      }

      updateAyahRepeatUI();
    }
  );


  $("#ayahRepeatPlus")?.addEventListener(
    "click",
    () => {

      state.ayahRepeat++;

      animateButton(
        $("#ayahRepeatPlus")
      );

      updateAyahRepeatUI();
    }
  );


  $("#teacherToggle")?.addEventListener(
    "click",
    () => {

      state.teacherMode =
        !state.teacherMode;

      updateTeacherUI();
    }
  );


  $("#startButton")?.addEventListener(
    "click",
    startPlayer
  );
}


/* =========================================================
   15) التنقل
   ========================================================= */

function setupNavigationEvents() {

  $("#surahBackButton")?.addEventListener(
    "click",
    () => showScreen("main")
  );


  $("#fromAyahBackButton")?.addEventListener(
    "click",
    () => showScreen("main")
  );


  $("#toAyahBackButton")?.addEventListener(
    "click",
    () => showScreen("main")
  );


  $("#paragraphBackButton")?.addEventListener(
    "click",
    () => showScreen("main")
  );
}


/* =========================================================
   16) أحداث المشغل
   ========================================================= */

function setupPlayerEvents() {

  $("#playerBackButton")?.addEventListener(
    "click",
    () => {

      stopPlayback(false);

      showScreen("main");
    }
  );


  $("#previousAyahButton")?.addEventListener(
    "click",
    previousAyah
  );


  $("#playPauseButton")?.addEventListener(
    "click",
    togglePlayPause
  );


  $("#nextAyahButton")?.addEventListener(
    "click",
    nextAyah
  );


  $("#stopButton")?.addEventListener(
    "click",
    () => stopPlayback(true)
  );


  audio?.addEventListener(
    "ended",
    handleAudioEnded
  );


  audio?.addEventListener(
    "error",
    handleAudioError
  );
}


/* =========================================================
   17) شاشة السور
   ========================================================= */

function renderSurahList() {

  const container =
    $("#surahList");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const surahs = getSurahs();

  if (!surahs.length) {

    container.innerHTML = `
      <div class="empty-state">
        لا توجد بيانات للسور.
      </div>
    `;

    return;
  }

  surahs.forEach(
    (surah, index) => {

      const number =
        surah.number ??
        surah.id ??
        index + 1;

      const name =
        surah.name ??
        surah.arabicName ??
        `السورة ${number}`;

      const count =
        getAyahCount(surah);

      const button =
        document.createElement("button");

      button.type = "button";

      button.className =
        "surah-item";

      button.innerHTML = `
        <span class="surah-number">
          ${escapeHtml(number)}
        </span>

        <span class="surah-info">

          <span class="surah-name">
            ${escapeHtml(name)}
          </span>

          <span class="surah-count">
            ${count} آية
          </span>

        </span>

        <span class="surah-arrow">
          ‹
        </span>
      `;

      button.addEventListener(
        "click",
        () => {

          selectSurah(surah);

          showScreen("main");
        }
      );

      container.appendChild(button);
    }
  );
}


/* =========================================================
   18) اختيار السورة
   ========================================================= */

function selectSurah(surah) {

  state.selectedSurah =
    surah;

  state.fromAyah = 1;

  state.toAyah =
    getAyahCount(surah);

  updateMainSelectionUI();
}


/* =========================================================
   19) شاشة اختيار الآية
   ========================================================= */

function renderAyahGrid(type) {

  const container =
    type === "from"
      ? $("#fromAyahGrid")
      : $("#toAyahGrid");

  if (!container) {
    return;
  }

  container.innerHTML = "";

  const surah =
    getSelectedSurah();

  if (!surah) {
    return;
  }

  const count =
    getAyahCount(surah);

  const label =
    type === "from"
      ? $("#fromAyahSurahLabel")
      : $("#toAyahSurahLabel");

  if (label) {

    label.textContent =
      surah.name ??
      surah.arabicName ??
      "";
  }

  for (
    let number = 1;
    number <= count;
    number++
  ) {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "ayah-number-button";

    const selected =
      type === "from"
        ? number === state.fromAyah
        : number === state.toAyah;

    if (selected) {
      button.classList.add("selected");
    }

    button.textContent =
      number;

    button.addEventListener(
      "click",
      () => {

        if (type === "from") {

          state.fromAyah =
            number;

          /*
            لا نسمح بأن تكون
            البداية بعد النهاية.
          */

          if (
            state.toAyah <
            state.fromAyah
          ) {

            state.toAyah =
              state.fromAyah;
          }

        } else {

          /*
            لا نسمح بأن تكون
            النهاية قبل البداية.
          */

          if (
            number <
            state.fromAyah
          ) {

            return;
          }

          state.toAyah =
            number;
        }

        updateMainSelectionUI();

        showScreen("main");
      }
    );

    container.appendChild(button);
  }
}


/* =========================================================
   20) شاشة تكرار الفقرة
   ========================================================= */

function renderParagraphRepeatGrid() {

  const container =
    $("#paragraphRepeatGrid");

  if (!container) {
    return;
  }

  const options = [
    {
      value: 1,
      text: "بدون تكرار"
    },

    {
      value: 2,
      text: "2"
    },

    {
      value: 3,
      text: "3"
    },

    {
      value: 4,
      text: "4"
    },

    {
      value: 5,
      text: "5"
    },

    {
      value: 6,
      text: "6"
    },

    {
      value: 7,
      text: "7"
    },

    {
      value: 8,
      text: "8"
    },

    {
      value: 9,
      text: "9"
    },

    {
      value: 10,
      text: "10"
    },

    {
      value: 15,
      text: "15"
    },

    {
      value: 20,
      text: "20"
    },

    {
      value: 25,
      text: "25"
    },

    {
      value: 30,
      text: "30"
    },

    {
      value: "infinite",
      text: "♾️"
    }
  ];

  container.innerHTML = "";

  options.forEach(option => {

    const button =
      document.createElement("button");

    button.type = "button";

    button.className =
      "paragraph-repeat-option";

    button.dataset.value =
      option.value;

    if (
      String(state.paragraphRepeat) ===
      String(option.value)
    ) {

      button.classList.add("selected");
    }

    if (
      option.value === "infinite"
    ) {

      button.innerHTML = `
        ♾️ بدون توقف
        <small>
          يستمر حتى الضغط على إيقاف
        </small>
      `;

    } else {

      button.innerHTML = `
        ${escapeHtml(option.text)}

        ${
          option.value === 1
            ? "<small>مرة واحدة</small>"
            : "<small>مرات</small>"
        }
      `;
    }

    button.addEventListener(
      "click",
      () => {

        state.paragraphRepeat =
          option.value;

        updateParagraphRepeatUI();

        showScreen("main");
      }
    );

    container.appendChild(button);
  });
}


/* =========================================================
   21) تحديث واجهة الإعدادات
   ========================================================= */

function updateMainSelectionUI() {

  const surah =
    getSelectedSurah();

  if (!surah) {
    return;
  }

  const name =
    surah.name ??
    surah.arabicName ??
    "—";

  $("#surahName").textContent =
    name;

  $("#fromAyahValue").textContent =
    state.fromAyah;

  $("#toAyahValue").textContent =
    state.toAyah;
}


function updateAyahRepeatUI() {

  const value =
    $("#ayahRepeatValue");

  const subtext =
    $("#ayahRepeatSubtext");

  if (!value) {
    return;
  }

  if (state.ayahRepeat <= 1) {

    value.textContent =
      "لا تكرار";

    if (subtext) {
      subtext.textContent =
        "مرة واحدة";
    }

  } else {

    value.textContent =
      state.ayahRepeat;

    if (subtext) {
      subtext.textContent =
        "تكرار الآية";
    }
  }
}


function updateParagraphRepeatUI() {

  const value =
    $("#paragraphRepeatValue");

  if (!value) {
    return;
  }

  if (
    state.paragraphRepeat ===
    "infinite"
  ) {

    value.textContent =
      "♾️ بدون توقف";

  } else if (
    Number(state.paragraphRepeat) === 1
  ) {

    value.textContent =
      "بدون تكرار";

  } else {

    value.textContent =
      `${state.paragraphRepeat} مرات`;
  }
}


function updateSpeedUI() {

  $$("#speedOptions .option-button")
    .forEach(button => {

      const selected =
        Number(button.dataset.speed) ===
        Number(state.speed);

      button.classList.toggle(
        "selected",
        selected
      );
    });
}


function updateWaitUI() {

  $$("#waitOptions .option-button")
    .forEach(button => {

      button.classList.toggle(
        "selected",
        button.dataset.wait ===
        state.wait
      );
    });
}


function updateTeacherUI() {

  const toggle =
    $("#teacherToggle");

  if (!toggle) {
    return;
  }

  toggle.setAttribute(
    "aria-pressed",
    String(state.teacherMode)
  );
}


/* =========================================================
   22) بدء المشغل
   ========================================================= */

async function startPlayer() {

  if (!state.selectedSurah) {
    return;
  }

  if (
    state.fromAyah >
    state.toAyah
  ) {

    alert(
      "اختر نطاق آيات صحيحًا."
    );

    return;
  }

  /*
    نبدأ دائمًا من أول آية
    في الفقرة.
  */

  state.currentParagraphStart =
    state.fromAyah;

  state.currentParagraphEnd =
    state.toAyah;

  state.currentAyah =
    state.fromAyah;

  state.currentAyahRepeat =
    1;

  state.currentParagraphRepeat =
    1;

  state.playerStarted =
    true;

  state.currentPauseIndex =
    0;

  state.currentAudioMode =
    "sheikh";

  clearWaitTimer();

  state.playbackToken++;

  updatePlayerUI();

  showScreen("player");

  await playCurrentAyah();
}


/* =========================================================
   23) تشغيل الآية الحالية
   ========================================================= */

async function playCurrentAyah() {

  const token =
    state.playbackToken;

  state.isPlaying =
    false;

  state.isWaiting =
    false;

  clearWaitTimer();

  state.currentPauseIndex =
    0;

  state.currentAudioMode =
    "sheikh";

  updatePlayerUI();

  const url =
    getAudioUrl("sheikh");

  if (!url) {

    setStatus(
      "لا يوجد تسجيل للقارئ في بيانات هذه السورة.",
      "error"
    );

    return;
  }

  /*
    نبدأ التسجيل الطبيعي.
  */

  try {

    await loadAudio(url);

    if (
      token !==
      state.playbackToken
    ) {
      return;
    }

    audio.currentTime = 0;

    audio.playbackRate =
      state.speed;

    state.isPlaying =
      true;

    updatePlayButton();

    setStatus(
      getPlayingStatus(),
      "playing"
    );

    await audio.play();

  } catch (error) {

    console.error(
      "فشل تشغيل الصوت:",
      error
    );

    setStatus(
      "تعذر تشغيل التسجيل.",
      "error"
    );
  }
}


/* =========================================================
   24) تحميل ملف صوتي
   ========================================================= */

function loadAudio(url) {

  return new Promise(
    (resolve, reject) => {

      if (
        audio.src ===
        new URL(
          url,
          window.location.href
        ).href
      ) {

        resolve();
        return;
      }

      const onLoaded = () => {

        cleanup();

        resolve();
      };

      const onError = () => {

        cleanup();

        reject(
          new Error(
            "Audio loading failed"
          )
        );
      };

      const cleanup = () => {

        audio.removeEventListener(
          "canplay",
          onLoaded
        );

        audio.removeEventListener(
          "error",
          onError
        );
      };

      audio.addEventListener(
        "canplay",
        onLoaded
      );

      audio.addEventListener(
        "error",
        onError
      );

      audio.src = url;

      audio.load();
    }
  );
}


/* =========================================================
   25) تشغيل / إيقاف مؤقت
   ========================================================= */

async function togglePlayPause() {

  if (!state.playerStarted) {
    return;
  }

  /*
    إذا كان ينتظر بين الآيات،
    الضغط على تشغيل يعيد التشغيل.
  */

  if (state.isWaiting) {

    clearWaitTimer();

    state.isWaiting =
      false;

    await playCurrentAyah();

    return;
  }

  /*
    إذا كان يعمل:
    نوقف الصوت ونرجعه لبداية الآية.
  */

  if (
    state.isPlaying &&
    !audio.paused
  ) {

    audio.pause();

    audio.currentTime = 0;

    state.isPlaying =
      false;

    updatePlayButton();

    setStatus(
      "متوقف — اضغط تشغيل للبدء من أول الآية.",
      ""
    );

    return;
  }

  /*
    إذا كان متوقفًا:
    يبدأ من أول الآية.
  */

  await playCurrentAyah();
}


/* =========================================================
   26) عند انتهاء الصوت
   ========================================================= */

async function handleAudioEnded() {

  if (!state.playerStarted) {
    return;
  }

  state.isPlaying =
    false;

  updatePlayButton();

  /*
    الشيخ المعلم:
    سنستخدم نقاط الوقف الموجودة
    في JSON.

    إذا كانت هناك نقطة وقف تالية،
    ننتقل إلى تسجيل المعلم حتى
    نفس نقطة الوقف.

    ملاحظة:
    في هذه المرحلة نضع البنية الصحيحة
    للمحرك، وسنربطها نهائيًا بشكل
    بيانات التسجيلات الذي سنضعه في JSON.
  */

  if (state.teacherMode) {

    const pauses =
      getAyahPause(
        state.currentAyah
      );

    if (
      pauses.length &&
      state.currentPauseIndex <
      pauses.length
    ) {

      await continueTeacherSequence();

      return;
    }
  }

  /*
    انتهت الآية.
  */

  await finishCurrentAyah();
}


/* =========================================================
   27) محرك الشيخ المعلم
   ========================================================= */

async function continueTeacherSequence() {

  /*
    هذه الوظيفة مصممة لتعمل مع
    تسجيلين متزامنين لهما نفس
    التوقيت:

      sheikh
      mo3allem

    ومع نقاط وقف مشتركة.

    لاحقًا عند وضع JSON النهائي
    سنستخدم هذه النقاط مباشرة.
  */

  const pauses =
    getAyahPause(
      state.currentAyah
    );

  if (!pauses.length) {

    await finishCurrentAyah();

    return;
  }

  const teacherUrl =
    getAudioUrl("mo3allem");

  if (!teacherUrl) {

    /*
      إذا لم يوجد ملف المعلم،
      لا نكسر المشغل بالكامل.
    */

    await finishCurrentAyah();

    return;
  }

  const pause =
    Number(
      pauses[state.currentPauseIndex]
    );

  if (!Number.isFinite(pause)) {

    await finishCurrentAyah();

    return;
  }

  /*
    إذا كان تسجيل الشيخ قد انتهى،
    نبدأ تسجيل المعلم من نفس الموضع
    تقريبًا.

    سيتم تطوير الانتقال الدقيق بين
    نقاط الوقف بعد تحديد شكل JSON
    النهائي.
  */

  try {

    await loadAudio(
      teacherUrl
    );

    audio.currentTime =
      Math.max(
        0,
        pause
      );

    audio.playbackRate =
      state.speed;

    state.currentAudioMode =
      "mo3allem";

    state.currentPauseIndex++;

    state.isPlaying =
      true;

    updatePlayButton();

    setStatus(
      "الشيخ المعلم 🎓",
      "playing"
    );

    await audio.play();

  } catch (error) {

    console.error(
      "Teacher audio error:",
      error
    );

    await finishCurrentAyah();
  }
}


/* =========================================================
   28) إنهاء الآية
   ========================================================= */

async function finishCurrentAyah() {

  state.isPlaying =
    false;

  updatePlayButton();

  /*
    هل ما زال هناك تكرار للآية؟
  */

  if (
    state.currentAyahRepeat <
    state.ayahRepeat
  ) {

    state.currentAyahRepeat++;

    updateRepeatProgress();

    await waitBeforeNextAction(
      () => playCurrentAyah()
    );

    return;
  }

  /*
    انتهت تكرارات الآية.
    نعيد عداد الآية.
  */

  state.currentAyahRepeat =
    1;

  updateRepeatProgress();

  /*
    هل توجد آية أخرى داخل الفقرة؟
  */

  if (
    state.currentAyah <
    state.currentParagraphEnd
  ) {

    state.currentAyah++;

    updatePlayerUI();

    await waitBeforeNextAction(
      () => playCurrentAyah()
    );

    return;
  }

  /*
    انتهت الفقرة بالكامل.
  */

  await finishParagraph();
}


/* =========================================================
   29) إنهاء الفقرة
   ========================================================= */

async function finishParagraph() {

  /*
    تكرار الفقرة بلا توقف
  */

  if (
    state.paragraphRepeat ===
    "infinite"
  ) {

    state.currentParagraphRepeat++;

    state.currentAyah =
      state.currentParagraphStart;

    state.currentAyahRepeat =
      1;

    updateParagraphProgress();
    updatePlayerUI();

    await waitBeforeNextAction(
      () => playCurrentAyah()
    );

    return;
  }


  /*
    تكرار الفقرة بعدد محدد
  */

  if (
    state.currentParagraphRepeat <
    Number(state.paragraphRepeat)
  ) {

    state.currentParagraphRepeat++;

    state.currentAyah =
      state.currentParagraphStart;

    state.currentAyahRepeat =
      1;

    updateParagraphProgress();
    updatePlayerUI();

    await waitBeforeNextAction(
      () => playCurrentAyah()
    );

    return;
  }


  /*
    انتهى كل شيء.
  */

  state.isPlaying =
    false;

  state.playerStarted =
    false;

  updatePlayButton();

  updateParagraphProgress();

  setStatus(
    "🎉 أحسنت! انتهت الفقرة.",
    "playing"
  );
}


/* =========================================================
   30) الانتظار بين العمليات
   ========================================================= */

function waitBeforeNextAction(callback) {

  clearWaitTimer();

  const duration =
    getWaitDuration();

  if (duration <= 0) {

    callback();

    return;
  }

  state.isWaiting =
    true;

  setStatus(
    getWaitStatus(),
    "waiting"
  );

  updatePlayButton();

  state.waitTimer =
    setTimeout(
      () => {

        state.waitTimer =
          null;

        state.isWaiting =
          false;

        callback();

      },
      duration
    );
}


/* =========================================================
   31) مدة الانتظار
   ========================================================= */

function getWaitDuration() {

  /*
    القيم مقصودة أن تكون بسيطة
    وقابلة للتعديل لاحقًا.

    لا نعتمد على مدة الآية.
  */

  switch (state.wait) {

    case "short":
      return 500;

    case "long":
      return 1800;

    case "medium":
    default:
      return 1000;
  }
}


/* =========================================================
   32) زر السابق
   ========================================================= */

async function previousAyah() {

  if (!state.playerStarted) {
    return;
  }

  clearWaitTimer();

  state.playbackToken++;

  state.isWaiting =
    false;

  state.currentAyahRepeat =
    1;

  state.currentPauseIndex =
    0;

  /*
    إذا لم نكن في أول آية،
    نرجع آية واحدة.
  */

  if (
    state.currentAyah >
    state.currentParagraphStart
  ) {

    state.currentAyah--;

  } else {

    /*
      إذا كنا في أول آية،
      نبقى فيها.
    */

    state.currentAyah =
      state.currentParagraphStart;
  }

  updatePlayerUI();

  await playCurrentAyah();
}


/* =========================================================
   33) زر التالي
   ========================================================= */

async function nextAyah() {

  if (!state.playerStarted) {
    return;
  }

  clearWaitTimer();

  state.playbackToken++;

  state.isWaiting =
    false;

  state.currentAyahRepeat =
    1;

  state.currentPauseIndex =
    0;

  if (
    state.currentAyah <
    state.currentParagraphEnd
  ) {

    state.currentAyah++;

    updatePlayerUI();

    await playCurrentAyah();

    return;
  }

  /*
    إذا كانت آخر آية،
    نبدأ الفقرة من جديد حسب
    إعداد التكرار.
  */

  await finishParagraph();
}


/* =========================================================
   34) زر الإيقاف الوحيد
   ========================================================= */

function stopPlayback(returnToMain = false) {

  state.playbackToken++;

  clearWaitTimer();

  try {
    audio.pause();
  } catch (_) {}

  audio.currentTime = 0;

  state.isPlaying =
    false;

  state.isWaiting =
    false;

  state.playerStarted =
    false;

  /*
    أهم شيء:
    الإيقاف يصفر العدادات.
  */

  state.currentAyah =
    state.currentParagraphStart;

  state.currentAyahRepeat =
    1;

  state.currentParagraphRepeat =
    1;

  state.currentPauseIndex =
    0;

  state.currentAudioMode =
    "sheikh";

  updatePlayerUI();
  updateRepeatProgress();
  updateParagraphProgress();

  setStatus(
    "تم الإيقاف والعودة إلى أول الفقرة.",
    ""
  );

  if (returnToMain) {
    showScreen("main");
  }
}


/* =========================================================
   35) واجهة المشغل
   ========================================================= */

function updatePlayerUI() {

  const surah =
    getSelectedSurah();

  if (!surah) {
    return;
  }

  const name =
    surah.name ??
    surah.arabicName ??
    "";

  const ayahCount =
    getAyahCount(surah);

  $("#playerSurahName").textContent =
    name;

  $("#playerAyahPosition").textContent =
    `الآية ${state.currentAyah} من ${state.currentParagraphEnd}`;

  $("#ayahPosition").textContent =
    `الآية ${state.currentAyah}`;

  $("#ayahText").textContent =
    getAyahText(
      state.currentAyah
    );

  /*
    مستوى اللاعب
  */

  const rangeCount =
    Math.max(
      1,
      state.currentParagraphEnd -
      state.currentParagraphStart +
      1
    );

  const currentInRange =
    state.currentAyah -
    state.currentParagraphStart +
    1;

  const percentage =
    Math.min(
      100,
      Math.max(
        0,
        (
          currentInRange /
          rangeCount
        ) * 100
      )
    );

  const progress =
    $("#overallProgress");

  if (progress) {
    progress.style.width =
      `${percentage}%`;
  }

  const level =
    $("#playerLevel");

  if (level) {

    level.textContent =
      `المستوى ${Math.max(
        1,
        Math.ceil(
          currentInRange / 3
        )
      )}`;
  }

  updatePlayButton();
  updateRepeatProgress();
  updateParagraphProgress();
}


/* =========================================================
   36) زر التشغيل
   ========================================================= */

function updatePlayButton() {

  const button =
    $("#playPauseButton");

  if (!button) {
    return;
  }

  if (
    state.isPlaying &&
    !audio.paused
  ) {

    button.innerHTML =
      "⏸️";

    button.setAttribute(
      "aria-label",
      "إيقاف مؤقت"
    );

  } else {

    button.innerHTML =
      "▶️";

    button.setAttribute(
      "aria-label",
      "تشغيل"
    );
  }
}


/* =========================================================
   37) شريط تكرار الآية
   ========================================================= */

function updateRepeatProgress() {

  const fill =
    $("#ayahRepeatProgress");

  const count =
    $("#ayahRepeatCount");

  if (!fill || !count) {
    return;
  }

  const total =
    Math.max(
      1,
      Number(state.ayahRepeat)
    );

  const current =
    Math.min(
      total,
      Math.max(
        1,
        Number(state.currentAyahRepeat)
      )
    );

  const percent =
    (
      current /
      total
    ) * 100;

  fill.style.width =
    `${percent}%`;

  count.textContent =
    `${current} / ${total}`;
}


/* =========================================================
   38) شريط تكرار الفقرة
   ========================================================= */

function updateParagraphProgress() {

  const fill =
    $("#paragraphRepeatProgress");

  const count =
    $("#paragraphRepeatCount");

  if (!fill || !count) {
    return;
  }

  if (
    state.paragraphRepeat ===
    "infinite"
  ) {

    fill.style.width =
      "100%";

    count.textContent =
      `♾️ ${state.currentParagraphRepeat}`;

    return;
  }

  const total =
    Math.max(
      1,
      Number(state.paragraphRepeat)
    );

  const current =
    Math.min(
      total,
      Math.max(
        1,
        Number(state.currentParagraphRepeat)
      )
    );

  fill.style.width =
    `${(
      current /
      total
    ) * 100}%`;

  count.textContent =
    `${current} / ${total}`;
}


/* =========================================================
   39) حالة التشغيل
   ========================================================= */

function getPlayingStatus() {

  if (state.teacherMode) {

    return "جاري التشغيل 🎧";
  }

  return "جاري الاستماع 🎧";
}


function getWaitStatus() {

  switch (state.wait) {

    case "short":
      return "استراحة قصيرة ⏱️";

    case "long":
      return "استراحة طويلة ⏱️";

    case "medium":
    default:
      return "استراحة ⏱️";
  }
}


function setStatus(
  message,
  type = ""
) {

  const element =
    $("#playerStatus");

  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.className =
    "status-message";

  if (type) {
    element.classList.add(type);
  }
}


/* =========================================================
   40) أحداث خطأ الصوت
   ========================================================= */

function handleAudioError() {

  if (!state.playerStarted) {
    return;
  }

  state.isPlaying =
    false;

  updatePlayButton();

  setStatus(
    "تعذر تحميل التسجيل الصوتي. تأكد من رابط الملف.",
    "error"
  );
}


/* =========================================================
   41) تغيير الشاشة
   ========================================================= */

function showScreen(name) {

  Object.values(screens)
    .forEach(screen => {

      if (screen) {
        screen.classList.remove(
          "active"
        );
      }
    });

  const screen =
    screens[name];

  if (screen) {
    screen.classList.add(
      "active"
    );
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


/* =========================================================
   42) Loading
   ========================================================= */

function showLoading(screen, message) {

  if (!screen) {
    return;
  }

  let loading = screen.querySelector(".loading");

  if (!loading) {
    loading = document.createElement("div");
    loading.className = "loading";

    screen.prepend(loading);
  }

  loading.innerHTML = `
    <div class="loading-spinner"></div>
    <div>${escapeHtml(message)}</div>
  `;
}


/* =========================================================
   43) Error
   ========================================================= */

function showError(
  screen,
  message
) {

  if (!screen) {
    return;
  }

  /*
    لا نمسح الشاشة كلها إذا كانت
    الشاشة الرئيسية تحتوي على
    عناصر ثابتة.

    لذلك نضع رسالة الخطأ فقط
    في أعلى الشاشة.
  */

  const error =
    document.createElement("div");

  error.className =
    "empty-state";

  error.innerHTML = `
    ⚠️
    <br><br>
    ${escapeHtml(message)}
  `;

  screen.prepend(error);
}


/* =========================================================
   44) مؤقت الانتظار
   ========================================================= */

function clearWaitTimer() {

  if (state.waitTimer) {

    clearTimeout(
      state.waitTimer
    );

    state.waitTimer =
      null;
  }

  state.isWaiting =
    false;
}


/* =========================================================
   45) تأثير الضغط
   ========================================================= */

function animateButton(button) {

  if (!button) {
    return;
  }

  button.animate(
    [
      {
        transform: "scale(1)"
      },

      {
        transform: "scale(0.88)"
      },

      {
        transform: "scale(1)"
      }
    ],
    {
      duration: 160,
      easing: "ease-out"
    }
  );
}


/* =========================================================
   46) اهتزاز خفيف إن كان الجهاز يدعمه
   ========================================================= */

function haptic() {

  try {

    if (
      "vibrate" in navigator
    ) {

      navigator.vibrate(12);
    }

  } catch (_) {}
}


/* =========================================================
   47) حماية النصوص القادمة من JSON
   ========================================================= */

function escapeHtml(value) {

  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
