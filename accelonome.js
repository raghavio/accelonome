const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const timerWorker = new Worker("worker.js");
let playedEmptyBuffer = false;

const vueApp = {
    data() {
        return {
            isPlaying: false,
            startTempo: 100,
            tempo: null,
            endTempo: 180,
            jumpBpm: 10,
            jumpOnBar: 4,
            noteLength: 0.05,
            nextNoteTime: 0,
            currentBar: 1,
            scheduledBeats: [],
            note: 4,  // default to quarter note.
            beats: 4, // default to 4/4
            accentedBeats: [1],
        }
    },
    methods: {
        hitReset() {
            this.tempo = null;
            this.stop();
        },
        stop() {
            this.currentBar = 1;
            this.isPlaying = false;
            timerWorker.postMessage("stop");
            this.scheduledBeats.forEach(osc => {
                osc.stop();
            });
            this.scheduledBeats = [];
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
            this.currentBeat = 0;
            this.nextNoteTime = audioCtx.currentTime;
            timerWorker.postMessage(["scheduleBar", 0]);
        },
        scheduleBar() {
            note_multiplier = this.note / 4;  // will give 2 for 8th note. 1 quarter note = 2 8th note.
            const secondsPerBeat = 60.0 / (this.tempo * note_multiplier);
            for (let beat = 1; beat <= this.beats; beat++) {
                let osc = audioCtx.createOscillator();
                osc.connect(audioCtx.destination);

                if (this.accentedBeats.includes(beat)) {
                    osc.frequency.value = 880.0;
                } else {
                    osc.frequency.value = 440;
                }
                osc.start(this.nextNoteTime);
                osc.stop(this.nextNoteTime + this.noteLength);
                this.scheduledBeats.push(osc);  // store the objects so we can stop later if required.
                this.nextNoteTime += secondsPerBeat;
            }
            // schedule next bar half a second before the current bar finishes.
            next_bar_to_be_scheduled_in_seconds = (this.nextNoteTime - audioCtx.currentTime);
            timerWorker.postMessage(["scheduleBar", next_bar_to_be_scheduled_in_seconds]);
        },
        barCompleted() {
            this.currentBar += 1;
            this.scheduledBeats.splice(0, 4); // remove the played beats after a bar is over.
            let canChangeTempo = this.currentBar == this.jumpOnBar + 1;
            if (canChangeTempo) {
                let updatedTempo = this.tempo + this.jumpBpm;
                if (updatedTempo > this.endTempo)
                    updatedTempo = this.startTempo;
                this.tempo = updatedTempo;
                this.currentBar = 1;  // also reset bar back to 1.
            }
        }

    },
    mounted() {
        timerWorker.onmessage = (e) => {
            if (e.data == "tick") {
                // if there were scheduled beats then that means the bar is finished.
                // this should get run everytime except the very first time.
                if (this.scheduledBeats.length > 0)
                    this.barCompleted();
                this.scheduleBar();
            }
        }
    },
    watch: {
        //  bootstrap-select doesn't auto update on its own.
        beats: function (newValues, oldValues) {
            this.$nextTick(() => { $('.selectpicker').selectpicker('refresh'); });
        }
    }
}

Vue.createApp(vueApp).mount('#vue-app');