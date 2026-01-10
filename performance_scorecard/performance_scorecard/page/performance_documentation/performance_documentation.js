frappe.pages['performance-documentation'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Performance Documentation',
		single_column: true
	});

	$(page.body).html(`
		<div class="doc-page">
			<div class="doc-hero">
				<h2>Performance Center User Guide</h2>
				<p>Use this page to understand how the app works, how calculations are done, and how to complete your daily work in Strategy, Scorecards, and Risk Management.</p>
			</div>

			<div class="doc-grid">
				<div class="dashboard-card doc-card">
					<div class="card-header blue">Quick Start</div>
					<div class="card-content">
						<ul>
							<li>Open Performance Dashboard from the sidebar.</li>
							<li>Create or review goals under Strategy Plans.</li>
							<li>Confirm KPIs and targets for your KRAs.</li>
							<li>Create a Performance Scorecard for an employee.</li>
							<li>Record Performance Updates to keep actuals current.</li>
							<li>Review charts, scorecards, and risk dashboards regularly.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header light-blue">Core Data Model</div>
					<div class="card-content">
						<ul>
							<li>KPA Master: top-level performance area with weightage.</li>
							<li>Goal: strategic objective (Company, Department, or Employee).</li>
							<li>KRA: key result area tied to a Goal.</li>
							<li>KPI Master: measurable KPI tied to a KRA.</li>
							<li>Target: period targets for KPIs.</li>
							<li>Performance Scorecard: overall score and KPI items.</li>
							<li>Performance Update: actual KPI values for a period.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header cyan">How Calculations Work</div>
					<div class="card-content">
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
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header red">Goal Hierarchy Rules</div>
					<div class="card-content">
						<ul>
							<li>Company Goals must link to a KPA and cannot have a parent.</li>
							<li>Department Goals must link to a parent Company Goal.</li>
							<li>Employee Goals must link to a parent Department Goal.</li>
							<li>KPA must match from parent to child goals.</li>
							<li>KRAs can only be created for Department or Employee goals.</li>
							<li>KPIs can only be created for Employee goals.</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="doc-grid">
				<div class="dashboard-card doc-card">
					<div class="card-header blue">Performance Dashboard (Home)</div>
					<div class="card-content">
						<ul>
							<li>My Key Objectives: goals assigned to you.</li>
							<li>My Key Results: KRAs tied to your goals.</li>
							<li>Needs Attention: low-scoring KPIs from the latest scorecard.</li>
							<li>My Tasks: pending performance updates.</li>
							<li>KPIs Needing Update: KPIs that require fresh data.</li>
							<li>Recent KPI Updates: your latest submitted values.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header light-blue">Strategy Plans</div>
					<div class="card-content">
						<ul>
							<li>Company Strategy: high-level goals and KPAs.</li>
							<li>Department Strategy: goals that roll up to company goals.</li>
							<li>My Performance: employee goals, KRAs, and KPIs.</li>
							<li>Use Add Goal and Add KRA to build the hierarchy.</li>
							<li>Use the Department filter for Department Strategy.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header cyan">Strategy Maps</div>
					<div class="card-content">
						<ul>
							<li>Tree view of strategy by level.</li>
							<li>Click nodes to expand and explore relationships.</li>
							<li>Use maps to validate rollups and owner type paths.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header red">Risk Management</div>
					<div class="card-content">
						<ul>
							<li>Risk Register: create, score, and track risks.</li>
							<li>Risk Context: define appetite and thresholds.</li>
							<li>Risk Treatment: record mitigations and residual risk.</li>
							<li>Risk Decision: approvals and sign-off for risks.</li>
							<li>Risk Heat Map: 5x5 grid of likelihood vs impact.</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="doc-grid">
				<div class="dashboard-card doc-card">
					<div class="card-header yellow">Workflows: How To Update</div>
					<div class="card-content">
						<div class="doc-subtitle">Create Scorecard</div>
						<ul>
							<li>Open Performance Scorecard.</li>
							<li>Select employee and period.</li>
							<li>Items auto-populate from KPIs.</li>
							<li>Set targets and weightages.</li>
							<li>Save to calculate the overall score.</li>
						</ul>
						<div class="doc-subtitle">Submit Updates</div>
						<ul>
							<li>Create a Performance Update for a KPI.</li>
							<li>Enter the actual value for the period.</li>
							<li>Save or Submit to update the scorecard.</li>
							<li>The scorecard recalculates automatically.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header blue">Charts and Indicators</div>
					<div class="card-content">
						<ul>
							<li>Number Cards show counts for key scorecard states.</li>
							<li>Scorecards by Status: distribution across Draft, Submitted, Approved.</li>
							<li>Scorecards by Department: volume by department.</li>
							<li>Total Score by Department: average performance by department.</li>
							<li>Progress bars show percent completion for KPAs and goals.</li>
							<li>Green is strong, yellow is moderate, red is weak.</li>
						</ul>
					</div>
				</div>

				<div class="dashboard-card doc-card">
					<div class="card-header light-blue">Risk Calculations</div>
					<div class="card-content">
						<pre class="doc-formula">risk score = likelihood * impact</pre>
						<ul>
							<li>Likelihood and Impact are selected as numbered values.</li>
							<li>Risk Level: High (>=15), Medium (>=6), Low (below 6).</li>
							<li>Residual risk uses treatment rows to update the final score.</li>
							<li>Appetite breach is calculated from Performance Settings and Context.</li>
						</ul>
					</div>
				</div>
			</div>

			<div class="dashboard-card doc-card">
				<div class="card-header red">Administration and Settings</div>
				<div class="card-content">
					<ul>
						<li>Scorecard Settings: rating scale and update frequency.</li>
						<li>Performance Settings: calculation method and risk appetite.</li>
						<li>Ensure roles have access to Goals, KRAs, KPIs, and Scorecards.</li>
						<li>Use Workspaces and Shortcuts for faster navigation.</li>
					</ul>
				</div>
			</div>
		</div>
	`);
};
