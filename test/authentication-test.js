/*global describe, it, before, after */

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

server.use(authorify.authentication);

var ok = function(req, res, next){
  res.send({ success: true, session: req.session });
};

describe('Authorify manager', function() {
  before(function() {
    server.get('/handshake', ok);
    server.get('/auth', ok);
    server.get('/logout', ok);
    server.get('/test', ok);

    server.listen(3000);
  });
  after(function() {
    server.close();
  });
  describe('Server configuration', function() {
    it('should have RSA key pairs', function(done) {
      authorify.config.key.should.equal(fs.readFileSync(path.join(certPath,'/serverCert.key'), 'utf8'));
      authorify.config.cert.should.equal(fs.readFileSync(path.join(certPath,'/serverCert.cer'), 'utf8'));
      done();
    });
    it('should have CA certificate', function(done) {
      authorify.config.ca.should.equal(fs.readFileSync(path.join(certPath,'/serverCA.cer'), 'utf8'));
      done();
    });
  });

  describe('Client configuration', function() {
    it('should have RSA key pairs', function(done) {
      client.config.key.should.equal(fs.readFileSync(path.join(certPath,'/clientCert.key'), 'utf8'));
      client.config.cert.should.equal(fs.readFileSync(path.join(certPath,'/clientCert.cer'), 'utf8'));
      done();
    });
    it('should have CA certificate', function(done) {
      client.config.ca.should.equal(fs.readFileSync(path.join(certPath,'/serverCA.cer'), 'utf8'));
      done();
    });
  });

  var resTokenHandshake,
      resTokenAuthInit,
      resSidHandshake,
      resSidAuthInit;

  describe('Client authentication and authorization with username and password', function() {
    it('should perform a handshake request', function(done) {
      client.handshake(function(err, res) {
        var s = res.body.session;
        var p = res.parsedHeader;
        res.ok.should.true;
        res.parsedHeader.should.exist;

        s.sid.should.equal(p.payload.sid);
        s.cert.should.equal(client.config.cert);
        p.payload.mode.should.equal('handshake');
        p.payload.cert.should.equal(authorify.config.cert);
        p.content.date.should.exist;
        p.content.token.exist;
        p.signature.exist;

        resSidHandshake = s.sid;
        resTokenHandshake = p.content.token;

        done();
      });
    });
    it('should perform an authentication request', function(done) {
      client.authenticate('username', 'password', function(err, res) {
        var s = res.body.session;
        var p = res.parsedHeader;
        res.ok.should.true;
        res.parsedHeader.should.exist;

        s.sid.should.not.equal(resSidHandshake);
        s.sid.should.equal(p.payload.sid);
        s.cert.should.equal(client.config.cert);
        s.username.should.equal('username');

        p.payload.mode.should.equal('auth-init');
        p.payload.secret.should.exist;
        p.content.date.should.exist;
        p.content.token.should.exist;
        p.content.id.should.equal(id);
        p.content.app.should.equal(app);
        p.content.token.exist;
        p.signature.exist;

        resSidAuthInit = s.sid;
        resTokenAuthInit = p.content.token;

        done();
      });
    });
    it('should perform an authorization request', function(done) {
      client.authorize({
        path: '/test',
        callback: function(err, res) {
          var s = res.body.session;
          var p = res.parsedHeader;
          res.ok.should.true;
          res.parsedHeader.should.exist;

          s.sid.should.equal(resSidAuthInit);
          s.sid.should.equal(p.payload.sid);
          s.cert.should.equal(client.config.cert);
          s.token.should.equal(resTokenAuthInit);

          p.payload.mode.should.equal('auth');
          p.payload.secret.should.exist;
          p.content.date.should.exist;
          p.content.token.should.equal(resTokenAuthInit);
          p.content.token.exist;
          p.signature.exist;

          done();
        }
      });
    });
    it('should logout', function(done) {
      client.logout(function(err, res) {
        should.not.exist(err);
        res.body.success.should.true;
        done();
      });
    });
    it('should perform a request without authorization header for a free path', function(done) {
      client.get('/test')
        .pass()
        .end(function(err, res) {
          should.not.exist(err);
          res.body.success.true;
          done();
        });
    });
  });
});