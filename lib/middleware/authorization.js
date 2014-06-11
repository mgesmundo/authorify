/**
 * The authorization middleware.
 *
 * @class node_modules.authorify.authorization
 *
 * @author Marcello Gesmundo
 *
 * ## Example
 *
 *      // dependencies
 *      var restify = require('restify');
 *          authorify = require('authorify')(){
 *            // add your options
 *          },
 *          sec = authorify.authorization;
 *
 *      // create the server
 *      server = restify.createServer();
 *
 *      // add all middlewares
 *      server.use(restify.queryParser({ mapParams: false }));
 *      server.use(restify.bodyParser());
 *      server.use(authorify.authentication);
 *
 *      // define default handler
 *      server.get('/secure/roletest', sec.isSelfOrInRole(['user', 'guest']), function(err, res) {
 *        console.log('ok');
 *      });
 *
 *      // add your routes
 *      // ...
 *
 *      // start the server
 *      server.listen(3000);
 *
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

  var _       = app._,
      errors  = app.errors,
      config  = app.config,
      parser  = app.mathParser,
      debug   = app.config.debug,
      log     = app.logger;

  var _isLoggedIn = function(req) {
    return (req.session && req.session.userId);
  };

  var _isSelf = function(req) {
    var result = false;
    if (_isLoggedIn(req) && req.session && req.session.userId) {
      var id    = req.session.userId.toString(),
          field = config.userIdFieldName;
      if (_.has(req.params || {}, field)) {
        result = (id === req.params[field]);
      } else if (_.has(req.query || {}, field)) {
        result = (id === req.query[field]);
      } else if (_.has(req.body || {}, field)) {
        result = (id === req.body[field]);
      }
    }
    return result;
  };

  var _isInRole = function(req, roles) {
    var result = false;
    if (_isLoggedIn(req)) {
      var userRoles = req.session.roles || [];
      roles = roles ? [].concat(roles) : [];
      result = ((_.intersection(userRoles, roles)).length > 0);
    }
    return result;
  };

  var checkConditions = function(req, conditions) {
    var result = 'ok',
        repeat = true;

    var whatchdog = setTimeout(function() {
      return 'evaluation conditions timeout error';
    }, 60000);

    if (conditions) {
      parser.clear();
      do {
        try {
          result = (parser.eval(conditions) ? 'ok' : 'ko');
          repeat = false;
        } catch (e) {
          var error = 'undefined symbol',
              message = e.message.toLowerCase().trim();
          if (message.startsWith(error)) {
            var symbol = message.slice(error.length, message.length).trim();
            if (symbol) {
              if (_.has(req.params || {}, symbol)) {
                parser.set(symbol, req.params[symbol]);
              } else if (_.has(req.query || {}, symbol)) {
                parser.set(symbol, req.query[symbol]);
              } else if (_.has(req.body || {}, symbol)) {
                parser.set(symbol, req.body[symbol]);
              } else {
                result = symbol + ' parameter not found';
                repeat = false;
              }
            }
          } else {
            result = message;
            repeat = false;
          }
        }
      } while (repeat);
    }
    clearTimeout(whatchdog);
    if (conditions) {
      if (result === 'ok') {
        log.debug('%s successful conditions %s', app.name, conditions);
      } else if (result === 'ko') {
        log.debug('%s failed conditions %s', app.name, conditions);
      } else {
        log.error('%s error evaluating conditions %s', app.name, conditions);
      }
    }
    return result;
  };

  var setOptions = function(opts) {
    opts = opts || {};
    opts.nextOnError     = opts.nextOnError     || false;
    opts.forbiddenOnFail = opts.forbiddenOnFail || false;
    return opts;
  };

  var logSuccess = function() {
    log.debug('%s successful authorized test', app.name);
  };

  app.authorization = {
    /**
     * Check if the user is logged in.
     *
     *
     * ## Example
     *
     * Create a server to use in every following example.
     *
     *        // dependencies
     *        var fs = require('fs'),
     *            path = require('path'),
     *            restify = require('restify'),
     *            authorify = require('authorify')({
     *              // add your config options
     *            });
     *        // create the server
     *        server = restify.createServer();
     *        // add middlewares
     *        server.use(restify.queryParser({ mapParams: false }));
     *        server.use(restify.bodyParser());
     *        server.use(authorify.authentication);
     *        // define handlers
     *        var ok = function(req, res, next){
     *          // define your response
     *          res.send({ success: true, message: 'ok' });
     *        };
     *        var sec = authorify.authorization;
     *
     *
     * ## Example 1
     *
     *
     *      server.get('/secure/loggedtest',
     *                sec.isLoggedIn('param == 1'),
     *                next);
     *
     *      request|param == 1 |logged|response
     *      -------|-----------|------|--------
     *      GET    |true       |true  |next()
     *      GET    |true       |false |401
     *      GET    |false      |true  |next()
     *      GET    |false      |false |next()
     *      GET    |missing opt|true  |403
     *      GET    |missing opt|false |403
     *
     * ## Example 2
     *
     *      server.get('/secure/loggedtest',
     *                sec.isLoggedIn('param == 1', { forbiddenOnFail: true }),
     *                next);
     *
     *      request|param == 1 |logged|response
     *      -------|-----------|------|--------
     *      GET    |true       |true  |next()
     *      GET    |true       |false |401
     *      GET    |false      |true  |403
     *      GET    |false      |false |403
     *      GET    |missing opt|true  |403
     *      GET    |missing opt|false |403
     *
     * ## Example 3
     *
     *      server.get('/secure/loggedtest',
     *                sec.isLoggedIn('opt1 == 1', { nextOnError: true }),
     *                next);
     *
     *      request|param == 1 |logged|response
     *      -------|-----------|------|--------
     *      GET    |true       |true  |next()
     *      GET    |true       |false |401
     *      GET    |false      |true  |next()
     *      GET    |false      |false |next()
     *      GET    |missing opt|true  |next(err)
     *      GET    |missing opt|false |next(err)
     *
     * ## Example 4
     *
     *      server.get('/secure/loggedtest',
     *                sec.isLoggedIn('opt1 == 1', { forbiddenOnFail: true, nextOnError: true }),
     *                next);
     *
     *      request|param == 1 |logged|response
     *      -------|-----------|------|--------
     *      GET    |true       |true  |next()
     *      GET    |true       |false |401
     *      GET    |false      |true  |403
     *      GET    |false      |false |403
     *      GET    |missing opt|true  |next(err)
     *      GET    |missing opt|false |next(err)
     *
     *
     * @param {String} [conditions] A string with a test that will be executed before to check next condition
     * @param {Object} [opts] Options to customize the behavior of the test
     * @param {Boolean} [opts.nextOnError=false] When true and the test trows an error, it execute next()
     * @param {Boolean} [opts.forbiddenOnFail=false] When true and the test fails (without error), it sends a 403 error
     * @return {String} The result of the logged test.
     *
     * Values:
     *
     * - 'ok': if the authorization test are successful evaluated
     * - 'ko': if the authorization test fails
     * - 'specific error': a string with a detail about the error occurred in conditions evaluation (e.g.: missing param)
     *
     */
    isLoggedIn: function(conditions, opts) {
      return function(req, res, next) {
        opts = setOptions(opts);
        var err;
        var checkResult = checkConditions(req, conditions);
        switch (checkResult) {
          case 'ok':
            if (_isLoggedIn(req)) {
              logSuccess();
              next();
            } else {
              err = new errors.UnauthorizedError('not logged in').log();
              res.send(err.statusCode, err.body);
            }
            break;
          case 'ko':
            if (opts.forbiddenOnFail) {
              err = new errors.ForbiddenError('failed conditions').log();
              res.send(err.statusCode, err.body);
            } else {
              logSuccess();
              next();
            }
            break;
          default:
            err = new errors.ForbiddenError(checkResult).log();
            if (opts.nextOnError) {
              next(err);
            } else {
              res.send(err.statusCode, err.body);
            }
            break;
        }
      };
    },
    /**
     * Check if the user id specified as param is the same of the logged user. See more example about conditions
     * and options in {@link #isLoggedIn} handler.
     *
     * ## Example
     *
     *      server.get('/secure/user/:user', sec.isSelf(), ok);
     *
     * @param {String} [conditions] A string with a test that will be executed before to check next condition
     * @param {Object} [opts] Options to customize the behavior of the test
     * @param {Boolean} [opts.nextOnError=false] When true and the test trows an error, it execute next()
     * @param {Boolean} [opts.forbiddenOnFail=false] When true and the test fails (without error), it sends a 403 error
     * @return {String} The result of the logged test.
     *
     * Values:
     *
     * - 'ok': if the authorization test are successful evaluated
     * - 'ko': if the authorization test fails
     * - 'specific error': a string with a detail about the error occurred in conditions evaluation (e.g.: missing param)
     */
    isSelf: function(conditions, opts) {
      return function(req, res, next) {
        opts = setOptions(opts);
        var err;
        var checkResult = checkConditions(req, conditions);
        switch (checkResult) {
          case 'ok':
            if (_isSelf(req)) {
              logSuccess();
              next();
            } else {
              err = new errors.ForbiddenError('user not allowed').log();
              res.send(err.statusCode, err.body);
            }
            break;
          case 'ko':
            if (opts.forbiddenOnFail) {
              err = new errors.ForbiddenError('failed conditions').log();
              res.send(err.statusCode, err.body);
            } else {
              logSuccess();
              next();
            }
            break;
          default:
            err = new errors.ForbiddenError(checkResult).log();
            if (opts.nextOnError) {
              next(err);
            } else {
              res.send(err.statusCode, err.body);
            }
            break;
        }
      };
    },
    /**
     * Check if the current user belongs at least one of the role/roles specified. See more example about conditions
     * and options in {@link #isLoggedIn} handler.
     *
     * ## Example
     *
     *      server.get('/secure/roletest1', sec.isInRole('admin'), ok);
     *      server.get('/secure/roletest2', sec.isInRole(['user', 'guest']), ok);
     *
     * @param {String/Array} roles A string or an array with one or more roles (at least one) to which
     * the current user should belong to
     * @param {String} [conditions] A string with a test that will be executed before to check next condition
     * @param {Object} [opts] Options to customize the behavior of the test
     * @param {Boolean} [opts.nextOnError=false] When true and the test trows an error, it execute next()
     * @param {Boolean} [opts.forbiddenOnFail=false] When true and the test fails (without error), it sends a 403 error
     * @return {String} The result of the logged test.
     *
     * Values:
     *
     * - 'ok': if the authorization test are successful evaluated
     * - 'ko': if the authorization test fails
     * - 'specific error': a string with a detail about the error occurred in conditions evaluation (e.g.: missing param)
     */
    isInRole: function(roles, conditions, opts) {
      return function(req, res, next) {
        opts = setOptions(opts);
        var err;
        var checkResult = checkConditions(req, conditions);
        switch (checkResult) {
          case 'ok':
            if (_isInRole(req, roles)) {
              logSuccess();
              next();
            } else {
              err = new errors.ForbiddenError('role not allowed').log();
              if (opts.nextOnError) {
                next(err);
              } else {
                res.send(err.statusCode, err.body);
              }
            }
            break;
          case 'ko':
            if (opts.forbiddenOnFail) {
              err = new errors.ForbiddenError('failed conditions').log();
              res.send(err.statusCode, err.body);
            } else {
              logSuccess();
              next();
            }
            break;
          default:
            err = new errors.ForbiddenError(checkResult).log();
            res.send(err.statusCode, err.body);
            break;
        }
      };
    },
    /**
     * Check if the user id specified as param is the same of the logged user or the user belongs
     * at least one of the role/roles specified. See more example about conditions and options in
     * {@link #isLoggedIn} handler.
     *
     * ## Example
     *
     *      server.get('/secure/selfrole/:user/somepath', sec.isSelfOrInRole(['admin', 'user']), ok);
     *
     *
     * @param {String/Array} roles A string or an array with one or more roles (at least one) to which
     * the current user should belong to
     * @param {String} [conditions] A string with a test that will be executed before to check next condition
     * @param {Object} [opts] Options to customize the behavior of the test
     * @param {Boolean} [opts.nextOnError=false] When true and the test trows an error, it execute next()
     * @param {Boolean} [opts.forbiddenOnFail=false] When true and the test fails (without error), it sends a 403 error
     * @return {String} The result of the logged test.
     *
     * Values:
     *
     * - 'ok': if the authorization test are successful evaluated
     * - 'ko': if the authorization test fails
     * - 'specific error': a string with a detail about the error occurred in conditions evaluation (e.g.: missing param)
     */
    isSelfOrInRole: function(roles, conditions, opts) {
      return function (req, res, next) {
        opts = setOptions(opts);
        var err;
        var checkResult = checkConditions(req, conditions);
        switch (checkResult) {
          case 'ok':
            if (_isSelf(req) || _isInRole(req, roles)) {
              logSuccess();
              next();
            } else {
              err = new errors.ForbiddenError('user or role not allowed').log();
              res.send(err.statusCode, err.body);
            }
            break;
          case 'ko':
            if (opts.forbiddenOnFail) {
              err = new errors.ForbiddenError('failed conditions').log();
              res.send(err.statusCode, err.body);
            } else {
              logSuccess();
              next();
            }
            break;
          default:
            err = new errors.ForbiddenError(checkResult.log());
            if (opts.nextOnError) {
              next(err);
            } else {
              res.send(err.statusCode, err.body);
            }
            break;
        }
      };
    }
  };

  return app;
};