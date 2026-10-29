# India Overview — Technical Specification & UI/UX Plan

Oct 29, 2026 · @Vijaylaxmi

## Summary

Add an **India Overview** page to the Management sidebar. It opens on a world map, zooms into India on one click, and shows India split into five labelled regions: North, South, East, West and Central. Build it as an SVG map with D3 (`d3-geo`, `d3-zoom`) inside the existing React 18 + Vite + Tailwind client. No map tiles, API keys or new backend are needed for the first release.

**Goals**

- Management users reach the page from the sidebar in one click.
- Moving from world view to India view, and from India to a single region, takes one click each and animates smoothly.
- All five regions are labelled and visible at once in India view, with no overlapping labels at 1280 px width.
- The page uses the dashboard's existing theme tokens, so it works in both light and dark mode.
- India's boundary meets Survey of India rules for maps shown in India (see Risks).

**Out of scope for v1:** region-level KPI data and drill-down to individual plants. The layout reserves a side panel for this (see Open questions).

## Navigation and access

Add one entry to `managementLinks` in `client/src/components/layout/Sidebar.jsx`, directly after **KMI/Global Objectives**, and one route in `client/src/routes/AppRoutes.jsx`.

| Item | Value |
| --- | --- |
| Menu label | India Overview |
| Menu icon | 🗺️ (matches the emoji icons used by the other entries) |
| Route | `/management/india-overview` |
| Route wrapper | `ProtectedRoute` → `RoleRoute allowedRoles={['management']}` → `DashboardLayout` |
| Page component | `client/src/pages/management/IndiaOverview.jsx`, lazy-loaded with `React.lazy` |
| Deep links | `?view=india` and `?region=north` restore the zoom level on refresh or when a link is shared |

Lazy loading keeps the map code and geometry (about 150–250 KB gzipped) out of the main bundle, which is already 2.5 MB. Admin users can get the same entry later by adding it to `adminLinks`.

Note: `RoleRoute` compares `user.role` exactly, while `Sidebar.jsx` lowercases it and also checks `user.role.name`. Confirm the stored value (for example `management` or `Management`) before setting `allowedRoles`, or normalise both checks the same way.

## UI/UX design

The page fills the viewport below the app header, like the redesigned Management dashboard. It has three zones: a header bar, the map canvas, and a side panel.

```
+--------------------------------------------------------------------------+
| India Overview     World › India › North                   [Reset view]  |
+--------------------------------------------------+-----------------------+
| Map canvas (SVG)                                 | Regions               |
| World, India or one region; wheel, pinch, drag   | +-------------------+ |
|                                                  | | ● North · 8       | |
|                 ● North                          | +-------------------+ |
|                                                  | | ● Central · 4     | |
|                      ● Central    ● East         | +-------------------+ |
|                                                  | | ● East · 13       | |
|            ● West                                | +-------------------+ |
|                                                  | | ● West · 4        | |
|                    ● South                 [+]   | +-------------------+ |
|                                            [−]   | | ● South · 7       | |
| [ Region legend ]                     zoom [↺]   | +-------------------+ |
|                                                  | Selected region       |
|                                                  | States in the region  |
|                                                  | KPI data (v2)         |
+--------------------------------------------------+-----------------------+
  Below 1024 px the side panel moves under the map.
```

| Zone | Contents | Size at ≥ 1024 px | Below 1024 px |
| --- | --- | --- | --- |
| Header bar | Title, breadcrumb (World › India › North), Reset view button | Full width, `dashboard-panel-header` style | Same; breadcrumb wraps |
| Map canvas | SVG map, zoom +/− and reset buttons bottom-right, region legend bottom-left | Remaining width, full height | Full width, 60% of height |
| Side panel | List of the five regions; details of the selected region (states in it; KPI data once a source is agreed) | 320 px wide | Below the map, scrolls on its own |

**Visual style**

- Use the existing CSS tokens (`--surface`, `--border`, `--accent`, `--text-primary`, `--text-muted`) so light and dark mode work with no extra code.
- Countries other than India: `--surface-hover` fill with `--border` outlines. India: `--accent` at 25% opacity in world view.
- Regions use five fixed, colour-blind-safe hues, checked for contrast on both themes. The legend and the side-panel list repeat each colour beside its name, so colour is never the only cue.
- Region labels are 13 px, weight 700, with a 3 px halo in the page background colour so they stay readable over any fill. State names appear only once the user zooms into a single region.

