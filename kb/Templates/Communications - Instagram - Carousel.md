# Communications - Instagram - Carousel (template)

Use this template to create notes in `Outputs/Communications/` when the deliverable is an Instagram carousel.

## Frontmatter (minimal and stable)

Paste this block at the top of the note:

```yaml
---
title: "[short title]"
canal: Instagram
formato: "Carousel (9 slides)"
estado: draft
owner: "{{OWNER_NAME}}"
---
```

Rules:

- `title`: short title; ideally consistent with H1.
- `canal`: channel name (e.g. `Instagram`) or `Multi` if reused across channels.
- `formato`: editorial format (e.g. `Carousel (9 slides)`); keep literal for filtering.
- `estado` (recommended): `draft` | `ready` | `published`.
- `owner` (optional): deliverable owner.

## Conventions

- File name: `YYYY-MM-DD - Instagram - <SemanticName>.md`.
- Do not duplicate URLs/CTAs/signature in every note if they already exist in [[Company/05 - Channels and Contact]]. In the note, reference that document.

## GitHub note (issues)

- In GitHub issues, do not paste frontmatter YAML as a header.
- If needed for context, include it as a code block (```yaml) or, better, link the vault note in `Outputs/Communications/`.

## Recommended Structure (9 slides)

```markdown
# Carousel: [title]

Goal: [one line]

## Slide 1

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 2

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 3

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 4

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 5

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 6

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 7

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 8

Copy (title):

Copy (body):

Visual:

Key element:

## Slide 9

Copy (title):

Copy (body):

Visual:

Key element:

## CTA

Paste a CTA and/or signature from [[Company/05 - Channels and Contact]].
```
