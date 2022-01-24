const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();

const SOUNDS = {
    "metronome_1_accent": { "path": "/assets/audio/metronome_beat_1_accent.mp3", "buffer": null },
    "metronome_1": { "path": "/assets/audio/metronome_beat_1.mp3", "buffer": null },
    "metronome_2_accent": { "path": "/assets/audio/metronome_beat_2_accent.wav", "buffer": null },
    "metronome_2": { "path": "/assets/audio/metronome_beat_2.wav", "buffer": null },
    "metronome_3_accent": { "path": "/assets/audio/metronome_beat_3_accent.wav", "buffer": null },
    "metronome_3": { "path": "/assets/audio/metronome_beat_3.wav", "buffer": null },
    "metronome_4_accent": { "path": "/assets/audio/metronome_beat_4_accent.wav", "buffer": null },
    "metronome_4": { "path": "/assets/audio/metronome_beat_4.wav", "buffer": null },
};

const DEFAULT_SOUNDS = new Set(["metronome_1_accent", "metronome_1"]);

function loadSound(soundName) {
    data = SOUNDS[soundName];
    fetch(data.path).then((resp) => {
        return resp.arrayBuffer();
    }).then((buffer) => {
        audioCtx.decodeAudioData(buffer, (decodedData) => SOUNDS[soundName]["buffer"] = decodedData);
    });
}

function loadDefaultSound() {
    DEFAULT_SOUNDS.forEach((sound) => loadSound(sound));
}

function loadOtherSounds() {
    const OTHER_SOUNDS = Object.keys(SOUNDS).filter(x => !DEFAULT_SOUNDS.has(x));
    OTHER_SOUNDS.forEach((sound) => loadSound(sound));
}

loadDefaultSound();
// loading this here so it downloads the script quickly and I have my worker initiated when user clicks start.
// a hack until I introduce webpack/bundler to reduce resource requests on website load.
const timerWorker = new Worker("worker.js");