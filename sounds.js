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

for (const [sound_name, data] of Object.entries(SOUNDS)) {
    fetch(data.path).then((resp) => {
        return resp.arrayBuffer();
    }).then((buffer) => {
        audioCtx.decodeAudioData(buffer, (decodedData) => SOUNDS[sound_name]["buffer"] = decodedData);
    });
};