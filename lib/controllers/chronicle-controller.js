(function(root) {

var util = root.Substance.util;

var ChronicleController = function(chronicle) {
  var self = this;

  var __add__ = chronicle.index.add;
  chronicle.index.add = function(change) {
    __add__.call(chronicle.index, change);
    self.trigger("index:add", change);
  };

  var __setRef__ = chronicle.index.setRef;
  chronicle.index.setRef = function(name, ref) {
    __setRef__.call(chronicle.index, name, ref);
    self.trigger("index:setRef", name, ref);
  };

  var __reset__ = chronicle.reset;
  chronicle.reset = function(id, index) {
    __reset__.call(chronicle, id, index);
    self.trigger("chronicle:open", id);
  };

  this.get = function(id) {
    return chronicle.index.get(id);
  };

  this.open = function(id) {
    return chronicle.reset(id);
  };

  this.getState = function() {
    return chronicle.getState();
  };

};
ChronicleController.prototype = _.extend(ChronicleController.prototype, util.Events);

root.Substance.ChronicleController =  ChronicleController;

})(this);
