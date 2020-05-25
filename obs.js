module.exports = function(RED) {
    "use strict"
    const OBSWebSocket = require("obs-websocket-js");

    var requestHandlers = [];

    //obs-websocket connection config node
    function WebsocketClientNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.warn("Booting up config node");
        node.host = config.host;
        node.port = config.port;
        node.password = node.credentials.password;
        node.tout = null;
        node.errorInConfig = 0;
        node.hasCloseListener = 0;
        node.connected = false;

        //Create connection object
        node.connectionsettings = {address: `${node.host}:${node.port}`};
        if (node.password) {
            node.connectionsettings.password = node.password;
        }

        //Create obs-websocket-js client instance and start connection
        node.trace("Creating obs-websocket-js client");
        node.obs = new OBSWebSocket();
        tryConnection();

        function tryConnection() {
            node.tout = null;
            node.trace("Trying to connect to obs");
            node.obs.connect(node.connectionsettings)
            .then(() => {
                node.trace("Success! We're connected to obs & authenticated.");
                node.hasCloseListener = 1;
                node.on("close", function(done) { //Tidy up
                    //Send heartbeat disable. Might be removed in the future not to break other connected apps.
                    node.obs.send("SetHeartbeat", {"enable": false}).then((err, data)=>{
                        node.connected = 0;
                        node.errorInConfig = 1; //Not really, just don"t want to add another flag
                        node.obs.disconnect();
                    });
                    if (done) done();
                });
                //Remove all HTTP Request Handlers
                removeAllOwnHandlers(node.id);
                //Get scenes from obs
                registerURLHandler(node.id, "scenes", (req, res, next) => {
                    universalOBSRequester("GetSceneList", res);
                });
                //Get special sources from obs
                registerURLHandler(node.id, "specialsources", (req, res, next) => {
                    universalOBSRequester("GetSpecialSources", res);
                });
                //Get transitions from obs
                registerURLHandler(node.id, "transitions", (req, res, next) => {
                    universalOBSRequester("GetTransitionList", res);
                });
                //Get profiles from obs
                registerURLHandler(node.id, "profiles", (req, res, next) => {
                    universalOBSRequester("ListProfiles", res);
                });
                //Get scene collections from obs
                registerURLHandler(node.id, "scenecollections", (req, res, next) => {
                    universalOBSRequester("ListSceneCollections", res);
                });
                //Tell other nodes that the obs connection was established (vs the raw websocket connection)
                node.emit("obsConnectionOpened");
            //This needs to be handeld more cleanly for the user
            }).catch(err => {				
                if (err.code == "CONNECTION_ERROR") {
                    if (!node.tout && !node.errorInConfig && !node.connected) {obsReconnector();}
                } else {
                    node.error(err);
                    node.errorInConfig = 1;
                }
            });
        }

        function obsReconnector() {
            node.tout = setTimeout(() => {tryConnection();}, 3000);
        }

        node.on("close", function() {
            if (!node.hasCloseListener) {
                node.errorInConfig = 1; //Not really, just don"t want to add another flag
                node.obs.disconnect();
            }
        });

        node.obs.on("error", err => {
            node.warn("websocket error", err);
        });

        node.obs.on("ConnectionOpened", () => {
            node.emit("ConnectionOpened");
            node.debug("ConnectionOpened");
            node.connected = 1;
            if (node.tout) {clearTimeout(node.tout);}
        });

        node.obs.on("ConnectionClosed", (data) => {
            node.emit("ConnectionClosed");
            node.debug("ConnectionClosed");
            if (!node.tout && !node.errorInConfig && node.connected) {
                node.debug("Starting Reconnector because ConnectionClosed");
                obsReconnector();
            }
            node.connected = 0;
        });

        node.obs.on("AuthenticationFailure", () => {
            node.error("OBS Authentication failed. Please check the password you set.");
            node.emit("AuthenticationFailure");
        });

        function universalOBSRequester(request, res) {
            node.obs.send(request).then(data => {
                res.json(data);
            }).catch(err => {
                node.error(JSON.stringify(err));
                //res.json([]);
                res.sendStatus(503);
            });
        }
    }

    RED.nodes.registerType("obs-instance", WebsocketClientNode, {
        credentials: {
            password: {type: "password"}
        }
    });

