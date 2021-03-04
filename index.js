const pingModule = require('ping');
const express = require('express');
const cron = require('node-cron');
const path = require('path');
const fs = require('fs');
const Push = require('pushover-notifications');
const Webhook = require('discord-webhook-node').Webhook;
const Slimbot = require('slimbot');
const { EventEmitter } = require('events');
const migrateJSON = require('migrate-json');
var randNum = require('random-number-between');
var moment = require('moment');

var mConfig = {
	dataFile: path.join(__dirname, 'migrations', 'migrationData.json'), // A file used by Migrate-JSON to store migration data (will be created automatically if it doesn't exist)
};

if (!fs.existsSync(mConfig.dataFile)) {
	var formattedDate = migrateJSON.formatDate(new Date());
	migrateJSON.setTimestamp(mConfig, formattedDate);
}

var db = require('./db.js');
var config = require('./config.json');
const axios = require('axios');

var slimbot;

if (config.notifications.telegram.chatId && config.notifications.telegram.token) {
	slimbot = new Slimbot(config.notifications.telegram.token);
	slimbot.startPolling();
}

var app = express();
var hook;

if (config.notifications.discord) {
	hook = new Webhook(config.notifications.discord);
}

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

function notify(monitor, event, customMessage) {
	var monitorConfig = config.monitors[monitor];

	if (config.notifications.pushover.user && config.notifications.pushover.token &&
		((monitorConfig.notify.includes('pushover') && event !== 'aboveAverage') || (monitorConfig.notifyOnAboveAveragePercent.includes('pushover') && event === 'aboveAverage'))) {
		var p = new Push({
			user: config.notifications.pushover.user,
			token: config.notifications.pushover.token
		});

		var msg = {
			message: customMessage ? `New event from ServerMon: ${monitor} is ${customMessage}` : `New event from ServerMon: ${monitor} is ${event}`,
			priority: config.notifications.pushover.priority || 0
		};

		p.send(msg, function(err, result) {
			if (err) {
				throw err;
			}

			console.log(result);
		});
	}

	if (config.notifications.discord &&
		((monitorConfig.notify.includes('discord') && event !== 'aboveAverage') || (monitorConfig.notifyOnAboveAveragePercent.includes('discord') && event === 'aboveAverage'))) {
		hook.send(customMessage ? `New event from ServerMon: ${monitor} is ${customMessage}` : `New event from ServerMon: ${monitor} is ${event}`);
	}

	if (config.notifications.telegram.chatId && config.notifications.telegram.token &&
		((monitorConfig.notify.includes('telegram') && event !== 'aboveAverage') || (monitorConfig.notifyOnAboveAveragePercent.includes('telegram') && event === 'aboveAverage'))) {
		slimbot.sendMessage(config.notifications.telegram.chatId, customMessage ? `New event from ServerMon: ${monitor} is ${customMessage}` : `New event from ServerMon: ${monitor} is ${event}`);
	}
}

function emitSubscribedEvents(monitor, data, eventName) {
	var monitorConfig = config.monitors[monitor];

	if (!config.customLogic.notifications) {
		return;
	}

	if (!notificationEmitterConfig.subscribedEvents.includes(eventName)) {
		return;
	}

	if ((monitorConfig.notify.includes('custom') && eventName !== 'aboveAverage') || (monitorConfig.notifyOnAboveAveragePercent.includes('custom') && eventName === 'aboveAverage')) {
		notificationEmitter.emit(eventName, data);
	}
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

			if (config.monitors[monitor].group) {
				let group = config.groups[config.monitors[monitor].group];
				if (group.status !== 'outage') {
					if (group.members[monitor].statusIfDown === 'outage') {
						group.status = 'outage';
					} else if (group.members[monitor].statusIfDown === 'partial outage') {
						group.status = 'partial outage';
					}
				}
			}

			return cb(`Unable to ping ${host}`, null);
		}

		if (!config.monitors[monitor].up && config.monitors[monitor].up !== undefined) {
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
					notify(monitor, 'aboveAverage', `${alertAbovePercent}% above average. 24 hour average: ${average}. Ping: ${data.avg}`);
				}
			});
		}

		if (config.monitors[monitor].group) {
			let group = config.groups[config.monitors[monitor].group];
			let allowUpStatus = true;
			let status = 'up';
			if (group.status !== 'up') {
				for (var member in group.members) {
					if (group.members[member].statusIfDown === 'outage') {
						if (!config.monitors[member].up) {
							status = 'outage';
							allowUpStatus = false;
							if (config.monitors[member].up === undefined) {
								status = 'unknown';
							}
						}
					}
					if (allowUpStatus) {
						if (group.members[member].statusIfDown === 'partial outage') {
							if (!config.monitors[member].up) {
								status = 'partial outage';
								allowUpStatus = false;
								if (config.monitors[member].up === undefined) {
									status = 'unknown';
								}
							}
						}
					}
				}

				group.status = status;
			}
		}

		return cb(null, `Monitor: ${monitor} | Minimum: ${data.min} | Maximum: ${data.max} | Average: ${data.avg}`);
	});
}

