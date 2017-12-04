var express = require('express');
var app     = express();

app.set('port', (process.env.PORT || 5000));

//For avoidong Heroku $PORT error
app.get('/', function(request, response) {
    response.sendfile(__dirname + '/tests' + '/index.html');
}).listen(app.get('port'), function() {
    app.use('/', express.static(__dirname + '/tests'));
});
