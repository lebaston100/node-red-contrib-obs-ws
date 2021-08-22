/* jshint esversion: 9 */

module.exports = function(RED) {
    "use strict";
    const OBSWebSocket = require("obs-websocket-js");

    var requestHandlers = [];

    // obs-websocket connection config node
    function WebsocketClientNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.debug("Starting obs config node");
        node.host = config.host;
        node.port = config.port;
        node.password = node.credentials.password;
        node.tout = null;
        node.blockReconTry = false;

        // Create connection object
        node.connectionSettings = {address: `${node.host}:${node.port}`};
        if (node.password) node.connectionSettings.password = node.password;

        // Create obs-websocket-js client instance and start connection
        node.trace("Creating obs-websocket-js client");
        node.obs = new OBSWebSocket();
        tryConnection();

        function tryConnection() {
            node.tout = null;
            node.trace("Trying to connect to obs");
            node.obs.connect(node.connectionSettings)
                .then(() => {
                    node.trace("Connected (and authenticated) to obs");

                    // Remove all HTTP Request Handlers
                    removeAllOwnHandlers(node.id);
                    // Get scenes from obs
                    registerURLHandler(node.id, "scenes", (req, res) => {
                        universalOBSRequester("GetSceneList", res);
                    });
                    // Get special sources from obs (unused)
                    /*registerURLHandler(node.id, "specialsources", (req, res) => {
                        universalOBSRequester("GetSpecialSources", res);
                    });*/
                    // Get transitions from obs
                    registerURLHandler(node.id, "transitions", (req, res) => {
                        universalOBSRequester("GetTransitionList", res);
                    });
                    // Get profiles from obs (unused)
                    /*registerURLHandler(node.id, "profiles", (req, res) => {
                        universalOBSRequester("ListProfiles", res);
                    });*/
                    // Get scene collections from obs (unused)
                    /*registerURLHandler(node.id, "scenecollections", (req, res) => {
                        universalOBSRequester("ListSceneCollections", res);
                    });*/
                    // Tell other nodes that the obs connection was established (vs the raw websocket connection)
                    node.emit("obsConnectionOpened");
                }).catch(err => {
                    if (err.code !== "CONNECTION_ERROR") {
                        node.error(err);
                        node.blockReconTry = true; // Block reconnect until next redeploy because something is very wrong anways
                    }
                    // Non-CONNECTION_ERROR will be handled by the ConnectionClosed handler
                });
        }

        function obsReconnector() {
            node.tout = setTimeout(() => {tryConnection();}, 3000);
        }

        node.on("close", function(done) {
            node.debug("closing node, cleaning up");
            if (node.tout) clearTimeout(node.tout); // Just to make sure
            node.obs.removeAllListeners("ConnectionClosed");
            node.obs.disconnect();
            done();
        });

        node.obs.on("error", err => {
            node.warn("websocket error", err);
        });

        node.obs.on("ConnectionOpened", () => {
            node.emit("ConnectionOpened");
            node.debug("ConnectionOpened obs event");
            if (node.tout) clearTimeout(node.tout); // Just to make sure
        });

        node.obs.on("ConnectionClosed", () => {
            node.emit("ConnectionClosed");
            node.debug("ConnectionClosed obs event");
            if (!node.tout && !node.blockReconTry) {
                node.debug("Starting Reconnector because ConnectionClosed obs event");
                obsReconnector();
            }
        });

        node.obs.on("AuthenticationFailure", () => {
            node.error("OBS Authentication failed. Please check the password you set.");
            node.emit("AuthenticationFailure");
        });

        function universalOBSRequester(request, res) {
            node.obs.send(request)
                .then(data => {
                    res.json(data);
                }).catch(() => {
                    res.sendStatus(503);
                });
        }
    }

    RED.nodes.registerType("obs-instance", WebsocketClientNode, {
        credentials: {
            password: {
                type: "password"
            }
        }
    });

