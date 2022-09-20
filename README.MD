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
This node outputs event messages based on the configured event type(s).

#### obs request
This node runs any obs-websocket request and returns it's result(which can be nothing) or error.

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

**0.1.0:** (release)
- Reworked ~70% of the code. First production ready release and listed on npm.

**0.2.0** (dev-release)
- Rewrote large parts again to support OBS 28 which now ships with obs-websocket 5 by default.

**0.2.1** (dev-release)
- Improved display name of raw request node
- Added request selection option to raw request node
- Added multiselect to obs-event node
- Added obs-websocket docs button to nodes where an event/request is used

**0.2.2** (dev-release)
- Further improved docs button
- Merged "obs request without data" and "obs raw request" nodes into a single "obs request node" (This will break many flows for users that upgrade but is better to change now then later)
- Reorganised nodes order in flow editor
- Removed old python tools and renamed+updated generateRequests.py

**This project is not affiliated with the OBS Project or obs-websocket**