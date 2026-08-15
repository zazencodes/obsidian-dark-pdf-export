# R36 stylesheet lifecycle rationale

Dark PDF Export keeps its own settings-interface CSS in the static root `styles.css`. The effective export stylesheet is different: it is local user data that must be replaceable as one complete stylesheet, so the plugin projects that value through a marked `<style>` element instead of assigning inline component styles.

The registry receives each participating `Document` explicitly. It never imports or assumes the global `document`, because Obsidian pop-out windows have separate `Window` and `Document` globals. Startup reconciles duplicate or stale plugin-marked elements to one element per document, replacement mutates that one element, and disabling, pop-out closure, or plugin unload removes every plugin-marked element. A closed registry ignores later work so delayed callbacks cannot reattach CSS after unload.

The bundled default is print-scoped except for custom-property declarations and the opaque `@page` fallback needed to color the entire printed page box. It does not invert images or other media. Future user-authored CSS remains trusted local text: it is inserted as stylesheet text, never evaluated as JavaScript, interpolated into HTML, or sent over the network.

This is a candidate implementation pending the native PDF export spike and current Community Plugin review. If plugin-managed stylesheet text does not reach every native print document, affects the ordinary workspace, or cannot pass review under the guidance against JavaScript-assigned styles, dependent implementation must stop.
