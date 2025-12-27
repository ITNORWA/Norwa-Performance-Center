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

	const home_html = build_home_html(data);

	let html = `
		<div class="dashboard-container">
			<!-- Sidebar -->
			<div class="dashboard-sidebar">
			<div class="sidebar-header">
				<h3 style="color:white; margin:0;">${data.company}</h3>
			</div>
				<ul class="sidebar-menu">
					<li class="active" data-section="home"><i class="fa fa-home"></i> Home</li>
					<li data-section="strategy-plans"><i class="fa fa-list"></i> Strategy Plans</li>
					<li data-section="strategy-maps"><i class="fa fa-sitemap"></i> Strategy Maps</li>
					<li data-section="risk-management"><i class="fa fa-exclamation-triangle"></i> Risk Management</li>
					<li data-section="dashboards"><i class="fa fa-tachometer"></i> Dashboards</li>
					<li data-section="reports"><i class="fa fa-file-text"></i> Reports</li>
					<li data-section="administration"><i class="fa fa-cog"></i> Administration</li>
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
				<div class="page-title">${data.company}</div>
				<div>
					<i class="fa fa-bell" style="font-size:18px; color:#718096; margin-right:15px;"></i>
					<i class="fa fa-user-circle" style="font-size:24px; color:#e53e3e;"></i>
				</div>
			</div>

				<div class="dashboard-content-area">
					${home_html}
				</div>
			</div>
		</div>
		`;

	$(page.body).append(html);

	bind_sidebar(page, data, home_html);
}

function build_home_html(data) {
	return `
		<div class="grid-container">
			<div class="dashboard-card">
				<div class="card-header blue">MY KEY OBJECTIVES</div>
				<div class="card-content">
					${data.objectives.length ?
				data.objectives.map(o => `<div class="list-item">${o.goal_name} <span class="badge badge-green">${o.status}</span></div>`).join('') :
				'<div class="empty-state">No key objectives assigned.</div>'}
				</div>
			</div>

			<div class="dashboard-card">
				<div class="card-header light-blue">MY KEY RESULTS</div>
				<div class="card-content">
					${data.key_results.length ?
				data.key_results.map(k => `<div class="list-item">${k.kra_name}</div>`).join('') :
				'<div class="empty-state">No key results tracked.</div>'}
				</div>
			</div>

			<div class="dashboard-card">
				<div class="card-header red">NEEDS ATTENTION (OVERDUE)</div>
				<div class="card-content">
					${data.needs_attention.length ?
				data.needs_attention.map(i => `<div class="list-item">${i.kpi}: ${i.actual}/${i.target}</div>`).join('') :
				'<div class="empty-state">Nothing seems overdue right now.</div>'}
				</div>
			</div>

			<div class="dashboard-card">
				<div class="card-header cyan">MY TASKS</div>
				<div class="card-content">
					${data.tasks.length ?
				data.tasks.map(t => `<div class="list-item">Update ${t.kpi} <span class="badge badge-yellow">${t.status}</span></div>`).join('') :
				'<div class="empty-state">No open tasks assigned.</div>'}
				</div>
			</div>

			<div class="dashboard-card">
				<div class="card-header yellow">KPIS NEEDING UPDATE</div>
				<div class="card-content">
					${data.kpis_needing_update.length ?
				data.kpis_needing_update.map(k => `<div>${k.name}</div>`).join('') :
				'<div class="empty-state">All your KPIs are up-to-date.</div>'}
				</div>
			</div>

			<div class="dashboard-card">
				<div class="card-header blue">RECENT KPI UPDATES</div>
				<div class="card-content">
					${data.recent_updates.length ?
				data.recent_updates.map(u => `<div class="list-item">${u.kpi}: ${u.actual_value}</div>`).join('') :
				'<div class="empty-state">No recent updates found for your KPIs.</div>'}
				</div>
			</div>
		</div>
	`;
}