## Interaction design

The map has three views, and every move between them is a single animated zoom of 750 ms.

```
              click India                 pick region
 +--------------+  ------>  +--------------+  ------>  +----------------+
 |  World view  |           |  India view  |           |  Region view   |
 |    India     |  <------  |  5 regions   |  <------  |  One region +  |
 | highlighted  |    Esc    | labelled +   |    Esc    |  state names   |
 +--------------+           |    pins      |           +----------------+
        ^                   +--------------+                   |
        |                                                      |
        +---------------- Reset view, from any level ----------+

 Wheel, pinch and drag zoom work in every view, from 1x (world) to 12x past the India view.
```

| View | What is shown | Enter by | Leave by |
| --- | --- | --- | --- |
| World | All countries muted; India highlighted with an "India" label and a pulsing marker | Page load, Reset, Esc from India view | Click India, the marker, or the "Explore India" button |
| India | States filled by region colour; North, South, East, West and Central labels with a pin at each region centre; other countries faded to 30% | Click India; breadcrumb "India"; Esc from region view | Click a region, its pin, or its row in the side panel |
| Region | The chosen region fills the canvas; the other regions are dimmed; state names are shown; the side panel shows details | Click a region | Esc, breadcrumb, Reset, or clicking outside the region |

**Behaviour rules**

- **Hover** on a state highlights every state in its region (stroke 2 px, fill +15% opacity). A tooltip shows the region name and the number of states.
- **Free zoom**: mouse wheel, pinch and drag-pan work in every view. Zoom runs from 1× (whole world) to 12× beyond the India view, and panning is clamped so the map can't be dragged off screen. Labels counter-scale so they stay the same size on screen.
- **Keyboard**: the five region rows in the side panel are buttons, so Tab and Enter cover every action without the map. Esc moves up one level, and +/− zoom.
- **Screen readers**: the SVG has `role="img"` and an `aria-label` naming the current view. The side panel is the accessible version of the map, and every view change is announced in an `aria-live` region.
- **Reduced motion**: if `prefers-reduced-motion` is set, view changes jump instead of animating.
- **Touch**: tap does what click does. There is no hover on touch screens, so the side panel shows the region name and state count instead of a tooltip.

## Recommended tech stack

Use D3's geography and zoom modules to compute paths and transforms, and let React render the SVG. This keeps full control over styling and labels, adds no tile server or API key, and fits the existing Tailwind theme tokens.

