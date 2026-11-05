# Dropping your artwork in

Anything you put in `public/img/art/` and register in `src/data/artwork.ts` replaces
a placeholder everywhere that slot appears — product cards, product galleries, the
search dialog, the category tiles, the collection mosaic, the seller polaroids.

You do not need to touch a component, and you do not need to reseed the database.

## The short version

```bash
# put your images anywhere, folders included
cp -r ~/my-work ./artwork

# see what it would do, without writing anything
npm run art:import -- ./artwork --dry-run

# do it
npm run art:import -- ./artwork

# what is artwork and what is still a placeholder
npm run art:report
```

Then open the dev server. Your images are already live — Vite picks up
`public/img/art/` without a restart.

## What it does with your files

It does not just copy them. Each slot is displayed at a fixed ratio, and a
stretched or letterboxed image looks worse than the gradient it is replacing:

| slot                          | shown as         | ratio  |
| ----------------------------- | ---------------- | ------ |
| products (`p-…`)              | product card     | 4:3    |
| categories (`c-…`)            | category tile    | 3:4    |
| collection mosaic (`collection-spot-…`) | mosaic tile | 4:3 |
| seller polaroids (`cta-…`)    | polaroid         | 4:3    |
| promo band (`promo-…`)        | wide banner      | 2:1    |
| blog (`b-…`)                  | article card     | 16:10  |
| avatars (`a-…`)               | circle           | 1:1    |

So for every file it:

- **reads** the real dimensions and colour profile, not the extension;
- **trims** white/transparent margins if it finds a uniform border (scans and
  screenshots usually have one), so the subject fills the frame;
- **crops** to the ratio the slot is actually displayed at, from the centre;
- **tiles** instead of cropping when the source is far too tall for the slot — a
  1200×2400 poster cannot give a 3:4 tile honestly, and one blown-up sliver is
  worse than four legible columns;
- converts to WebP and caps the width, so a folder of camera JPEGs does not
  become a 60 MB page.

## How it knows which image goes where

It scores each filename against the slot's own name and label, so
`golden-retriever.jpg` lands on *Happy Golden Retriever*, `fonts.png` on the
Fonts category, `nature-details-scan.jpg` on *Nature Details*.

Anything it cannot match is filled into the next free slot **in order**, and the
table it prints says `filled in order` for those — check them before you ship.
Every single decision is printed, so a wrong match is obvious rather than
something you have to spot on the site.

Rules of thumb:

- name files after what they show (`coastal-dream.jpg`, not `IMG_4821.jpg`)
- folders are ignored for matching — only the filename is scored
- more images than slots: the extras are listed and skipped
- fewer images than slots: the rest keep their placeholder

## Overriding by hand

`src/data/artwork.ts` is a plain key → path map. Edit it directly when you want
exact control, including pointing a slot at a file you placed yourself:

```ts
export const ARTWORK: Record<string, string> = {
  "p-nature-details": "/img/art/p-nature-details.webp",
  "c-fonts": "/img/art/my-own-font-poster.webp",
};
```

The keys come from `src/data/ref-images.ts`, which lists every slot with its
label — that file is the map of what can be replaced.

## Undo

```bash
npm run art:import -- --clear       # every slot back to its placeholder
```

Delete a single file from `public/img/art/` and that slot falls back too; the
report will show it as a placeholder again.

## Why this is separate from `public/img/ref/`

`public/img/ref/` holds captures from the reference site (`npm run fetch:images`).
It is gitignored on purpose, because that artwork is not ours.

`public/img/art/` is committed. It is the real thing. When both exist for a slot,
**artwork wins** — resolution is `artwork → reference capture → generated gradient` —
so an import is an override, never a merge.
