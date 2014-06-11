# Authorify

This is an authentication and authorization middleware for a REST server with data encryption and signing. You can use it with [restify][1] or other server compatible with a generic middleware: `function (req, res, next) {...}`. A dedicated plugin [authorify-websocket][9] enable the middleware to exchange data using websockets.

## Motivation

In some circumstances you can't use a https server with a self signed certificate (e.g. [Cordova/Phonegap][3] iOS/Android app) and you need only a http server that (also) validate the identity of the client without using cookies. In this scenario you can use an alternative approach: encrypt yourself your data and send/receive your data to/from server over http or websockets. The authentication/authorization process uses only the _Authorization_ header. The security layer is based on the X.509 certificates and the [forge][6] module manage the encryption/decryption/signing/verifying both in node and browser. All encrypted data are signed from the sender and the signature is verified by the receiver. Note that the url query strings are also encrypted according your configuration options (see `encryptQuery` option).

The related client ([authorify-client][5]) can used both from a node application or a browser opening local files. See below the protocol definition.

***

## Protocol definition v1.4

We define _client_ a generic software (browser or Node.js application) that establishes a connection with the REST server and _user_ the _actor_ that wants to use the server resources via client. The client uses his X.509 certificate to obtain the access (for the user) to the (protected) REST server resources. The authentication and the authorization of the user (via client) can occur only after a successful client authentication.
We have three phases (GET requests from client using a custom _Authorization_ header):

* Handshake

    The client has a private RSA key and sends his X.509 certificate (that contains the public RSA key) to the server that has his private RSA key and sends to client his public X.509 certificate (it contains the public RSA key). Both client and server inspect the certificate (using the CA) and accept the next phase only in case of success. The server generate a temporary session (sid) and sends to the client this sid and a generated token. The successful handshake is a valid _client authentication_. If a wrong header is provided a 400 error occurs.

* Authentication

    If a client is authenticated (successful handshake), it can request a user authentication sending the previous token, the sid and some parameters (app/id/username/password) validated from the server. If the user is successful validated a _user authentication_ occurs and the server sends to the client a definitive sid and token, otherwise the server reply with a 401 error.

* Authorization
    
    The authenticated user can access the exposed resources sending the sid and the token: the server verify the corresponding authorization and responds with the required resources or a 403 error. If a client requests some protected resource with an expired authorization header, a 401 error occurs.
    
### Prerequisites

On the REST server:

1) generate a private RSA key:

    $ openssl genrsa -des3 -out serverCA.key 1024
    $ password:
    $ verify password:
    
2) create a X.509 certificate for custom Certification Authority (CA):
    
    $ openssl req -x509 -new -key serverCA.key -out serverCA.cer -days 3650 -subj /CN="Server Custom CA"

3) create a new private RSA key and another X.509 certificate to send to client during the _handshake_ phase (read further):

    $ openssl genrsa -out serverCert.key 1024
    $ openssl req -new -x509 -key serverCert.key -out serverCert.cer -days 365 -subj /CN=www.yoursite.com

On the client:

4) generate a private RSA key:

    $ openssl genrsa -out clientCert.key 1024

Note that this time you can't set a password.

5) generate a Client Signing Request (CSR) to obtain your own X.509 certificate from the custom CA:

    $ openssl req -new -out clientCert.req -key clientCert.key -subj /CN=clienthostname

6) Copy _clientCert.req_ on the server.

On the REST server:

7) use _clientCert.req_ to create a new X.509 certificate validate from the custom CA:

    $ openssl x509 -req -in clientCert.req -out clientCert.cer -CAkey serverCA.key -CA serverCA.cer -days 365 -CAcreateserial -CAserial clientCert.ser

8) copy _clientCert.cer_ on the client

9) copy to the client the _serverCA.cer_ certificate created on the server (because we want to verify the certificates during the handshake phase due the custom CA). Remember that we use a self signed certificate.

On the server and on the client:

10) update the file permissions:

    $ chmod 0400 *.key *.crt

Repeat the steps from 7) to 10) for every (Node.js) client you want to enable to connect to the REST server. For a browser client please read the [authorify-client][5] documentation.

### Header

As mentioned above, all requestes from the client and all responses from the server use an _Authorization header: a Base64 string of a JSON_ object whose structure is shown below for every phase.

