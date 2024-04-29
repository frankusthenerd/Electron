// ============================================================================
// Electron Server
// Programmed by Francois Lamini
// ============================================================================

var fs = require("fs");
var path = require("path");
var http = require("http");
var querystring = require("querystring");

var $root = __dirname;
var $server = null;
var $mime = {};
var $config = {};

/**
 * Reads a file from the server.
 * @param file The file to be processed.
 * @param response The response to be populated.
 * @param params Extra parameters passed to the file.
 * @throws An error if the file type is not found in the MIME table.
 */
function Read_File(file, response, params) {
  var output = null;
  var status = 0;
  var mime_type = "text/plain";
  var binary = false;
  var ext = file.split(path.sep).pop().replace(/^\w+\./, "");
  if ($mime[ext] != undefined) {
    try {
      var mime = $mime[ext];
      var dest = Get_Local_Path(file);
      if (mime.binary) {
        output = fs.readFileSync(dest);
      }
      else {
        output = fs.readFileSync(dest, "utf8");
      }
      status = 200;
      mime_type = mime.type;
      binary = mime.binary;
    }
    catch (error) {
      output = "Read Error: " + error.message;
      status = 404;
    }
  }
  else {
    output = "Read Error: File type " + ext + " is not defined.";
    status = 404;
  }
  response.writeHead(status, {
    "Content-Type": mime_type
  });
  if (binary) {
    response.end(output, "binary");
  }
  else {
    response.end(output);
  }
}

/**
 * Writes a file to the server.
 * @param file The file to write to the server.
 * @param response The server response object.
 * @param params The parameters passed to the file.
 */
function Write_File(file, response, params) {
  var ext = file.split(path.sep).pop().replace(/^\w+\./, "");
  var output = "";
  var mime_type = "text/plain";
  var status = 0;
  if ($mime[ext] != undefined) {
    if (params.data != undefined) {
      var fdata = params.data;
      var dest = Get_Local_Path(file);
      if (!$mime[ext].binary) { // Text file.
        // Save the file.
        try {
          if (fdata.length == 0) {
            throw new Error("Cannot create empty file " + file + ".");
          }
          fs.writeFileSync(dest, fdata);
          output = "Wrote " + file + ".";
          status = 200;
        }
        catch (error) {
          output = "Write Error: " + error.message;
          status = 404;
        }
      }
      else { // Binary file.
        // Save the binary code.
        try {
          if (fdata.length == 0) {
            throw new Error("Cannot create empty file " + file + ".");
          }
          var buffer = Buffer.from(fdata, "base64");
          fs.writeFileSync(dest, buffer);
          output = "Wrote " + file + ".";
          status = 200;
        }
        catch (error) {
          output = "Write Error: " + error.message;
          status = 404;
        }
      }
    }
    else {
      output = "Write Error: Data parameter missing for " + file + ".";
      status = 401;
    }
  }
  else {
    output = "Write Error: File type " + ext + " is not defined.";
    status = 401;
  }
  // Write server output.
  response.writeHead(status, {
    "Content-Type": mime_type
  });
  response.end(output);
}

/**
 * Creates a new folder if one does not exist.
 * @param params The parameter object with the passed in folder.
 * @param response The response object.
 */
function Create_Folder(params, response) {
  var output = "";
  var status = 0;
  var folder = Escape_Path(params.folder || "");
  try {
    var dest = path.join($root, folder);
    fs.mkdirSync(dest, {
      recursive: true
    });
    output = "Created folder: " + folder;
    status = 200;
  }
  catch (error) {
    status = 404;
    output = "Folder Error: " + error.message;
  }
  // Write server output.
  response.writeHead(status, {
    "Content-Type": "text/plain"
  });
  response.end(output);
}


/**
 *  Escapes a folder path to platform independent path separators.
 * @param folder The folder path.
 * @return The path that is platform independent.
 */
function Escape_Path(folder) {
  return folder.replace(/(\/|\\|:)/g, path.sep);
}

/**
 * Handles a request from the server.
 * @param request The request object that is passed in.
 * @param response The response object that is passed in.
 */
