var http = require('http')
  ,fs = require('fs')
  ,path = require('path');

var index = fs.readFileSync(path.join(__dirname, './index.html'));

var server = http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'});
  res.end(index);
});

function TestServer() {
}

TestServer.prototype.start =  function() {
  server.listen(1234);
};

TestServer.prototype.stop = function() {
  server.close();
};


module.exports.TestServer = TestServer;