//////////////////////////////////////////////////////////////////////////////////////////////
    //HTTP Endpoint handler
    function registerURLHandler(nodeID, endpoint, callback) {
        let tempobject = {nodeID: nodeID, endpoint: endpoint, callback: callback}
        requestHandlers.push(tempobject);
    }

    function expressRequestHandler(req, res, next) {
        let answered = false;
        requestHandlers.forEach((item) => {
            if (req.params.id == item.nodeID && req.params.request == item.endpoint) {
                console.log("ID and Endpoint Matching, running callback");
                answered = true;
                item.callback(req, res, next);
            }
        });
        !answered && res.sendStatus(503);
    }

    function removeAllOwnHandlers(nodeID) {
        requestHandlers = requestHandlers.filter((value) => {
            return (value.nodeID == nodeID) ? false : true;
        });
    }

    RED.httpAdmin.get("/nr-contrib-obs-ws/:id/list/:request", function(req, res, next) {
        expressRequestHandler(req, res, next);
    });

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs-event node
    function obs_event(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.debug("Got server from config node");
            node.instance.obs.on(config.event, data => {
                node.send({payload: removeKebabCases(data)})
            });
        } else {
            this.warn("NO SERVER SPECIFIED");
        }
    }

    RED.nodes.registerType("obs-event", obs_event);

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs-heartbeat node
    function obs_heartbeat(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.debug("Got server from config node");
            node.instance.on("obsConnectionOpened", () => {
                node.instance.obs.send("SetHeartbeat", {"enable": true}).then(data => {
                    node.debug("Sent, subbing now to Heartbeat event");
                    node.instance.obs.on("Heartbeat", (data) => {
                        node.send({payload: removeKebabCases(data)});
                    });
                }).catch(err => {
                    node.warn(err);
                });
            });
        } else {
            node.warn("NO SERVER SPECIFIED");
        }
    }

    RED.nodes.registerType("obs-heartbeat", obs_heartbeat);

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs-connection-status node
    function obs_connection_status(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.debug("Got server from config node");
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
            node.status({fill:"grey", shape:"ring ", text:"No Server"});
        }
    }

    RED.nodes.registerType("obs-connection-status", obs_connection_status);

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs_no_req_data_request node
    function obs_no_req_data_request(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                node.instance.obs.send(config.request, {}).then(data => {
                    node.send({payload: removeKebabCases(data)});
                }).catch(err => {
                    done(err);
                });
                if (done) done();
            });
        }
    }

    RED.nodes.registerType("obs-no-req-data-request", obs_no_req_data_request);

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs_raw_request node
    function obs_raw_request(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                let prop = RED.util.evaluateNodeProperty(config.payload,config.payloadType,node,msg)
                if (typeof prop == "object") {
                    if (prop.hasOwnProperty("request-type") && prop["request-type"] !== "") {
                        let requestType = prop["request-type"];
                        delete prop.requestType;
                        node.instance.obs.send(requestType, prop).then(data => {
                            node.send([{payload: removeKebabCases(data)}, null]);
                            if (done) done();
                        }).catch(err => {
                            node.send([null, {payload: removeKebabCases(err)}]);
                            if (done) done();
                        });
                    } else {
                        if (done) done(`Object is missing the request-type field or field is empty.`);
                    }
                } else {
                    if (done) done(`Wrong data type. Needs to be a valid json object. Is: "${typeof prop}"`);
                }
            });
        }
    }

    RED.nodes.registerType("obs-raw-request", obs_raw_request);

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs_SetCurrentScene node
    function obs_SetCurrentScene(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                let dstScene = null;

                node.warn(JSON.stringify(config));

                if (config.sceneType == "msg" || config.sceneType == "flow" || config.sceneType == "global") {
                    RED.util.evaluateNodeProperty(config.scene, config.sceneType, this, msg, function(err,res) {
                        if (!err && typeof res !== "undefined") {
                            dstScene = res;
                        } else {
                            done(err);
                        }
                    });
                } else if (((config.sceneType == "str" || config.sceneType == "sceneName") && config.scene !== null && config.scene !== "")) {
                    dstScene = config.scene;
                } else {
                    done("Error in scene name");
                }

                if (dstScene) {
                    node.debug(`Destination scene: ${dstScene}`);
                    node.instance.obs.send("SetCurrentScene", {"scene-name": dstScene}).then(data => {
                        node.send({payload: removeKebabCases(data)});
                    }).catch(err => {
                        done(err);
                    });
                }

                if (done) done();
            });
        }
    }

    RED.nodes.registerType("SetCurrentScene", obs_SetCurrentScene);

//////////////////////////////////////////////////////////////////////////////////////////////
    //obs_TransitionToProgram node
    function obs_TransitionToProgram(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        node.instance = RED.nodes.getNode(config.obsInstance);
        if (node.instance) {
            node.on("input", function(msg, send, done) {
                console.log("----------------------");
                console.log(config.transitionType);
                console.log(config.transition);
                console.log(config.transitionTimeType);
                console.log(config.transitionTime);
                console.log("----------------------");
                
                let transitionData = {};
                if (config.transitionType == "msg" || config.transitionType == "flow" || config.transitionType == "global") {
                    RED.util.evaluateNodeProperty(config.transition, config.sceneType, this, msg, function(err,res) {
                        if (!err && typeof res !== "undefined") {
                            transitionData = {"with-transition": {"name": res}};
                        } else {
                            done(err);
                        }
                    });
                } else if ((config.transitionType == "str" || config.transitionType == "transition") && config.transition !== null && config.transition !== "") {
                    transitionData = {"with-transition": {"name": config.transition}};
                }

                if (config.transitionTimeType == "msg" || config.transitionTimeType == "flow" || config.transitionTimeType == "global") {
                    RED.util.evaluateNodeProperty(config.transitionTime, config.transitionTimeType, this, msg, function(err,res) {
                        if (!err && typeof res !== "undefined") {
                            transitionData["with-transition"].duration = parseInt(res);
                        } else {
                            done(err);
                        }
                    });
                } else if (config.transitionTimeType == "num") {
                    transitionData["with-transition"].duration = parseInt(config.transitionTime);
                }

                node.instance.obs.send("TransitionToProgram", transitionData).then(data => {
                    node.send({payload: removeKebabCases(data)});
                }).catch(err => {
                    done(err);
                });
                node.debug(`Transition: ${JSON.stringify(transitionData)}`);
                if (done) done();
            })
        }
    }

    RED.nodes.registerType("TransitionToProgram", obs_TransitionToProgram);
//////////////////////////////////////////////////////////////////////////////////////////////
    //Utils
    function removeKebabCases(obj) {
        for (const key in obj) {
            if (key.includes("-")) {
                delete obj[key];
            }
        }
        return obj;
    }
}