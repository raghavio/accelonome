const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const timerWorker = new Worker("worker.js");
let playedEmptyBuffer = false;
let SOUNDS = {
    "metronome_1_accent": { "path": "/assets/audio/metronome_beat_1_accent.mp3", "buffer": null },
    "metronome_1": { "path": "/assets/audio/metronome_beat_1.mp3", "buffer": null },
    "metronome_2_accent": { "path": "/assets/audio/metronome_beat_2_accent.wav", "buffer": null },
    "metronome_2": { "path": "/assets/audio/metronome_beat_2.wav", "buffer": null },
    "metronome_3_accent": { "path": "/assets/audio/metronome_beat_3_accent.wav", "buffer": null },
    "metronome_3": { "path": "/assets/audio/metronome_beat_3.wav", "buffer": null },
    "metronome_4_accent": { "path": "/assets/audio/metronome_beat_4_accent.wav", "buffer": null },
    "metronome_4": { "path": "/assets/audio/metronome_beat_4.wav", "buffer": null },
};

const vueApp = {
    data() {
        return {
            isPlaying: false,
            startTempo: 100,
            tempo: null,
            endTempo: 180,
            jumpBpm: 10,
            tempoChangeAfterX: 4,  // value of the tempo change trigger. could be number of bars, seconds or minutes.
            noteLength: 0.05,
            nextNoteTime: 0,
            currentBar: 1,
            scheduledBeats: [],
            note: 4,  // default to quarter note.
            beats: 4, // default to 4/4
            accentedBeats: [1],
            tempoChangeTrigger: 'bar', // tempo should get changed on Bar by default.
            lastTempoChangeTime: null, // time when user clicked play.
            tickSound: "metronome_1",
        }
    },
    methods: {
        loadSoundBuffers() {
            for (const [sound_name, data] of Object.entries(SOUNDS)) {
                fetch(data.path).then((resp) => {
                    return resp.arrayBuffer();
                }).then((buffer) => {
                    audioCtx.decodeAudioData(buffer, (decodedData) => SOUNDS[sound_name]["buffer"] = decodedData);
                });
            };
        },
        stop() {
            this.currentBar = 1;
            this.isPlaying = false;
            timerWorker.postMessage({ eventName: "stop" });
            this.scheduledBeats.forEach(osc => {
                osc.stop();
            });
            this.scheduledBeats = [];
            $('.dial').stop();
        },
        play() {
            if (!playedEmptyBuffer) {
                // play silent buffer to unlock the audio. Fix for iOS.
                let buffer = audioCtx.createBuffer(1, 1, 22050);
                let node = audioCtx.createBufferSource();
                node.buffer = buffer;
                node.connect(audioCtx.destination);
                node.start(0);
                playedEmptyBuffer = true;
            }
            if (!this.tempo)
                this.tempo = this.startTempo;
            this.isPlaying = true;
            this.nextNoteTime = audioCtx.currentTime;
            this.lastTempoChangeTime = audioCtx.currentTime;  // used in case if tempo change trigger is time basis.
            this.scheduleBar();
        },
        scheduleBar() {
            note_multiplier = this.note / 4;  // will give 2 for 8th note. 1 quarter note = 2 8th note.
            const secondsPerBeat = 60.0 / (this.tempo * note_multiplier);

            for (let beat = 1; beat <= this.beats; beat++) {
                const source = audioCtx.createBufferSource();
                source.connect(audioCtx.destination);

                if (this.accentedBeats.includes(beat)) {
                    source.buffer = SOUNDS[this.tickSound + '_accent']['buffer'];
                } else {
                    source.buffer = SOUNDS[this.tickSound]['buffer'];
                }
                source.start(this.nextNoteTime);
                this.scheduledBeats.push(source);  // store the objects so we can stop later if required.
                this.nextNoteTime += secondsPerBeat;
            }
            // schedule next bar after this one finishes.
            next_bar_to_be_scheduled_in_seconds = (this.nextNoteTime - audioCtx.currentTime);

            // UI animation for dial. Should play just for the 1st bar.
            if (this.currentBar == 1) {
                const barTime = next_bar_to_be_scheduled_in_seconds;  // time it takes to complete a bar.
                const animationDurationInSeconds = () => {
                    let secondsToPlay = null;
                    switch (this.tempoChangeTrigger) {
                        case 'second':
                            secondsToPlay = this.tempoChangeAfterX;
                            if (secondsToPlay % barTime)  // consider time for switching tempo at bar finish.
                                secondsToPlay += (barTime - secondsToPlay % barTime);
                            return secondsToPlay;
                        case 'minute':
                            const tempoChangeInSeconds = this.tempoChangeAfterX * 60;
                            secondsToPlay = tempoChangeInSeconds;
                            if (secondsToPlay % barTime)  // consider time for switching tempo at bar finish.
                                secondsToPlay += (barTime - secondsToPlay % barTime);
                            return secondsToPlay;
                        case 'bar':
                            return barTime * this.tempoChangeAfterX;
                    }
                };
                const duration = animationDurationInSeconds();
                this.barsToPlay = duration / barTime;
                $('.dial').stop();  // in case it gets buggy, stop it first before playing.
                $('.dial').animate({ value: 100 }, {
                    duration: duration * 1000,
                    easing: 'linear',
                    step: function () {
                        $('.dial').val(this.value).trigger('change');
                    },
                    always: function () {
                        $('.dial').val(0).trigger('change');
                    }
                });
            }
            timerWorker.postMessage({ eventName: "scheduleBar", inSeconds: next_bar_to_be_scheduled_in_seconds });
        },
        barCompleted() {
            this.currentBar += 1;
            this.scheduledBeats.splice(0, 4); // remove the played beats after a bar is over.
            const canChangeTempo = () => {
                seconds_since_first_play = audioCtx.currentTime - this.lastTempoChangeTime;
                switch (this.tempoChangeTrigger) {
                    case 'second':
                        return seconds_since_first_play >= this.tempoChangeAfterX;
                    case 'minute':
                        return seconds_since_first_play >= this.tempoChangeAfterX * 60;
                    case 'bar':
                        return this.currentBar == this.tempoChangeAfterX + 1;
                }
            };
            if (canChangeTempo()) {
                let updatedTempo = this.tempo + this.jumpBpm;
                if (updatedTempo > this.endTempo)
                    updatedTempo = this.startTempo;
                this.tempo = updatedTempo;
                this.lastTempoChangeTime = audioCtx.currentTime;
                this.currentBar = 1;  // also reset bar back to 1.
            }
        }

    },
    mounted() {
        this.loadSoundBuffers();
        timerWorker.onmessage = (e) => {
            if (e.data == "tick") {
                this.barCompleted();
                this.scheduleBar();
            }
        }
        $(".dial").knob({
            width: 340,
            height: 340,
            thickness: '0.10',
            fgColor: '#ffeb3a',
            readOnly: true,
            bgColor: '#2295f1'
        });
    },
    watch: {
        //  bootstrap-select doesn't auto update on its own.
        beats: function (newValues, oldValues) {
            this.$nextTick(() => { $('.selectpicker').selectpicker('refresh'); });
        },
        startTempo: function (newValues, oldValues) {
            this.tempo = this.startTempo;  // set new tempo only when startTempo's value changes.
        }
    }
}

Vue.createApp(vueApp).mount('#vue-app');