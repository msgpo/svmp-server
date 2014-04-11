/*
 * Copyright 2013 The MITRE Corporation, All Rights Reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this work except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *    http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * @author Dave Bryson
 *
 */
var
    svmp = require('../../lib/svmp');
    svmpSocket = require('../../lib/server/svmpsocket'),
    auth = require('../../lib/authentication'),
    assert = require('assert');

PORT = 8001;
var UNAUTHENTICATED = 1;
var VMREADY_WAIT = 2;
var VMREADY_SENT = 3;
var PROXYREADY = 4;

function flow(clientSocket) {
    var state = UNAUTHENTICATED;
    var vmSocket = new svmpSocket.SvmpSocket();
    var authenticator = auth.Authentication.loadStrategy();

    clientSocket.on('message', function (message) {

        switch (state) {
            case UNAUTHENTICATED:
                var request = svmp.protocol.parseRequest(message);

                authenticator.authenticate(request)
                    .then(function (useSessionObj) {

                        state = VMREADY_WAIT;

                        var msg = {type: 'AUTH', authResponse: {type: "AUTH_OK"}};

                        clientSocket.sendResponse(msg);


                    }, function (err) {
                        var error_resp = proto.writeResponse({type: 'AUTH', authResponse: {type: "AUTH_FAIL"}});
                        clientSocket.end(error_resp);
                    }).done();

                break;
            case VMREADY_SENT:
                var request = svmp.protocol.parseRequest(message);
                if (request.type === 'VIDEO_PARAMS') {
                    // send json VIDEO_INFO
                    vmSocket.sendResponse({"type": "VIDSTREAMINFO", "videoInfo": videoResponseObj});
                    state = PROXYREADY;
                }
                break;
            case PROXYREADY:
                vmSocket.sendRaw(message);
                break;
        }

    });

    vmSocket.on('message', function (message) {

        if (state === VMREADY_WAIT) {
            var response = svmp.protocol.parseResponse(message);
            if (response.type === 'VMREADY') {
                state = VMREADY_SENT;
            }
        }
        clientSocket.sendResponse(message);

    });

}


describe("Test SVMP Server/Socket Authentication flow", function () {
    var instance;

    before(function (done) {

        // Change the settings at runtime
        svmp.config.set('settings:tls_proxy', false);

        instance = svmpSocket.createServer(undefined, flow).listen(PORT);


        instance.on('listening', function () {
            done();
        });
    });

    after(function (done) {
        instance.close();
        done();
    });


    it('should process svmpsockets', function (done) {

        /** Setup up client to talk to server */
        var client = new svmpSocket.SvmpSocket();

        client.on('message', function (msg) {
            var r = svmp.protocol.parseResponse(msg);
            assert.strictEqual(r.type, 'AUTH');
            assert.strictEqual(r.authResponse.type, 0);
            done();
        });

        client.on('start', function () {
            client.sendRequest({
                type: 'AUTH',
                authRequest: {
                    type: 'AUTHENTICATION',
                    username: 'dave',
                    password: 'dave'
                }
            });
        });

        client.connect(PORT);
    });

});