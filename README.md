# ImpactLens

**AI-powered evidence intelligence for sustainability projects**

ImpactLens turns field media into traceable project evidence. Users can upload photos or videos, analyze them with Gemini, search the resulting evidence, compare BEFORE/AFTER imagery, and assemble reports from explicitly selected evidence.

The application keeps three concepts separate throughout the pipeline:

* **Observed** — what is visibly present in the source media.
* **AI Interpretation** — contextual interpretation of those observations.
* **Impact Claims** — intentionally not generated as measured environmental outcomes.

AI-generated interpretations remain traceable to their source media and model provenance.

---

## Current status

**Phase 9 — UI polish, realistic demo data, failure handling, and verification**

The current MVP includes:

* Project creation and project dashboard
* Direct signed Cloudinary media uploads
* Background image/video analysis through Gemini
* Media processing state machine
* AI-generated tags and activity labels
* Natural-language evidence search
* Phase/type filtering
* BEFORE / DURING / AFTER / UNSPECIFIED media phases
* BEFORE → AFTER image comparison
* Comparison history
* Evidence Panel with source/provenance information
* Deterministic report evidence selection
* AI-generated report summary
* Report traceability back to source evidence
* Failure/retry handling for external AI services
* Project-level statistics and activity breakdown
* Media phase editing from the project dashboard

### Current verification

The Phase 9 working tree has been verified with:

```text
TypeScript
npx tsc --noEmit
PASS

ESLint
npm run lint
PASS — no warnings or errors

Vitest
npm test
11 test files passed
76 tests passed
```

The configured Gemini model can also be resolved successfully through the live Gemini API.

Individual generation requests may still receive provider-side `503 UNAVAILABLE` responses during periods of high demand. ImpactLens treats these as external dependency failures and does not fabricate fallback AI output.

---

## Core demo flow

```text
Create project
      ↓
Upload BEFORE / AFTER media
      ↓
Cloudinary
      ↓
Processing worker
      ↓
Gemini analysis
      ↓
INDEXED media
      ↓
Search / filter evidence
      ↓
Compare BEFORE → AFTER
      ↓
Select evidence
      ↓
Generate report
      ↓
Trace report evidence back to source media
```

Run the application and worker in separate terminals:

```bash
npm run dev
npm run worker
```

Then:

1. Create a project.
2. Upload photos or videos.
3. Wait for assets to reach `INDEXED`.
4. Assign the appropriate media phase.
5. Use `/search` to find evidence.
6. Open **Compare** and select a BEFORE and AFTER asset.
7. Review the Observed / Interpretation result.
8. Open **View source** to inspect provenance.
9. Generate a report from selected evidence.
10. Open the generated report and trace each evidence item back to its source.

---

## Architecture

```text
Next.js application
│
├── Project dashboard
├── Media upload / management
├── Search
├── Compare
├── Reports
│
├── API routes
│   ├── projects
│   ├── media
│   ├── search
│   ├── compare
│   └── reports
│
├── AI layer
│   ├── AnalysisProvider
│   ├── Gemini analysis
│   ├── Gemini comparison
│   ├── Gemini report summary
│   └── Search query parsing
│
├── Cloudinary
│   └── signed upload + media metadata
│
├── Prisma
│   └── PostgreSQL data model
│
└── Worker
    └── sequential media-processing jobs
```

External services are isolated behind application modules so application routes do not directly depend on provider SDK details.

---

## Project structure

