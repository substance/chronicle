(function(root) {

var util = root.Substance.util;
var Chronicle = root.Substance.Chronicle;
var ot = root.ot;

var TextOperationAdapter = function(chronicle, doc) {
  Chronicle.Versioned.call(this, chronicle);
  this.doc = doc;
};

TextOperationAdapter.__prototype__ = function() {

  var __super__ = util.prototype(this);

  this.apply = function(change) {
    this.doc.setText(change.apply(this.doc.getText()));
  };

  this.invert = function(change) {
    return change.invert();
  };

  this.transform = function(a, b) {
    return ot.TextOperation.transform(a, b);
  };

  // TODO: This should be added to TextOperation
  ot.TextOperation.prototype.isEmpty = function() {
    if (!this.ops) return true;

    for (var idx = 0; idx < this.ops.length; idx++) {
      if (!ot.TextOperation.isRetain(this.ops[idx])) return false;
    }
    return true;
  }

  function isConflict(pos1, op1, pos2, op2) {

    // retains are never conflicting
    if (TextOperation.isRetain(op1) || TextOperation.isRetain(op2)) {
      return false;
    }

    // Inserts are conflicts if they are at the same position
    // or within an deleted area
    if (pos1 === pos2 && TextOperation.isInsert(op1) && TextOperation.isInsert(op2)) {
      return true;
    }
    if (TextOperation.isInsert(op1) && TextOperation.isDelete(op2)) {
      return pos1 >= pos2 && pos1 <= pos2 - op2;
    }
    if (TextOperation.isDelete(op1) && TextOperation.isInsert(op2)) {
      return pos2 >= pos1 && pos2 <= pos1 - op1;
    }

    // Deletes are conflicts when their ranges overlap
    if (TextOperation.isDelete(op1) && TextOperation.isDelete(op2)) {
      if (pos1 > pos2 - op2 || pos2 > pos1 - op1) return false;
      else return true;
    }

    throw new Error("Illegal state");
  }

  // TODO: this should be integrated into ot.TextOperation
  this.conflict = function(a, b) {

    if (a.baseLength !== b.baseLength) {
      throw new Error("Incompatible operations");
    }

    var conflict = [new ot.TextOperation(), new ot.TextOperation()];
    var idx = [0, 0];
    var op = [0, 0];
    var s = [0, 0];
    var mark = [false, false];
    var i;

    while (idx[0] < ops[0].length && idx[1] < ops[1].length) {

      for (i = 0; i < 2; i ++) {
        if (s[i] === 0) {
          op[i] = ops[idx[i]++];
          s[i] = TextOperation.isInsert(op[i]) ? 0 : Math.abs(op[i]);
          mark[i] = false;
        }
      }

      if (isConflict(op[0], op[1])) {
        for (i = 0; i < 2; i ++) {
          if (!mark[i]) conflict[i].ops.push(op[i]);
          mark[i] = true;
        }
      }

      s[0] -= Math.min(s[0], s[1]);
      s[1] -= Math.min(s[0], s[1]);

      // this should not happen, as always one of the ops should be consumed
      if (s[0] !== 0 && s[1] !== 0) throw new Error("Fix me");
    }

    if (conflict[0].isEmpty() || conflict[1].isEmpty()) {
      return false;
    } else {
      return conflict;
    }

  };

  this.reset = function() {
    __super__.reset.call(this);
    this.doc.setText("");
  };

};

TextOperationAdapter.__prototype__.prototype = Chronicle.Versioned.prototype;
TextOperationAdapter.prototype = new TextOperationAdapter.__prototype__();

Chronicle.TextOperationAdapter = TextOperationAdapter;

})(this);
