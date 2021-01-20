const pingModule = require('ping');
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const Push = require('pushover-notifications');
const Webhook = require('discord-webhook-node').Webhook;
const Slimbot = require('slimbot');
const { EventEmitter } = require('events');

var db = require('./db.js');
var config = require('./config.js');

var slimbot;

if (config.notifications.telegram.chatId && config.notifications.telegram.token) {
	slimbot = new Slimbot(config.notifications.telegram.token);
	slimbot.startPolling();
}

var app = express();
var hook = new Webhook(config.notifications.discord);

function round(int) {
	return Math.round(int * 1000) / 1000; // Rounds to 3 decimal places
}

if (config.customLogic.auth) {
	if (fs.existsSync(path.join(__dirname, config.customLogic.auth))) {
		require(`./${config.customLogic.auth}`)(app);
	} else {
		console.error(`Custom logic file for auth does not exist at ${path.join(__dirname, config.customLogic.auth)}`);
	}
}

var notificationEmitter;
var notificationEmitterConfig;

if (config.customLogic.notifications) {
	if (fs.existsSync(path.join(__dirname, config.customLogic.notifications))) {
		notificationEmitter = new EventEmitter();
		var notificationLogic = require(`./${config.customLogic.notifications}`);

		if (!(typeof notificationLogic.notifications === 'function' && typeof notificationLogic.notificationsConfig === 'object' && Array.isArray(notificationLogic.notificationsConfig.subscribedEvents))) {
			console.error(`
Error in custom logic file for notifications. \`notifications\` must be a function. \`notificationsConfig\` must be an object containing the \`subscribedEvents\` array

You currently have:
\`notifications\`: ${typeof notificationLogic.notifications} (${typeof notificationLogic.notifications === 'function' ? 'correct' : 'incorrect'})
\`notificationsConfig\`: ${typeof notificationLogic.notificationsConfig} (${typeof notificationLogic.notificationsConfig === 'object' ? 'correct' : 'incorrect'})
\`notificationsConfig.subscribedEvents\` ${Array.isArray(notificationLogic.notificationsConfig.subscribedEvents) ? 'array' : typeof notificationLogic.notificationsConfig.subscribedEvents} (${Array.isArray(notificationLogic.notificationsConfig.subscribedEvents) ? 'correct' : 'incorrect'})

Custom logic for notifications has been disabled.
			`);
			return config.customLogic.notifications = null;
		}

		notificationLogic.notifications(notificationEmitter);
		notificationEmitterConfig = notificationLogic.notificationsConfig;
	} else {
		console.error(`Custom logic file for notifications does not exist at ${path.join(__dirname, config.customLogic.notifications)}`);
	}
}

function notify(monitor, event) {
	if (config.notifications.pushover.user && config.notifications.pushover.token && config.monitors[monitor].notify.includes('pushover')) {
		var p = new Push({
			user: config.notifications.pushover.user,
			token: config.notifications.pushover.token
		});

		var msg = {
			message: `New event from ServerMon: ${monitor} is ${event}`,
			priority: config.notifications.pushover.priority || 0
		};

		p.send(msg, function(err, result) {
			if (err) {
				throw err;
			}

			console.log(result);
		});
	}

	if (config.notifications.discord && config.monitors[monitor].notify.includes('discord')) {
		hook.send(`New event from ServerMon: ${monitor} is ${event}`);
	}

	if (config.notifications.telegram.chatId && config.notifications.telegram.token && config.monitors[monitor].notify.includes('telegram')) {
		slimbot.sendMessage(config.notifications.telegram.chatId, `New event from ServerMon: ${monitor} is ${event}`);
	}
}

function emitSubscribedEvents(monitor, data, eventName) {
	if (!config.customLogic.notifications) {
		return;
	}

	if (!notificationEmitterConfig.subscribedEvents.includes(eventName)) {
		return;
	}

	if (!config.monitors[monitor].notify.includes('custom')) {
		return;
	}

	notificationEmitter.emit(eventName, data);
}

// Ping

