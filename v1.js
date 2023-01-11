var appConfig = {"mainFile":"main.js","minimal":"v1"};

var app = {
  start: async function() {
    var options = app.parseArgv(["server-port", "server-folder", "cron-key", "cron-interval", "console-key", "console-prefix", "dry-run"]);
    if (app.has(options)) {
      app.server.wellknown.start(options);
    } else {
      console.log(app.consoleColors.bgRed, "Invalid options: ", options);
    }
  }
};
app.startUps = [];
app.workerStartUps= [];
app.callbacks = {static: []};app["build"] = {};app["cron"] = {"run": (function() {
  var fs = require("fs");
  var exec = require("child_process").exec;
  var mod = {
    start: async function(options, manual) {
      console.log("Starting cron...");
      if (!app.has(manual)) manual = false;
      await new Promise(function(resolve, reject) {
        exec(`certbot renew ` + (options.dryRun !== "false" ? "--dry-run" : "") + ` --webroot --webroot-path="` + options.serverFolder + `"`, function(error, stdout, stderr) {
          console.log(stdout, stderr);
          app.console(stdout, stderr);
          resolve(true);
        });
      });
      if (manual === false && app.has(options.cronInterval) && !isNaN(parseInt(options.cronInterval))) setTimeout(function() { mod.start(options); }, parseInt(options.cronInterval * 1000));
    }
  };
  return mod;
})(), };app["enhance"] = {"argv": (function() {
  var mod = {
    start: function() {
      app.parseArgv = function(list) {
        var options = {};
        for (var i=2; i<=process.argv.length-1; i++) {
          var option = process.argv[i];
          var name = option.split("=").shift().trim();
          var cName = app.camelCase(name).split("-").join("");
          var value = option.split("=").pop().trim();
          if (list.indexOf(name) >= 0) {
            options[cName] = value;
          } else {
            console.log(app.consoleColors.bgRed, "Invalid option: " + name);
            return;
          }
        }
        app.cliOptions = options;
        return options;
      };
    }
  };
  mod.start();
  return mod;
})(), "console": (function() {
  var mod = {
    logged: false,
    start: function() {
      app.console = function() {
        if (app.has(app.cliOptions) && app.has(app.cliOptions.consoleKey)) {
          if (!app.has(mod.consoleRe)) {
            mod.consoleRe = require('console-remote-client').connect({server: "https://console.ylo.one:8088", channel: app.cliOptions.consoleKey});
          }
          var args = Array.prototype.slice.call(arguments);
          if (app.has(app.cliOptions.consolePrefix)) {
            args.unshift("[lime]" + app.cliOptions.consolePrefix + "[/lime]");
          }
          console.re.log.apply(null, args);
          mod.logged = true;
        }
      };
      app.exit = async function(time) {
        if (mod.logged === true) {
          console.log("Waiting for remote console...");
          if (!app.has(time)) time = 5; // 5 seconds
          await new Promise(function(resolve, reject) {
            setTimeout(function() { resolve(true); }, time * 1000);
          });
        }
        process.exit();
      };
      app.consoleColors = {
        reset: "\x1b[0m%s\x1b[0m",
        bright: "\x1b[1m%s\x1b[0m",
        dim: "\x1b[2m%s\x1b[0m",
        underscore: "\x1b[4m%s\x1b[0m",
        blink: "\x1b[5m%s\x1b[0m",
        reverse: "\x1b[7m%s\x1b[0m",
        hidden: "\x1b[8m%s\x1b[0m",
        fgBlack: "\x1b[30m%s\x1b[0m",
        fgRed: "\x1b[31m%s\x1b[0m",
        fgGreen: "\x1b[32m%s\x1b[0m",
        fgYellow: "\x1b[33m%s\x1b[0m",
        fgBlue: "\x1b[34m%s\x1b[0m",
        fgMagenta: "\x1b[35m%s\x1b[0m",
        fgCyan: "\x1b[36m%s\x1b[0m",
        fgWhite: "\x1b[37m%s\x1b[0m",
        fgGray: "\x1b[90m%s\x1b[0m",
        bgBlack: "\x1b[40m%s\x1b[0m",
        bgRed: "\x1b[41m%s\x1b[0m",
        bgGreen: "\x1b[42m%s\x1b[0m",
        bgYellow: "\x1b[43m%s\x1b[0m",
        bgBlue: "\x1b[44m%s\x1b[0m",
        bgMagenta: "\x1b[45m%s\x1b[0m",
        bgCyan: "\x1b[46m%s\x1b[0m",
        bgWhite: "\x1b[47m%s\x1b[0m",
        bgGray: "\x1b[100m%s\x1b[0m"
      };
    }
  };
  mod.start();
  return mod;
})(), "string": (function() {
  var mod = {
    start: function() {
      app.camelCase = function camelize(str, capitalFirst) {
        if (!app.has(capitalFirst)) capitalFirst = false;
        var result = str.replace(/(?:^\w|[A-Z]|\b\w)/g, function(word, index) {
          return index === 0 ? word.toLowerCase() : word.toUpperCase();
        }).replace(/\s+/g, '');
        if (capitalFirst) result = result.substr(0, 1).toUpperCase() + result.substr(1, 999);
        return result;
      };
      app.properCase = function(str) {
        return str.replace(
          /\w\S*/g,
          function(txt) { return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase(); }
        );
      };
    }
  };
  mod.start();
  return mod;
})(), };app["publish"] = {};app["server"] = {"wellknown": (function() {
  var mod = {
    start: function(options) {
      if (
        app.has(options.serverPort)
        && app.has(options.serverFolder)
        && app.has(options.cronKey)
      ) {
        var http = require("http");
        var fs = require("fs");
        var server = http.createServer(function(request, response) {
          var url = new URL("http://" + request.headers.host + request.url);
          console.log(request.headers.host + url.pathname);
          if (url.pathname === "/" + options.cronKey) {
            app.cron.run.start(options, true);
            response.writeHead(200, {});
            response.end("Cron started.", "utf-8");
            return;
          }
          var file = options.serverFolder + url.pathname;
          var found = false;
          if (fs.existsSync(file) === true) {
            var stats = fs.statSync(file);
            if (stats.isFile() === true) {
              response.writeHead(200, {}); // with headers
              response.end(fs.readFileSync(file), "utf-8");
              found = true;
            }
          }
          if (!found) {
            response.writeHead(404, {}); // with headers
            response.end("Not found", "utf-8");
          }
        });
        server.listen(options.serverPort);
        console.log("wellknown server is listening on port: " + options.serverPort);
        if (app.has(options.cronInterval) && !isNaN(parseInt(options.cronInterval))) app.cron.run.start(options);
      } else {
        console.log("Invalid/Missing options: ", options);
      }
    }
  };
  return mod;
})(), };
var config = app.config;
var modules = app.modules;
app.has = function(value) {
  var found = true;
  for (var i=0; i<=arguments.length-1; i++) {
    var value = arguments[i];
    if (!(typeof value !== "undefined" && value !== null && value !== "")) found = false;
  }
  return found;
};
if (!app.has(fetch)) {
  var fetch = require("node-fetch");
}
if (typeof app.start === "function") app.start();
