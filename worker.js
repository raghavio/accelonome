let timerIDByEventName = {};

onmessage = (e) => {
	const eventName = e.data.eventName;
	switch (eventName) {
		case "scheduleBar":
		case "barCompleted":
			timerID = setTimeout(() => { postMessage(eventName) }, e.data.inSeconds * 1000);
			timerIDByEventName[eventName] = timerID;
			break;
		case "clearTimeout":
			Object.values(timerIDByEventName).forEach(clearInterval);
			timerIDByEventName = {};
			break;
	}
};