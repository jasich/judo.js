Judo.js
======

A node.js module to help with maintaining sitemap files &amp; static HTML snapshots for a dynamic website.  It is designed to help support SEO for HTML5 Single Page Applications (SPA apps) built with frameworks such as AngularJS, Ember.js or Backbone.js.

By providing URL configuration data about a website, Judo is able to create &amp; maintain sitemaps and static HTML snapshots.  Judo can be run on a schedule as a separate node.js application and/or embedded in an existing application and run on demand.

### Sitemaps
Judo will generate a single sitemap file for each URL configuration object passed to the `updateSiteMap` method.  Each URL that contains a sitemap configuration will be added to that sitemap file.  While creating the sitemap Judo will generate warnings for invalid values.

### Snapshots
WARNING: Judo uses PhantomJS to generate the static HTML snapshots of website pages.  You will need to have PhantomJS installed in order to use this feature.  

When the `createSnapshots` method is called Judo will go through URLs that contain a snapthot configuration and generate a static HTML snapshot for each filename listed in that configuration.  Judo will either wait a short amount of time after opening a URL for the content to load or you can configure your site to set a data-status attribute on the body tag with a value of "true" to signal that the data is loaded.

### Options
***

Judo is configurable via the following options object:

	var options = {
		muteWarnings: false,		// Allows the user to mute warnings generated by Judo
		phantomProcs: 1,			// Number of PhantomJS processes to run concurrently
		maxBuffer: 200*1024			// Max PhantomJS output buffer size
	};
	
	var judo = new Judo(options);
	
### URL Configuration
***
Judo uses the URL configuration data that you provide to do it's work. For each URL can you provide a sitemap configurtion and/or a snapshot configuration.

#### Sitemap Configuration

	var urlConfig = {
		baseUrl: 'http://example.com/',     // The base URL of your site
		siteMapPath: '/srv/mysitedir/sitemap.xml',  // Sitemap output
		urls: [
			{
				url: '/about',
				siteMap: {        // sitemap config (required for inclusion in sitemap)
					changefreq: 'daily',      // (optional)
					priority:   '0.5',        // (optional)
					lastmod:    '2012-03-06'  // (optional)
				}
			},
			{
				url: '/contact',
				... 
			}
		]
	};
	
	judo.updateSiteMap(urlConfig, function(err){
		if (!err) console.log('that was easy!');
	});
	
#### Snapshot Configuration

	var urlConfig = {
		baseUrl: 'http://example.com/',     // The base URL of your site
		snapshotsDir: '/srv/mysitedir/snapshots',   // Root directory for snapshots
		urls: [
			{
				url: '/about',
				snapshot: {     // static snapshot config (required for snapshot creation)
					changefreq: 'daily',	  // (optional, same values as for changeFreq)
					filenames: [			  // Array of filenames to generate snapshots for
						'about.html', 
						'about-us.html' ]
				}
			},
			{
				url: '/contact',
				... 
			}
		]
	};
	
	judo.createSnapshots(urlConfig, function(err){
		if (!err) console.log('that was easy!');
	});

***

v0.2.1

Copyright 2013 Jason Sich

Licensed under the MIT license
