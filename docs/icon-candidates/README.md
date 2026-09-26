# Deep Trace Activity Bar Icon Candidates

The icon shown next to **Deep Trace** in the VS Code/Cursor activity bar is defined in `package.json`:

```json
"viewsContainers": {
  "activitybar": [
    {
      "id": "deepTrace",
      "title": "Deep Trace",
      "icon": "media/trace.svg"
    }
  ]
}
```

So the current activity bar icon format is **SVG** (`media/trace.svg`).

`media/icon.png` is a different asset: it is the marketplace/package icon, not the activity bar icon.

## Preview

Open `deep-trace-activity-bar-icons.svg` to compare 30 monochrome candidates.

The candidates are designed as activity-bar-style SVG silhouettes:

- Transparent icon shapes
- Simple strokes/fills that survive small sizes
- No dependency on color because VS Code/Cursor may theme or mask activity bar icons

Pick a number, then the selected candidate can be extracted into `media/trace.svg`.
