var _ = require('underscore'),
  xml = require('xml'),
  path = require('path'),
  url = require('url'),
  async = require('async'),
  mkdirp = require('mkdirp'),
  cp = require('child_process'),
  fs = require('fs');

var isoDateRegex = /^([\+-]?\d{4}(?!\d{2}\b))((-?)((0[1-9]|1[0-2])(\3([12]\d|0[1-9]|3[01]))?|W([0-4]\d|5[0-2])(-?[1-7])?|(00[1-9]|0[1-9]\d|[12]\d{2}|3([0-5]\d|6[1-6])))([T\s]((([01]\d|2[0-3])((:?)[0-5]\d)?|24\:?00)([\.,]\d+(?!:))?)?(\17[0-5]\d([\.,]\d+)?)?([zZ]|([\+-])([01]\d|2[0-3]):?([0-5]\d)?)?)?)?$/;

function Judo(opts){
  this.opts = {
    muteWarnings: false,
    phantomProcs: 1
  };
  _.extend(this.opts, opts);
}

Judo.ChangeFrequencies = ['always', 'hourly', 'daily', 'weekly', 'monthly', 'yearly', 'never'];
Judo.FrequencyValues = {'always': 0, 'hourly': 60, 'daily': 1440, 'weekly': 10080, 'monthly': 43829, 'yearly': 525949, 'never': undefined };
Judo.PriorityValues = ['0.0', '0.1', '0.2', '0.3', '0.4', '0.5', '0.6', '0.7', '0.8', '0.9', '1.0'];

Judo.prototype._warn = function(msg) {
  if (!this.opts.muteWarnings) {
    console.warn(msg);
  }
};

Judo.prototype.updateSiteMap = function(config, done) {
  var self = this;

  // Make sure that we can call done no matter what
  if (!done) {
    done = function() {};
  }

  if (typeof done !== 'function') {
    throw new Error('Object provided was not a callback');
  }

  var dirPath = path.normalize(path.dirname(config.siteMapPath));
  if (!fs.existsSync(dirPath)) {
    return done(new Error('Directory of config.siteMapPath does not exist: "' + dirPath + '"'));
  }

  if (!config.baseUrl) { return done(new Error('Missing config.baseUrl')); }
  if (!config.urls) { return done(new Error('Missing config.urls')); }

  if (!config.urls.length) { self._warn('Warning: 0 URLs configured!'); }

  // Build up JSON object
  var siteMap = {"urlset": [{ "_attr": { "xmlns": "http://www.sitemaps.org/schemas/sitemap/0.9" }}]};
  for (var i = 0; i < config.urls.length; i++) {
    if (!config.urls[i].siteMap) { continue; }

    var loc = url.resolve(config.baseUrl, config.urls[i].url);
    var curUrl = {url: [{loc: loc}]};
    var siteMapOpts = config.urls[i].siteMap;

    if (siteMapOpts.changefreq) {
      if (_.contains(Judo.ChangeFrequencies, siteMapOpts.changefreq)) {
        curUrl.url.push({changefreq: siteMapOpts.changefreq});
      } else {
        self._warn('Warning: Sitemap entry for ' + loc +' contains an invalid "changefreq" value of: ' +
          siteMapOpts.changefreq);
      }
    }

    if (siteMapOpts.priority) {
      if (_.contains(Judo.PriorityValues, siteMapOpts.priority)) {
        curUrl.url.push({priority: siteMapOpts.priority});
      } else {
        self._warn('Warning: Sitemap entry for ' + loc +' contains an invalid "priority" value of: ' +
          siteMapOpts.priority);
      }
    }

    if (siteMapOpts.lastmod) {
      if (isoDateRegex.test(siteMapOpts.lastmod)) {
        curUrl.url.push({lastmod: siteMapOpts.lastmod});
      } else {
        self._warn('Warning: Sitemap entry for ' + loc +' contains an invalid "lastmod" value of: ' +
          siteMapOpts.lastmod);
      }
    }

    siteMap.urlset.push(curUrl);
  }

  // Serialize to file as XML
  var siteMapXml = xml(siteMap);
  fs.writeFile(config.siteMapPath, siteMapXml, function(err) {
    console.log('Sitemap created: Wrote ' + (siteMap.urlset.length - 1) + ' URLs to ' + config.siteMapPath);
    return done(err, (siteMap.urlset.length - 1));
  });
};

Judo.prototype.createSnapshots = function(config, done) {
  var self = this;

  // Make sure that we can call done no matter what
  if (!done) {
    done = function() {};
  }

  if (typeof done !== 'function') {
    throw new Error('Object provided was not a callback');
  }

  var dirPath = path.normalize(path.dirname(config.snapshotsDir));
  if (!fs.existsSync(dirPath)) {
    return done(new Error('Directory of config.snapshotsDir does not exist: "' + dirPath + '"'));
  }

  if (!config.urls) { return done(new Error('Missing config.urls')); }
  if (!config.urls.length) { self._warn('Warning: 0 URLs configured!'); }

  var runnerFile = path.join(__dirname, 'phantomjs-runner.js');

  // Discover which snapshots need to be created/updated
  var snapshots = [];
  for (var i = 0; i < config.urls.length; i++) {
    var curUrl = config.urls[i];
    var loc = url.resolve(config.baseUrl, curUrl.url);

    if (!curUrl.snapshot) {  continue; } // No snapshot data, so continue

    var refreshMinutes = Judo.FrequencyValues[curUrl.snapshot.changefreq || 'always'];
    var now = new Date();
    var maxRefreshDate = now.setMinutes(now.getMinutes() - refreshMinutes);

    for (var j = 0; j < curUrl.snapshot.filenames.length; j++) {
      var shouldCreate = false;
      var snapshotFile = path.join(config.snapshotsDir, curUrl.snapshot.filenames[j]);

      if (!fs.existsSync(snapshotFile)) {
        shouldCreate = true;

        // Verify dir path
        var fullSnapshotPath = path.dirname(snapshotFile);
        if (!fs.existsSync(fullSnapshotPath)) {
          mkdirp.sync(fullSnapshotPath);  // create necessary file structure
        }
      } else {
        // File exists, check the freshness of it
        var stat = fs.statSync(snapshotFile);
        var lastModified = new Date(stat.mtime);
        shouldCreate = (lastModified < maxRefreshDate);
      }

      if (shouldCreate) {
        snapshots.push({ url: loc, filename: snapshotFile });
      }
    }
  }

  console.log('Preparing to snapshot: ' + snapshots.length);

  // Use PhantomJS to generate snapshot, then save to file
  async.eachLimit(snapshots, self.opts.phantomProcs,
    function(snap, cb) {
      async.waterfall(
      [
        function(wCb) {
          var cmd = 'phantomjs ' + runnerFile + ' ' + snap.url;
          cp.exec(cmd, function(err, stdout, stderr) {
              return wCb(err, stdout);
          });
        },
        function (result, wCb) {
          fs.writeFile(snap.filename, result, function(err) {
            return wCb(err, snap);
          });
        }
      ], cb);
    },
    function(err){
      console.log('Finished snapshotting: ' + snapshots.length);
      return done(err, snapshots.length);
    }
  );
};

module.exports = Judo;
