'use strict';

var SlackVenture = require('../lib/slackventure');

var token = process.env.BOT_API_KEY;
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME;

var slackventure = new SlackVenture({
    token: token,
    dbPath: dbPath,
    name: name
});

slackventure.run();