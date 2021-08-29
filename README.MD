# node-red-contrib-obs-ws

[Node-RED](https://nodered.org) nodes for interfacing with obs via obs-websocket.  
Provides mostly the framework for the connection with 2 requests fully implemented. Connections are managed by a shared config node which means you can control an unlimited amount of different obs instances.

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
For a complete documentation over the messages that can be used, look at the [obs-websocket protocol documentation](https://github.com/Palakis/obs-websocket/blob/4.x-current/docs/generated/protocol.md).  
Only obs-websocket versions < 5.0.0 are supported at the time.

### Nodes

#### obs event
This node outputs the obs-websocket events of the selected event type.

#### obs heartbeat
This node outputs the obs-websocket heartbeat [event message](https://github.com/Palakis/obs-websocket/blob/4.x-current/docs/generated/protocol.md#heartbeat) which has some usefull stats every 2 seconds.

#### obs connection status
This node shows the obs connection status and outputs it as a simple string.

#### obs request without data
This node runs an obs-websocket request that does not need any custom arguments and outputs it's result.

#### obs raw request
This node runs any obs-websocket request and outputs it's result.

#### SetCurrentScene
This node switches the scene in obs.  
To automatically pull the available scene names from obs, make sure obs is connected and you deployed the node at least once.

#### TransitionToProgram
This node triggers the transition to program action which will take the current preview scene to program.  
It's the same action that happens in obs when pressing the "Transition" button in studio mode.  
To automatically pull the available scene names from obs, make sure obs is connected and you deployed the node at least once.

### Example
An example flow (that is also used for development) is provided which can be simply added by using the import -> examples feature. It demonstrates all the available nodes with their most of their different features.

### Changelog

**0.1.0:**  
Reworked ~70% of the code. First production ready release and finally listed on npm.

**This project is not affiliated with the OBS Project or obs-websocket**