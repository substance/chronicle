Chronicle
=========

A git inspired versioning API based on Operational Transformations (OT).
The actual content to be versioned or a persistence mechanism (repository) is not addressed in this module.
Instead one would have to create an Adapter which is implementing an Operational Transform interface.

> Note: The module is only some days old - so, hey... it's still a baby.

Current state:

- Graph implementation that allows to work with versions as we know it from GIT: branching, merging, rebasing etc.
- Theoretical foundation for mapping VCS concepts to the OT theory.
- Adapter for using Text operation ot (see (https://github.com/Operational-Transformation) ).

Theory
--------

### Operational Transformation

With Operational Transformations changes to a document are done via so called operations.
Operations are invertible and can be concatenated constituting a graph of document versions
that can be created by applying operations.

![Operations](http://github.com/substance/chronicle/blob/master/images/graph.jpg?raw=true)

OT has its application in real-time collaborative editing, i.e., two or more users edit a
document simultanously, e.g., as it is possible with Google Docs.
The OT theory defines a special transformation describes how a temporary divergence can be resolved when two user change the document
at the same time, to ensure that the users continue to see and work on the exactly same document content.

![Transformation](http://github.com/substance/chronicle/blob/master/images/trafo.jpg?raw=true)

    transform(a, b) = (a', b')

The transformation creates two (new) changes `a'` and `b'` which can be applied
to the original versions to achieve a common state.

### Version Control (GIT)

The underlying model in GIT is very similar in the regard that there is a graph of
changes, so called commits.
In contrast to the previous approach, the system identifies states by commits
and not by document versions. This is indeed important as there should
be a common sense between the user about the history of changes.
Thus, applying transformed changes as above do not lead to a common state:

![Commits](http://github.com/substance/chronicle/blob/master/images/commits.jpg?raw=true)

Different paths of changes are called branches.
To be ables to have a common base to work on, one would need to bring branches
together again, what is called a *merge*.
One of the users would decide to merge and record his decision as an extra change.
In very many cases the changes of different users do not interfer, i.e., they are no conflicting.
Typically, a merge can be done automatically then.

![Merge](http://github.com/substance/chronicle/blob/master/images/merge.jpg?raw=true)

Conflicting changes are not addressed by the OT. E.g., if two users add the same text at the same time
it will be there twice.

A different important aspect in VCS is to have control about what changes exactly are merged
into the common repository. In the OT usecase all users have the same role and permissions.
Contrarily, in VCS typically there are gate-keepers who ensure quality of commits, etc.


### Operational Tranform based Version-Control

A great part for implementing a GIT-style VCS is already given by the OT framework.
However, there are minor conceptual differences which need a bit of an algorithmic foundation.

We introduce two basic operations that can be derived from the OT framework
and form the basic toolset for the algorithms used for Versioning.

- Principal Rebase: this is a straight-forward extension of the transform operator
  which can be applied to on graphs.
  
- Elimination: this allows to eliminate the effect of a change by rebasing a graph on
  the parent of the change to be eliminated.

Additionally, we will have to add conflict detection.

#### Principal Rebase

Rebasing is in git the operation to transplanting a change (or sub-graph)
to a new target parent.
We call a principal rebase, those where the target of the rebase is a sibling of
the change to be rebased.

Consider the following situation:

![Merge](http://github.com/substance/chronicle/blob/master/images/rebase-1.jpg?raw=true)

Rebasing the change `b` onto change `a` would give a sequence of (new) changes `b'`, and `c'`.

![Merge](http://github.com/substance/chronicle/blob/master/images/rebase-2.jpg?raw=true)

Let us first consider only this special kind of rebase-scenarios, where the
two changes `a` and `b` are siblings.

The case with only two changes involved is directly covered by the `transform` operation.

    transform(a,b) = (a', b')

![Merge](http://github.com/substance/chronicle/blob/master/images/rebase-3.jpg?raw=true)

This can be extended iteratively to the case with children changes.

    transform(a', c) = (a'', c')

![Merge](http://github.com/substance/chronicle/blob/master/images/rebase-4.jpg?raw=true)


#### Elimination

Now let us consider a more general case, e.g., in the above example we would want to rebase change `c` onto `a`.
To reduce this problem to the previous case, we need to eliminate change `b`.
As all changes are invertible we can introduce an inversion of `b`.
Then we can apply the following transformation to achieve the desired change `c'`.

    transform(inv(b), c) = (inv(b)' , c')

![Merge](http://github.com/substance/chronicle/blob/master/images/reduction-1.jpg?raw=true)

![Merge](http://github.com/substance/chronicle/blob/master/images/reduction-2.jpg?raw=true)

As before, to propagate this reduction through a sub-graph we would apply
the transformation to all children recursively.

#### Conflict detection

TODO: coming soon.

We will try to describe the concept of a conflict in general, and how OT libraries
can be adapted to give this information, using the example of Text Operations and Array Operations.

#### Algorithms

TODO: coming soon.

We will describe the major algorithms formally.