| Layer | Choice | Why |
| --- | --- | --- |
| UI framework | React 18 + Vite + Tailwind (already in the client) | No new framework |
| Projection and paths | `d3-geo` (`geoNaturalEarth1`, rotated to centre on India; one projection for every view) | One projection means world → India → region is a single continuous zoom; small and actively maintained |
| Zoom and pan | `d3-zoom` + `d3-transition` | Wheel, pinch and drag; programmatic animated zoom-to-bounds; scale and pan limits |
| Geometry format | TopoJSON, decoded with `topojson-client` | Shared borders stored once, so files are smaller; `merge()` builds each region's outline from its states |
| World geometry | `world-atlas` (Natural Earth, 110m) | About 100 KB; enough detail for the world view |
| India geometry | [DataMeet](https://github.com/datameet/maps) `States/Admin2` (36 states/UTs, post-2020, CC BY 4.0), converted to TopoJSON with `mapshaper` | Shows the official boundary and is openly licensed; still needs compliance sign-off (see Risks) |
| Tooltips | A small React component positioned from pointer coordinates | Same look as `ChartTooltip` on the dashboard |
| Tests | Vitest + React Testing Library; Playwright for the zoom flow | Vitest fits Vite with no extra config |

Installed with exact versions: `d3-geo@3.1.1`, `d3-zoom@3.0.0`, `d3-selection@3.0.0`, `d3-transition@3.0.1`, `d3-interpolate@3.0.1`, `topojson-client@3.1.0`.

**Alternatives considered**

| Option | Verdict | Reason |
| --- | --- | --- |
| `react-simple-maps` | Fallback | Ready-made `ZoomableGroup` and `Marker` components make it faster to start, but releases have been infrequent, and it wraps the same D3 modules with less control |
| Leaflet / MapLibre + tiles | Rejected | Tile servers draw their own India border, which may not be compliant. It also needs a network connection and a tile provider, and is heavier |
| Apache ECharts geo | Rejected | Adds about 1 MB, and its styling system is separate from Tailwind and Recharts |
| Google Maps / Mapbox | Rejected | Needs API keys, is billed per load, and the border depiction is the provider's choice |

## Map data and region model

The regions are defined in one config file, `indiaRegions.js`. It maps each state code to a region, and the map builds every region outline from it at runtime with `topojson.merge`. Changing a state's region is a one-line edit.

The proposed grouping follows the government's five Zonal Councils, with the eight North-Eastern states added to East. It covers all 28 states and 8 union territories.

| Region | States and UTs | Count | Pin position (approx. lat, lon) |
| --- | --- | --- | --- |
| North | Jammu & Kashmir, Ladakh, Himachal Pradesh, Punjab, Chandigarh, Haryana, Delhi, Rajasthan | 8 | 29.5°N, 75.5°E |
| Central | Uttar Pradesh, Uttarakhand, Madhya Pradesh, Chhattisgarh | 4 | 23.8°N, 80.0°E |
| East | Bihar, Jharkhand, Odisha, West Bengal, Sikkim, Assam, Arunachal Pradesh, Meghalaya, Nagaland, Manipur, Mizoram, Tripura, Andaman & Nicobar Islands | 13 | 23.5°N, 86.5°E |
| West | Gujarat, Maharashtra, Goa, Dadra & Nagar Haveli and Daman & Diu | 4 | 20.5°N, 74.0°E |
| South | Andhra Pradesh, Telangana, Karnataka, Kerala, Tamil Nadu, Puducherry, Lakshadweep | 7 | 13.5°N, 78.0°E |

By default, a pin sits at its region's geographic centre (`d3.geoCentroid`). The coordinates above are hand-placed overrides for regions whose centre falls in an awkward spot. East is the main case: its centre is pulled toward the North-East, so the pin is moved onto the mainland. Check each pin on screen and adjust it in the config file.

**Geometry files** (in `client/public/geo/`, cached by the browser):

- `world-110m.json`, from `world-atlas`, for the world view. India's own shape in this file is hidden and replaced by the compliant outline built from the India file.
- `india-states.topo.json`: DataMeet `States/Admin2`, simplified with `mapshaper` (`-clean -simplify dp 4% keep-shapes`) to 265 KB (87 KB gzipped). Each state carries `code` and `name`. The map shows the required CC BY 4.0 credit line.

**Config shape**

```js
export const REGIONS = [
  { id: 'north', label: 'North', color: 'var(--region-north)', pin: [75.5, 29.5],
    states: ['JK', 'LA', 'HP', 'PB', 'CH', 'HR', 'DL', 'RJ'] },
  // central, east, west, south…
];
```

## Component architecture

One page component owns the view state; the map components only draw and report clicks. The zoom transform lives in a ref, not React state, so panning doesn't re-render the page 60 times a second.

```
client/src/
  pages/management/IndiaOverview.jsx      page: layout, view state, URL sync
  components/indiaMap/
    WorldIndiaMap.jsx                     <svg>, projection, d3-zoom wiring
    CountryLayer.jsx                      world countries (memoised paths)
    RegionLayer.jsx                       India states coloured by region, hover/click
    RegionLabels.jsx                      five pins + labels, counter-scaled
    MapControls.jsx                       zoom +/−, reset
    RegionPanel.jsx                       side panel: region list + details
    MapTooltip.jsx
    useGeoData.js                         fetch + decode TopoJSON once, cache in module scope
    useMapZoom.js                         d3-zoom setup, zoomToBounds(feature), reset()
    indiaRegions.js                       REGIONS config (see Map data)
```

| Unit | Inputs | Owns / returns |
| --- | --- | --- |
| `IndiaOverview` | URL search params | `view` ('world' \| 'india' \| 'region'), `selectedRegion`, `hoveredRegion` |
| `WorldIndiaMap` | geometry, `view`, `selectedRegion`, callbacks | Projection, `svgRef`, calls `zoomToBounds` when `view` changes |
| `useMapZoom` | `svgRef`, width, height | `zoomToBounds(feature, ms)`, `reset()`, current scale `k` (for counter-scaling labels) |
| `RegionLayer` | states, `REGIONS`, `hoveredRegion`, `selectedRegion` | Emits `onHover(regionId)`, `onSelect(regionId)` |
| `RegionPanel` | `REGIONS`, `selectedRegion` | Buttons that call `onSelect`; the accessible way to use the map |
| `useGeoData` | file URLs | `{ world, india, loading, error }` |

All SVG paths are computed once per resize with `useMemo` and are never recalculated during zoom. Zooming only changes one `transform` attribute on a wrapping `<g>`.

## Implementation steps

The estimate is about 8 developer-days for one front-end developer, plus time for the boundary-file sign-off, which can run in parallel with steps 2–5.

1. **Source and prepare the geometry** (1 day). Get the compliant India state-boundary file and have it approved (see Risks). Simplify it with `mapshaper`, export TopoJSON, and add the world file. Commit both to `client/public/geo/`.
2. **Add the menu item and route** (0.5 day). Add the `managementLinks` entry, a lazy route at `/management/india-overview` guarded by `RoleRoute`, and an empty page shell sized to the viewport.
3. **Install the libraries and load the data** (0.5 day). Install `d3-geo`, `d3-zoom`, `d3-selection`, `d3-transition` and `topojson-client`. Write `useGeoData` with loading and error states.
4. **Draw the static map** (1.5 days). Draw the world and India layers, fill states by region from `indiaRegions.js`, merge region outlines, and add pins, labels and the legend.
5. **Zoom and view states** (1.5 days). Write `useMapZoom` with scale and pan limits, animated `zoomToBounds` for India and each region, the Reset, Esc and breadcrumb controls, and URL sync.
6. **Side panel and hover** (1 day). Add the region list, region details, tooltip, cross-highlighting between the panel and the map, and the `aria-live` announcements.
7. **Responsive layout and themes** (1 day). Stack the map and panel below 1024 px, test light and dark themes, add the reduced-motion jump, and test touch pinch on a tablet.
8. **Tests and review** (1 day). Write unit tests for the region config (every state assigned exactly once) and a Playwright run through World → India → South → Esc → Reset. Then do a UAT pass with a Management user.

## Testing, risks and open questions

**Acceptance checks**

- [ ] The menu item appears for Management users only, and the route sends other roles to `/unauthorized`.
- [ ] Every state and UT in the India file is assigned to exactly one region (unit test).
- [ ] World → India → each of the 5 regions → back works with mouse, touch and keyboard alone.
- [ ] No region labels overlap at 1280 × 720 and 1920 × 1080.
- [ ] Zooming stays smooth (no dropped frames visible in the Chrome performance panel) on a mid-range laptop.
- [ ] Light and dark themes both pass WCAG AA contrast for labels and the legend.
- [ ] Refreshing on `?region=south` reopens the South view.

| Risk | Impact | Mitigation |
| --- | --- | --- |
| India's boundary is drawn incorrectly | High: maps shown in India must show the official boundary, including all of Jammu & Kashmir, Ladakh and Arunachal Pradesh | Use only a Survey of India–compliant file; never show India from the world file or from tile providers; get legal or compliance sign-off before release |
| Geometry too large or slow on older laptops | Medium | Simplify with `mapshaper`; transform one `<g>` instead of redrawing paths; lazy-load the page |
| Small regions hard to tap (Goa, Delhi, Puducherry) | Low | Clicks select the whole region, not one state; the side panel is always available |
| New dependencies grow the bundle | Low | D3 modules are imported one by one and code-split with the page |

**Open questions**

- [ ] Should the five regions follow the Zonal Council grouping proposed here, or the company's own sales or plant zones?
- [ ] Which data should the side panel show for each region in v2 (plants, departments, KPI achievement), and from which API?
- [ ] Who approves the India boundary file, and is a licence needed for it?
- [ ] Should Admin users also see this page?
