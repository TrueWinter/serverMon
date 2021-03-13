/*
	This is an example of how custom notification logic can be used.
	As you can write any code you want in this file, you can send notifications
	to services that are not yet supported by ServerMon's built-in notifications.

	This specific logic file contains code to run a traceroute to a monitor and send
	the output of that to a Discord webhook whenever a monitor goes down.

	To use this logic code, set `customLogic.notifications` in the config file to 'custom-logic-examples/tracerouteOnDown.js'
	and add 'custom' to the notify array on each monitor where you'd like to use the custom logic.
*/

var child_process = require('child_process');
var config = require('../config.json');
const Webhook = require('discord-webhook-node').Webhook;
var hook = new Webhook(config.notifications.discord);

var notificationsConfig = {
	/*
		You will only receive data for the following events. Possible values are:
		ping: emitted whenever a monitor is successfully pinged
		down: emitted when a monitor is down
		up: emitted when a monitor previously down monitor is back up
		aboveAverage: emitted when the average ping is above the 24 hour average
	*/
	subscribedEvents: ['down']
};

function exec(command, cb) {
	return child_process.exec(command, { timeout: 60 * 1000 }, function(err, stdout, stderr) {
		if (err) {
			console.log(err.message);
			return cb({ success: false, message: `Error while running command: ${err.message}` });
		}
		if (stderr) {
			console.log(stderr.message);
			return cb({ success: false, message: `Error while running command: ${stderr.message}` });
		}

		cb({ success: true, message: stdout });
	});
}

function notifications(event) {
	event.on('down', function(data) {
		console.log('DOWN');

		/*
			Data contains the following:
			monitor: the internal ID as set in the config
			status: will be 'down'
		*/
		console.log(data);

		var runForMonitors = ['uk-prod-lb-01', 'uk-prod-lb-02'];

		if (runForMonitors.includes(data.monitor)) {
			var host = config.monitors[data.monitor].ip;

			exec(`traceroute -w 2 -q 1 ${host}`, function(output) {
				hook.send(`${data.monitor} is down. Traceroute:\n\`\`\`${output.message}\`\`\``);
			});
		}
	});
}

// You must export both of these, and the names must be `notificationsConfig` and `notifications`
module.exports.notificationsConfig = notificationsConfig;
module.exports.notifications = notifications;