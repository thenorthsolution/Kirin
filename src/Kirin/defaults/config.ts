export default `
defaultServerConfig:
  printToConsole: false
  displayPingErrors: false
  stopServerOnExit: true
  stopSignal: 'SIGTERM'
  start:
    enabled: true
    addButton: true
    allowedPermissions: []
    allowedRoles: []
  stop:
    enabled: true
    addButton: true
    allowedPermissions: []
    allowedRoles: []
  restart:
    enabled: true
    addButton: true
    allowedPermissions: []
    allowedRoles: []
  pingOptions:
    pingIntervalMs: 5000
    pingTimeoutMs: 5000
    zeroMaxMeansOffline: true

onlineServersLimit: 0
deleteDisabledButtons: true
messages:
  starting: 'Starting **{0}**'
  stopping: 'Stopping **{0}**'
  restarting: 'Restarting **{0}**'
  notRunning: '**{0}** is not running'
  serverNotFound: 'Server **{0}** not found'
  canNotStop: 'Unable to stop **{0}**'
  alreadyRunning: '**{0}** is already started'
  startFailed: 'Failed to start **{0}**'
  deleted: '**{0}** does not exists anymore'
  onlineServersLimitReached: 'Online servers limit reached'
  menuPlaceholder: 'Actions'
  menuStartOption: 'Start'
  menuStopOption: 'Stop'
  menuRestartOption: 'Restart'
  embedButtonStart: 'Start'
  embedButtonStop: 'Stop'
  embedButtonRestart: 'Restart'
  embedPlayerCount: '**{0}**/**{1}** players'
  onlineEmbedColor: 'GREEN'
  onlineEmbedStatus: 'Online'
  offlineEmbedColor: 'DARK_BUT_NOT_BLACK'
  offlineEmbedStatus: 'Offline'
`.trim();