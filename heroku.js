var http = require('http');

http.createServer(onRequest).listen(process.env.PORT || 6000)
