'use strict';

const express = require('express');
// Import Botkit's cor features
const { Botkit } = require('botkit');
// const { BotkitCMSHelper } = require('botkit-plugin-cms');

const { WebAdapter } = require('botbuilder-adapter-web');
const { MongoDbStorage } = require('botbuilder-storage-mongodb');

// Load process.env values from .env file
require('dotenv').config();

let storage = null;
if (process.env.MONGO_URI) {
    storage = mongoStorage = new MongoDbStorage({
        url : process.env.MONGO_URI,
    });
}

const adapter = new WebAdapter({});
const controller = new Botkit({
    debug: true,
    webhook_uri: '/api/messages',
    adapter: adapter,
    storage
});

// Once the bot has booted up its internal services, you can use them to do stuff.
controller.ready(() => {
  // load traditional developer-created local custom feature modules
  controller.loadModules(__dirname + '/features');

  /* catch-all that uses the CMS to trigger dialogs */
  // if (controller.plugins.cms) {
  //     controller.on('message,direct_message', async (bot, message) => {
  //         let results = false;
  //         results = await controller.plugins.cms.testTrigger(bot, message);

  //         if (results !== false) {
  //             // do not continue middleware!
  //             return false;
  //         }
  //     });
  // }

});




// // Constants
// const PORT = 8080;
// const HOST = '0.0.0.0';

// App
// const app = express();
// app.get('/', (req, res) => {
//   res.send('Hello World, This is updated from outside of container. changed again! ');
// });

// app.listen(PORT, HOST);
// console.log(`Running on http://${HOST}:${PORT}`);
