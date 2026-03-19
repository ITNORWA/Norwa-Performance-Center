# Performance Center User Guide

This guide explains the Performance Center app from the beginning. It is written for someone who does not know the module yet and needs to understand both the business flow and the calculation logic.

## 1. Purpose of the App

Performance Center helps an organization manage performance from strategy down to individual execution.

In simple terms:

- the company defines strategic focus areas
- goals are created under those focus areas
- goals are broken down into KRAs
- KRAs are measured through KPIs
- employees submit updates against KPIs
- approved updates change the scorecard
- the scorecard can be used in HR appraisal

The app also includes dashboards, strategy views, and reporting, but this guide focuses first on the performance hierarchy, scoring, approvals, and appraisal use.

## 2. The Main Building Blocks

The system uses four main performance levels.

### 2.1 KPA

`KPA` means Key Performance Area.

A KPA is the top strategic category. In this app, a KPA is created once and reused across the whole system. It is not created separately for company, department, and employee.

Examples:

- Financial
- Customer
- Internal Processes
- Learning and Growth

### 2.2 Goal

A Goal is an objective under a KPA.

Goals can belong to three owner types:

- Company
- Department
- Employee

Examples:

- Company Goal: Improve profitability
- Department Goal: Reduce overdue receivables
- Employee Goal: Follow up high-risk debtors weekly

### 2.3 KRA

`KRA` means Key Result Area.

A KRA breaks a Goal into clear result areas.

Examples:

- Improve collection timeliness
- Reduce credit risk exposure
- Strengthen follow-up discipline

### 2.4 KPI

`KPI` means Key Performance Indicator.

A KPI is the measurable part of performance.

Examples:

- Percentage of overdue receivables
- Number of debt follow-ups completed
- Response success rate

KPIs are the level where actual measurement happens.

## 3. How the Hierarchy Works

The normal hierarchy is:

```text
KPA
  -> Goal
    -> KRA
      -> KPI
```

The ownership flow is usually:

```text
Company Goal
  -> Department Goal
    -> Employee Goal
```

Then each employee Goal gets KRAs, and each KRA gets KPIs.

So one employee scorecard row normally represents:

```text
KPA + Goal + KRA + KPI
```

## 4. What a Performance Scorecard Is

A Performance Scorecard is the employee's performance record for a specific period.

It contains:

- employee
- company
- department
- start date
- end date
- overall score
- status
- scorecard items

Each scorecard item stores:

- KPA
- Goal
- KRA
- KPI
- target
- actual
- score
- local KPI weightage
- effective weightage

Think of the scorecard as the employee's performance snapshot for a period.

## 5. KPI Master vs Scorecard Item

This is one of the most important distinctions in the system.

### KPI Master

`KPI Master` defines the KPI itself.

It is the source record for:

- KPI name
- linked KRA
- baseline
- target
- direction
- owner employee
- local KPI weightage

### Scorecard Item

`Scorecard Item` is the scorecard row created from that KPI for one employee and one period.

It stores the scorecard-specific values:

- KPI link
- target used for that scorecard
- actual achieved
- calculated score
- copied local weightage
- calculated effective weightage

Simple rule:

- `KPI Master` defines the KPI
- `Scorecard Item` uses that KPI inside one scorecard period

## 6. Ownership and Roll-Up Logic

Performance moves upward in the organization.

The business idea is:

- employee performance affects department performance
- department performance affects company performance

That does not mean the employee scorecard mixes all company records together. It means the employee branch contributes upward through the hierarchy.

## 7. Weightage Logic

The app uses hierarchical weightage, not flat weightage.

This means percentages are entered within their own parent group.

You do not add all KPIs from the entire tree directly and expect them to total 100. Instead, each level must be distributed correctly inside its own parent.

### 7.1 KPA Weightage

All KPAs together should total `100`.

Example:

- Financial = 40
- Internal Processes = 35
- Customer = 25

Total = 100

### 7.2 Goal Weightage

Goals are weighted inside their KPA.

