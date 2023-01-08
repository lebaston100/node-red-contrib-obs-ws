# node-red-contrib-obs-ws

[Node-RED](https://nodered.org) nodes for interfacing with OBS via obs-websocket.

## Requirements
- OBS 28 with websocket enabled or OBS 27 with obs-websocket 5.0.1 plugin
- Node-Red >= 2.0.0
- NodeJS >= 14

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
For a complete documentation over the protocol look at the [obs-websocket protocol documentation](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) or use the internal documentation button.

### Nodes

#### obs connection status
This node shows and outputs the obs connection status.

#### obs event
This node outputs event messages based on the configured event type(s).

#### obs request
This node runs any obs-websocket request and returns it's result(which can be nothing) or error. Batch requests are supported too.

#### SetCurrentProgramScene
This node switches the scene in obs.  
To automatically fetch available scenes from obs, make sure your obs is running and you deployed the node at least once after adding it.

#### TriggerStudioModeTransition
This node triggers the transition to program action which will take the current preview scene to program.
By automatically sending 2 different requests before that it can optionally change the transition and set it's duration.
To automatically pull the available transition names from obs, make sure obs is connected and you deployed the node at least once after adding it.

### Example
An example flow is provided which can be simply added by using the import -> examples feature. It demonstrates all the available nodes with most of their different features.

### Help

For help join the [Discord Server](https://discord.gg/PCYQJwX)

### Changelog

**0.2.8** (release)
- Update Events List

**0.2.7** (release)
- See changelog entry below

**0.2.5/.6** (dev-release)
- Refactored obs request node to support batch requests (node still backwards compatible to 0.2.x<5)
- Refactored internal http api handling
- Improved scene/transition request behaviour
- Added autocomplete to SetCurrentProgramScene and TriggerStudioModeTransition nodes

**0.2.4** (release)
- Migrated TriggerStudioModeTransition to websocket batch request

**0.2.3** (release)
- OBS 28 / obs-websocket 5 compatibility
- Merged "obs request without data" and "obs raw request" nodes into a single "obs request" node (Breaking change!)
- Autocomplete of text fields where usefull
- Documentation button and updated internal node documentation
- Updated example flow
- Partialy improved code quality

**0.2.2** (dev-release)
- Further improved docs button
- Merged "obs request without data" and "obs raw request" nodes into a single "obs request node" (This will break many flows for users that upgrade but is better to change now then later)
- Reorganised nodes order in flow editor
- Removed old python tools and renamed+updated generateRequests.py

**0.2.1** (dev-release)
- Improved display name of raw request node
- Added request selection option to raw request node
- Added multiselect to obs-event node
- Added obs-websocket docs button to nodes where an event/request is used

**0.2.0** (dev-release)
- Rewrote large parts again to support OBS 28 which now ships with obs-websocket 5 by default.

**0.1.0** (release)
- Reworked ~70% of the code. First production ready release and listed on npm.

**This project is not affiliated with the OBS Project or obs-websocket**