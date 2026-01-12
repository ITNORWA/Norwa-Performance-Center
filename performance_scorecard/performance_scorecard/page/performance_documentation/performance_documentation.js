frappe.pages['performance-documentation'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Performance Documentation',
		single_column: true
	});

	const sections = [
		{
			id: "quick-start",
			label: "Quick Start",
			color: "blue",
			content: `
				<ul>
					<li>Open Performance Dashboard from the sidebar and review the latest insights.</li>
					<li>Create or review goals under Strategy Plans (Company, Department, then Employee).</li>
					<li>Confirm KPIs and targets for your KRAs before creating a scorecard.</li>
					<li>Create a Performance Scorecard for the selected employee and period.</li>
					<li>Record Performance Updates weekly to keep actuals current.</li>
					<li>Use Weekly Commitments to track short-term delivery against KPIs.</li>
					<li>Review charts, scorecards, and risk dashboards regularly.</li>
				</ul>
			`
		},
		{
			id: "core-model",
			label: "Core Data Model",
			color: "light-blue",
			content: `
				<ul>
					<li>KPA Master: top-level performance area with weightage.</li>
					<li>Goal: strategic objective (Company, Department, or Employee).</li>
					<li>KRA: key result area tied to a Goal.</li>
					<li>KPI Master: measurable KPI tied to a KRA.</li>
					<li>Target: period targets for KPIs.</li>
					<li>Performance Scorecard: overall score and KPI items.</li>
					<li>Performance Update: actual KPI values for a period.</li>
					<li>Weekly Commitment: short-term commitments linked to KPIs.</li>
				</ul>
			`
		},
		{
			id: "calculations",
			label: "How Calculations Work",
			color: "cyan",
			content: `
				<div class="doc-subtitle">Item score</div>
				<pre class="doc-formula">score = (actual / target) * 100</pre>
				<div class="doc-subtitle">Weighted rollups</div>
				<pre class="doc-formula">weighted score = sum(score * weight) / sum(weight)</pre>
				<ul>
					<li>KPI scores roll up to KRA using KPI weightage.</li>
					<li>KRA scores roll up to Goal using KRA weightage.</li>
					<li>Goal scores roll up to KPA using Goal weightage.</li>
					<li>KPA scores roll up to the Scorecard overall score.</li>
				</ul>
				<div class="doc-note">Weights are percentages. If a weight is missing, that level contributes 0.</div>
			`
		},
		{
			id: "hierarchy",
			label: "Goal Hierarchy Rules",
			color: "red",
			content: `
				<ul>
					<li>Company Goals must link to a KPA and cannot have a parent.</li>
					<li>Department Goals must link to a parent Company Goal.</li>
					<li>Employee Goals must link to a parent Department Goal.</li>
					<li>KPA must match from parent to child goals.</li>
					<li>KRAs can only be created for Department or Employee goals.</li>
					<li>KPIs can only be created for Employee goals.</li>
				</ul>
			`
		},
		{
			id: "dashboard-home",
			label: "Performance Dashboard (Home)",
			color: "blue",
			content: `
				<ul>
					<li>My Key Objectives: goals assigned to you.</li>
					<li>My Key Results: KRAs tied to your goals.</li>
					<li>Needs Attention: low-scoring KPIs from the latest scorecard.</li>
					<li>My Tasks: pending performance updates.</li>
					<li>KPIs Needing Update: KPIs that require fresh data.</li>
					<li>Recent KPI Updates: your latest submitted values.</li>
				</ul>
			`
		},
		{
			id: "strategy-plans",
			label: "Strategy Plans",
			color: "light-blue",
			content: `
				<ul>
					<li>Company Strategy: high-level goals and KPAs.</li>
					<li>Department Strategy: goals that roll up to company goals.</li>
					<li>My Performance: employee goals, KRAs, and KPIs.</li>
					<li>Use Add Goal and Add KRA to build the hierarchy.</li>
					<li>Use the Department filter for Department Strategy.</li>
					<li>Use the Employee filter only when you have permission.</li>
				</ul>
			`
		},
		{
			id: "strategy-maps",
			label: "Strategy Maps",
			color: "cyan",
			content: `
				<ul>
					<li>Tree view of strategy by level.</li>
					<li>Click nodes to expand and explore relationships.</li>
					<li>Use maps to validate rollups and owner type paths.</li>
				</ul>
			`
		},
		{
			id: "risk-management",
			label: "Risk Management",
			color: "red",
			content: `
				<ul>
					<li>Risk Register: create, score, and track risks.</li>
					<li>Risk Context: define appetite and thresholds.</li>
					<li>Risk Treatment: record mitigations and residual risk.</li>
					<li>Risk Decision: approvals and sign-off for risks.</li>
					<li>Risk Heat Map: 5x5 grid of likelihood vs impact.</li>
				</ul>
			`
		},
		{
			id: "workflows",
			label: "Workflows: How To Update",
			color: "yellow",
			content: `
				<div class="doc-subtitle">Create Scorecard</div>
				<ul>
					<li>Open Performance Scorecard and click New.</li>
					<li>Select employee and period (start and end dates).</li>
					<li>Items auto-populate from KPIs linked to the employee.</li>
					<li>Set targets and weightages, then Save.</li>
					<li>Use Submit when ready for review.</li>
				</ul>
				<div class="doc-subtitle">Submit Updates</div>
				<ul>
					<li>Create a Performance Update for a KPI.</li>
					<li>Enter the actual value for the period and add comments.</li>
					<li>Save or Submit to update the scorecard.</li>
					<li>The scorecard recalculates automatically.</li>
				</ul>
				<div class="doc-subtitle">Weekly Commitments</div>
				<ul>
					<li>Add weekly commitments for KPIs you own.</li>
					<li>Update actual values as work completes.</li>
					<li>Commitments roll up into KPI actuals.</li>
				</ul>
			`
		},
		{
			id: "charts",
			label: "Charts and Indicators",
			color: "blue",
			content: `
				<ul>
					<li>Number Cards show counts for key scorecard states.</li>
					<li>Scorecards by Status: distribution across Draft, Submitted, Approved.</li>
					<li>Scorecards by Department: volume by department.</li>
					<li>Total Score by Department: average performance by department.</li>
					<li>Progress bars show percent completion for KPAs and goals.</li>
					<li>Green is strong, yellow is moderate, red is weak.</li>
				</ul>
			`
		},
		{
			id: "risk-calculations",
			label: "Risk Calculations",
			color: "light-blue",
			content: `
				<pre class="doc-formula">risk score = likelihood * impact</pre>
				<ul>
					<li>Likelihood and Impact are selected as numbered values.</li>
					<li>Risk Level: High (>=15), Medium (>=6), Low (below 6).</li>
					<li>Residual risk uses treatment rows to update the final score.</li>
					<li>Appetite breach is calculated from Performance Settings and Context.</li>
				</ul>
			`
		},
		{
			id: "admin",
			label: "Administration and Settings",
			color: "red",
			content: `
				<ul>
					<li>Scorecard Settings: rating scale and update frequency.</li>
					<li>Performance Settings: calculation method and risk appetite.</li>
					<li>Ensure roles have access to Goals, KRAs, KPIs, and Scorecards.</li>
					<li>Use Workspaces and Shortcuts for faster navigation.</li>
				</ul>
			`
		}
	];

	const cards = sections.map(section => `
		<div class="dashboard-card doc-card is-collapsed" data-doc="${section.id}">
			<button class="doc-toggle" type="button">
				<span class="doc-title">${section.label}</span>
				<span class="doc-toggle-meta">
					<span class="doc-toggle-icon">+</span>
					<span class="doc-toggle-text">Show details</span>
				</span>
			</button>
			<div class="card-content">${section.content}</div>
		</div>
	`).join("");

	$(page.body).html(`
		<div class="doc-page">
			<div class="doc-hero">
				<h2>Performance Center User Guide</h2>
				<p>Use this page to understand how the app works, how calculations are done, and how to complete your daily work in Strategy, Scorecards, and Risk Management.</p>
			</div>
			<div class="doc-grid">
				${cards}
			</div>
		</div>
	`);

	$(page.body).on("click", ".doc-toggle", function () {
		const $card = $(this).closest(".doc-card");
		const was_collapsed = $card.hasClass("is-collapsed");
		$(page.body).find(".doc-card").addClass("is-collapsed");
		$(page.body).find(".doc-toggle-icon").text("+");
		$(page.body).find(".doc-toggle-text").text("Show details");
		if (was_collapsed) {
			$card.removeClass("is-collapsed");
			$card.find(".doc-toggle-icon").text("-");
			$card.find(".doc-toggle-text").text("Hide details");
		}
	});
};
