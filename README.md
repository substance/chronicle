Chronicle
=========

A git inspired versioning API based on Operational Transformations (OT).
The actual content to be versioned or a persistence mechanism is not addressed in this module.
Instead one would have to create an adapter which is implementing an OT interface.

> Current state:
>
> Chronicle is working, but should be considered experimental, though. There are
> some examples in our [test suite](https://github.com/substance/tests/tree/master/tests/chronicle).
>
> We are refactoring our [`data.js`](https://github.com/michael/data) library
> to use operational transformations.
> This way we achieve to provide a means to add versioning to anything that can
> be modelled with `data.js`

Theory
--------

### Operational Transformation

With Operational Transformations changes to a document are done via so called operations.
Operations are invertible and can be concatenated constituting a graph of document versions
that can be created by applying operations.

![Operations](http://github.com/substance/chronicle/blob/master/images/graph.jpg?raw=true)

OT has its application in real-time collaborative editing, i.e., two or more users edit a
document simultanously, e.g., as it is possible with Google Docs.
The OT theory defines a special transformation describes how a temporary divergence can
be resolved when two user change the document
at the same time, to ensure that the users continue to see and work on exactly the
same document content.

![Transformation](http://github.com/substance/chronicle/blob/master/images/trafo.jpg?raw=true)

    transform(a, b) = (a', b')

The transformation creates two (new) changes `a'` and `b'` which can be applied
to the original versions to achieve a common state.

### Version Control

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
In very many cases the changes of different users do not interfer, i.e., they are not
conflicting. Then, a merge typically can be applied automatically.

![Merge](http://github.com/substance/chronicle/blob/master/images/merge.jpg?raw=true)

Conflicting changes are not addressed by the OT. E.g., if two users add the same text
at the same time it will be there twice.

A different important aspect in VCS is to have control about what changes exactly are merged
into the common repository. In the OT usecase all users have the same role and permissions.
Contrarily, in VCS typically there are gate-keepers who ensure quality of commits, etc.


### Operational Tranform based Version-Control

A great part for implementing a VCS is already given by the OT framework.
However, there are minor conceptual differences which need a bit of an algorithmic foundation.

We introduce two basic operations that can be derived from the OT framework
and form the basic toolset for the algorithms used for Versioning.

- Principal Rebase: this is a straight-forward extension of the transform operator
  which can be applied to on graphs.

- Elimination: this allows to eliminate the effect of a change by rebasing a graph on
  the parent of the change to be eliminated.

Additionally, we will have to add conflict detection.

#### Principal Rebase

Rebasing is an operation which transplants a change (or sub-graph) to a new target parent.
We call a principal rebase, those where the two involved changes are siblings.

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

Now let us consider a more general case, e.g., in the above example we would want to
rebase change `c` onto `a`.
To reduce this problem to the previous case, we need to eliminate change `b`.
As all changes are invertible we can introduce an inversion of `b`.
Then we can apply the following transformation to achieve the desired change `c'`.

    transform(inv(b), c) = (inv(b)' , c')

![Merge](http://github.com/substance/chronicle/blob/master/images/reduction-1.jpg?raw=true)

![Merge](http://github.com/substance/chronicle/blob/master/images/reduction-2.jpg?raw=true)

As before, to propagate this reduction through a sub-graph we would apply
the transformation to all children recursively.

#### Conflict detection

In contrast to online collaborative editing, for a VCS it is necessary to detect conflicting
changes. Such conflicts would not be merged silently, but the user would decide what to do.
Conflicts are domain specific, i.e., the operations need to detect such cases.
In *Chronicle* we decided not to add a statical detection mechanism but instead
introduce an option `check` in the OT `transform` method. If the option is enabled,
`transform` is expected to throw a dedicated error, `errors.MergeConflict`,
which contains the two operations causing a conflict.

#### Merge

The most complex operation in *Chronicle* is merging. All merging strategies are mapped
to the case of a manually defined sequence of changes.

Given two branches `a = (a_1, ..., a_k)` and `b = (b_1, ..., b_r)`, a merge `m` defines
a sequence of changes of `a` and `b`.
Let `m_a` and `m_b` be the intersection of `m` with `a` and `b`, respectively.

> Note: at the moment, it is not possible to reorder changes, i.e., the changes in `m_a`
  must have the same order as in `a`, and the same with `m_b` and `b`.

A merge can thus be achieved by the following steps:

1. Reduce `a` to `m_a`: [eliminate](http://github.com/substance/chronicle#elimination)
   all changes in `a` that are not in `m_a`.
   This has to be done in reverse order, i.e., from right to left, as not to violate
   dependencies of changes.
   In other words, it is always better to revert changes from right to left (newer to older).

> Note: the elimination will create temporary branches. The original changes stay untouched.

> TODO: add an illustration

2. Reduce `b` to `m_b`: same procedure as with `a`.

3. Merge `m_a` and `m_b`: this is done by iteratively apply a
   [Principal Rebase](http://github.com/substance/chronicle#principal-rebase).

#### Rebase

A rebase can be derived from the merge implementation.

Consider this situation:

> TODO: add illustration showing two branches a and b having a common root r

Rebasing `b_r` onto `a_k` is done by:

1. [Eliminating](http://github.com/substance/chronicle#elimination)
   `b_{r-1}, ..., b_1` which results in b_r'

> TODO: add illustration showing a transformed b_r' as sibling of a_1 and b_1

2. Iteratively rebase b_r' onto `a_1` to `a_k`

> TODO: add illustration showing a transformed b_r as sibling of a_1

This of course would fail, if `b_r` was depending on any of the eliminated changes.

> Note: not yet implemented.
