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
            bounds.end - bounds.start
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

    state.session.playing = true;

    playPauseButton.textContent =
        "⏸️";

    setMediaSessionNone();

    if (waitTimer) {
        clearTimeout(waitTimer);
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

        state.session.playing = true;

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

        state.session.playing = true;

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

    state.session.playing = true;

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
        state.session.playing = false;
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

    if (firefoxEndTimer) {

        clearTimeout(firefoxEndTimer);

        firefoxEndTimer = null;
    }

    playbackToken++;

    resetAudioElement();

    segmentIndex = 0;

    currentAudioType = "normal";

    state.session.playing = false;

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

    segmentIndex = 0;

    currentAudioType = "normal";

    if (state.session) {
        state.session.playing = false;
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


