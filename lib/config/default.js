/**
 * This is an authentication and authorization middleware for a REST server with data encryption and signing.
 * You can use it with [restify][1] or other server compatible with a generic middleware: `function (req, res, next) {...}`.
 * See more details in README file.
 *
 * @class node_modules.authorify
 * @uses node_modules.authorify.authentication
 * @uses node_modules.authorify.authorization
 *
 * @author Marcello Gesmundo
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
 * - For more convoluted language, see the LICENSE file.
 *
 * [1]: http://mcavage.me/node-restify
 *
 */
module.exports = function(app) {
  'use strict';

  // dependencies
  var _            = require('underscore'),
      fs           = require('fs'),
      async        = require('async'),
      path         = require('path'),
      forge        = require('node-forge'),
      math         = require('mathjs');

  // namespace
  var my = {};

  my.config = {
    /**
     * @ignore
     * @private
     */
    name: 'authorify',
    /**
     * @cfg {Object} [logger = console] The logger. It MUST have
     * log, error, warn, info, debug methods
     */
    logger: console, // for best logging please use winston: npm install winston
    /**
     * @cfg {Boolean} debug=true true to enable verbose log
     */
    debug: false,
    /**
     * @cfg {Boolean} persist=false Persistence of token
     * If persist is false, the token (and it's session) will expire after the tokenTtl config.
     * If persist is true, the token will never expire and tokenTtl config will be ignored.
     */
    persist: false,
    /**
     * @cfg {Integer} sidTtl=300 The time to live for the handshake and authentication session in seconds
     */
    sidTtl: 300, // 5min
    /**
     * @cfg {Integer} tokenTtl=3600 The time to live for the token and it's authorized session in seconds
     */
    tokenTtl: 3600, // 60min
    /**
     * @cfg {Integer} sidLength=40 The number of characters to create the session ID.
     */
    sidLength: 40,
    /**
     * @cfg {connection} connection REDIS connection information
     * @cfg {Number} connection.port=6379 REDIS port
     * @cfg {String} connection.host='127.0.0.1' REDIS host
     * @cfg {Number} [connection.db] REDIS database index for sessions
     * @cfg {String} [connection.user] REDIS user
     * @cfg {String} [connection.pass] REDIS password
     */
    connection: {
      port: 6379,
      host: '127.0.0.1',
      db  : undefined,
      user: undefined,
      pass: undefined
    },
    /**
     * @cfg {Object} crypto=node-forge Cryptographic engine
     */
    crypto: forge,
    /**
     * @cfg {String} cert The server X.509 certificate in pem format
     */
    cert: fs.readFileSync(path.join(__dirname,'cert/serverCert.cer'), 'utf8'),
    /**
     * @cfg {String} key The server private RSA key in pem format
     */
    key: fs.readFileSync(path.join(__dirname,'cert/serverCert.key'), 'utf8'),
    /**
     * @cfg {String} ca The Certification Authority certificate in pem format
     */
    ca: fs.readFileSync(path.join(__dirname,'cert/serverCA.cer'), 'utf8'),
    /**
     * @cfg {Object} sessionStore The store for the sessions
     */
    sessionStore: undefined,
    /**
     * @cfg {String} SECRET The secret key used in hash operations
     */
    SECRET: 'secret',  // use your own SECRET!
    /**
     * @cfg {String} SECRET_CLIENT The key used in conjunction with SECRET to verify handshake token. This key must be the same on both the server and the client.
     */
    SECRET_CLIENT: 'secret_client',  // use your own SECRET_CLIENT,
    /**
     * @cfg {String} SECRET_SERVER The key used in conjunction with SECRET to create authorization token
     */
    SECRET_SERVER: 'secret_server',   // use your own SECRET_SERVER
    /**
     * @cfg {String} encryptedBodyName = 'ncryptdbdnm' The property name for the encrypted body value
     */
    encryptedBodyName: 'ncryptdbdnm',
    /**
     * @cfg {String} encryptedSignatureName = 'ncryptdsgnnm' The property name for the signature value of the body
     */
    encryptedSignatureName: 'ncryptdsgnnm',
    /**
     * @cfg {Boolean} signBody = true Sign the body when it is sent encrypted
     */
    signBody: true,
    /**
     * @cfg {Boolean} encryptQuery = true Encrypt the values in url query string
     */
    encryptQuery: true,
    /**
     * @cfg {String} authHeader='Authorization' The header used for authentication and authorization
     */
    authHeader: 'Authorization',
    /**
     * @cfg {String} handshakePath='/handshake' The route exposed by the server for the handshake phase
     */
    handshakePath: '/handshake',
    /**
     * @cfg {String} authPath='/auth' The route exposed by the server for the authentication/authorization phases
     */
    authPath: '/auth',
    /**
     * @cfg {String} logoutPath='/logout' The route exposed by the server for the logout
     */
    logoutPath: '/logout',
    /**
     * @cfg {Integer} clockSkew=0 Max age (in seconds) of the request/reply.
     * Every request must have a valid response within clockSkew seconds.
     * Note: you must enable a NTP server both on client and server. Set 0 to disable date check or 300 like Kerberos.
     */
    clockSkew: 0,
    /**
     * The login handler. You MUST define your own login strategy.
     *
     * ## Example
     *
     *      var fs = require('fs'),
     *          authorify = require('auhtorify')({
     *          key: fs.readFileSync('serverCert.key'), 'utf8'),
     *          cert: fs.readFileSync('serverCert.cer'), 'utf8'),
     *          ca: fs.readFileSync('serverCA.cer'), 'utf8'),
     *          login: function(id, app, username, password, callback) {
     *            // manage id and app as your needs
     *            if (username === 'username' && password === 'password') {
     *              callback(1, ['admin']);
     *            } else if (username === 'user' && password === 'pass') {
     *                callback(2, ['user']);
     *            } else {
     *              callback(new Error('user and/or password wrong'));
     *            }
     *          }
     *      });
     *
     * @cfg {Function} login
     * @param {String} id The id (uuid) assigned to the client
     * @param {String} app The app (uuid) assigned to the application that the client want to use
     * @param {String} username The username for the browser login
     * @param {String} password The password for the browser login
     * @param {Function} callback Function called when the identifier is created
     * @return {callback(err, userId, admins)} The callback to execute as result
     * @param {String/Error} callback.err Error if occurred
     * @param {String} callback.userId The user identifier
     * @param {String/Array} callback.admins The role/s of the user
     *
     */
    login: function(id, app, username, password, callback) {
      throw new Error('you must implement your own login method');
    },
    /**
     *
     * Enable routes without Authorization header. When false the authorization header is mandatory for every route even if the route does not have a specific authorization. Set true to try to manage a route if it does not have an authorization handler.
     *
     * ## Example 1
     *
     *      // dependencies
     *      var restify = require('restify'),
     *          authorify = require('auhtorify')({
     *            freeRoutes: true
     *            // other options
     *          });
     *
     *      // create the server
     *      var server = restify.createServer();
     *
     *      // add middlewares
     *      server.use(restify.queryParser({ mapParams: false }));
     *      server.use(restify.bodyParser());
     *      server.use(authorify.authentication);
     *
     *      // last route handler
     *      var ok = function(req, res, next){
     *        res.send({ success: true });
     *      };
     *
     *      // routes
     *      // in the route below 'ok' can handled if the request is with or without the Authorization header
     *      server.get('/free', ok);
     *       // in the route below if the request doesn't have the Authorization header, the sec.isLoggedIn()
     *       // handler is performed, but fails and the 'ok' handler isn't reached
     *      server.get('/secure', sec.isLoggedIn(), ok);
     *
     * ## Example 2
     *
     *      // dependencies
     *      var restify = require('restify'),
     *          authorify = require('auhtorify')({
     *            freeRoutes: false
     *            // other options
     *          });
     *
     *      // create the server
     *      var server = restify.createServer();
     *
     *      // add middlewares
     *      server.use(restify.queryParser({ mapParams: false }));
     *      server.use(restify.bodyParser());
     *      server.use(authorify.authentication);
     *
     *      // last route handler
     *      var ok = function(req, res, next){
     *        res.send({ success: true });
     *      };
     *
     *      // routes
     *      // in the route below 'ok' can handled only if the request has the Authorization header
     *      server.get('/free', ok);
     *       // in then route below if the request doesn't have the Authorization header, the sec.isLoggedIn() handler
     *       // isn't reached and the request fails; if the request have the Authorization header but the user
     *       // isn't logged, the 'ok' handler ins't performed (e.g.: session expired)
     *      server.get('/secure', sec.isLoggedIn(), ok);
     *
     *
     * @cfg {Boolean} freeRoutes=true
     *
     */
    freeRoutes: true,
    /**
     * The field name used for the user identifier into the routes.
     *
     * ## Example
     *
     *      var restify = require('restify'),
     *          authorify = require('auhtorify')({
     *            userIdFieldName: 'myuser'
     *            // other options
     *          });
     *      server.get('/secure/user/:myuser', sec.isSelf(), ok);
     *
     *
     * @cfg {String} userIdFieldName='user'
     */
    userIdFieldName: 'user'
  };

  // merge app.config with default config
  app.config = _.extend(my.config, app.config);
  app.name = app.config.name;

  if (!app.config.sessionStore) {
    app.config.sessionStore = require('restify-session')({
      ttl: app.config.sidTtl,
      persist: false,
      debug: app.config.debug,
      logger: app.config.logger,
      sidLength: app.config.sidLength,
      connection: app.config.connection
    });
  }

  app._ = _;
  app.async = async;
  app.config.sessionStore.name = app.name + ' session store';
  app.sessionStore = app.config.sessionStore;
  app.mathParser = math().parser();
  app.logger = app.config.logger;
  app.client = require('authorify-client')(app.config);

  /**
   * Load a plugin module to add some functionality.
   *
   * ## Example
   *
   *      var authorify = require('auhtorify')({
   *        // add your options
   *      });
   *      authorify.load('pluginname', 'shortname', opts);  // opts is an optional object to configure the plugin
   *      var loadedPlugin = authorify.plugin['shortname'];
   *      // below you can use all methods/properties exported by the plugin (loadedPlugin)
   *
   * @param {String} name The name of the plugin. THe plugin must be installed into the
   * application folder that uses the authorify module.
   * @param {String} [shortname] An optional short name for the plugin loaded as property in the root application
   * (authorify.plugin['shortname']).
   * @param {Object} [opts] The options required by the plugin.
   */
  app.load = function(name, shortname, opts) {
    if (_.isObject(shortname)) {
      opts = shortname;
      shortname = name;
    } else if (!shortname) {
      shortname = name;
    }
    opts = opts || {};
    app.plugin = app.plugin || {};
    var plugin = require(name)(app, opts);
    if (plugin) {
      app.logger.info('%s plugin %s loaded with name %s', app.name, name, shortname);
      app.plugin[shortname] = plugin;
    }
  };

  app.logger.info('%s setup completed', app.name);

  return app;
};

/**
 * {@link node_modules.authorify.authentication The authentication middleware.}
 *
 * @property {function (req, res, next)} authentication
 * @param {IncomingMessage} req Request
 * @param {ServerResponse} res Response
 * @param {Function} next The callback
 * @param {Error} next.err The error instance if occurred
 */

/**
 * {@link node_modules.authorify.authorization The authorization middleware.}
 *
 * @property {Object} authorization
 *
 */
