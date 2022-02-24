let playedEmptyBuffer = false;
let player = null;

const IS_PHONE_APP = navigator.userAgent == 'accelonome-android';
const DRUMS_PATTERN = {
    4: {
        4: {
            "open_hihat": { "inbetween": [[], [15]], "filler": [], "volume": 0.3, "duration": 0.4 },
            "closed_hithat": { "inbetween": [[3, 7, 11, 15], [3, 7, 11, 15]], "volume": 0.05, "duration": 1 },
            "crash_cymbal": { "first_bar": [1], "inbetween": [], "volume": 0.5, "duration": 2 },
            "kick": { "inbetween": [[1, 9, 11], [1, 9, 11]], "volume": 0.95, "duration": 1 },
            "snare": { "inbetween": [[5, 13], [5, 13]], "filler": [5, 13, 15, 16], "volume": 1, "duration": 1 }
        },
    },
}

function onWebAudioFontLoad() {
    player = new WebAudioFontPlayer(); // https://github.com/surikov/webaudiofont/
}

const vueApp = {
    data() {
        return {
            isPlaying: false,
            startTempo: 80,
            tempoUI: null,
            tempo: null,
            endTempo: 160,
            jumpBpm: 10,
            tempoChangeAfterX: 4,  // value of the tempo change trigger. could be number of bars, seconds or minutes.
            noteLength: 0.05,
            nextNoteTime: 0,
            currentBarUI: 1,
            currentBar: 1,
            scheduledBeats: [],
            note: 4,  // default to quarter note.
            beats: 4, // default to 4/4
            accentedBeats: [1],
            tempoChangeTrigger: 'bar', // tempo should get changed on Bar by default.
            lastTempoChangeTime: null, // time when user clicked play.
            tickSound: "metronome_1",
            vibrateOn: false,
            reverseEnabled: false,
            isReversing: false,
            shouldAccelerate: true,
            drumsEnabled: false,
            flashOn: false,
            isPhoneApp: IS_PHONE_APP
        }
    },
    methods: {
        reset() {
            this.stop();
            this.tempo = this.startTempo;
            this.tempoUI = this.tempo;
        },
        stop() {
            timerWorker.postMessage({ eventName: "clearTimeout" });
            this.currentBar = 1;
            this.currentBarUI = this.currentBar;
            this.isPlaying = false;
            this.scheduledBeats.forEach(osc => {
                osc.stop();
            });
            player.cancelQueue(audioCtx);
            this.scheduledBeats = [];
            if (this.vibrateOn)
                navigator.vibrate(0);
            $('.dial').stop();
            if (IS_PHONE_APP)
                this.sendDataToAndroid("stop");
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
            if (!SOUNDS[this.tickSound].buffer || !SOUNDS[this.tickSound + '_accent'].buffer)
                return;  // sound not loaded yet. can't play.
            this.isPlaying = true;

            if (!this.tempo) {
                this.tempo = this.startTempo;
                this.tempoUI = this.startTempo;
                this.userEnteredTempo = this.startTempo;
            }
            this.nextNoteTime = audioCtx.currentTime;
            this.lastTempoChangeTime = audioCtx.currentTime;  // used in case if tempo change trigger is time basis.
            this.scheduleBar();
            this.performKnobAnimation();
            if (this.vibrateOn)
                this.scheduleVibration();
            if (IS_PHONE_APP)
                this.sendDataToAndroid("scheduleBar");
        },
        scheduleBar() {
            if (this.drumsEnabled) {
                this.scheduleDrums();
            }
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
                this.nextNoteTime += this.secondsPerBeat;
            }
            const barFinishTimeInSeconds = (this.nextNoteTime - audioCtx.currentTime);
            // scheduling trigger for next bar 300ms before its time.
            const next_bar_to_be_scheduled_in_seconds = barFinishTimeInSeconds - 0.3;

            timerWorker.postMessage({ eventName: "scheduleBar", inSeconds: next_bar_to_be_scheduled_in_seconds });
            timerWorker.postMessage({ eventName: "barCompleted", inSeconds: barFinishTimeInSeconds });
        },
        scheduleDrums() {
            const sixteenthTime = 60.0 / (this.tempo * 4);
            const beatLength = 1 / 16 * sixteenthTime;
            const isLastBarBeforeTempoChange = this.currentBar == this.barsToPlay;

            for (const [instrument, config] of Object.entries(DRUMS_PATTERN[this.note][this.beats])) {
                let beat = null;

                if (this.currentBar == 1 && 'first_bar' in config) {
                    beat = config['first_bar'];
                } else if (isLastBarBeforeTempoChange && 'filler' in config) {
                    beat = config['filler'];
                } else if (config['inbetween'].length >= 1) {
                    if (config['inbetween'].length == 1)
                        beat = config['inbetween'][0];
                    else
                        beat = config['inbetween'][(this.currentBar - 1) % 2];  // alternate the inbetween beats
                } else {
                    continue;
                }
                for (const sixteenthNote of beat) {
                    const volume = (1.0 - Math.random() * 0.3) * config['volume'];
                    player.queueWaveTable(audioCtx, audioCtx.destination, { zones: [SOUNDS[instrument]] },
                        beatLength + this.nextNoteTime + (sixteenthNote - 1) * sixteenthTime, SOUNDS[instrument].originalPitch / 100, config['duration'], volume);
                }
            }
        },
        performKnobAnimation() {
            if (!this.shouldAccelerate)  // the animation is for tempo change indication. no need if not accelerating.
                return;
            if (!this.isPlaying)
                return;  // race condition issues.
            // UI animation for dial. Should play just for the 1st bar.
            const barTime = this.secondsPerBeat * this.beats;  // time it takes to complete a bar.
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
            this.barsToPlay = Math.round(duration / barTime);
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
        },
        scheduleVibration() {
            if (IS_PHONE_APP) // don't play if on phone app.
                return;
            let vibrationPatterns = [];
            for (let beat = 1; beat <= this.beats; beat++) {
                if (this.accentedBeats.includes(beat)) {
                    vibrationPatterns.push(25, 15, 25, Math.round((this.secondsPerBeat) * 1000) - 65);
                } else {
                    vibrationPatterns.push(65, Math.round((this.secondsPerBeat) * 1000) - 65);
                }
            }
            navigator.vibrate(vibrationPatterns);
        },
        sendDataToAndroid(eventName) {
            let data = {};
            if (eventName == "scheduleBar") {
                data = {
                    vibration: this.vibrateOn,
                    flash: this.flashOn,
                    waitTime: Array(this.beats).fill(Math.round((this.secondsPerBeat) * 1000)),
                    accentedBeats: this.accentedBeats
                }
            }
            try {
                Lightation.postMessage(JSON.stringify({ eventName: eventName, data: data }));
            } catch { }
        },
        barCompleted() {
            this.currentBar += 1;
            this.scheduledBeats.splice(0, 4); // remove the played beats after a bar is over.
            const isLastBarBeforeTempoChange = this.currentBar == this.barsToPlay + 1;
            if (isLastBarBeforeTempoChange) {
                let updatedTempo = this.isReversing ? this.tempo - this.jumpBpm : this.tempo + this.jumpBpm;
                if (updatedTempo > this.endTempo || updatedTempo < this.startTempo) {
                    if (updatedTempo < this.startTempo) {
                        updatedTempo = this.tempo + this.jumpBpm;  // back to increaseing
                        this.isReversing = false;
                    } else if (this.reverseEnabled) {
                        this.isReversing = true;
                        updatedTempo = this.tempo - this.jumpBpm;
                    } else {
                        updatedTempo = this.startTempo;
                    }
                }
                this.tempo = updatedTempo;
                this.lastTempoChangeTime = audioCtx.currentTime;
                this.currentBar = 1;  // also reset bar back to 1.
            }
        },
        uiVariablesUpdate() {
            this.tempoUI = this.tempo;
            this.currentBarUI = this.currentBar;
        }
    },
    mounted() {
        timerWorker.onmessage = (e) => {
            switch (e.data) {
                case "scheduleBar":
                    this.barCompleted();
                    this.scheduleBar();
                    break;
                case "barCompleted":
                    this.uiVariablesUpdate();
                    if (this.vibrateOn)
                        this.scheduleVibration();
                    const isFirstBar = this.currentBar == 1;
                    if (isFirstBar) {
                        this.performKnobAnimation();
                    }
                    if (IS_PHONE_APP)
                        this.sendDataToAndroid("scheduleBar");
                    break;
            }
        }
        $(".dial").knob({
            width: Math.min(320, document.getElementById("playButtons").offsetWidth - 30),
            height: Math.min(320, document.getElementById("playButtons").offsetWidth - 30),
            thickness: '0.10',
            fgColor: '#ffeb3a',
            readOnly: true,
            bgColor: '#2295f1'
        });
        loadOtherSounds();  // once vue is loaded. download other sounds.
    },
    computed: {
        secondsPerBeat: function () {
            const note_multiplier = this.note / 4;  // will give 2 for 8th note. ex: 1 quarter note = 2 8th note.
            const secondsPerBeat = 60.0 / (this.tempo * note_multiplier);
            return secondsPerBeat;
        },
        areDrumsAvailable: function() {
            const isAvailable = this.note in DRUMS_PATTERN && this.beats in DRUMS_PATTERN[this.note];
            if (!isAvailable)
                this.drumsEnabled = false;
            return isAvailable;
        }
    },
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

Vue.createApp(vueApp).mount('#vue-app');