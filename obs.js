/* jshint esversion: 9 */

module.exports = function(RED) {
    "use strict";
    const OBSWebSocket = require('obs-websocket-js').default;
    const { EventSubscription, RequestBatchExecutionType } = require('obs-websocket-js');

    // obs-websocket config node
    function ObsWebsocketClientNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.trace("Starting obs config node");
        node.requestHandlers = [];
        node.host = config.host;
        node.port = config.port;
        node.password = node.credentials.password;
        node.tout = null;
        node.pingSender = null;
        node.lastPong = 0;
        node.identified = false;
        node.requestsInFlight = 0;
        node.eventSubs = {
            All: 1 // Name: Refcount
        };

        // Create connection object
        node.connectionSettings = {rpcVersion: 1};

        // Create obs-websocket-js client instance and start connection
        node.trace("Creating obs-websocket-js client");
        node.obs = new OBSWebSocket();
        tryConnection();

        async function tryConnection() {
            node.tout = null;
            node.trace("Trying to connect to obs");
            try {
                let con = await node.obs.connect(`ws://${node.host}:${node.port}`, node.password, node.connectionSettings);
                node.trace(JSON.stringify(con)); // Response from obs-ws which version it's running
                node.trace("Connected (and authenticated) to obs");

                // Remove all HTTP Request Handlers
                node.requestHandlers = [];
                // Get scenes from obs
                registerURLHandler("scenes", () => universalOBSRequester("GetSceneList"));
                // Get transitions from obs
                registerURLHandler("transitions", () => universalOBSRequester("GetSceneTransitionList"));
            } catch(err) {
                // Nothing, stuffs handled elsewhere
            }
        }

        function obsReconnector() {
            node.tout = setTimeout(tryConnection, 3000);
        }

        // node-red node closing
        node.on("close", async function(done) {
            node.trace("closing node, cleaning up");
            if (node.tout) clearTimeout(node.tout); // remove remaining reconnect timer if any
            if (node.pingSender) clearInterval(node.pingSender);
            node.obs.removeAllListeners("ConnectionClosed"); // don't handle disconnect event like normally
            setTimeout(() => ensureAllDone(done), 5);
        });

        async function ensureAllDone(done) {
            if (node.requestsInFlight <= 0) {
                node.trace("Requests are all done, disconnecting and closing node now")
                await node.obs.disconnect();
                node.identified = false;
                done();
            } else {
                setTimeout(() => ensureAllDone(done), 5);
            }
        }

        node.obs.on("ConnectionOpened", () => {
            node.emit("ConnectionOpened");
            node.trace("ConnectionOpened obs event");
            if (node.tout) clearTimeout(node.tout); // Just to make sure
        });

        node.obs.on("ConnectionClosed", err => {
            node.emit("ConnectionClosed");
            node.trace("ConnectionClosed obs event");
            node.trace(err);
            node.identified = false;
            if (node.pingSender) clearInterval(node.pingSender);

            if (err.code && err.code == 4009) {
                node.error("OBS Authentication failed. Please check the password you set and redeploy.");
                node.emit("AuthenticationFailure");
                return; // don't even try to connect again
            }

            if (!node.tout) {
                node.trace("Starting obsReconnector because ConnectionClosed event");
                obsReconnector();
            }
        });

        node.obs.on("Identified", async () => {
            node.trace("Identified obs event");
            // We need this for EventSubscription handling
            node.identified = true;
            await node.obs.reidentify(getEventSubs());

            // send PING frames on the regular and disconnect if no PONG frames received
            node.lastPong = Date.now();
            node.pingSender = setInterval(() => {
                node.trace("Sending ping frame");
                node.obs.socket.ping();
                if (Date.now() - node.lastPong > 21000) node.obs.disconnect();
            }, 10000);
            node.obs.socket.on("pong", () => {
                node.trace("Recv websocket pong frame");
                node.lastPong = Date.now();
            });
        });

        async function universalOBSRequester(request) {
            node.requestsInFlight += 1;
            let data = null;
            try {
                data = await node.obs.call(request);
            } catch (err) {}
            node.requestsInFlight -= 1;
            return data;
        }

        // Register new event subscriptions
        node.registerEventsub = async function (subs) {
            let reidentifyNeeded = false;
            if (!Array.isArray(subs)) subs = [subs];

            for (const i in subs) {
                const sub = subs[i];
                if (node.eventSubs.hasOwnProperty(sub)) {
                    node.eventSubs[sub] += 1;
                } else {
                    node.eventSubs[sub] = 1;
                    reidentifyNeeded = true;
                }
            }

            // Only send reidentify once
            if (reidentifyNeeded) {
                node.requestsInFlight += 1;
                try {
                    if (node.identified) await node.obs.reidentify(getEventSubs());
                } catch (err) {
                    node.error(err);
                }
                node.requestsInFlight -= 1;
            }

            node.trace(JSON.stringify(node.eventSubs));
        }

        // Unregister event subscriptions
        node.unRegisterEventsub = async function (subs) {
            let reidentifyNeeded = false;
            if (!Array.isArray(subs)) subs = [subs];

            for (const i in subs) {
                const sub = subs[i];
                if (node.eventSubs.hasOwnProperty(sub)) {
                    node.eventSubs[sub] -= 1;
                    if (node.eventSubs[sub] == 0) {
                        node.trace(`EventSubscription ${sub} reached 0, deleting and unregistering`)
                        delete node.eventSubs[sub];
                        reidentifyNeeded = true;
                    }
                } else {
                    node.error("Event subcription is not there. Was it registered?");
                }
            }

            // Only send reidentify once
            if (reidentifyNeeded) {
                node.requestsInFlight += 1;
                try {
                    if (node.identified) await node.obs.reidentify(getEventSubs());
                } catch (err) {
                    node.error(err);
                }
                node.requestsInFlight -= 1;
            }
        }

        // Internal function to resolve my event sub object to something obs-websocket can understand
        function getEventSubs() {
            let subs = 0;
            for (const sub in node.eventSubs) {
                subs = subs | EventSubscription[sub];
            }
            return {eventSubscriptions: subs};
        }

        function registerURLHandler(endpoint, callback) {
            node.requestHandlers.push({endpoint: endpoint, callback: callback});
        }
    }

    RED.nodes.registerType("obs-instance", ObsWebsocketClientNode, {
        credentials: {
            password: {
                type: "password"
            }
        }
    });