```text
prisma/schema.prisma
    Relational data model for projects, media, analysis,
    tags, processing jobs, comparisons, reports and provenance.

lib/db.ts
    Prisma client singleton.

lib/cloudinary.ts
    Cloudinary SDK/API integration.

lib/currentUser.ts
    Single demo-user stub. Authentication is outside MVP scope.

lib/ai/provider.ts
    AnalysisProvider interface and validated AI output schema.

lib/ai/gemini.ts
    Gemini implementation for media analysis.

lib/ai/compareProvider.ts
    Gemini image comparison provider with structured
    Observed / Interpretation output.

lib/ai/reportProvider.ts
    Gemini report-summary generation and impact-claim guard.

lib/search/
    Search filter types, Gemini query parsing, deterministic
    fallback parsing and Prisma filter construction.

lib/projectIsolation.ts
    Project-scope validation used to prevent cross-project
    media comparisons.

lib/persistAnalysis.ts
    Persists validated analysis, tags and activity labels.

lib/tagUtils.ts
    Pure tag-generation helpers.

worker/
    Sequential background processing worker.

worker/handlers/imageAnalysis.ts
    Image analysis handler.

worker/handlers/videoAnalysis.ts
    Frame-based video analysis handler.

app/api/
    Project, media, search, compare and report API routes.

app/projects/[id]/
    Project dashboard and media management.

app/projects/[id]/compare/
    BEFORE/AFTER comparison interface.

app/projects/[id]/reports/new/
    Evidence-selection and report-generation interface.

app/reports/[id]/
    Generated report view.

components/EvidencePanel.tsx
    Reusable evidence/provenance drawer.

tests/
    Unit and failure-path tests.
```

---

## Media processing

Media is uploaded directly to Cloudinary using a signed upload flow.

After registration with the application, the media receives a processing job.

The normal image processing path is:

```text
UPLOADED
   ↓
PROCESSING
   ↓
INDEXED
```

Failures transition to:

```text
FAILED
```

Failed jobs can be retried. A retry creates a new processing job instead of overwriting the failed job, preserving processing history.

The worker runs separately:

```bash
npm run worker
```

It processes queued jobs sequentially without requiring external queue infrastructure.

---

## AI analysis

Gemini is used for media analysis.

Analysis is structured into separate fields:

```text
Observed
AI Interpretation
Tags / activity classification
```

The schema intentionally does not contain a field for measured environmental impact.

For example, the system is designed to distinguish:

> Visible vegetation and planting activity are present.

from an unsupported quantitative claim such as:

> Vegetation increased by 35%.

The latter is not treated as a valid AI evidence output.

---

## Search

The `/search` screen accepts natural-language queries such as:

```text
show before photos
```

or:

```text
tree planting
```

Gemini can translate the query into a structured filter:

```text
keywords
activity
phase
media type
date range
```

The application then executes the structured filter deterministically through Prisma.

Explicit UI filters take precedence over conflicting values inferred from the natural-language query.

If Gemini query parsing fails, the search layer uses a deterministic fallback parser rather than failing the entire search operation.

The UI exposes the resolved filter so the user can see what the application understood.

---

## BEFORE / AFTER comparison

The comparison workflow requires:

```text
BEFORE asset
      +
AFTER asset
```

Both assets must:

* belong to the same project
* be images
* have reached `INDEXED`
* have the appropriate `BEFORE` / `AFTER` phase

The frontend presents phase-specific candidates, while the API independently validates the phase requirement.

The comparison result contains:

```text
Observed
AI Interpretation
Model provenance
Generation timestamp
```

Repeated comparisons of the same pair are cached rather than unnecessarily spending another Gemini call.

Comparison history is displayed on the project comparison screen.

Comparison results should be interpreted as visual evidence analysis rather than scientific measurement of environmental change. Different camera angles, locations, lighting, water levels, or scene composition can limit the strength of a visual comparison.

---

## Evidence Panel

The Evidence Panel provides a common provenance surface throughout the application.

It can be opened from:

* project media
* comparison results
* generated reports

It displays information including:

```text
Source media
Observed
AI Interpretation
Activity / phase
Cloudinary asset information
AI model
Generation timestamp
Confidence where available
```

The report therefore does not become a detached AI narrative. Evidence can be traced back to the original media.

---

## Reports

Reports are deliberately deterministic about **what evidence is included**.

The user explicitly selects:

```text
Media
Comparisons
```

The API builds the report evidence list directly from those selected database IDs.

The AI does **not** decide which evidence is relevant.

The AI receives the selected evidence's existing:

```text
Observed
AI Interpretation
```

and generates only the report's narrative summary paragraph.

The resulting report contains:

* report title
* project information
* AI-generated summary
* selected media evidence
* selected comparisons
* Observed / Interpretation information
* source links into the Evidence Panel
* AI provenance/disclaimer information

---

## Report safety guard

