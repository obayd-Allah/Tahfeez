/* =========================================================
   تشغيل الجزء الحالي
========================================================= */

function startCurrentSegment(
    token,
    userInitiated = false
) {

    if (isFirefox) {

        startCurrentSegmentFirefox(
            token,
            userInitiated
        );

        return;
    }

    startCurrentSegmentOtherBrowsers(
        token,
        userInitiated
    );
}


/* =========================================================
   Firefox
   الوضع العادي:
   الآية كلها ملف واحد
   pausePoint = pause / wait / resume

   وضع المعلم:
   normal segment -> teacher segment
========================================================= */

function startCurrentSegmentFirefox(
    token,
    userInitiated = false
) {

    if (
        !state.session ||
        token !== playbackToken
    ) {
        return;
    }

    if (state.session.teacherMode) {

        startCurrentSegmentFirefoxTeacher(
            token,
            userInitiated
        );

        return;
    }


    /* =====================================================
       Firefox - الوضع العادي
    ===================================================== */

    const reciter =
        state.session.reciter;

    const surahNumber =
        state.session.surah.number;

    const ayahNumber =
        state.session.currentAyah;

    const url =
        `${reciter.audioBaseUrl}/normal/${surahNumber}/${ayahNumber}.mp3`;

    const thisAudioId =
        ++audioSegmentId;

    const currentAudio =
        audio;

    let metadataReady = false;
    let started = false;
    let finished = false;
    let pauseWaiting = false;

    let pauseIndex = 0;
    let lastPausePoint = -1;

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

    if (firefoxEndTimer) {
        clearTimeout(firefoxEndTimer);
        firefoxEndTimer = null;
    }

    try {
        currentAudio.pause();
    } catch (error) {}

    if (currentAudio.src !== url) {

        try {

            currentAudio.src = url;
            currentAudio.load();

        } catch (error) {

            endInternalAudioActionSoon();

            console.error(
                "تعذر تحميل ملف الصوت في Firefox:",
                error
            );

            return;
        }
    }

    configureFirefoxNativeAudioSpeed(
        currentAudio,
        1
    );


    function isCurrent() {

        return (
            Boolean(state.session) &&
            token === playbackToken &&
            currentAudio === audio &&
            thisAudioId === audioSegmentId
        );
    }


    function clearTimers() {

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
    }


    function setPlaying() {

        if (!isCurrent()) {
            return;
        }

        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

        if ("mediaSession" in navigator) {

            try {

                navigator.mediaSession.playbackState =
                    "playing";

            } catch (error) {}
        }
    }


    function setStopped() {

        if (!isCurrent()) {
            return;
        }

        state.session.playing = false;

        playPauseButton.textContent =
            "▶️";

        setMediaSessionNone();
    }


    function playAgain() {

        if (
            !isCurrent() ||
            finished ||
            pauseWaiting
        ) {
            return;
        }

        let promise = null;

        try {

            promise =
                currentAudio.play();

        } catch (error) {

            setTimeout(
                () => {

                    if (
                        !isCurrent() ||
                        finished ||
                        pauseWaiting
                    ) {
                        return;
                    }

                    try {

                        const retry =
                            currentAudio.play();

                        if (
                            retry &&
                            typeof retry.catch ===
                                "function"
                        ) {

                            retry.catch(
                                retryError => {

                                    console.error(
                                        "تعذر استئناف Firefox:",
                                        retryError
                                    );

                                    setStopped();
                                }
                            );
                        }

                    } catch (retryError) {

                        console.error(
                            "تعذر استئناف Firefox:",
                            retryError
                        );

                        setStopped();
                    }

                },
                100
            );

            return;
        }

        if (
            promise &&
            typeof promise.catch ===
                "function"
        ) {

            promise.catch(
                error => {

                    if (!isCurrent()) {
                        return;
                    }

                    if (
                        error &&
                        (
                            error.name ===
                                "AbortError" ||
                            error.name ===
                                "NotAllowedError"
                        )
                    ) {

                        setTimeout(
                            () => {
                                playAgain();
                            },
                            100
                        );

                        return;
                    }

                    console.error(
                        "تعذر تشغيل Firefox:",
                        error
                    );

                    setStopped();
                }
            );
        }
    }


    function finishFirefoxAyah() {

        if (
            finished ||
            !isCurrent() ||
            !started
        ) {
            return;
        }

        finished = true;

        clearTimers();

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();

        finishAyah(token);
    }


    function waitAtPause(point) {

        if (
            pauseWaiting ||
            finished ||
            !isCurrent()
        ) {
            return;
        }

        pauseWaiting = true;

        if (segmentTimer) {
            clearTimeout(segmentTimer);
            segmentTimer = null;
        }

        const previousPoint =
            pauseIndex === 0
                ? 0
                : Number(
                    pausePoints[
                        pauseIndex - 1
                    ]
                );

        const segmentDuration =
            Math.max(
                0,
                Number(point) -
                previousPoint
            );

        pauseIndex++;

        lastPausePoint =
            Number(point);

        beginInternalAudioAction();

        currentAudio.onpause = null;

        try {
            currentAudio.pause();
        } catch (error) {}

        endInternalAudioActionSoon();


        const multiplier =
            Number(
                state.session.wait
            );


        const waitTime =
            (
                Number.isFinite(multiplier) &&
                multiplier > 0
                    ? segmentDuration *
                      multiplier *
                      1000
                    : 0
            );


        state.session.playing = true;

        playPauseButton.textContent =
            "⏸️";

        setMediaSessionNone();


        if (waitTime <= 0) {

            pauseWaiting = false;

            playAgain();

            return;
        }


        waitTimer =
            setTimeout(
                () => {

                    waitTimer = null;

                    if (
                        !isCurrent() ||
                        finished
                    ) {
                        return;
                    }

                    pauseWaiting = false;

                    playAgain();

                },
                waitTime
            );
    }


    function setupAudio() {

        if (
            !isCurrent() ||
            metadataReady
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

        metadataReady = true;

        sanitizePausePoints(
            duration
        );

        pauseIndex = 0;

        lastPausePoint = -1;


        if (firefoxEndTimer) {

            clearTimeout(
                firefoxEndTimer
            );

            firefoxEndTimer = null;
        }


        firefoxEndTimer =
            setTimeout(
                () => {

                    firefoxEndTimer = null;

                    if (
                        !isCurrent() ||
                        finished ||
                        !started
                    ) {
                        return;
                    }

                    const now =
                        Number(
                            currentAudio.currentTime
                        );

                    const currentDuration =
                        Number(
                            currentAudio.duration
                        );


                    if (
                        currentAudio.ended ||
                        (
                            Number.isFinite(now) &&
                            Number.isFinite(currentDuration) &&
                            currentDuration > 0 &&
                            now >=
                                currentDuration - 0.25
                        )
                    ) {

                        finishFirefoxAyah();

                        return;
                    }


                    const remaining =
                        Number.isFinite(
                            currentDuration
                        ) &&
                        currentDuration > now

                            ? Math.max(
                                100,
                                (
                                    currentDuration -
                                    now
                                ) * 1000 +
                                300
                            )

                            : 500;


                    firefoxEndTimer =
                        setTimeout(
                            () => {

                                firefoxEndTimer =
                                    null;

                                if (
                                    !isCurrent() ||
                                    finished ||
                                    !started
                                ) {
                                    return;
                                }

                                const finalNow =
                                    Number(
                                        currentAudio.currentTime
                                    );

                                const finalDuration =
                                    Number(
                                        currentAudio.duration
                                    );


                                if (
                                    currentAudio.ended ||
                                    (
                                        Number.isFinite(
                                            finalNow
                                        ) &&
                                        Number.isFinite(
                                            finalDuration
                                        ) &&
                                        finalDuration > 0 &&
                                        finalNow >=
                                            finalDuration -
                                            0.25
                                    )
                                ) {

                                    finishFirefoxAyah();
                                }

                            },
                            remaining
                        );

                },
                Math.max(
                    100,
                    duration * 1000 + 500
                )
            );


        while (
            pauseIndex <
                pausePoints.length &&
            Number(
                pausePoints[pauseIndex]
            ) <= 0
        ) {

            pauseIndex++;
        }

        configureFirefoxNativeAudioSpeed(
            currentAudio,
            1
        );

        endInternalAudioActionSoon();


        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );

        if (shouldAutoPlay) {
            playAgain();
        }
    }


    currentAudio.onplay =
        () => {

            if (!isCurrent()) {
                return;
            }

            started = true;

            setPlaying();
        };


    currentAudio.onplaying =
        () => {

            if (!isCurrent()) {
                return;
            }

            started = true;

            setPlaying();
        };


    currentAudio.onloadedmetadata =
        () => {

            if (!isCurrent()) {
                return;
            }

            setupAudio();
        };


    currentAudio.ontimeupdate =
        () => {

            if (
                !isCurrent() ||
                finished ||
                pauseWaiting ||
                !started
            ) {
                return;
            }

            const now =
                Number(
                    currentAudio.currentTime
                );

            const duration =
                Number(
                    currentAudio.duration
                );

            if (
                !Number.isFinite(now) ||
                !Number.isFinite(duration) ||
                duration <= 0
            ) {
                return;
            }


            if (
                now >=
                    duration - 0.08 &&
                pauseIndex >=
                    pausePoints.length
            ) {

                finishFirefoxAyah();

                return;
            }


            if (
                pauseIndex <
                pausePoints.length
            ) {

                const point =
                    Number(
                        pausePoints[
                            pauseIndex
                        ]
                    );

                if (
                    Number.isFinite(point) &&
                    point > lastPausePoint &&
                    now >= point - 0.025
                ) {

                    waitAtPause(point);
                }
            }
        };


    currentAudio.onended =
        () => {

            if (!isCurrent()) {
                return;
            }

            finishFirefoxAyah();
        };


    currentAudio.onpause =
        () => {

            if (!isCurrent()) {
                return;
            }

            if (
                internalAudioAction ||
                pauseWaiting
            ) {
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

            if (!isCurrent()) {
                return;
            }

            handleExternalSeekAttempt();
        };


    currentAudio.onerror =
        () => {

            if (!isCurrent()) {
                return;
            }

            clearTimers();

            state.session.playing =
                false;

            playPauseButton.textContent =
                "▶️";

            setMediaSessionNone();

            console.error(
                "خطأ في ملف الصوت في Firefox:",
                currentAudio.error
            );

            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


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

        setupAudio();
    }


    const shouldAutoPlay =
        userInitiated ||
        Boolean(
            state.session?.playing
        );

    if (
        shouldAutoPlay &&
        metadataReady
    ) {

        playAgain();
    }
}


/* =========================================================
   Firefox - وضع المعلم
========================================================= */

function startCurrentSegmentFirefoxTeacher(
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

    let metadataReady = false;
    let finished = false;
    let started = false;

    let waitingForSeek = false;
    let seekTarget = 0;


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

    if (firefoxEndTimer) {
        clearTimeout(firefoxEndTimer);
        firefoxEndTimer = null;
    }


    try {
        currentAudio.pause();
    } catch (error) {}


    try {

        currentAudio.removeAttribute("src");
        currentAudio.load();

        currentAudio.src = url;
        currentAudio.load();

    } catch (error) {

        endInternalAudioActionSoon();

        console.error(
            "تعذر تحميل ملف Firefox في وضع المعلم:",
            error
        );

        return;
    }


    configureFirefoxNativeAudioSpeed(
        currentAudio,
        1
    );


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
            !isCurrentSegment()
        ) {
            return;
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


    function playAgain() {

        if (
            !isCurrentSegment() ||
            finished ||
            waitingForSeek
        ) {
            return;
        }

        let promise = null;

        try {

            promise =
                currentAudio.play();

        } catch (error) {

            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        waitingForSeek
                    ) {
                        return;
                    }

                    try {

                        const retry =
                            currentAudio.play();

                        if (
                            retry &&
                            typeof retry.catch ===
                                "function"
                        ) {

                            retry.catch(
                                retryError => {

                                    console.error(
                                        "تعذر تشغيل Firefox في وضع المعلم:",
                                        retryError
                                    );

                                    if (
                                        isCurrentSegment()
                                    ) {

                                        state.session.playing =
                                            false;

                                        playPauseButton.textContent =
                                            "▶️";

                                        setMediaSessionNone();
                                    }
                                }
                            );
                        }

                    } catch (retryError) {

                        console.error(
                            "تعذر تشغيل Firefox في وضع المعلم:",
                            retryError
                        );

                        if (
                            isCurrentSegment()
                        ) {

                            state.session.playing =
                                false;

                            playPauseButton.textContent =
                                "▶️";

                            setMediaSessionNone();
                        }
                    }

                },
                100
            );

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

                    if (
                        error &&
                        (
                            error.name ===
                                "AbortError" ||
                            error.name ===
                                "NotAllowedError"
                        )
                    ) {

                        setTimeout(
                            () => {
                                playAgain();
                            },
                            100
                        );

                        return;
                    }

                    console.error(
                        "تعذر تشغيل Firefox في وضع المعلم:",
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


    function prepareTeacherSegment() {

        if (
            !isCurrentSegment() ||
            finished ||
            metadataReady
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

        if (
            Math.abs(
                currentAudio.currentTime -
                start
            ) > 0.02
        ) {

            waitingForSeek = true;
            seekTarget = start;

            internalSeekAction = true;

            try {

                currentAudio.currentTime =
                    start;

            } catch (error) {

                waitingForSeek = false;
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

            return;
        }

        const segmentDuration =
            Math.max(
                0,
                end - start
            );

        currentAudio._tahfeezSegmentDuration =
            segmentDuration;

        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );

        if (shouldAutoPlay) {
            playAgain();
        }
    }


    function continueAfterTeacherSeek() {

        if (
            !isCurrentSegment() ||
            finished
        ) {
            return;
        }

        waitingForSeek = false;

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

        const start =
            Number(bounds.start);

        const end =
            Number(bounds.end);

        const actualPosition =
            Number(
                currentAudio.currentTime
            );

        /*
            في Mi/Firefox-like engines لا نثق في حدث
            seeked وحده إذا لم يصل currentTime للمكان المطلوب.
        */

        if (
            !Number.isFinite(actualPosition) ||
            Math.abs(
                actualPosition -
                seekTarget
            ) > 0.15
        ) {

            waitingForSeek = true;

            internalSeekAction = true;

            try {
                currentAudio.currentTime =
                    seekTarget;
            } catch (error) {}

            setTimeout(
                () => {
                    internalSeekAction =
                        false;
                },
                0
            );

            return;
        }

        currentAudio._tahfeezSegmentDuration =
            Math.max(
                0,
                end - start
            );

        const shouldAutoPlay =
            userInitiated ||
            Boolean(
                state.session?.playing
            );

        if (shouldAutoPlay) {
            playAgain();
        }
    }


    function armFirefoxTeacherTimer() {

        if (
            !metadataReady ||
            !started ||
            finished ||
            waitingForSeek ||
            !isCurrentSegment()
        ) {
            return;
        }

        const segmentDuration =
            Number(
                currentAudio._tahfeezSegmentDuration
            );

        if (
            !Number.isFinite(segmentDuration) ||
            segmentDuration <= 0
        ) {
            return;
        }

        if (segmentTimer) {
            clearTimeout(segmentTimer);
        }

        segmentTimer =
            setTimeout(
                () => {

                    if (
                        !isCurrentSegment() ||
                        finished ||
                        !started
                    ) {
                        return;
                    }

                    const now =
                        Number(
                            currentAudio.currentTime
                        );

                    const duration =
                        Number(
                            currentAudio.duration
                        );

                    const bounds =
                        getSegmentBounds(
                            duration
                        );

                    if (
                        bounds &&
                        Number.isFinite(now) &&
                        now >=
                            bounds.end - 0.03
                    ) {

                        finishOnce();
                    }

                },
                Math.max(
                    100,
                    segmentDuration * 1000 + 250
                )
            );
    }


    currentAudio.onplay =
        () => {

            if (!isCurrentSegment()) {
                return;
            }

            started = true;

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armFirefoxTeacherTimer();

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

            started = true;

            state.session.playing = true;

            playPauseButton.textContent =
                "⏸️";

            armFirefoxTeacherTimer();

            if ("mediaSession" in navigator) {

                try {

                    navigator.mediaSession.playbackState =
                        "playing";

                } catch (error) {}
            }
        };


    currentAudio.onloadedmetadata =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.ondurationchange =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.onloadeddata =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.oncanplay =
        () => {

            prepareTeacherSegment();
        };


    currentAudio.onseeked =
        () => {

            if (
                !isCurrentSegment() ||
                !waitingForSeek
            ) {
                return;
            }

            continueAfterTeacherSeek();
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
                Number.isFinite(now) &&
                now >=
                    bounds.end - 0.02
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

            if (!isCurrentSegment()) {
                return;
            }

            if (
                internalAudioAction ||
                waitingForSeek
            ) {
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
                "خطأ في ملف الصوت في Firefox - وضع المعلم:",
                currentAudio.error
            );

            showAvailability(
                "تعذر تشغيل ملف الصوت."
            );
        };


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

        prepareTeacherSegment();
    }
}


