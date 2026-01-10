<<<<<<< HEAD
# Performance Scorecard

Performance Management App for ERPNext.
=======
# Performance Scorecard (Performance Center)

Performance management and risk tracking module built on Frappe/ERPNext. The app models company-to-employee goals, links them to KRAs/KPIs, and computes scorecards and progress rollups. It also provides strategy and risk dashboards with realtime refreshes.

## What this app includes

- Goal hierarchy with validation (Company -> Department -> Employee)
- KPA, Goal, KRA, KPI Master, Targets, and Scorecards
- Performance updates that roll into Scorecard Items and overall scores
- Strategy Plans and Strategy Maps UI (tree and column views)
- Risk management (Register, Context, Treatment, Decision) with Heat Map
- Dashboards and analytics (Performance dashboard, Number Cards, Report)
- Realtime refresh when strategy-related DocTypes change

## Core concepts

### Goal hierarchy
Goals are owned by Company, Department, or Employee. Validation enforces:
- Company goals must be linked to a KPA and cannot have a parent
- Department goals must link to a parent Company goal
- Employee goals must link to a parent Department goal
- KPA on child goals must match the parent goal

### KPA / Goal / KRA / KPI
- KPA Master: top-level focus area with weightage and progress
- Goal: strategic objective under a KPA
- KRA: key results tied to a Goal (cannot be linked to a Company goal)
- KPI Master: measurable KPI tied to a KRA (only for employee goals)

### Performance Scorecards
A Performance Scorecard stores a set of Scorecard Items (KPA/Goal/KRA/KPI lines). If the scorecard is created without items, it auto-populates items from the employee’s KPIs.

Scoring flow (see `performance_scorecard/scoring_engine.py`):
- Each item score = (actual / target) * 100
- Scores are aggregated from KPI -> KRA -> Goal -> KPA using weightage
- Overall score is the weighted aggregate of KPA scores
- Progress is cascaded to KRA, Goal, and KPA after scorecard updates

### Performance Updates
`Performance Update` records update the corresponding Scorecard Item actual value and trigger a score recalculation.

### Risk Management
Risk Register calculates:
- Inherent risk score from likelihood * impact
- Risk level (Low/Medium/High)
- Residual risk per treatment row
- Risk appetite breach based on Performance Settings and context

## DocTypes

Performance management:
- `KPA Master`: key performance areas and weightage
- `Goal`: strategic objectives with owner type and rollups
- `KRA`: key result areas tied to a goal
- `KPI Master`: measurable KPIs tied to KRAs
- `Target`: KPI target values by period
- `Performance Scorecard`: scorecard header
- `Scorecard Item` (child table): KPA/Goal/KRA/KPI lines with target/actual/score
- `Performance Update`: actual updates for KPI items
- `Scorecard Settings` (single): rating scale and update frequency

Risk management:
- `Risk Register`: main risk record with scoring
- `Risk Context`: appetite and context
- `Risk Treatment`: mitigations (child table for Risk Register)
- `Risk Decision`: decisions and approvals

## Pages and UI

Main entry:
- `performance-dashboard` (Performance Center)

Strategy:
- `strategy-plans`: list and edit goals/KRAs/KPIs by level
- `strategy-maps`: tree view of strategy hierarchy
- `strategy-map`: column view for drill-down

Risk:
- `risk-dashboard`: overview of risks and categories
- `risk-heat-map`: 5x5 heat map with drill-down to Risk Register

Other UI behavior:
- `desk_redirect.js` redirects `/app/performance-scorecard` to `performance-dashboard`
- `goal.js` enforces parent selection rules and auto-sets KPA
- `appraisal.js` adds a button to fetch scorecard summary in Appraisal

## Dashboards and reports

Dashboards:
- `Performance` dashboard with Number Cards and charts

Number cards:
- Total Scorecards
- Approved Scorecards
- Pending Review Scorecards

Reports:
- `Performance Analytics`: filterable report by period

## Installation

From a bench folder:

```bash
# If the app is not already added
bench get-app performance_scorecard <git_url_or_local_path>

# Install on a site
bench --site <site_name> install-app performance_scorecard

# Run migrations after updates
bench --site <site_name> migrate
```

Requirements:
- Frappe/ERPNext environment (uses Employee, Department, Appraisal)
- Python >= 3.10 (see `pyproject.toml`)

## Configuration

- `Scorecard Settings`: set rating scale and update frequency
- `Performance Settings` (from ERPNext):
  - calculation method (Weighted Average / Average)
  - risk appetite and breach handling

## Typical setup flow

1. Create KPAs in `KPA Master` with weightages
2. Define Company Goals and link to KPAs
3. Create Department Goals under company goals
4. Create Employee Goals under department goals
5. Add KRAs for employee goals
6. Define KPIs under KRAs (and set Targets)
7. Create a Performance Scorecard for the employee
8. Record Performance Updates to capture actuals
9. Review the Performance Dashboard and Strategy pages
10. Register risks and manage treatments in Risk Register

## Realtime updates

The app publishes `strategy_plans_refresh` when Goals, KRAs, KPIs, Scorecards, or Updates change. This keeps Strategy Plans and Maps current for the relevant level (Company, Department, Individual).

## Developer notes

Key code locations:
- `performance_scorecard/hooks.py`: app hooks, doc events, assets
- `performance_scorecard/scoring_engine.py`: scoring and rollups
- `performance_scorecard/utils/strategy_realtime.py`: realtime events
- `performance_scorecard/page/performance_dashboard`: main dashboard UI
- `performance_scorecard/page/strategy_plans`: strategy list UI
- `performance_scorecard/page/strategy_map`: strategy drilldown UI
- `performance_scorecard/page/risk_dashboard`: risk summary API
- `performance_scorecard/page/risk_heat_map`: risk matrix UI/API

## Troubleshooting

- Score stays at 0: ensure target and actual are set on Scorecard Items
- KPIs not showing in scorecard: check that KPI is linked to an employee goal and KRA is linked to that goal
- Strategy pages not refreshing: verify realtime events and permissions
- Risk appetite breach not updating: confirm Performance Settings and context appetite

## License

MIT (see `LICENSE`)
>>>>>>> origin/newton-manyisa
