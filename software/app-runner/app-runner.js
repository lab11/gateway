#!/usr/bin/env node

var exec = require('child_process').exec
var spawn = require('child_process').spawn
var fs = require('fs')
var path = require('path')

var ini = require('ini')
var sane = require('sane')

// List of info on the sub apps we are running
var running_apps = {}

function handle_app_change (app_folder) {
  // Some base checks.
  // We can ignore the root and anything in node_modules
  if (app_folder === root ||
      app_folder.indexOf('node_modules') !== -1) {
    return
  }

  console.log('Starting or restarting app in ' + app_folder + ' folder')

  // Get nice name for logging
  var app_name = path.basename(app_folder)

  function log (s) {
    console.log(app_name + ': ' + s)
  }

  // Check if we know about this app, and if so, if we are currently
  // handling it.
  if (!(app_folder in running_apps)) {
    running_apps[app_folder] = {
      restarting: true
    }
  } else {
    if (running_apps[app_folder].restarting) {
      return
    }
  }

  // We are processing this app
  running_apps[app_folder].restarting = true

  // Wait for a while before actually doing anything, in case files
  // keep changing
  setTimeout(restart_app, 5000)
  log('Waiting 5 seconds to start the app in case files are still changing.')

  function restart_app () {
    log('Actually restarting app in ' + app_folder)

    // First check if this is already running, if so, we want to close it
    if (running_apps[app_folder].process !== undefined) {
      log('Killing old process')
      log(running_apps[app_folder].process)
      running_apps[app_folder].process.force_kill = true
      running_apps[app_folder].process.kill('SIGINT')
      running_apps[app_folder].process = undefined
    } else {
      log('No defined process to kill. Continuing.')
    }

    // Run that app as a child now
    var p = spawn('node', [app_name + '.js'], {cwd: app_folder})
    log('Just spawned the app')

    // At this point we can handle a new file change
    running_apps[app_folder].restarting = false
    running_apps[app_folder].process = p

    p.on('open', function () {
      console.log('opened')
    })

    p.stdout.on('data', function (data) {
      log('stdout: ' + data)
    })

    p.stderr.on('data', function (data) {
      log('stderr: ' + data)
    })

    p.on('close', function (ret_code) {
      log('closed. (ret code: ' + ret_code + ')')

      if (p.force_kill) {
        log('Not restarting due to kill because file changed')
      } else {
        // Restart the app in 5 seconds
        log('Restarting app')
        running_apps[app_folder].process = undefined
        setTimeout(function () { handle_app_change(app_folder) }, 5000)
      }
    })
  }
}

// Check for conf file
try {
  var config_file = fs.readFileSync('/etc/swarm-gateway/app-runner.conf', 'utf-8')
  var config = ini.parse(config_file)
  if (config.app_dir === undefined || config.app_dir === '') {
    throw new Error('no settings')
  }
} catch (e) {
  console.log(e)
  console.log('Could not find /etc/swarm-gateway/app-runner.conf or not properly configured.')
  process.exit(1)
}

var root = config.app_dir

// Setup a watcher to watch for changes to available apps
var watcher = sane(root, {glob: ['*/*']})
watcher.on('change', function (filepath, root, stat) {
  filepath = path.join(root, filepath)
  console.log(filepath + ' was changed')
  handle_app_change(path.dirname(filepath))
})
watcher.on('add', function (filepath, root, stat) {
  filepath = path.join(root, filepath)
  console.log(filepath + ' was changed')
  handle_app_change(path.dirname(filepath))
})
watcher.on('delete', function (filepath, root) {
  filepath = path.join(root, filepath)
  console.log(filepath + ' was changed')
  handle_app_change(path.dirname(filepath))
})
watcher.on('error', function (err) {
  console.log('watcher error: ' + err)
})

// Process all existing apps at the start
function get_directories (srcpath) {
  return fs.readdirSync(srcpath).filter(function (file) {
    return fs.statSync(path.join(srcpath, file)).isDirectory()
  })
}

var dirs = get_directories(root)
var seconds_to_wait = 0
dirs.forEach(function (dir) {
  var d = path.join(root, dir)
  console.log('Loading app ' + d + ' at boot in ' + (seconds_to_wait+1) + ' seconds.')
  setTimeout(function () {
    console.log('Loading app ' + d + ' at boot')
    handle_app_change(d)
  }, (seconds_to_wait + 1) * 1000);
  seconds_to_wait += 20
})
