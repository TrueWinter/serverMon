/*
	This is an example of how custom notification logic can be used.
	As you can write any code you want in this file, you can send notifications
	to services that are not yet supported by ServerMon's built-in notifications.

	To use this logic code, set `customLogic.notifications` in the config file to 'custom-logic-examples/notifications.js'
	and add 'custom' to the notify array on each monitor where you'd like to use the custom logic.
*/

var notificationsConfig = {
	/*
		You will only receive data for the following events. Possible values are:
		ping: emitted whenever a monitor is successfully pinged
		down: emitted when a monitor is down
		up: emitted when a monitor previously down monitor is back up
		aboveAverage: emitted when the average ping is above the 24 hour average
		groupStatusChange: emitted when the status of a group changes
	*/
	subscribedEvents: ['down', 'up', 'ping', 'aboveAverage', 'groupStatusChange']
};

function notifications(event) {
	event.on('ping', function(data) {
		console.log('PING');

		/*
			Data contains the following:
			monitor: the internal ID as set in the config
			min: minimum ping
			avg: average ping
			max: maximum ping
		*/
		console.log(data);
	});

	event.on('down', function(data) {
		console.log('DOWN');

		/*
			Data contains the following:
			monitor: the internal ID as set in the config
			status: will be 'down'
		*/
		console.log(data);
	});

	event.on('up', function(data) {
		console.log('UP');

		/*
			Data contains the following:
			monitor: the internal ID as set in the config
			status: will be 'up'
		*/
		console.log(data);
	});

	event.on('aboveAverage', function(data) {
		console.log('ABOVE AVERAGE');

		/*
			Data contains the following:
			monitor: the internal ID as set in the config
			timeAverage: the 24 hour average for this monitor
			average: the average for this ping
		*/
		console.log(data);
	});

	event.on('groupStatusChange', function(data) {
		console.log('GROUP STATUS CHANGE');

		/*
			Data contains the following:
			group: the internal ID as set in the config
			monitors: an array of monitors
			status: the group status
		*/

		console.log(data);
	});
}

// You must export both of these, and the names must be `notificationsConfig` and `notifications`
module.exports.notificationsConfig = notificationsConfig;
module.exports.notifications = notifications;