for (var group in config.groups) {
	config.groups[group].status = undefined;
	let groupMembers = config.groups[group].members;

	for (var member in groupMembers) {
		if (!Object.prototype.hasOwnProperty.call(config.monitors, member)) {
			throw new Error(`Group member ${member} does not exist`);
		}
		config.monitors[member].group = group;
	}
}

for (var monitor in config.monitors) {
	// https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
	let mon = monitor;
	if (!config.monitors[mon].name) {
		throw new Error('All monitors must have a name');
	}
	if (!config.monitors[mon].alertAbovePercent) {
		throw new Error('All monitors must have an alertAbovePercent');
	}
	if (!config.monitors[mon].cron) {
		throw new Error('All monitors must have a cron');
	}
	if (config.monitors[mon].type === 'local') {
		if (!config.monitors[mon].ip) {
			throw new Error('Local monitors must have an IP address');
		}
		if (!config.monitors[mon].notifyOnAboveAveragePercent) {
			throw new Error('Local monitors must have a notifyOnAboveAveragePercent array, even if empty');
		}
		if (!config.monitors[mon].notify) {
			throw new Error('Local monitors must have a notify array, even if empty');
		}

		console.log(`Configuring cronjob for: ${monitor}`);
		config.monitors[mon].up = undefined;
		cron.schedule(config.monitors[mon].cron, function() {
			console.log(`Pinging: ${mon}`);
			// eslint-disable-next-line no-unused-vars
			setTimeout(function() {
				//console.log(Date.now());
				// eslint-disable-next-line no-unused-vars
				ping(mon, config.monitors[mon].ip, function(err, data) {
					if (err) {
						return console.log(err);
					}
					//console.log(data);
				});
			}, randNum(config.additional.randomDelayMin, config.additional.randomDelayMax, 1)[0]);
		});
	} else {
		if (!config.monitors[mon].api) {
			throw new Error('Remote monitors must have an API');
		}

		config.monitors[mon].up = undefined;
		config.monitors[mon]._remoteData = {
			data: []
		};

		console.log(`Configuring cronjob for: ${monitor}`);

		cron.schedule(config.monitors[mon].cron, function() {
			console.log(`Fetching data for: ${mon}`);
			// eslint-disable-next-line no-unused-vars
			setTimeout(function() {
				axios.get(config.monitors[mon].api).then(function(data) {
					config.monitors[mon]._remoteData = data.data;
					config.monitors[mon].up = data.data.up;

					if (!config.monitors[mon].up) {
						if (config.monitors[mon].group) {
							let group = config.groups[config.monitors[mon].group];
							if (group.status !== 'outage') {
								if (group.members[mon].statusIfDown === 'outage') {
									group.status = 'outage';
								} else if (group.members[mon].statusIfDown === 'partial outage') {
									group.status = 'partial outage';
								}
							}
						}
					} else if (config.monitors[mon].group) {
						let group = config.groups[config.monitors[mon].group];
						let allowUpStatus = true;
						let status = 'up';
						if (group.status !== 'up') {
							for (var member in group.members) {
								if (group.members[member].statusIfDown === 'outage') {
									if (!config.monitors[member].up) {
										status = 'outage';
										allowUpStatus = false;
										if (config.monitors[member].up === undefined) {
											status = 'unknown';
										}
									}
								}
								if (allowUpStatus) {
									if (group.members[member].statusIfDown === 'partial outage') {
										if (!config.monitors[member].up) {
											status = 'partial outage';
											allowUpStatus = false;
											if (config.monitors[member].up === undefined) {
												status = 'unknown';
											}
										}
									}
								}
							}

							group.status = status;
						}
					}
				}).catch(function(err) {
					config.monitors[mon].up = undefined;
					if (config.monitors[mon].group) {
						let group = config.groups[config.monitors[mon].group];
						if (group.status !== 'outage') {
							if (group.members[mon].statusIfDown === 'outage') {
								group.status = 'outage';
							} else if (group.members[mon].statusIfDown === 'partial outage') {
								group.status = 'partial outage';
							}
						}
					}
					console.error(err);
				});
			}, 5000 + randNum(config.additional.randomDelayMin, config.additional.randomDelayMax, 1)[0]);
		});

		setTimeout(function() {
			console.log(`Doing initial data fetch for: ${mon}`);
			axios.get(config.monitors[mon].api).then(function(data) {
				config.monitors[mon]._remoteData = data.data;
				config.monitors[mon].up = data.data.up;

				if (!config.monitors[mon].up) {
					if (config.monitors[mon].group) {
						let group = config.groups[config.monitors[mon].group];
						if (group.status !== 'outage') {
							if (group.members[mon].statusIfDown === 'outage') {
								group.status = 'outage';
							} else if (group.members[mon].statusIfDown === 'partial outage') {
								group.status = 'partial outage';
							}
						}
					}
				} else if (config.monitors[mon].group) {
					let group = config.groups[config.monitors[mon].group];
					let allowUpStatus = true;
					let status = 'up';
					if (group.status !== 'up') {
						for (var member in group.members) {
							if (group.members[member].statusIfDown === 'outage') {
								if (!config.monitors[member].up) {
									status = 'outage';
									allowUpStatus = false;
									if (config.monitors[member].up === undefined) {
										status = 'unknown';
									}
								}
							}
							if (allowUpStatus) {
								if (group.members[member].statusIfDown === 'partial outage') {
									if (!config.monitors[member].up) {
										status = 'partial outage';
										allowUpStatus = false;
										if (config.monitors[member].up === undefined) {
											status = 'unknown';
										}
									}
								}
							}
						}

						group.status = status;
					}
				}
			}).catch(function(err) {
				if (config.monitors[mon].group) {
					let group = config.groups[config.monitors[mon].group];
					if (group.status !== 'outage') {
						if (group.members[mon].statusIfDown === 'outage') {
							group.status = 'outage';
						} else if (group.members[mon].statusIfDown === 'partial outage') {
							group.status = 'partial outage';
						}
					}
				}
				console.error(err);
			});
		}, 5000 + randNum(config.additional.randomDelayMin, config.additional.randomDelayMax, 1)[0]);
	}
}

