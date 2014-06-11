var logger = console;
logger.debug = function(){};

var fs = require('fs'),
    path = require('path'),
    should = require('should'),
    restify = require('restify'),
    certPath = path.resolve(__dirname, '../../lib/config/cert'),
    authorify = require('../../index')({
      logger: logger,
      debug: false,
      key: fs.readFileSync(path.join(certPath,'/serverCert.key'), 'utf8'),
      cert: fs.readFileSync(path.join(certPath,'/serverCert.cer'), 'utf8'),
      ca: fs.readFileSync(path.join(certPath,'/serverCA.cer'), 'utf8'),
      login: function(id, app, username, password, callback) {
        if (username === 'username' && password === 'password') {
          callback(1, ['admin']);
        } else if (username === 'user' && password === 'pass') {
          callback(2, ['user']);
        } else {
          callback();
        }
      }
    });

var server = restify.createServer();

// add plugin
authorify.load('authorify-websocket', 'ws', {
 transports: ['ws', 'http'],
 requestTimeout: 200
});

var ws = authorify.plugin.ws;
ws.createServer(server);
var router = ws.router;

server.use(restify.queryParser({ mapParams: false }));
server.use(restify.bodyParser());
// server.use(restify.CORS());
server.use(authorify.authentication);

var sec = authorify.authorization;

var ok = function(req, res, next){
  var body = { success: true, session: req.session, content: req.body };
  res.send(body);
};

router.get('/handshake', ok);
router.get('/auth', ok);
router.get('/test', ok);
router.post('/test', ok);
router.get('/free', function(req, res, next) {
  res.send(200,'ok');
});

router.get('/logout', function(req, res, next) {res.send({ success: true, content: 'logged out'});});
// router.get('/logout', ok);
// to test isLoggedIn
router.get('/secure/loggedin1', sec.isLoggedIn(), ok);
router.get('/secure/loggedin2', sec.isLoggedIn('opt1 == 1', { forbiddenOnFail: true }), ok);
router.post('/secure/loggedin2', sec.isLoggedIn('opt1 == 1'), ok);
router.get('/secure/loggedin3', sec.isLoggedIn('opt1 == 1', { nextOnError: true }), ok);
router.get('/secure/loggedin4', sec.isLoggedIn('opt1 == 1', { forbiddenOnFail: true }), ok);
router.post('/secure/loggedin5', sec.isLoggedIn('opt1 == 1'), ok);
// to test isSelf
router.get('/secure1/user/:user', sec.isSelf(), ok);
router.get('/secure2/user/:user', sec.isLoggedIn('opt1 == 1'), ok);
// to test isInRole
router.get('/secure/roletest1',sec.isInRole('admin'), ok);
router.get('/secure/roletest2',sec.isInRole(['user', 'guest']), ok);
// to test isSelfOrInRole
router.get('/secure/selfrole/:user/somepath', sec.isSelfOrInRole(['admin', 'user']), ok);

server.listen(3000);
