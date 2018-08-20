var express = require('express'),
	app = express(),
	port = process.env.PORT || 8000,
	path = require('path');

app.use(express.static('js'));
// app.use(express.static('images'));
// app.use(express.static('levels'));

app.get('/', function(req,res) {
    res.sendFile(path.join(__dirname+ '/index.html'));
})

if(!module.parent){
    app.listen(port, function(){
        console.log('Express server listening on port ' + port + '.');
    });
}