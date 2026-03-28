# Node Style Rollback And Decision Geometry Design

## Summary

This document records why the recent node-side interaction pass regressed the canvas, what should be rolled back now, which edge-side improvements remain valid, and what constraints the next decision-node design must obey.

Current decision:

- Roll back node and style-layer changes from the last pass.
- Keep edge interaction improvements that are already behaving correctly.
- Do not attempt a new decision-node geometry implementation in the same pass.

## What Went Wrong

### 1. A local problem was solved with global node selectors

The regression did not come from the decision node alone. The implementation changed shared selectors and shared node structure:

- `.diagram-node`
- `.rf-node`
- `.rf-group`
- `.diagram-quick-connect`
- group/node wrapper pointer handling

Because those selectors are shared by every node type, start/process/terminator nodes all changed together.

### 2. The decision node was still modeled as a clipped rectangle

The failed attempt treated the decision node as an axis-aligned box with an internal clipped surface. That is not equivalent to the intended visual model: a square rotated by 45 degrees.

This means the design stayed semantically rectangular even when it looked diamond-like. As a result:

- geometry-specific metadata leaked into shared node plumbing
- visual changes did not match the intended shape semantics
- future geometry fixes would still be built on the wrong abstraction

### 3. Quick-connect arrows competed with handles instead of orbiting them

The button placement logic moved the quick-connect affordances onto the handle centers instead of outside them. This created direct competition between:

- the existing connection points
- the new quick-connect buttons

Visually, arrows covered the handles. Interaction-wise, users lost the clear spatial relationship between “connection point” and “quick-create action”.

### 4. Hit-testing fixes were too broad

To preserve edge clicking through swimlanes and node overlays, the implementation widened wrapper-level hit-testing changes. That solved some interaction paths, but it also made the node layer harder to reason about and amplified side effects.

The only hit-testing change worth retaining now is the minimal swimlane pass-through needed to keep the new edge selection behavior usable.

## Roll Back Now

Roll back these changes:

- shared node wrapper restructuring (`diagram-node__surface`, `diagram-node__hover-shell`)
- node geometry metadata threaded through the generic node renderer
- global node-style rewrites that affected all node types
- quick-connect button repositioning that overlaps handles
- tests that specifically validate the reverted node-side behavior

Keep these changes:

- custom edge renderer
- wider edge interaction stroke
- visible selected-edge endpoint hints
- direct double-click edge label editing
- browser and App tests that validate the retained edge behavior

## Constraints For The Next Decision-Node Pass

The next pass must treat the decision node as a decision-node-only problem.

Required constraints:

1. Shared node DOM must remain stable for start/process/terminator nodes.
2. Decision-node geometry must not be introduced as shared metadata unless multiple node types truly consume it.
3. Quick-connect affordances must sit outside the visible connection points, not on top of them.
4. The decision node should be designed as a rotated square model, not as a clipped rectangle approximation.
5. Any hit-testing changes should be local to the affected interaction path, not wrapper-wide by default.

## Acceptance Criteria After Rollback

- Start/process/terminator nodes match the pre-regression visual baseline.
- Decision nodes return to the previous stable appearance.
- Quick-connect buttons no longer cover the existing handles.
- Edge selection still works through the visible path.
- Double-clicking an edge still opens the label editor directly.
- Existing retained edge tests continue to pass.
