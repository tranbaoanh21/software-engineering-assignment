# Repository Guidelines

## Project Structure & Module Organization

This repository is currently documentation-first. `README.md` explains the Smart E-Mobility Hub assignment, while `general-knowledge.md` contains the Software Engineering background used across all phases. The original assignment PDF stays at the repository root. `assets/` is the reference LaTeX template and contains the cover, logos, header, and footer assets.

Work is organized under `docs/`: `phase-1/` contains requirements and use cases, `phase-2/` contains mockups and behavioral diagrams, `phase-3/` contains architecture, class design, and test cases, and `meeting-minutes/phase-N/` stores meeting records. Place group LaTeX reports in `group-report/` and member-specific reports in `individual-work/`. Do not create application directories until implementation is explicitly started.

## Documentation Workflow

Treat the group report as one coherent document, not seven concatenated submissions. Individual reports may overlap the matching group-report sections, but must clearly represent each member's contribution. Record every meeting with attendees, discussion, decisions, assignments, deadlines, and risks. Preserve the visual identity in `assets/`; replace outdated course metadata without casually redesigning the template.

Use AI prompts during an actual review pass after phase content is drafted. Document the problem, exact prompt, useful output, and the team's subsequent corrections. Never present invented prompts as historical evidence.

## Build, Test, and Development Commands

- `git status --short`: review local changes before editing or staging.
- `rg --files docs assets`: inspect documentation and template files quickly.
- `latexmk -pdf -interaction=nonstopmode main.tex`: compile a report from its own directory.
- `latexmk -c`: remove temporary LaTeX build files.

There is no application build or automated test suite yet. After compiling, inspect the PDF for missing images, overflow, broken Vietnamese text, page numbering, diagrams, and header/footer consistency.

## Style & Naming Conventions

Write direct, natural Vietnamese suitable for teammates and lecturers. Keep requirement identifiers stable, such as `FR-RES-01`, `BR-RES-01`, and `NFR-CON-01`. Use lowercase kebab-case for directories and Markdown files; use `meeting-01`, `meeting-02`, and similar chronological names. Keep one responsibility per requirement and make NFRs measurable.

## Commit & Pull Request Guidelines

Follow the existing short imperative convention, for example `docs: add phase 1 use-case specifications`. Keep commits focused by phase or artifact. Pull requests should summarize changed deliverables, affected members, validation performed, and include rendered screenshots when diagrams or PDF layout change. Never commit private allocations, temporary LaTeX files, or credentials. Do not commit or push unless explicitly requested.
