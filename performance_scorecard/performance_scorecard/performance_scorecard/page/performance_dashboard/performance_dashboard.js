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

	const url_params = new URLSearchParams(window.location.search || "");
	const route_opts = frappe.route_options || {};
	const initial_section = route_opts.section || url_params.get("section") || "home";
	frappe.route_options = null;

	bind_sidebar(page, data, home_html, initial_section);
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

function bind_sidebar(page, data, home_html, initial_section) {
	const $body = $(page.body);
	const $content = $body.find(".dashboard-content-area");

	function render_section(section) {
		$body.find(".sidebar-menu li").removeClass("active");
		$body.find(`.sidebar-menu li[data-section="${section}"]`).addClass("active");

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

		if (section === "risk-management") {
			render_risk_management($content);
			return;
		}

		render_placeholder($content, "This section is coming soon.");
	}

	$body.find(".sidebar-menu li").on("click", function () {
		render_section($(this).data("section"));
	});

	render_section(initial_section || "home");
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
		<div class="strategy-actions" style="margin-bottom: 15px; display: none;">
			<button class="btn btn-primary btn-sm" data-action="add-goal">Add Goal</button>
			<button class="btn btn-default btn-sm" data-action="add-kra">Add KRA</button>
			<span class="dept-filter"></span>
		</div>
		<div class="strategy-content"></div>
	`);

	const $actions = $container.find(".strategy-actions");
	const $deptFilter = $actions.find(".dept-filter");
	const deptControl = frappe.ui.form.make_control({
		df: { fieldname: "department", fieldtype: "Link", options: "Department", label: "Department" },
		parent: $deptFilter,
		render_input: true
	});
	deptControl.refresh();

	$container.find(".nav-link").on("click", function (e) {
		e.preventDefault();
		$container.find(".nav-link").removeClass("active");
		$(this).addClass("active");
		const level = $(this).data("level");
		update_strategy_actions($actions, level);
		load_strategy_data($container, level, deptControl.get_value());
	});

	update_strategy_actions($actions, "Company");
	load_strategy_data($container, "Company", null);

	$actions.find("[data-action='add-goal']").on("click", function () {
		open_doctype_modal("Goal");
	});
	$actions.find("[data-action='add-kra']").on("click", function () {
		open_doctype_modal("KRA");
	});
	deptControl.$input.on("change", function () {
		const level = $container.find(".nav-link.active").data("level");
		if (level === "Department") {
			load_strategy_data($container, "Department", deptControl.get_value());
		}
	});
}

function render_risk_management($container) {
	$container.html(`
		<div class="grid-container">
			<div class="dashboard-card">
				<div class="card-header red">RISK OVERVIEW</div>
				<div class="card-content">Loading risk data...</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header blue">QUICK LINKS</div>
				<div class="card-content">
					<div class="list-item"><a href="/app/risk-dashboard">Risk Dashboard</a></div>
					<div class="list-item"><a href="/app/risk-register">Risk Register</a></div>
					<div class="list-item"><a href="/app/risk-heat-map">Risk Heat Map</a></div>
					<div class="list-item"><a href="/app/risk-context">Risk Contexts</a></div>
					<div class="list-item"><a href="/app/risk-treatment">Risk Treatments</a></div>
					<div class="list-item"><a href="/app/risk-decision">Risk Decisions</a></div>
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header yellow">TOP RISK CATEGORIES</div>
				<div class="card-content">Loading...</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header cyan">RISKS BY DEPARTMENT</div>
				<div class="card-content">Loading...</div>
			</div>
		</div>
	`);

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.risk_dashboard.risk_dashboard.get_dashboard_data",
		callback: function (r) {
			if (!r.message) {
				$container.find(".card-content").html("No risk data found.");
				return;
			}

			const data = r.message;
			const overview = `
				<div class="list-item">Total Open Risks <span class="badge badge-red">${data.total_open || 0}</span></div>
				<div class="list-item">High Risks <span class="badge badge-red">${data.high_risks || 0}</span></div>
				<div class="list-item">Appetite Breaches <span class="badge badge-yellow">${data.appetite_breaches || 0}</span></div>
				<div class="list-item">Overdue Reviews <span class="badge badge-yellow">${data.overdue_reviews || 0}</span></div>
			`;

			const categories = (data.categories || []).slice(0, 6);
			const categoryRows = categories.length
				? categories.map(c => `<div class="list-item">${c.risk_category || "Uncategorized"} <span class="badge badge-green">${c.count || 0}</span></div>`).join("")
				: '<div class="empty-state">No open risks found.</div>';

			const departments = (data.departments || []).slice(0, 6);
			const deptRows = departments.length
				? departments.map(d => `<div class="list-item">${d.department || "Unassigned"} <span class="badge badge-green">${d.count || 0}</span></div>`).join("")
				: '<div class="empty-state">No department data yet.</div>';

			const $cards = $container.find(".dashboard-card");
			$cards.eq(0).find(".card-content").html(overview);
			$cards.eq(2).find(".card-content").html(categoryRows);
			$cards.eq(3).find(".card-content").html(deptRows);
		}
	});
}

function load_strategy_data($container, level, department) {
	const $content = $container.find(".strategy-content");
	$content.html('<div class="text-center text-muted">Loading...</div>');

	frappe.call({
		method: "performance_scorecard.performance_scorecard.page.strategy_plans.strategy_plans.get_strategy_data",
		args: { level: level, department: department },
		callback: function (r) {
			if (r.message) {
				const payload = r.message;
				if (payload.meta && payload.meta.level === "Individual") {
					render_personal_panel($container, payload.personal || { scorecards: [], updates: [] }, payload.rollups || {});
					render_personal_table($content, payload.rows || [], $container);
				} else if (payload.meta && payload.meta.level === "Company" && payload.company) {
					render_company_strategy($content, payload.company);
				} else {
					render_strategy_table($content, payload.goals || payload);
				}
			} else {
				$content.html('<div class="text-center text-muted">No strategy defined for this level.</div>');
			}
		}
	});
}

function update_strategy_actions($actions, level) {
	if (level === "Company" || level === "Department") {
		$actions.show();
		$actions.find("[data-action='add-goal']").text(level === "Company" ? "Add Company Goal" : "Add Department Goal");
		$actions.find("[data-action='add-kra']").toggle(level === "Department");
		$actions.find(".dept-filter").toggle(level === "Department");
	} else {
		$actions.hide();
	}
}

function render_company_strategy($container, company) {
	const kpas = company.kpas || [];
	if (!kpas.length) {
		$container.html('<div class="text-center text-muted">No company KPAs or goals found.</div>');
		return;
	}

	const edit_icon = frappe.utils.icon("edit", "sm");
	let html = `
		<div class="personal-actions">
			<button class="btn btn-primary btn-sm" data-action="new-company-kpa">Add KPA</button>
			<button class="btn btn-primary btn-sm" data-action="new-company-goal">Add Goal</button>
		</div>
		<div class="table-responsive">
			<table class="table table-bordered table-hover">
				<thead class="thead-light">
					<tr>
						<th style="width: 16%">KPA</th>
						<th style="width: 22%">Goal</th>
						<th style="width: 10%">Goal Weight</th>
						<th style="width: 12%">Avg Dept Weight</th>
						<th style="width: 20%">Top Dept</th>
						<th style="width: 20%">Bottom Dept</th>
					</tr>
				</thead>
				<tbody>
	`;

	kpas.forEach(kpa => {
		(kpa.goals || []).forEach(goal => {
			const best = (goal.department_contributions || [])[0];
			const worst = goal.worst_department;
			html += `
				<tr>
					<td class="editable-cell" data-goal-id="${goal.goal_id}" data-field="kpa" data-value="${kpa.kpa || ''}">
						<span class="cell-value">${kpa.kpa}</span>
						<span class="edit-icon">${edit_icon}</span>
					</td>
					<td class="editable-cell" data-goal-id="${goal.goal_id}" data-field="goal_name" data-value="${goal.goal || ''}">
						<span class="cell-value">${goal.goal}</span>
						<span class="edit-icon">${edit_icon}</span>
					</td>
					<td>${goal.weightage || 0}%</td>
					<td>${(goal.avg_dept_weightage || 0).toFixed(1)}%</td>
					<td>
						${best ? `<span class="dept-link" data-dept="${best.department}">${best.department}</span>
						<span class="badge badge-green">${(best.average_score || 0).toFixed(1)}%</span>` : "-"}
					</td>
					<td>
						${worst ? `<span class="dept-link" data-dept="${worst.department}">${worst.department}</span>
						<span class="badge badge-red">${(worst.average_score || 0).toFixed(1)}%</span>` : "-"}
					</td>
				</tr>
			`;
		});
	});

	html += `</tbody></table></div>`;

	html += `<div class="dashboard-card">
		<div class="card-header blue">KPA & GOALS</div>
		<div class="card-content">
			<div class="table-responsive">
				<table class="table table-sm kpa-goals-table">
					<thead>
						<tr>
							<th style="width: 30%">KPA</th>
							<th>Goal</th>
							<th style="width: 16%">Contribution</th>
							<th style="width: 16%">KPA Progress</th>
						</tr>
					</thead>
					<tbody>
						${kpas.map(kpa => `
							${(kpa.goals || []).length ? kpa.goals.map(g => `
								<tr>
									<td><strong>${kpa.kpa}</strong></td>
									<td>${g.goal}</td>
									<td>${(g.weightage || 0).toFixed(1)}%</td>
									<td><span class="badge badge-green">${(kpa.average_score || 0).toFixed(1)}%</span></td>
								</tr>
							`).join("") : `
								<tr>
									<td><strong>${kpa.kpa}</strong></td>
									<td class="text-muted">No goals</td>
									<td>0%</td>
									<td><span class="badge badge-green">${(kpa.average_score || 0).toFixed(1)}%</span></td>
								</tr>
							`}
						`).join("")}
					</tbody>
				</table>
			</div>
		</div>
	</div>`;

	$container.html(html);

	$container.find("[data-action='new-company-kpa']").on("click", function () {
		open_doctype_modal("KPA Master");
	});
	$container.find("[data-action='new-company-goal']").on("click", function () {
		open_doctype_modal("Goal");
	});

	$container.find(".editable-cell").on("click", function () {
		const $cell = $(this);
		if ($cell.hasClass("editing")) {
			return;
		}
		const goal_id = $cell.data("goal-id");
		const field = $cell.data("field");
		const current = $cell.data("value") || "";
		if (!goal_id || !field) {
			return;
		}

		$cell.addClass("editing");
		const $wrapper = $("<div class='inline-editor'></div>");
		$cell.find(".cell-value").hide();
		$cell.append($wrapper);

		const control = frappe.ui.form.make_control({
			df: {
				fieldtype: field === "kpa" ? "Link" : "Data",
				fieldname: field,
				options: field === "kpa" ? "KPA Master" : undefined
			},
			parent: $wrapper,
			render_input: true
		});
		control.set_value(current);
		control.refresh();
		control.$input.focus();

		const save_value = () => {
			const value = control.get_value();
			frappe.call({
				method: "frappe.client.set_value",
				args: {
					doctype: "Goal",
					name: goal_id,
					fieldname: field,
					value: value
				},
				callback: () => {
					$cell.removeClass("editing");
					$wrapper.remove();
					$cell.find(".cell-value").text(value || "-").show();
					$cell.data("value", value);
					const $page = $container.closest(".dashboard-content-area");
					load_strategy_data($page, "Company");
				}
			});
		};

		control.$input.on("blur", save_value);
		control.$input.on("keydown", function (e) {
			if (e.key === "Enter") {
				e.preventDefault();
				save_value();
			}
		});
	});

	$container.find(".dept-link").on("click", function () {
		const dept = $(this).data("dept");
		if (!dept) {
			return;
		}
		const route = `/app/performance-scorecard?department=${encodeURIComponent(dept)}`;
		open_route_modal("Department Scorecards", route);
	});
}

function open_route_modal(title, url) {
	const dialog = new frappe.ui.Dialog({
		title: title,
		size: "extra-large",
		fields: [{ fieldname: "frame", fieldtype: "HTML" }]
	});
	dialog.get_field("frame").$wrapper.html(
		`<iframe src="${url}" style="width: 100%; height: 70vh; border: 0;"></iframe>`
	);
	dialog.show();
}

function open_doctype_modal(doctype, name) {
	const slug = frappe.router.slug(doctype);
	const url = name ? `/app/${slug}/${encodeURIComponent(name)}` : `/app/${slug}/new-${slug}`;
	const dialog = new frappe.ui.Dialog({
		title: doctype,
		size: "extra-large",
		fields: [{ fieldname: "frame", fieldtype: "HTML" }]
	});
	dialog.get_field("frame").$wrapper.html(
		`<iframe src="${url}" style="width: 100%; height: 70vh; border: 0;"></iframe>`
	);
	dialog.show();
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

function render_personal_panel($container, personal, rollups) {
	$container.find(".personal-actions").remove();
	$container.find(".personal-summaries").remove();

	const kpa_rows = (rollups.kpas || []).map(k => {
		const avg = (k.average_score || 0).toFixed(1);
		const badge = avg >= 80 ? "badge-green" : (avg >= 60 ? "badge-yellow" : "badge-red");
		return `<div class="list-item"><span>${k.kpa}</span><span class="badge ${badge}">${avg}%</span></div>`;
	}).join("");

	let html = `
		<div class="personal-actions">
			<button class="btn btn-primary btn-sm" data-action="new-scorecard">Add Scorecard</button>
			<button class="btn btn-primary btn-sm" data-action="new-goal">Add Goal</button>
			<button class="btn btn-default btn-sm" data-action="new-kra">Add KRA</button>
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
				personal.updates.map(u => {
					const badge = u.status_color === "green" ? "badge-green" : (u.status_color === "yellow" ? "badge-yellow" : "badge-red");
					return `
						<div class="list-item">
							<div class="achievement-title">${u.kpi_name || u.kpi}</div>
							<div class="achievement-meta">
								<span>Actual: ${u.actual_value}</span>
								<span>Target ≥ ${u.threshold_green}</span>
								<span>Warning ≥ ${u.threshold_yellow}</span>
								<span class="badge ${badge}">${u.status_label || u.status}</span>
							</div>
						</div>
					`;
				}).join('') :
				'<div class="empty-state">No achievements yet.</div>'}
				</div>
			</div>
			<div class="dashboard-card">
				<div class="card-header yellow">KPA AVERAGES</div>
				<div class="card-content">
					${kpa_rows || '<div class="empty-state">No KPA scores yet.</div>'}
				</div>
			</div>
		</div>
	`;

	$container.find(".strategy-content").before(html);

	$container.find(".personal-actions .btn").on("click", function () {
		const action = $(this).data("action");
		if (action === "new-scorecard") {
			open_doctype_modal("Performance Scorecard");
		} else if (action === "new-goal") {
			open_doctype_modal("Goal");
		} else if (action === "new-kra") {
			open_doctype_modal("KRA");
		} else if (action === "new-kpi") {
			open_doctype_modal("KPI Master");
		} else if (action === "new-target") {
			open_doctype_modal("Target");
		} else if (action === "new-update") {
			open_doctype_modal("Performance Update");
		}
	});

	$container.find(".scorecard-item").on("click", function () {
		const name = $(this).data("name");
		if (name) {
			frappe.set_route("Form", "Performance Scorecard", name);
		}
	});
}

function render_personal_table($container, rows, $page_container) {
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
						<th style="width: 6%">Actions</th>
					</tr>
				</thead>
				<tbody>
	`;

	rows.forEach((row, index) => {
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
				<td><button class="btn btn-xs btn-default btn-edit-row" data-index="${index}">Edit</button></td>
			</tr>
		`;
	});

	html += `</tbody></table></div>`;
	$container.html(html);

	$container.find(".btn-edit-row").on("click", function () {
		const row = rows[$(this).data("index")];
		if (!row || !row.item_name) {
			frappe.msgprint("Unable to edit this row. Please refresh and try again.");
			return;
		}

		const dialog = new frappe.ui.Dialog({
			title: "Edit Scorecard Item",
			fields: [
				{ fieldname: "kpa", fieldtype: "Link", options: "KPA Master", label: "KPA", reqd: 1, default: row.kpa },
				{ fieldname: "goal", fieldtype: "Link", options: "Goal", label: "Goal", reqd: 1, default: row.goal },
				{ fieldname: "kra", fieldtype: "Link", options: "KRA", label: "KRA", reqd: 1, default: row.kra },
				{ fieldname: "kpi", fieldtype: "Link", options: "KPI Master", label: "KPI", reqd: 1, default: row.kpi },
				{ fieldname: "weightage", fieldtype: "Percent", label: "Weightage", default: row.weightage },
				{ fieldname: "target", fieldtype: "Float", label: "Target", default: row.target },
				{ fieldname: "actual", fieldtype: "Float", label: "Actual", default: row.actual }
			],
			primary_action_label: "Save",
			primary_action: (values) => {
				frappe.call({
					method: "frappe.client.set_value",
					args: {
						doctype: "Scorecard Item",
						name: row.item_name,
						fieldname: values
					},
					callback: () => {
						dialog.hide();
						if ($page_container && $page_container.length) {
							load_strategy_data($page_container, "Individual");
						}
					}
				});
			}
		});
		dialog.show();
	});
}

function open_doctype_modal(doctype) {
	const slug = frappe.router.slug(doctype);
	const url = `/app/${slug}/new-${slug}`;
	const dialog = new frappe.ui.Dialog({
		title: doctype,
		size: "extra-large",
		fields: [{ fieldname: "frame", fieldtype: "HTML" }]
	});
	dialog.get_field("frame").$wrapper.html(
		`<iframe src="${url}" style="width: 100%; height: 70vh; border: 0;"></iframe>`
	);
	dialog.show();
}

function render_strategy_maps($container) {
	const url = "/app/strategy-maps";
	$container.html(`
		<div style="height: 80vh; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
			<iframe src="${url}" style="width: 100%; height: 100%; border: 0;"></iframe>
		</div>
	`);
}
