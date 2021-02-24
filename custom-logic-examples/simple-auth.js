/*
	This is a simple example to enable auth on ServerMon.
	As the custom logic allows you to write any code you want,
	you can implement more advanced auth systems or use an SSO provider.

	To use this logic code, set `customLogic.auth` in the config file to 'custom-logic-examples/simple-auth.js'.
*/

var bodyParser = require('body-parser');
var session = require('express-session');

function auth(app) {

	app.use(bodyParser.urlencoded({ extended: false }));
	app.use(session({
		secret: 'some long secret',
		resave: false,
		saveUninitialized: false
	}));

	function authMiddleware(req, res, next) {

		if (req.session && req.session.loggedIn) {
			return next();
		}

		if (req.originalUrl.startsWith('/api/')) {
			if (req.query.apiKey === 'testapikey') {
				return next();
			} else {
				return res.status(403).json({ success: false, message: 'Invalid API key provided' });
			}
		}

		res.redirect('/login');
	}

	app.use('/monitors', authMiddleware);
	app.use('/ping/*', authMiddleware);
	app.use('/api/*', authMiddleware);

	app.get('/login', function(req, res) {
		if (req.session && req.session.loggedIn) {
			return res.redirect('/monitors');
		}

		res.set('Content-Type', 'text/html');
		res.end(`
				<form method="POST" action="/auth">
						<input type="text" name="username" placeholder="Username" required />
						<br />
						<input type="password" name="password" placeholder="Password" required />
						<br />
						<button type="submit">Log In</button>
				</form>
		`);
	});

	var users = {
		admin: 'password'
	};

	app.post('/auth', function(req, res) {
		if (!(req.body.username && req.body.password)) {
			return res.redirect('/login');
		}

		if (users[req.body.username] && users[req.body.username] === req.body.password) {
			req.session.loggedIn = true;
			res.redirect('/monitors');
		} else {
			res.redirect('/login');
		}
	});

	app.get('/logout', function(req, res) {
		if (!(req.session && req.session.loggedIn)) {
			return res.redirect('/login');
		}

		req.session.destroy(function(err) {
			if (err) {
				throw new Error(err);
			}
			res.redirect(`/login`);
		});
	});
}

module.exports = auth;