/**
 * The authentication middleware.
 *
 * @class node_modules.authorify.authentication
 *
 * @author Marcello Gesmundo
 *
 * ## Example
 *
 *     // dependencies
 *      var fs = require('fs'),
 *          path = require('path'),
 *          restify = require('restify');
 *
 *      // create the server
 *      server = restify.createServer();
 *
 *      // configure authorify middleware
 *      var authorify = require('authorify')({
 *          debug: true,
 *          key : fs.readFileSync(path.join(__dirname,'cert/serverCert.key'), 'utf8'),
 *          cert: fs.readFileSync(path.join(__dirname,'cert/serverCert.cer'), 'utf8'),
 *          ca  :  fs.readFileSync(path.join(__dirname,'cert/serverCA.cer'), 'utf8'),
 *          // define your login function!
 *          login: function(id, app, username, password, callback) {
 *            if (username === 'username' && password === 'password') {
 *              callback(1, ['admin']);
 *            } else if (username === 'user' && password === 'pass') {
 *              callback(2, ['user']);
 *            } else {
 *              callback(new Error('wrong credentials'));
 *              // or simply
 *              // callback('wrong credentials');
 *            }
 *          }
 *        });
 *
 *      // add all middleares
 *      server.use(restify.queryParser({ mapParams: false }));
 *      server.use(restify.bodyParser());
 *      server.use(authorify.authentication);
 *
 *      // define default handler
 *      var ok = function(req, res, next){
 *        // define your response
 *        res.send({ success: true, message: 'ok' });
 *      };
 *      server.get('/handshake', ok);
 *      server.get('/auth', ok);
 *      server.get('/logout', function(req, res, next) {
 *        res.send({ success: true, message: 'logged out' })
 *      });
 *
 *      // start the server
 *      server.listen(3000);
 *
 * # License
 *
 * Copyright (c) 2012-2014 Yoovant by Marcello Gesmundo. All rights reserved.
 *
 * This program is released under a GNU Affero General Public License version 3 or above, which in summary means:
 * 
 * - You __can use__ this program for __no cost__.
 * - You __can use__ this program for __both personal and commercial reasons__.
 * - You __do not have to share your own program's code__ which uses this program.
 * - You __have to share modifications__ (e.g bug-fixes) you've made to this program.
 *
 * For more convoluted language, see the LICENSE file.
 *
 */
