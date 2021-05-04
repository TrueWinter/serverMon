# ServerMon

A simple uptime monitoring solution.

# Configuration

Add your servers into the monitors object in config file with the following information:

```json
"internal-id": {
	"name": "Name shown on status page",
	"type": "If set to local, this instance will do the monitoring. If set to remote, this instance will periodically fetch the monitor from the remote API",
	"ip": "IP address (or domain name) of server. Only for local monitor types",
	"api": "The URL that contains the remote monitor data. In a normal installation, this will be something like http://REMOTE_SERVERMON:18514/api/ping/MONITOR_NAME",
	"cron": "The monitor schedule in cron format",
	"alertAbovePercent": "An average ping this percentage above the time period average will be highlighed in red on the ping chart and may trigger a notification (see next option)",
	"notifyOnAboveAveragePercent": "If set to true, a notification will be sent if the average ping is `alertAbovePercent`% above the 24 hour average. Only for local monitor types",
	"notify": "This is an array stating where notifications for this monitor are sent. Only for loca monitor types"
}
```

Example:

```json
"uk-prod-lb-01": {
	"name": "UK Loadbalancer 01",
	"type": "local",
	"ip": "198.51.100.21",
	"cron": "*/2 * * * *",
	"alertAbovePercent": 50,
	"notifyOnAboveAveragePercent": ["discord"],
	"notify": ["discord", "pushover"]
}
```

More examples are available in `config.json.example`.

Configuring the notifications object in the config file will allow you to receive uptime/downtime notifications. Pushover, Discord webhooks and Telegram are supported. It can also be configured to alert you if the average is a certain percentage above the 24 hour average. Notifications through custom logic is also now supported, see `custom-logic-examples/notifications.js` and the [notifications section below](#notifications) for more information.

A random delay (between 20ms and 500ms, by default) is added before each check. This is to prevent issues that may occur when a large number of monitors are configured, and can be modified if needed.

Groups can also be configured. A monitor can only be in one group. Currently this only applies to the web UI, and is a beta feature.

It is recommended to use a proxy such as Nginx to proxy port 80 and 443 to ServerMon's port (18514).

# Advanced Configuration (Optional)

## Auth

Some people may want to restrict access to ServerMon. To allow (almost) full control over this, authentication is handled through custom logic.

Enter a file name relative to the current directory in the config file at `customLogic.auth`. This file should handle sessions and login forms (or redirecting to an SSO provider, if one is used) and all other aspects of the login system.

This file will be required in the main file passing the Express app as a parameter. Your file should look something like the following:

```js
function auth(app) {
	app.use('/monitors', authMiddleware);
	app.use('/ping/*', authMiddleware);
	app.use('/api/*', authMiddleware);

	function authMiddleware(req res, next) {
		// An Express middleware to handle logins
	}

	app.get('/login', function(req, res) {
		// Show login form
	});

	// Include all code needed for a login system here
}

module.exports = app;
```

There are a few restrictions:

- You do not have access to the ServerMon database
- The logout route must be `/logout` as this is what will be used for the logout link on the monitors page

An example has been included in `custom-logic-examples/simple-auth.js`.

## Notifications

Due to the limited number of currently supported notification platforms, custom notification logic has been added. This allows you to send notification to any platform or send ping data to an internal service.

The following events are implemented:

- down: emitted when a monitor is detected as being down
- up: emitted when a previously down monitor is back up
- ping: emitted when a monitor is successfully pinged
- aboveAverage: emitted when the average ping is a percentage above the 24 hour average (see [#Configuration](#configuration))
- groupStatusChange: emitted when the status of a group changes

To use custom notification logic enter a file name relative to the current directory in the config file at `customLogic.notifications`. Then add 'custom' to each monitor that you'd like to use custom notifications for. For groups, the `groupStatusChange` event is automatically enabled.

For more information, see the example at `custom-logic-examples/notifications.js`.

# Usage

After configuring and starting ServerMon, the data can be viewed as graphs in a browser.

- `{servermon_domain}/monitors` will show a list of monitors configured (visiting `${servermon_domain}/` will redirect here)
- `{servermon_domain}/ping/{internal_id}` will show a graph of data collected for that monitor

By default, data from the past 24 hours is shown. The amount of data shown can be changed using the form above the graph. Please note that the chart points are hidden if three or more days of data is shown.

Group monitors can also be hidden by default in the monitors page by enabling the `config.additional.enableGroupHiding` setting. Doing so will require you to click on a chevron to see monitor statuses for groups. This is useful when a large number of monitors are configured.

An API is also available:

- `{servermon_domain}/api/ping/{internal-id}` will return the ping data for the past 24 hours as well as the current status
- `{servermon_domain}/api/group/{internal-id}` will return the current status of the group

For the ping API route, you can modify the amount of data returned using the following query parameters (cannot be used together):

- `?h=x` will return the past `x` hours of data, up to 24 hours
- `?d=x` will return the past `x` days of data, up to 30 days

# Updating

Updating ServerMon is easy, just run `git pull` to get the latest code, `npm install` to install any new dependencies, and then `node migrations.js` to update the config file with any new development changes.

# License

MIT License

Copyright (c) 2020 Nicholis du Toit

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.