var tcpp = require('tcp-ping'); // tcp-ping as it's the only library i found that returns decimals as part of the ping data
var express = require('express');
var morgan = require('morgan');
var cron = require('node-cron');

var app = express();

var db = require('./db.js');
var config = require('./config.js');

// Ping

function ping(monitor, host, port, cb) {
	tcpp.ping({ address: host, port: port, attempts: 5 }, function(err, data) {
		if (err) {
			throw new Error(`Unable to ping ${monitor}: ${err}`)
		}
		console.log(data);

		if (!data.avg) {
			db.insertPingResults(0, 0, 0, monitor);
			return cb(`Unable to ping ${host}`, null);
		}

		db.insertPingResults(data.avg, data.max, data.min, monitor);
		return cb(null, `Monitor: ${monitor} | Minimum: ${data.min} | Maximum: ${data.max} | Average: ${data.avg}`);
	});
}

for (var monitor in config.monitors) {
	// https://dzone.com/articles/why-does-javascript-loop-only-use-last-value
	let mon = monitor;
	console.log(monitor);
	cron.schedule(config.monitors[mon].cron, function() {
		console.log(mon);
		ping(mon, config.monitors[mon].ip, config.monitors[mon].port, function(err, data) {
			if (err) {
				return console.log(err);
			}
			console.log(data);
		});
	});
}

// Server

app.set('view engine', 'ejs');
app.use(morgan('combined'));
app.use('/assets', express.static('assets'));

app.get('/ping/:monitor', function(req, res) {
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

		res.render('ping', { name: config.monitors[req.params.monitor].name, data: data });
	});
});

app.get('/monitors', function(req, res) {
	res.render('monitors', { monitors: config.monitors });
});

app.listen(18514, function() {
	console.log('Listening on port 18514');
});