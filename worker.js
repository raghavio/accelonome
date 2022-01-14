let timerID = null;

onmessage = (e) => {
	if (e.data[0] == "scheduleBar") {
		next_bar_to_be_scheduled_in_seconds = e.data[1];
		next_bar_to_be_scheduled_in_ms = next_bar_to_be_scheduled_in_seconds * 1000;
		timerID = setTimeout(() => { postMessage("tick") }, next_bar_to_be_scheduled_in_ms);
	} else if (e.data == "stop") {
		clearInterval(timerID);
		timerID = null;
	}
};