Example under `Financial`:

- Goal A = 20
- Goal B = 30
- Goal C = 50

Total = 100

### 7.3 KRA Weightage

KRAs are weighted inside one Goal.

Example under Goal A:

- KRA 1 = 40
- KRA 2 = 60

Total = 100

### 7.4 KPI Weightage

KPIs are weighted inside one KRA.

Example under KRA 1:

- KPI 1 = 70
- KPI 2 = 30

Total = 100

## 8. Why Raw KPI Totals Can Look Wrong

If you add all KPI percentages across different KRAs, the total can become 300, 600, or 1000.

That is expected if you are adding local percentages from different branches.

Those local percentages are not the final scorecard percentages. They are only valid inside their own KRA.

That is why the system needs `effective weightage`.

## 9. Effective Weightage

Effective weightage is the final contribution of a KPI to the employee's scorecard.

Because KPA is global and reused everywhere, the final effective KPI weight is:

```text
Effective KPI % =
(KPA % x Goal % x KRA % x KPI %) / 100^3
```

This is the weight that should be used when the scorecard is fetched into Appraisal.

## 10. Why the Formula Divides by 100^3

Each level is a percentage. Percentages must first be treated like fractions before they are multiplied.

Example:

- KPA = 40%
- Goal = 50%
- KRA = 60%
- KPI = 25%

As fractions:

```text
0.40 x 0.50 x 0.60 x 0.25 = 0.03
```

Convert back to a percentage:

```text
0.03 x 100 = 3%
```

Using the original percentage numbers directly:

```text
40 x 50 x 60 x 25 / 100^3 = 3
```

That final `3` means `3%`.

Why `100^3` and not `100^4`?

- there are four percentage values
- multiplying four percentages gives four `/100` conversions
- the final answer is returned as a percent again, so one `x100` comes back
- the net result is division by `100^3`

## 11. Worked Example

Assume the employee scorecard has two KPAs:

- Financial = 40
- Internal Processes = 60

Under `Financial`:

- Goal F1 = 70
- Goal F2 = 30

Under Goal F1:

- KRA F1A = 50
- KRA F1B = 50

Under KRA F1A:

- KPI F1A-1 = 60
- KPI F1A-2 = 40

Effective weight for KPI F1A-1:

```text
40 x 70 x 50 x 60 / 100^3 = 8.4%
```

Effective weight for KPI F1A-2:

```text
40 x 70 x 50 x 40 / 100^3 = 5.6%
```

Together these two KPIs contribute:

```text
8.4 + 5.6 = 14%
```

That matches the branch distribution:

```text
40 x 70 x 50 / 100^2 = 14%
```

So the logic is internally consistent.

If every branch in the employee hierarchy is distributed correctly, the final effective scorecard weight totals `100`.

## 12. Validation Rules

The system should stop users from over-allocating weightage.

### 12.1 KPA Validation

All KPAs together should not exceed `100`.

If the total is already 50 and a user tries to save a new KPA with weightage 60, the system should reject it because the new total would be 110.

### 12.2 Goal Validation

Goals under the same parent context should not exceed `100`.

Examples:

- company goals under one KPA should not exceed 100
- department goals under one KPA should not exceed 100
- employee goals under one KPA should not exceed 100

### 12.3 KRA Validation

KRAs under one Goal should not exceed `100`.

### 12.4 KPI Validation

KPIs under one KRA should not exceed `100`.

### 12.5 Good User Message

A good validation message should explain:

- how much is already allocated
- how much is remaining
- what the user attempted to save
- what the total would become

Example:

```text
Weightage exceeded for KPIs under KRA Credit Recovery.
Allocated: 50.000%.
Remaining: 50.000%.
You tried to save 60.000%, which would total 110.000%.
```

## 13. How Scoring Works

### 13.1 KPI Score

At KPI level, score compares actual performance to the expected target.

For an `Increase` KPI, the basic idea is:

```text
score = (actual / target) x 100
```

