# ServerMon

A simple uptime monitoring solution.

# Configuration

Add your servers into the monitors object in config file with the following information:

```js
'internal-id': {
	name: 'Name shown on status page',
	ip: 'IP address (or domain name) of server',
	cron: 'The monitor schedule in cron format',
	notify: 'This is an array stating where notifications for this monitor are sent'
}
```

Example:

```js
'uk-prod-lb-01': {
	name: 'UK Loadbalancer 01',
	ip: '198.51.100.21',
	cron: '*/2 * * * *',
	notify: ['discord', 'pushover']
}
```

Configuring the notifications object in the config file will allow you to receive uptime/downtime notifications. Pushover and Discord webhooks are supported.

It is recommended to use a proxy such as Nginx to proxy port 80 and 443 to ServerMon's port (18514).

# Advanced Configuration (Optional)

Some people may want to restrict access to ServerMon. To allow (almost) full control over this, authentication is handled through custom logic.

Enter a file name relative to the current directory in the config file at `customLogic.auth`. This file should handle sessions and login forms (or redirecting to an SSO provider, if one is used) and all other aspects of the login system.

This file will be required in the main file passing the Express app as a parameter. Your file should look something like the following:

```js
function auth(app) {
	app.use('/monitors', authMiddleware);
	app.use('/ping/*', authMiddleware);

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

# Usage

After configuring and starting ServerMon, the data can be viewed as graphs in a browser.

- `{servermon_domain}/monitors` will show a list of monitors configured (visiting `${servermon_domain}/` will redirect here)
- `{servermon_domain}/ping/{internal_id}` will show a graph of data collected for that monitor

By default, data from the past 24 hours is shown. The amount of data shown can be customised using query parameters:

- Hours: `?h=2` will show 2 hours of data. You can change this to get up to 24 hours of data
- Days: `?d=5` will show 5 days of data. You can change this to get up to 30 days of data

Currently, these cannot both be used at the same time.


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