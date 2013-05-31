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

Operational Transformation
........

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


Version Control (GIT)
........

The underlying model in GIT is very similar in the regard that there is a graph of
changes, so called commits.
In contrast to the previous approach, the system identifies states by commits
and not by document versions. This is indeed important as there should
be a common sense between the user about the history of changes.

Thus, applying transformed changes as above do not lead to a common state:

![Commits](http://github.com/substance/chronicle/blob/master/images/vcs.jpg?raw=true)

These different paths of changes are so called branches.

To resolve this, one of the users has to decide how the branches are
merged. This decision is recorded by an extra change which is part of the commit
history. In the most cases the changes do not interfer, i.e., there are no conflicts. Then the merging can be
done automatically.

![Merge](http://github.com/substance/chronicle/blob/master/images/merge.jpg?raw=true)
