var http = require('http');

http.createServer(function (req, res) { res.writeHead(200, {'Content-Type': 'text/plain'}); }).listen(process.env.PORT || 5000);