//////////////////////////////////////////////////////////////////////////////////////////////
    // HTTP endpoint handler
    RED.httpAdmin.get("/nr-contrib-obs-ws/:id/list/:endpoint", expressRequestHandler);

    async function expressRequestHandler(req, res) {
        let node = RED.nodes.getNode(req.params.id);
        if (node) {
            let handler = node.requestHandlers.find(rh => req.params.endpoint == rh.endpoint);
            if (handler) {
                let data = await handler.callback();
                if (data) {
                    res.json(data);
                    return;
                }
            }
        }
        res.sendStatus(503);
    }

//////////////////////////////////////////////////////////////////////////////////////////////
    // Helper function to make evaluateJSONataExpression awaitable for node-red >= 4.x
    const asyncEvaluateJSONataExpression = (expression, msg) => {
        return new Promise((resolve, reject) => {
            RED.util.evaluateJSONataExpression(expression, msg, (err, data) => {
                if (err) return reject(err);
                resolve(data);
            });
        })
      }

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs connection status node
    function obs_connection_status(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.c = RED.nodes.getNode(config.obsInstance);
        if (node.c) {
            node.c.on("ConnectionOpened", function () {
                node.status({fill:"orange", shape:"dot", text:"ConnectionOpened"});
                node.send({payload: "ConnectionOpened"});
            });
            node.c.on("ConnectionClosed", function () {
                node.status({fill:"red", shape:"dot", text: "ConnectionClosed"});
                node.send({payload: "ConnectionClosed"});
            });
            node.c.on("AuthenticationFailure", function () {
                node.status({fill:"red", shape:"dot", text: "AuthenticationFailure"});
                node.send({payload: "AuthenticationFailure"});
            });
            node.c.obs.on("Identified", function () {
                node.status({fill:"green", shape:"dot", text:"Identified"});
                node.send({payload: "Identified"});
            });
        } else {
            node.status({fill:"grey", shape:"ring ", text:"no server"});
        }
    }
    RED.nodes.registerType("obs connection status", obs_connection_status);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs event node
    function obs_event(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.c = RED.nodes.getNode(config.obsInstance);
        if (node.c) {
            let requestedEvents = config.event.split(",");
            let requestedHighVolumeEvents = [];
            // check if is high volume event and update sub manager
            for (const eventName in requestedEvents) {
                const event = requestedEvents[eventName];

                if (Object.keys(EventSubscription).includes(event)) requestedHighVolumeEvents.push(event);

                // Register obs event listener
                node.c.obs.on(event, data => {
                    node.send({topic: event, payload: data});
                });
            }

            // Handle high volume event reg and unreg
            if (requestedHighVolumeEvents.length) {
                node.trace(`${requestedHighVolumeEvents} ${requestedHighVolumeEvents.length>1 ? "are high volume events" : "is a high volume event"}. Updating event reg.`);
                setTimeout(async () => {
                    await node.c.registerEventsub(requestedHighVolumeEvents);
                }, 1);

                // node-red node closing we need to handle in this case
                node.on("close", async (done) => {
                    await node.c.unRegisterEventsub(requestedHighVolumeEvents);
                    node.trace("Done closing event node instance");
                    done();
                });
            }
        }
    }
    RED.nodes.registerType("obs event", obs_event);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_request node
    function obs_request(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.c = RED.nodes.getNode(config.obsInstance);
        node.obsRequests = [];
        node.batchOptions = {};
        node.isBatch = false;

        // If still on old config convert to new config
        // Dear user, please update all your nodes! Please! I'll probably remove this in a future release
        if (config.requests === undefined) {
            config.requests = [{
                rt: config.reqType,
                rtt: config.reqTypeType,
                rd: config.reqData,
                rdt: config.reqDataType
            }];
        }

        if (node.c) {
            node.on("input", async function(msg, send, done) {
                // Check and set batch options
                node.isBatch = config.requests.length !== 1;
                if (node.isBatch && config.batchExecutionType && "haltOnFailure" in config) {
                    node.batchOptions.executionType = RequestBatchExecutionType[config.batchExecutionType];
                    node.batchOptions.haltOnFailure = config.haltOnFailure;
                }

                node.obsRequests = [];
                node.parserErrors = [];
                // Check for manual batch request in payload
                if (!config.requests.length && Array.isArray(msg.payload)) {
                    if (msg.payload.every(r => "requestType" in r && "requestData" in r)) {
                        node.obsRequests = msg.payload;
                    } else {
                        node.parserErrors.push({err: "requestType and/or requestData is missing in at least one of your array elements"});
                    }
                } else {
                    config.requests.forEach(async function(r, i) {
                        var requestType;
                        try {
                            requestType = RED.util.evaluateNodeProperty(r.rt, r.rtt, node, msg);
                        } catch(err) {
                            node.parserErrors.push({position: i, err: err.toString(), stack: err.stack, requestType: r.rt, requestTypeType: r.rtt});
                        }

                        var requestData;
                        // jsonata is special, ugh
                        if (r.rdt == "jsonata") {
                            try {
                                requestData = await asyncEvaluateJSONataExpression(RED.util.prepareJSONataExpression(r.rd, node), msg);
                            } catch(err) {
                                node.parserErrors.push({position: i, err: `${err.message}: token '${err.token}' @ position ${err.position}`, stack: err.stack, requestData: r.rd, requestDataType: r.rdt});
                            }
                        } else {
                            try {
                                requestData = RED.util.evaluateNodeProperty(r.rd, r.rdt, node, msg);
                            } catch(err) {
                                node.parserErrors.push({position: i, err: err.toString(), stack: err.stack, requestData: r.rd, requestDataType: r.rdt});
                            }
                        }

                        if (typeof requestType == "string" &&  (typeof requestData == "string" || typeof requestData == "object")) {
                            if (typeof requestData == "string") requestData = {};
                            node.obsRequests.push({requestType: requestType, requestData: requestData});
                        } else {
                            node.parserErrors.push({position: i, err: `Wrong data types in request.\nData types currently: Request Type: '${typeof requestType}'; `
                                + `Request Data: '${typeof requestData}'.\nData types needed:  Request Type: 'string'; Request Data: 'object'`});
                        }
                    });
                }

                // Send error done if there were errors
                // Only output obs-websocket errors on the error out port, report internal (parser) errors via done(err) only
                if (node.parserErrors.length) {
                    done(JSON.stringify(node.parserErrors, null, 2));
                    return; // No request to obs will be made
                }

                // Handle all the obs request stuff
                try {
                    let response;
                    let responseMsgs = [null, null];
                    if (node.isBatch) {
                        // Make obs batch request
                        response = await node.c.obs.callBatch(node.obsRequests, node.batchOptions);

                        // If at least one request was successfull, return result
                        if (Array.isArray(response) && response.some(ret => ret.requestStatus.result)) {
                            responseMsgs[0] = {...msg, payload: response};
                        }

                        // Check if there were any errors and if so add them to return
                        let err = response.filter(ret => !ret.requestStatus.result);
                        if (err.length) responseMsgs[1] = {...msg, payload: err};
                    } else {
                        // Make non-batch obs request
                        response = await node.c.obs.call(node.obsRequests[0].requestType, node.obsRequests[0].requestData);
                        responseMsgs[0] = {...msg, payload: response};
                    }
                    send(responseMsgs);
                } catch(err) {
                    send([null, {...msg, payload: err}]);
                }
                done();
            });
        }
    }
    RED.nodes.registerType("obs request", obs_request);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_SetCurrentProgramScene node
    function obs_SetCurrentProgramScene(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.c = RED.nodes.getNode(config.obsInstance);
        if (node.c) {
            node.on("input", async function(msg, send, done) {
                let sceneName = null;

                // Parse scene name
                if (["msg", "flow", "global", "str", "sceneName"].includes(config.sceneType)) {
                    sceneName = RED.util.evaluateNodeProperty(config.scene, config.sceneType, node, msg)
                } else if (config.sceneType === "jsonata") {
                    try { // Handle this more cleanly then the others for better UX
                        sceneName = await asyncEvaluateJSONataExpression(RED.util.prepareJSONataExpression(config.scene, node), msg);
                    } catch (e) {
                        done(`Invalid JSONata expression: ${e.message}`);
                        return;
                    }
                }

                if (typeof sceneName !== "string") {
                    done(`Scene name data type is invalid. Want: string; Has: ${typeof sceneName}`);
                    return;
                }

                if (sceneName) {
                    try {
                        await node.c.obs.call("SetCurrentProgramScene", {"sceneName": sceneName});
                        send({...msg, payload: sceneName});
                        done();
                    } catch(err) {
                        done(err);
                    }
                }
            });
        }
    }
    RED.nodes.registerType("SetCurrentProgramScene", obs_SetCurrentProgramScene);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_TriggerStudioModeTransition node
    function obs_TriggerStudioModeTransition(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.c = RED.nodes.getNode(config.obsInstance);
        if (node.c) {
            node.on("input", async function(msg, send, done) {
                let transitionName = null;
                let transitionDuration = null;

                // Parse transition name
                if (["transition", "msg", "flow", "global"].includes(config.transitionType)) {
                    transitionName = RED.util.evaluateNodeProperty(config.transition, config.transitionType, node, msg);
                } else if (["str"].includes(config.transitionType) && config.transition !== null && config.transition !== "") {
                    transitionName = config.transition;
                }

                // Parse the optional transition duration
                if (config.transitionType !== "none" && config.transitionTimeType !== "none") {
                    if (["msg", "flow", "global"].includes(config.transitionTimeType)) {
                        transitionDuration = RED.util.evaluateNodeProperty(config.transitionTime, config.transitionTimeType, node, msg);
                    } else if (config.transitionTimeType === "num") {
                        transitionDuration = Math.abs(parseInt(config.transitionTime));
                    } else if (config.transitionTimeType === "jsonata") {
                        try { // Handle this more cleanly then the others for better UX
                            transitionDuration = await asyncEvaluateJSONataExpression(RED.util.prepareJSONataExpression(config.transitionTime, node), msg);
                        } catch (e) {
                            done(`Invalid JSONata expression: ${e.message}`);
                            return;
                        }
                    }
                    transitionDuration = Math.abs(parseInt(transitionDuration));
                }

                try {
                    let reqs = []
                    if (transitionName) reqs.push({requestType: "SetCurrentSceneTransition", requestData: {"transitionName": String(transitionName)}});
                    if (transitionDuration) reqs.push({requestType: "SetCurrentSceneTransitionDuration", requestData: {"transitionDuration": transitionDuration}});
                    reqs.push({requestType: "TriggerStudioModeTransition"});
                    await node.c.obs.callBatch(reqs);
                    send({...msg});
                    done();
                } catch(err) {
                    done(err);
                }
            });
        }
    }
    RED.nodes.registerType("TriggerStudioModeTransition", obs_TriggerStudioModeTransition);
};