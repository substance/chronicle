(function(root) {

var _ = root._;
var $jit = root.$jit;

// HACK: need to override the default move implementation as it is too noisy
// i.e., it moves all the time
var inhibitMove = function(graph) {

  var __move__ = graph.move;
  var minx = -100,
      maxx = 600,
      miny = -100,
      maxy = 50;
  graph.move = function(node, onComplete) {
    var x = node.endPos.x;
    var y = node.endPos.y;

    // Note: to inhibit the move we have to the negative of node.endPos
    // and overwrite onComplete.Move
    // Additionally, we compute an ALAP move (As Lazy As Possible ;) )
    var movx = -x, movy = -y;
    if (x > maxx) movx += x - maxx;
    if (x < minx) movx -= minx - x;
    if (y > maxy) movy += y - maxy;
    if (y < miny) movy -= miny - y;
    onComplete.Move.offsetX = movx;
    onComplete.Move.offsetY = movy;

    __move__.call(graph, node, onComplete);
  };
};

var ChronicleView = function(controller, options) {
  options = options || {};
  var self = this;
  this.controller = controller;

  var jitOptions = {

    // create from top to down
    orientation: "left" || options.orientation,

    // do not collapse unselected branches
    constrained: false,

    // container element id
    injectInto: 'chronicle',

    //animation duration
    duration: 100,

    //transition type
    transition: $jit.Trans.Back.easeInOut,

    //distance between node and its children
    levelDistance: 20,

    Navigation: {
      enable:true,
      panning:false
    },

    Node: {
      height: 20,
      width: 60,
      type: 'rectangle',
      color: '#aaa',
      overridable: true
    },

    Edge: {
      type: 'line',
      overridable: true
    },
  };

  jitOptions = _.extend(jitOptions, options);

  //This method is called on DOM label creation.
  //Use this method to add event handlers and styles to
  //your node.
  jitOptions.onCreateLabel = function(label, node){
    label.id = node.id;
    label.innerHTML = node.name;
    label.onclick = function(){
      self.controller.open(node.id);
    };
    //set label styles
    var style = label.style;
    style.width = node.Node.width + 'px';
    style.height = node.Node.height + 'px';
  };

  // HACK: setting colors... should be done via classes
  jitOptions.onBeforePlotNode = function(node){
    if (node.selected) {
      if (node.id === self.tree.main_node) {
        node.data.$color = "rgb(102, 182, 32);";
      } else {
        node.data.$color = "#D5EAB1";
      }
    }
    else {
      node.data.$color = "#ddd";
    }
  };

  this.tree = new $jit.ST(jitOptions);
  this.controller.on("index:add", this.addChange, this);
  this.controller.on("index:setRef", this.onSetRef, this);
  this.controller.on("chronicle:open", this.onOpen, this);

  // Override the eager moving behaviour
  inhibitMove(this.tree);

  this.tree.loadJSON({
      id: "ROOT",
      name: "ROOT",
      data: {},
      children: []
  });
  this.tree.main_node = "ROOT";
  //need to emulate a click on the root node to initialize the graph correctly.
  this.tree.onClick("ROOT");

  this.loadGraph();

  // compute node positions and layout
  this.tree.compute();

  this.silent = false;
};

ChronicleView.__prototype__ = function() {

  this.loadGraph = function() {
    var controller = this.controller;

    var queue = ["ROOT"];
    var id, change;
    while (queue.length > 0) {
      id = queue.shift();
      change = controller.get(id);
      this.addChange(change, "silent");
    }

    this.tree.refresh();
  };

  this.addChange = function(change, silent) {

    silent = silent || this.silent;

    if (change.id === "ROOT") return;

    // do not show hidden nodes
    if (change.type === "transformed") return;

    var label;
    if (this.getLabel) label = this.getLabel(change);
    else label = change.id.substring(0,4);
    var newNode = {
      id: change.id,
      name: label,
      data: change,
      children: []
    };

    this.tree.graph.addNode(newNode);

    var parent;
    if (change.type === "merge") {
      for (var idx = 0; idx < change.branches.length; idx++) {
        parent = this.tree.graph.getNode(change.branches[idx]);
        this.tree.graph.addAdjacence(parent, newNode);
      }
    } else {
      parent = this.tree.graph.getNode(change.parent);
      this.tree.graph.addAdjacence(parent, newNode);
    }

    if (!silent) {
      this.tree.refresh();
    } else {
      this.tree.compute();
    }
  };

  this.onSetRef = function(name, ref) {
    console.log("set ref", name, ref);
  };

  this.onOpen = function(id) {
    this.select(id);
  };

  this.select = function(id) {
    this.tree.main_node = id;
    if (!this.silent) {
      this.tree.onClick(id);
    } else {
      this.tree.select(id);
    }
  }
};
ChronicleView.prototype = new ChronicleView.__prototype__();

root.ChronicleView = ChronicleView;

})(this);