Generated report summaries pass through a deterministic `checkForImpactClaims()` guard before persistence.

The guard checks for unsupported patterns including:

* percentages
* area measurements
* mass measurements
* carbon / CO2 claims
* quantified increases/decreases
* certainty language such as `proves`, `confirms`, `verified`, or `successful`
* specific counts of planted trees/saplings/plants

If a generated summary triggers the guard, the system requests one constrained rewrite.

If the rewritten summary still violates the guard, report generation fails rather than persisting the unsupported narrative.

This is deliberately implemented as an explainable application-level check rather than relying only on an AI prompt.

---

## External AI failure handling

Gemini is an external dependency and can temporarily return provider-side errors such as HTTP `503`.

The report generator retries transient failures with exponential backoff:

```text
Attempt 1
   ↓
2 seconds
   ↓
Attempt 2
   ↓
4 seconds
   ↓
Attempt 3
```

If the provider remains unavailable, the application does not fabricate a report summary.

Instead, the API returns a user-facing temporary-service error while preserving the user's selected evidence.

The `503` behavior has also been reproduced using a direct Gemini API request outside the application, confirming that this failure mode can originate from provider-side capacity rather than the ImpactLens application.

---

## Dashboard

The project dashboard provides:

* total media
* analyzed media
* photos/videos
* comparison count
* report count
* activity breakdown
* media phase information
* recent reports

The media grid supports filtering by:

```text
Phase:
ALL
BEFORE
DURING
AFTER
UNSPECIFIED

Type:
ALL
IMAGE
VIDEO
```

Media phase can be updated directly from the project interface.

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure PostgreSQL

Create a PostgreSQL database using a local installation or a hosted provider such as Supabase, Neon, or Railway.

Copy the environment template:

```bash
cp .env.example .env
```

Then configure:

```env
DATABASE_URL="..."
```

### 3. Generate Prisma client

```bash
npx prisma generate
```

For a new database:

```bash
npx prisma migrate dev --name init
```

### 4. Configure Cloudinary

Create a Cloudinary account and configure:

```env
CLOUDINARY_CLOUD_NAME="..."
CLOUDINARY_API_KEY="..."
CLOUDINARY_API_SECRET="..."
```

Cloudinary AI Vision and native AI Video Analysis are optional and are not required for the core MVP image-analysis pipeline.

### 5. Configure Gemini

Set:

```env
GEMINI_API_KEY="..."
GEMINI_MODEL="gemini-3.8-flash"
```

Gemini is used for:

* media analysis
* image comparison
* report-summary generation
* natural-language search parsing

### 6. Start the application

Terminal 1:

```bash
npm run dev
```

Terminal 2:

```bash
npm run worker
```

Open:

```text
http://localhost:3000
```

Health endpoint:

```text
http://localhost:3000/api/health
```

---

## Verification

Run the TypeScript check:

```bash
npx tsc --noEmit
```

Run lint:

```bash
npm run lint
```

Run the test suite:

```bash
npm test
```

Current Phase 9 verification:

```text
TypeScript
PASS

ESLint
PASS — no warnings or errors

Vitest
11 test files passed
76 tests passed
```

Vitest is configured with file-level parallelism disabled because several provider failure-path tests intentionally manipulate shared global state such as `fetch` and environment variables. Running those tests sequentially makes the suite deterministic.

The live Gemini configuration has also been verified against the configured model.

External provider availability can still vary independently of application correctness. In particular, Gemini may temporarily return `503 UNAVAILABLE` during periods of high demand. ImpactLens preserves selected evidence and reports the dependency failure rather than generating unsupported fallback content.

---

## Testing the complete demo

A representative end-to-end demonstration is:

```text
1. npm run dev

2. npm run worker

3. Create "Odisha Mangrove Restoration"

4. Upload field media

5. Assign BEFORE / AFTER phases

6. Wait for INDEXED

7. Open /search

8. Search for restoration evidence

9. Open Compare

10. Select BEFORE + AFTER

11. Run comparison

12. Open View source

13. Return to project

14. Open Reports

15. Select the desired evidence

16. Generate the report

17. Open the generated report

18. Use View source to trace report evidence
```

