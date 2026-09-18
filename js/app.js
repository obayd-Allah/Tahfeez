const $ = id => document.getElementById(id);

const reciterSelect = $("reciterSelect");
const surahSelect = $("surahSelect");
const fromAyah = $("fromAyah");
const toAyah = $("toAyah");

RECITERS.forEach(r => {
  const o = document.createElement("option");
  o.value = r.id;
  o.textContent = r.name;
  reciterSelect.appendChild(o);
});

SURAHS.forEach(s => {
  const o = document.createElement("option");
  o.value = s.number;
  o.textContent = `${s.number}. ${s.name}`;
  surahSelect.appendChild(o);
});

function fillAyahs() {
  const surah = SURAHS.find(s => s.number === Number(surahSelect.value));
  fromAyah.innerHTML = "";
  toAyah.innerHTML = "";

  for (let i = 1; i <= surah.ayahs; i++) {
    const a = document.createElement("option");
    a.value = i;
    a.textContent = i;
    fromAyah.appendChild(a);

    const b = document.createElement("option");
    b.value = i;
    b.textContent = i;
    toAyah.appendChild(b);
  }

  fromAyah.value = "1";
  toAyah.value = String(surah.ayahs);
}

surahSelect.addEventListener("change", fillAyahs);
fillAyahs();

fromAyah.addEventListener("change", () => {
  if (Number(toAyah.value) < Number(fromAyah.value)) {
    toAyah.value = fromAyah.value;
  }
});

$("startBtn").addEventListener("click", () => {
  const settings = {
    reciterId: reciterSelect.value,
    surah: Number(surahSelect.value),
    from: Number(fromAyah.value),
    to: Number(toAyah.value),
    speed: Number($("speedSelect").value),
    ayahRepeats: Math.max(1, Number($("ayahRepeats").value) || 1),
    paragraphRepeats: Math.max(1, Number($("paragraphRepeats").value) || 1),
    waitAfter: Number($("waitAfter").value),
    teacherMode: $("teacherMode").checked,
    offlineMode: $("offlineMode").checked
  };

  if (settings.from > settings.to) {
    alert("يجب أن تكون الآية الأولى قبل الآية الأخيرة.");
    return;
  }

  sessionStorage.setItem("tahfeezSettings", JSON.stringify(settings));
  location.href = "player.html";
});
