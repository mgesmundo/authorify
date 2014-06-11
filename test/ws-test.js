/*global describe, before, after, it */
var logger = console;
logger.debug = function(){};
logger.info = function(){};


var fs = require('fs'),
    path = require('path'),
    should = require('should'),
    restify = require('restify'),
    certPath = path.resolve(__dirname, '../lib/config/cert'),
    authorify = require('../index')({
     logger: logger,
     debug: false,
     key: fs.readFileSync(path.join(certPath,'/serverCert.key'), 'utf8'),
     cert: fs.readFileSync(path.join(certPath,'/serverCert.cer'), 'utf8'),
     ca: fs.readFileSync(path.join(certPath,'/serverCA.cer'), 'utf8'),
     login: function(id, app, username, password, callback) {
       if (username === 'username' && password === 'password') {
         callback(1, ['admins']);
       } else {
         callback(new Error('user and/or password wrong'));
       }
     }
   }),
   client = require('authorify-client')({
     logger: logger,
     requestTimeout: 500,
     host: 'localhost',
     debug: false,
     key: fs.readFileSync(path.join(certPath,'/clientCert.key'), 'utf8'),
     cert: fs.readFileSync(path.join(certPath,'/clientCert.cer'), 'utf8'),
     ca: fs.readFileSync(path.join(certPath,'/serverCA.cer'), 'utf8')
   }),
   uuid = require('node-uuid'),
   id = uuid.v4(),
   app = uuid.v4();

client.setConfig({
 port: 3000,
 id: id,
 app: app
});

// add plugin to the client
client.load('authorify-websocket', 'ws', {
  transports: ['ws', 'http'],
  requestTimeout: 200
});

var server = restify.createServer();

// add plugin to the server
authorify.load('authorify-websocket', 'ws', {
 transports: ['ws', 'http'],
 requestTimeout: 200
});
var ws = authorify.plugin.ws;
ws.createServer(server);
var router = ws.router;

server.use(restify.queryParser({ mapParams: false }));
server.use(restify.bodyParser());
server.use(authorify.authentication);

var ok = function(req, res, next){
  res.send({ success: true, session: req.session, content: req.body });
};

describe('Websockets', function() {
 before(function() {
   router.get('/handshake', ok);
   router.get('/auth', ok);
   router.get('/logout', ok);
   router.post('/test', ok);

   server.listen(3000);
 });
 after(function() {
   if (server.running) {
     server.close();
   }
 });
 it('should send a non encrypted body without authorization header', function(done) {
   var message = { field1: 'value1', field2: 'value2' };
   client.post('/test')
     .pass()
     .send(message)
     .end(function(err, res) {
       should.not.exist(err);
       res.status.should.equal(200);
       res.body.content.field1.should.equal('value1');
       res.body.content.field2.should.equal('value2');
       done();
     });
 });
 it("shouldn't send an encrypted body without logged in", function(done) {
   client.logout(function(err, res) {
     var message = { field1: 'value1', field2: 'value2' };
     client.post('/test')
       .send(message)
       .end(function(err, res) {
         err.should.equal('session not found');
         done();
       });
   });
 });
 it('should login with username and password', function(done) {
   client.login('username', 'password', function(err, res) {
     should.not.exist(err);
     res.status.should.equal(200);
     res.body.success.should.true;
     res.body.session.userId.should.equal(1);
     done();
   });
 });
 it('should send a non encrypted body with authorization header', function(done) {
   var message = { field1: 'value1', field2: 'value2' };
   client.post('/test', true)
     .send(message)
     .end(function(err, res) {
       should.not.exist(err);
       res.status.should.equal(200);
       res.body.success.should.true;
       res.body.content.field1.should.equal('value1');
       res.body.content.field2.should.equal('value2');
       done();
     });
 });
 it('should send an encrypted body', function(done) {
   var message = { field1: 'value1', field2: 'value2' };
   client.post('/test')
     .send(message)
     .end(function(err, res) {
       should.not.exist(err);
       res.body.success.should.true;
       res.body.content.field1.should.equal('value1');
       res.body.content.field2.should.equal('value2');
       done();
     });
 });
 it('should logout', function(done) {
   client.logout(function(err, res) {
       should.not.exist(err);
       res.body.success.should.true;
       done();
     });
 });
 it('should complete a request over http if the websocket server is not available', function(done) {
   // close the client
   ws.wsclient.removeClient('localhost:3000');
   // shutdown the server
   ws.destroyServer({ close: false });
   setTimeout(function() {
     // made new request
     var message = { field1: 'value1', field2: 'value2' };
     client.post('/test')
       .pass()
       .send(message)
       .end(function(err, res) {
         should.not.exist(err);
         res.status.should.equal(200);
         res.body.content.field1.should.equal('value1');
         res.body.content.field2.should.equal('value2');
         done();
       });
   }, 50);
 });
});