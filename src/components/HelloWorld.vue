<template>
  <div class="hello">
    <h1>{{ msg }}</h1>
    <span>Time Signature:</span>
    <select v-model="time_sig">
      <option>2/4</option>
      <option>3/4</option>
      <option>4/4</option>
    </select>
    <br>
    <span>Start BPM: </span><input v-model.number="start_bpm" type="number">
    <p><button v-on:click="startMetronome">Start</button></p>
    <br>
    <br>
    <span>State: </span> Time: {{ time_sig}} Start BPM: {{start_bpm}}
    <audio src="media/Low_Woodblock.9c4ccf45.wav" crossorigin="anonymous"></audio>
  </div>
</template>

<script>
export default {
  name: "HelloWorld",
  props: {
    msg: String,
    time_sig: String,
    start_bpm: Number
  },
  methods: {
    startMetronome: function () {
        //const self = this;
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        const audioCtx = new AudioContext();
        const audioElement = document.querySelector('audio');
        const source = audioCtx.createMediaElementSource(audioElement);
        source.connect(audioCtx.destination);
        /*
        const request = new XMLHttpRequest();  // Consider audio tag
        let source = audioCtx.createBufferSource();
        request.onload = function() {
            audioCtx.decodeAudioData(request.response, function(buffer) {
                source.buffer = buffer;
                source.connect(audioCtx.destination);
              },
              function(e){"Error with decoding audio data" + e.error});

        }
        console.log(require('@/assets/Low_Woodblock.wav'));
        request.open('GET', require('@/assets/Low_Woodblock.wav'), true);
        request.responseType = 'arraybuffer';
        request.send();*/
/*
        function playMetronome() {
            let nextStart = audioCtx.currentTime;

            function schedule() {
                nextStart += 60 / self.start_bpm;
                source.start(nextStart);
            }

            schedule();
        }

        playMetronome();*/
        let bpm = 60;
        let nextNoteTime = audioCtx.currentTime;
        while (nextNoteTime < audioCtx.currentTime + 0.1) {
            audioElement.play();
            nextNoteTime += bpm/60;

            console.log(nextNoteTime);
            console.log(audioCtx.currentTime);
        }
        console.log(audioCtx.currentTime);
    }
  }
};
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
h3 {
  margin: 40px 0 0;
}
ul {
  list-style-type: none;
  padding: 0;
}
li {
  display: inline-block;
  margin: 0 10px;
}
a {
  color: #42b983;
}
</style>
