chronicle
=========

A git inspired versioning API based on Operational Transformations (OT).
The actual target, i.e., the content to be versioned or and a concrete storage (repository)
is not part of this module.
Instead one would have to create an Adapter which is implementing an
OT interface.

*ATTENTION:* The module is not yet ready to use.

Current state:

- Graph implementation that allows to work with versions as we know it from GIT:
  branching, merging, rebasing etc.
- Theoretical foundation for mapping VCS concepts to the OT theory.

Theory
--------

### Operational Transformation

Operational Transformations consider changes to a document as operations.
Operations are invertible and can be concatenated building a graph of
versions connected by changes.

![Operations](http://github.com/substance/chronicle/blob/master/images/graph.jpg?raw=true)

To allow collaborative editing where two or user edit a document simultanously
a special transformation is adopted to make sure every single user has
the same version.

![Transformation](http://github.com/substance/chronicle/blob/master/images/trafo.jpg?raw=true)

    transform(a, b) = (a', b')

The transformation generates two changes `a'` and `b'` which can be applied
to the original versions to achieve a common state.


### Version Control (GIT)

The underlying model in GIT is very similar in the regard that there is a graph of
changes, so called commits.
In contrast to the previous approach, the system identifies states by commits
and not by document versions. This is indeed important as there should
be a common sense between the user about the history of changes.

Thus, applying transformed changes as above do not lead to a common state:

![Commits](http://github.com/substance/chronicle/blob/master/images/commits.jpg?raw=true)

These different paths of changes are so called branches.

To resolve this, one of the users has to decide how the branches are
merged. This decision is recorded by an extra change which is part of the commit
history. In the most cases the changes do not interfer, i.e., there are no conflicts. Then the merging can be
done automatically.

![Merge](http://github.com/substance/chronicle/blob/master/images/merge.jpg?raw=true)

A different aspect, that plays an important in version-controlling in the wild, is to have
control about what and how changes are merged. In the case of Real-Time Collaborative Text-Editing,
the users have the same role and permissions. In VCS typically there are gate-keepers who ensure
quality of commits, etc.

### Operational Tranform based Version-Control

The greatest part for implementing a GIT-style Version-Control-System
is already given by the OT framework.

There are only minor things which need a bit of algorithmic foundation to map
to the OT interface.

#### Rebase

Rebasing is an operation in GIT which allows you to replay changes on the base
of a new parent.

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


### Reduction

Now let us consider a more general case, e.g., in the above example
we would want to rebase change `c` onto `a`.
To reduce this problem to the previous case, we need to eliminate change `b`.

As all changes are invertible we can introduce an inversion of `b`.

![Merge](http://github.com/substance/chronicle/blob/master/images/reduction-1.jpg?raw=true)

Applying a transformation

    transform(inv(b), c) = (inv(b)' , c')

provides the desired change `c'`.

![Merge](http://github.com/substance/chronicle/blob/master/images/reduction-2.jpg?raw=true)

As befor, to propagate this reduction through a sub-graph we would apply
a transformation with `inv(b)'` to the children, and so forth.


### Merge

Based on these two basic concepts one can realize every merge strategy.
I will add some more details about that here, later.
