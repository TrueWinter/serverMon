var fs = require('fs');

function runMigration(configFile, cb) {
	var config = require(configFile); // Load the data from the config file

	var monitors = config.monitors;

	for (var monitor in monitors) {
		if (monitors[monitor].notifyOnAboveAveragePercent === true) {
			monitors[monitor].notifyOnAboveAveragePercent = monitors[monitor].notify;
		} else {
			monitors[monitor].notifyOnAboveAveragePercent = [];
		}
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