module.exports = function(app) {
  'use strict';

  var _              = app._,
      Handshake      = app.client.class.Handshake,
      Authentication = app.client.class.Authentication,
      Authorization  = app.client.class.Authorization,
      Crypter        = app.client.Crypter,
      async          = app.async,
      config         = app.config,
      log            = app.logger,
      debug          = app.config.debug,
      sessionStore   = app.sessionStore,
      errors         = app.errors;

  function logResponse(err, res) {
    if (err || (res && !res.ok)) {
      log.warn('%s read plaintext body due an error', app.name);
    } else if (res && !_.isEmpty(res.body)) {
      if  (res.body[my.config.encryptedBodyName]) {
        log.info('%s read encrypted body', app.name);
      } else {
        log.info('%s read plaintext body', app.name);
      }
    }
  }

  var my = {};

  /**
   * The middleware
   *
   * @private
   * @ignore
   * @param {IncomingMessage} req Request
   * @param {ServerResponse} res Response
   * @param {Function} next The callback
   * @return {next(err)} The returned callback
   * @param {Error} next.err The error instance if occurred
   */
  my.authentication = function(req, res, next) {
    var logMessage = '%s auth request over %s for url %s with method %s',
        transport = (req.isWebsocket ? 'websocket' : 'http'),
        err;
    if (req.url === config.handshakePath || req.url === config.authPath || req.url === config.logoutPath) {
      if (!req.headers[config.authHeader.toLowerCase()]) {
        logMessage += ' without Authorization header';
      }
      log.info(logMessage, app.name, transport, req.url, req.method);
    } else {
      log.info(logMessage, app.name, transport, req.url, req.method);
    }

    // if the Authorization header is missing try to route next and verify if it's a free route path
    if (!req.headers[config.authHeader.toLowerCase()]) {
      if (config.freeRoutes || req.url === config.logoutPath) {
        // the logout route is free it the header is missing
        req._noAuthHeader = true;
        err = new errors.InvalidHeaderError('missing header');
      } else {
        err = new errors.BadRequestError('missing header');
      }
      next(err);

      return;
    }

    var responseHeader;
    async.series([
      // process header
      function(callback) {
        app.client.processHeader(req, function(err) {
          if (err) {
            err = new errors.BadRequestError(err);
          }
          callback(err);
        });
      },
      // verify token integrity
      function(callback) {
        var headerTest,
            err;
        switch (req.parsedHeader.payload.mode) {
          case 'handshake':
            headerTest = new Handshake({
              date: req.parsedHeader.content.date,
              cert: req.session.cert
            });
            err = (headerTest.generateToken() === req.parsedHeader.content.token ? null : 'token error');
            if (err) {
              err = new errors.BadRequestError(err);
            }
            callback(err);
            break;
          case 'auth-init':
            headerTest = new Authentication({
              sid: req.parsedHeader.payload.sid,
              date: req.parsedHeader.content.date,
              id: req.parsedHeader.content.id,
              app: req.parsedHeader.content.app,
              username: req.parsedHeader.content.username,
              password: req.parsedHeader.content.password,
              cert: req.session.cert
            });
            err = (headerTest.generateToken() === req.parsedHeader.content.token ? null : 'token error');
            if (err) {
              err = new errors.BadRequestError(err);
            }
            callback(err);
            break;
          default :
            if (req.parsedHeader.content.token === req.session.token) {
              callback(null);
            } else {
              callback(new errors.BadRequestError('token error'));
            }
            break;
        }
      },
      // prepare response
      function(callback) {
        switch (req.parsedHeader.payload.mode) {
          case 'handshake':
            sessionStore.createSid(function(createErr, sid) {
              if (!createErr) {
                req.session.sid = sid;
                // set ttl
                sessionStore.config.ttl = config.sidTtl;
                sessionStore.save(sid, req.session, function(saveErr) {
                  if (!saveErr) {
                    responseHeader = new Handshake({
                      reply: true,
                      key: config.key,
                      cert: config.cert,
                      encoderCert: req.parsedHeader.payload.cert,
                      sid: sid
                    });
                    responseHeader.setToken(responseHeader.generateToken());
                    callback(null);
                  } else {
                    callback(new errors.InternalError('session error'));
                  }
                });
              } else {
                callback(new errors.InternalError('session error'));
              }
            });
            break;
          case 'auth-init':
            responseHeader = new Authentication({
              reply: true,
              key: config.key,
              cert: config.cert,
              encoderCert: req.session.cert,
              secret: app.client.generateSecret(),
              id: req.parsedHeader.content.id,
              app: req.parsedHeader.content.app,
              username: req.parsedHeader.content.username
            });
            var reqContent = req.parsedHeader.content;
            // authenticate the user
            config.login(reqContent.id, reqContent.app, reqContent.username, reqContent.password,
            function(err, userId, roles) {
              if (!roles) {
                roles = userId;
                userId = err;
                err = undefined;
              }
              if (err) {
                // destroy handshake session
                sessionStore.destroy(req.parsedHeader.payload.sid);
                if (err instanceof Error) {
                  err = err.message;
                } else if (!_.isString(err)) {
                  err = 'authentication error';
                }
                callback(new errors.UnauthorizedError(err));
              } else if (userId && roles && roles.length > 0) {
                // create new session
                sessionStore.createSid(function(createErr, sid) {
                  if (!createErr) {
                    responseHeader.setSid(sid);
                    responseHeader.setToken(responseHeader.generateToken());

                    req.session.sid = sid;
                    req.session.date = req.parsedHeader.content.date;
                    req.session.token = responseHeader.getToken();
                    req.session.id = req.parsedHeader.content.id;
                    req.session.app = req.parsedHeader.content.app;
                    req.session.username = req.parsedHeader.content.username;
                    req.session.userId = userId;
                    req.session.roles = roles;

                    // set ttl
                    sessionStore.config.ttl = config.tokenTtl;
                    sessionStore.config.persist = config.persist;
                    sessionStore.save(sid, req.session, function(saveErr) {
                      sessionStore.config.persist = false;
                      if (!saveErr) {
                        log.info('%s manager saved session', app.name);
                        log.debug(req.session);
                        callback(null);
                      } else {
                        callback(new errors.InternalError('session error'));
                      }
                    });
                  } else {
                    callback(new errors.InternalError('session error'));
                  }
                });
              } else {
                // destroy handshake session
                sessionStore.destroy(req.parsedHeader.payload.sid);
                callback(new errors.UnauthorizedError('authentication error'));
              }
            });
            break;
          default : // auth or auth-plain
            responseHeader = new Authorization({
              reply: true,
              mode: req.parsedHeader.payload.mode,
              key: config.key,
              cert: config.cert,
              encoderCert: req.session.cert,
              sid: req.session.sid,
              secret: app.client.generateSecret(),
              token: req.session.token
            });

            var requestCleanup = function(req, header, secret) {
              req.params = {};
              header.setSecret(secret);
            };

            // decrypt body
            if (req.body && req.parsedHeader.payload.mode === 'auth') {
              var decryptedBody = {},
                  _backupSecret = responseHeader.getSecret(),
                  secret = responseHeader.keychain.decryptRsa(req.parsedHeader.payload.secret);
              // set secret of the client
              responseHeader.setSecret(secret);
              try {
                decryptedBody = responseHeader.decryptContent(req.body[app.config.encryptedBodyName]);
                // verify the signature
                if (app.config.signBody) {
                  var signature = req.body[app.config.encryptedSignatureName];
                  if (!signature) {
                    throw new Error('missing signature');
                  }
                  var signVerifier = new Crypter({
                    cert: req.session.cert
                  });
                  if (!signVerifier.verifySignature(JSON.stringify(decryptedBody), signature)) {
                    throw new Error('forgery message');
                  }
                }
                req.body = decryptedBody;
                requestCleanup(req, responseHeader, _backupSecret);
                log.info('%s read encrypted body', app.name);
                callback(null);
              } catch (e) {
                requestCleanup(req, responseHeader, _backupSecret);
                callback(new errors.InternalError(e.message));
              }
            } else {
              if (req.body) {
                log.info('%s read plaintext body', app.name);
              }
              callback(null);
            }
            break;
        }
      },
      // send response
      function(callback) {
        if (req.url === config.logoutPath) {
          if (req.parsedHeader && req.parsedHeader.payload.sid) {
            sessionStore.destroy(req.parsedHeader.payload.sid);
          }
          callback(null);
        } else {
          if (responseHeader) {
            // pass responseHeader into request to handle it in other middlewares
            req.responseHeader = responseHeader;
            var encodedHeader = responseHeader.encode(true);
            res.setHeader(config.authHeader, encodedHeader);
            callback(null);
          } else {
            callback(new errors.InternalError('missing response header'));
          }
        }
      }
    ], next);
  };

  /**
   * Encrypt (if present and required) the body of the request
   *
   * @param {IncomingMessage} req Request
   * @param {Object} body The body of the request
   * @return {Object} The encrypted/plaintext body
   * @private
   * @ignore
   */
  my.setBody = function(req, body) {
    var _body,
        isEncrypted = false;
    if (body && req) {
      if (req._noAuthHeader || req.url === config.logoutPath) {
        _body = body;
        log.info('%s write plaintext body', app.name);
      } else if (req.parsedHeader && req.parsedHeader.payload) {
        switch (req.parsedHeader.payload.mode) {
          case 'auth':
            // encrypt body
            isEncrypted = true;
            if (req.responseHeader) {
              if (!_.isObject(body)) {
                throw new errors.InternalError('wrong body format').log();
              }
              _body = {};
              _body[app.config.encryptedBodyName] = req.responseHeader.cryptContent(body);
              // add the signature
              if (app.config.signBody) {
                _body[app.config.encryptedSignatureName] = req.responseHeader.generateSignature(body);
              }
            } else {
              throw new errors.InternalError('missing response header').log();
            }
            log.info('%s write encrypted body', app.name);
            break;
          default:
            _body = body;
            log.info('%s write plaintext body', app.name);
            break;
        }
      }
    }

    return _body;
  };

  /**
   * Decrypt the query string if present
   *
   * @param {IncomingMessage} req Request
   * @private
   * @ignore
   */
  my.decryptQuery = function(req) {
    if (config.encryptQuery) {
      var hasQuery  = !_.isEmpty(req.query || {});
      if (hasQuery) {
        var plain = req.parsedHeader && (req.parsedHeader.payload.mode === 'auth-plain');
        if (!(plain || req._noAuthHeader || (!config.encryptQuery))) {
          var header = req.responseHeader;
          var secret = header.keychain.decryptRsa(req.parsedHeader.payload.secret);
          if (hasQuery) {
            _.forEach(req.query, function(value, key) {
              req.query[key] = header.keychain.decryptAes(value, secret, 'url');
            });
          }
        }
      }
    }
  };

  /**
   * The authentication middleware.
   *
   * @property {function (req, res, next)} authentication
   * @param {IncomingMessage} req Request
   * @param {ServerResponse} res Response
   * @param {Function} next The callback
   * @param {Error} next.err The error instance if occurred
   * @ignore
   */
  app.authentication = function(req, res, next) {
    my.authentication(req, res, function(err) {
      if (err) {
        // delete session
        delete req.session;
        if (err instanceof errors.InvalidHeaderError) {
          // no error because trying free route
          next();
        } else {
          if (!(err instanceof errors.HttpError)) {
            err = new errors.HttpError({
              message: err.message
            });
          }
          res.send(err.statusCode, err.body);
        }
        log.error('%s %s', app.name, err);
      } else {
        // decrypt the query
        my.decryptQuery(req);
        // set send method with encryption
        res.sendPlain = res.send;
        res.send = function(code, body, headers) {
          var _code = 200,
              _body = body;
          if (code) {
            if (_.isObject(code)) {
              _body = my.setBody(req, code);
              if (code instanceof Error) {
                _code = code.statusCode || code.code || 500;
              }
            } else {
              _code = parseInt(code, 10);
              if (_.isNaN(_code)) {
                _code = 200;
                _body = my.setBody(req, code);
              } else if (_code === 200) {
                _body = my.setBody(req, body);
              }
            }
          } else {
            _body = my.setBody(req, body);
          }
          res.sendPlain(_code, _body, headers);
        };
        log.debug('%s call next middleware', app.name);
        next();
      }
    });
  };

  return app;
};