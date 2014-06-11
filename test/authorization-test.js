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
          callback(1, ['admin']);
        } else if (username === 'user' && password === 'pass') {
            callback(2, ['user']);
        } else {
          callback(new Error('user and/or password wrong'));
        }
      }
    }),
    client = require('authorify-client')({
      logger: logger,
      host: 'localhost',
      debug: false,
      key: fs.readFileSync(path.join(certPath,'/clientCert.key'), 'utf8'),
      cert: fs.readFileSync(path.join(certPath,'/clientCert.cer'), 'utf8'),
      ca: fs.readFileSync(path.join(certPath,'/serverCA.cer'), 'utf8')
    }),
    uuid   = require('node-uuid'),
    id = uuid.v4(),
    app = uuid.v4();

client.setConfig({
  port: 3000,
  id: id,
  app: app
});

var server = restify.createServer();
server.use(restify.queryParser({ mapParams: false }));
server.use(restify.bodyParser());
server.use(authorify.authentication);

var ok = function(req, res, next){
  res.send({ success: true, session: req.session, content: req.body });
};

describe('Security Manager', function() {
  before(function() {
    var sec = authorify.authorization;

    server.get('/handshake', ok);
    server.get('/auth', ok);
    server.get('/logout', function(req, res, next) {res.send('logged out');});
    // to test isLoggedIn
    server.get('/secure/loggedin1', sec.isLoggedIn(), ok);
    server.get('/secure/loggedin2', sec.isLoggedIn('opt1 == 1', { forbiddenOnFail: true }), ok);
    server.post('/secure/loggedin2', sec.isLoggedIn('opt1 == 1'), ok);
    server.get('/secure/loggedin3', sec.isLoggedIn('opt1 == 1', { nextOnError: true }), ok);
    server.get('/secure/loggedin4', sec.isLoggedIn('opt1 == 1', { forbiddenOnFail: true }), ok);
    server.post('/secure/loggedin5', sec.isLoggedIn('opt1 == 1'), ok);
    // to test isSelf
    server.get('/secure1/user/:user', sec.isSelf(), ok);
    server.get('/secure2/user/:user', sec.isLoggedIn('opt1 == 1'), ok);
    // to test isInRole
    server.get('/secure/roletest1', sec.isInRole('admin'), ok);
    server.get('/secure/roletest2', sec.isInRole(['user', 'guest']), ok);
    // to test isSelfOrInRole
    server.get('/secure/selfrole/:user/somepath', sec.isSelfOrInRole(['admin', 'user']), ok);

    server.listen(3000);
  });
  after(function() {
    server.close();
  });
  it('Security Manager tests', function(done) {
    client.handshake(function(err, res) {
      should.not.exist(err);
      client.authenticate('username', 'password', function(err, res) {
        should.not.exist(err);
        done();
      });
    });
  });
  describe('isLoggedIn tests', function() {
    it('should fail to request path without authorization header for a protected path', function(done) {
      client.get('/secure/loggedin1')
        .pass()
        .end(function(err, res) {
          res.status.should.equal(401);
          res.body.message.should.equal('not logged in');
          done();
        });
    });
    it('should is logged in', function(done) {
      client.get('/secure/loggedin1')
        .end(function(err, res) {
          res.status.should.equal(200);
          should.not.exist(err);
          done();
        });
    });
    it('should throw error if missing param', function(done) {
      client.get('/secure/loggedin2')
        .end(function(err, res) {
          res.status.should.equal(403);
          console.log(res.body.message);
          done();
        });
    });
    it('should is logged in with param with expected value (GET)', function(done) {
      client.get('/secure/loggedin2')
        .query({ opt1: 1 })
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
    it('should is logged in with param with expected value (POST)', function(done) {
      client.post('/secure/loggedin2')
        .send({ opt1: 1 })
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
    it('should decrypt secure body', function(done) {
      client.post('/secure/loggedin5')
        .send({ opt1: 1 })
        .send({ message: 'secret message' })
        .end(function(err, res) {
          should.not.exist(err);
          res.body.content.opt1.should.equal(1);
          res.body.content.message.should.equal('secret message');
          done();
        });
    });
    it('should skip to next on error', function(done) {
      client.get('/secure/loggedin3')
        .end(function(err, res) {
          res.status.should.equal(403);
          res.body.statusCode.should.equal(403);
          res.body.message.should.equal('opt1 parameter not found');
          done();
        });
    });
    it('should forbidden on fail', function(done) {
      client.get('/secure/loggedin4')
        .query({ opt1: 2 })
        .end(function(err, res) {
          should.not.exist(res.body.success);
          res.body.message.should.equal('failed conditions');
          res.status.should.equal(403);
          done();
        });
    });
  });
  describe('isSelf tests', function() {
    it('should pass if user is self', function(done) {
      client.get('/secure1/user/1')
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
    it("shouldn't pass if user is not self", function(done) {
      client.get('/secure1/user/2')
        .end(function(err, res) {
          should.not.exist(res.body.success);
          res.body.message.should.equal('user not allowed');
          res.status.should.equal(403);
          done();
        });
    });
    it('should pass if user is self and param is correct', function(done) {
      client.get('/secure2/user/1')
        .query({ opt1: 1 })
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
  });
  describe('isRoles tests', function() {
    it('should pass if user is in required role', function(done) {
      client.get('/secure/roletest1')
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
    it("shouldn't pass if user is not in required role", function(done) {
      client.get('/logout')
        .end(function(err, res) {
          should.not.exist(err);
          client.handshake(function(err, res) {
            should.not.exist(err);
            client.authenticate('user', 'pass', function(err, res) {
              should.not.exist(err);
              client.get('/secure/roletest1')
                .end(function(err, res) {
                  res.body.message.should.equal('role not allowed');
                  res.status.should.equal(403);
                  done();
                });
            });
          });
        });
    });
    it('should pass if user is in required role (2nd)', function(done) {
      client.get('/secure/roletest2')
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
  });
  describe('isSelfOrInRole tests', function() {
    it('should pass if user is self', function(done) {
      client.get('/secure/selfrole/2/somepath')
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
    it('should pass if user is in role', function(done) {
      client.get('/secure/selfrole/1/somepath')
        .end(function(err, res) {
          should.not.exist(err);
          done();
        });
    });
  });
});
