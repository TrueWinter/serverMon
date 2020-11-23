# ServerMon

A simple uptime monitoring solution.

# Configuration

Add your servers into the monitors object in config file with the following information:

```js
'internal-id': {
	name: 'Name shown on status page',
	ip: 'IP address (or domain name) of server',
	port: 'An open port on the server',
	cron: 'The monitor schedule in cron format'
}
```

Example:

```js
'uk-prod-lb-01': {
	name: 'UK Loadbalancer 01',
	ip: '198.51.100.21',
	port: '443',
	cron: '*/2 * * * *'
}
```

It is recommended to use a proxy such as Nginx to proxy port 80 and 443 to ServerMon's port (18514).

# Usage

After configuring and starting ServerMon, the data can be viewed as graphs in a browser.

- `{servermon_domain}/monitors` will show a list of monitors configured
- `{servermon_domain}/ping/{internal_id}` will show a graph of data collected for that monitor

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