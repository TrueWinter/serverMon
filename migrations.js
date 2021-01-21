var migrate = require('migrate-json').migrate;
var path = require('path');

// These must be absolute paths
var mConfig = {
	directory: path.join(__dirname, 'migrations'), // The directory that your migrations are in
	configFile: path.join(__dirname, 'config.json'), // The config file that should be updated
	dataFile: path.join(__dirname, 'migrations', 'migrationData.json'), // A file used by Migrate-JSON to store migration data (will be created automatically if it doesn't exist)
	env: 'prod' // Only the migrations matching this environment will run
};

migrate(mConfig, null, function(err, data) { // the callback will be called when all required migrations are complete
	if (err) {
		throw err;
	}

	if (data.length === 0) { // data is an array of the completed migrations
		console.log('No migrations required');
	} else {
		console.log('Migrations run');
	}
});