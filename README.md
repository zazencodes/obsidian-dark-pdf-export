# Dark PDF Export

Dark PDF Export is a focused desktop plugin for Obsidian. It applies a stable dark stylesheet to Obsidian's native **Export to PDF** workflow, including the printed page box that can otherwise remain white.

It does not replace Obsidian's PDF renderer, add a second export command, restyle embedded PDFs, or change note content.

## Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the same GitHub release.
2. Create `<vault>/.obsidian/plugins/dark-pdf-export/`.
3. Copy all three files into that folder.
4. Restart or reload Obsidian, then enable **Dark PDF Export** under **Settings → Community plugins**.

The folder name must match the plugin ID: `dark-pdf-export`. The plugin requires desktop Obsidian 1.13.7 or newer.

## Use

Enable the plugin, open a note, and use Obsidian's native **Export to PDF** command. Dark PDF styling is on when the plugin is first enabled.

The settings page contains one toggle and the complete effective CSS stylesheet:

- **Enable dark PDF styling** detaches or restores the saved stylesheet without deleting it.
- Editing CSS changes a saved draft only. Select **Apply** to validate and activate the draft.
- **Reset** asks for confirmation, then replaces both the draft and active CSS with the defaults shipped in the installed plugin version.

### Complete CSS and resource safety

The editor accepts a complete stylesheet, not an override fragment. The shipped CSS is print-scoped, but your CSS does not have to be. Selectors outside `@media print` can change the Obsidian interface. Keep a recoverable copy of substantial customizations and use Reset if a rule makes the interface hard to use.

Apply rejects fatal CSS syntax errors, `@import`, protocol-relative URLs, and remote resource URLs. This prevents custom CSS from initiating network requests for fonts, images, or stylesheets. The last working stylesheet remains active when validation fails, and the draft stays available for correction.

## Compatibility

Dark PDF Export is desktop-only because it depends on Obsidian's desktop PDF export. Version 1.0.0 requires Obsidian 1.13.7 or newer. The built-in palette does not inherit the active theme and is designed to work while Obsidian itself uses either light or dark mode.

Obsidian or Chromium print changes may affect future exports. Verify page edges, backgrounds, code blocks, tables, callouts, links, and images after updating Obsidian or this plugin.

## Privacy and safety

Dark PDF Export works locally. It has no account, ads, telemetry, analytics, or network requests. It does not read or modify notes, attachments, vault metadata, themes, snippets, appearance settings, or other plugins' settings. Plugin settings are stored only through Obsidian's supported plugin data API; the runtime contains no hard-coded vault or `.obsidian` path.

## Development

Node.js 24 and npm are used for reproducible development and CI.

```sh
npm ci
npm run typecheck
npm run lint -- --max-warnings=0
npm test
npm run build
npm run release:validate -- 1.0.0
```

`npm run dev` starts the esbuild watcher. Production builds are minified and write the ignored `main.js` bundle. A release consists of `main.js`, `manifest.json`, and `styles.css` from one production build.

## Releases

1. If compatibility changed, update `minAppVersion` in `manifest.json` and commit that compatibility change first.
2. Run `npm version patch`, `npm version minor`, or `npm version major`. The version hook updates `manifest.json` and maps the release to its minimum Obsidian version in `versions.json`. npm tags use the exact unprefixed `x.y.z` version.
3. Run the complete development checks above and push the source commit and tag.
4. The release workflow validates the package, manifest, tag, and compatibility mapping before building. A mismatch stops the workflow.
5. The workflow creates a draft GitHub release with the three required assets. Review its notes and assets before publishing it.

Before the initial Community directory submission, complete Obsidian's current [plugin self-critique](https://docs.obsidian.md/oo/plugin), publish the `1.0.0` release, and [submit the repository](https://docs.obsidian.md/Plugins/Releasing/Submit%20your%20plugin). The Community directory runs automated review; fix any findings in source and publish a new incremented release rather than reusing a version number.

## Support

Report bugs and compatibility problems through [GitHub Issues](https://github.com/zazencodes/obsidian-dark-pdf-export/issues). Include your Obsidian version, plugin version, operating system, and a minimal CSS or export example when relevant.

## License

[MIT](LICENSE) © ZazenCodes.
