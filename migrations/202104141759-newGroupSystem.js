var fs = require('fs');

function runMigration(configFile, cb) {
	var config = require(configFile); // Load the data from the config file

	for (var group in config.groups) {
		config.groups[group]._members = Object.assign({}, config.groups[group].members);
		config.groups[group].members = Object.keys(config.groups[group]._members);
		delete config.groups[group]._members;
	}

	// Save data
	// eslint-disable-next-line quotes
	fs.writeFileSync(configFile, JSON.stringify(config, null, "\t"));

	// Call callback function to allow for migrations to complete
	cb(null, true);
}

var migrationConfig = {
	env: 'prod',
	run: true
};

module.exports.run = runMigration;
module.exports.config = migrationConfig;