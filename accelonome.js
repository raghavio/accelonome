const IS_PHONE_APP = navigator.userAgent == 'accelonome-android';
const DRUMS_PATTERN = {
    4: {
        4: {
            "open_hihat": { "inbetween": [[], [15]], "filler": [], "volume": 0.3, "duration": 0.4 },
            "closed_hithat": { "inbetween": [[3, 7, 11, 15], [3, 7, 11]], "volume": 0.05, "duration": 1 },
            "crash_cymbal": { "first_bar": [1], "inbetween": [], "volume": 0.5, "duration": 2 },
            "kick": { "inbetween": [[1, 9, 11]], "volume": 0.95, "duration": 1 },
            "snare": { "inbetween": [[5, 13]], "filler": [5, 13, 15, 16], "volume": 1, "duration": 1 }
        },
        5: {
            "closed_hithat": { "inbetween": [[1, 5, 9, 13, 17]], "volume": 0.05, "duration": 1 },
            "crash_cymbal": { "first_bar": [1], "inbetween": [], "volume": 0.5, "duration": 2 },
            "kick": { "inbetween": [[1]], "volume": 0.95, "duration": 1 },
            "snare": { "inbetween": [[13]], "volume": 0.8, "duration": 1 },
            // "tom": { "filler": [18], "inbetween": [], "volume": 0.9, "duration": 1 }
        },
    },
    8: {
        6: {
            "open_hihat": { "inbetween": [[], [11]], "filler": [], "volume": 0.3, "duration": 0.5 },
            "closed_hithat": { "inbetween": [[1,3,5,7,9,11], [1,3,5,7,9]], "volume": 0.3, "duration": 0.5 },
            "crash_cymbal": { "first_bar": [1], "inbetween": [], "volume": 0.5, "duration": 2 },
            "kick": { "inbetween": [[1,11]], "volume": 0.95, "duration": 1 },
            "snare": { "inbetween": [[7]], "filler": [7,9,10], "volume": 1, "duration": 1 },
            "tom": { "filler": [11], "inbetween": [], "volume": 1, "duration": 1 }
        },
    }
}
const knobTextElement = document.getElementById('knobText');
const knobSubTextElement = document.getElementById('knobSubText');
const currentBarElement = document.getElementById('currentBar');
const barsToPlayElement = document.getElementById('barsToPlay');

let userInput = {
    startTempo: 80,
    endTempo: 160,
    jumpBpm: 10,
    tempoChangeAfterX: 4,  // value of the tempo change trigger. could be number of bars, seconds or minutes.
    tempoChangeTrigger: 'bar', // tempo should get changed on Bar by default.
    note: 4,  // default to quarter note.
    beats: 4, // default to 4/4.
    tickSound: "metronome_1",
    drumsEnabled: false,
    vibrateOn: false,
    flashOn: false,
    shouldAccelerate: true,
    startCueEnabled: true,
    reverseEnabled: false,
    accentedBeats: [1]
};

let playedEmptyBuffer = false;
let player = null;
let isPlaying =  false;
let tempo = null;
let noteLength = 0.05;
let nextNoteTime = 0;
let currentBarUI = 1;
let currentBar = 1;
let scheduledBeats = [];
let lastTempoChangeTime = null; // time when user clicked play.
let isReversing = false;
let isPhoneApp = IS_PHONE_APP;
let barsToPlay = 0;

function onWebAudioFontLoad() {
    player = new WebAudioFontPlayer(); // https://github.com/surikov/webaudiofont/
}

function secondsPerBeat() {
    const note_multiplier = userInput.note / 4;  // will give 2 for 8th note. ex: 1 quarter note = 2 8th note.
    const secondsPerBeat = 60.0 / (tempo * note_multiplier);
    return secondsPerBeat;
}

function areDrumsAvailable() {
    const isAvailable = userInput.note in DRUMS_PATTERN && userInput.beats in DRUMS_PATTERN[userInput.note];
    if (!isAvailable) {
        userInput.drumsEnabled = false;
    }
    return isAvailable;
}

function reset() {
    stop();
    tempo = userInput.startTempo;
    knobTextElement.textContent = tempo;
}

function stop() {
    timerWorker.postMessage({ eventName: "clearTimeout" });
    currentBar = 1;
    currentBarUI = currentBar;
    isPlaying = false;
    scheduledBeats.forEach(osc => {
        osc.stop();
    });
    player.cancelQueue(audioCtx);
    scheduledBeats = [];
    if (userInput.vibrateOn)
        navigator.vibrate(0);
    resetKnobAnimation();
    if (IS_PHONE_APP)
        sendDataToAndroid("stop");
    knobSubTextElement.style.display = 'none'; // Hide the element when playing stops.
    knobTextElement.textContent = 'Start';
}