### Handshake

***

#### Request

    {
        "payload": {
            "type": String,
            "cert": String
        },
        "content": {
            "date": Number,
            "token": String
        },
        "signature": String
    }

where:

* type: is set to `handshake`
* cert: is the X.509 certificate of the client in pem format
* date: is the number of milliseconds since 01/01/1970,
* token: is the SHA256 digest of a string composed as below:

     `date :: cert :: secret-shared-key`
     
     where:
     
     * secret-shared-key: is a string known by both client and server
     
* signature: is the signature of the `content` using the private RSA key of the client.

#### Response

    {
        "payload": {
            "type": String,
            "cert": String,
            "sid": String
        },
        "content": {
            "date": Number,
            "token": String
        },
        "signature": String
    }

where:

* type: is set to `handshake`
* cert: is the X.509 certificate of the server in pem format
* sid: is a temporary session identifier generated by the server
* date: is the number of milliseconds since 01/01/1970,
* token: is the SHA256 digest of a string composed as below:

     `date :: cert :: secret-shared-key`
     
     where:
     
     * secret-shared-key: is a string known by both client and server
     
* signature: is the signature of the `content` using the private RSA key of the server.

Both client and server store the received X.509 certificate after a successful verification with CA.

### Authentication

***

#### Request

    {
        "payload": {
            "type": String,
            "sid": String,
            "secret": String
        },
        "content": String,
        "signature": String
    }

where:

* type: is set to `auth-init`
* sid: is the sid previously received from the server
* secret: is the RSA encryption result of a random key/iv used for the AES256 encryption tasks. It change on every new request. Note that the secret is encrypted using the public RSA key of the server contained into the previous recevied X.509 certificate.
* content: is the AES256 encryption result of the follow object:

    ```json
    {
        "date": Number,
        "id": String,
        "app": String,
        "username": String,
        "password": String,
        "token": String
    }
    ```

    where:

    * date: is the number of milliseconds since 01/01/1970
    * id: is an uuid identifier of the client
    * app: is an uuid identifier of the application
    * username: is the username
    * password: is the password
    * token: is the SHA256 digest of a string composed as below:

         `date :: cert :: sid :: id :: app :: secret-shared-key`
     
         where:
     
         * cert: is the X.509 cert of the client in pem format (previous received)
         * sid: is the previous received sid
         * secret-shared-key is a string known by both client and server

* signature: is the signature of the `content` (before encryption) using the private RSA key of the client.

Note that in case of Node.js client, you can omit username/password and define your own strategy for id/app assignment.

#### Response

    {
        "payload": {
            "type": String,
            "sid": String,
            "secret": String
        },
        "content": String,
        "signature": String
    }

where:

* type: is set to `auth-init`
* sid: is a new definitive session identifier generated by the server
* secret: is the RSA encryption result of a random key/iv used for the AES256 encryption tasks. It change on every new response. Note that the secret is encrypted using the public RSA key of the client contained into the previous recevied X.509 certificate.
* content: is the AES256 encryption result of the follow object:

    ```json
    {
        "date": Number,
        "id": String,
        "app": String,
        "token": String
    }
    ```

    where:

    * date: is the number of milliseconds since 01/01/1970,
    * id: is the uuid identifier provided by the client
    * app: is the uuid identifier of the application provided by the client
    * token: is the SHA256 digest of a string composed as below:

        `date :: cert :: sid :: id :: app :: username :: password :: secret-server-key`
     
        where:
    
        * username: is the username provided by the client
        * password: is the password provided by the client
        * secret-server-key: is a string known by the server only
     
* signature: is the signature of the `content` (before encryption) using the private RSA key of the server.

### Authorization

***

#### Request

    {
        "payload": {
            "type": String,
            "sid": String,
            "secret": String
        },
        "content": String,
        "signature": String
    }

where:

* type: is set to `auth` if the body (if present) is encrypted (AES256) or `auth-plain` it the body (if present) is in plain text
* sid: is the last previous received session identifier
* secret: is the RSA encryption result of a random key/iv used for the AES256 encryption tasks. It change on every new response. Note that the secret is encrypted using the public RSA key of the server contained into the previous recevied X.509 certificate and stored locally into the client.
* content: is the AES256 encryption result of the follow object:

    ```json
    {
        "date": Number,
        "token": String
    }
    ```

    where:

    * date: is the number of milliseconds since 01/01/1970,
    * token: is last received string.

