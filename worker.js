let timerID = null;

onmessage = (e) => {
	if (e.data.eventName == "scheduleBar") {
		next_bar_to_be_scheduled_in_seconds = e.data.inSeconds;
		next_bar_to_be_scheduled_in_ms = next_bar_to_be_scheduled_in_seconds * 1000;
		timerID = setTimeout(() => { postMessage("tick") }, next_bar_to_be_scheduled_in_ms);
	} else if (e.data.eventName == "stop") {
		clearInterval(timerID);
		timerID = null;
	}
};