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

        /*
            quran.json هنا هو ملف quran-ws
            hafs.json بعد إعادة تسميته إلى quran.json.

            نحوله إلى الصيغة الداخلية التي يستخدمها
            باقي برنامج Tahfeez.
        */

        state.quran =
            buildTahfeezQuranFromQuranWS(
                quranData
            );

        state.surahs =
            state.quran;

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
   تحويل quran-ws hafs.json
   إلى صيغة Tahfeez الداخلية
========================================================= */

function buildTahfeezQuranFromQuranWS(data) {

    if (
        !data ||
        !Array.isArray(data.words) ||
        !Array.isArray(data.ayah_starts) ||
        !Array.isArray(data.surahs)
    ) {

        throw new Error(
            "صيغة quran.json ليست صيغة quran-ws hafs.json المتوقعة."
        );
    }


    const words =
        data.words;


    const ayahStarts =
        data.ayah_starts;


    const surahData =
        data.surahs;


    /*
        =====================================================
        تجهيز علامات الوقف والرسم الموجودة في quran-ws.

        words[] لا تحتوي على علامات الوقف نفسها.
        العلامات موجودة في marks[].

        لذلك نعيد إلحاقها بالكلمات قبل بناء نص الآية.
        =====================================================
    */

    const marksByWord =
        new Map();


    if (
        Array.isArray(data.marks) &&
        Array.isArray(data.mark_types)
    ) {

        for (
            const mark of data.marks
        ) {

            if (
                !Array.isArray(mark) ||
                mark.length < 2
            ) {
                continue;
            }


            const wordIndex =
                Number(mark[0]);


            const markTypeIndex =
                Number(mark[1]);


            if (
                !Number.isInteger(wordIndex) ||
                !Number.isInteger(markTypeIndex)
            ) {
                continue;
            }


            const markType =
                data.mark_types[
                    markTypeIndex
                ];


            if (!markType) {
                continue;
            }


            if (
                !marksByWord.has(
                    wordIndex
                )
            ) {

                marksByWord.set(
                    wordIndex,
                    []
                );
            }


            marksByWord
                .get(wordIndex)
                .push(markType);
        }
    }


    /*
        =====================================================
        إعادة بناء الكلمات كما ينبغي أن تظهر.

        العلامة:
            side = "after"
        توضع مباشرة بعد الكلمة.

        والعلامة:
            side = "before"
        توضع قبل الكلمة مع فصل مناسب.

        لا نستخدم normalize("NFC")
        حتى نحافظ على النص كما أصدره quran-ws.
        =====================================================
    */

    const renderedWords =
        words.map(
            (word, wordIndex) => {

                let result =
                    String(word ?? "");


                const marks =
                    marksByWord.get(
                        wordIndex
                    );


                if (!marks || !marks.length) {
                    return result;
                }


                let beforeMarks = "";
                let afterMarks = "";


                for (
                    const mark of marks
                ) {

                    const sign =
                        mark.sign ??
                        "";


                    if (!sign) {
                        continue;
                    }


                    if (
                        mark.side ===
                        "before"
                    ) {

                        beforeMarks +=
                            sign;

                    } else {

                        afterMarks +=
                            sign;
                    }
                }


                /*
                    ۞ من العلامات التي تأتي قبل الموضع.
                */

                if (beforeMarks) {

                    result =
                        `${beforeMarks} ${result}`;
                }


                if (afterMarks) {

                    result +=
                        afterMarks;
                }


                return result;
            }
        );


    /*
        =====================================================
        بناء الآيات.

        ayah_starts عبارة عن فهارس كلمات عالمية.

        مثال:
            ayah_starts[0] = بداية الآية الأولى
            ayah_starts[1] = بداية الآية الثانية

        وبالتالي:
            start = ayah_starts[i]
            end   = ayah_starts[i + 1]

        والآية الأخيرة تنتهي عند نهاية words[].
        =====================================================
    */

    const totalAyahs =
        ayahStarts.length;


    const allAyahs =
        new Array(
            totalAyahs
        );


    for (
        let ayahIndex = 0;
        ayahIndex < totalAyahs;
        ayahIndex++
    ) {

        const start =
            Number(
                ayahStarts[ayahIndex]
            );


        const end =
            ayahIndex + 1 <
            totalAyahs

                ? Number(
                    ayahStarts[
                        ayahIndex + 1
                    ]
                )

                : renderedWords.length;


        if (
            !Number.isInteger(start) ||
            !Number.isInteger(end) ||
            start < 0 ||
            end < start
        ) {

            allAyahs[ayahIndex] = {
                number:
                    ayahIndex + 1,

                text:
                    ""
            };

            continue;
        }


        const text =
            renderedWords
                .slice(
                    start,
                    end
                )
                .join(" ")
                .trim();


        allAyahs[ayahIndex] = {

            number:
                ayahIndex + 1,

            text:
                text
        };
    }


    /*
        =====================================================
        بناء السور.

        quran-ws يستخدم:
            first_ayah
            ayah_count

        و first_ayah هو فهرس الآية العالمي،
        وليس رقم الآية داخل السورة.
        =====================================================
    */

    const result =
        surahData.map(
            surah => {

                const firstAyah =
                    Number(
                        surah.first_ayah
                    );


                const ayahCount =
                    Number(
                        surah.ayah_count
                    );


                const ayahs = [];


                for (
                    let i = 0;
                    i < ayahCount;
                    i++
                ) {

                    const globalAyahIndex =
                        firstAyah + i;


                    const ayah =
                        allAyahs[
                            globalAyahIndex
                        ];


                    if (!ayah) {
                        continue;
                    }


                    ayahs.push({

                        number:
                            i + 1,

                        text:
                            ayah.text
                    });
                }


                return {

                    number:
                        Number(
                            surah.number
                        ),

                    /*
                        التطبيق الحالي يستخدم name
                        في الواجهة.
                    */

                    name:
                        surah.name_ar,

                    ayahCount:
                        ayahCount,

                    ayahs:
                        ayahs
                };
            }
        );


    /*
        =====================================================
        تحقق بسيط من البيانات
        =====================================================
    */

    if (
        result.length !== 114
    ) {

        console.warn(
            `تحذير: تم تحميل ${result.length} سورة بدلًا من 114.`
        );
    }


    return result;
}