// Server

app.set('view engine', 'ejs');
app.use('/assets', express.static(path.join(__dirname, 'assets')));

app.get('/', function(req, res) {
	res.redirect('/monitors');
});

app.get('/ping/:monitor', function(req, res) {
	if (!Object.prototype.hasOwnProperty.call(config.monitors, req.params.monitor)) {
		return res.end('Invalid monitor');
	}

	res.render('ping', { id: req.params.monitor, name: config.monitors[req.params.monitor].name, alertAbovePercent: config.monitors[req.params.monitor].alertAbovePercent || null, local: config.monitors[req.params.monitor].type === 'local', useLocalAssets: config.additional.useLocalAssets });
});

app.get('/monitors', function(req, res) {
	res.render('monitors', { monitors: config.monitors, customLogin: config.customLogic.auth ? true : false, groups: config.groups });
});

app.get('/api/ping/:monitor', function(req, res) {
	if (!Object.prototype.hasOwnProperty.call(config.monitors, req.params.monitor)) {
		return res.status(400).json({ success: false, message: 'Invalid monitor' });
	}

	var d = 1;
	var h = 0;
	if (req.query.d && req.query.d <= 30) d = req.query.d;
	if (req.query.h && req.query.h <= 24) h = req.query.h;
	if (h) d = h / 24;

	if (config.monitors[req.params.monitor].type === 'local') {
		db.getPingResults(d, req.params.monitor, function(err, data) {
			if (err) {
				res.end(`Error querying database: ${err}`);
				throw new Error(err);
			}

			res.json({ data: data, up: config.monitors[req.params.monitor].up });
		});
	} else {
		var day = 60 * 60 * 24; // 86400
		var r = moment().unix() - (d * day);

		if (d <= 1) {
			var returnedData = Object.assign({}, config.monitors[req.params.monitor]._remoteData);
			var filteredPingData = returnedData.data.filter(d => d.timestamp > r);
			returnedData.data = filteredPingData;

			res.json(returnedData);
		} else {
			var apiURL = new URL(config.monitors[req.params.monitor].api);
			apiURL.searchParams.append('d', d);

			console.log(`User requested more than a day of data for remote monitor. Sending request to ${apiURL.href}`);
			axios.get(apiURL.href).then(function(data) {
				res.json(data.data);
			});
		}
	}
});

app.get('/api/group/:group', function(req, res) {
	if (!Object.prototype.hasOwnProperty.call(config.groups, req.params.group)) {
		return res.status(400).json({ success: false, message: 'Invalid group' });
	}

	res.json({ name: config.groups[req.params.group].name, status: config.groups[req.params.group].status === undefined ? 'unknown' : config.groups[req.params.group].status });
});

app.listen(18514, function() {
	console.log('Listening on port 18514');
});