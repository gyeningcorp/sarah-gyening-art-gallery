# Sarah Norris Gyening Art Gallery — original 3D experience

This project preserves the original Three.js gallery with its seven connected rooms, 15-second cinematic intro, lighting, scrolling camera path, and interactive floor plan.

The previous flat-page replacement has been retired. Ten artwork photographs are now installed on the **walls of the original 3D exhibition**; the original decorative sculptures remain.

## Development

```bash
npm install
npm run build
```

Build output: `docs/index.html` and `docs/artworks/`. Vercel serves `docs`.

## Artwork photography

The photographs in `artworks/` were supplied for this gallery. Titles shown on the site are descriptive placeholders, not confirmed titles. Prices, sizes, dates and sale availability are intentionally not asserted. Contact details should be confirmed before public outreach.

## Architecture

- `src/world.js` — original scene and new photographic artwork textures
- `src/journey.js` — original camera, tour and film behavior
- `src/template.html` — original UI framework with art-gallery language
- `src/main.js` — existing interactive UI
- `src/content.js` — artwork details and navigation
- `artworks/` — ten optimised paintings