//////////////////////////////////////////////////////////////////////////////////////////////
    // HTTP endpoint handler
    RED.httpAdmin.get("/nr-contrib-obs-ws/:id/list/:request", function(req, res, next) {
        expressRequestHandler(req, res, next);
    });

    function expressRequestHandler(req, res, next) {
        let answered = false;
        requestHandlers.forEach(item => {
            if (req.params.id === item.nodeID && req.params.request === item.endpoint) {
                answered = true;
                item.callback(req, res, next);
            }
        });
        !answered && res.sendStatus(503);
    }

    function registerURLHandler(nodeID, endpoint, callback) {
        requestHandlers.push({nodeID: nodeID, endpoint: endpoint, callback: callback});
    }

    function removeAllOwnHandlers(nodeID) {
        requestHandlers = requestHandlers.filter(value => {
            return (value.nodeID === nodeID) ? false : true;
        });
    }

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs event node
    function obs_event(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.instance.obs.on(config.event, data => {
                node.send({payload: removeKebabCases(data)});
            });
        }
    }
    RED.nodes.registerType("obs event", obs_event);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs heartbeat node
    function obs_heartbeat(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.instance.on("obsConnectionOpened", () => {
                node.instance.obs.send("SetHeartbeat", {"enable": true})
                .then(() => {
                    node.debug("Subbing now to Heartbeat event");
                    node.instance.obs.on("Heartbeat", data => {
                        node.send({payload: removeKebabCases(data)});
                    });
                    node.on("close", function(removed, done) {
                        if (removed) {
                            node.obs.send("SetHeartbeat", {"enable": false})
                                .then(() => {return;})
                                .catch(err => {
                                    node.warn(err);
                                });
                        }
                        done();
                    });
                }).catch(err => {
                    node.warn(err);
                });
            });
        }
    }
    RED.nodes.registerType("obs heartbeat", obs_heartbeat);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs connection status node
    function obs_connection_status(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.instance.on("ConnectionOpened", function () {
                node.status({fill:"green", shape:"dot", text:"connected"});
                node.send({payload: "connected"});
            });
            node.instance.on("ConnectionClosed", function () {
                node.status({fill:"red", shape:"dot", text:"disconnected"});
                node.send({payload: "disconnected"});
            });
            node.instance.on("AuthenticationFailure", function () {
                node.status({fill:"red", shape:"dot", text:"Authentication Failure"});
                node.send({payload: "AuthenticationFailure"});
            });
        } else {
            node.status({fill:"grey", shape:"ring ", text:"no server"});
        }
    }
    RED.nodes.registerType("obs connection status", obs_connection_status);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_request_without_data node
    function obs_request_without_data(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                node.instance.obs.send(config.request, {})
                .then(data => {
                    node.send({...msg, payload: removeKebabCases(data)});
                }).catch(err => {
                    done(err.error);
                });
                done();
            });
        }
    }
    RED.nodes.registerType("obs request without data", obs_request_without_data);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_raw_request node
    function obs_raw_request(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                let prop = RED.util.evaluateNodeProperty(config.payload, config.payloadType, node, msg);
                if (typeof prop === "object") {
                    if (Object.prototype.hasOwnProperty.call(prop, "request-type") && prop["request-type"] !== "") {
                        let requestType = prop["request-type"];
                        delete prop.requestType;
                        node.instance.obs.send(requestType, prop)
                        .then(data => {
                            node.send([{...msg, payload: removeKebabCases(data)}, null]);
                            done();
                        }).catch(err => {
                            node.send([null, {...msg, payload: removeKebabCases(err)}]);
                            done();
                        });
                    } else {
                        done(`Object is missing the "request-type" field or field is empty.`);
                    }
                } else {
                    done(`Wrong data type. Needs to be a valid json object. Is: "${typeof prop}"`);
                }
            });
        }
    }
    RED.nodes.registerType("obs raw request", obs_raw_request);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_SetCurrentScene node
    function obs_SetCurrentScene(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                let dstScene = null;

                if (["msg", "flow", "global"].includes(config.sceneType)) {
                    dstScene = RED.util.evaluateNodeProperty(config.scene, config.sceneType, node, msg);
                } else if (["str", "sceneName"].includes(config.sceneType) && config.scene !== null && config.scene !== "") {
                    dstScene = config.scene;
                } else if (config.sceneType === "jsonata") {
                    try { // Handle this more cleanly then the others for better UX
                        dstScene = RED.util.evaluateJSONataExpression(RED.util.prepareJSONataExpression(config.scene, node), msg);
                    } catch (e) {
                        done(`Invalid JSONata expression: ${e.message}`);
                        return;
                    }
                }

                if (dstScene) {
                    node.trace(`parsed destination scene: ${dstScene}`);
                    node.instance.obs.send("SetCurrentScene", {"scene-name": RED.util.ensureString(dstScene)})
                    .then(data => {
                        node.send({...msg, payload: removeKebabCases(data)});
                    }).catch(err => {
                        done(err.error);
                    });
                } else {
                    done("Error in scene name");
                }
                done();
            });
        }
    }
    RED.nodes.registerType("SetCurrentScene", obs_SetCurrentScene);

//////////////////////////////////////////////////////////////////////////////////////////////
    // obs_TransitionToProgram node
    function obs_TransitionToProgram(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                let transitionData = {};

                // Parse the optional transition name
                if (["msg", "flow", "global"].includes(config.transitionType)) {
                    let transitionName = RED.util.evaluateNodeProperty(config.transition, config.transitionType, node, msg);
                    transitionData = {"with-transition": {"name": transitionName}};
                } else if (["str", "transition"].includes(config.transitionType) && config.transition !== null && config.transition !== "") {
                    transitionData = {"with-transition": {"name": config.transition}};
                }

                // Parse the optional transition duration
                if (config.transitionType !== "none") {
                    if (["msg", "flow", "global"].includes(config.transitionTimeType)) {
                        let transitionDuration = RED.util.evaluateNodeProperty(config.transitionTime, config.transitionTimeType, node, msg);
                        transitionData["with-transition"].duration = Math.abs(parseInt(transitionDuration));
                    } else if (config.transitionTimeType === "num") {
                        transitionData["with-transition"].duration = Math.abs(parseInt(config.transitionTime));
                    } else if (config.transitionTimeType === "jsonata") {
                        try { // Handle this more cleanly then the others for better UX
                            let duration = RED.util.evaluateJSONataExpression(RED.util.prepareJSONataExpression(config.transitionTime, node), msg);
                            transitionData["with-transition"].duration = Math.abs(parseInt(duration));
                        } catch (e) {
                            done(`Invalid JSONata expression: ${e.message}`);
                            return;
                        }
                    }
                }

                node.instance.obs.send("TransitionToProgram", transitionData)
                .then(data => {
                    node.send({...msg, payload: removeKebabCases(data)});
                }).catch(err => {
                    done(err.error);
                });
                node.trace(`transitionData: ${JSON.stringify(transitionData)}`);
                done();
            });
        }
    }
    RED.nodes.registerType("TransitionToProgram", obs_TransitionToProgram);

//////////////////////////////////////////////////////////////////////////////////////////////
    // utils
    function removeKebabCases(obj) {
        for (const key in obj) {
            if (key.includes("-")) {
                delete obj[key];
            }
        }
        return obj;
    }
};