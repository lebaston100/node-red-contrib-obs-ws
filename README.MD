# node-red-contrib-obs-ws

[Node-RED](https://nodered.org) nodes for interfacing with OBS via obs-websocket.

## Requirements
- OBS >= 28 with websocket enabled
- Node-Red >= 2.0.0
- NodeJS >= 18

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
For a complete documentation over the protocol itself look at the [obs-websocket protocol documentation](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md) or use the internal documentation button.

### Nodes

#### obs connection status
This node shows and outputs the OBS connection status.

#### obs event
This node outputs event messages based on the configured event type(s).

#### obs request
This node runs any obs-websocket request and returns it's result(which can be nothing) or error. Batch requests are supported too.

#### SetCurrentProgramScene
This node switches the scene in OBS.
To automatically fetch available scenes from OBS, make sure your OBS is running and you deployed the node at least once after adding it.

#### TriggerStudioModeTransition
This node triggers the transition to program action which will take the current preview scene to program.
By automatically sending 2 different requests before that it can optionally change the transition and set it's duration.
To automatically pull the available transition names from OBS, make sure OBS is connected and you deployed the node at least once after adding it.

### Example
An example flow is provided which can be simply added by using the import -> examples feature. It demonstrates all the available nodes with most of their different features.

### Troubleshooting and common errors

Some finer grained debug messages that might be helpful for troubleshooting are sent to the node-red trace log level.
To show those messages in the console/stdout change the logging.console.level inside node-red's "settings.js" to "trace" (Default will be "info").

If there is no connection to OBS:
- Check "Enable WebSocket server" is checked in OBS's WebSocket Server Settings window.
- If node-red is not running on the same machine as OBS: Check your firewall settings on both sides. Disable it for testing and try to connect again. If that works create a firewall exception.
- Check the ip/hostname and port are set correctly in the configuration node. There might be some edge cases where the ip shown inside the WebSocket Server Settings window is not the ip you need to use. Leave the default "127.0.0.1" when running on the same machine.
- Check the password is correctly set if Authentication is enabled. You will get a "OBS Authentication failed. Please check the password you set and redeploy." error in the node-red debug console, stdout and the obs-connection node will output a "AuthenticationFailure" message.

If requests fail:
- Load the example flow and check that any of the generic request examples work and make note of how the nodes are configured.
- Check the request name matches exactly with those from the [obs-websocket protocol documentation](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md).
- Check if you're not sending and of the required additional parameters and they are of the required data types.
- Enable "Enable Debug Logging" in the OBS WebSocket Server Settings and check the OBS log for additional details.

### Help

For help join the [Discord Server](https://discord.gg/PCYQJwX)

### Changelog

**1.2.2** (release)
- Update lists of requests and events

**1.2.1** (release)
- Added Troubleshooting section to the readme
- Catch and replace "Socket not identified" error message with "Error: Not connected." in obs request node
- Send request errors to node-red trace log channel

**1.2.0** (release)
- Update obs-websocket-js to 5.0.6
    - This change now requires at least Node 18

**1.1.0** (release)
- Update request types/events. (SplitRecordFile, CreateRecordChapter, RecordFileChanged)
- Fix jsonata in obs request
- Improve json string handling in obs request

**1.0.0** (release)
- Version bump only. It's been out and stable for long enough now.

**0.2.13** (release)
- Bumped obs-websocket-js to 5.0.5

**0.2.12** (release)
- Added new requests/events for obs-websocket 5.4.0
- Bumped obs-websocket-js to 5.0.4

**0.2.11** (release)
- Update jsonata handling to prepare for node-red v4.x and remove log spam by deprecation warning

**0.2.10** (hotfix-release)
- Fix node constantly reconnecting after an initial reconnect

**0.2.9** (release)
- Added websocket ping to detect (and attempt to reconnect) dead connections. Pings every 10 sec, times out after 21 sec.
- Bumped obs-websocket-js to 5.0.3

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
- Added multiselect to obs event node
- Added obs-websocket docs button to nodes where an event/request is used

**0.2.0** (dev-release)
- Rewrote large parts again to support OBS 28 which now ships with obs-websocket 5 by default.

**0.1.0** (release)
- Reworked ~70% of the code. First production ready release and listed on npm.

**This project is not affiliated with the OBS Project or obs-websocket**