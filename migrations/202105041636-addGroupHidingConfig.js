var fs = require('fs');

function runMigration(configFile, cb) {
	var config = require(configFile); // Load the data from the config file

	if (!Object.prototype.hasOwnProperty.call(config.additional, 'enableGroupHiding')) {
		config.additional.enableGroupHiding = true;
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