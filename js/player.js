/*
  محرك التحفيظ
  ----------------
  - تسجيل الشيخ: teacherAudio
  - تسجيل الطفل: childAudio
  - في الوضع العادي: الشيخ فقط.
  - في وضع الشيخ المعلم: نتناوب بين التسجيلين عند نقاط الوقف.
  - لا يوجد seek bar.
  - ▶️/⏸️ زر واحد: عند إيقافه ثم تشغيله تعاد الآية الحالية من بدايتها.
  - 🛑 الإيقاف الدائم: يعيد الجلسة إلى أول آية + أول تكرار للآية + أول تكرار للفقرة.
*/

const $ = id => document.getElementById(id);

const settings = JSON.parse(sessionStorage.getItem("tahfeezSettings") || "null");

if (!settings) {
  location.href = "index.html";
  throw new Error("No settings");
}

const reciter = RECITERS.find(r => r.id === settings.reciterId) || RECITERS[0];
const surah = SURAHS.find(s => s.number === settings.surah);

const teacherAudio = $("teacherAudio");
const childAudio = $("childAudio");

let currentAyah = settings.from;
let ayahRepeatIndex = 1;
let paragraphRepeatIndex = 1;

let playing = false;
let permanentStopped = true;
let activeAudio = teacherAudio;
let pauseIndex = 0;
let pausePoints = [];
let switching = false;
let rafId = null;
let waitTimer = null;

$("playerSurah").textContent = `سورة ${surah.name}`;
$("modeBadge").textContent = settings.teacherMode ? "👨‍🏫 الشيخ المعلم" : "🎙️ عادي";

function pad3(n) {
  return String(n).padStart(3, "0");
}

/*
  مكان ملفات الصوت:
  audio/minshawi-muallim/
      017-004-teacher.mp3
      017-004-child.mp3

  يمكنك تغيير makeAudioPath فقط إذا كان مصدر ملفاتك مختلفًا.
*/
function makeAudioPath(type, ayah) {
  return `${reciter.basePath}/${pad3(settings.surah)}-${pad3(ayah)}-${type}.mp3`;
}

function getPausePoints(ayah) {
  const points = Array.isArray(PAUSE_POINTS[ayah]) ? [...PAUSE_POINTS[ayah]] : [];
  return points.filter(Number.isFinite).sort((a, b) => a - b);
}

function updateBars() {
  $("ayahRepeatLabel").textContent =
    `${ayahRepeatIndex} / ${settings.ayahRepeats}`;
  $("paragraphRepeatLabel").textContent =
    `${paragraphRepeatIndex} / ${settings.paragraphRepeats}`;

  $("ayahBar").style.width =
    `${Math.min(100, (ayahRepeatIndex / settings.ayahRepeats) * 100)}%`;

  $("paragraphBar").style.width =
    `${Math.min(100, (paragraphRepeatIndex / settings.paragraphRepeats) * 100)}%`;
}

function updateAyahUI() {
  $("ayahCounter").textContent =
    `الآية ${currentAyah} من ${settings.to}`;
  $("ayahNumber").textContent = currentAyah;

  /*
    مكان ربط نص القرآن بمصدر موثوق.
    لا نضع نصوص القرآن يدويًا داخل هذا المشروع الآن.
  */
  $("ayahText").textContent =
    `الآية ${currentAyah} — سيتم تحميل نص الآية من مصدر القرآن المعتمد`;

  updateBars();
}

function stopAllAudio() {
  teacherAudio.pause();
  childAudio.pause();
  teacherAudio.currentTime = 0;
  childAudio.currentTime = 0;
}

function cancelLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
}

function cancelWait() {
  if (waitTimer) clearTimeout(waitTimer);
  waitTimer = null;
}

function prepareAyah() {
  cancelLoop();
  cancelWait();
  switching = false;
  pauseIndex = 0;
  activeAudio = teacherAudio;

  stopAllAudio();

  pausePoints = getPausePoints(currentAyah);

  teacherAudio.src = makeAudioPath("teacher", currentAyah);

  if (settings.teacherMode) {
    childAudio.src = makeAudioPath("child", currentAyah);
  } else {
    childAudio.removeAttribute("src");
  }

  teacherAudio.playbackRate = settings.speed;
  childAudio.playbackRate = settings.speed;

  updateAyahUI();
}

function playActive() {
  return activeAudio.play();
}

function switchAtPause() {
  if (!settings.teacherMode || switching) return;

  switching = true;

  const currentTime = activeAudio.currentTime;

  activeAudio.pause();

  const nextAudio =
    activeAudio === teacherAudio ? childAudio : teacherAudio;

  nextAudio.currentTime = currentTime;
  nextAudio.playbackRate = settings.speed;
  activeAudio = nextAudio;

  activeAudio.play().catch(showAudioError);

  pauseIndex++;
  switching = false;
}

function monitor() {
  if (!playing) return;

  const time = activeAudio.currentTime;

  if (
    settings.teacherMode &&
    pauseIndex < pausePoints.length &&
    time >= pausePoints[pauseIndex] - 0.025
  ) {
    switchAtPause();
  }

  rafId = requestAnimationFrame(monitor);
}

