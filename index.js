var pingModule = require('ping');
var express = require('express');
var cron = require('node-cron');
var path = require('path');
var fs = require('fs');
var Push = require('pushover-notifications');
var Webhook = require('discord-webhook-node').Webhook;

var db = require('./db.js');
var config = require('./config.js');

var app = express();
var hook = new Webhook(config.notifications.discord);

function round(int) {
	return int;
	//return Math.round(int * 1000) / 1000; // Rounds to 3 decimal places
}

if (config.customLogic.auth) {
	if (fs.existsSync(path.join(__dirname, config.customLogic.auth))) {
		require(`./${config.customLogic.auth}`)(app);
	} else {
		console.error(`Custom logic file for auth does not exist at ${path.join(__dirname, config.customLogic.auth)}`);
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
}

// Ping

function ping(monitor, host, cb) {
	pingModule.promise.probe(host, { attempts: 5, min_reply: 5 }).then(function(data) {
		console.log(data);

		if (!data.alive) {
			db.insertPingResults(null, null, null, monitor);
			if (config.monitors[monitor].up) {
				notify(monitor, 'down');
			}

			config.monitors[monitor].up = false;
			return cb(`Unable to ping ${host}`, null);
		}

		if (!config.monitors[monitor].up) {
			notify(monitor, 'up');
		}
		config.monitors[monitor].up = true;

		db.insertPingResults(round(data.avg), round(data.max), round(data.min), monitor);
		return cb(null, `Monitor: ${monitor} | Minimum: ${data.min} | Maximum: ${data.max} | Average: ${data.avg}`);
	});
}

for (var monitor in config.monitors) {
	// https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
	let mon = monitor;
	console.log(monitor);
	config.monitors[mon].up = true;
	cron.schedule(config.monitors[mon].cron, function() {
		console.log(mon);
		ping(mon, config.monitors[mon].ip, function(err, data) {
			if (err) {
				return console.log(err);
			}
			console.log(data);
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

	res.render('ping', { id: req.params.monitor, name: config.monitors[req.params.monitor].name });
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