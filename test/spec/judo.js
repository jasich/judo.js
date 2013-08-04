var _ = require('underscore'),
  Judo = require('../../lib/judo'),
  TestServer = require('../server/testServer').TestServer,
  fs = require('fs'),
  path = require('path'),
  mkdirp = require('mkdirp'),
  url = require('url'),
  xml2js = require('xml2js'),
  walk = require('walk'),
  should = require('should');

var frequencies = Judo.ChangeFrequencies;
var priorityValues = Judo.PriorityValues;

var _baseUrl = 'http://localhost:1234/';
var _siteMapDir = __dirname + '/../../.tmp/siteMapData';
var _siteMapPath = path.join(_siteMapDir, '/../../.tmp/siteMapData/sitemap.xml');
var _snapshotsDir = __dirname + '/../../.tmp/snapshots';

function openSiteMap(cb) {
  fs.readFile(_siteMapPath, 'utf8', function(err, contents) {
    if (err) return cb(err);
    xml2js.parseString(contents, function(err, siteMap){
      return cb(err, siteMap);
    });
  });
}

function getSnapshotsDir(cb) {
  var files = [];

  var walker = walk.walk(_snapshotsDir);

  walker.on('file', function(root, stat, next){
    files.push(root + '/' + stat.name);
    next();
  });

  walker.on('end', cb(files));
};