function enableStartCue() {
    currentBar -= 1;
    currentBarUI -= 1;
}

function isStartCueBar() {
    return currentBar == 0;
}

function play() {
    if (!playedEmptyBuffer) {
        // play silent buffer to unlock the audio. Fix for iOS.
        let buffer = audioCtx.createBuffer(1, 1, 22050);
        let node = audioCtx.createBufferSource();
        node.buffer = buffer;
        node.connect(audioCtx.destination);
        node.start(0);
        playedEmptyBuffer = true;
    }
    if (!SOUNDS[userInput.tickSound].buffer || !SOUNDS[userInput.tickSound + '_accent'].buffer)
        return;  // sound not loaded yet. can't play.
    isPlaying = true;
    if (userInput.shouldAccelerate) // Show tempo progress in UI if accelerating
        knobSubTextElement.style.display = 'inline';

    if (!tempo) {
        tempo = userInput.startTempo;
        userEnteredTempo = userInput.startTempo;
    }
    nextNoteTime = audioCtx.currentTime;
    if (userInput.startCueEnabled) {
        enableStartCue();
    } else { // not to show knob animation if it's start cue
        lastTempoChangeTime = audioCtx.currentTime;  // used in case if tempo change trigger is time basis.
        performKnobAnimation();
    }
    scheduleBar();
    if (userInput.vibrateOn)
        scheduleVibration();
    if (IS_PHONE_APP)
        sendDataToAndroid("scheduleBar");
    uiVariablesUpdate();
}

function scheduleBar() {
    if (userInput.drumsEnabled && !isStartCueBar()) { // don't play drums if it's start cue
        scheduleDrums();
    }
    for (let beat = 1; beat <= userInput.beats; beat++) {
        const source = audioCtx.createBufferSource();
        source.connect(metronomeGain);
        metronomeGain.connect(audioCtx.destination);

        if (userInput.accentedBeats.includes(beat)) {
            source.buffer = SOUNDS[userInput.tickSound + '_accent']['buffer'];
        } else {
            source.buffer = SOUNDS[userInput.tickSound]['buffer'];
        }
        source.start(nextNoteTime);
        scheduledBeats.push(source);  // store the objects so we can stop later if required.
        nextNoteTime += secondsPerBeat();
    }
    const barFinishTimeInSeconds = (nextNoteTime - audioCtx.currentTime);
    // scheduling trigger for next bar 300ms before its time.
    const next_bar_to_be_scheduled_in_seconds = barFinishTimeInSeconds - 0.3;

    timerWorker.postMessage({ eventName: "scheduleBar", inSeconds: next_bar_to_be_scheduled_in_seconds });
    timerWorker.postMessage({ eventName: "barCompleted", inSeconds: barFinishTimeInSeconds });
}

function scheduleDrums() {
    const sixteenthTime = 60.0 / (tempo * 4);
    const beatLength = 1 / 16 * sixteenthTime;
    const isLastBarBeforeTempoChange = currentBar == barsToPlay;

    for (const [instrument, config] of Object.entries(DRUMS_PATTERN[userInput.note][userInput.beats])) {
        let beat = null;

        if (currentBar == 1 && 'first_bar' in config) {
            beat = config['first_bar'];
        } else if (isLastBarBeforeTempoChange && 'filler' in config) {
            beat = config['filler'];
        } else if (config['inbetween'].length >= 1) {
            if (config['inbetween'].length == 1)
                beat = config['inbetween'][0];
            else
                beat = config['inbetween'][(currentBar - 1) % 2];  // alternate the inbetween beats
        } else {
            continue;
        }
        for (const sixteenthNote of beat) {
            const volume = (1.0 - Math.random() * 0.3) * config['volume'];
            player.queueWaveTable(audioCtx, audioCtx.destination, { zones: [SOUNDS[instrument]] },
                beatLength + nextNoteTime + (sixteenthNote - 1) * sixteenthTime, SOUNDS[instrument].originalPitch / 100, config['duration'], volume);
        }
    }
}