* signature: is the signature of the `content` (before encryption) using the private RSA key of the client.

#### Response

    {
        "payload": {
            "type": String,
            "sid": String,
            "secret": String
        },
        "content": String,
        "signature": String
    }

where:

* type: is set to `auth` if the body (if present) is encrypted (AES256) or `auth-plain` it the body (if present) is in plain text. The value is the same present into the request.
* sid: the last session identifier
* secret: is the RSA encryption result of a random key/iv used for the AES256 encryption tasks. It change on every new response. Note that the secret is encrypted using the public RSA key of the client contained into the previous recevied X.509 certificate and stored locally into the server session.
* content: is the AES256 encryption result of the follow object:

    ```json
    {
        "date": Number,
        "token": String
    }
    ```

    where:

    * date: is the number of milliseconds since 01/01/1970,
    * token: is last generated string.

* signature: is the signature of the `content` (before encryption) using the private RSA key of the server.

If the body is present, his content is signed by the sender and verified by the receiver.

## Satus code

The server send a reply with one of the follow status code:

* 200 success: the request is ok

* 400 bad request: when the header is missing or it has an expired session/token

* 401 unhautenticated: when an authentication is needed but it was not provided or it is wrong

* 403 unhautorized: when an authenticated user don't have the authorization for the request resource

* 500 internal error: other server error

## Installation

Install `authorify` as usual:

    $ npm install --save authorify

## Usage

### Create the server

In this example we use a [Restify][1] server:

```javascript
var restify = require('restify');
server = restify.createServer();
```

### Create your certificates

Create your own X.509 certificates and RSA key as above and put it into `cert` folder (or other your prefer forlder) into your server.

### Configure the authorify middleware

```javascript
var fs = require('fs'),
    path = require('path'),
    authorify = require('authorify')({
      debug: true,
      key : fs.readFileSync(path.join(__dirname,'cert/serverCert.key'), 'utf8'),
      cert: fs.readFileSync(path.join(__dirname,'cert/serverCert.cer'), 'utf8'),
      ca  :  fs.readFileSync(path.join(__dirname,'cert/serverCA.cer'), 'utf8'),
      // define your login function!
      login: function(id, app, username, password, callback) {
        if (username === 'username' && password === 'password') {
          callback(1, ['admin']);
        } else if (username === 'user' && password === 'pass') {
          callback(2, ['user']);
        } else {
          callback(new Error('wrong credentials'));
          // or simply
          // callback('wrong credentials');
        }
      }
    });
```

### Add all middlewares

```javascript
server.use(restify.queryParser({ mapParams: false }));
server.use(restify.bodyParser());
server.use(authorify.authentication);
```

### Define and authorize the resources

To protect your REST resources you can add some handlers to your routes:

```javascript
var ok = function(req, res, next){
  // define your response
  res.send({ success: true, message: 'ok' });
};
var sec = authorify.authorization;
var authorize = sec.isLoggedIn();
server.get('/handshake', ok);
server.get('/auth', ok);
server.get('/logout', function(req, res, next) {
  res.send({ success: true, message: 'logged out' })
});
server.get('/secure/resource', authorize, ok);
```

See below the ready to use handlers regarding users and roles. You can add your handlers according your business logic: we don't want to constrain your application with our logic!

#### isLoggedIn

If the user is logged the test is successful:

```javascript
server.get('/secure/loggedtest', sec.isLoggedIn(), ok);
```
    
#### isSelf

If the user is the same that is logged the test is successful:

```javascript
server.get('/secure/user/:user', sec.isSelf(), ok);;
```

#### isInRole

If the user is in the specified role(s) the test is successful:

```javascript
server.get('/secure/roletest', sec.isInRole('admin'), ok);
// or
server.get('/secure/roletest', sec.isInRole(['admin', 'user']), ok);
```

#### isSelfOrInRole

If the user is the same that is logged or it is in the specified role(s) the test is successful:

```javascript
server.get('/secure/roletest', sec.isSelfOrInRole(['user', 'guest']), ok);
```

#### Conditions in auhtorization handlers