describe('Judo', function () {

  beforeEach(function(done) {
    if (!fs.existsSync(_siteMapDir)) { mkdirp.sync(_siteMapDir);}
    if (!fs.existsSync(_snapshotsDir)) { mkdirp.sync(_snapshotsDir);}
    return done();
  });

  describe('#updateSiteMap', function() {
    var judo;

    beforeEach(function() {
      judo = new Judo({muteWarnings: false});

      if(fs.existsSync(_siteMapPath)) {
        fs.unlinkSync(_siteMapPath);
      }
    });

    it('should generate a sitemap', function (done) {
      var config = {
        baseUrl: _baseUrl,
        siteMapPath: _siteMapPath,
        urls: [ ]
      };

      judo.updateSiteMap(config, function(err) {
        if (err) throw err;
        fs.existsSync(_siteMapPath).should.equal(true);
        done();
      });
    });

    it('should create a "loc" entry in the sitemap for each configured URL with a siteMap config', function(done){
      var config = {
        baseUrl: _baseUrl,
        siteMapPath: _siteMapPath,
        urls: [
          {url: '/index', siteMap: {}},
          {url: '/about', siteMap: {}},
          {url: '/notMe'},
          {url: '/meToo', siteMap: {}}
        ]
      };

      judo.updateSiteMap(config, function(err) {
        if (err) throw err;

        openSiteMap(function(err, siteMap){
            if (err) throw err;

            var urls = siteMap.urlset.url;
            urls.length.should.equal(3);
            urls[0].loc[0].should.equal(url.resolve(_baseUrl, 'index'));
            urls[1].loc[0].should.equal(url.resolve(_baseUrl, 'about'));
            urls[2].loc[0].should.equal(url.resolve(_baseUrl, 'meToo'));

            return done();
          });
      });
    });

    it('should add a valid changefreq element to a URL element when specified', function(done) {
      var config = {
        baseUrl: _baseUrl,
        siteMapPath: _siteMapPath
      };

      var urls = _.map(frequencies, function(value, index) {
        return {
          url: '/' + (index + 1),
          siteMap: { changefreq: value }
        }
      });

      // Push one invalid entry on
      urls.push({
        url: '/' + (frequencies.length + 1),
        siteMap: { changefreq: 'idontcare' }
      });

      config.urls = urls;

      judo.updateSiteMap(config, function(err) {
        if (err) throw err;

        openSiteMap(function(err, siteMap){
          if (err) throw err;

          var urls = siteMap.urlset.url;
          urls.length.should.equal(frequencies.length + 1);

          for (var i = 0; i < frequencies.length; i++) {
            urls[i].changefreq[0].should.equal(frequencies[i]);
          }

          should.not.exist(urls[frequencies.length].changefreq);

          return done();
        });
      });
    });

    it('should add a valid priority element to a URL element when specified', function(done){
      var config = {
        baseUrl: _baseUrl,
        siteMapPath: _siteMapPath
      };

      var urls = _.map(priorityValues, function(value, index) {
        return {
          url: '/' + (index + 1),
          siteMap: { priority: value }
        }
      });

      // Push one invalid entry on
      urls.push({
        url: '/' + (priorityValues.length + 1),
        siteMap: { priority: '1.1' }
      });

      config.urls = urls;

      judo.updateSiteMap(config, function(err) {
        if (err) throw err;

        openSiteMap(function(err, siteMap){
          if (err) throw err;

          var urls = siteMap.urlset.url;
          urls.length.should.equal(priorityValues.length + 1);

          for (var i = 0; i < priorityValues.length; i++) {
            urls[i].priority[0].should.equal(priorityValues[i]);
          }

          should.not.exist(urls[priorityValues.length].priority);

          return done();
        });
      });
    });

    it('should add a valid lastmod element to a URL element when specified', function(done){
      var config = {
        baseUrl: _baseUrl,
        siteMapPath: _siteMapPath
      };

      var w3cDates = [
        '1997',
        '1997-07',
        '1997-07-16',
        '1997-07-16T19:20+01:00',
        '1997-07-16T19:20:30+01:00',
        '1997-07-16T19:20:30.45+01:00'
      ];

      var urls = [];
      for (var i = 0; i < w3cDates.length; i++) {
        urls.push({
          url: '/' + (i + 1),
          siteMap: { lastmod: w3cDates[i] }
        });
      }

      // Push one invalid entry on
      urls.push({
        url: '/' + (w3cDates.length + 1),
        siteMap: { lastmod: '10/01/1982 10:56 AM' }
      });

      config.urls = urls;

      judo.updateSiteMap(config, function(err) {
        if (err) throw err;

        openSiteMap(function(err, siteMap){
          if (err) throw err;

          var urls = siteMap.urlset.url;
          urls.length.should.equal(w3cDates.length + 1);

          for (var i = 0; i < w3cDates.length; i++) {
            urls[i].lastmod[0].should.equal(w3cDates[i]);
          }

          should.not.exist(urls[w3cDates.length].lastmod);

          return done();
        });
      });
    });
  });

  describe('#createSnapshots', function(){
    this.timeout(15000);

    var judo, server;

    beforeEach(function() {
      judo = new Judo({muteWarnings: false});
      server = new TestServer();
      server.start();
    });

    afterEach(function(){
      server.stop();
    });

    it('should create a snapshot for each url with a snapshots config', function(done){
      var config = {
        baseUrl: _baseUrl,
        snapshotsDir: _snapshotsDir,
        urls: [
          {url: '/index', snapshot: {
            filenames: ['index.html']
          }},
          {url: '/about', snapshot: {
            filenames: ['about.html', '/other/about.html']
          }},
          {url: '/notMe'},
          {url: '/meToo', snapshot: {
            filenames: ['meToo.html', '/other/meTooAgain.html']
          }}
        ]
      };

      judo.createSnapshots(config, function(err) {
        if (err) throw err;

        for (var i = 0; i < config.urls.length; i++) {
          if (!config.urls[i].snapshot) { continue; }
          var url = config.urls[i];
          for (var j = 0; j < url.snapshot.filenames.length; j++) {
            var filePath = path.join(_snapshotsDir, url.snapshot.filenames[j]);
            fs.existsSync(filePath).should.equal(true);
          }
        }

        return done();
      });
    });

    it('should skip a snapshot for each url that has a `fresh` file', function(done){
      var config = {
        baseUrl: _baseUrl,
        snapshotsDir: _snapshotsDir,
        urls: [
          { url: '/index',
            snapshot: {
              changefreq: 'never',
              filenames: ['index.html']
            }
          },
          { url: '/about',
            snapshot: {
              changefreq: 'always',
              filenames: ['about.html', '/other/about.html']
            }
          },
          { url: '/notMe' },
          { url: '/meToo',
            snapshot: {
              changefreq: 'hourly',
              filenames: ['meToo.html', '/other/meTooAgain.html']
            }
          }
        ]
      };

      judo.createSnapshots(config, function(err) {
        if (err) throw err;

        // TODO: Test is not complete
        for (var i = 0; i < config.urls.length; i++) {
          if (!config.urls[i].snapshot) { continue; }
          var url = config.urls[i];
          for (var j = 0; j < url.snapshot.filenames.length; j++) {
            var filePath = path.join(_snapshotsDir, url.snapshot.filenames[j]);
            fs.existsSync(filePath).should.equal(true);
          }
        }

        return done();
      });
    });
  });
});