function performKnobAnimation() {
    if (!userInput.shouldAccelerate)  // the animation is for tempo change indication. no need if not accelerating.
        return;
    if (!isPlaying)
        return;  // race condition issues.
    // UI animation for dial. Should play just for the 1st bar.
    const barTime = secondsPerBeat() * userInput.beats;  // time it takes to complete a bar.
    const animationDurationInSeconds = () => {
        let secondsToPlay = null;
        switch (userInput.tempoChangeTrigger) {
            case 'second':
                secondsToPlay = userInput.tempoChangeAfterX;
                if (secondsToPlay % barTime)  // consider time for switching tempo at bar finish.
                    secondsToPlay += (barTime - secondsToPlay % barTime);
                return secondsToPlay;
            case 'minute':
                const tempoChangeInSeconds = userInput.tempoChangeAfterX * 60;
                secondsToPlay = tempoChangeInSeconds;
                if (secondsToPlay % barTime)  // consider time for switching tempo at bar finish.
                    secondsToPlay += (barTime - secondsToPlay % barTime);
                return secondsToPlay;
            case 'bar':
                return barTime * userInput.tempoChangeAfterX;
        }
    };
    const duration = animationDurationInSeconds();
    barsToPlay = Math.round(duration / barTime);
    const progressCircle = document.getElementById('knobProgress');

    resetKnobAnimation();
    setTimeout(() => {
        progressCircle.style.transitionDuration = `${duration}s`;
    progressCircle.style.strokeDashoffset = '0';
    }, 50); 
    
}

function resetKnobAnimation() {
    const progressCircle = document.getElementById('knobProgress');
    progressCircle.style.transitionDuration = `0s`;
    progressCircle.style.strokeDashoffset = '282.6';
}

function scheduleVibration() {
    if (IS_PHONE_APP) // don't play if on phone app.
        return;
    let vibrationPatterns = [];
    for (let beat = 1; beat <= userInput.beats; beat++) {
        if (userInput.accentedBeats.includes(beat)) {
            vibrationPatterns.push(25, 15, 25, Math.round((secondsPerBeat()) * 1000) - 65);
        } else {
            vibrationPatterns.push(65, Math.round((secondsPerBeat()) * 1000) - 65);
        }
    }
    navigator.vibrate(vibrationPatterns);
}

function sendDataToAndroid(eventName) {
    let data = {};
    if (eventName == "scheduleBar") {
        data = {
            vibration: userInput.vibrateOn,
            flash: userInput.flashOn,
            waitTime: Array(userInput.beats).fill(Math.round((secondsPerBeat()) * 1000)),
            accentedBeats: userInput.accentedBeats
        }
    }
    try {
        Lightation.postMessage(JSON.stringify({ eventName: eventName, data: data }));
    } catch { }
}

function barCompleted() {
    currentBar += 1;
    scheduledBeats.splice(0, 4); // remove the played beats after a bar is over.
    const isLastBarBeforeTempoChange = currentBar == barsToPlay + 1;
    if (isLastBarBeforeTempoChange) {
        let updatedTempo = isReversing ? tempo - userInput.jumpBpm : tempo + userInput.jumpBpm;
        if (updatedTempo > userInput.endTempo || updatedTempo < userInput.startTempo) {
            if (updatedTempo < userInput.startTempo) {
                updatedTempo = tempo + userInput.jumpBpm;  // back to increaseing
                isReversing = false;
            } else if (userInput.reverseEnabled) {
                isReversing = true;
                updatedTempo = tempo - userInput.jumpBpm;
            } else {
                updatedTempo = userInput.startTempo;
            }
        }
        tempo = updatedTempo;
        lastTempoChangeTime = audioCtx.currentTime;
        currentBar = 1;  // also reset bar back to 1.
    }
}

function uiVariablesUpdate() {
    knobTextElement.textContent = tempo;
    currentBarElement.textContent = currentBar;
    barsToPlayElement.textContent = barsToPlay;
}

const vueApp = {
    watch: {
        //  bootstrap-select doesn't auto update on its own.
        beats: function (newValues, oldValues) {
            this.$nextTick(() => { $('.selectpicker').selectpicker('refresh'); });
        },
        startTempo: function (newValues, oldValues) {
            this.tempo = this.startTempo;  // set new tempo only when startTempo's value changes.
            this.tempoUI = this.tempo;
        }
    }
}

document.addEventListener('DOMContentLoaded', (_) => {
    timerWorker.onmessage = (e) => {
        switch (e.data) {
            case "scheduleBar":
                barCompleted();
                scheduleBar();
                break;
            case "barCompleted":
                uiVariablesUpdate();
                if (userInput.vibrateOn)
                    scheduleVibration();
                const isFirstBar = currentBar == 1;
                if (isFirstBar) {
                    performKnobAnimation();
                }
                if (IS_PHONE_APP)
                    sendDataToAndroid("scheduleBar");
                break;
        }
    }
    loadOtherSounds();  // once vue is loaded. download other sounds.
});