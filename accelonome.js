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
var currentBar = 0;
var barChanged = false;
var beat = 1;
var lookahead = 25.0;


function nextNote() {
    var secondsPerBeat = 60.0 / tempo;
    nextNoteTime += secondsPerBeat;

    beat++;
    console.log("tempo " + tempo);
    if (currentBar % jumpOnBar == 0 && barChanged == true) {
        tempo += jumpBpm;
        if (tempo == endTempo) {
            tempo = startTempo;
        }
        console.log("tempo changed " + tempo);
        barChanged = false;
    }
}

function scheduleSound() {
    while (nextNoteTime < audioCtx.currentTime + scheduleAheadTime ) {
        makeSound(beat, nextNoteTime);
        nextNote();
    }
}

function hitPlay() {
    startTempo = parseInt(document.getElementById("startTempo").value);
    endTempo = parseInt(document.getElementById("endTempo").value);
    jumpBpm = parseInt(document.getElementById("jumpTempo").value);
    jumpOnBar = parseInt(document.getElementById("jumpOnBar").value);

    isPlaying = !isPlaying;

    if (!isPlaying) {
        timerWorker.postMessage("stop");
        return "Play";
    }

    if (!startTempo) {
        return "Play";
    }

    tempo = startTempo;
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

    if (beat % 4 === 0 ) {  // quarter notes = medium pitch
        osc.frequency.value = 440.0;
        currentBar += 1;
        barChanged = true
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