function showAudioError() {
  playing = false;
  $("playPauseBtn").textContent = "▶️";
  $("status").textContent =
    "لم يتم العثور على التسجيل بعد — ضع ملفات الصوت في مجلد audio.";
  cancelLoop();
}

function startAyah() {
  prepareAyah();
  playing = true;
  permanentStopped = false;
  $("playPauseBtn").textContent = "⏸️";
  $("status").textContent = settings.teacherMode
    ? "👨‍🏫 الشيخ المعلم يعمل..."
    : "🎙️ التشغيل...";

  playActive().catch(showAudioError);
  monitor();
}

function finishAyah() {
  cancelLoop();

  if (!playing) return;

  /*
    إذا انتهت الآية الحالية، نكمل تكرار الآية
    قبل الانتقال إلى الآية التالية.
  */
  if (ayahRepeatIndex < settings.ayahRepeats) {
    ayahRepeatIndex++;
    waitThen(() => startAyah());
    return;
  }

  if (currentAyah < settings.to) {
    currentAyah++;
    ayahRepeatIndex = 1;
    waitThen(() => startAyah());
    return;
  }

  /*
    انتهت الفقرة كاملة.
    نبدأ دورة جديدة فقط إذا بقيت دورات.
  */
  if (paragraphRepeatIndex < settings.paragraphRepeats) {
    paragraphRepeatIndex++;
    currentAyah = settings.from;
    ayahRepeatIndex = 1;
    waitThen(() => startAyah());
    return;
  }

  // انتهت الجلسة بالكامل.
  playing = false;
  $("playPauseBtn").textContent = "▶️";
  $("status").textContent = "🏆 انتهت جلسة التحفيظ";
  updateBars();
}

function waitThen(callback) {
  cancelWait();

  if (settings.waitAfter <= 0) {
    callback();
    return;
  }

  playing = true;
  $("status").textContent = `⏳ انتظار ${settings.waitAfter} ثانية...`;

  waitTimer = setTimeout(() => {
    waitTimer = null;
    if (playing) callback();
  }, settings.waitAfter * 1000);
}

teacherAudio.addEventListener("ended", () => {
  if (activeAudio !== teacherAudio) return;
  finishAyah();
});

childAudio.addEventListener("ended", () => {
  if (activeAudio !== childAudio) return;
  finishAyah();
});

$("playPauseBtn").addEventListener("click", () => {
  /*
    هذا الزر ليس Pause حقيقيًا:
    الضغط أثناء التشغيل = إيقاف جلسة الآية الحالية.
    الضغط مرة أخرى = إعادة الآية الحالية من بدايتها.
  */
  if (playing) {
    playing = false;
    cancelLoop();
    cancelWait();
    stopAllAudio();
    $("playPauseBtn").textContent = "▶️";
    $("status").textContent = "متوقف — اضغط ▶️ لإعادة الآية الحالية";
    return;
  }

  startAyah();
});

$("hardStopBtn").addEventListener("click", () => {
  /*
    الإيقاف الدائم يصفر كل شيء:
    - الآية الحالية
    - تكرار الآية
    - تكرار الفقرة
    ثم أي تشغيل جديد يبدأ من بداية الفقرة.
  */
  playing = false;
  permanentStopped = true;

  cancelLoop();
  cancelWait();
  stopAllAudio();

  currentAyah = settings.from;
  ayahRepeatIndex = 1;
  paragraphRepeatIndex = 1;

  prepareAyah();

  $("playPauseBtn").textContent = "▶️";
  $("status").textContent = "🛑 تم الإيقاف وإعادة الجلسة للبداية";
});

$("nextBtn").addEventListener("click", () => {
  if (currentAyah >= settings.to) return;

  playing = false;
  cancelLoop();
  cancelWait();
  stopAllAudio();

  currentAyah++;
  ayahRepeatIndex = 1;

  prepareAyah();
  $("status").textContent = "الآية التالية جاهزة";
  $("playPauseBtn").textContent = "▶️";
});

$("prevBtn").addEventListener("click", () => {
  if (currentAyah <= settings.from) return;

  playing = false;
  cancelLoop();
  cancelWait();
  stopAllAudio();

  currentAyah--;
  ayahRepeatIndex = 1;

  prepareAyah();
  $("status").textContent = "الآية السابقة جاهزة";
  $("playPauseBtn").textContent = "▶️";
});

$("repeatParagraphBtn").addEventListener("click", () => {
  playing = false;
  cancelLoop();
  cancelWait();
  stopAllAudio();

  currentAyah = settings.from;
  ayahRepeatIndex = 1;
  paragraphRepeatIndex = 1;

  prepareAyah();

  $("playPauseBtn").textContent = "▶️";
  $("status").textContent = "🔄 عادت إلى بداية الفقرة";
});

$("backBtn").addEventListener("click", () => {
  playing = false;
  cancelLoop();
  cancelWait();
  stopAllAudio();
  location.href = "index.html";
});

prepareAyah();
