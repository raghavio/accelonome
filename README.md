# Accelonome
A feature packed metronome app which accelerates the tempo at specified intervals.

is:
- lightweight
- mobile first
- disabled-friendly (has a vibration option)


has support for:
- different time signatures
- custom accented beats
- different tick sounds
- drum beats
- vibration pulse on mobile


## How does it work?
[Chris Wilson](https://github.com/cwilso) has written a great [blog](https://www.html5rocks.com/en/tutorials/audio/scheduling/) on timing for web audio apps. Based on that I'm doing things that works for my usecase. 

Since the main intention of the app is to practice, I'm not allowing tempo change while the metronome is on. Because of this I can preschedule the sounds for one complete bar instead of doing it for each beat.

I have a web worker whose job is to trigger the early scheduling of the bar using Web Audio APIs and to trigger when a bar is completed (for UI refresh). I'm using `setTimeout` for both these tasks. Using web workers because `setTimeout` in main thread isn't always accurate.
