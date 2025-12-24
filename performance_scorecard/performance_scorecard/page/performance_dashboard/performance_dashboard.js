frappe.pages['performance-dashboard'].on_page_load = function (wrapper) {
	var page = frappe.ui.make_app_page({
		parent: wrapper,
		title: 'Performance Dashboard',
		single_column: true
	});

	page.set_primary_action('Refresh', function () {
		load_dashboard(page);
	});

	load_dashboard(page);
}

function load_dashboard(page) {
	$(page.body).empty();
	$(page.body).append('<div class="dashboard-content">Loading...</div>');

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.performance_dashboard.performance_dashboard.get_dashboard_data",
		callback: function (r) {
			if (r.message) {
				render_dashboard(page, r.message);
			}
		}
	});
}

function render_dashboard(page, data) {
	$(page.body).empty();

	let html = `
	<div class="dashboard-container">
		<!-- Sidebar -->
		<div class="dashboard-sidebar">
			<div class="sidebar-header">
				<h3 style="color:white; margin:0;">${data.company}</h3>
			</div>
			<ul class="sidebar-menu">
				<li class="active"><i class="fa fa-home"></i> Home</li>
				<li><i class="fa fa-list"></i> Strategy Plans</li>
				<li><i class="fa fa-sitemap"></i> Strategy Maps</li>
				<li><i class="fa fa-exclamation-triangle"></i> Risk Management</li>
				<li><i class="fa fa-tachometer"></i> Dashboards</li>
				<li><i class="fa fa-file-text"></i> Reports</li>
				<li><i class="fa fa-cog"></i> Administration</li>
			</ul>
			<div class="user-profile">
				<div class="user-avatar"></div>
				<div>
					<div style="font-weight:bold; font-size:12px;">${data.fullname}</div>
					<div style="font-size:10px; color:#a0aec0;">${data.designation}</div>
				</div>
			</div>
		</div>

		<!-- Main Content -->
		<div class="dashboard-main">
			<div class="dashboard-header">
				<div class="page-title">Performance Overview</div>
				<div>
					<i class="fa fa-bell" style="font-size:18px; color:#718096; margin-right:15px;"></i>
					<i class="fa fa-user-circle" style="font-size:24px; color:#e53e3e;"></i>
				</div>
			</div>

			<!-- Top Section: 3 Pie Charts -->
			<div class="row" style="margin-bottom: 30px;">
				<div class="col-md-4">
					<div class="dashboard-card">
						<div class="card-header blue">Company Performance</div>
						<div id="chart-company" style="height: 200px;"></div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="dashboard-card">
						<div class="card-header light-blue">Department Performance</div>
						<div id="chart-department" style="height: 200px;"></div>
					</div>
				</div>
				<div class="col-md-4">
					<div class="dashboard-card">
						<div class="card-header cyan">Individual Performance</div>
						<div id="chart-individual" style="height: 200px;"></div>
					</div>
				</div>
			</div>

			<!-- Middle Section: Attention Required -->
			<div class="row" style="margin-bottom: 30px;">
				<div class="col-md-6">
					<div class="dashboard-card">
						<div class="card-header red">Department KRAs Needing Attention</div>
						<div class="card-content">
							${render_attention_table(data.dept_kras_attention)}
						</div>
					</div>
				</div>
				<div class="col-md-6">
					<div class="dashboard-card">
						<div class="card-header red">My KRAs Needing Attention</div>
						<div class="card-content">
							${render_attention_table(data.my_kras_attention)}
						</div>
					</div>
				</div>
			</div>

			<!-- Bottom Section: Goals & Achievements -->
			<div class="row">
				<div class="col-md-6">
					<div class="dashboard-card">
						<div class="card-header blue">This Week's Departmental Goals</div>
						<div class="card-content">
							${render_goals_table(data.weekly_goals)}
						</div>
					</div>
				</div>
				<div class="col-md-6">
					<div class="dashboard-card" style="margin-bottom: 20px;">
						<div class="card-header green">This Week's Achievements</div>
						<div class="card-content">
							${render_achievements_table(data.weekly_achievements)}
						</div>
					</div>
					<div class="dashboard-card">
						<div class="card-header green">Quarterly Achievements</div>
						<div class="card-content">
							${render_achievements_table(data.quarterly_achievements)}
						</div>
					</div>
				</div>
			</div>
		</div>
	</div>
	`;

	$(page.body).append(html);

	// Render Charts
	setTimeout(() => {
		render_pie_chart("#chart-company", data.company_performance);
		render_pie_chart("#chart-department", data.department_performance);
		render_pie_chart("#chart-individual", data.individual_performance);
	}, 500);
}

function render_pie_chart(selector, data) {
	if (!data || data.length === 0) {
		$(selector).html('<div class="empty-state">No data available</div>');
		return;
	}

	new frappe.Chart(selector, {
		data: {
			labels: data.map(d => d.label),
			datasets: [{ values: data.map(d => d.value) }]
		},
		type: 'donut',
		height: 200,
		colors: data.map(d => d.color)
	});
}

function render_attention_table(items) {
	if (!items || items.length === 0) return '<div class="empty-state">No items needing attention.</div>';

	let rows = items.map(item => `
		<tr>
			<td>${item.name}</td>
			<td><span class="badge badge-${item.status === 'Critical' ? 'red' : 'yellow'}">${item.status}</span></td>
			<td>${item.progress}%</td>
			<td>${item.owner}</td>
		</tr>
	`).join('');

	return `
		<table class="table table-sm">
			<thead><tr><th>KRA</th><th>Status</th><th>%</th><th>Owner</th></tr></thead>
			<tbody>${rows}</tbody>
		</table>
	`;
}

function render_goals_table(items) {
	if (!items || items.length === 0) return '<div class="empty-state">No goals for this week.</div>';

	let rows = items.map(item => `
		<tr>
			<td>${item.name}</td>
			<td>${item.assigned_to}</td>
			<td><span class="badge badge-yellow">${item.status}</span></td>
		</tr>
	`).join('');

	return `
		<table class="table table-sm">
			<thead><tr><th>Goal</th><th>Assigned To</th><th>Status</th></tr></thead>
			<tbody>${rows}</tbody>
		</table>
	`;
}

function render_achievements_table(items) {
	if (!items || items.length === 0) return '<div class="empty-state">No achievements yet.</div>';

	let rows = items.map(item => `
		<tr>
			<td>${item.name}</td>
			<td>${item.achieved_by}</td>
			<td>${item.score}</td>
		</tr>
	`).join('');

	return `
		<table class="table table-sm">
			<thead><tr><th>Goal</th><th>By</th><th>Score</th></tr></thead>
			<tbody>${rows}</tbody>
		</table>
	`;
}