function ping(monitor, host, cb) {
	pingModule.promise.probe(host, { attempts: 5, min_reply: 5 }).then(function(data) {
		if (!data.alive) {
			db.insertPingResults(null, null, null, monitor);
			if (config.monitors[monitor].up) {
				notify(monitor, 'down');
				var emitData = {
					monitor,
					status: 'down'
				};
				emitSubscribedEvents(monitor, emitData, 'down');
			}

			config.monitors[monitor].up = false;
			return cb(`Unable to ping ${host}`, null);
		}

		if (!config.monitors[monitor].up) {
			notify(monitor, 'up');
			// eslint-disable-next-line no-redeclare
			var emitData = {
				monitor,
				status: 'up'
			};
			emitSubscribedEvents(monitor, emitData, 'up');
		}
		config.monitors[monitor].up = true;

		db.insertPingResults(data.avg, data.max, data.min, monitor);
		// eslint-disable-next-line no-redeclare
		var emitData = {
			monitor,
			min: data.min,
			avg: data.avg,
			max: data.max
		};
		emitSubscribedEvents(monitor, emitData, 'ping');

		if (config.monitors[monitor].notifyOnAboveAveragePercent && config.monitors[monitor].alertAbovePercent) {
			db.getPingResults(1, monitor, function(err, dbData) {
				if (err) {
					return console.error(err);
				}

				var total = 0;
				var dataPoints = 0;

				for (var i = 0; i < dbData.length; i++) {
					if (!isNaN(dbData[i].average)) {
						total += dbData[i].average;
						dataPoints++;
					}
				}

				var average = round(total / dataPoints);
				var alertAbovePercent = config.monitors[monitor].alertAbovePercent;
				var alertAbove = round(average * (1 + (alertAbovePercent / 100)));

				if (data.avg > alertAbove) {
					var emitData = {
						monitor,
						timeAverage: average,
						average: data.avg
					};

					emitSubscribedEvents(monitor, emitData, 'aboveAverage');
					notify(monitor, `${alertAbovePercent}% above average. 24 hour average: ${average}. Ping: ${data.avg}`);
				}
			});
		}

		return cb(null, `Monitor: ${monitor} | Minimum: ${data.min} | Maximum: ${data.max} | Average: ${data.avg}`);
	});
}

for (var monitor in config.monitors) {
	// https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
	let mon = monitor;
	console.log(`Configuring cronjob for: ${monitor}`);
	config.monitors[mon].up = true;
	cron.schedule(config.monitors[mon].cron, function() {
		console.log(`Pinging: ${mon}`);
		// eslint-disable-next-line no-unused-vars
		ping(mon, config.monitors[mon].ip, function(err, data) {
			if (err) {
				return console.log(err);
			}
			//console.log(data);
		});
	});
}

// Server

app.set('view engine', 'ejs');

app.get('/', function(req, res) {
	res.redirect('/monitors');
});

app.get('/ping/:monitor', function(req, res) {
	if (!Object.prototype.hasOwnProperty.call(config.monitors, req.params.monitor)) {
		return res.end('Invalid monitor');
	}

	res.render('ping', { id: req.params.monitor, name: config.monitors[req.params.monitor].name, alertAbovePercent: config.monitors[req.params.monitor].alertAbovePercent || null });
});

app.get('/monitors', function(req, res) {
	res.render('monitors', { monitors: config.monitors, customLogin: config.customLogic.auth ? true : false });
});

app.get('/api/ping/:monitor', function(req, res) {
	if (!Object.prototype.hasOwnProperty.call(config.monitors, req.params.monitor)) {
		return res.end('Invalid monitor');
	}

	var d = 1;
	var h = 0;
	if (req.query.d && req.query.d <= 30) d = req.query.d;
	if (req.query.h && req.query.h <= 24) h = req.query.h;
	if (h) d = h / 24;

	db.getPingResults(d, req.params.monitor, function(err, data) {
		if (err) {
			res.end(`Error querying database: ${err}`);
			throw new Error(err);
		}

		res.json({ data: data });
	});
});

app.listen(18514, function() {
	console.log('Listening on port 18514');
});