function Handle_Request(request, response) {
  if (request.method == "GET") {
    var pair = request.url.split(/\?/);
    var file = Escape_Path(pair[0].replace(/^\//, ""));
    var params = querystring.parse((pair[1] == undefined) ? "" : pair[1]);
    if (file.match(/\w+\.\w+$/)) {
      Read_File(file, response, params);
    }
    else if (file == "create-folder") {
      Create_Folder(params, response);
    }
    else if (file == "query-files") {
      Query_Files(params, response);
    }
    else {
      Read_File("Home.html", response, params);
    }
  }
  else if (request.method == "POST") {
    var data = "";
    request.on("data", function(chunk) {
      data += chunk;
    });
    request.on("end", function() {
      var params = querystring.parse(data);
      var file = Escape_Path(request.url.replace(/^\//, ""));
      if (file.match(/\w+\.\w+$/)) {
        Write_File(file, response, params);
      }
      else {
        response.writeHead(401, {
          "Content-Type": "text/plain"
        });
        response.end("You cannot write to a non file type.");
      }
    });
  }
}

/**
 * Queries a group of files in a directory or a group of folders.
 * @param params The parameter object containing the folder and search.
 * @param response The server response.
 */
function Query_Files(params, response) {
  var status = 0;
  var output = "";
  try {
    var code = (params.code == undefined) ? "" : params.code;
    var folder = Escape_Path(params.folder || "");
    var search = params.search || "";
    // Remove trailing slash.
    folder = (folder[folder.length - 1] == path.sep) ? folder.substr(0, folder.length - 1) : folder;
    var dest = Get_Local_Path(folder);
    var files = fs.readdirSync(dest);
    // Process files to determine if they are directories.
    var file_list = [];
    var file_count = files.length;
    for (var file_index = 0; file_index < file_count; file_index++) {
      var file = files[file_index];
      var dir = path.join(dest, file);
      var stats = fs.lstatSync(dir);
      if (!stats.isDirectory()) {
        if (search == "all") { // All keys.
          file_list.push(file);
        }
        else if (search.match(/,/)) { // List of extensions.
          var list = search.replace(/,/g, "|");
          if (file.match(new RegExp("\\.(" + list + ")$"), "")) {
            file_list.push(file);
          }
        }
        else if (search.match(/^\*\w+$/)) { // File extension.
          var query = search.replace(/^\*/, "");
          if (file.match(new RegExp("\\w+\\." + query + "$"), "")) {
            file_list.push(file);
          }
        }
        else if (search.match(/^\*\w+\.\w+$/)) { // File pattern.
          var query = search.replace(/^\*/, "");
          if (file.match(new RegExp(query + "$"), "")) {
            file_list.push(file);
          }
        }
        else if (search.match(/^@\w+$/)) { // Random pattern.
          var query = search.replace(/^@/, "");
          if (file.indexOf(query) != -1) {
            file_list.push(file);
          }
        }
      }
      else { // Directory read.
        if (search == "folders") {
          if ((file.indexOf(".") == -1) && (file.indexOf("..") == -1)) {
            file_list.push(file);
          }
        }
      }
    }
    output = file_list.join("\n");
    status = 200;
  }
  catch (error) {
    status = 404;
    output = "Could not read files: " + error.message;
  }
  // Write server output.
  response.writeHead(status, {
    "Content-Type": "text/plain"
  });
  response.end(output);
}

/**
 * Loads MIME types from a file.
 * @param name The name of the file to load.
 * @throws An error if something went wrong.
 */
function Load_MIME(name) {
  try {
    var data = fs.readFileSync(path.join($root, name + ".txt"), "utf8");
    var records = Split(data);
    var rec_count = records.length;
    for (var rec_index = 0; rec_index < rec_count; rec_index++) {
      var record = records[rec_index].split(/=/);
      if (record.length == 2) {
        var ext = record[0];
        var info = record[1].split(/,/);
        if (info.length == 2) {
          var type = info[0];
          var binary = (info[1] == "true");
          $mime[ext] = {
            type: type,
            binary: binary
          };
        }
      }
    }
  }
  catch (error) {
    throw error;
  }
}

/**
 * Splits text into lines regardless of the line endings.
 * @param data The text to be split.
 * @return An array of string representing the lines.
 */
function Split(data) {
  var lines = data.split(/\r\n|\r|\n/);
  // Remove any carrage return at the end.
  var line_count = lines.length;
  var blanks = 0;
  for (var line_index = line_count - 1; line_index >= 0; line_index--) { // Start from back.
    var line = lines[line_index];
    if (line.length == 0) {
      blanks++;
    }
    else {
      break;
    }
  }
  return lines.slice(0, line_count - blanks);
}

/**
 * Loads the config file.
 * @param name The name of the config file.
 */
function Load_Config(name) {
  try {
    var data = fs.readFileSync(path.join($root, name + ".txt"), "utf8");
    var lines = Split(data);
    var line_count = lines.length;
    for (var line_index = 0; line_index < line_count; line_index++) {
      var pair = lines[line_index].split(/=/);
      if (pair.length == 2) {
        var key = pair[0];
        var value = pair[1];
        $config[key] = !isNaN(value) ? parseInt(value) : value;
      }
    }
  }
  catch (error) {
    console.log("Error: " + error.message);
  }
}

/**
 * Gets the local path given the folder.
 * @param folder The folder path.
 * @return The platform depend OS path.
 */
function Get_Local_Path(folder) {
  var folders = $root.split(path.sep).concat(folder.split(path.sep));
  var new_folders = [];
  var folder_count = folders.length;
  for (var folder_index = 0; folder_index < folder_count; folder_index++) {
    if (folders[folder_index] == "up") {
      // Remove previous folder.
      new_folders.pop();
    }
    else {
      new_folders.push(folders[folder_index]);
    }
  }
  return new_folders.join(path.sep);
}

/**
 * Initializes the server.
 * @param on_start Called when the server is started up.
 */
function Init(on_start) {
  try {
    // Load MIME types.
    Load_MIME("Mime");
    // Load the config file.
    Load_Config("Config");
    // Start server.
    $server = http.createServer(Handle_Request);
    var server_instance = $server.listen($config["port"]);
    server_instance.on("listening", function() {
      on_start();
    });
  }
  catch (error) {
    console.log("Error: " + error.message);
  }
}

// **************** Export **********************
module.exports = {
  Init: Init,
  config: $config
};
// **********************************************
