const AudioContext = window.AudioContext || window.webkitAudioContext;
const audioCtx = new AudioContext();
const timerWorker = new Worker("worker.js");

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
            scheduledBeats: []
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
            if (!this.tempo)
                this.tempo = this.startTempo;
            this.isPlaying = true;
            this.currentBeat = 0;
            this.nextNoteTime = audioCtx.currentTime;
            timerWorker.postMessage(["scheduleBar", 0]);
        },
        scheduleBar() {
            const secondsPerBeat = 60.0 / this.tempo;
            for (let beat = 1; beat <= 4; beat++) {
                let osc = audioCtx.createOscillator();
                osc.connect(audioCtx.destination);

                if (beat === 1) {
                    osc.frequency.value = 440.0;
                } else {
                    osc.frequency.value = 220.0;
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
            let canChangeTempo = this.currentBar == this.jumpOnBar;
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
    }
}

Vue.createApp(vueApp).mount('#vue-app');