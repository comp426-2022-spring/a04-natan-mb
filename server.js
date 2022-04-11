// Require Express.js

const args = require('minimist')(process.argv.slice(2))

if (args.help) {
    console.log(`
        server.js [options] 
        
        --port  Set the port number for the server to listen on. Must be an integer
                between 1 and 65535.

        --debug If set to 'true', creates endpoints /app/log/access/ which returns
                a JSON access log from the database and /app/error which throws 
                an error with the message "Error test successful." Defaults to 
                'false'.

        --log   If set to false, no log files are written. Defaults to true.
                Logs are always written to database.

        --help  Return this message and exit.
    `)

    process.exit()
}

args['port']
const port = args.port || process.env.PORT || 5555

const express = require('express')
const { exit } = require('process')

const fs = require('fs')
const morgan = require('morgan')
const db = require('./database.js')

var app = express()
app.use(express.urlencoded({ extended: true }))
app.use(express.json())

const logEnabled = (args.log == undefined ? true : args.log === 'true')
const debugEnabled = (args.debug == undefined ? false : args.debug)


// Middleware function
app.use(function(req, res, next) {

 //   if(!logEnabled)
 //       next()

    let logdata = {
        remoteaddr: req.ip,
        remoteuser: req.user,
        time: Date.now(),
        method: req.method,
        url: req.url,
        protocol: req.protocol,
        httpversion: req.httpVersion,
        status: res.statusCode,
        referer: req.headers['referer'],
        useragent: req.headers['user-agent']
    }

    const stmt = db.prepare(`
        INSERT INTO accesslog
        VALUES (
            @remoteaddr,
            @remoteuser,
            @time,
            @method,
            @url,
            @protocol,
            @httpversion,
            @status,
            @referer,
            @useragent
        )
    `)
    
    stmt.run(logdata)

    next()


})

  
if (logEnabled) {
    var accesslogstream = fs.createWriteStream('access.log', { flags: 'a' })
    app.use(morgan('combined', { stream: accesslogstream }))
}


// Start an app server
const server = app.listen(port, () => {
    console.log('App listening on port %PORT%'.replace('%PORT%', port))
});


// Define check endpoint
app.get('/app/', (req, res) => {
    // Respond with status 200
    res.statusCode = 200;

    // Respond with status message "OK"
    res.statusMessage = 'OK';
    res.writeHead(res.statusCode, { 'Content-Type': 'text/plain' });
    res.end(res.statusCode + ' ' + res.statusMessage);
});


// Simulate a single coin flip
app.get('/app/flip/', (req, res) => {
    res.send({ flip: coinFlip() });
});


// Simulate multiple coin flips
app.get('/app/flips/:number', (req, res) => {
    res.send(coinFlips(req.params.number));
});


// Call heads and simulate a coin flip
app.get('/app/flip/call/heads', (req, res) => {
    res.send(flipACoin('heads'));
});


// Call tails and simulate a coin flip
app.get('/app/flip/call/tails', (req, res) => {
    res.send(flipACoin('tails'));
});


// Debugging endpoints
if (debugEnabled) {

    // Get log data
    app.get('/app/log/access/',  (req, res) => {
        try {
            const stmt = db.prepare('SELECT * FROM accesslog').all()
            res.status(200).json(stmt)
        } catch {
            console.error('could not access database')
        }
    });

    
    // Perform error test
    app.get('/app/error',  (req, res) => {
        throw new Error('Error test successful.')
    });

}


// Default response for any other request
app.use(function (req, res) {
    res.status(404).send('404 NOT FOUND')
});

process.on('SIGTERM', () => {
    server.close(() => {
        console.log('Server stopped')
    })
})


// Coin flip functions

function coinFlip() {
    return Math.floor(Math.random() * 2) < 1 ? 'heads' : 'tails';
}

function coinFlips(flips) {
    const flipResults = [];

    const output = { raw: [], summary: "" };

    for (var i = 0; i < flips; i++) {
        flipResults.push(coinFlip());
    }

    output.raw = flipResults;
    output.summary = countFlips(flipResults);

    return output;
}

function countFlips(array) {
    var counts = { heads: 0, tails: 0 };

    array.forEach(element => {
        if (element == "heads")
            counts.heads++;
        else
            counts.tails++;
    });

    if (counts.heads == 0)
        delete counts.heads;
    else if (counts.tails == 0)
        delete counts.tails;

    return counts;

}

function flipACoin(call) {
    var result = coinFlip();

    const output = { call: "", flip: "", result: "" };

    output.call = call;
    output.flip = result;
    output.result = (call == result ? "win" : "lose");

    return output;
}