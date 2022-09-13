# node-red-contrib-obs-ws

[Node-RED](https://nodered.org) nodes for interfacing with obs via obs-websocket.  
Provides mostly the framework for the connection with 2 requests fully implemented. Connections are managed by a shared config node which means you can control an unlimited amount™ of different obs instances.

## Install

You have 3 choices to install the nodes.
1. Use the Palette Manager in the Node-RED Menu. Just go to the "Install" tab and search for the full package name (simplest)
2. Run `npm install node-red-contrib-obs-ws` from within your .node-red folder
3. Manual install, see below

Don't forget to restart node-red after installing.

Manual install:
- Download the ZIP or clone the repo
- Extract it somewhere if you got the ZIP
- Open a command line and cd into your local .node-red folder
- run "npm install /path/to/extracted/folder"

## Use

Basic node-red usage is expected as basic knowledge. All nodes are documented inside the internal node-red node help tool with a little more detail.  
For a complete documentation over the messages that can be used, look at the [obs-websocket protocol documentation](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md).  
Only obs-websocket versions >= 5 are supported aka OBS 28 and up.

### Nodes

#### obs connection status
This node shows and outputs the obs connection status.

#### obs event
This node outputs event messages based on the configured event type.

#### obs request without data
his node runs a obs-websocket request that does not need any custom arguments and outputs it's result.

#### obs raw request
This node runs any obs-websocket request and returns it's result or error.

#### SetCurrentProgramScene
This node switches the scene in obs.  
To automatically fetch available scenes from obs, make sure your obs is running and you deployed the node at least once after adding it.

#### TriggerStudioModeTransition
This node triggers the transition to program action which will take the current preview scene to program.
By automatically sending 2 different requests before that it can optionally change the transition and set it's duration.
To automatically pull the available transition names from obs, make sure obs is connected and you deployed the node at least once after adding it.

### Example
An example flow is provided which can be simply added by using the import -> examples feature. It demonstrates all the available nodes with most of their different features.

### Changelog

**0.1.0:**
Reworked ~70% of the code. First production ready release and finally listed on npm.

**0.2.0**
Rewrote large parts again to support OBS 28 which now ships with obs-websocket 5 by default.

**This project is not affiliated with the OBS Project or obs-websocket**