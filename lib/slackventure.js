'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var SlackVenture = function Constructor(settings) {
    this.settings = settings;
    this.settings.name = this.settings.name || 'slackventure';
    this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'slackventure.db');

    this.user = null;
    this.db = null;
    this.currentTeam = null;
};

// inherits methods and properties from the Bot constructor
util.inherits(SlackVenture, Bot);

module.exports = SlackVenture;

SlackVenture.prototype.run = function () {
    SlackVenture.super_.call(this, this.settings);

    this.on('start', this._onStart);
    this.on('message', this._onMessage);
};

SlackVenture.prototype._onStart = function () {
    this._loadBotUser();
    this._connectDb();
    this._firstRunCheck();
};

SlackVenture.prototype._loadBotUser = function () {
    var self = this;
    this.user = this.users.filter(function (user) {
        return user.name === self.name;
    })[0];
};

SlackVenture.prototype._connectDb = function () {
    if (!fs.existsSync(this.dbPath)) {
        console.error('Database path ' + '"' + this.dbPath + '" does not exists or it\'s not readable.');
        process.exit(1);
    }

    this.db = new SQLite.Database(this.dbPath);
};

SlackVenture.prototype._firstRunCheck = function () {
    var self = this;
    var teamID = self.team.id;
    this.currentTeam = teamID;

    self.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var currentTime = (new Date()).toJSON();


        // this is a first run
        if (!record) {
            self._welcomeMessage();
            //Store the team ID to help track the story later, as well as the first story state if it's not set already
            self.db.run('INSERT INTO teams(team, story_step) VALUES("' + teamID + '", 0)');

            return self.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
        }

        // updates with new last running time
        self.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
    });
};

SlackVenture.prototype._welcomeMessage = function () {
    this.postMessageToChannel(this.channels[0].name, 'Hi!' +
        '\n You just added SlackVenture! This bot is a choose your own adventure -- for teams! Reply with "go" and we can get started.',
        {as_user: true});
};

SlackVenture.prototype._onMessage = function (message) {
    if (this._isChatMessage(message) &&
        this._isChannelConversation(message) &&
        !this._isFromSlackVenture(message)
    ) {
        this._tellTheStory(message);
        console.log(message);
    }
};

SlackVenture.prototype._isChatMessage = function (message) {
    return message.type === 'message' && Boolean(message.text);
};

SlackVenture.prototype._isChannelConversation = function (message) {
    return typeof message.channel === 'string' &&
        message.channel[0] === 'C';
};

SlackVenture.prototype._isFromSlackVenture = function (message) {
    return message.user === this.user.id;
};

SlackVenture.prototype._tellTheStory = function (originalMessage) {
    var self = this;
    var teamID = this.currentTeam;

    //Compare the current team's story step to where it should be
    self.db.get('SELECT * FROM teams WHERE team = "'+teamID+'"',function (err, testteam) {
      if (err) {
            return console.error('DATABASE ERROR:', err);
        }
      console.log("DB team match: " + testteam);
    });


    self.db.get('SELECT id, joke FROM jokes ORDER BY used ASC, RANDOM() LIMIT 1', function (err, record) {
        if (err) {
            return console.error('DATABASE ERROR:', err);
        }

        var channel = self._getChannelById(originalMessage.channel);
        self.postMessageToChannel(channel.name, record.joke, {as_user: true});
        self.db.run('UPDATE jokes SET used = used + 1 WHERE id = ?', record.id);
    });
};

SlackVenture.prototype._getChannelById = function (channelId) {
    return this.channels.filter(function (item) {
        return item.id === channelId;
    })[0];
};