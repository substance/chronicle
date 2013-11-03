var IndexedDbBackend = function(config, index) {
  this.config = config;
  this.index = index;

};

IndexedDbBackend.Prototype = function() {

  this.sync = function(cb) {

  };

};

IndexedDbBackend.prototype = new IndexedDbBackend.Prototype();

module.exports = IndexedDbBackend;
