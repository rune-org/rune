---
name: typst-expert
description: Expert-level layout, formatting, and compiler guide for Typst. Use this skill when writing Typst markup, styling academic theses or technical books, designing headers, configuring margins, styling tables and grids, formatting code blocks, or embedding figures.
---

# Typst Expert Guide

This skill provides expert-level procedural knowledge for writing, structuring, and formatting professional academic theses and technical books in Typst.

## 1. Document Configuration & Layout

Every professional document must define a consistent page geometry and typographical scale. Follow these defaults for academic-grade formatting:

### Page Geometry
Configure the page size, margins, and paper standard cleanly at the top of the file:
```typst
#set page(
  paper: "a4",
  margin: (top: 2.0cm, bottom: 2.0cm, left: 2.5cm, right: 2.5cm),
)
```

### Typography Scale
Ensure clear, high-readability text with proper line leading and paragraph spacing:
```typst
#set text(
  font: "New Computer Modern",
  size: 11pt,
  lang: "en"
)
#set par(
  justify: true,
  leading: 0.65em,
  first-line-indent: 0pt
)
#show par: set block(spacing: 1.2em)
```

### Page Numbering & Sections
Separate pre-content (Cover page, Abstract, Table of Contents) from the main body by utilizing page numbering styles:
1. **Pre-Content (Roman):**
   ```typst
   #set page(numbering: "i")
   #counter(page).update(1)
   ```
2. **Main Body (Arabic):**
   ```typst
   #set page(numbering: "1")
   #counter(page).update(1)
   ```

---

## 2. Heading Configurations

Use show rules to customize heading sizes, margins, and behavior across levels. Force a pagebreak for all level-1 headings to ensure chapters start on fresh pages.

```typst
#set heading(numbering: "1.1")

#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  v(12pt)
  text(size: 14pt, weight: "bold")[#it]
  v(8pt)
}

#show heading.where(level: 2): it => {
  v(10pt)
  text(size: 12pt, weight: "bold")[#it]
  v(6pt)
}

#show heading.where(level: 3): it => {
  v(8pt)
  text(size: 11pt, weight: "bold")[#it]
  v(4pt)
}
```

---

## 3. Tables & Grids

To avoid overflow and maintain high alignment, always specify explicit columns using fractions (`1fr`) or specific lengths (`auto` or physical dimensions).

### Structuring Clean Tables
```typst
#figure(
  table(
    columns: (1.2fr, 1.5fr, 2.3fr),
    inset: 8pt,
    align: (left + horizon, left + horizon, left + horizon),
    stroke: 0.5pt + gray.lighten(50%),
    fill: (x, y) => if y == 0 { gray.lighten(90%) } else { none },
    table.header(
      [*Service Component*], [*Technology*], [*Primary Responsibility*],
    ),
    [Backend API Master], [FastAPI (Python)], [Authoritative control plane, API routing, Pydantic validation],
    [Worker Engine], [Go (Golang)], [High-throughput, concurrent execution of workflow DSL nodes],
    [Real-Time Service (RTES)], [Rust], [Minimal-latency WebSocket broadcasting over Redis pub/sub],
  ),
  caption: [RUNE Core Services Stack Overview],
) <tbl:stack-overview>
```

---

## 4. Figures, Captions, and Cross-Referencing

Never reference figures or tables manually by typing names like "Table 2". Always use Typst's native referencing mechanism for dynamic, robust linkage:

- **Syntax:** Attach a label `<fig:label-name>` or `<tbl:label-name>` directly after the figure block.
- **Reference:** Use `@fig:label-name` or `@tbl:label-name` in the text. Typst will compile this to "Figure 1" or "Table 1" automatically.

### Code Example:
```typst
As detailed in @tbl:stack-overview, the Master-Worker architecture separates coordination from execution. See @fig:high-level-arch for the message-routing flow.

#figure(
  image("assets/high_level_arch.png", width: 85%),
  caption: [High-Level Message Routing and Coordination Flow],
) <fig:high-level-arch>
```

---

## 5. Mathematical Equations and Notation

Typst provides a clean, native alternative to LaTeX for typesetting mathematics. Use `$` boundaries:
- **Inline Math:** `$E = m c^2$` renders in-line.
- **Block Math:** Add spaces next to the math boundaries:
  ```typst
  $ f(x) = 1 / (sigma sqrt(2 pi)) e^(- 1 / 2 ((x - mu) / sigma)^2) $
  ```
- Use descriptive symbols directly: `arrow`, `alpha`, `sigma`, `sum`, `integral`.

---

## 6. Raw Code Snippets & Syntax Highlighting

Structure code blocks with language specifiers to enable automatic syntax highlighting. Use tight margins and soft background shading to ensure code stands out clearly:

```typst
#show raw.where(block: true): it => {
  rect(
    width: 100%,
    fill: gray.lighten(97%),
    stroke: 0.5pt + gray.lighten(80%),
    inset: 8pt,
    radius: 3pt,
    [#it]
  )
}
```

---

## 7. Dynamic Table of Contents (Outline)

Compile a beautifully formatted, hierarchical Table of Contents automatically:
```typst
#outline(
  title: "Contents",
  indent: auto,
  depth: 3,
)
```

---

## 8. Compilation Best Practices

- **Zero LaTeX Manual Spacing hacks:** Avoid stacking multiple blank lines. Use Typst's clean vertical `#v(10pt)` or horizontal `#h(5pt)` spacing parameters instead.
- **Prevent orphans/widows:** Ensure headings are coupled with their content. If a section heading falls near the bottom of a page, use `#pagebreak(weak: true)` to move it to the next page.
- **Keep clean paths:** Put assets in organized sub-directories (e.g., `images/` or `assets/`) and reference them using relative paths, e.g., `image("images/diagram.png")`.
