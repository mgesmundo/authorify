/*global describe, before, it, client, should */

var logger = console;

function noErr (err) {
  return (err === undefined || err === null);
}

describe('Authorify', function() {
  before(function() {
    client.setConfig({
      logger: logger,
      host: 'localhost',
      port: 3000,
      id: 'ae92d22b-a9ab-458a-9850-0025dbf11fad',
      app: 'c983659a-9572-4471-a3a2-7d45b591d315',
      key: [
          '-----BEGIN RSA PRIVATE KEY-----',
          'MIICXAIBAAKBgQCyBE3p/5ODTHmJD/8waYszixKD0TUHmAy2tInaUQGS/rWHIB4q',
          'STdJfht8h4IQOm1RHPaGS/oGOgIQ8xfQlntiSx7Fc6QbnDOWTXGEHq2MzPFiYY4+',
          'T45liG8aWaIZ9ZBnLCW/7EIQMwT5ruJMfzm++ZQI8haxYrRumKOZGvFeUQIDAQAB',
          'AoGAfRWtMbkWC/JWi8qjw37GAye7kMgV/QoIFPFy0+aLtqAnKZWV3JyprohgA/ar',
          'm3+ShKZXSzJjsrBb91D48OZsNw8Sgk9npcgOUro/WwSSgD0B+QfXbFwanZB2t14W',
          'T+Dw46wi0or6PionBezEwQFWNbN264I2LaO/8D2xdJ07sAECQQDW5Shp1J5vQnjr',
          'v9mHDB4DXJXgcjqYTKEpVMglw9KhDLkktACNRszxkZMwCr4AV+nULKwVYjLjTzyS',
          '61q3haOBAkEA1BFQFrVBEkeLYiY/ETCwLVssFv5OH1pDPKrwO/9gznHudyAaCtKE',
          'y8/h41keuOyfbI7Icrcvg2Z2g2/C7//i0QJBAKYWXvHMntcm7QZoNNunhdrbSAs8',
          'vgTP1Q94s2hcvQI0LzQq2vJV8jgSZ0wOQWNKjzKphCbSyrncl9iFhoupAgECQEmG',
          'XyAgY5k02OyEmiUZnlt7WsP2E5vnLZyhH32Nw0CQW79Nj/nkl0oanxS112MCFxwK',
          'PREY1g5Wvgw/+XRAYaECQCiH+deTEqCvJbBthC0n8W/HUe/zQ8N5i+HnQqMZC8zv',
          'lZ0nrKqCEVjU2sxaTls1g2CEjKLDYfLQ0HZQTnzKP0A=',
          '-----END RSA PRIVATE KEY-----'
        ].join('\n'),
      cert: [
          '-----BEGIN CERTIFICATE-----',
          'MIICKDCCARACCQDsYveOkveBTDANBgkqhkiG9w0BAQUFADAXMRUwEwYDVQQDDAxN',
          'eSBDdXN0b20gQ0EwHhcNMTQwNDA1MDgwMzUwWhcNMTUwNDA1MDgwMzUwWjAZMRcw',
          'FQYDVQQDDA5jbGllbnRob3N0bmFtZTCBnzANBgkqhkiG9w0BAQEFAAOBjQAwgYkC',
          'gYEAsgRN6f+Tg0x5iQ//MGmLM4sSg9E1B5gMtrSJ2lEBkv61hyAeKkk3SX4bfIeC',
          'EDptURz2hkv6BjoCEPMX0JZ7YksexXOkG5wzlk1xhB6tjMzxYmGOPk+OZYhvGlmi',
          'GfWQZywlv+xCEDME+a7iTH85vvmUCPIWsWK0bpijmRrxXlECAwEAATANBgkqhkiG',
          '9w0BAQUFAAOCAQEAGFmlf8ninazo89ewCb9L+Dqx6q3aVT+Tahh7Fpk2pxADmZ2K',
          'e59hTE7/XJQ1vNkXAD79vQSfypi8XVXvQPXmLnwVrBNbhEF/iPFGCYLV7EMUnvYu',
          'n1M4sRhfuUrumW0qL8lAT0amk5HtS/rReTjmGJzwx+9ZVaHpbMv1RiaZe5MAA6L+',
          'fBJw8iPCwm4mG5nKaWiky6O5BsbTIiujUOIO3ChMwZh08HYvjGDl9tnI9p9ATmZJ',
          'LxFbOi1z6HMVDO3RZHOvu0UFzzJvvWN9X3eF+6JoRBILtUFYpCle/qQaSYrO7alW',
          'QAEgO0Xpk8vTOWVxhK8NnAmopkY4O0noBGBMsg==',
          '-----END CERTIFICATE-----'
        ].join('\n'),
      ca: [
          '-----BEGIN CERTIFICATE-----',
          'MIIDATCCAemgAwIBAgIJAKhKdunKnaQXMA0GCSqGSIb3DQEBBQUAMBcxFTATBgNV',
          'BAMMDE15IEN1c3RvbSBDQTAeFw0xNDAzMjkxMjA4NDVaFw0xNTAzMjkxMjA4NDVa',
          'MBcxFTATBgNVBAMMDE15IEN1c3RvbSBDQTCCASIwDQYJKoZIhvcNAQEBBQADggEP',
          'ADCCAQoCggEBALDuUkjePIKvLZXj7svSMOf4H9EPHVFOkJThCqIKaT6U33dF7Mpp',
          '1E1IqppMeEa+36AwAgbis7YIbKSKs9ZTl/tJkBGnLpNKLNRMdYwNk6e/pyom8tl/',
          'JdaA/fFMRexLFh1BrLlORnbiFVpNImgS0KlUnKhR3SOJibfqOUo4Tl45L+2QaTwa',
          '6Lj1lo/YfEvXpuY2MUdQPdGUhRgJ9KX8q40MCNDWMYUNYK/Re+JVhxlvnN910Y1/',
          'IFlPhv2NDrqWxRVZ5ahD0ufRdS9h4nsu3eAceqpRHIS+qZgQkf2K/SKC8S8sUdW9',
          'vDd84TfZQ/i3YUOfhS1GC1pUpmxYKcuBROUCAwEAAaNQME4wHQYDVR0OBBYEFIFn',
          'HSDeKbl4inaQpn6rKcKmEk90MB8GA1UdIwQYMBaAFIFnHSDeKbl4inaQpn6rKcKm',
          'Ek90MAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQADggEBAJ1jDrfXStadviKx',
          'p7dTAZHqNahd14ZgicIsyKqL2hZYb6XkJKDppz6wby5MP7ov8Ge0OBo+49JRdFAJ',
          'nwGTubotzU55c37rq5NOEqfUKfRBwBVDeKqzXaHl0BdheHM3fWleX3iNfYt4aj+w',
          'pJSbZeBges8LM6RGBK1yLwE9G135biEQpry7vtS7SzPZ021ZPSUAHfUuHX7PNeLM',
          'efXCCFZWGnc+AglBK6rDSY6DMVpztXq6dyGGpOSk4qwsUk+rr1BLoAkpTKZnfSim',
          '8romx3H5K2Ex53VC/190vb8TZsH83AjIRTc02cYOPNl/adzPCIlyg/afzDWoen9N',
          'A599UMg=',
          '-----END CERTIFICATE-----'
        ].join('\n')
    });
    // load plugin
    client.load('authorify-websocket', 'ws', {
      transports: ['ws', 'http'],
      requestTimeout: 200
    });
  });
  describe('Body test', function() {
    it('should send a non encrypted body without authorization header', function(done) {
      var message = { field1: 'value1', field2: 'value2' };
      client.post('/test')
        .pass()
        .send(message)
        .end(function(err, res) {
          noErr(err).should.true;
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
        noErr(err).should.true;
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
          noErr(err).should.true;
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
          noErr(err).should.true;
          res.body.success.should.true;
          res.body.content.field1.should.equal('value1');
          res.body.content.field2.should.equal('value2');
          done();
        });
    });
    it('should logout', function(done) {
      client.logout(function(err, res) {
        noErr(err).should.true;
        res.body.success.should.true;
        res.body.content.should.equal('logged out');
        done();
      });
    });
  });

  describe('Security Manager', function() {
    it('Login using separate handshake and authenticate requests', function(done) {
      client.handshake(function(err, res) {
        noErr(err).should.true;
        client.authenticate('username', 'password', function(err, res) {
          noErr(err).should.true;
          res.body.success.should.true;
          res.ok.should.true;
          done();
        });
      });
    });
    describe('isLoggedIn tests', function() {
      it('should fail to request path without authorization header for a protected path', function(done) {
        client.get('/secure/loggedin1')
          .pass()
          .end(function(err, res) {
            noErr(err).should.true;
            res.status.should.equal(401);
            res.body.message.should.equal('not logged in');
            done();
          });
      });
      it('should is logged in', function(done) {
        client.get('/secure/loggedin1')
          .end(function(err, res) {
            noErr(err).should.true;
            res.status.should.equal(200);
            noErr(err).should.true; 
            done();
          });
      });
      it('should throw error if missing param', function(done) {
        client.get('/secure/loggedin2')
          .end(function(err, res) {
            noErr(err).should.true;
            res.status.should.equal(403);
            res.body.message.should.equal('opt1 parameter not found');
            done();
          });
      });
      it('should is logged in with param with expected value (GET)', function(done) {
        client.get('/secure/loggedin2')
          .query({ opt1: 1 })
          .end(function(err, res) {
            noErr(err).should.true;
            done();
          });
      });
      it('should is logged in with param with expected value (POST)', function(done) {
        client.post('/secure/loggedin2')
          .send({ opt1: 1 })
          .end(function(err, res) {
            noErr(err).should.true;
            done();
          });
      });
      it('should decrypt secure body', function(done) {
        client.post('/secure/loggedin5')
          .send({ opt1: 1 })
          .send({ message: 'secret message' })
          .end(function(err, res) {
            noErr(err).should.true; 
            res.body.content.opt1.should.equal(1);
            res.body.content.message.should.equal('secret message');
            done();
          });
      });
      it('should skip to next on error', function(done) {
        client.get('/secure/loggedin3')
          .end(function(err, res) {
            noErr(err).should.true; 
            res.ok.should.false;
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
            noErr(err).should.true;
            (res.body.success === undefined).should.true;
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
            noErr(err).should.true; 
            done();
          });
      });
      it("shouldn't pass if user is not self", function(done) {
        client.get('/secure1/user/2')
          .end(function(err, res) {
            noErr(err).should.true;
            (res.body.success === undefined).should.true;
            res.body.message.should.equal('user not allowed');
            res.status.should.equal(403);
            done();
          });
      });
      it('should pass if user is self and param is correct', function(done) {
        client.get('/secure2/user/1')
          .query({ opt1: 1 })
          .end(function(err, res) {
            noErr(err).should.true; 
            done();
          });
      });
    });
    describe('isRoles tests', function() {
      it('should pass if user is in required role', function(done) {
        client.get('/secure/roletest1')
          .end(function(err, res) {
            noErr(err).should.true; 
            done();
          });
      });
      it("shouldn't pass if user is not in required role", function(done) {
        client.get('/logout')
          .end(function(err, res) {
            noErr(err).should.true; 
            client.handshake(function(err, res) {
              noErr(err).should.true; 
              client.authenticate('user', 'pass', function(err, res) {
                noErr(err).should.true; 
                client.get('/secure/roletest1')
                  .end(function(err, res) {
                    noErr(err).should.true; 
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
            noErr(err).should.true; 
            done();
          });
      });
    });
    describe('isSelfOrInRole tests', function() {
      it('should pass if user is self', function(done) {
        client.get('/secure/selfrole/2/somepath')
          .end(function(err, res) {
            noErr(err).should.true; 
            done();
          });
      });
      it('should pass if user is in role', function(done) {
        client.get('/secure/selfrole/1/somepath')
          .end(function(err, res) {
            noErr(err).should.true; 
            done();
          });
      });
    });
  });

  describe('Websockets', function() {
   it('should send a non encrypted body without authorization header', function(done) {
     var message = { field1: 'value1', field2: 'value2' };
     client.post('/test')
       .pass()
       .send(message)
       .end(function(err, res) {
         noErr(err).should.true; 
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
       noErr(err).should.true; 
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
         noErr(err).should.true; 
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
         noErr(err).should.true; 
         res.body.success.should.true;
         res.body.content.field1.should.equal('value1');
         res.body.content.field2.should.equal('value2');
         done();
       });
   });
   it('should logout', function(done) {
     client.logout(function(err, res) {
         noErr(err).should.true; 
         res.body.success.should.true;
         res.body.content.should.equal('logged out');
         done();
       });
   });
  });
});
