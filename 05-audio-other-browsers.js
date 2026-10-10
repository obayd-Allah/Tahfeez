/* =========================================================
   تشغيل الجزء - باقي المتصفحات
========================================================= */

function startCurrentSegmentOtherBrowsers(
    token,
    userInitiated = false
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }


    /* =====================================================
       MI BROWSER - وضع المعلم
       نستخدم نظامًا خاصًا لأن Mi Browser قد يبدأ ملف
       الطفل من الثانية 0 قبل اكتمال seek.
    ===================================================== */

    if (
        isMiBrowser &&
        state.session.teacherMode
    ) {

        startCurrentSegmentMiBrowserTeacher(
            token,
            userInitiated
        );

        return;
    }


    /* =====================================================
       باقي المتصفحات
    ===================================================== */

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
                Number(
                    state.session.speed
                ) || 1
            )
        );

    configureAudioSpeed(
        currentAudio,
        actualSpeed
    );

    endInternalAudioActionSoon();

    let finished = false;

    let audioActuallyStarted = false;

    let metadataReady = false;

    let preparedSegmentDuration = 0;

    let segmentStartedAt = 0;


    function isCurrentSegment() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisSegmentId === audioSegmentId
        );
    }


    function finishOnce() {

        if (
            finished ||
            !isCurrentSegment()
        ) {
            return;
        }

        if (!audioActuallyStarted) {
            return;
        }

        if (
            segmentStartedAt > 0 &&
            preparedSegmentDuration > 0
        ) {

            const expectedWallTime =
                (
                    preparedSegmentDuration /
                    actualSpeed
                ) * 1000;

            const elapsed =
                performance.now() -
                segmentStartedAt;

            const minimumAllowedTime =
                Math.max(
                    120,
                    expectedWallTime * 0.35
                );

            if (
                elapsed <
                minimumAllowedTime
            ) {
                return;
            }
        }

        finished = true;

        if (segmentTimer) {

            clearTimeout(segmentTimer);

            segmentTimer = null;
        }

        if (!isCurrentSegment()) {
            return;
        }

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();

        handleCurrentSegmentFinished(
            token,
            currentAudio
        );
    }


    function prepareSegment() {

        if (
            !isCurrentSegment() ||
            metadataReady ||
            finished
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

        sanitizePausePoints(
            duration
        );

        const bounds =
            getSegmentBounds(
                duration
            );

        if (!bounds) {
            return;
        }

        const start =
            Number(bounds.start);

        const end =
            Number(bounds.end);

        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return;
        }

        metadataReady = true;

        preparedSegmentDuration =
            Math.max(
                0,
                end - start
            );


        if (
            Math.abs(
                currentAudio.currentTime -
                start
            ) > 0.02
        ) {

            internalSeekAction = true;

            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                internalSeekAction = false;

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

        playSegment();
    }


    function armSegmentTimer() {

        if (
            !isCurrentSegment() ||
            finished ||
            !audioActuallyStarted ||
            !metadataReady
        ) {
            return;
        }

        const segmentDuration =
            Number(
                preparedSegmentDuration
            );

        if (
            !Number.isFinite(segmentDuration) ||
            segmentDuration <= 0
        ) {
            return;
        }

        const wallTime =
            (
                segmentDuration /
                actualSpeed
            ) * 1000;

        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }

        segmentTimer =
            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !audioActuallyStarted
                    ) {
                        return;
                    }

                    const duration =
                        Number(
                            currentAudio.duration
                        );

                    const bounds =
                        getSegmentBounds(
                            duration
                        );

                    if (!bounds) {
                        return;
                    }

                    const now =
                        Number(
                            currentAudio.currentTime
                        );

                    if (
                        Number.isFinite(now) &&
                        now >=
                            bounds.end - 0.03
                    ) {

                        finishOnce();

                    } else {

                        armSegmentTimer();
                    }

                },
                Math.max(
                    150,
                    wallTime + 180
                )
            );
    }


    function playSegment() {

        if (
            !isCurrentSegment() ||
            finished
        ) {
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
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            audioActuallyStarted = true;

            segmentStartedAt =
                performance.now();

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armSegmentTimer();

            if ("mediaSession" in navigator) {

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

            audioActuallyStarted = true;

            if (!segmentStartedAt) {

                segmentStartedAt =
                    performance.now();
            }

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armSegmentTimer();

            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onloadedmetadata =
        () => {

            prepareSegment();
        };


    currentAudio.ondurationchange =
        () => {

            prepareSegment();
        };


    currentAudio.onloadeddata =
        () => {

            prepareSegment();
        };


    currentAudio.oncanplay =
        () => {

            prepareSegment();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !isCurrentSegment() ||
                !audioActuallyStarted
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

            const now =
                Number(
                    currentAudio.currentTime
                );

            if (
                !Number.isFinite(now)
            ) {
                return;
            }

            if (
                now >=
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
                !audioActuallyStarted ||
                !isCurrentSegment()
            ) {
                return;
            }

            const duration =
                Number(
                    currentAudio.duration
                );

            const bounds =
                getSegmentBounds(
                    duration
                );

            const now =
                Number(
                    currentAudio.currentTime
                );

            if (
                bounds &&
                Number.isFinite(now) &&
                now >=
                    bounds.end - 0.08
            ) {

                finishOnce();
            }
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

        playSegment();
    }


    if (
        Number.isFinite(
            Number(
                currentAudio.duration
            )
        ) &&
        Number(
            currentAudio.duration
        ) > 0
    ) {

        prepareSegment();
    }
}


/* =========================================================
   MI BROWSER - وضع المعلم
========================================================= */

function startCurrentSegmentMiBrowserTeacher(
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


    const thisSegmentId =
        ++audioSegmentId;


    const currentAudio =
        audio;


    let finished = false;

    let started = false;

    let metadataReady = false;

    let waitingForSeek = false;

    let seekTarget = 0;

    let preparedStart = 0;

    let preparedEnd = 0;

    let segmentStartedAt = 0;


    const actualSpeed =
        Math.min(
            1.25,
            Math.max(
                0.75,
                Number(
                    state.session.speed
                ) || 1
            )
        );


    beginInternalAudioAction();

    detachAudioEvents();


    if (waitTimer) {
        clearTimeout(waitTimer);
        waitTimer = null;
    }

    if (segmentTimer) {
        clearTimeout(segmentTimer);
        segmentTimer = null;
    }


    try {
        currentAudio.pause();
    } catch (error) {}


    try {

        currentAudio.removeAttribute("src");
        currentAudio.load();

        currentAudio.src =
            url;

        currentAudio.load();

    } catch (error) {

        endInternalAudioActionSoon();

        console.error(
            "تعذر تحميل ملف الصوت في Mi Browser:",
            error
        );

        return;
    }


    configureAudioSpeed(
        currentAudio,
        actualSpeed
    );


    endInternalAudioActionSoon();


    function isCurrentSegment() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisSegmentId === audioSegmentId
        );
    }


    function finishOnce() {

        if (
            finished ||
            !started ||
            waitingForSeek ||
            !isCurrentSegment()
        ) {
            return;
        }


        /*
            لا نسمح بالانتقال إلا إذا كان currentTime
            وصل فعلًا إلى نهاية الجزء الحالي.
        */

        const now =
            Number(
                currentAudio.currentTime
            );


        if (
            !Number.isFinite(now) ||
            !Number.isFinite(preparedEnd)
        ) {
            return;
        }


        if (
            now <
            preparedEnd - 0.04
        ) {
            return;
        }


        /*
            حماية من إنهاء الجزء فورًا بعد onplaying.
        */

        if (segmentStartedAt > 0) {

            const expectedDuration =
                Math.max(
                    0,
                    preparedEnd -
                    preparedStart
                );


            const expectedWallTime =
                (
                    expectedDuration /
                    actualSpeed
                ) * 1000;


            const elapsed =
                performance.now() -
                segmentStartedAt;


            const minimumAllowedTime =
                Math.max(
                    120,
                    expectedWallTime * 0.30
                );


            if (
                elapsed <
                minimumAllowedTime
            ) {
                return;
            }
        }


        finished = true;


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }


        beginInternalAudioAction();

        currentAudio.onpause = null;


        try {
            currentAudio.pause();
        } catch (error) {}


        endInternalAudioActionSoon();


        handleCurrentSegmentFinished(
            token,
            currentAudio
        );
    }


    function playWhenReady() {

        if (
            !isCurrentSegment() ||
            finished ||
            waitingForSeek
        ) {
            return;
        }


        if (
            !metadataReady
        ) {
            return;
        }


        let promise;


        try {

            promise =
                currentAudio.play();

        } catch (error) {

            console.error(
                "تعذر تشغيل Mi Browser:",
                error
            );

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

            return;
        }


        if (
            promise &&
            typeof promise.catch ===
                "function"
        ) {

            promise.catch(
                error => {

                    if (!isCurrentSegment()) {
                        return;
                    }


                    console.error(
                        "تعذر تشغيل Mi Browser:",
                        error
                    );


                    state.session.playing =
                        false;

                    playPauseButton.textContent =
                        "▶️";

                    setMediaSessionNone();

                }
            );
        }
    }


    function prepareSegment() {

        if (
            !isCurrentSegment() ||
            finished
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


        sanitizePausePoints(
            duration
        );


        const bounds =
            getSegmentBounds(
                duration
            );


        if (!bounds) {
            return;
        }


        const start =
            Number(
                bounds.start
            );


        const end =
            Number(
                bounds.end
            );


        if (
            !Number.isFinite(start) ||
            !Number.isFinite(end) ||
            end <= start
        ) {
            return;
        }


        preparedStart =
            start;


        preparedEnd =
            end;


        metadataReady =
            true;


        configureAudioSpeed(
            currentAudio,
            actualSpeed
        );


        /*
            =================================================
            أهم جزء في إصلاح Mi Browser:

            لا نقول للمتصفح:
                currentTime = start
                ثم play مباشرة.

            بل:
                1. نوقف التشغيل.
                2. نطلب seek.
                3. ننتظر seeked.
                4. نتأكد أن currentTime أصبح قريبًا
                   من start.
                5. بعدها فقط نشغل.
            =================================================
        */


        const currentPosition =
            Number(
                currentAudio.currentTime
            );


        if (
            Math.abs(
                currentPosition -
                start
            ) > 0.03
        ) {

            waitingForSeek =
                true;


            seekTarget =
                start;


            internalSeekAction =
                true;


            try {

                currentAudio.pause();

            } catch (error) {}


            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                waitingForSeek =
                    false;

                internalSeekAction =
                    false;

                return;
            }


            setTimeout(
                () => {

                    internalSeekAction =
                        false;

                },
                0
            );


            /*
                بعض إصدارات Mi Browser قد لا ترسل seeked
                في كل مرة؛ لذلك نتحقق مرة أخرى قليلًا
                بعد ذلك.
            */

            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !waitingForSeek
                    ) {
                        return;
                    }


                    const position =
                        Number(
                            currentAudio.currentTime
                        );


                    if (
                        Number.isFinite(position) &&
                        Math.abs(
                            position -
                            seekTarget
                        ) <= 0.15
                    ) {

                        waitingForSeek =
                            false;

                        playWhenReady();

                    }

                },
                80
            );


            return;
        }


        waitingForSeek =
            false;


        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );


        if (shouldAutoPlay) {

            playWhenReady();

        }
    }


    function armSegmentTimer() {

        if (
            !isCurrentSegment() ||
            finished ||
            !started ||
            waitingForSeek ||
            !metadataReady
        ) {
            return;
        }


        const segmentDuration =
            Math.max(
                0,
                preparedEnd -
                preparedStart
            );


        if (
            !Number.isFinite(segmentDuration) ||
            segmentDuration <= 0
        ) {
            return;
        }


        if (segmentTimer) {

            clearTimeout(
                segmentTimer
            );

            segmentTimer = null;
        }


        const wallTime =
            (
                segmentDuration /
                actualSpeed
            ) * 1000;


        segmentTimer =
            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !started ||
                        waitingForSeek
                    ) {
                        return;
                    }


                    const now =
                        Number(
                            currentAudio.currentTime
                        );


                    if (
                        Number.isFinite(now) &&
                        now >=
                            preparedEnd - 0.04
                    ) {

                        finishOnce();

                    } else {

                        armSegmentTimer();

                    }

                },
                Math.max(
                    150,
                    wallTime + 220
                )
            );
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }


            started =
                true;


            segmentStartedAt =
                performance.now();


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";


            armSegmentTimer();


            if ("mediaSession" in navigator) {

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


            started =
                true;


            if (!segmentStartedAt) {

                segmentStartedAt =
                    performance.now();

            }


            state.session.playing =
                true;


            playPauseButton.textContent =
                "⏸️";


            armSegmentTimer();


            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onloadedmetadata =
        () => {

            prepareSegment();

        };


    currentAudio.ondurationchange =
        () => {

            prepareSegment();

        };


    currentAudio.onloadeddata =
        () => {

            prepareSegment();

        };


    currentAudio.oncanplay =
        () => {

            prepareSegment();

        };


    currentAudio.onseeked =
        () => {

            if (
                !isCurrentSegment() ||
                !waitingForSeek
            ) {
                return;
            }


            const position =
                Number(
                    currentAudio.currentTime
                );


            if (
                !Number.isFinite(position)
            ) {
                return;
            }


            /*
                لا نعتبر seek ناجحًا إلا إذا وصلنا
                فعلًا إلى نقطة البداية المطلوبة.
            */

            if (
                Math.abs(
                    position -
                    seekTarget
                ) > 0.15
            ) {

                return;
            }


            waitingForSeek =
                false;


            internalSeekAction =
                true;


            setTimeout(
                () => {

                    internalSeekAction =
                        false;

                },
                0
            );


            playWhenReady();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                finished ||
                !started ||
                waitingForSeek ||
                !isCurrentSegment()
            ) {
                return;
            }


            const now =
                Number(
                    currentAudio.currentTime
                );


            if (
                !Number.isFinite(now)
            ) {
                return;
            }


            /*
                لا نعتمد على duration هنا.
                نحن نستخدم preparedEnd الخاصة بالجزء.
            */

            if (
                now >=
                preparedEnd - 0.02
            ) {

                finishOnce();

            }
        };


    currentAudio.onended =
        () => {

            if (
                finished ||
                !started ||
                waitingForSeek ||
                !isCurrentSegment()
            ) {
                return;
            }


            const now =
                Number(
                    currentAudio.currentTime
                );


            /*
                إذا انتهى الملف كاملًا قبل نقطة الوقف،
                لا نقفز للجزء التالي بشكل خاطئ.
            */

            if (
                Number.isFinite(now) &&
                now >=
                    preparedEnd - 0.08
            ) {

                finishOnce();

            }

        };


    currentAudio.onpause =
        () => {

            if (
                internalAudioAction ||
                waitingForSeek
            ) {
                return;
            }


            if (!isCurrentSegment()) {
                return;
            }


            if (state.session.playing) {

                handleExternalAudioStop();

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
                "خطأ في ملف الصوت في Mi Browser:",
                currentAudio.error
            );


            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


    /*
        إذا كانت metadata جاهزة بالفعل.
    */

    if (
        Number.isFinite(
            Number(
                currentAudio.duration
            )
        ) &&
        Number(
            currentAudio.duration
        ) > 0
    ) {

        prepareSegment();

    }


    /*
        عند الضغط الأول على التشغيل:
        prepareSegment ستقوم بالتشغيل بعد التأكد
        من الموضع الصحيح.
    */

    if (
        userInitiated &&
        segmentIndex === 0 &&
        currentAudioType === "normal"
    ) {

        setTimeout(
            () => {

                if (
                    !isCurrentSegment() ||
                    finished
                ) {
                    return;
                }


                if (
                    metadataReady &&
                    !waitingForSeek &&
                    currentAudio.paused
                ) {

                    playWhenReady();

                }

            },
            0
        );
    }
}