function bind_sidebar(page, data, home_html) {
	const $body = $(page.body);
	const $content = $body.find(".dashboard-content-area");

	$body.find(".sidebar-menu li").on("click", function () {
		$body.find(".sidebar-menu li").removeClass("active");
		$(this).addClass("active");

		const section = $(this).data("section");
		if (section === "home") {
			$content.html(home_html);
			return;
		}

		if (section === "strategy-plans") {
			render_strategy_plans($content);
			return;
		}

		if (section === "strategy-maps") {
			render_strategy_maps($content);
			return;
		}

		render_placeholder($content, "This section is coming soon.");
	});
}

function render_placeholder($container, message) {
	$container.html(`<div class="empty-state">${message}</div>`);
}

function render_strategy_plans($container) {
	$container.html(`
		<div class="strategy-tabs" style="margin-bottom: 20px;">
			<ul class="nav nav-tabs">
				<li class="nav-item">
					<a class="nav-link active" data-level="Company" href="#">Company Strategy</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-level="Department" href="#">Department Strategy</a>
				</li>
				<li class="nav-item">
					<a class="nav-link" data-level="Individual" href="#">My Performance</a>
				</li>
			</ul>
		</div>
		<div class="strategy-content"></div>
	`);

	$container.find(".nav-link").on("click", function (e) {
		e.preventDefault();
		$container.find(".nav-link").removeClass("active");
		$(this).addClass("active");
		load_strategy_data($container, $(this).data("level"));
	});

	load_strategy_data($container, "Company");
}

function load_strategy_data($container, level) {
	const $content = $container.find(".strategy-content");
	$content.html('<div class="text-center text-muted">Loading...</div>');

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
		args: { level: level },
		callback: function (r) {
			if (r.message) {
				const payload = r.message;
				if (payload.meta && payload.meta.level === "Individual") {
					render_personal_panel($container, payload.personal || { scorecards: [], updates: [] });
					render_personal_table($content, payload.rows || []);
				} else {
					render_strategy_table($content, payload.goals || payload);
				}
			} else {
				$content.html('<div class="text-center text-muted">No strategy defined for this level.</div>');
			}
		}
	});
}

