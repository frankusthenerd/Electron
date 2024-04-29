// ============================================================================
// Electron Script
// Programmed by Francois Lamini
// ============================================================================

var electron = require("electron");
var path = require("path");
var server = require("./Server");

var $root = __dirname;
var $windows = {};

/**
 * Loads an app into a window.
 * @param name The name of the app to load.
 * @param url The URL of the app.
 * @param width The width of the window.
 * @param height The height of the window.
 * @param options The options for the window.
 */
function Load_App(name, url, width, height, options) {
  if ($windows[name] == undefined) {
    $windows[name] = new electron.BrowserWindow({
      width: width,
      height: height,
      title: name,
      backgroundColor: "white",
      useContentSize: true,
      minWidth: width,
      minHeight: height,
      icon: path.join($root, name + ".png"),
      // show: false,
      fullscreen: (options["fullscreen"] == "on"),
      webPreferences: {
        nodeIntegration: true,
        webSecurity: false
      }
    });
    $windows[name].setMenu(null);
    $windows[name].loadURL(url);
    $windows[name].once("ready-to-show", function() {
      $windows[name].show();
    });
    $windows[name].once("closed", function() {
      delete $windows[name]; // Remove window reference.
    });
    if (options["debug"] == "on") {
      $windows[name].webContents.openDevTools({
        mode: "detach"
      });
    }
  }
}

/**
 * Checks a condition to see if it passes otherwise an error is thrown.
 * @param condition The condition to check. 
 * @param error An error message for the condition fails.
 * @throws An error if the condition fails. 
 */
function Check_Condition(condition, error) {
  if (!condition) {
    throw new Error(error);
  }
}

/**
 * Initializes the electron app.
 */
function Init() {
  server.Init(function() {
    try {
      Check_Condition((server.config["project"] != undefined), "No project name set.");
      Check_Condition((server.config["width"] != undefined), "No width set for window.");
      Check_Condition((server.config["height"] != undefined), "No height set for window.");
      Check_Condition((server.config["home"] != undefined), "No home document set.");
      var options = {
        debug: (server.config["debug"] == "on") ? "on" : "off",
        fullscreen: (server.config["fullscreen"] == "on") ? "on" : "off"
      };
      Load_App(server.config["project"], "http://localhost:" + server.config["port"] + "/" + server.config["home"], server.config["width"], server.config["height"], options);
    }
    catch (error) {
      electron.dialog.showErrorBox("Server", error.message);
    }
  });
}

// **************** Constructor **********************
electron.app.whenReady().then(function() {
  Init();
});

electron.app.on("window-all-closed", function() {
  electron.app.quit();
});
// ***************************************************