var path = require('path');
var knex = require('knex')({
	client: 'sqlite3',
	connection: {
		filename: path.join(__dirname, './data.db')
	},
	useNullAsDefault: true
});
var moment = require('moment');

knex.schema.hasTable('ping').then(function(exists) {
	if (!exists) {
		knex.schema.createTable('ping', table => {
			table.increments('id');
			table.string('monitorName');
			table.integer('timestamp');
			table.decimal('average');
			table.decimal('max');
			table.decimal('min');
		}).then(function() {
			console.log('Ping table created');
		}).catch(function(e) {
			throw new Error(`Unable to create ping table: ${e}`);
		});
	}
});

function insertPingResults(a, m, l, n) {
	knex('ping').insert({
		monitorName: n,
		timestamp: moment().unix(),
		average: a,
		max: m,
		min: l
	}).then(function() {
		console.log('Data inserted');
	}).catch(function(e) {
		throw new Error(`Unable to insert data: ${e}`);
	});
}

function getPingResults(d, m, cb) {
	var day = 60 * 60 * 24; // 86400
	var r = moment().unix() - (d * day);

	knex('ping').select('monitorName', 'timestamp', 'average', 'max', 'min').where('monitorName', '=', m).andWhere('timestamp', '>', r).then(function(data) {
		return cb(null, data);
	}).catch(function(e) {
		return cb(e, null);
	});
}

module.exports = {
	insertPingResults,
	getPingResults
};