The key product concept to demonstrate is the traceability chain:

```text
Report
  ↓
Selected evidence
  ↓
Observed / AI Interpretation
  ↓
Source media
  ↓
Cloudinary asset
  ↓
AI model + generation provenance
```

---

## Security and integrity considerations

### Project isolation

Project-scoped media and comparison operations validate that selected assets belong to the requested project.

The comparison API specifically protects against cross-project media being submitted under an unrelated project.

### Evidence selection

Reports use the exact evidence IDs supplied by the user and verified against the project.

The AI does not independently select report evidence.

### AI provenance

AI-generated fields retain model and generation information where applicable.

### No unsupported fallback report

If report-summary generation fails, the application does not silently substitute a hard-coded narrative.

---

## Known limitations

The following remain outside the current MVP scope:

* Authentication beyond the seeded demo user
* Semantic/vector embedding search
* Native Cloudinary AI Video Analysis dispatch
* PDF report export
* Editing/deleting generated reports
* Dedicated global reports listing
* Advanced multi-location geospatial analysis
* Quantitative environmental-impact measurement
* Automated verification of real-world restoration outcomes

Comparison currently operates on image assets and should be interpreted as visual evidence comparison, not as a scientific measurement of environmental change.

AI-generated interpretations are also dependent on the quality, framing, and comparability of the uploaded media.

---

# Development history

## Phase 9 — Polish and verification

* Improved BEFORE/AFTER comparison candidate selection.
* Added phase-specific comparison validation on the API.
* Added media phase editing from the project dashboard.
* Added phase/type filtering to the media grid.
* Improved comparison loading/error states.
* Added report-generation error handling.
* Added Gemini retry/backoff for transient provider errors.
* Strengthened Cloudinary failure-path tests.
* Made the Vitest suite deterministic by disabling file-level parallelism.
* Verified TypeScript.
* Verified ESLint.
* Verified all 76 automated tests.
* Verified the configured Gemini model through the live API.
* Verified graceful handling of Gemini `503` high-demand failures.
* Preserved selected report evidence when external AI generation is unavailable.

## Phase 8 — Failure handling and hardening

* Removed the unused duplicate `lib/ai/reportSummary.ts`.
* Fixed cross-project comparison data-integrity validation.
* Added ESLint configuration and dependencies.
* Strengthened the report impact-claim guard.
* Added failure-path coverage across Gemini, Cloudinary, worker processing and project isolation.
* Hardened worker failure isolation and recovery behavior.

## Phase 7 — Reports and dashboard

* Added deterministic report evidence selection.
* Added Gemini report-summary generation.
* Added report impact-claim validation.
* Added report detail and per-project report listing.
* Added report evidence traceability.
* Added project dashboard statistics.
* Added activity breakdown and report listing.

## Phase 6 — Comparison and evidence provenance

* Added comparison persistence and idempotency.
* Added Gemini image comparison.
* Added comparison history.
* Added Evidence Panel.
* Added media provenance endpoint.
* Added comparison source tracing.

## Phase 5 — Search

* Added structured search filters.
* Added Gemini natural-language query parsing.
* Added deterministic fallback parsing.
* Added deterministic Prisma filter construction.
* Added `/search`.
* Added project media phase/type filters.

## Phase 3 — Media processing

* Added Cloudinary media registration.
* Added background processing worker.
* Added image analysis.
* Added frame-based video analysis.
* Added analysis persistence.
* Added tags and activity labels.
* Added media retry handling.
* Added live processing status updates.

## Phase 2 — Foundation

* Added Prisma data model.
* Added PostgreSQL integration.
* Added Cloudinary integration.
* Added Gemini provider abstraction.
* Added project APIs and initial UI.

---

# Intentional non-goals

ImpactLens is an evidence-management and AI-assisted interpretation system.

It is **not** intended to:

* independently certify environmental impact
* replace scientific field measurement
* claim restoration success from photographs alone
* invent quantitative environmental outcomes
* allow an AI model to silently choose which evidence belongs in a report

The application is designed to keep the distinction between **what the evidence shows**, **what an AI interprets**, and **what would require independent measurement or verification** explicit.
