# ADR 0001: Libraries used alongside ui-sdk

- Status: accepted
- Date: 2026-11-15

## Context

ui-sdk is the base for every interactive element. Its component set has no data table, no chart and no skeleton placeholder, all of which the statistics and playlist screens need.

## Decision

| Need | Choice | Built on | Why |
| --- | --- | --- | --- |
| Data tables (history, playlist items) | TanStack Table | Headless table state (sorting, filtering, pagination, row selection); renders our own markup | Headless like ui-sdk, so styling and markup stay ours; same TanStack family as the query layer |
| Charts | Recharts | React + SVG (D3 scales) | Declarative React API, covers bar/line/area/radial charts, composable with our tokens |
| Loading placeholders | Own `Skeleton` components | Plain styled elements, no behavior | Purely visual and non-interactive, so no behavior library is involved |

Interactive parts inside these (row selection, sort toggles, menus, tooltips on non-chart elements, drag to reorder) still use ui-sdk behaviors and components, e.g. `createReorder`, `createSelection`, `createVirtualizer`, Menu, Tooltip.

## Consequences

- Any further library outside ui-sdk needs the same treatment: owner approval and an ADR stating what it is built on and why.
- Chart tooltips and legends come from Recharts; their keyboard accessibility is checked when the charts are built.
