// create web audio api context
var AudioContext = window.AudioContext || window.webkitAudioContext;
var audioCtx = new AudioContext();
var timerWorker = new Worker("worker.js");

var isPlaying = false;
var startTempo = null;
var tempo = null;
var endTempo = null;
var jumpBpm = null;
var jumpOnBar = null;
var noteLength = 0.05;
var nextNoteTime = 0;
var scheduleAheadTime = 0.1;
var currentBar = 1;
var barChanged = false;
var beat = 1;
var lookahead = 25.0;
var playedEmptyBuffer = false;

function nextNote() {
    var secondsPerBeat = 60.0 / tempo;
    nextNoteTime += secondsPerBeat;

    beat++;
    if (currentBar % jumpOnBar == 0 && barChanged == true) {
        tempo += jumpBpm;
        if (tempo == endTempo) {
            tempo = startTempo;
        }
        currentBar = 1;
        refreshUI();
        barChanged = false;
    }
}

function scheduleSound() {
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime ) {
        makeSound(beat, nextNoteTime);
        nextNote();
    }
}

function hitReset() {
    tempo = startTempo;
    currentBar = 1;
    beat = 1;
    document.getElementById("playButton").textContent = "Play";
    refreshUI();
    isPlaying = false;
    timerWorker.postMessage("stop");
    return;
}

function refreshUI() {
    document.getElementById("currentTempo").textContent = "Current BPM: " + tempo;
    document.getElementById("currentBar").textContent = "Current Bar: " + currentBar;
}

function hitPlay() {
    if (!playedEmptyBuffer) {
        // play silent buffer to unlock the audio. Fix for iOS.
        var buffer = audioCtx.createBuffer(1, 1, 22050);
        var node = audioCtx.createBufferSource();
        node.buffer = buffer;
        node.connect(audioCtx.destination);
        node.start(0);
        playedEmptyBuffer = true;
    }
    startTempo = parseInt(document.getElementById("startTempo").value);
    endTempo = parseInt(document.getElementById("endTempo").value);
    jumpBpm = parseInt(document.getElementById("jumpTempo").value);
    jumpOnBar = parseInt(document.getElementById("jumpOnBar").value) + 1;

    isPlaying = !isPlaying;

    if (!isPlaying) {
        currentBar = 1;
        beat = 1;
        timerWorker.postMessage("stop");
        refreshUI();
        return "Play";
    }

    if (!startTempo) {
        return "Play";
    }
    if (!tempo) {
        tempo = startTempo;
    }
    refreshUI();
    currentBeat = 0;
    nextNoteTime = audioCtx.currentTime;
    timerWorker.postMessage("start");
    return "Stop";
}

function makeSound(beat, start) {
    // create Oscillator and gain node
    var osc = audioCtx.createOscillator();

    // connect oscillator to gain node to speakers
    osc.connect(audioCtx.destination);
    refreshUI();
    if (beat % 4 === 1) {  // quarter notes = medium pitch
        osc.frequency.value = 440.0;
    } else if (beat % 4 === 0 ) {
        currentBar += 1;
        barChanged = true
        osc.frequency.value = 220.0;
    } else                        // other 16th notes = low pitch
        osc.frequency.value = 220.0;

    osc.start(start);
    osc.stop(start + noteLength);
}

timerWorker.onmessage = function(e) {
    if (e.data == "tick") {
        scheduleSound();
    } else
        console.log("message: " + e.data);
};
timerWorker.postMessage({"interval":lookahead});
