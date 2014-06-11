/**
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
 *
 * For more convoluted language, see the LICENSE file.
 */
module.exports = function(config) {
  'use strict';

  // dependencies
  var load   = require('express-load'),
      path   = require('path'),
      util   = require('util'),
      errors = require('logged-errors');

  errors.set({
    format: function(e, mode) {
      mode = mode || 'msg';
      if (mode === 'msg') {
        return util.format('%s %s', app.name, e.message);
      }
      return util.format('%s %s', app.name, e.body);
    }
  });

  // namespace
  var app = {};

  app.errors = errors;

  /**
   * @ignore
   */
  app.name = 'authorify';
  /**
   * Configuration
   */
  app.config = config;
  
  var cwd = path.resolve(__dirname, 'lib');

  // load all scripts
  load('config', { cwd: cwd })
    .then('middleware')
    .into(app);

  // remove unwanted property because app.config.default is assigned to app.config
  delete app.config.default;

  return app;
};

// TODO: add a method to create authorify-client file for browser usage