For a `Decrease` KPI, the score is interpreted in reverse because lower values are better.

### 13.2 KRA Score

KPI scores roll into the KRA using KPI weightage.

### 13.3 Goal Score

KRA scores roll into the Goal using KRA weightage.

### 13.4 KPA Score

Goal scores roll into the KPA using Goal weightage.

### 13.5 Overall Scorecard Score

KPA scores roll into the final scorecard score using KPA weightage.

That final value is stored as `overall_score`.

## 14. Performance Update and Approval Flow

`Performance Update` is the controlled way to move actual results.

The intended process is:

1. employee enters or edits an update
2. update moves to pending review
3. manager reviews it
4. only approved updates affect the scorecard and dashboard movement

Important rule:

- pending updates do not move the score
- rejected updates do not move the score
- only approved updates should affect KPI actuals and score movement

This protects the scorecard from unapproved changes.

## 15. Why Overall Score May Stay at Zero

The most common reasons are:

- target is empty
- actual is empty
- KPI is not linked correctly
- weightages are not configured
- the update is still pending
- the update was not approved

## 16. How Appraisal Uses the Scorecard

The HR Appraisal fetch should use the employee's scorecard, not the entire company tree.

When `Fetch Scorecard` runs:

- the employee scorecard is loaded
- scorecard items are copied into the Appraisal goals table
- `effective_weightage` should be used first
- the final total in Appraisal should equal `100`

Why this matters:

- ERPNext Appraisal expects meaningful goal weightages
- if the fetched total is not 100, appraisal scoring becomes inconsistent

So the safe rule is:

- local KPI weightage is used inside its own KRA
- effective weightage is used for Appraisal and final scorecard contribution

## 17. Recommended Setup Order

For a clean implementation, use this order:

1. create KPAs and distribute total KPA weightage to 100
2. create Goals under each KPA and distribute them to 100
3. create KRAs under each Goal and distribute them to 100
4. create KPIs under each KRA and distribute them to 100
5. create employee scorecards
6. confirm effective scorecard weightage totals 100
7. record performance updates
8. approve valid updates
9. use the scorecard in Appraisal

## 18. Common Questions

### Is scorecard weightage the same as KPI weightage?

Not exactly.

- `KPI weightage` is local inside the KRA
- `effective weightage` is the final scorecard contribution

So the scorecard can store both:

- local weightage
- effective weightage

### Why can my raw KPI total be above 100?

Because you are probably adding KPI percentages from different KRAs. Those are local percentages, not final scorecard percentages.

### Which number should Appraisal use?

Appraisal should use the effective weightage because it represents the true final contribution of each KPI to the employee scorecard.

## 19. Troubleshooting

### Problem: All scorecard weightages are zero

Cause:

- KPI weightage was not entered
- or the scorecard was created before weightage syncing was available

Fix:

- define KPI weightage
- re-sync or regenerate the scorecard

### Problem: Appraisal fetch does not total 100

Cause:

- one or more hierarchy levels were not distributed correctly

Fix:

- check KPA totals
- check Goal totals under each KPA
- check KRA totals under each Goal
- check KPI totals under each KRA

### Problem: Dashboard does not move after an update

Cause:

- the update is still pending
- or it was not approved

Fix:

- approve the performance update
- confirm the update is linked to the correct KPI

## 20. Glossary

- `KPA`: top-level strategic focus area
- `Goal`: objective under a KPA
- `KRA`: key result area under a Goal
- `KPI`: measurable indicator under a KRA
- `Weightage`: percentage distribution inside a parent group
- `Effective Weightage`: final contribution after hierarchy multiplication
- `Performance Update`: a KPI update that goes through approval
- `Performance Scorecard`: employee performance record for a period
- `Appraisal`: HR evaluation that can reuse the employee scorecard

## 21. Final Principle

If you remember only one thing, remember this:

```text
Weights are entered locally.
Final scorecard contribution is calculated from the hierarchy.
```

That is how a scorecard with many KPIs can still produce a correct final total of `100`.