function render_strategy_table($container, data) {
	if (!data.length) {
		$container.html('<div class="text-center text-muted">No goals found.</div>');
		return;
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 20%">KPA</th>
						<th style="width: 30%">Goal</th>
						<th style="width: 10%">Weight</th>
						<th style="width: 30%">Key Result Areas (KRAs)</th>
						<th style="width: 10%">Actions</th>
					</tr>
				</thead>
				<tbody>
	`;

	data.forEach(goal => {
		let kras_html = goal.kras.map(k => `
			<div class="kra-item" style="margin-bottom: 5px; padding-bottom: 5px; border-bottom: 1px dashed #eee;">
				<strong>${k.kra_name}</strong> <span class="badge badge-secondary">${k.weightage}%</span>
				<div class="text-muted small">${k.description || ''}</div>
			</div>
		`).join('');

		html += `
			<tr>
				<td>${goal.kpa || '-'}</td>
				<td>
					<div style="font-weight: bold;">${goal.goal_name}</div>
					<div class="small text-muted">${goal.start_date} - ${goal.end_date}</div>
				</td>
				<td>${goal.weightage}%</td>
				<td>${kras_html || '<span class="text-muted">No KRAs</span>'}</td>
				<td>
					<button class="btn btn-xs btn-default btn-edit" data-name="${goal.name}">Edit</button>
				</td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	$container.html(html);

	$container.find(".btn-edit").on("click", function () {
		const goal_name = $(this).data("name");
		frappe.set_route("Form", "Goal", goal_name);
	});
}

function render_personal_panel($container, personal) {
	$container.find(".personal-actions").remove();
	$container.find(".personal-summaries").remove();

	let html = `
		<div class="personal-actions">
			<button class="btn btn-primary btn-sm" data-action="new-scorecard">Add Scorecard</button>
			<button class="btn btn-primary btn-sm" data-action="new-goal">Add Goal</button>
			<button class="btn btn-default btn-sm" data-action="new-kra">Add KRA</button>
			<button class="btn btn-default btn-sm" data-action="new-kpa">Add KPA</button>
			<button class="btn btn-default btn-sm" data-action="new-kpi">Add KPI</button>
			<button class="btn btn-default btn-sm" data-action="new-target">Set Target</button>
			<button class="btn btn-default btn-sm" data-action="new-update">Add Achievement</button>
		</div>
		<div class="personal-summaries">
			<div class="dashboard-card">
				<div class="card-header blue">MY SCORECARDS</div>
				<div class="card-content">
					${personal.scorecards.length ?
				personal.scorecards.map(s => `
						<div class="list-item scorecard-item" data-name="${s.name}">
							<span class="scorecard-link">${s.name}</span>
							<span class="badge badge-green">${s.status}</span>
						</div>
					`).join('') :
				'<div class="empty-state">No scorecards yet.</div>'}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header cyan">MY ACHIEVEMENTS</div>
				<div class="card-content">
					${personal.updates.length ?
				personal.updates.map(u => `<div class="list-item">${u.kpi}: ${u.actual_value}</div>`).join('') :
				'<div class="empty-state">No achievements yet.</div>'}
				</div>
			</div>
		</div>
	`;

	$container.find(".strategy-content").before(html);

	$container.find(".personal-actions .btn").on("click", function () {
		const action = $(this).data("action");
		if (action === "new-scorecard") {
			frappe.new_doc("Performance Scorecard");
		} else if (action === "new-goal") {
			frappe.new_doc("Goal");
		} else if (action === "new-kra") {
			frappe.new_doc("KRA");
		} else if (action === "new-kpa") {
			frappe.new_doc("KPA Master");
		} else if (action === "new-kpi") {
			frappe.new_doc("KPI Master");
		} else if (action === "new-target") {
			frappe.new_doc("Target");
		} else if (action === "new-update") {
			frappe.new_doc("Performance Update");
		}
	});

	$container.find(".scorecard-item").on("click", function () {
		const name = $(this).data("name");
		if (name) {
			frappe.set_route("Form", "Performance Scorecard", name);
		}
	});
}

function render_personal_table($container, rows) {
	if (!rows.length) {
		$container.html('<div class="text-center text-muted">No items yet. Create a scorecard to populate this table.</div>');
		return;
	}

	let html = `
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 14%">Key Performance Area</th>
						<th style="width: 18%">Goals</th>
						<th style="width: 16%">Key Result Areas (KRAs)</th>
						<th style="width: 18%">Performance Measures (Metrics)</th>
						<th style="width: 10%">Target</th>
						<th style="width: 8%">Actual</th>
						<th style="width: 8%">Score</th>
						<th style="width: 8%">Rating</th>
					</tr>
				</thead>
				<tbody>
	`;

	rows.forEach(row => {
		html += `
			<tr>
				<td>${row.kpa || "-"}</td>
				<td>${row.goal || "-"}</td>
				<td>${row.kra || "-"}</td>
				<td>${row.kpi_name || row.kpi || "-"}</td>
				<td>${row.target ?? "-"}</td>
				<td>${row.actual ?? "-"}</td>
				<td>${row.score ?? "-"}</td>
				<td>${row.rating || "-"}</td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	$container.html(html);
}

function render_strategy_maps($container) {
	$container.html('<div class="strategy-map-container">Loading...</div>');

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.strategy_maps.strategy_maps.get_strategy_map_data",
		callback: function (r) {
			if (r.message) {
				render_strategy_map($container, r.message);
			} else {
				$container.html('<div class="text-center text-muted">No strategy map data available.</div>');
			}
		}
	});
}

function render_strategy_map($container, data) {
	if (!data.length) {
		$container.html('<div class="text-center text-muted">No active company goals found.</div>');
		return;
	}

	let html = `<div class="org-chart">`;
	data.forEach(node => {
		html += render_node(node);
	});
	html += `</div>`;
	$container.html(html);
}

function render_node(node) {
	let childrenHtml = "";
	if (node.children && node.children.length > 0) {
		childrenHtml = `<div class="children">`;
		node.children.forEach(child => {
			childrenHtml += render_node(child);
		});
		childrenHtml += `</div>`;
	}

	return `
		<div class="node-wrapper">
			<div class="node ${node.type.toLowerCase()}">
				<div class="node-title">${node.label}</div>
				<div class="node-meta">${node.type}</div>
			</div>
			${childrenHtml}
		</div>
	`;
}