All handlers can have an optional `condition` and `options` to customize the behavior. See the examples below to understand the behavior of the middleware based on the conditions and options.

###### Example 1

```javascript
server.get('/secure/loggedtest', sec.isLoggedIn('param == 1'), next);
```

request|param == 1   |logged|response
-------|-------------|------|--------
GET    |true         |true  |next()     
GET    |true         |false |401
GET    |false        |true  |next()
GET    |false        |false |next()
GET    |missing param|true  |403
GET    |missing param|false |403

###### Example 2

```javascript
server.get('/secure/loggedtest', sec.isLoggedIn('param == 1', { forbiddenOnFail: true }), next);
```

request|param == 1   |logged|response
-------|-------------|------|--------
GET    |true         |true  |next()     
GET    |true         |false |401
GET    |false        |true  |403
GET    |false        |false |403
GET    |missing param|true  |403
GET    |missing param|false |403

###### Example 3

```javascript
server.get('/secure/loggedtest', sec.isLoggedIn('opt1 == 1', { nextOnError: true }), next);
```

request|param == 1   |logged|response
-------|-------------|------|--------
GET    |true         |true  |next()    
GET    |true         |false |401
GET    |false        |true  |next()
GET    |false        |false |next()
GET    |missing param|true  |next(err)
GET    |missing param|false |next(err)

###### Example 4

```javascript
server.get('/secure/loggedtest', sec.isLoggedIn('opt1 == 1', {
  forbiddenOnFail: true,
  nextOnError: true
}), next);
```

request|param == 1   |logged|response
-------|-------------|------|--------
GET    |true         |true  |next()   
GET    |true         |false |401
GET    |false        |true  |403
GET    |false        |false |403
GET    |missing param|true  |next(err)
GET    |missing param|false |next(err)

See also the documentation into `doc` folder.

### Start the server

```javascript
server.listen(3000);
```

To access your REST server you can use [authorify-client][5]. Please refer to his documentation for the client side management.

## Run Tests

Au usual we use [mocha][4] as test framework and you can run all tests simply typing:

    $ npm test

Note that you must have a local running [Redis][2] server.

To test the client into a browser environment with local file resources (not loaded from a web server), run the server into a terminal session:

    $ cd /path-to-authorify-client/test/browser/
    $ node server.js
    
and open `index.html` local file into your browser. If your prefer browser is Google Chrome, you must start it as below:

    $ _pwd=$PWD && open -b com.google.chrome --args --disable-web-security --allow-file-access-from-files $_pwd/index.html
    
Note that you must disable web security to allow XHR requests to your server (remember that your files are loaded NOT from the same server). See [dev tools documentation][7].

For more information about the client please read [authorify-client][5] documentation and the local documentation into `doc` folder.

## Documentation

To create your own  documentation you must install [JSDuck](https://github.com/senchalabs/jsduck) and type in your terminal:

    $ cd /path-of-package
    $ ./gen_doc.sh

See full documentation into _doc_ folder.

## Convention

The version number is laid out as: major.minor.patch and tries to follow semver as closely as possible but this is how we use our version numbering:

#### major
A major and possible breaking change has been made in the authorify core. These changes could be not backwards compatible with older versions.

#### minor
New features are added or a big change has happened with one of the third party libraries.

#### patch
A bug has been fixed, without any major internal and breaking changes.

# Contributing

To contribute to the project follow the [GitHub guidelines][8].

# License

This program is released under a GNU Affero General Public License version 3 or above, which in summary means:

- You __can use__ this program for __no cost__.
- You __can use__ this program for __both personal and commercial reasons__.
- You __do not have to share your own program's code__ which uses this program.
- You __have to share modifications__ (e.g bug-fixes) you've made to this program.

For more convoluted language, see the LICENSE file.


[1]: https://www.npmjs.org/package/restify
[2]: https://www.npmjs.org/package/express
[3]: http://phonegap.com
[4]: https://www.npmjs.org/package/mocha
[5]: https://www.npmjs.org/package/authorify-client
[6]: https://www.npmjs.org/package/node-forge
[7]: https://developer.chrome.com/extensions/xhr
[8]: https://guides.github.com/activities/contributing-to-open-source/index.html#contributing
[9]: https://www.npmjs.org/package/authorify-websocket
