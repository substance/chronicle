var Test = require("substance-test");
global._ = require('underscore');

require("./index");

new Test.MochaRunner().run();
