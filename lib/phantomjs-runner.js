var system = require('system');
var url = system.args[1] || '';
if(url.length > 0) {
  var page = require('webpage').create();
  page.open(url, function (status) {
    if (status == 'success') {
      var count = 0;

      var delay, checker = (function() {
        count++;

        var html = page.evaluate(function () {
          var body = document.getElementsByTagName('body')[0];
          if(body.getAttribute('data-status') == 'ready') {
            return document.getElementsByTagName('html')[0].outerHTML;
          }
        });

        if(html) {
          clearTimeout(delay);
          console.log(html);
          phantom.exit();
        } else if (count > 40) {
          html = page.evaluate(function () { return document.getElementsByTagName('html')[0].outerHTML; });
          console.log(html);
          phantom.exit();
        }
      });

      delay = setInterval(checker, 100);
    }
  });
}
